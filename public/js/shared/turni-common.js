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
  const options = candidatiScambio(turni, t).map(u => `<option value="${u.id}">${escapeHtml(u.nome)}</option>`).join('');
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
