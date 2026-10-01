// ===== SHARED DEBITI LOGIC =====
// Used by both debiti.js (mobile) and debiti-desktop.js
//
// Depends on: participants (defined in page-specific JS)
// Depends on: utils.js

// ===== DATA LOADING =====

async function loadParticipants() {
  try {
    const dateInput = document.getElementById('data');
    const date = dateInput ? dateInput.value : null;
    const today = toLocalDateString();

    let url = '/api/participants';
    if (date && date !== today) {
      url += `?date=${date}`;
    }

    const result = await API.get(url);
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
    <div><small>Crediti, ${persone(crediti.length)}</small><b class="cr">${formatSigned(sum(crediti))}</b></div>
    <div><small>Debiti, ${persone(debiti.length)}</small><b class="db">${formatSigned(sum(debiti))}</b></div>
  `;
}

// Saldo with sign and word, never colour alone: { cls, amount, word }
function saldoLabel(saldo) {
  if (saldo > 0) return { cls: 'cr', amount: formatSigned(saldo), word: 'credito' };
  if (saldo < 0) return { cls: 'db', amount: formatSigned(saldo), word: 'debito' };
  return { cls: '', amount: '0 €', word: 'in pari' };
}

// ===== HELPERS =====

// Disabled users are hidden unless an admin ticks "Mostra disattivati" (desktop);
// the totals still count them, so no money drops out of the sums
function visibleParticipants() {
  const showOff = document.getElementById('show-inactive')?.checked;
  return participants.filter(p => p.attivo || showOff);
}

function isViewingToday() {
  const dateInput = document.getElementById('data');
  const today = toLocalDateString();
  return !dateInput || dateInput.value === today;
}
