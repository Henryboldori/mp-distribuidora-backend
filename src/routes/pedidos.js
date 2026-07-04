const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

router.get('/', async (req, res) => {
  try {
    const where = req.usuario.role === 'ADMIN' ? {} : { vendedorId: req.usuario.id };
    if (req.query.clienteId) where.clienteId = Number(req.query.clienteId);
    if (req.query.data) {
      const inicio = new Date(req.query.data + 'T00:00:00');
      const fim = new Date(req.query.data + 'T23:59:59');
      where.createdAt = { gte: inicio, lte: fim };
    }

    const pedidos = await prisma.pedido.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { cliente: true, vendedor: { select: { nome: true } }, itens: { include: { produto: true } } }
    });
    res.json(pedidos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pedidos.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id: Number(req.params.id) },
      include: { cliente: true, vendedor: { select: { nome: true } }, itens: { include: { produto: true } } }
    });
    if (!pedido) return res.status(404).json({ erro: 'Pedido nao encontrado.' });
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pedido.' });
  }
});

// POST /pedidos - cada item pode vir com produtoId (catalogo) OU nomeAvulso (fora do catalogo)
router.post('/', async (req, res) => {
  const { clienteId, itens, formaPagamento, observacoes } = req.body;

  if (!clienteId || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Selecione um cliente e ao menos um item.' });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      let valorTotal = 0;
      const itensParaCriar = [];

      for (const item of itens) {
        const quantidade = Number(item.quantidade) || 0;

        // CRUCIAL: so busca no catalogo se realmente veio um produtoId. Item avulso NUNCA passa por aqui.
        if (item.produtoId) {
          const produto = await tx.produto.findUnique({ where: { id: Number(item.produtoId) } });
          if (!produto) throw new Error(`Produto ${item.produtoId} nao encontrado.`);

          const precoUnit = item.precoUnit !== undefined ? Number(item.precoUnit) : produto.preco * (1 - (produto.desconto || 0) / 100);
          valorTotal += precoUnit * quantidade;
          itensParaCriar.push({ produtoId: produto.id, quantidade, precoUnit });

          await tx.produto.update({ where: { id: produto.id }, data: { estoque: { decrement: quantidade } } });
        } else {
          const precoUnit = Number(item.precoUnit) || 0;
          valorTotal += precoUnit * quantidade;
          itensParaCriar.push({
            nomeAvulso: item.nomeAvulso || 'Item avulso',
            unidadeAvulso: item.unidadeAvulso || 'Unidade',
            quantidade,
            precoUnit
          });
        }
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

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { clienteId, itens, formaPagamento, observacoes } = req.body;

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Pedido precisa ter ao menos um item.' });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const pedidoAtual = await tx.pedido.findUnique({ where: { id: Number(id) }, include: { itens: true } });
      if (!pedidoAtual) throw new Error('Pedido nao encontrado.');

      for (const item of pedidoAtual.itens) {
        if (item.produtoId) {
          await tx.produto.update({ where: { id: item.produtoId }, data: { estoque: { increment: item.quantidade } } });
        }
      }
      await tx.itemPedido.deleteMany({ where: { pedidoId: Number(id) } });

      let valorTotal = 0;
      const itensParaCriar = [];

      for (const item of itens) {
        const quantidade = Number(item.quantidade) || 0;

        if (item.produtoId) {
          const produto = await tx.produto.findUnique({ where: { id: Number(item.produtoId) } });
          if (!produto) throw new Error(`Produto ${item.produtoId} nao encontrado.`);

          const precoUnit = item.precoUnit !== undefined ? Number(item.precoUnit) : produto.preco * (1 - (produto.desconto || 0) / 100);
          valorTotal += precoUnit * quantidade;
          itensParaCriar.push({ produtoId: produto.id, quantidade, precoUnit });

          await tx.produto.update({ where: { id: produto.id }, data: { estoque: { decrement: quantidade } } });
        } else {
          const precoUnit = Number(item.precoUnit) || 0;
          valorTotal += precoUnit * quantidade;
          itensParaCriar.push({
            nomeAvulso: item.nomeAvulso || 'Item avulso',
            unidadeAvulso: item.unidadeAvulso || 'Unidade',
            quantidade,
            precoUnit
          });
        }
      }

      const pedido = await tx.pedido.update({
        where: { id: Number(id) },
        data: {
          clienteId: clienteId ? Number(clienteId) : pedidoAtual.clienteId,
          valorTotal,
          formaPagamento: formaPagamento || pedidoAtual.formaPagamento,
          observacoes,
          itens: { create: itensParaCriar }
        },
        include: { itens: { include: { produto: true } }, cliente: true }
      });

      return pedido;
    });

    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(400).json({ erro: err.message || 'Erro ao atualizar pedido.' });
  }
});

router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const statusValidos = ['PENDENTE', 'EM_ROTA', 'ENTREGUE', 'CANCELADO'];
  if (!statusValidos.includes(status)) return res.status(400).json({ erro: 'Status invalido.' });

  try {
    const pedido = await prisma.pedido.update({ where: { id: Number(id) }, data: { status } });
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar status do pedido.' });
  }
});

router.put('/:id/pagamento', async (req, res) => {
  const { id } = req.params;
  const { statusPagamento } = req.body;
  if (!['PAGO', 'PENDENTE'].includes(statusPagamento)) return res.status(400).json({ erro: 'Status de pagamento invalido.' });

  try {
    const pedido = await prisma.pedido.update({ where: { id: Number(id) }, data: { statusPagamento } });
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar pagamento.' });
  }
});

router.delete('/:id', somenteAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({ where: { id: Number(id) }, include: { itens: true } });
      if (!pedido) throw new Error('Pedido nao encontrado.');

      for (const item of pedido.itens) {
        if (item.produtoId) {
          await tx.produto.update({ where: { id: item.produtoId }, data: { estoque: { increment: item.quantidade } } });
        }
      }
      await tx.pedido.delete({ where: { id: Number(id) } });
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message || 'Erro ao excluir pedido.' });
  }
});

module.exports = router;