// ===== SHARED DEBITI LOGIC =====
// Used by both debiti.js (mobile) and debiti-desktop.js
//
// Depends on: participants (defined in page-specific JS)
// Depends on: utils.js

// ===== DATA LOADING =====

async function loadParticipants() {
  try {
    const result = await API.get('/api/participants');
    participants = result.participants;
    renderParticipants();
    renderSaldiTotals();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

// ===== RENDERING =====

// Totals of credits and debts above the list
function renderSaldiTotals() {
  const el = document.getElementById('saldi-totals');
  if (!el) return;
  const crediti = participants.filter(p => p.saldo > 0);
  const debiti = participants.filter(p => p.saldo < 0);
  const sum = list => list.reduce((acc, p) => acc + p.saldo, 0);
  const persone = n => n === 1 ? '1 persona' : `${n} persone`;
  el.innerHTML = `
    <div><small>Crediti<span class="who"><span class="sep">, </span>${persone(crediti.length)}</span></small><b class="cr">${formatSigned(sum(crediti))}</b></div>
    <div><small>Debiti<span class="who"><span class="sep">, </span>${persone(debiti.length)}</span></small><b class="db">${formatSigned(sum(debiti))}</b></div>
    ${teatroMancanti()}
  `;
}

// Quota teatro still owed (teatro_residuo > 0) or paid ahead (< 0): its own colour, apart from the saldo
function teatroLabel(residuo) {
  if (residuo > 0) return { cls: 'th-db', text: `deve ${formatEuro(residuo)}` };
  if (residuo < 0) return { cls: 'th-ok', text: `anticipo ${formatEuro(-residuo)}` };
  return { cls: 'th-ok', text: 'in pari' };
}

function teatroMancanti() {
  const owing = participants.filter(p => p.teatro_residuo > 0);
  if (!owing.length) return '';
  const tot = owing.reduce((acc, p) => acc + p.teatro_residuo, 0);
  return `<div><small>Quote teatro<span class="who"><span class="sep">, </span>${owing.length} da pagare</span></small><b class="th">${formatEuro(tot)}</b></div>`;
}

// Saldo with sign and word, never colour alone: { cls, amount, word }
function saldoLabel(saldo) {
  if (saldo > 0) return { cls: 'cr', amount: formatSigned(saldo), word: 'credito' };
  if (saldo < 0) return { cls: 'db', amount: formatSigned(saldo), word: 'debito' };
  return { cls: '', amount: '0 €', word: 'in pari' };
}

// ===== HELPERS =====

// Disattivati are hidden unless an admin ticks "Mostra disattivati" (desktop);
// the totals still count them, so no money drops out of the sums. Sospesi ("no turni") are always shown.
// Order: attivi and sospesi together, then disattivati, each alphabetical
const STATO_ORDER = { attivo: 0, sospeso: 0, disattivato: 1 };
function visibleParticipants() {
  const showOff = document.getElementById('show-inactive')?.checked;
  return participants
    .filter(p => p.stato !== 'disattivato' || showOff)
    .sort((a, b) => STATO_ORDER[a.stato] - STATO_ORDER[b.stato] || a.nome.localeCompare(b.nome, 'it'));
}
