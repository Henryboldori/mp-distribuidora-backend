const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /busca?q=termo - busca simples em clientes e produtos
router.get('/', async (req, res) => {
  const termo = (req.query.q || '').trim();

  if (!termo) {
    return res.json({ clientes: [], produtos: [] });
  }

  try {
    const [clientes, produtos] = await Promise.all([
      prisma.cliente.findMany({
        where: {
          OR: [
            { nome: { contains: termo, mode: 'insensitive' } },
            { telefone: { contains: termo, mode: 'insensitive' } },
            { endereco: { contains: termo, mode: 'insensitive' } }
          ]
        },
        take: 20,
        orderBy: { nome: 'asc' }
      }),
      prisma.produto.findMany({
        where: {
          nome: { contains: termo, mode: 'insensitive' }
        },
        take: 20,
        orderBy: { nome: 'asc' }
      })
    ]);

    res.json({ clientes, produtos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao realizar busca.' });
  }
});

module.exports = router;