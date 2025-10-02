// ===== STATE MANAGEMENT =====

let participants = [];
let expandedParticipantId = null;

// ===== DATA LOADING =====

async function loadParticipants() {
  try {
    const response = await fetch('/api/participants');
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
  card.className = 'saldo-card';
  if (isExpanded) {
    card.classList.add('expanded');
  }

  // Determine saldo badge class
  let saldoBadgeClass = 'saldo-badge';
  let saldoText = '€0.00';
  if (p.saldo < 0) {
    saldoBadgeClass += ' debito';
    saldoText = `€${p.saldo.toFixed(2)}`;
  } else if (p.saldo > 0) {
    saldoBadgeClass += ' credito';
    saldoText = `€${p.saldo.toFixed(2)}`;
  } else {
    saldoBadgeClass += ' zero';
    saldoText = '€0.00';
  }

  // Collapsed header (always visible)
  const header = document.createElement('div');
  header.className = 'saldo-card-header';
  header.onclick = () => toggleParticipantCard(p.id);

  const arrow = isExpanded ? '▲' : '▼';

  header.innerHTML = `
    <div class="saldo-card-info">
      <div class="saldo-card-name">👤 ${p.nome}</div>
      <div class="saldo-card-date">${formatDateItalian(p.ultima_modifica)}</div>
    </div>
    <div class="saldo-card-right">
      <div class="${saldoBadgeClass}">${saldoText}</div>
      <span class="saldo-arrow">${arrow}</span>
    </div>
  `;

  card.appendChild(header);

  // Expanded content
  if (isExpanded) {
    const content = document.createElement('div');
    content.className = 'saldo-card-content';

    content.innerHTML = `
      <div class="input-group">
        <div class="input-label">
          <span>Nuovo Saldo</span>
        </div>
        <input type="text"
               inputmode="decimal"
               id="saldo-input-${p.id}"
               class="input-field"
               value="${p.saldo}"
               placeholder="Inserisci nuovo saldo..."
               oninput="normalizeInputField(this)"
               onfocus="handleInputFocus(this)"
               onkeydown="if(event.key==='Enter'){event.preventDefault();saveSaldo(${p.id})}">
      </div>

      <div class="saldo-card-actions">
        <button class="big-btn big-btn-success" onclick="saveSaldo(${p.id})">
          💾 Salva
        </button>
        <button class="big-btn big-btn-secondary" onclick="toggleParticipantCard(${p.id})">
          Annulla
        </button>
      </div>
    `;

    card.appendChild(content);

    // Focus input after render
    setTimeout(() => {
      const input = document.getElementById(`saldo-input-${p.id}`);
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
  }

  return card;
}

// ===== CARD INTERACTION =====

function toggleParticipantCard(id) {
  if (expandedParticipantId === id) {
    expandedParticipantId = null;
  } else {
    expandedParticipantId = id;
  }
  renderParticipants();
}

// ===== SAVE/DELETE =====

async function saveSaldo(id) {
  const inputField = document.getElementById(`saldo-input-${id}`);
  const newSaldo = parseAmount(inputField.value);

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
  loadParticipants();
});
