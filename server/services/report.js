// Consegna report sent on close to a Telegram group/channel and/or by email, laid out like the old turno report emails
const nodemailer = require('nodemailer');
const { roundToCents, calculateTrovatoInCassa } = require('./calculations');
const { listUscite, totaleUscite } = require('./uscite');

// Same as formatNumber in public/js/shared/utils.js: 11,50 / 8
function num(value) {
  const n = roundToCents(value || 0);
  return n % 1 === 0 ? n.toString() : n.toFixed(2).replace('.', ',');
}

const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Plain-text body without the title: what is compared to decide whether a reclose resends
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
  const uscite = listUscite(db, consegnaId);
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
  return [
    ...(turnisti?.length ? [`In turno: ${turnisti.join(' + ')}`] : []),
    '',
    `Trovato in cassa: ${num(calculateTrovatoInCassa(c, prev?.lasciato_in_cassa))} €`,
    `Pagato al produttore: ${num(c.pagato_produttore)} €`,
    ...(uscite.length ? [`Uscite di cassa: ${effetto(totaleUscite(uscite))} € (${descrizione(uscite)})`] : []),
    ...(sections.length ? ['', ...sections] : []),
    '',
    `Lasciato in cassa: ${num(c.lasciato_in_cassa)} €`,
    `${baseUrl}/consegna?data=${c.data}`
  ].join('\n');
}

// Same as formatEffettoCassa in utils.js: an uscita (stored positive) is −, an entrata (negative) +
const effetto = importo => importo === 0 ? '0' : `${importo > 0 ? '−' : '+'}${num(Math.abs(importo))}`;

// Same as descrizioneUscite in consegna-common.js: one uscita shows only its motivo
const descrizione = uscite => uscite.length === 1 ? uscite[0].motivo : uscite.map(u => `${u.motivo} ${effetto(u.importo)}`).join(', ');

function reportTitle(date, corretto) {
  const [y, m, d] = date.split('-');
  return `Report turno ${d}/${m}/${y}${corretto ? ' (corretto)' : ''}`;
}

async function sendTelegram(title, body) {
  const env = process.env;
  const text = `<b>${title}</b>\n${escapeHtml(body)}`;
  // TELEGRAM_THREAD_ID: topic of a forum group (optional; without it the General topic)
  const thread = env.TELEGRAM_THREAD_ID ? { message_thread_id: Number(env.TELEGRAM_THREAD_ID) } : {};
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, ...thread, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } })
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
}

async function sendEmail(title, body) {
  const env = process.env;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: Number(env.SMTP_PORT) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
  });
  await transport.sendMail({ from: env.REPORT_EMAIL_FROM || env.SMTP_USER, to: env.REPORT_EMAIL_TO, subject: title, text: body });
}

// Channel → env vars that enable it, sender, column holding the last body sent
const CANALI = {
  telegram: { vars: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'], send: sendTelegram, column: 'report_telegram' },
  email: { vars: ['SMTP_HOST', 'REPORT_EMAIL_TO'], send: sendEmail, column: 'report_email' }
};

const canaliAttivi = () => Object.keys(CANALI).filter(k => CANALI[k].vars.every(v => process.env[v]));

// Send the report on one channel unless the same one was already sent there; a changed resend is marked (corretto)
async function notifyClosed(db, consegnaId, baseUrl, canale, send = CANALI[canale].send) {
  const { column } = CANALI[canale];
  const c = db.prepare(`SELECT data, ${column} AS inviato FROM consegne WHERE id = ?`).get(consegnaId);
  const body = reportBody(db, consegnaId, baseUrl);
  if (body === c.inviato) return;
  await send(reportTitle(c.data, c.inviato != null), body);
  db.prepare(`UPDATE consegne SET ${column} = ? WHERE id = ?`).run(body, consegnaId);
}

module.exports = { reportBody, reportTitle, notifyClosed, canaliAttivi };
