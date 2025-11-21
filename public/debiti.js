// ===== STATE MANAGEMENT =====

let participants = [];
let expandedParticipantId = null;
let originalSaldoValues = {}; // Track original values when card is expanded

// Calendar state now managed in calendar.js

// ===== CALENDAR AND DATE PICKER =====
// Calendar and date picker functions are now in calendar.js

// ===== DATA LOADING =====

async function loadParticipants() {
  try {
    const dateInput = document.getElementById('data');
    const date = dateInput ? dateInput.value : null;
    const today = new Date().toISOString().split('T')[0];

    // Build URL with optional date parameter
    // For today's date, don't pass date parameter to get current saldi from partecipanti table
    let url = '/api/participants';
    if (date && date !== today) {
      url += `?date=${date}`;
    }

    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      participants = result.participants;
      renderParticipants();
    } else {
      showStatus('Errore: ' + result.error, 'error');
    }
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

async function loadConsegneDates() {
  try {
    const response = await fetch('/api/storico');
    const result = await response.json();

    if (result.success) {
      const dates = result.consegne.map(c => c.data);
      setConsegneDates(dates);
    }
  } catch (error) {
    console.error('Error loading consegne dates:', error);
  }
}

// ===== RENDERING =====

function renderParticipants() {
  const container = document.getElementById('saldi-list');
  container.innerHTML = '';

  if (participants.length === 0) {
    container.innerHTML = '<p style="text-align: center; padding: 20px;">Nessun partecipante</p>';
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
    saldoText = `${p.saldo.toFixed(2)} €`;
  } else if (p.saldo > 0) {
    cardClass += ' has-credito';
    saldoBadgeClass += ' saldo-credito';
    saldoText = `+${p.saldo.toFixed(2)} €`;
  } else {
    cardClass += ' is-pari';
    saldoBadgeClass += ' saldo-pari';
    saldoText = '0.00 €';
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

  if (!isExpanded) {
    // Collapsed view
    card.onclick = () => toggleParticipantCard(p.id);
    card.innerHTML = `
      <div class="saldo-info-left">
        <div class="saldo-name">👤 ${p.nome}</div>
        <div class="saldo-last-date">Ultimo movimento: ${formatDateItalian(p.ultima_modifica)}</div>
      </div>
      <div class="${saldoBadgeClass}">
        ${saldoText}
      </div>
    `;
  } else {
    // Expanded view
    card.innerHTML = `
      <div class="saldo-header-expanded" id="header-${p.id}" style="cursor: pointer;">
        <div>
          <div class="participant-name-expanded">👤 ${p.nome}</div>
          <div class="saldo-last-date">Ultimo movimento: ${formatDateItalian(p.ultima_modifica)}</div>
        </div>
        <div class="${saldoBadgeClass}">
          ${saldoText}
        </div>
      </div>

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

      <div class="info-badge" style="background: #fff3cd; border-color: #ffc107; color: #856404;">
        ⚠️ Modifica manuale del saldo. Usa con attenzione.
      </div>

      <button class="big-btn big-btn-success" style="margin-top: 12px;" onclick="saveSaldo(${p.id})">
        💾 Salva Modifiche
      </button>

      <button class="collapse-btn" onclick="toggleParticipantCard(${p.id})">
        ▲ Chiudi
      </button>
    `;

    // Add click handler to header and focus appropriate input after render
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

      const creditoInput = document.getElementById(`credito-input-${p.id}`);
      const debitoInput = document.getElementById(`debito-input-${p.id}`);

      if (p.saldo >= 0 && creditoInput) {
        creditoInput.focus();
        creditoInput.select();
      } else if (p.saldo < 0 && debitoInput) {
        debitoInput.focus();
        debitoInput.select();
      }
    }, 100);
  }

  return card;
}

// ===== CARD INTERACTION =====

function toggleParticipantCard(id) {
  if (expandedParticipantId === id) {
    // Trying to close - check for unsaved changes
    if (hasUnsavedChanges(id)) {
      if (!confirm('Ci sono modifiche non salvate. Vuoi chiudere senza salvare?')) {
        return; // User cancelled, keep card open
      }
    }
    expandedParticipantId = null;
    originalSaldoValues = {}; // Clear saved values
  } else {
    // Opening card - save original values
    const participant = participants.find(p => p.id === id);
    if (participant) {
      originalSaldoValues[id] = {
        credito: participant.saldo > 0 ? participant.saldo : 0,
        debito: participant.saldo < 0 ? Math.abs(participant.saldo) : 0
      };
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
      debitoInput.style.opacity = '0.5';
    } else {
      debitoInput.disabled = false;
      debitoInput.style.opacity = '1';
    }
  } else if (changedField === 'debito') {
    const debitoValue = parseAmount(debitoInput.value);
    if (debitoValue > 0) {
      creditoInput.value = '';
      creditoInput.disabled = true;
      creditoInput.style.opacity = '0.5';
    } else {
      creditoInput.disabled = false;
      creditoInput.style.opacity = '1';
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
    onDateSelected: loadParticipants
  });

  // Load consegna dates for calendar indicators
  loadConsegneDates();

  // Restore date from localStorage or use today's date
  const dateToLoad = restoreDateFromStorage();
  setDateDisplay(dateToLoad);
});
