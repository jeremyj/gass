// Consegna report sent to a Telegram group/channel on close, laid out like the old turno report emails
const { roundToCents, calculateTrovatoInCassa } = require('./calculations');

// Same as formatNumber in public/js/shared/utils.js: 11,50 / 8
function num(value) {
  const n = roundToCents(value || 0);
  return n % 1 === 0 ? n.toString() : n.toFixed(2).replace('.', ',');
}

const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Body without the title: what is compared to decide whether a reclose resends
function reportBody(db, consegnaId, baseUrl) {
  const c = db.prepare('SELECT * FROM consegne WHERE id = ?').get(consegnaId);
  const prev = db.prepare('SELECT lasciato_in_cassa FROM consegne WHERE data < ? ORDER BY data DESC LIMIT 1').get(c.data);
  const movimenti = db.prepare(`
    SELECT m.*, u.display_name AS nome FROM movimenti m JOIN users u ON u.id = m.partecipante_id
    WHERE m.consegna_id = ? ORDER BY m.id
  `).all(consegnaId);
  const teatro = db.prepare(`
    SELECT u.display_name AS nome, p.importo FROM teatro_pagamenti p JOIN users u ON u.id = p.user_id
    WHERE p.consegna_id = ? ORDER BY p.id
  `).all(consegnaId);
  const turno = db.prepare(`
    SELECT u1.display_name AS t1, u2.display_name AS t2 FROM turni t
    LEFT JOIN users u1 ON u1.id = t.turnista1_id LEFT JOIN users u2 ON u2.id = t.turnista2_id
    WHERE t.data = ?
  `).get(c.data);

  // debito_saldato holds the whole prior debt, debito_lasciato the remainder (see debitoPagato/debitoNuovo)
  const sections = [
    ['Debiti saldati', movimenti.filter(m => m.debito_saldato > 0).map(m => {
      const resta = m.debito_lasciato > 0 ? ` (resta debito ${num(m.debito_lasciato)})` : '';
      return `${m.nome} ${num(m.debito_saldato - (m.debito_lasciato || 0))}${resta}`;
    })],
    ['Debiti lasciati', movimenti.filter(m => !(m.debito_saldato > 0) && m.debito_lasciato > 0).map(m => `${m.nome} ${num(m.debito_lasciato)}`)],
    ['Crediti lasciati', movimenti.filter(m => m.credito_lasciato > 0).map(m => `${m.nome} ${num(m.credito_lasciato)}`)],
    ['Crediti usati', movimenti.filter(m => m.usa_credito > 0).map(m => `${m.nome} ${num(m.usa_credito)}`)],
    ['Quota teatro', teatro.map(p => `${p.nome} ${num(p.importo)}`)]
  ].filter(([, items]) => items.length).map(([label, items]) => `${label}: ${items.join(', ')}`);

  const turnisti = turno && [turno.t1, turno.t2].filter(Boolean);
  const lines = [
    ...(turnisti?.length ? [`In turno: ${turnisti.join(' + ')}`] : []),
    '',
    `Trovato in cassa: ${num(calculateTrovatoInCassa(c, prev?.lasciato_in_cassa))} €`,
    `Pagato al produttore: ${num(c.pagato_produttore)} €`,
    ...(sections.length ? ['', ...sections] : []),
    '',
    `Lasciato in cassa: ${num(c.lasciato_in_cassa)} €`,
    `${baseUrl}/consegna?data=${c.data}`
  ];
  return escape(lines.join('\n'));
}

function title(date, corretto) {
  const [y, m, d] = date.split('-');
  return `<b>Report turno ${d}/${m}/${y}${corretto ? ' (corretto)' : ''}</b>`;
}

function buildReport(db, consegnaId, baseUrl) {
  const { data } = db.prepare('SELECT data FROM consegne WHERE id = ?').get(consegnaId);
  return `${title(data, false)}\n${reportBody(db, consegnaId, baseUrl)}`;
}

async function sendTelegram(text) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } })
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
}

// Send the report unless the same one was already sent; a reclose that changed it is marked (corretto)
async function notifyClosed(db, consegnaId, baseUrl, send = sendTelegram) {
  const c = db.prepare('SELECT data, report_inviato FROM consegne WHERE id = ?').get(consegnaId);
  const body = reportBody(db, consegnaId, baseUrl);
  if (body === c.report_inviato) return;
  await send(`${title(c.data, c.report_inviato != null)}\n${body}`);
  db.prepare('UPDATE consegne SET report_inviato = ? WHERE id = ?').run(body, consegnaId);
}

const telegramConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

module.exports = { buildReport, notifyClosed, telegramConfigured };
