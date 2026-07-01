const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /dashboard - admin ve tudo, vendedor ve so os proprios numeros
router.get('/', async (req, res) => {
  try {
    const ehAdmin = req.usuario.role === 'ADMIN';
    const wherePedidos = ehAdmin ? { status: { not: 'CANCELADO' } } : { status: { not: 'CANCELADO' }, vendedorId: req.usuario.id };

    const [totalProdutos, produtos, totalClientes, pedidos] = await Promise.all([
      prisma.produto.count(),
      prisma.produto.findMany(),
      ehAdmin ? prisma.cliente.count() : prisma.cliente.count({ where: { vendedorId: req.usuario.id } }),
      prisma.pedido.findMany({
        where: wherePedidos,
        include: { vendedor: { select: { nome: true } } }
      })
    ]);

    const valorTotalVendido = pedidos.reduce((acc, p) => acc + p.valorTotal, 0);
    const valorPendenteRecebimento = pedidos
      .filter(p => p.statusPagamento === 'PENDENTE')
      .reduce((acc, p) => acc + p.valorTotal, 0);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const pedidosHoje = pedidos.filter(p => new Date(p.createdAt) >= hoje);
    const valorVendidoHoje = pedidosHoje.reduce((acc, p) => acc + p.valorTotal, 0);

    const resposta = {
      totalProdutos,
      totalPedidos: pedidos.length,
      totalClientes,
      valorTotalVendido,
      valorVendidoHoje,
      pedidosHoje: pedidosHoje.length,
      valorPendenteRecebimento
    };

    // Somente admin ve dados de estoque geral e ranking de vendedores
    if (ehAdmin) {
      resposta.valorEmEstoque = produtos.reduce((acc, p) => acc + p.preco * p.estoque, 0);
      resposta.produtosEstoqueBaixo = produtos.filter(p => p.estoque <= p.estoqueMin);

      const porVendedor = {};
      pedidos.forEach(p => {
        const nome = p.vendedor?.nome || 'Desconhecido';
        porVendedor[nome] = (porVendedor[nome] || 0) + p.valorTotal;
      });
      resposta.vendasPorVendedor = Object.entries(porVendedor)
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total);
    }

    res.json(resposta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao montar o dashboard.' });
  }
});

module.exports = router;
