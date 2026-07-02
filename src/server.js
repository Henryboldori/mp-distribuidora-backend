require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const clientesRoutes = require('./routes/clientes');
const produtosRoutes = require('./routes/produtos');
const pedidosRoutes = require('./routes/pedidos');
const usuariosRoutes = require('./routes/usuarios');
const dashboardRoutes = require('./routes/dashboard');
const romaneioRoutes = require('./routes/romaneio');
const buscaRoutes = require('./routes/busca');
const fornecedoresRoutes = require('./routes/fornecedores');
const relatoriosRoutes = require('./routes/relatorios');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', mensagem: 'API Bebidas Pelicano rodando.' });
});

app.use('/login', authRoutes);
app.use('/clientes', clientesRoutes);
app.use('/produtos', produtosRoutes);
app.use('/pedidos', pedidosRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/romaneio', romaneioRoutes);
app.use('/busca', buscaRoutes);
app.use('/fornecedores', fornecedoresRoutes);
app.use('/relatorios', relatoriosRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});