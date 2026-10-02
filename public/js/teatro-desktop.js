// Teatro, desktop (admins): quota teatro per person and semester, the bussolotto, the cassa log

let dati = null;
let editing = null; // { userId, semestre } of the cell whose dovuto is being changed

const cellOf = (p, semestre) => p.righe.find(r => r.semestre === semestre);

// ✓ when the semester is covered, red – when something is missing, grey when not owed; amounts in the tooltip
function cellHtml(p, s) {
  const r = cellOf(p, s.semestre);
  const click = `onclick="openDovuto(${p.id}, '${s.semestre}')"`;
  if (!r) return `<td class="c"><button type="button" class="g x" ${click} title="Non era nel GASS">–</button></td>`;
  if (r.dovuto === 0) return `<td class="c"><button type="button" class="g x" ${click} title="Non dovuto">–</button></td>`;
  const paid = r.pagato >= r.dovuto;
  return `<td class="c"><button type="button" class="g ${paid ? 'p' : 'n'}" ${click} title="${formatNumber(r.pagato)}/${formatEuro(r.dovuto)}">${paid ? '✓' : '✗'}</button></td>`;
}

// Same order as Saldi: attivi and "no turni" (sospeso), then disattivati, each alphabetical
const STATO_ORDER = { attivo: 0, sospeso: 0, disattivato: 1 };

// Only the last 2 semesters unless "Mostra semestri precedenti" is ticked
const RECENT_SEMESTRI = 2;

function renderGrid() {
  const showOld = document.getElementById('show-old').checked;
  document.getElementById('show-old-wrap').classList.toggle('initially-hidden', dati.semestri.length <= RECENT_SEMESTRI);
  const semestri = showOld ? dati.semestri : dati.semestri.slice(-RECENT_SEMESTRI);
  const persone = [...dati.persone].sort((a, b) => STATO_ORDER[a.stato] - STATO_ORDER[b.stato] || a.nome.localeCompare(b.nome, 'it'));
  document.getElementById('teatro-head').innerHTML = `<tr><th class="left">Gassista</th>${semestri.map(s =>
    `<th class="c"><button type="button" class="link-btn" onclick="editQuota('${s.semestre}')" title="Cambia la quota">${escapeHtml(s.label)}<br><small>${formatEuro(s.quota)}</small></button></th>`).join('')}<th class="left">Note</th></tr>`;
  document.getElementById('teatro-body').innerHTML = persone.map(p => `
    <tr class="${p.stato === 'disattivato' ? 'off' : ''}">
      <td class="nm">${escapeHtml(p.nome)}${statoBadge(p.stato)}</td>
      ${semestri.map(s => cellHtml(p, s)).join('')}
      <td><input type="text" class="nota-in" value="${escapeHtml(p.nota || '')}" placeholder="nota" onchange="saveNota(${p.id}, this.value)"></td>
    </tr>`).join('');
  const tot = s => persone.reduce((acc, p) => acc + (cellOf(p, s.semestre)?.pagato || 0), 0);

  const current = semestri[semestri.length - 1];
  document.getElementById('kpi-saldo').textContent = formatEuro(dati.saldo);
  document.getElementById('kpi-sem-label').textContent = `Quote ${current ? current.label : 'del semestre'}`;
  document.getElementById('kpi-sem').textContent = current ? formatEuro(roundToCents(tot(current))) : '–';
  document.getElementById('kpi-mancanti').textContent = formatEuro(roundToCents(persone.reduce((acc, p) => acc + Math.max(p.residuo, 0), 0)));
}

// The cassa log: manual entries plus the quotas paid in GASS, grouped by day
function renderCassa() {
  const byDay = {};
  dati.pagamenti.filter(p => !p.fonte).forEach(p => { (byDay[p.data] = byDay[p.data] || []).push(p); });
  const quote = Object.entries(byDay).map(([data, list]) => ({
    data, importo: roundToCents(list.reduce((acc, p) => acc + p.importo, 0)), quote: list
  }));
  const voci = [...dati.cassa.map(c => ({ ...c, manual: true })), ...quote].sort((a, b) => b.data.localeCompare(a.data));
  document.getElementById('cassa-list').innerHTML = voci.length === 0
    ? '<li class="hint">Nessun movimento</li>'
    : voci.map(v => `<li><span>${formatDateItalian(v.data)} · ${v.manual ? escapeHtml(v.descrizione)
        : 'quote: ' + v.quote.map(p => `${escapeHtml(p.nome)} ${formatEuro(p.importo)} <button type="button" class="link-btn danger" onclick="deletePagamento(${p.id})" title="Elimina questo pagamento">×</button>`).join(', ')}</span>
        <b class="${v.importo < 0 ? 'db' : 'cr'}">${formatSigned(v.importo)}</b></li>`).join('');
}

function openDovuto(userId, semestre) {
  const p = dati.persone.find(x => x.id === userId);
  const s = dati.semestri.find(x => x.semestre === semestre);
  const r = cellOf(p, semestre);
  editing = { userId, semestre };
  document.getElementById('dovuto-title').textContent = `${p.nome}, ${s.label}`;
  document.getElementById('dovuto-importo').value = formatNumber(r ? r.dovuto : s.quota);
  document.getElementById('dovuto-hint').textContent = `Quota del semestre: ${formatEuro(s.quota)}. Per chi entra a metà semestre metti la quota ridotta.`;
  document.getElementById('dovuto-modal').classList.remove('initially-hidden');
}

function closeDovuto() {
  const modal = document.getElementById('dovuto-modal');
  modal.classList.add('initially-hidden');
  modal.classList.remove('quota-mode');
  editing = null;
  quotaSem = null;
}

// dovuto: undefined = read the field, 0 = non dovuto, null = not in the GASS that semester
async function saveDovuto(dovuto) {
  const value = dovuto === undefined ? parseAmount(document.getElementById('dovuto-importo').value) : dovuto;
  if (value !== null && !(value >= 0)) return showStatus('Importo non valido', 'error');
  try {
    await API.put('/api/teatro/dovuti', { ...editing, dovuto: value });
    closeDovuto();
    showStatus('Quota aggiornata', 'success');
    await loadTeatro();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

// The same modal edits a semester's quota (quotaSem set) or one person's dovuto (editing set)
let quotaSem = null;

function editQuota(semestre) {
  const s = dati.semestri.find(x => x.semestre === semestre);
  editing = null;
  quotaSem = semestre;
  document.getElementById('dovuto-title').textContent = `Quota ${s.label}`;
  document.getElementById('dovuto-importo').value = formatNumber(s.quota);
  document.getElementById('dovuto-hint').textContent = 'Vale per tutti quelli che hanno la quota piena; le quote ridotte e i non dovuti restano.';
  const modal = document.getElementById('dovuto-modal');
  modal.classList.add('quota-mode');
  modal.classList.remove('initially-hidden');
}

async function submitModal() {
  if (!quotaSem) return saveDovuto();
  const quota = parseAmount(document.getElementById('dovuto-importo').value);
  if (!(quota >= 0)) return showStatus('Quota non valida', 'error');
  try {
    await API.put(`/api/teatro/semestri/${quotaSem}`, { quota });
    closeDovuto();
    showStatus('Quota del semestre aggiornata', 'success');
    await loadTeatro();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

async function saveNota(userId, nota) {
  try {
    await API.put('/api/teatro/nota', { userId, nota });
    showStatus('Nota salvata', 'success');
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

async function deletePagamento(id) {
  const p = dati.pagamenti.find(x => x.id === id);
  const ok = await confirmDialog({
    title: 'Eliminare il pagamento?',
    details: [[p.nome, `${formatEuro(p.importo)} del ${formatDateItalian(p.data)}`]],
    confirmText: 'Elimina', danger: true
  });
  if (!ok) return;
  try {
    await API.delete(`/api/teatro/pagamenti/${id}`);
    showStatus('Pagamento eliminato', 'success');
    await loadTeatro();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

async function addCassa() {
  const data = dateFieldValue('cassa-data');
  const importo = parseAmount(document.getElementById('cassa-importo').value) * Number(document.getElementById('cassa-tipo').value);
  const descrizione = document.getElementById('cassa-descr').value.trim();
  if (!data || !importo || !descrizione) return showStatus('Servono data, importo e descrizione', 'error');
  const ok = await confirmDialog({
    title: 'Aggiungere la voce?',
    details: [[formatDateItalian(data), descrizione], ['Importo', formatSigned(importo)]],
    confirmText: 'Aggiungi'
  });
  if (!ok) return;
  try {
    await API.post('/api/teatro/cassa', { data, importo, descrizione });
    document.getElementById('cassa-importo').value = '';
    document.getElementById('cassa-descr').value = '';
    showStatus('Voce aggiunta', 'success');
    await loadTeatro();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

async function loadTeatro() {
  try {
    dati = await API.get('/api/teatro');
    renderGrid();
    renderCassa();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initDateField('cassa-data');
  setDateField('cassa-data', toLocalDateString());
  loadTeatro();
});
