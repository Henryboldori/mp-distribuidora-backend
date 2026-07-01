const { PrismaClient } = require('@prisma/client');

// Instancia unica do Prisma (evita abrir varias conexoes com o banco)
const prisma = new PrismaClient();

module.exports = prisma;
