// Foglio Altobelli (experimental, admin): the consegna's tab of the producer's sheet vs the conti in GASS

const ESITI = {
  uguale: { cls: 'ok', testo: '✓ uguale' },
  diverso: { cls: 'ko', testo: 'diverso' },
  manca_app: { cls: 'ko', testo: 'manca in GASS' },
  manca_foglio: { cls: 'ko', testo: 'manca nel foglio' },
  non_segnato: { cls: 'wa', testo: 'effettivo non segnato nel foglio' },
  da_associare: { cls: 'wa', testo: 'nome da associare' }
};

let confronto = null;
let schedaData = null; // gid of the only tab matching the date, if any

function amount(x) {
  return x === null || x === undefined ? '–' : formatNumber(x);
}

function mostraAvviso(testo) {
  const el = document.getElementById('alt-errore');
  el.textContent = testo;
  el.classList.remove('initially-hidden');
}

// gid: the tab picked in the select; without it the server uses the one remembered for the date
async function caricaConfronto(gid = '') {
  const data = dateFieldValue('alt-data');
  if (!data) return;
  document.getElementById('alt-errore').classList.add('initially-hidden');
  showStatus('Leggo il foglio…', 'success');
  try {
    const r = await API.get(`/api/altobelli/confronto?data=${data}${gid ? `&gid=${gid}` : ''}`);
    document.getElementById('status').className = 'status';
    document.getElementById('alt-scheda').innerHTML =
      (r.scheda ? '' : '<option value="">scegli la scheda…</option>') +
      r.schede.map(s => `<option value="${s.gid}" ${r.scheda && r.scheda.gid === s.gid ? 'selected' : ''}>${escapeHtml(s.nome)}</option>`).join('');
    schedaData = r.schedaData;
    if (!r.scheda) {
      confronto = null;
      document.getElementById('alt-risultato').classList.add('initially-hidden');
      return mostraAvviso(r.messaggio);
    }
    confronto = r;
    renderConfronto();
  } catch (error) {
    document.getElementById('status').className = 'status';
    confronto = null;
    document.getElementById('alt-risultato').classList.add('initially-hidden');
    mostraAvviso(error.message);
  }
}

// Remember the pick for the consegna, except the single tab of the date (the default stays by date)
async function cambiaScheda() {
  const data = dateFieldValue('alt-data');
  const gid = document.getElementById('alt-scheda').value;
  if (!data || !gid) return;
  try {
    await API.put('/api/altobelli/scheda', { data, gid: schedaData === gid ? null : gid });
  } catch (error) {
    showStatus('Scheda non salvata: ' + error.message, 'error');
  }
  caricaConfronto(gid);
}

function onDataChange() {
  caricaConfronto();
}

function personaCell(r) {
  if (r.esito !== 'da_associare') return escapeHtml(r.persona || '');
  const options = confronto.persone.map(p =>
    `<option value="${p.id}" ${p.id === r.suggerito ? 'selected' : ''}>${escapeHtml(p.nome)}</option>`).join('');
  return `<select class="alt-assoc" data-nome="${escapeHtml(r.nome)}"><option value="">a chi corrisponde?</option>${options}</select>
    <button type="button" class="link-btn" onclick="associa(this)">Associa</button>`;
}

function renderConfronto() {
  if (!confronto) return;
  const { righe, kpi, scheda } = confronto;
  const solo = document.getElementById('alt-solo').checked;
  document.getElementById('alt-righe').innerHTML = righe.filter(r => !solo || r.esito !== 'uguale').map(r => {
    const e = ESITI[r.esito];
    const effettivo = r.effettivo === null && r.nome !== null
      ? `<span class="mute">vuoto${r.approssimativo !== null ? `<br><small>approssimativo ${formatNumber(r.approssimativo)}</small>` : ''}</span>`
      : amount(r.effettivo);
    const diff = r.esito === 'diverso' ? ` ${formatNumber(Math.abs(roundToCents(r.effettivo - r.conto)))}` : '';
    return `<tr class="alt-${e.cls}">
      <td>${r.nome === null ? '–' : escapeHtml(r.nome)}</td>
      <td>${personaCell(r)}</td>
      <td>${effettivo}</td>
      <td>${amount(r.conto)}</td>
      <td class="alt-esito ${e.cls}">${e.testo}${diff}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="mute">Nessuna differenza.</td></tr>';

  document.getElementById('kpi-effettivi').textContent = formatEuro(kpi.sommaEffettivi);
  document.getElementById('kpi-nonsegnati').textContent = kpi.nonSegnati
    ? `${kpi.nonSegnati} effettivi non segnati, esclusi` : `scheda "${scheda.nome}"`;
  document.getElementById('kpi-scritto').textContent = kpi.totaleScritto === null ? '–' : formatEuro(kpi.totaleScritto);
  document.getElementById('kpi-scritto-box').classList.toggle('ko', kpi.totaleDiverso);
  document.getElementById('kpi-scritto-nota').textContent = kpi.totaleDiverso ? 'diverso dalla somma delle righe: il SUM del foglio non le prende tutte?' : '';
  document.getElementById('kpi-conti').textContent = formatEuro(kpi.sommaConti);
  const scarto = roundToCents(kpi.sommaConti - kpi.sommaEffettivi);
  document.getElementById('kpi-conti-nota').textContent = scarto ? `${formatSigned(scarto)} rispetto agli effettivi` : 'uguale agli effettivi';
  document.getElementById('alt-risultato').classList.remove('initially-hidden');
}

async function associa(button) {
  const select = button.previousElementSibling;
  if (!select.value) return showStatus('Scegli la persona', 'error');
  try {
    await API.put('/api/altobelli/nomi', { nome: select.dataset.nome, userId: Number(select.value) });
    showStatus('Nome associato', 'success');
    caricaConfronto();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

async function salvaFoglio() {
  try {
    await API.put('/api/altobelli/foglio', { url: document.getElementById('alt-url').value });
    bozzaCancella('altobelli-link');
    showStatus('Link salvato', 'success');
    caricaConfronto();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await sessionReady;
  if (!isAdmin()) {
    window.location.href = '/consegna';
    return;
  }
  initDateField('alt-data');
  document.getElementById('alt-data').addEventListener('change', onDataChange);
  try {
    const [{ data }, { url }] = await Promise.all([API.get('/api/consegna/apertura'), API.get('/api/altobelli/foglio')]);
    document.getElementById('alt-url').value = url;
    if (!url || bozzaLeggi('altobelli-link')) document.querySelector('.alt-foglio').open = true;
    bozzaRiprendi('altobelli-link', document.getElementById('alt-form'));
    setDateField('alt-data', data);
    caricaConfronto();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
});
