// Script que cria o primeiro usuario ADMIN no banco.
// Rode com: npm run seed
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const emailAdmin = 'admin@mpdistribuidora.com';
  const senhaAdmin = 'admin123'; // TROQUE essa senha depois de logar pela primeira vez!

  const existente = await prisma.usuario.findUnique({ where: { email: emailAdmin } });
  if (existente) {
    console.log('Usuario admin ja existe. Nada foi alterado.');
    return;
  }

  const senhaHash = await bcrypt.hash(senhaAdmin, 10);

  await prisma.usuario.create({
    data: {
      nome: 'Administrador',
      email: emailAdmin,
      senha: senhaHash,
      role: 'ADMIN'
    }
  });

  console.log('✅ Usuario admin criado com sucesso!');
  console.log(`   E-mail: ${emailAdmin}`);
  console.log(`   Senha: ${senhaAdmin}`);
  console.log('   ⚠️  Troque essa senha assim que possivel.');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
