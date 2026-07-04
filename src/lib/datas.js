// Helper para montar limites de dia SEMPRE no horario de Brasilia,
// independente do timezone em que o servidor esta rodando (Render/Railway/Vercel
// geralmente rodam em UTC, o que fazia pedidos da noite carem no dia errado).

function limitesDoDia(dataStr) {
  const base = dataStr || new Date().toISOString().slice(0, 10);
  const inicio = new Date(`${base}T00:00:00.000-03:00`);
  const fim = new Date(`${base}T23:59:59.999-03:00`);
  return { inicio, fim };
}

function inicioDoDiaBrasilia(date = new Date()) {
  const agoraBrasilia = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  agoraBrasilia.setHours(0, 0, 0, 0);
  const y = agoraBrasilia.getFullYear();
  const m = String(agoraBrasilia.getMonth() + 1).padStart(2, '0');
  const d = String(agoraBrasilia.getDate()).padStart(2, '0');
  return limitesDoDia(`${y}-${m}-${d}`);
}

module.exports = { limitesDoDia, inicioDoDiaBrasilia };