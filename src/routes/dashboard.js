const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar, somenteAdmin);

// GET /dashboard - resumo geral pro admin: vendas, estoque, valores
router.get('/', async (req, res) => {
  try {
    const [totalProdutos, produtos, totalPedidos, pedidos, totalClientes] = await Promise.all([
      prisma.produto.count(),
      prisma.produto.findMany(),
      prisma.pedido.count(),
      prisma.pedido.findMany({ where: { status: { not: 'CANCELADO' } } }),
      prisma.cliente.count()
    ]);

    const valorTotalVendido = pedidos.reduce((acc, p) => acc + p.valorTotal, 0);
    const valorEmEstoque = produtos.reduce((acc, p) => acc + p.preco * p.estoque, 0);
    const produtosEstoqueBaixo = produtos.filter(p => p.estoque <= p.estoqueMin);

    res.json({
      totalProdutos,
      totalPedidos,
      totalClientes,
      valorTotalVendido,
      valorEmEstoque,
      produtosEstoqueBaixo
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao montar o dashboard.' });
  }
});

module.exports = router;
