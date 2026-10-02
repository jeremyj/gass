// Turni, desktop: next 6 months (last 3 on request); everyone picks every name from a menu and
// moves/skips days; admins manage pauses, notes and pause automatic generation

let turni = [];
let attivi = [];
let giornoId = null;
let myId = null;
let autoOn = true; // automatic generation: the queue only matters while it is on

// Menu for one slot: every attivo, plus the current person if no longer attivo
function nameSelectHtml(t, slot) {
  const p = t.turnisti[slot - 1];
  const people = p && !attivi.some(u => u.id === p.id) ? [...attivi, p] : attivi;
  const options = people.map(u => `<option value="${u.id}"${p && u.id === p.id ? ' selected' : ''}>${escapeHtml(u.nome)}</option>`).join('');
  return `<select class="name-sel${p ? '' : ' empty'}" aria-label="Turnista ${slot}, ${dataBreve(t.data)}" onchange="assignSlot(${t.id}, ${slot}, this)">
    <option value=""${p ? '' : ' selected'}>da coprire</option>${options}</select>`;
}

function nameCell(t, slot) {
  const p = t.turnisti[slot - 1];
  const tu = p && p.id === myId ? ' <span class="tag-tu">TU</span>' : '';
  if (!t.saltata && t.data >= toLocalDateString()) return `<td class="nm"><div class="nm-row">${nameSelectHtml(t, slot)}${tu}</div></td>`;
  const label = t.saltata ? '' : p ? escapeHtml(p.nome) + tu : '<span class="da-coprire">da coprire</span>';
  return `<td class="nm">${label}</td>`;
}

function noteCell(t) {
  const parts = [];
  if (t.saltata) parts.push(`<i>niente consegna${t.nota ? `: ${escapeHtml(t.nota)}` : ''}</i>`);
  else if (t.nota && !(t.riunione && /^riunione( gass)?$/i.test(t.nota.trim()))) parts.push(escapeHtml(t.nota));
  if (t.riunione) parts.push('<span class="tag-riunione">riunione GASS</span>');
  return `<td class="left">${parts.join(' ')}</td>`;
}

function renderTurni() {
  const body = document.getElementById('turni-body');
  const today = toLocalDateString();
  const curId = turni.find(t => t.data >= today)?.id;
  body.innerHTML = turni.map(t => `
    <tr class="${t.id === curId ? 'cur' : ''}${t.saltata ? ' off' : ''}${t.data < today ? ' past' : ''}">
      <td class="left d"><b>${weekdayShort(t.data)} ${formatDateItalian(t.data).slice(0, 5)}</b>${t.data !== t.settimana ? `<span class="mv">da ${weekdayShort(t.settimana)} ${formatDateItalian(t.settimana).slice(0, 5)}</span>` : ''}</td>
      ${nameCell(t, 1)}${nameCell(t, 2)}${noteCell(t)}
      <td>${t.data >= today ? `<button type="button" class="link-btn" onclick="openGiorno(${t.id})">Giorno</button>` : ''}</td>
    </tr>`).join('');

  const next = turni.find(t => t.data >= today && !t.saltata && t.turnisti.some(p => p && p.id === myId));
  // "il tuo prossimo turno" with the date in a badge
  document.getElementById('mio-turno').innerHTML = next
    ? `il tuo prossimo turno <span class="mio-data">${formatDateLong(next.data)}</span>`
    : 'nessun turno per te nei prossimi 6 mesi';
}

const nomeUtente = id => attivi.find(u => u.id === id)?.nome || '';

// Menu change: filling a free slot is immediate, replacing or clearing a name asks first
async function assignSlot(id, slot, select) {
  const t = turni.find(x => x.id === id);
  const p = t.turnisti[slot - 1];
  const value = select.value ? Number(select.value) : null;
  if (p) {
    const nuovo = value ? nomeUtente(value) : null;
    const ok = await confirmDialog({
      title: nuovo ? 'Sostituire il turnista?' : 'Lasciare il posto da coprire?',
      details: [[dataBreve(t.data), nuovo ? `${nuovo} al posto di ${p.nome}` : `da coprire (esce ${p.nome})`]],
      confirmText: nuovo ? 'Sostituisci' : 'Lascia da coprire'
    });
    if (!ok) { select.value = p.id; return; }
  }
  try {
    await API.put(`/api/turni/${id}`, { [slot === 1 ? 'turnista1Id' : 'turnista2Id']: value });
    showStatus('Turno aggiornato', 'success');
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
  await loadTurni();
}

// Notes above the table: admins edit them, everyone else reads them when there are any
function renderNote(note) {
  const box = document.getElementById('turni-note-box');
  const view = document.getElementById('turni-note-view');
  const edit = document.getElementById('turni-note-edit');
  box.classList.toggle('initially-hidden', !isAdmin() && !note);
  view.textContent = note;
  view.classList.toggle('initially-hidden', isAdmin());
  edit.classList.toggle('initially-hidden', !isAdmin());
  if (isAdmin() && document.activeElement !== edit) edit.value = note;
  document.getElementById('turni-note-save').classList.add('initially-hidden');
}

async function saveNote() {
  try {
    await API.put('/api/turni/note', { note: document.getElementById('turni-note-edit').value });
    document.getElementById('turni-note-save').classList.add('initially-hidden');
    showStatus('Note salvate', 'success');
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

async function toggleAuto(input) {
  const auto = input.checked;
  const ok = await confirmDialog({
    title: auto ? 'Riattivare la generazione automatica?' : 'Mettere in pausa la generazione automatica?',
    message: auto
      ? 'Le settimane nuove verranno riempite dalla coda: tocca a chi aspetta da più tempo. Le settimane già in calendario non cambiano.'
      : 'Le settimane nuove arriveranno vuote, da coprire: i nomi li sceglie un amministratore. Le settimane già in calendario non cambiano.',
    confirmText: auto ? 'Riattiva' : 'Metti in pausa'
  });
  if (!ok) { input.checked = !auto; return; }
  try {
    await API.put('/api/turni/auto', { auto });
    showStatus(auto ? 'Generazione automatica riattivata' : 'Generazione automatica in pausa', 'success');
  } catch (error) {
    input.checked = !auto;
    showStatus('Errore: ' + error.message, 'error');
  }
  await loadTurni();
}

function openGiorno(id) {
  const t = turni.find(x => x.id === id);
  giornoId = id;
  document.getElementById('giorno-title').textContent = `Consegna di ${formatDateLong(t.settimana)}`;
  setDateField('giorno-data', t.data);
  document.getElementById('giorno-saltata').checked = t.saltata;
  document.getElementById('giorno-riunione').checked = t.riunione;
  document.getElementById('giorno-nota').value = t.nota || '';
  document.getElementById('giorno-error').classList.add('initially-hidden');
  document.getElementById('giorno-saltata-hint').classList.toggle('initially-hidden', !autoOn);
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
      message: 'I due turnisti verranno tolti da questa data' + (autoOn ? ' e saranno i primi a fare il prossimo turno libero.' : '.'),
      confirmText: 'Niente consegna'
    });
    if (!ok) return;
  }
  try {
    await API.put(`/api/turni/${giornoId}`, {
      data: dateFieldValue('giorno-data'),
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
  const dal = dateFieldValue('pausa-dal');
  const al = dateFieldValue('pausa-al');
  if (!dal || !al) return showStatus('Scegli le date della pausa', 'error');
  const ok = await confirmDialog({
    title: 'Aggiungere la pausa?',
    message: 'Le consegne già in programma in queste date diventano "niente consegna"' + (autoOn ? ' e i loro turnisti tornano i primi in fila.' : '.'),
    details: [['Dal', formatDateItalian(dal)], ['Al', formatDateItalian(al)]],
    confirmText: 'Aggiungi pausa'
  });
  if (!ok) return;
  try {
    await API.post('/api/turni/pause', { dal, al, nota: document.getElementById('pausa-nota').value });
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
    await loadTurni();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

async function loadTurni() {
  try {
    const user = await sessionReady;
    myId = user?.id;
    const passati = document.getElementById('turni-passati')?.checked;
    const result = await API.get(`/api/turni${passati ? '?passati=1' : ''}`);
    turni = result.turni;
    autoOn = result.auto;
    attivi = (await API.get('/api/participants')).participants.filter(p => p.stato === 'attivo')
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    if (isAdmin()) {
      document.getElementById('auto-wrap').classList.remove('initially-hidden');
      document.getElementById('turni-auto').checked = result.auto;
      document.getElementById('pause-section').classList.remove('initially-hidden');
      renderPause(result.pause);
    }
    renderNote(result.note);
    renderTurni();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  ['pausa-dal', 'pausa-al', 'giorno-data'].forEach(initDateField);
  loadTurni();
});
