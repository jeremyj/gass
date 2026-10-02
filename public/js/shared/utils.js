// ===== SHARED UTILITY FUNCTIONS =====
// Used across consegna.js, storico.js, and debiti.js

// Escape HTML special characters to prevent XSS
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Display status message to user
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status ' + type;
  setTimeout(() => {
    status.className = 'status';
  }, 5000);
}

// Local calendar date as yyyy-mm-dd (toISOString() would give the UTC date)
function toLocalDateString(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Format date from yyyy-mm-dd to dd/mm/yyyy
function formatDateItalian(dateStr) {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// Replace dot with the Italian decimal comma and validate decimal input in real-time
function normalizeInputField(input) {
  if (input.value.includes('.')) {
    const cursorPos = input.selectionStart;
    input.value = input.value.replace('.', ',');
    input.setSelectionRange(cursorPos, cursorPos);
  }

  const valid = /^-?\d*,?\d*$/.test(input.value);
  if (!valid && input.value !== '') {
    input.value = input.value.slice(0, -1);
  }
}

// Clear zero values on input focus for easier editing
function handleInputFocus(input) {
  if (parseAmount(input.value) === 0) {
    input.value = '';
  }
}

// Normalize decimal string (comma to dot)
function normalizeDecimal(value) {
  if (typeof value === 'string') {
    return value.replace(',', '.');
  }
  return value;
}

// Parse amount string to number with decimal normalization
function parseAmount(value) {
  const normalized = normalizeDecimal(value);
  return parseFloat(normalized) || 0;
}

// Round to 0.01€ (1 cent) - matches server-side rounding
function roundToCents(amount) {
  return Math.round(amount * 100) / 100;
}

// Format a number for display with the Italian decimal comma, hiding ,00 decimals.
// Also written into readonly inputs: parseAmount reads it back.
function formatNumber(value) {
  if (value === null || value === undefined) return '';
  const num = roundToCents(parseFloat(value));
  if (isNaN(num)) return '';
  return num % 1 === 0 ? num.toString() : num.toFixed(2).replace('.', ',');
}

// "11,50 €" — display only
function formatEuro(value) {
  return `${formatNumber(value)} €`;
}

// "+6 €" / "−1 €" (typographic minus) — display only, never written into inputs
function formatSigned(value) {
  const num = roundToCents(parseFloat(value) || 0);
  if (num === 0) return '0 €';
  return `${num > 0 ? '+' : '−'}${formatEuro(Math.abs(num))}`;
}

// On a partial debt payoff a movimento stores the whole prior debt in debito_saldato and the
// part still owed in debito_lasciato (so the ledger replay stays right). For display, split it
// into what was actually paid and what is genuinely new debt.
function debitoPagato(m) {
  return m.debito_saldato > 0 ? roundToCents(m.debito_saldato - (m.debito_lasciato || 0)) : 0;
}

function debitoNuovo(m) {
  return m.debito_saldato > 0 ? 0 : (m.debito_lasciato || 0);
}

// In-page replacement for confirm(): resolves true/false.
// details: [[label, value], ...] shown as a list; danger: red confirm button.
function confirmDialog({ title, message = '', details = [], confirmText = 'Conferma', danger = false }) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'modal confirm-modal';
    const rows = details.map(([label, value]) =>
      `<div class="confirm-detail"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
    ).join('');
    modal.innerHTML = `
      <div class="modal-content" role="alertdialog" aria-modal="true">
        <h3>${escapeHtml(title)}</h3>
        ${message ? `<p class="confirm-message">${escapeHtml(message)}</p>` : ''}
        ${rows}
        <div class="modal-buttons">
          <button type="button" data-answer="no">Annulla</button>
          <button type="button" data-answer="yes" class="${danger ? 'btn-danger' : 'btn-save'}">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    const close = answer => {
      document.removeEventListener('keydown', onKey);
      modal.remove();
      resolve(answer);
    };
    const onKey = e => { if (e.key === 'Escape') close(false); };

    modal.addEventListener('click', e => {
      if (e.target === modal) return close(false);
      const answer = e.target.closest('[data-answer]')?.dataset.answer;
      if (answer) close(answer === 'yes');
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(modal);
    modal.querySelector('[data-answer="no"]').focus();
  });
}

// ===== STORICO → CONSEGNA =====

// Open the consegna page on a given date (the page restores it from sessionStorage)
function openConsegnaOn(dateStr) {
  window.location.href = `/consegna?data=${dateStr}`;
}

// Admin: reopen a closed consegna and open it for editing (uses API from api-client.js)
async function riapriConsegna(id, dateStr) {
  try {
    await API.post(`/api/consegna/${id}/reopen`, {});
    openConsegnaOn(dateStr);
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

// Link under a consegna in Storico: finish an open one, or (admin) reopen a closed one
function storicoActionsHtml(consegna) {
  if (!consegna.chiusa) {
    return `<button type="button" class="link-btn" onclick="event.stopPropagation(); openConsegnaOn('${consegna.data}')">Completa consegna</button>`;
  }
  return isAdmin()
    ? `<button type="button" class="link-btn" onclick="event.stopPropagation(); riapriConsegna(${consegna.id}, '${consegna.data}')">Riapri consegna</button>`
    : '';
}

// 'mar', 'mer', … for a yyyy-mm-dd date (local)
function weekdayShort(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '');
}

// 'ottobre', … for a yyyy-mm-dd date (local)
function monthName(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', { month: 'long' });
}
