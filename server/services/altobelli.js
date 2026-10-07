/**
 * Altobelli check (experimental, admin): compares a consegna's tab of the producer's Google Sheet
 * ("Selvaggio Altobelli 26", shared with anyone with the link) with the conti in GASS.
 *
 * The sheet is read without credentials: the /edit page lists every tab with its gid (past tabs
 * are hidden, and htmlview lists only visible ones), then export?format=csv&gid= downloads that
 * exact tab. Never use gviz/tq?sheet=<name>: on a wrong name it silently returns another tab.
 * The effettivi (column C) are summed row by row: the sheet's own =SUM total sometimes misses
 * the last rows (29/9/2026: 319,20 written, 357,10 real).
 */

const { roundToCents } = require('./calculations');

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
  'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const TIMEOUT_MS = 10000;
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

function foglioId(url) {
  return /\/spreadsheets\/d\/([\w-]+)/.exec(String(url || ''))?.[1] || null;
}

// Tabs { nome, gid } from the bootstrap data of the /edit page: [n,"[24,0,\"<gid>\",[{\"1\":[[0,0,\"<name>\"]
function parseSchede(html) {
  const re = /\[\d+,0,\\"(\d+)\\",\[\{\\"1\\":\[\[0,0,\\"((?:[^"\\]|\\\\.)*?)\\"\]/g;
  return [...html.matchAll(re)].map(([, gid, nome]) => ({
    nome: nome.replace(/\\\\u([0-9a-f]{4})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))),
    gid
  }));
}

// Tabs of a yyyy-mm-dd consegna: "6 ottobre", "Mercoledì 8 aprile", "30  giugno", "23a  giugno"
function trovaSchede(schede, date) {
  const [, m, d] = date.split('-').map(Number);
  const re = new RegExp(`(^|\\s)${d}a?\\s${MESI[m - 1]}(\\s|$)`);
  return schede.filter(s => re.test(norm(s.nome)));
}

// RFC 4180: quoted cells may hold commas, doubled quotes and newlines
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// "€ 37,61", "17,2", "€ 1.234,50" → number; empty or text → null
function parseImporto(text) {
  const t = String(text || '').replace(/€/g, '').replace(/\s/g, '');
  if (!/^-?[\d.]+(,\d+)?$/.test(t)) return null;
  return roundToCents(Number(t.replace(/\./g, '').replace(',', '.')));
}

// People rows (name in A, approssimativo B, effettivo C) under the "effettivi" header, until the
// first row without a name; the total written by the sheet is the last nameless row with a C amount
function parseFoglio(csv) {
  const rows = parseCsv(csv);
  const header = rows.findIndex(r => norm(r[2]) === 'effettivi');
  if (header < 0) throw new Error('Nel foglio non c\'è la colonna "effettivi"');
  const righe = [];
  let i = header + 1;
  for (; i < rows.length && String(rows[i][0] || '').trim(); i++) {
    righe.push({ nome: rows[i][0], approssimativo: parseImporto(rows[i][1]), effettivo: parseImporto(rows[i][2]) });
  }
  const totali = rows.slice(i).filter(r => !String(r[0] || '').trim() && parseImporto(r[2]) !== null);
  return { righe, totaleScritto: totali.length ? parseImporto(totali[totali.length - 1][2]) : null };
}

// Guess the person of an unknown sheet name: same display name, or same first word
function suggerisci(nome, persone) {
  const n = norm(nome);
  const first = s => norm(s).split(' ')[0];
  return (persone.find(p => norm(p.nome) === n) || persone.find(p => first(p.nome) === first(n)))?.id || null;
}

// nomi: sheet name (normalised) → user id. Movimenti with conto 0 are not Altobelli orders.
function confronta(foglio, movimenti, nomi, persone) {
  const nomeDi = id => persone.find(p => p.id === id)?.nome || null;
  const visti = new Set();
  const righe = foglio.righe.map(r => {
    const userId = nomi[norm(r.nome)] ?? null;
    const base = { nome: r.nome, userId, persona: nomeDi(userId), effettivo: r.effettivo, approssimativo: r.approssimativo };
    if (userId === null) return { ...base, conto: null, esito: 'da_associare', suggerito: suggerisci(r.nome, persone) };
    visti.add(userId);
    const m = movimenti.find(x => x.partecipante_id === userId);
    const conto = m ? m.conto_produttore : null;
    if (r.effettivo === null) return { ...base, conto, esito: 'non_segnato' };
    if (!m) return { ...base, conto, esito: 'manca_app' };
    return { ...base, conto, esito: Math.abs(r.effettivo - conto) < 0.005 ? 'uguale' : 'diverso' };
  });
  movimenti.filter(m => m.conto_produttore > 0 && !visti.has(m.partecipante_id)).forEach(m => {
    righe.push({ nome: null, userId: m.partecipante_id, persona: nomeDi(m.partecipante_id), effettivo: null,
      approssimativo: null, conto: m.conto_produttore, esito: 'manca_foglio' });
  });
  const sommaEffettivi = roundToCents(foglio.righe.reduce((s, r) => s + (r.effettivo || 0), 0));
  return {
    righe,
    kpi: {
      sommaEffettivi,
      nonSegnati: foglio.righe.filter(r => r.effettivo === null).length,
      totaleScritto: foglio.totaleScritto,
      // the CSV gives the total as displayed (one decimal), hence the tolerance
      totaleDiverso: foglio.totaleScritto !== null && Math.abs(foglio.totaleScritto - sommaEffettivi) > 0.05,
      sommaConti: roundToCents(movimenti.reduce((s, m) => s + (m.conto_produttore || 0), 0))
    }
  };
}

async function scarica(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
  } catch (error) {
    throw new Error(`Foglio Altobelli non raggiungibile (${error.message})`);
  }
  if (!res.ok) throw new Error(`Foglio Altobelli: risposta ${res.status}`);
  return res.text();
}

// The tab of a consegna: { scheda, foglio } or { scelte } when several tabs match and no gid was picked
async function leggiFoglio(url, date, gid = null) {
  const id = foglioId(url);
  if (!id) throw new Error('Link del foglio Altobelli non valido');
  const schede = parseSchede(await scarica(`https://docs.google.com/spreadsheets/d/${id}/edit`));
  if (!schede.length) throw new Error('Non riesco a leggere l\'elenco delle schede del foglio (è ancora condiviso con chiunque abbia il link?)');
  const candidate = trovaSchede(schede, date);
  const scheda = gid ? candidate.find(s => s.gid === String(gid)) : candidate.length === 1 ? candidate[0] : null;
  if (!candidate.length) {
    const [, m, d] = date.split('-').map(Number);
    throw new Error(`Nel foglio non c'è una scheda per il ${d} ${MESI[m - 1]}`);
  }
  if (!scheda) return { scelte: candidate };
  const csv = await scarica(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${scheda.gid}`);
  return { scheda, foglio: parseFoglio(csv) };
}

module.exports = { foglioId, parseSchede, trovaSchede, parseCsv, parseImporto, parseFoglio, confronta, leggiFoglio };
