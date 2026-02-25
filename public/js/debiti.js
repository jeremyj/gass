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

  if (participants.length === 0) {
    container.innerHTML = '<p class="empty-state">Nessun partecipante</p>';
    return;
  }

  participants.forEach(p => {
    const card = createParticipantCard(p);
    container.appendChild(card);
  });
}

function createParticipantCard(p) {
  const isExpanded = expandedParticipantId === p.id;

  const card = document.createElement('div');

  // Determine card class based on saldo type
  let cardClass = 'saldo-card-collapsed';
  let saldoBadgeClass = 'saldo-amount-badge';
  let saldoText = '0.00 €';

  if (p.saldo < 0) {
    cardClass += ' has-debito';
    saldoBadgeClass += ' saldo-debito';
    saldoText = `${formatNumber(p.saldo)} €`;
  } else if (p.saldo > 0) {
    cardClass += ' has-credito';
    saldoBadgeClass += ' saldo-credito';
    saldoText = `+${formatNumber(p.saldo)} €`;
  } else {
    cardClass += ' is-pari';
    saldoBadgeClass += ' saldo-pari';
    saldoText = '0 €';
  }

  if (isExpanded) {
    card.className = 'saldo-card-expanded';
    if (p.saldo < 0) {
      card.classList.add('has-debito');
    } else if (p.saldo > 0) {
      card.classList.add('has-credito');
    }
  } else {
    card.className = cardClass;
  }

  const adminBadge = p.is_admin ? '<span class="admin-badge">Admin</span>' : '';

  if (!isExpanded) {
    // Collapsed view
    card.onclick = () => toggleParticipantCard(p.id);
    card.innerHTML = `
      <div class="saldo-info-left">
        <div class="saldo-name">👤 ${escapeHtml(p.nome)}${adminBadge}</div>
        <div class="saldo-last-date">Ultimo movimento: ${formatDateItalian(p.ultima_modifica)}</div>
      </div>
      <div class="${saldoBadgeClass}">
        ${saldoText}
      </div>
    `;
  } else {
    // Expanded view
    const canEdit = isAdmin() && isViewingToday();

    let editSectionHtml = '';
    if (canEdit) {
      editSectionHtml = `
        <div class="saldo-edit-section">
          <div class="saldo-edit-title">✏️ Modifica Saldo Attuale</div>
          <div class="input-row">
            <div>
              <label style="font-size: 12px; color: #6c757d; margin-bottom: 5px; display: block;">Nuovo Credito</label>
              <input type="text"
                     inputmode="decimal"
                     id="credito-input-${p.id}"
                     class="input-field"
                     value="${p.saldo > 0 ? p.saldo : ''}"
                     placeholder="0.00"
                     oninput="normalizeInputField(this); updateSaldoInputs(${p.id}, 'credito')"
                     onfocus="handleInputFocus(this)"
                     ${p.saldo < 0 ? 'disabled style="opacity: 0.5;"' : ''}>
            </div>
            <div>
              <label style="font-size: 12px; color: #6c757d; margin-bottom: 5px; display: block;">Nuovo Debito</label>
              <input type="text"
                     inputmode="decimal"
                     id="debito-input-${p.id}"
                     class="input-field"
                     value="${p.saldo < 0 ? Math.abs(p.saldo) : ''}"
                     placeholder="0.00"
                     oninput="normalizeInputField(this); updateSaldoInputs(${p.id}, 'debito')"
                     onfocus="handleInputFocus(this)"
                     ${p.saldo > 0 ? 'disabled style="opacity: 0.5;"' : ''}>
            </div>
          </div>
        </div>

        <div class="info-badge info-badge-warning">
          ⚠️ Modifica manuale del saldo. Usa con attenzione.
        </div>

        <button class="big-btn big-btn-success" onclick="saveSaldo(${p.id})">
          💾 Salva Modifiche
        </button>
      `;
    }

    card.innerHTML = `
      <div class="saldo-header-expanded clickable" id="header-${p.id}">
        <div>
          <div class="participant-name-expanded">👤 ${escapeHtml(p.nome)}${adminBadge}</div>
          <div class="saldo-last-date">Ultimo movimento: ${formatDateItalian(p.ultima_modifica)}</div>
        </div>
        <div class="${saldoBadgeClass}">
          ${saldoText}
        </div>
      </div>

      ${editSectionHtml}

      <div class="saldo-transactions-section" id="transactions-${p.id}">
        <div class="saldo-edit-title">📋 Transazioni</div>
        <div class="transactions-loading">Caricamento...</div>
      </div>

      <button class="big-btn big-btn-secondary" onclick="toggleParticipantCard(${p.id})">
        ✖️ Chiudi
      </button>
    `;

    // Add click handler to header and load transactions after render
    setTimeout(() => {
      const header = document.getElementById(`header-${p.id}`);
      if (header) {
        header.addEventListener('click', (e) => {
          // Don't close if clicking on input fields or buttons
          if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
            toggleParticipantCard(p.id);
          }
        });
      }

      if (canEdit) {
        const creditoInput = document.getElementById(`credito-input-${p.id}`);
        const debitoInput = document.getElementById(`debito-input-${p.id}`);

        if (p.saldo >= 0 && creditoInput) {
          creditoInput.focus();
          creditoInput.select();
        } else if (p.saldo < 0 && debitoInput) {
          debitoInput.focus();
          debitoInput.select();
        }
      }

      // Load transactions
      loadTransactions(p.id);
    }, 100);
  }

  return card;
}

// ===== TRANSACTIONS =====

async function loadTransactions(participantId) {
  const container = document.getElementById(`transactions-${participantId}`);
  if (!container) return;

  const participant = participants.find(p => p.id === participantId);
  const currentSaldo = participant ? participant.saldo : 0;

  // Use cache if available
  if (transactionsCache[participantId]) {
    renderTransactions(container, transactionsCache[participantId], currentSaldo);
    return;
  }

  try {
    const response = await fetch(`/api/participants/${participantId}/transactions`);
    const result = await response.json();

    if (result.success) {
      transactionsCache[participantId] = result.transactions;
      renderTransactions(container, result.transactions, currentSaldo);
    } else {
      container.innerHTML = `<div class="saldo-edit-title">📋 Transazioni</div><p class="empty-state">Errore: ${result.error}</p>`;
    }
  } catch (error) {
    container.innerHTML = `<div class="saldo-edit-title">📋 Transazioni</div><p class="empty-state">Errore di connessione</p>`;
  }
}

function renderTransactions(container, transactions, currentSaldo = 0) {
  if (transactions.length === 0) {
    container.innerHTML = `<div class="saldo-edit-title">📋 Transazioni</div><p class="empty-state">Nessuna transazione</p>`;
    return;
  }

  // Compute running balance after each transaction (transactions ordered newest-first)
  let balance = currentSaldo;
  const balancesAfter = [];
  for (const t of transactions) {
    balancesAfter.push(balance);
    const effect = (t.credito_lasciato || 0) - (t.debito_lasciato || 0) - (t.usa_credito || 0) + (t.debito_saldato || 0);
    balance -= effect;
  }

  let html = '<div class="saldo-edit-title">📋 Transazioni</div>';
  html += '<div class="transactions-list">';

  transactions.forEach((t, i) => {
    const balanceAfter = balancesAfter[i];
    let effectClass = 'tx-pari';
    let effectText = 'Pari';

    if (balanceAfter > 0) {
      effectClass = 'tx-credito';
      effectText = `+${formatNumber(balanceAfter)} €`;
    } else if (balanceAfter < 0) {
      effectClass = 'tx-debito';
      effectText = `${formatNumber(balanceAfter)} €`;
    }

    const details = [];
    if (t.conto_produttore) details.push(`Conto: ${formatNumber(t.conto_produttore)} €`);
    if (t.importo_saldato) details.push(`Pagato: ${formatNumber(t.importo_saldato)} €`);
    if (t.usa_credito) details.push(`Usa credito: ${formatNumber(t.usa_credito)} €`);
    if (t.debito_saldato) details.push(`Salda debito: ${formatNumber(t.debito_saldato)} €`);

    html += `
      <div class="transaction-item ${effectClass}">
        <div class="transaction-header">
          <span class="transaction-date">${formatDateItalian(t.consegna_data)}</span>
          <span class="transaction-effect ${effectClass}">${effectText}</span>
        </div>
        <div class="transaction-details">
          ${details.length > 0 ? details.join(' · ') : 'Pari'}
        </div>
        ${t.note ? `<div class="transaction-note">📝 ${escapeHtml(t.note)}</div>` : ''}
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// ===== CARD INTERACTION =====

function toggleParticipantCard(id) {
  if (expandedParticipantId === id) {
    // Trying to close - check for unsaved changes (admin only)
    if (isAdmin() && isViewingToday() && hasUnsavedChanges(id)) {
      if (!confirm('Ci sono modifiche non salvate. Vuoi chiudere senza salvare?')) {
        return; // User cancelled, keep card open
      }
    }
    expandedParticipantId = null;
    originalSaldoValues = {}; // Clear saved values
  } else {
    // Opening card - save original values for admin edit tracking
    if (isAdmin() && isViewingToday()) {
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

// ===== SAVE/DELETE =====

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
    const response = await fetch(`/api/participants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saldo: newSaldo }),
    });

    const result = await response.json();

    if (result.success) {
      showStatus('✓ Saldo aggiornato', 'success');
      expandedParticipantId = null;
      originalSaldoValues = {}; // Clear saved values after successful save
      transactionsCache = {}; // Clear transactions cache
      loadParticipants();
    } else {
      showStatus('Errore: ' + result.error, 'error');
    }
  } catch (error) {
    showStatus('Errore durante l\'aggiornamento: ' + error.message, 'error');
  }
}

async function deleteParticipant(id) {
  const participant = participants.find(p => p.id === id);
  if (!confirm(`Sei sicuro di voler eliminare ${participant.nome}?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/participants/${id}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (result.success) {
      showStatus('✓ Partecipante eliminato', 'success');
      expandedParticipantId = null;
      loadParticipants();
    } else {
      showStatus('Errore: ' + result.error, 'error');
    }
  } catch (error) {
    showStatus('Errore durante l\'eliminazione: ' + error.message, 'error');
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
  // Initialize calendar with page-specific callback
  initCalendar({
    onDateSelected: () => {
      transactionsCache = {}; // Clear cache on date change
      loadParticipants();
    }
  });

  // Load consegna dates for calendar indicators
  loadConsegneDates();

  // Restore date from localStorage or use today's date
  const dateToLoad = restoreDateFromStorage();
  setDateDisplay(dateToLoad);
});
