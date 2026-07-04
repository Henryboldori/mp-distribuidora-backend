const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar, somenteAdmin); // fornecedores e entradas: somente admin

// GET /fornecedores - lista todos
router.get('/', async (req, res) => {
  try {
    const fornecedores = await prisma.fornecedor.findMany({ orderBy: { nome: 'asc' } });
    res.json(fornecedores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar fornecedores.' });
  }
});

// POST /fornecedores - cria novo fornecedor
router.post('/', async (req, res) => {
  const { nome, telefone } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome do fornecedor e obrigatorio.' });

  try {
    const fornecedor = await prisma.fornecedor.create({ data: { nome, telefone } });
    res.status(201).json(fornecedor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar fornecedor.' });
  }
});

// PUT /fornecedores/:id - edita fornecedor
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, telefone } = req.body;

  try {
    const fornecedor = await prisma.fornecedor.update({
      where: { id: Number(id) },
      data: { nome, telefone }
    });
    res.json(fornecedor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar fornecedor.' });
  }
});

// DELETE /fornecedores/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.fornecedor.delete({ where: { id: Number(id) } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir fornecedor. Verifique se ele tem entradas de estoque vinculadas.' });
  }
});

// IMPORTANTE: rota /entradas precisa vir ANTES de qualquer /:id acima nao conflita
// porque sao metodos e paths distintos, mas mantemos as rotas de entrada juntas aqui embaixo.

// GET /fornecedores/entradas?produtoId=123 - historico de entradas de estoque
router.get('/entradas', async (req, res) => {
  try {
    const where = {};
    if (req.query.produtoId) where.produtoId = Number(req.query.produtoId);

    const entradas = await prisma.entradaEstoque.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { produto: true, fornecedor: true }
    });
    res.json(entradas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar entradas de estoque.' });
  }
});

// POST /fornecedores/entradas - registra entrada e ja soma no estoque do produto
router.post('/entradas', async (req, res) => {
  const { produtoId, fornecedorId, quantidade, custoUnitario } = req.body;

  const qtd = Number(quantidade);
  if (!produtoId || !qtd || qtd <= 0) {
    return res.status(400).json({ erro: 'Selecione um produto e informe uma quantidade valida.' });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const produto = await tx.produto.findUnique({ where: { id: Number(produtoId) } });
      if (!produto) throw new Error('Produto nao encontrado.');

      if (fornecedorId) {
        const fornecedor = await tx.fornecedor.findUnique({ where: { id: Number(fornecedorId) } });
        if (!fornecedor) throw new Error('Fornecedor nao encontrado.');
      }

      const entrada = await tx.entradaEstoque.create({
        data: {
          produtoId: Number(produtoId),
          fornecedorId: fornecedorId ? Number(fornecedorId) : null,
          quantidade: qtd,
          custoUnitario: custoUnitario !== undefined ? Number(custoUnitario) : null
        },
        include: { produto: true, fornecedor: true }
      });

      await tx.produto.update({
        where: { id: Number(produtoId) },
        data: { estoque: { increment: qtd } }
      });

      return entrada;
    });

    res.status(201).json(resultado);
  } catch (err) {
    console.error(err);
    res.status(400).json({ erro: err.message || 'Erro ao registrar entrada de estoque.' });
  }
});

module.exports = router;