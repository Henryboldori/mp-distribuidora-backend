const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /produtos - todos podem ver (vendedor precisa pra montar pedido)
router.get('/', async (req, res) => {
  try {
    const produtos = await prisma.produto.findMany({ orderBy: { nome: 'asc' } });
    res.json(produtos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar produtos.' });
  }
});

// POST /produtos - somente ADMIN cria produto
router.post('/', somenteAdmin, async (req, res) => {
  const { nome, descricao, preco, desconto, estoque, estoqueMin } = req.body;

  if (!nome || preco === undefined) {
    return res.status(400).json({ erro: 'Nome e preco sao obrigatorios.' });
  }

  try {
    const produto = await prisma.produto.create({
      data: {
        nome,
        descricao,
        preco: Number(preco),
        desconto: Number(desconto) || 0,
        estoque: Number(estoque) || 0,
        estoqueMin: Number(estoqueMin) || 5
      }
    });
    res.status(201).json(produto);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar produto.' });
  }
});

// PUT /produtos/:id - somente ADMIN edita (preco, desconto, estoque, etc)
router.put('/:id', somenteAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome, descricao, preco, desconto, estoque, estoqueMin } = req.body;

  try {
    const produto = await prisma.produto.update({
      where: { id: Number(id) },
      data: {
        nome,
        descricao,
        preco: preco !== undefined ? Number(preco) : undefined,
        desconto: desconto !== undefined ? Number(desconto) : undefined,
        estoque: estoque !== undefined ? Number(estoque) : undefined,
        estoqueMin: estoqueMin !== undefined ? Number(estoqueMin) : undefined
      }
    });
    res.json(produto);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar produto.' });
  }
});

// DELETE /produtos/:id - somente ADMIN
router.delete('/:id', somenteAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.produto.delete({ where: { id: Number(id) } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir produto. Verifique se ele esta em algum pedido.' });
  }
});

module.exports = router;
