// ===== TURNI: SWAP (mobile + desktop) =====
// "scambia con…": the chosen person takes the picked slot, the picked person
// takes the chosen one's first non-skipped turno from today (same rule as the server).

const dataBreve = d => `${weekdayShort(d)} ${formatDateItalian(d).slice(0, 5)}`;

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
    showStatus('Errore: ' + error.message, 'error');
    return false;
  }
}

// ===== TURNI: MOVE TO A FREE SLOT, LEAVE (mobile + desktop) =====

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
    <button type="button" class="btn btn-line" id="leave-btn">Non posso</button>`;
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
    showStatus('Errore: ' + error.message, 'error');
    return false;
  }
}

async function lasciaTurno(t, slot) {
  const p = t.turnisti[slot - 1];
  const ok = await confirmDialog({
    title: 'Non puoi fare il turno?',
    message: 'Il posto resta da coprire: lo riempirà chi gestisce i turni o chi si offre.',
    details: [[dataBreve(t.data), `${p.nome} esce`]],
    confirmText: 'Lascia il turno'
  });
  if (!ok) return false;
  try {
    await API.post('/api/turni/lascia', { a: { id: t.id, slot } });
    showStatus('Turno lasciato', 'success');
    return true;
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
    return false;
  }
}
