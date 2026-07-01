require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const clientesRoutes = require('./routes/clientes');
const produtosRoutes = require('./routes/produtos');
const pedidosRoutes = require('./routes/pedidos');
const usuariosRoutes = require('./routes/usuarios');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// Libera o frontend para acessar a API (CORS)
app.use(cors({
  origin: process.env.FRONTEND_URL || '*'
}));

app.use(express.json());

// Rota de teste, util pra ver se a API esta no ar
app.get('/', (req, res) => {
  res.json({ status: 'ok', mensagem: 'API M&P Distribuidora rodando.' });
});

app.use('/login', authRoutes); // mantem /login direto, igual o frontend ja espera
app.use('/clientes', clientesRoutes);
app.use('/produtos', produtosRoutes);
app.use('/pedidos', pedidosRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/dashboard', dashboardRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
