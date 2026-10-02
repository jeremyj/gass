// ===== STATE MANAGEMENT =====

let participants = [];
let expandedParticipantId = null;
let originalSaldoValues = {}; // Track original values when card is expanded
let transactionsCache = {}; // Cache loaded transactions

// Calendar state now managed in calendar.js

// ===== CALENDAR AND DATE PICKER =====
// Calendar and date picker functions are now in calendar.js

// ===== RENDERING =====

function renderParticipants() {
  const container = document.getElementById('saldi-list');
  container.innerHTML = '';

  const list = visibleParticipants();
  if (list.length === 0) {
    container.innerHTML = '<p class="empty-state">Nessun partecipante</p>';
    return;
  }

  list.forEach(p => {
    const card = createParticipantCard(p);
    container.appendChild(card);
  });
}

function createParticipantCard(p) {
  const isExpanded = expandedParticipantId === p.id;
  const saldo = saldoLabel(p.saldo);
  const adminBadge = (p.is_admin ? '<span class="admin-badge">admin</span>' : '')
    + statoBadge(p.stato);

  const card = document.createElement('li');
  if (p.stato === 'disattivato') card.classList.add('off');
  const summary = `
    <span class="nm">${escapeHtml(p.nome)}${adminBadge}</span>
    <span class="sub">ultimo movimento ${formatDateItalian(p.ultima_modifica)}</span>
    ${p.teatro_residuo ? `<span class="sub"><span class="th-inline ${teatroLabel(p.teatro_residuo).cls}">teatro ${teatroLabel(p.teatro_residuo).text}</span></span>` : ''}
    <span class="esito ${saldo.cls}"><b>${saldo.amount}</b><small>${saldo.word}</small></span>
  `;

  if (!isExpanded) {
    card.onclick = () => toggleParticipantCard(p.id);
    card.innerHTML = summary;
    return card;
  }

  card.classList.add('open');
  const canEdit = isAdmin();

  let editSectionHtml = '';
  if (canEdit) {
    editSectionHtml = `
      <button type="button" class="btn btn-line btn-block" id="saldo-edit-btn-${p.id}" onclick="showSaldoEdit(${p.id})">Modifica saldo</button>
      <div class="saldo-edit-section initially-hidden" id="saldo-edit-${p.id}">
        <h3>Modifica saldo</h3>
        <div class="input-row">
          <div class="form-group">
            <label for="credito-input-${p.id}">Nuovo credito</label>
            <input type="text"
                   inputmode="decimal"
                   id="credito-input-${p.id}"
                   class="input-field"
                   value="${p.saldo > 0 ? formatNumber(p.saldo) : ''}"
                   placeholder="0"
                   oninput="normalizeInputField(this); updateSaldoInputs(${p.id}, 'credito')"
                   onfocus="handleInputFocus(this)"
                   ${p.saldo < 0 ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label for="debito-input-${p.id}">Nuovo debito</label>
            <input type="text"
                   inputmode="decimal"
                   id="debito-input-${p.id}"
                   class="input-field"
                   value="${p.saldo < 0 ? formatNumber(Math.abs(p.saldo)) : ''}"
                   placeholder="0"
                   oninput="normalizeInputField(this); updateSaldoInputs(${p.id}, 'debito')"
                   onfocus="handleInputFocus(this)"
                   ${p.saldo > 0 ? 'disabled' : ''}>
          </div>
        </div>
        <p class="hint">La modifica manuale registra una rettifica con la data di oggi.</p>
        <button class="btn btn-go btn-block" onclick="saveSaldo(${p.id})">Salva saldo</button>
        <button type="button" class="btn btn-line btn-block" onclick="hideSaldoEdit(${p.id})">Annulla</button>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="saldo-header-expanded clickable" id="header-${p.id}">${summary}</div>
    ${editSectionHtml}
    <div class="saldo-transactions-section" id="transactions-${p.id}">
      <h3>Transazioni</h3>
      <div class="transactions-loading">Caricamento…</div>
    </div>
    <button class="btn btn-line btn-block" onclick="toggleParticipantCard(${p.id})">Chiudi</button>
  `;

  // Add click handler to header and load transactions after render
  setTimeout(() => {
    const header = document.getElementById(`header-${p.id}`);
    if (header) {
      header.addEventListener('click', () => toggleParticipantCard(p.id));
    }

    loadTransactions(p.id);
  }, 100);

  return card;
}

// The edit form stays behind the "Modifica saldo" button so opening a card doesn't pop up the keyboard
function showSaldoEdit(id) {
  const p = participants.find(p => p.id === id);
  document.getElementById(`saldo-edit-btn-${id}`).classList.add('initially-hidden');
  document.getElementById(`saldo-edit-${id}`).classList.remove('initially-hidden');
  const input = document.getElementById(p.saldo < 0 ? `debito-input-${id}` : `credito-input-${id}`);
  input.focus();
  input.select();
}

// Hide the form and put back the current saldo (by re-rendering the open card)
function hideSaldoEdit(id) {
  renderParticipants();
}

// ===== TRANSACTIONS =====

async function loadTransactions(participantId) {
  const container = document.getElementById(`transactions-${participantId}`);
  if (!container) return;

  // Use cache if available
  if (transactionsCache[participantId]) {
    renderTransactions(container, transactionsCache[participantId]);
    return;
  }

  try {
    const result = await API.get(`/api/participants/${participantId}/transactions`);
    transactionsCache[participantId] = result.transactions;
    renderTransactions(container, result.transactions);
  } catch (error) {
    container.innerHTML = `<h3>Transazioni</h3><p class="empty-state">Errore: ${escapeHtml(error.message)}</p>`;
  }
}

function renderTransactions(container, transactions) {
  if (transactions.length === 0) {
    container.innerHTML = `<h3>Transazioni</h3><p class="empty-state">Nessuna transazione</p>`;
    return;
  }

  let html = '<h3>Transazioni</h3>';
  html += '<div class="transactions-list">';

  transactions.forEach(t => {
    const saldo = saldoLabel(t.saldo_dopo);

    const details = [];
    if (t.tipo === 'rettifica') details.push(`rettifica manuale ${formatSigned(t.importo)}`);
    if (t.conto_produttore) details.push(`conto ${formatEuro(t.conto_produttore)}`);
    if (t.importo_saldato) details.push(`pagato ${formatEuro(t.importo_saldato)}`);
    if (t.usa_credito) details.push(`usa credito ${formatEuro(t.usa_credito)}`);
    if (debitoPagato(t)) details.push(`salda debito ${formatEuro(debitoPagato(t))}`);

    html += `
      <div class="transaction-item">
        <div class="transaction-header">
          <span class="transaction-date">${formatDateItalian(t.data)}</span>
          <span class="transaction-effect ${saldo.cls}">${saldo.amount} ${saldo.word}</span>
        </div>
        <div class="transaction-details">${details.length > 0 ? details.join(', ') : 'nessun importo'}</div>
        ${t.note ? `<div class="transaction-note">${escapeHtml(t.note)}</div>` : ''}
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// ===== CARD INTERACTION =====

async function toggleParticipantCard(id) {
  if (expandedParticipantId === id) {
    // Trying to close - check for unsaved changes (admin only)
    if (isAdmin() && hasUnsavedChanges(id)) {
      const ok = await confirmDialog({
        title: 'Modifiche non salvate',
        message: 'Vuoi chiudere senza salvare?',
        confirmText: 'Chiudi senza salvare',
        danger: true
      });
      if (!ok) return; // User cancelled, keep card open
    }
    expandedParticipantId = null;
    originalSaldoValues = {}; // Clear saved values
  } else {
    // Opening card - save original values for admin edit tracking
    if (isAdmin()) {
      const participant = participants.find(p => p.id === id);
      if (participant) {
        originalSaldoValues[id] = {
          credito: participant.saldo > 0 ? participant.saldo : 0,
          debito: participant.saldo < 0 ? Math.abs(participant.saldo) : 0
        };
      }
    }
    expandedParticipantId = id;
  }
  renderParticipants();
}

function hasUnsavedChanges(id) {
  // Check if current input values differ from original values
  const creditoInput = document.getElementById(`credito-input-${id}`);
  const debitoInput = document.getElementById(`debito-input-${id}`);

  if (!creditoInput || !debitoInput || !originalSaldoValues[id]) {
    return false;
  }

  const currentCredito = parseAmount(creditoInput.value);
  const currentDebito = parseAmount(debitoInput.value);

  const originalCredito = originalSaldoValues[id].credito;
  const originalDebito = originalSaldoValues[id].debito;

  return currentCredito !== originalCredito || currentDebito !== originalDebito;
}

function updateSaldoInputs(id, changedField) {
  const creditoInput = document.getElementById(`credito-input-${id}`);
  const debitoInput = document.getElementById(`debito-input-${id}`);

  if (changedField === 'credito') {
    const creditoValue = parseAmount(creditoInput.value);
    if (creditoValue > 0) {
      debitoInput.value = '';
      debitoInput.disabled = true;
    } else {
      debitoInput.disabled = false;
    }
  } else if (changedField === 'debito') {
    const debitoValue = parseAmount(debitoInput.value);
    if (debitoValue > 0) {
      creditoInput.value = '';
      creditoInput.disabled = true;
    } else {
      creditoInput.disabled = false;
    }
  }
}

// ===== SAVE =====

async function saveSaldo(id) {
  const creditoInput = document.getElementById(`credito-input-${id}`);
  const debitoInput = document.getElementById(`debito-input-${id}`);

  let newSaldo = 0;

  if (creditoInput && !creditoInput.disabled) {
    const creditoValue = parseAmount(creditoInput.value);
    if (creditoValue > 0) {
      newSaldo = creditoValue;
    }
  }

  if (debitoInput && !debitoInput.disabled) {
    const debitoValue = parseAmount(debitoInput.value);
    if (debitoValue > 0) {
      newSaldo = -debitoValue;
    }
  }

  if (isNaN(newSaldo)) {
    showStatus('Inserisci un saldo valido', 'error');
    return;
  }

  try {
    await API.put(`/api/participants/${id}`, { saldo: newSaldo });
    showStatus('Saldo aggiornato', 'success');
    expandedParticipantId = null;
    originalSaldoValues = {}; // Clear saved values after successful save
    transactionsCache = {}; // Clear transactions cache
    loadParticipants();
  } catch (error) {
    showStatus('Errore durante l\'aggiornamento: ' + error.message, 'error');
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
  // Saldi are editable only by admins: know the user before rendering
  await sessionReady;
  setDateDisplay(toLocalDateString());
  loadParticipants();
});
