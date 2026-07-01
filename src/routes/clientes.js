const express = require('express');
const prisma = require('../lib/prisma');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar); // todas as rotas abaixo exigem login

// GET /clientes - lista todos (admin e vendedor veem todos, para facilitar pedidos)
router.get('/', async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({ orderBy: { nome: 'asc' } });
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar clientes.' });
  }
});

// POST /clientes - cria novo cliente
router.post('/', async (req, res) => {
  const { nome, endereco, telefone, categoria, observacoes } = req.body;

  if (!nome || !endereco) {
    return res.status(400).json({ erro: 'Nome e endereco sao obrigatorios.' });
  }

  try {
    const cliente = await prisma.cliente.create({
      data: { nome, endereco, telefone, categoria, observacoes, vendedorId: req.usuario.id }
    });
    res.status(201).json(cliente);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar cliente.' });
  }
});

// PUT /clientes/:id - edita cliente
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, endereco, telefone, categoria, observacoes } = req.body;

  try {
    const cliente = await prisma.cliente.update({
      where: { id: Number(id) },
      data: { nome, endereco, telefone, categoria, observacoes }
    });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar cliente.' });
  }
});

// DELETE /clientes/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.cliente.delete({ where: { id: Number(id) } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir cliente. Verifique se ele tem pedidos vinculados.' });
  }
});

module.exports = router;
