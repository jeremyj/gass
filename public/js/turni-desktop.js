// Turni, desktop: next 12 weeks; admins swap, replace, move/skip days, manage pauses

let turni = [];
let attivi = [];
let picked = null; // { id, slot } of the name clicked first
let giornoId = null;
let myId = null;

function nameCell(t, slot) {
  const p = t.turnisti[slot - 1];
  const label = t.saltata ? '' : p ? escapeHtml(p.nome) + (p.id === myId ? ' <span class="tag-tu">TU</span>' : '') : '<span class="da-coprire">da coprire</span>';
  if (!isAdmin() || t.saltata) return `<td class="nm">${label}</td>`;
  const on = picked && picked.id === t.id && picked.slot === slot ? ' picked' : '';
  return `<td class="nm"><button type="button" class="name-btn${on}" onclick="pickName(${t.id}, ${slot})">${label}</button></td>`;
}

function noteCell(t) {
  const parts = [];
  if (t.saltata) parts.push(`<i>niente consegna${t.nota ? `: ${escapeHtml(t.nota)}` : ''}</i>`);
  else if (t.nota) parts.push(escapeHtml(t.nota));
  if (t.riunione) parts.push('<span class="tag-riunione">riunione GASS</span>');
  return `<td class="left">${parts.join(' ')}</td>`;
}

function renderTurni() {
  const body = document.getElementById('turni-body');
  body.innerHTML = turni.map((t, i) => `
    <tr class="${i === 0 ? 'cur' : ''}${t.saltata ? ' off' : ''}">
      <td class="left d"><b>${weekdayShort(t.data)} ${formatDateItalian(t.data).slice(0, 5)}</b>${t.data !== t.settimana ? `<span class="mv">da ${weekdayShort(t.settimana)} ${formatDateItalian(t.settimana).slice(0, 5)}</span>` : ''}</td>
      ${nameCell(t, 1)}${nameCell(t, 2)}${noteCell(t)}
      <td class="admin-col">${isAdmin() ? `<button type="button" class="link-btn" onclick="openGiorno(${t.id})">Giorno</button>` : ''}</td>
    </tr>`).join('');

  const next = turni.find(t => !t.saltata && t.turnisti.some(p => p && p.id === myId));
  document.getElementById('mio-turno').textContent = next
    ? `il tuo: ${formatDateLong(next.data)}`
    : 'nessun turno per te nelle prossime 12 settimane';
  renderBanner();
}

function renderBanner() {
  const banner = document.getElementById('pick-banner');
  const t = picked && turni.find(x => x.id === picked.id);
  if (!t || t.saltata) picked = null;
  if (!picked) { banner.classList.add('initially-hidden'); return; }
  const p = t.turnisti[picked.slot - 1];
  const options = attivi.filter(u => !p || u.id !== p.id).map(u => `<option value="${u.id}">${escapeHtml(u.nome)}</option>`).join('');
  banner.innerHTML = `
    <span><b>${p ? escapeHtml(p.nome) : 'Turno da coprire'}</b>, ${formatDateLong(t.data)}</span>
    ${p ? `<select id="swap-select" title="La persona scelta prende questo turno, ${escapeHtml(p.nome)} il suo primo turno da oggi"><option value="">scambia con…</option>${options}</select>` : ''}
    <select id="replace-select"><option value="">${p ? 'sostituisci con…' : 'assegna a…'}</option>${options}${p ? '<option value="none">— lascia da coprire</option>' : ''}</select>
    <button type="button" class="btn btn-line" onclick="cancelPick()">Annulla</button>`;
  if (p) document.getElementById('swap-select').onchange = e => e.target.value && swapWith(Number(e.target.value));
  document.getElementById('replace-select').onchange = e => replaceName(e.target.value);
  banner.classList.remove('initially-hidden');
}

function pickName(id, slot) {
  if (picked && picked.id === id && picked.slot === slot) return cancelPick();
  picked = { id, slot };
  renderTurni();
}

function cancelPick() {
  picked = null;
  renderTurni();
}

async function swapWith(userId) {
  try {
    await API.post('/api/turni/scambio', { a: picked, userId });
    picked = null;
    showStatus('Turni scambiati', 'success');
    await loadTurni();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

async function replaceName(value) {
  if (!value) return;
  const field = picked.slot === 1 ? 'turnista1Id' : 'turnista2Id';
  try {
    await API.put(`/api/turni/${picked.id}`, { [field]: value === 'none' ? null : Number(value) });
    picked = null;
    showStatus('Turno aggiornato', 'success');
    await loadTurni();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

function openGiorno(id) {
  const t = turni.find(x => x.id === id);
  giornoId = id;
  document.getElementById('giorno-title').textContent = `Consegna di ${formatDateLong(t.settimana)}`;
  document.getElementById('giorno-data').value = t.data;
  document.getElementById('giorno-saltata').checked = t.saltata;
  document.getElementById('giorno-riunione').checked = t.riunione;
  document.getElementById('giorno-nota').value = t.nota || '';
  document.getElementById('giorno-error').classList.add('initially-hidden');
  document.getElementById('giorno-modal').classList.remove('initially-hidden');
}

function closeGiorno() {
  document.getElementById('giorno-modal').classList.add('initially-hidden');
  giornoId = null;
}

async function saveGiorno() {
  const saltata = document.getElementById('giorno-saltata').checked;
  const t = turni.find(x => x.id === giornoId);
  if (saltata && !t.saltata && t.turnisti.some(Boolean)) {
    const ok = await confirmDialog({
      title: 'Niente consegna?',
      message: 'I due turnisti verranno tolti da questa data e saranno i primi a fare il prossimo turno libero.',
      confirmText: 'Niente consegna'
    });
    if (!ok) return;
  }
  try {
    await API.put(`/api/turni/${giornoId}`, {
      data: document.getElementById('giorno-data').value,
      saltata,
      riunione: document.getElementById('giorno-riunione').checked,
      nota: document.getElementById('giorno-nota').value
    });
    closeGiorno();
    showStatus('Consegna aggiornata', 'success');
    await loadTurni();
  } catch (error) {
    const err = document.getElementById('giorno-error');
    err.textContent = error.message;
    err.classList.remove('initially-hidden');
  }
}

function renderPause(pause) {
  document.getElementById('pause-list').innerHTML = pause.length === 0
    ? '<li class="hint">Nessuna pausa in programma</li>'
    : pause.map(p => `<li><span><b>${escapeHtml(p.nota || 'pausa')}</b> ${formatDateItalian(p.dal)} – ${formatDateItalian(p.al)}</span>
        <button type="button" class="link-btn danger" onclick="deletePause(${p.id})">elimina</button></li>`).join('');
}

async function addPause() {
  const dal = document.getElementById('pausa-dal').value;
  const al = document.getElementById('pausa-al').value;
  const ok = await confirmDialog({
    title: 'Aggiungere la pausa?',
    message: 'Le consegne già in programma in queste date diventano "niente consegna" e i loro turnisti tornano i primi in fila.',
    details: [['Dal', formatDateItalian(dal)], ['Al', formatDateItalian(al)]],
    confirmText: 'Aggiungi pausa'
  });
  if (!ok) return;
  try {
    await API.post('/api/turni/pause', { dal, al, nota: document.getElementById('pausa-nota').value });
    picked = null;
    document.getElementById('pausa-nota').value = '';
    showStatus('Pausa aggiunta', 'success');
    await loadTurni();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

async function deletePause(id) {
  const ok = await confirmDialog({
    title: 'Eliminare la pausa?',
    message: 'Le consegne già segnate "niente consegna" restano così; si ripristinano da "Giorno".',
    confirmText: 'Elimina', danger: true
  });
  if (!ok) return;
  try {
    await API.delete(`/api/turni/pause/${id}`);
    picked = null;
    await loadTurni();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

async function loadTurni() {
  try {
    const user = await sessionReady;
    myId = user?.id;
    const result = await API.get('/api/turni');
    turni = result.turni;
    if (isAdmin()) {
      attivi = (await API.get('/api/participants')).participants.filter(p => p.stato === 'attivo');
      document.getElementById('turni-hint').classList.remove('initially-hidden');
      document.getElementById('pause-section').classList.remove('initially-hidden');
      renderPause(result.pause);
    }
    document.body.classList.toggle('turni-readonly', !isAdmin());
    renderTurni();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', loadTurni);
