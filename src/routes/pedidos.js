const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /pedidos - admin ve todos, vendedor ve so os dele
router.get('/', async (req, res) => {
  try {
    const where = req.usuario.role === 'ADMIN' ? {} : { vendedorId: req.usuario.id };

    const pedidos = await prisma.pedido.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        cliente: true,
        vendedor: { select: { nome: true } },
        itens: { include: { produto: true } }
      }
    });
    res.json(pedidos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pedidos.' });
  }
});

// POST /pedidos - cria pedido, calcula total com desconto e abate do estoque
// Body esperado: { clienteId, itens: [{ produtoId, quantidade }], formaPagamento, observacoes }
router.post('/', async (req, res) => {
  const { clienteId, itens, formaPagamento, observacoes } = req.body;

  if (!clienteId || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Selecione um cliente e ao menos um produto.' });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      let valorTotal = 0;
      const itensParaCriar = [];

      for (const item of itens) {
        const produto = await tx.produto.findUnique({ where: { id: Number(item.produtoId) } });

        if (!produto) {
          throw new Error(`Produto ${item.produtoId} nao encontrado.`);
        }
        if (produto.estoque < item.quantidade) {
          throw new Error(`Estoque insuficiente para "${produto.nome}". Disponivel: ${produto.estoque}.`);
        }

        // Aplica o desconto cadastrado no produto
        const precoComDesconto = produto.preco * (1 - (produto.desconto || 0) / 100);
        valorTotal += precoComDesconto * item.quantidade;

        itensParaCriar.push({
          produtoId: produto.id,
          quantidade: item.quantidade,
          precoUnit: precoComDesconto
        });

        // Abate do estoque
        await tx.produto.update({
          where: { id: produto.id },
          data: { estoque: { decrement: item.quantidade } }
        });
      }

      const pedido = await tx.pedido.create({
        data: {
          clienteId: Number(clienteId),
          vendedorId: req.usuario.id,
          valorTotal,
          status: 'PENDENTE',
          formaPagamento: formaPagamento || 'DINHEIRO',
          statusPagamento: formaPagamento === 'FIADO' ? 'PENDENTE' : 'PAGO',
          observacoes,
          itens: { create: itensParaCriar }
        },
        include: { itens: { include: { produto: true } }, cliente: true }
      });

      return pedido;
    });

    res.status(201).json(resultado);
  } catch (err) {
    console.error(err);
    res.status(400).json({ erro: err.message || 'Erro ao criar pedido.' });
  }
});

// PUT /pedidos/:id/status - atualiza status (ex: ENTREGUE, CANCELADO)
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const statusValidos = ['PENDENTE', 'EM_ROTA', 'ENTREGUE', 'CANCELADO'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ erro: 'Status invalido.' });
  }

  try {
    const pedido = await prisma.pedido.update({
      where: { id: Number(id) },
      data: { status }
    });
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar status do pedido.' });
  }
});

// PUT /pedidos/:id/pagamento - marca como pago/pendente (util pra pedidos FIADO)
router.put('/:id/pagamento', async (req, res) => {
  const { id } = req.params;
  const { statusPagamento } = req.body;

  if (!['PAGO', 'PENDENTE'].includes(statusPagamento)) {
    return res.status(400).json({ erro: 'Status de pagamento invalido.' });
  }

  try {
    const pedido = await prisma.pedido.update({
      where: { id: Number(id) },
      data: { statusPagamento }
    });
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar pagamento.' });
  }
});

// DELETE /pedidos/:id - somente ADMIN pode excluir (ex: pedido duplicado por engano)
// Devolve os itens pro estoque antes de excluir
router.delete('/:id', somenteAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id: Number(id) },
        include: { itens: true }
      });
      if (!pedido) throw new Error('Pedido nao encontrado.');

      // Devolve as quantidades pro estoque
      for (const item of pedido.itens) {
        await tx.produto.update({
          where: { id: item.produtoId },
          data: { estoque: { increment: item.quantidade } }
        });
      }

      await tx.pedido.delete({ where: { id: Number(id) } });
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message || 'Erro ao excluir pedido.' });
  }
});

module.exports = router;
