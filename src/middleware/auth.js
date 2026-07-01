const jwt = require('jsonwebtoken');

// Verifica se o usuario esta logado (token valido)
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ erro: 'Token nao fornecido. Faca login novamente.' });
  }

  const token = authHeader.split(' ')[1]; // formato: "Bearer TOKEN"

  try {
    const dados = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = dados; // { id, nome, role }
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Sessao expirada. Faca login novamente.' });
  }
}

// Verifica se o usuario logado e ADMIN
function somenteAdmin(req, res, next) {
  if (req.usuario?.role !== 'ADMIN') {
    return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
  }
  next();
}

module.exports = { autenticar, somenteAdmin };
