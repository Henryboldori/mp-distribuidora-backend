const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar } = require('../middleware/auth');
const { limitesDoDia, hojeBrasilia } = require('../lib/datas');

const router = express.Router();
router.use(autenticar);

// GET /relatorios?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const ehAdmin = req.usuario.role === 'ADMIN';
    const hoje = hojeBrasilia();
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

// GET /relatorios/inadimplentes - clientes com pedidos fiado/pendentes de pagamento
router.get('/inadimplentes', async (req, res) => {
  try {
    const ehAdmin = req.usuario.role === 'ADMIN';
    const where = {
      statusPagamento: 'PENDENTE',
      status: { not: 'CANCELADO' }
    };
    if (!ehAdmin) where.vendedorId = req.usuario.id;

    const pedidos = await prisma.pedido.findMany({
      where,
      include: { cliente: true },
      orderBy: { createdAt: 'asc' }
    });

    const porCliente = {};
    const hoje = new Date();

    pedidos.forEach(p => {
      const clienteId = p.clienteId;
      if (!porCliente[clienteId]) {
        porCliente[clienteId] = {
          clienteId,
          nome: p.cliente?.nome || 'Desconhecido',
          telefone: p.cliente?.telefone || null,
          totalPendente: 0,
          qtdPedidos: 0,
          pedidoMaisAntigo: p.createdAt
        };
      }
      porCliente[clienteId].totalPendente += p.valorTotal;
      porCliente[clienteId].qtdPedidos += 1;
      if (new Date(p.createdAt) < new Date(porCliente[clienteId].pedidoMaisAntigo)) {
        porCliente[clienteId].pedidoMaisAntigo = p.createdAt;
      }
    });

    const lista = Object.values(porCliente).map((c) => {
      const diasEmAberto = Math.floor((hoje - new Date(c.pedidoMaisAntigo)) / (1000 * 60 * 60 * 24));
      return { ...c, diasEmAberto };
    }).sort((a, b) => b.diasEmAberto - a.diasEmAberto);

    res.json({
      totalGeralPendente: lista.reduce((acc, c) => acc + c.totalPendente, 0),
      clientes: lista
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar inadimplentes.' });
  }
});

// GET /relatorios/clientes-inativos?dias=20 - clientes que compraram antes mas pararam ha X dias
// (separa de quem NUNCA comprou, que e uma categoria diferente e nao deve contar como "inativo")
router.get('/clientes-inativos', async (req, res) => {
  try {
    const ehAdmin = req.usuario.role === 'ADMIN';
    const diasLimite = Number(req.query.dias) || 20;

    const whereClientes = ehAdmin ? {} : { vendedorId: req.usuario.id };

    const clientes = await prisma.cliente.findMany({
      where: whereClientes,
      include: {
        pedidos: {
          where: { status: { not: 'CANCELADO' } },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    const hoje = new Date();

    const nuncaCompraram = [];
    const inativos = [];

    clientes.forEach(c => {
      const ultimoPedido = c.pedidos[0];

      if (!ultimoPedido) {
        nuncaCompraram.push({ id: c.id, nome: c.nome, telefone: c.telefone });
        return;
      }

      const diasSemComprar = Math.floor((hoje - new Date(ultimoPedido.createdAt)) / (1000 * 60 * 60 * 24));
      if (diasSemComprar > diasLimite) {
        inativos.push({
          id: c.id,
          nome: c.nome,
          telefone: c.telefone,
          ultimaCompra: ultimoPedido.createdAt,
          diasSemComprar
        });
      }
    });

    inativos.sort((a, b) => b.diasSemComprar - a.diasSemComprar);

    res.json({
      diasLimite,
      totalInativos: inativos.length,
      totalNuncaCompraram: nuncaCompraram.length,
      inativos,
      nuncaCompraram
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar clientes inativos.' });
  }
});

module.exports = router;