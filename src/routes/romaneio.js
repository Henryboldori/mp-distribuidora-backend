const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /romaneio?data=YYYY-MM-DD
// Soma as quantidades de cada produto entre TODOS os pedidos do dia (nao cancelados)
router.get('/', async (req, res) => {
  try {
    const dataStr = req.query.data || new Date().toISOString().slice(0, 10);
    const inicio = new Date(dataStr + 'T00:00:00');
    const fim = new Date(dataStr + 'T23:59:59');

    const where = {
      createdAt: { gte: inicio, lte: fim },
      status: { not: 'CANCELADO' }
    };
    if (req.usuario.role !== 'ADMIN') where.vendedorId = req.usuario.id;

    const pedidos = await prisma.pedido.findMany({
      where,
      include: {
        cliente: true,
        vendedor: { select: { nome: true } },
        itens: { include: { produto: true } }
      }
    });

    const porProduto = {};

    pedidos.forEach(p => {
      p.itens.forEach(item => {
        if (item.produtoId) {
          const key = `cat-${item.produtoId}`;
          if (!porProduto[key]) {
            porProduto[key] = {
              produtoId: item.produtoId,
              nome: item.produto ? item.produto.nome : 'Produto removido',
              categoria: item.produto ? item.produto.categoria : '-',
              unidade: item.produto ? item.produto.unidade : 'Unidade',
              quantidade: 0
            };
          }
          porProduto[key].quantidade += item.quantidade;
        } else {
          const nomeChave = (item.nomeAvulso || 'item').toLowerCase().trim();
          const key = `avulso-${nomeChave}-${item.unidadeAvulso || ''}`;
          if (!porProduto[key]) {
            porProduto[key] = {
              nome: item.nomeAvulso || 'Item avulso',
              unidade: item.unidadeAvulso || 'Unidade',
              quantidade: 0
            };
          }
          porProduto[key].quantidade += item.quantidade;
        }
      });
    });

    const todos = Object.values(porProduto);
    const itensCatalogo = todos.filter(i => i.produtoId).sort((a, b) => b.quantidade - a.quantidade);
    const itensAvulsos = todos.filter(i => !i.produtoId).sort((a, b) => b.quantidade - a.quantidade);

    res.json({
      data: dataStr,
      totalPedidos: pedidos.length,
      itensCatalogo,
      itensAvulsos,
      pedidos: pedidos.map(p => ({
        id: p.id,
        cliente: p.cliente ? p.cliente.nome : '-',
        vendedor: p.vendedor ? p.vendedor.nome : '-',
        qtdItens: p.itens.reduce((acc, i) => acc + i.quantidade, 0),
        valorTotal: p.valorTotal
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao montar romaneio.' });
  }
});

module.exports = router;