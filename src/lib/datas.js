// Helper para lidar com datas SEMPRE no horario de Brasilia,
// independente do timezone em que o servidor esta rodando (Render/Railway/Vercel
// geralmente rodam em UTC, o que fazia pedidos da noite carem no dia errado
// e a pagina de "hoje" ficar vazia).

function limitesDoDia(dataStr) {
  const base = dataStr || hojeBrasilia();
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

// Retorna a data de "hoje" no formato YYYY-MM-DD, considerando o horario de Brasilia
// (e nao o horario UTC do servidor, que pode estar um dia a frente a noite).
function hojeBrasilia() {
  const agoraBrasilia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const y = agoraBrasilia.getFullYear();
  const m = String(agoraBrasilia.getMonth() + 1).padStart(2, '0');
  const d = String(agoraBrasilia.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = { limitesDoDia, inicioDoDiaBrasilia, hojeBrasilia };