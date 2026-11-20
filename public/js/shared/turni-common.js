// ===== TURNI: SWAP (mobile) =====
// "scambia con…": the chosen person takes the picked slot, the picked person
// takes the chosen one's first non-skipped turno from today (same rule as the server).

// consegne are on Tuesday: the weekday shows only for a turno moved to another day
// ("mar" was read as March)
const giornoTurno = d => new Date(d + 'T00:00:00').getDay() === 2 ? '' : weekdayShort(d);
// "19 gen", "mer 21 gen"
const meseBreve = d => new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');
const dataBreve = d => `${giornoTurno(d)} ${Number(d.slice(8))} ${meseBreve(d)}`.trim();

function primoTurnoDi(turni, userId, escludiId) {
  return turni.find(x => x.id !== escludiId && !x.saltata && x.data >= toLocalDateString()
    && x.turnisti.some(q => q && q.id === userId));
}

// People who can take the picked turno: they have a turno to give back and are not already on this one
function candidatiScambio(turni, t) {
  const qui = t.turnisti.filter(Boolean).map(p => p.id);
  const visti = new Map();
  turni.forEach(x => {
    if (x.saltata || x.data < toLocalDateString()) return;
    x.turnisti.forEach(p => { if (p && !qui.includes(p.id)) visti.set(p.id, p.nome); });
  });
  return [...visti].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

function scambioSelectHtml(turni, t, selectId) {
  const options = candidatiScambio(turni, t).map(u => {
    const suo = primoTurnoDi(turni, u.id, t.id);
    return `<option value="${u.id}">${escapeHtml(u.nome)}${suo ? ` · ${dataBreve(suo.data)}` : ''}</option>`;
  }).join('');
  return `<select id="${selectId}"><option value="">scambia con…</option>${options}</select>`;
}

// Confirms in a modal, then swaps. Resolves true when the swap was saved.
async function scambiaTurno(turni, t, slot, userId) {
  const p = t.turnisti[slot - 1];
  const altro = candidatiScambio(turni, t).find(u => u.id === userId)?.nome || '';
  const suo = primoTurnoDi(turni, userId, t.id);
  const ok = await confirmDialog({
    title: 'Scambiare i turni?',
    details: [
      [dataBreve(t.data), `${altro} al posto di ${p.nome}`],
      [suo ? dataBreve(suo.data) : 'primo turno di ' + altro, `${p.nome} al posto di ${altro}`]
    ],
    confirmText: 'Scambia'
  });
  if (!ok) return false;
  try {
    await API.post('/api/turni/scambio', { a: { id: t.id, slot }, userId });
    showStatus('Turni scambiati', 'success');
    return true;
  } catch (error) {
    showStatus('Turni non scambiati: ' + error.message, 'error');
    return false;
  }
}

// ===== TURNI: MOVE TO A FREE SLOT, LEAVE (mobile, own turno) =====

// Future consegne with a free slot that the person is not already on
function candidatiSposta(turni, t, personId) {
  return turni.filter(x => x.id !== t.id && !x.saltata && x.data >= toLocalDateString()
    && x.turnisti.some(p => !p) && !x.turnisti.some(p => p && p.id === personId));
}

// The three own-turno actions: swap, move, leave
function azioniTurnoHtml(turni, t, slot) {
  const p = t.turnisti[slot - 1];
  const dates = candidatiSposta(turni, t, p.id).map(x => `<option value="${x.id}">${dataBreve(x.data)}</option>`).join('');
  return `${scambioSelectHtml(turni, t, 'swap-select')}
    <select id="move-select"${dates ? '' : ' disabled'}><option value="">${dates ? 'sposta al…' : 'nessuna data libera'}</option>${dates}</select>
    <button type="button" class="btn btn-line" id="leave-btn">Salta turno</button>`;
}

// Wires the controls from azioniTurnoHtml; done() runs after a saved change, cancel() after a declined one
function collegaAzioniTurno(turni, t, slot, done, cancel) {
  const run = async action => (await action) ? done() : cancel();
  document.getElementById('swap-select').onchange = e => e.target.value && run(scambiaTurno(turni, t, slot, Number(e.target.value)));
  document.getElementById('move-select').onchange = e => e.target.value && run(spostaTurno(turni, t, slot, Number(e.target.value)));
  document.getElementById('leave-btn').onclick = () => run(lasciaTurno(t, slot));
}

async function spostaTurno(turni, t, slot, toId) {
  const p = t.turnisti[slot - 1];
  const to = turni.find(x => x.id === toId);
  const ok = await confirmDialog({
    title: 'Spostare il turno?',
    details: [[dataBreve(t.data), `${p.nome} esce: posto da coprire`], [dataBreve(to.data), `${p.nome} prende il posto libero`]],
    confirmText: 'Sposta'
  });
  if (!ok) return false;
  try {
    await API.post('/api/turni/sposta', { a: { id: t.id, slot }, to: toId });
    showStatus('Turno spostato', 'success');
    return true;
  } catch (error) {
    showStatus('Turno non spostato: ' + error.message, 'error');
    return false;
  }
}

async function lasciaTurno(t, slot) {
  const p = t.turnisti[slot - 1];
  const ok = await confirmDialog({
    title: 'Non puoi fare il turno?',
    message: 'Il posto resta da coprire: lo riempirà chi gestisce i turni o chi si offre.',
    details: [[dataBreve(t.data), `${p.nome} esce`]],
    confirmText: 'Salta turno'
  });
  if (!ok) return false;
  try {
    await API.post('/api/turni/lascia', { a: { id: t.id, slot } });
    showStatus('Turno saltato', 'success');
    return true;
  } catch (error) {
    showStatus('Turno non saltato: ' + error.message, 'error');
    return false;
  }
}

// ===== TURNI: NAMES AND DAY (mobile + desktop) =====
// Everyone picks the names of future consegne from a menu and changes their day;
// on past consegne only an admin changes the day (the server refuses the rest).

const turnoFuturo = t => t.data >= toLocalDateString();
const nomiModificabili = t => !t.saltata && turnoFuturo(t);
const giornoModificabile = t => turnoFuturo(t) || isAdmin();

// Menu for one slot: every attivo, plus the current person if no longer attivo.
// The page defines assignSlot(id, slot, select).
function nameSelectHtml(t, slot, attivi) {
  const p = t.turnisti[slot - 1];
  const people = p && !attivi.some(u => u.id === p.id) ? [...attivi, p] : attivi;
  const options = people.map(u => `<option value="${u.id}"${p && u.id === p.id ? ' selected' : ''}>${escapeHtml(u.nome)}</option>`).join('');
  return `<select class="name-sel${p ? '' : ' empty'}" aria-label="Turnista ${slot}, ${dataBreve(t.data)}" onchange="assignSlot(${t.id}, ${slot}, this)">
    <option value=""${p ? '' : ' selected'}>da coprire</option>${options}</select>`;
}

// Menu change: filling a free slot is immediate, replacing or clearing a name asks first.
// Resolves false when the change was declined (the menu is reset), true once it was sent.
async function assegnaTurnista(t, slot, select, attivi) {
  const p = t.turnisti[slot - 1];
  const value = select.value ? Number(select.value) : null;
  if (p) {
    const nuovo = value ? attivi.find(u => u.id === value)?.nome || '' : null;
    const ok = await confirmDialog({
      title: nuovo ? 'Sostituire il turnista?' : 'Togliere il nome?',
      details: [[dataBreve(t.data), nuovo ? `${nuovo} al posto di ${p.nome}` : `da coprire (esce ${p.nome})`]],
      confirmText: nuovo ? 'Sostituisci' : 'Togli il nome'
    });
    if (!ok) { select.value = p.id; return false; }
  }
  try {
    await API.put(`/api/turni/${t.id}`, { [slot === 1 ? 'turnista1Id' : 'turnista2Id']: value });
    showStatus('Turno aggiornato', 'success');
  } catch (error) {
    showStatus('Turno non aggiornato: ' + error.message, 'error');
  }
  return true;
}

// "Modifica giorno": move, skip, mark the meeting. The modal is added to the page by initGiorno().
let giorno = null; // { t, autoOn, onSaved } while the modal is open

function initGiorno() {
  document.body.insertAdjacentHTML('beforeend', `
    <div id="giorno-modal" class="modal initially-hidden">
        <div class="modal-content">
            <h3 id="giorno-title">Giorno della consegna</h3>
            <form onsubmit="event.preventDefault(); saveGiorno();">
                <div class="form-group">
                    <label for="giorno-data">Giorno della consegna</label>
                    <input type="text" id="giorno-data">
                    <small class="hint">stessa coppia, solo nella stessa settimana</small>
                </div>
                <div class="form-group"><label><input type="checkbox" id="giorno-saltata"> Niente consegna <small class="hint" id="giorno-saltata-hint">i due turnisti torneranno i primi in fila</small></label></div>
                <div class="form-group"><label><input type="checkbox" id="giorno-riunione"> Riunione GASS</label></div>
                <div class="form-group"><label for="giorno-nota">Nota</label><input type="text" id="giorno-nota" placeholder="es. festa (Immacolata)"></div>
                <div id="giorno-error" class="error-message initially-hidden"></div>
                <div class="modal-buttons">
                    <button type="button" onclick="closeGiorno()">Annulla</button>
                    <button type="submit" class="btn-save">Salva</button>
                </div>
            </form>
        </div>
    </div>`);
  initDateField('giorno-data');
}

function openGiorno(t, { autoOn, onSaved }) {
  giorno = { t, autoOn, onSaved };
  document.getElementById('giorno-title').textContent = `Giorno della consegna del ${formatDateLong(t.settimana)}`;
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
  giorno = null;
}

async function saveGiorno() {
  const { t, autoOn, onSaved } = giorno;
  const saltata = document.getElementById('giorno-saltata').checked;
  if (saltata && !t.saltata && t.turnisti.some(Boolean)) {
    const ok = await confirmDialog({
      title: 'Niente consegna?',
      message: 'I due turnisti verranno tolti da questa data' + (autoOn ? ' e saranno i primi a fare il prossimo turno libero.' : '.'),
      confirmText: 'Segna niente consegna'
    });
    if (!ok) return;
  }
  try {
    await API.put(`/api/turni/${t.id}`, {
      data: dateFieldValue('giorno-data'),
      saltata,
      riunione: document.getElementById('giorno-riunione').checked,
      nota: document.getElementById('giorno-nota').value
    });
    closeGiorno();
    showStatus('Giorno aggiornato', 'success');
    await onSaved();
  } catch (error) {
    const err = document.getElementById('giorno-error');
    err.textContent = error.message;
    err.classList.remove('initially-hidden');
  }
}
