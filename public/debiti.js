// ===== STATE MANAGEMENT =====

let participants = [];
let expandedParticipantId = null;
let originalSaldoValues = {}; // Track original values when card is expanded

let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth();

// Date picker state
let pickerYear = new Date().getFullYear();
let pickerMonth = new Date().getMonth();
let isPickerOpen = false;

// ===== CALENDAR MODAL =====

function showCalendarModal() {
  const calendar = document.getElementById('calendar-container');
  calendar.classList.toggle('hidden');
  if (!calendar.classList.contains('hidden')) {
    renderCalendar();
  }
}

function selectDate(dateStr) {
  setDateDisplay(dateStr);
  renderCalendar();
}

function renderCalendar() {
  const container = document.getElementById('calendar-container');
  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const today = new Date();
  const selectedDate = document.getElementById('data').value;

  // Get first and last day of month
  const firstDay = new Date(currentCalendarYear, currentCalendarMonth, 1);
  const lastDay = new Date(currentCalendarYear, currentCalendarMonth + 1, 0);

  // Adjust firstDay to Monday (1 = Monday, 0 = Sunday)
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1; // Convert Sunday from 0 to 6

  let html = '<div class="calendar">';

  // Header
  html += '<div class="calendar-header">';
  html += `<button type="button" class="calendar-nav" onclick="changeMonth(-1)">◀</button>`;
  html += `<h3>${monthNames[currentCalendarMonth]} ${currentCalendarYear}</h3>`;
  html += `<button type="button" class="calendar-nav" onclick="changeMonth(1)">▶</button>`;
  html += '</div>';

  // Weekdays
  html += '<div class="calendar-weekdays">';
  weekDays.forEach(day => {
    html += `<div class="calendar-weekday">${day}</div>`;
  });
  html += '</div>';

  // Days
  html += '<div class="calendar-days">';

  // Empty cells before first day
  for (let i = 0; i < startDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  // Days of month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === today.toISOString().split('T')[0];
    const isSelected = dateStr === selectedDate;

    let classes = 'calendar-day';
    if (isToday) classes += ' today';
    if (isSelected) classes += ' selected';

    html += `<div class="${classes}" onclick="selectDate('${dateStr}')">${day}</div>`;
  }

  html += '</div>';
  html += '</div>';
  container.innerHTML = html;
}

function changeMonth(delta) {
  currentCalendarMonth += delta;
  if (currentCalendarMonth > 11) {
    currentCalendarMonth = 0;
    currentCalendarYear++;
  } else if (currentCalendarMonth < 0) {
    currentCalendarMonth = 11;
    currentCalendarYear--;
  }
  renderCalendar();
}

// ===== DATE PICKER =====

function toggleDatePicker() {
  const container = document.getElementById('date-picker-container');
  isPickerOpen = !isPickerOpen;

  if (isPickerOpen) {
    renderDatePicker();
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}

function renderDatePicker() {
  const container = document.getElementById('date-picker-container');
  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const firstDay = new Date(pickerYear, pickerMonth, 1);
  const lastDay = new Date(pickerYear, pickerMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Convert to Monday=0

  const today = new Date();
  const selectedDateStr = document.getElementById('data').value;

  let html = '<div class="date-picker-header">';
  html += `<button type="button" class="date-picker-nav" onclick="changePickerMonth(-1)">◀</button>`;
  html += `<div class="date-picker-month">${monthNames[pickerMonth]} ${pickerYear}</div>`;
  html += `<button type="button" class="date-picker-nav" onclick="changePickerMonth(1)">▶</button>`;
  html += '</div>';

  html += '<div class="date-picker-weekdays">';
  weekDays.forEach(day => {
    html += `<div class="date-picker-weekday">${day}</div>`;
  });
  html += '</div>';

  html += '<div class="date-picker-days">';
  for (let i = 0; i < startingDayOfWeek; i++) {
    html += '<div class="date-picker-day empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = today.getDate() === day && today.getMonth() === pickerMonth && today.getFullYear() === pickerYear;
    const isSelected = dateStr === selectedDateStr;

    let classes = 'date-picker-day';
    if (isToday) classes += ' today';
    if (isSelected) classes += ' selected';

    html += `<div class="${classes}" onclick="selectPickerDate('${dateStr}')">${day}</div>`;
  }
  html += '</div>';

  container.innerHTML = html;
}

function changePickerMonth(delta) {
  pickerMonth += delta;
  if (pickerMonth > 11) {
    pickerMonth = 0;
    pickerYear++;
  } else if (pickerMonth < 0) {
    pickerMonth = 11;
    pickerYear--;
  }
  renderDatePicker();
}

function selectPickerDate(dateStr) {
  document.getElementById('data').value = dateStr;
  const [year, month, day] = dateStr.split('-');
  document.getElementById('data-display').value = `${day}-${month}-${year}`;
  renderDatePicker();
  loadParticipants();
}

function setDateDisplay(dateStr) {
  const [year, month, day] = dateStr.split('-');
  document.getElementById('data-display').value = `${day}-${month}-${year}`;
  document.getElementById('data').value = dateStr;

  // Update header date display
  const today = new Date().toISOString().split('T')[0];
  const headerDateDisplay = document.getElementById('header-date-display');
  if (headerDateDisplay) {
    if (dateStr === today) {
      headerDateDisplay.textContent = 'Oggi';
    } else {
      headerDateDisplay.textContent = formatDateItalian(dateStr);
    }
  }

  // Set picker to the same month/year
  pickerYear = parseInt(year);
  pickerMonth = parseInt(month) - 1;

  // Load data for this date
  loadParticipants();
}

// formatDateItalian() is now in utils.js - removed duplicate

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

  renderSaldiSummary();
}

function renderSaldiSummary() {
  const summaryContainer = document.getElementById('saldi-summary');

  let creditiTotali = 0;
  let debitiTotali = 0;

  participants.forEach(p => {
    if (p.saldo > 0) {
      creditiTotali += p.saldo;
    } else if (p.saldo < 0) {
      debitiTotali += p.saldo;
    }
  });

  const bilancio = creditiTotali + debitiTotali;
  const bilancioColor = bilancio < 0 ? '#e74c3c' : bilancio > 0 ? '#2ecc71' : '#3498db';

  summaryContainer.innerHTML = `
    <div style="background: white; padding: 20px; border-radius: 12px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h3 style="color: #2c3e50; margin-bottom: 15px; text-align: center;">📊 Riepilogo</h3>
      <div style="display: flex; justify-content: space-around; text-align: center;">
        <div>
          <div style="font-size: 12px; color: #6c757d; margin-bottom: 5px;">Crediti Totali</div>
          <div style="font-size: 24px; font-weight: bold; color: #2ecc71;">+${creditiTotali.toFixed(2)} €</div>
        </div>
        <div>
          <div style="font-size: 12px; color: #6c757d; margin-bottom: 5px;">Debiti Totali</div>
          <div style="font-size: 24px; font-weight: bold; color: #e74c3c;">${debitiTotali.toFixed(2)} €</div>
        </div>
      </div>
      <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #ecf0f1; text-align: center;">
        <div style="font-size: 12px; color: #6c757d; margin-bottom: 5px;">Bilancio</div>
        <div style="font-size: 28px; font-weight: bold; color: ${bilancioColor};">${bilancio >= 0 ? '+' : ''}${bilancio.toFixed(2)} €</div>
      </div>
    </div>
  `;
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
  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  setDateDisplay(today);
});
