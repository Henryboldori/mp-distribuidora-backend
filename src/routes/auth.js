const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const router = express.Router();

// POST /login
router.post('/', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario) {
      return res.status(401).json({ erro: 'E-mail ou senha invalidos.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'E-mail ou senha invalidos.' });
    }

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, role: usuario.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      id: usuario.id,
      nome: usuario.nome,
      role: usuario.role
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno ao fazer login.' });
  }
});

module.exports = router;
