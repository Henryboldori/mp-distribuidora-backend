const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar } = require('../middleware/auth');
const { limitesDoDia } = require('../lib/datas');

const router = express.Router();
router.use(autenticar);

// GET /relatorios?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const ehAdmin = req.usuario.role === 'ADMIN';
    const hoje = new Date().toISOString().slice(0, 10);
    const inicioStr = req.query.inicio || hoje;
    const fimStr = req.query.fim || hoje;

    const { inicio } = limitesDoDia(inicioStr);
    const { fim } = limitesDoDia(fimStr);

    const where = {
      createdAt: { gte: inicio, lte: fim },
      status: { not: 'CANCELADO' }
    };
    if (!ehAdmin) {
      where.vendedorId = req.usuario.id;
    } else if (req.query.vendedorId) {
      where.vendedorId = Number(req.query.vendedorId);
    }

    const pedidos = await prisma.pedido.findMany({
      where,
      include: { cliente: true, vendedor: { select: { nome: true } }, itens: true }
    });

    const totalVendido = pedidos.reduce((acc, p) => acc + p.valorTotal, 0);
    const totalPedidos = pedidos.length;
    const ticketMedio = totalPedidos > 0 ? totalVendido / totalPedidos : 0;

    const idsProdutos = [...new Set(pedidos.flatMap(p => p.itens.map(i => i.produtoId).filter(Boolean)))];
    const produtosCatalogo = await prisma.produto.findMany({ where: { id: { in: idsProdutos } } });
    const nomeProdutoPorId = Object.fromEntries(produtosCatalogo.map(p => [p.id, p.nome]));

    const rankingProdutos = {};
    pedidos.forEach(p => {
      p.itens.forEach(item => {
        const nome = item.produtoId ? (nomeProdutoPorId[item.produtoId] || 'Produto removido') : (item.nomeAvulso || 'Item avulso');
        rankingProdutos[nome] = (rankingProdutos[nome] || 0) + item.quantidade;
      });
    });
    const produtoMaisVendido = Object.entries(rankingProdutos).sort((a, b) => b[1] - a[1])[0];

    const porCliente = {};
    pedidos.forEach(p => {
      const nome = p.cliente?.nome || 'Desconhecido';
      porCliente[nome] = (porCliente[nome] || 0) + p.valorTotal;
    });
    const clienteQueMaisCompra = Object.entries(porCliente).sort((a, b) => b[1] - a[1])[0];

    const porDia = {};
    pedidos.forEach(p => {
      const dia = new Date(p.createdAt).toISOString().slice(0, 10);
      porDia[dia] = (porDia[dia] || 0) + p.valorTotal;
    });

    res.json({
      periodo: { inicio: inicioStr, fim: fimStr },
      totalVendido,
      totalPedidos,
      ticketMedio,
      produtoMaisVendido: produtoMaisVendido ? { nome: produtoMaisVendido[0], quantidade: produtoMaisVendido[1] } : null,
      clienteQueMaisCompra: clienteQueMaisCompra ? { nome: clienteQueMaisCompra[0], total: clienteQueMaisCompra[1] } : null,
      vendasPorDia: Object.entries(porDia).map(([dia, total]) => ({ dia, total })).sort((a, b) => a.dia.localeCompare(b.dia)),
      rankingProdutos: Object.entries(rankingProdutos).map(([nome, quantidade]) => ({ nome, quantidade })).sort((a, b) => b.quantidade - a.quantidade).slice(0, 10)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao montar relatorio.' });
  }
});

module.exports = router;