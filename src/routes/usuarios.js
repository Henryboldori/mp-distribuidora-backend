const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar, somenteAdmin); // SOMENTE admin mexe em usuarios

// GET /usuarios
router.get('/', async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, email: true, role: true, createdAt: true } // nunca retorna a senha
    });
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar usuarios.' });
  }
});

// POST /usuarios - cria novo vendedor ou admin
router.post('/', async (req, res) => {
  const { nome, email, senha, role } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Preencha nome, e-mail e senha.' });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.create({
      data: { nome, email, senha: senhaHash, role: role === 'ADMIN' ? 'ADMIN' : 'VENDEDOR' }
    });
    res.status(201).json({ id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ erro: 'Ja existe um usuario com esse e-mail.' });
    }
    res.status(500).json({ erro: 'Erro ao criar usuario.' });
  }
});

// DELETE /usuarios/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.usuario.delete({ where: { id: Number(id) } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir usuario.' });
  }
});

module.exports = router;
