// Turni, desktop: next 6 months (last 3 on request); everyone picks every name from a menu and
// moves/skips days; admins manage pauses, notes and pause automatic generation

let turni = [];
let attivi = [];
let myId = null;
let autoOn = true; // automatic generation: the queue only matters while it is on

function nameCell(t, slot) {
  const p = t.turnisti[slot - 1];
  const tu = p && p.id === myId ? ' <span class="tag-tu">TU</span>' : '';
  if (nomiModificabili(t)) return `<td class="nm"><div class="nm-row">${nameSelectHtml(t, slot, attivi)}${tu}</div></td>`;
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
      <td>${giornoModificabile(t) ? `<button type="button" class="btn btn-line btn-giorno" onclick="apriGiorno(${t.id})">Modifica giorno</button>` : ''}</td>
    </tr>`).join('');

  const next = turni.find(t => t.data >= today && !t.saltata && t.turnisti.some(p => p && p.id === myId));
  // "il tuo prossimo turno" with the date in a badge
  document.getElementById('mio-turno').innerHTML = next
    ? `il tuo prossimo turno <span class="mio-data">${formatDateLong(next.data)}</span>`
    : 'nessun turno per te nei prossimi 6 mesi';
}

async function assignSlot(id, slot, select) {
  if (await assegnaTurnista(turni.find(x => x.id === id), slot, select, attivi)) await loadTurni();
}

// Notes above the table: admins edit them, everyone else reads them when there are any
let noteRipresa = false; // the draft toast shows once, not at every reload of the list
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
  if (isAdmin()) {
    bozzaRiprendi('turni-note', box, { avviso: !noteRipresa });
    noteRipresa = true;
  }
}

async function saveNote() {
  try {
    await API.put('/api/turni/note', { note: document.getElementById('turni-note-edit').value });
    document.getElementById('turni-note-save').classList.add('initially-hidden');
    bozzaCancella('turni-note');
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

const apriGiorno = id => openGiorno(turni.find(x => x.id === id), { autoOn, onSaved: loadTurni });

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
    message: 'Le consegne in queste date, anche passate, diventano "niente consegna"' + (autoOn ? ' e i loro turnisti tornano i primi in fila.' : '.'),
    details: [['Dal', formatDateItalian(dal)], ['Al', formatDateItalian(al)]],
    confirmText: 'Aggiungi pausa'
  });
  if (!ok) return;
  try {
    await API.post('/api/turni/pause', { dal, al, nota: document.getElementById('pausa-nota').value });
    document.getElementById('pausa-nota').value = '';
    showStatus('Pausa aggiunta', 'success');
    // A pause in the past shows only with the past turni
    if (al < toLocalDateString()) document.getElementById('turni-passati').checked = true;
    await loadTurni();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

async function deletePause(id) {
  const ok = await confirmDialog({
    title: 'Eliminare la pausa?',
    message: 'Le consegne già segnate "niente consegna" restano così; si ripristinano da "Modifica giorno".',
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
  ['pausa-dal', 'pausa-al'].forEach(initDateField);
  initGiorno();
  loadTurni();
});
