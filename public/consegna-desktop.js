// ===== STATE MANAGEMENT =====

let participants = [];
let existingConsegnaMovimenti = null;
let saldiBefore = {};
let discrepanzaCassaEnabled = false;
let discrepanzaTrovataEnabled = false;
let discrepanzaPagatoProduttoreEnabled = false;

// Smart Input Manager - replaces old smart override state
let smartInputManager = null;

// ===== DATE HANDLING =====

function formatDateItalian(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// ===== DATE PICKER =====

let pickerYear = new Date().getFullYear();
let pickerMonth = new Date().getMonth();
let isPickerOpen = false;
let consegneDates = new Set();

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
    const hasConsegna = consegneDates.has(dateStr);

    let classes = 'date-picker-day';
    if (isToday) classes += ' today';
    if (isSelected) classes += ' selected';
    if (hasConsegna) classes += ' has-consegna';

    html += `<div class="${classes}" onclick="selectPickerDate('${dateStr}')">${day}</div>`;
  }
  html += '</div>';

  // Legend
  html += '<div class="date-picker-legend">';
  html += '<div class="date-picker-legend-item">';
  html += '<div class="date-picker-legend-color" style="background: #2ecc71;"></div>';
  html += '<span>Con consegna</span>';
  html += '</div>';
  html += '<div class="date-picker-legend-item">';
  html += '<div class="date-picker-legend-color" style="background: white; border: 1px solid #ddd;"></div>';
  html += '<span>Senza consegna</span>';
  html += '</div>';
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

  // Update header date display
  setDateDisplay(dateStr);

  renderDatePicker();
  checkDateData();

  // Close the date picker after selection
  toggleDatePicker();
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
      headerDateDisplay.textContent = '⚠️ ' + formatDateItalian(dateStr);
    }
  }

  // Set picker to the same month/year
  pickerYear = parseInt(year);
  pickerMonth = parseInt(month) - 1;

  // Load data for this date
  checkDateData();
}

// Deprecated calendar functions - kept for compatibility
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
    const hasConsegna = consegneDates.has(dateStr);

    let classes = 'calendar-day';
    if (isToday) classes += ' today';
    if (isSelected) classes += ' selected';
    if (hasConsegna) classes += ' has-consegna';
    else classes += ' no-consegna';

    html += `<div class="${classes}" onclick="selectDate('${dateStr}')">${day}</div>`;
  }

  html += '</div>';

  // Legend
  html += '<div class="calendar-legend">';
  html += '<div class="calendar-legend-item">';
  html += '<div class="calendar-legend-color" style="background: #2ecc71;"></div>';
  html += '<span>Con consegna</span>';
  html += '</div>';
  html += '<div class="calendar-legend-item">';
  html += '<div class="calendar-legend-color" style="background: white;"></div>';
  html += '<span>Senza consegna</span>';
  html += '</div>';
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

async function loadConsegneDates() {
  try {
    const response = await fetch('/api/storico');
    const result = await response.json();

    if (result.success) {
      consegneDates = new Set(result.consegne.map(c => c.data));
      renderCalendar();
    }
  } catch (error) {
    console.error('Error loading consegne dates:', error);
  }
}

// ===== DATA LOADING =====

async function loadData(date = null) {
  try {
    let url = '/api/participants';
    if (date) {
      const today = new Date().toISOString().split('T')[0];
      if (date !== today) {
        url += `?date=${date}`;
      }
    }

    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      participants = result.participants;
      renderParticipantSelect();
    } else {
      showStatus('Errore: ' + result.error, 'error');
    }
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

async function checkDateData() {
  const dateValue = document.getElementById('data').value;
  if (!dateValue) return;

  // Save currently selected participant
  const select = document.getElementById('participant-select');
  const selectedNome = select ? select.value : '';

  try {
    // Reload participants with saldi for the selected date
    await loadData(dateValue);

    // Load consegna data
    const response = await fetch(`/api/consegna/${dateValue}`);
    const result = await response.json();

    if (result.success && result.found) {
      loadExistingConsegna(result);
    } else {
      loadNewConsegna(result);
    }

    // Reselect participant if there was one selected
    if (selectedNome && select) {
      select.value = selectedNome;
      showParticipantForm();
    }
  } catch (error) {
    console.error('Error checking date data:', error);
  }
}

function loadExistingConsegna(result) {
  const trovatoField = document.getElementById('trovatoInCassa');
  const pagatoField = document.getElementById('pagatoProduttore');
  const lasciatoField = document.getElementById('lasciatoInCassa');

  // Load movements first (needed for calculations)
  existingConsegnaMovimenti = result.movimenti || [];
  saldiBefore = result.saldiBefore || {};

  // Reset all fields to AUTO mode first
  smartInputManager.resetAll();

  // Set stored values
  trovatoField.value = result.consegna.trovato_in_cassa || '';
  pagatoField.value = result.consegna.pagato_produttore || '';
  lasciatoField.value = result.consegna.lasciato_in_cassa || '';
  document.getElementById('noteGiornata').value = result.consegna.note || '';

  // Restore desktop override checkboxes (legacy support)
  restoreOverrideCheckbox('discrepanzaCassa', 'lasciatoInCassa',
    result.consegna.discrepanza_cassa, () => discrepanzaCassaEnabled = true, () => discrepanzaCassaEnabled = false);

  restoreOverrideCheckbox('discrepanzaCassaTrovata', 'trovatoInCassa',
    result.consegna.discrepanza_trovata, () => discrepanzaTrovataEnabled = true, () => discrepanzaTrovataEnabled = false);

  restoreOverrideCheckbox('discrepanzaPagatoProduttore', 'pagatoProduttore',
    result.consegna.discrepanza_pagato, () => discrepanzaPagatoProduttoreEnabled = true, () => discrepanzaPagatoProduttoreEnabled = false);

  // Apply MANUAL state for smart inputs where overridden
  if (result.consegna.discrepanza_trovata === 1) {
    const state = smartInputManager.getFieldState('trovato');
    if (state) {
      state.mode = 'manual';
      state.isManualOverride = true;
      state.currentValue = parseAmount(trovatoField.value);
    }
  }

  if (result.consegna.discrepanza_pagato === 1) {
    const state = smartInputManager.getFieldState('pagato');
    if (state) {
      state.mode = 'manual';
      state.isManualOverride = true;
      state.currentValue = parseAmount(pagatoField.value);
    }
  }

  if (result.consegna.discrepanza_cassa === 1) {
    const state = smartInputManager.getFieldState('lasciato');
    if (state) {
      state.mode = 'manual';
      state.isManualOverride = true;
      state.currentValue = parseAmount(lasciatoField.value);
    }
  }

  renderMovimentiGiorno();
  updateSaveButtonVisibility();
}

function loadNewConsegna(result) {
  const trovatoField = document.getElementById('trovatoInCassa');

  // Clear movements
  existingConsegnaMovimenti = null;
  saldiBefore = {};

  // Reset all fields to AUTO mode
  smartInputManager.resetAll();

  // Set trovato from previous lasciato
  const trovatoValue = result.lasciatoPrecedente ?? '';
  trovatoField.value = trovatoValue;

  // Store calculated value for trovato
  const trovatoState = smartInputManager.getFieldState('trovato');
  if (trovatoState) {
    trovatoState.calculatedValue = parseAmount(trovatoValue);
    trovatoState.currentValue = parseAmount(trovatoValue);
  }

  // Clear other fields
  document.getElementById('pagatoProduttore').value = '0.00';
  document.getElementById('lasciatoInCassa').value = '0.00';
  document.getElementById('noteGiornata').value = '';

  renderMovimentiGiorno();
  updateSaveButtonVisibility();

  // Recalculate all auto fields
  smartInputManager.recalculateAll();
}

function restoreOverrideCheckbox(checkboxId, fieldId, flagValue, enableFn, disableFn) {
  const checkbox = document.getElementById(checkboxId);
  const field = document.getElementById(fieldId);

  // Return early if elements don't exist
  if (!checkbox || !field) {
    return;
  }

  if (flagValue === 1) {
    checkbox.checked = true;
    enableFn();
    field.readOnly = false;
    field.style.cursor = 'text';
    field.style.background = '#fff';
  } else {
    checkbox.checked = false;
    disableFn();
    field.readOnly = true;
    field.style.cursor = 'not-allowed';
    field.style.background = '#f0f0f0';
  }
}

// ===== RENDERING =====

function renderParticipantSelect() {
  const select = document.getElementById('participant-select');
  select.innerHTML = '<option value="">-- Seleziona un partecipante --</option>';

  participants.forEach(p => {
    const option = document.createElement('option');
    option.value = p.nome;
    option.textContent = p.nome;
    select.appendChild(option);
  });
}

function showParticipantForm() {
  const select = document.getElementById('participant-select');
  const nome = select.value;

  const container = document.getElementById('selected-participants');
  container.innerHTML = '';

  if (!nome) {
    updateLasciatoInCassa();
    updateSaveButtonVisibility();
    return;
  }

  renderParticipant(nome);
  updateLasciatoInCassa();
  updateSaveButtonVisibility();
}

function renderMovimentiGiorno() {
  const container = document.getElementById('movimenti-giorno');

  if (!existingConsegnaMovimenti || existingConsegnaMovimenti.length === 0) {
    container.innerHTML = '';
    return;
  }

  const rows = existingConsegnaMovimenti.map((m, idx) => {
    return `
      <tr>
        <td><strong>${m.nome}</strong></td>
        <td class="text-right">${m.importo_saldato ? '€' + m.importo_saldato.toFixed(2) : ''}</td>
        <td class="text-right">${m.usa_credito ? '€' + m.usa_credito.toFixed(2) : ''}</td>
        <td class="text-right">${m.debito_lasciato ? '€' + m.debito_lasciato.toFixed(2) : ''}</td>
        <td class="text-right">${m.credito_lasciato ? '€' + m.credito_lasciato.toFixed(2) : ''}</td>
        <td class="text-right">${m.debito_saldato ? '€' + m.debito_saldato.toFixed(2) : ''}</td>
        <td>${m.note || ''}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <h3>Movimenti del Giorno</h3>
    <table class="movimenti-table">
      <thead>
        <tr>
          <th>Nome</th>
          <th class="text-right">Importo Saldato</th>
          <th class="text-right">Usa Credito</th>
          <th class="text-right">Debito Lasciato</th>
          <th class="text-right">Credito Lasciato</th>
          <th class="text-right">Debito Saldato</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderParticipant(nome) {
  const container = document.getElementById('selected-participants');
  const p = participants.find(part => part.nome === nome);
  if (!p) return;

  const saldo = saldiBefore[nome] !== undefined ? saldiBefore[nome] : (p.saldo || 0);
  const haCredito = saldo > 0;
  const haDebito = saldo < 0;

  const saldoText = saldo < 0
    ? `€${formatSaldo(saldo)}`
    : saldo > 0 ? `€${formatSaldo(saldo)}` : 'IN PARI';
  const saldoClass = saldo < 0 ? 'saldo-debito' : saldo > 0 ? 'saldo-credito' : '';

  const card = document.createElement('div');
  card.className = 'participant-card-flow';
  card.innerHTML = buildParticipantCardHTML(nome, saldo, saldoText, saldoClass, haCredito, haDebito);
  container.appendChild(card);

  addHiddenFields(card, nome, haCredito, haDebito);

  // Populate fields with existing movimento data if editing
  populateExistingMovimento(nome);
}

function populateExistingMovimento(nome) {
  if (!existingConsegnaMovimenti || existingConsegnaMovimenti.length === 0) {
    return;
  }

  const movimento = existingConsegnaMovimenti.find(m => m.nome === nome);
  if (!movimento) {
    return;
  }

  // Get current saldo for this participant
  const p = participants.find(part => part.nome === nome);
  const saldo = saldiBefore[nome] !== undefined ? saldiBefore[nome] : (p ? p.saldo || 0 : 0);

  // Populate form fields with existing values
  const fields = {
    [`contoProduttore_${nome}`]: movimento.importo_saldato || '',
    [`importo_${nome}`]: movimento.importo_saldato || '',
    [`usaCredito_${nome}`]: movimento.usa_credito || '',
    [`credito_${nome}`]: movimento.credito_lasciato || '',
    [`debito_${nome}`]: movimento.debito_lasciato || '',
    [`debitoSaldato_${nome}`]: movimento.debito_saldato || '',
    [`note_${nome}`]: movimento.note || ''
  };

  for (const [id, value] of Object.entries(fields)) {
    const field = document.getElementById(id);
    if (field && value !== '') {
      field.value = value;
    }
  }

  // Handle "usa intero credito" checkbox
  const usaCreditoField = document.getElementById(`usaCredito_${nome}`);
  const usaInteroCreditoCheckbox = document.getElementById(`usaInteroCreditoCheckbox_${nome}`);

  if (usaCreditoField && movimento.usa_credito && usaInteroCreditoCheckbox && saldo > 0) {
    // If usa_credito equals the full credit amount, check the checkbox
    if (Math.abs(movimento.usa_credito - saldo) < 0.01) {
      usaInteroCreditoCheckbox.checked = true;
      usaCreditoField.disabled = true;
    }
  }

  // Handle "salda intero debito" checkbox
  if (movimento.salda_debito_totale === 1) {
    const saldaCheckbox = document.getElementById(`saldaDebito_${nome}`);
    if (saldaCheckbox) {
      saldaCheckbox.checked = true;
      // Also disable the partial debito field if checkbox is checked
      const debitoSaldatoField = document.getElementById(`debitoSaldato_${nome}`);
      if (debitoSaldatoField) {
        debitoSaldatoField.disabled = true;
      }
    }
  }
}

function buildParticipantCardHTML(nome, saldo, saldoText, saldoClass, haCredito, haDebito) {
  return `
    <div class="flow-section">
      <div class="flow-section-title">PAGAMENTO</div>
      <div class="form-group">
        <label>Conto Produttore:</label>
        <input type="text" inputmode="decimal" id="contoProduttore_${nome}" placeholder="0.00"
               oninput="normalizeInputField(this); handleContoProduttoreInput('${nome}', ${saldo})"
               onfocus="handleInputFocus(this)">
      </div>
      <div class="form-group">
        <label>Importo saldato:</label>
        <input type="text" inputmode="decimal" id="importo_${nome}" placeholder="0.00"
               oninput="normalizeInputField(this); handleContoProduttoreInput('${nome}', ${saldo}); updateLasciatoInCassa()"
               onfocus="handleInputFocus(this)">
      </div>
    </div>

    ${haCredito ? buildCreditoSection(nome, saldo, saldoText, saldoClass) : ''}

    ${haDebito ? buildDebitoSection(nome, saldo, saldoText, saldoClass) : ''}

    <div class="flow-section">
      <div class="flow-section-title">NUOVO SALDO</div>
      <div class="row">
        <div class="form-group">
          <label>Lascia credito:</label>
          <input type="text" inputmode="decimal" id="credito_${nome}" placeholder="0.00"
                 oninput="normalizeInputField(this); delete this.dataset.autoCalculated; handleCreditoDebitoInput('${nome}', ${saldo})"
                 onfocus="handleInputFocus(this)">
        </div>
        <div class="form-group">
          <label>Lascia debito:</label>
          <input type="text" inputmode="decimal" id="debito_${nome}" placeholder="0.00"
                 oninput="normalizeInputField(this); delete this.dataset.autoCalculated; handleCreditoDebitoInput('${nome}', ${saldo})"
                 onfocus="handleInputFocus(this)">
        </div>
      </div>
    </div>

    <div class="flow-section">
      <div class="form-group">
        <label>Note:</label>
        <input type="text" id="note_${nome}" placeholder="Note aggiuntive">
      </div>
    </div>
  `;
}

function buildCreditoSection(nome, saldo, saldoText, saldoClass) {
  return `
    <div class="flow-section flow-credito">
      <div class="flow-section-title">
        <span>CREDITO <span class="saldo-info ${saldoClass}">${saldoText}</span></span>
      </div>
      <div class="checkbox-group">
        <input type="checkbox" id="usaInteroCreditoCheckbox_${nome}" onchange="toggleUsaInteroCredito('${nome}', ${saldo})">
        <label for="usaInteroCreditoCheckbox_${nome}">Usa intero credito</label>
      </div>
      <div class="form-group">
        <label>Usa credito parziale:</label>
        <input type="text" inputmode="decimal" id="usaCredito_${nome}" placeholder="0.00"
               oninput="normalizeInputField(this); validateCreditoMax('${nome}', ${saldo}); handleContoProduttoreInput('${nome}', ${saldo}); handleCreditoDebitoInput('${nome}', ${saldo})"
               onfocus="handleInputFocus(this)">
      </div>
    </div>
  `;
}

function buildDebitoSection(nome, saldo, saldoText, saldoClass) {
  return `
    <div class="flow-section flow-debito">
      <div class="flow-section-title">
        <span>DEBITO <span class="saldo-info ${saldoClass}">${saldoText}</span></span>
      </div>
      <div class="checkbox-group">
        <input type="checkbox" id="saldaDebito_${nome}" onchange="toggleSaldaDebito('${nome}', ${saldo})">
        <label for="saldaDebito_${nome}">Salda intero debito</label>
      </div>
      <div class="form-group">
        <label>Salda parziale:</label>
        <input type="text" inputmode="decimal" id="debitoSaldato_${nome}" placeholder="0.00"
               oninput="normalizeInputField(this); handleContoProduttoreInput('${nome}', ${saldo}); handleCreditoDebitoInput('${nome}', ${saldo})"
               onfocus="handleInputFocus(this)">
      </div>
    </div>
  `;
}

function addHiddenFields(card, nome, haCredito, haDebito) {
  if (!haCredito) {
    card.appendChild(createHiddenInput(`usaCredito_${nome}`, '0'));
  }
  if (!haDebito) {
    card.appendChild(createHiddenInput(`debitoSaldato_${nome}`, '0'));
  }
}

function createHiddenInput(id, value) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.id = id;
  input.value = value;
  return input;
}

// ===== CHECKBOX TOGGLE FUNCTIONS =====

function toggleUsaInteroCredito(nome, saldo) {
  const checkbox = document.getElementById(`usaInteroCreditoCheckbox_${nome}`);
  const usaCreditoField = document.getElementById(`usaCredito_${nome}`);

  if (checkbox && usaCreditoField) {
    if (checkbox.checked) {
      usaCreditoField.disabled = true;
      usaCreditoField.value = saldo;
    } else {
      usaCreditoField.disabled = false;
      usaCreditoField.value = '';
    }
  }

  handleCreditoDebitoInput(nome, saldo);
}

function toggleSaldaDebito(nome, saldo) {
  const checkbox = document.getElementById(`saldaDebito_${nome}`);
  const debitoField = document.getElementById(`debitoSaldato_${nome}`);

  if (checkbox && debitoField) {
    if (checkbox.checked) {
      debitoField.disabled = true;
      debitoField.value = Math.abs(saldo);
    } else {
      debitoField.disabled = false;
      debitoField.value = '';
    }
  }

  if (!saldo) {
    const p = participants.find(part => part.nome === nome);
    saldo = saldiBefore[nome] !== undefined ? saldiBefore[nome] : (p ? p.saldo || 0 : 0);
  }

  handleCreditoDebitoInput(nome, saldo);
}

// ===== SMART INPUT MANAGER SETUP =====

function initSmartInputs() {
  // Create smart input manager instance
  smartInputManager = new SmartInputManager({
    blurDebounceMs: 150,
    comparisonThreshold: 0.01
  });

  // Initialize three cash fields
  smartInputManager.initField(
    'trovato',
    document.getElementById('trovatoInCassa'),
    () => {
      // Trovato calculation: from previous lasciato (set externally)
      const state = smartInputManager.getFieldState('trovato');
      return state ? state.calculatedValue : null;
    }
  );

  smartInputManager.initField(
    'pagato',
    document.getElementById('pagatoProduttore'),
    () => {
      // Pagato calculation: sum from movements
      let totalPagato = 0;
      if (existingConsegnaMovimenti && existingConsegnaMovimenti.length > 0) {
        existingConsegnaMovimenti.forEach(m => {
          totalPagato += (m.importo_saldato || 0);
          totalPagato += (m.usa_credito || 0);
          totalPagato += (m.debito_lasciato || 0);
          totalPagato -= (m.credito_lasciato || 0);
          totalPagato -= (m.debito_saldato || 0);
        });
      }
      return roundUpCents(totalPagato);
    }
  );

  smartInputManager.initField(
    'lasciato',
    document.getElementById('lasciatoInCassa'),
    () => {
      // Lasciato calculation: trovato + incassato - pagato
      const trovatoInCassa = parseAmount(document.getElementById('trovatoInCassa').value);
      const pagatoProduttore = parseAmount(document.getElementById('pagatoProduttore').value);

      let incassato = 0;
      if (existingConsegnaMovimenti && existingConsegnaMovimenti.length > 0) {
        existingConsegnaMovimenti.forEach(m => {
          incassato += (m.importo_saldato || 0);
        });
      }

      return roundUpCents(trovatoInCassa + incassato - pagatoProduttore);
    }
  );

  // Listen to save button visibility events
  smartInputManager.on('saveRequired', (data) => {
    updateSaveButtonVisibility();
  });

  // Listen to state changes for recalculation triggers
  smartInputManager.on('stateChange', (data) => {
    if (data.fieldId === 'trovato') {
      smartInputManager.updateField('lasciato');
    } else if (data.fieldId === 'pagato') {
      smartInputManager.updateField('lasciato');
    }
  });
}

// ===== PARTICIPANT INTERACTION =====

function validateCreditoMax(nome, saldo) {
  const usaCreditoField = document.getElementById(`usaCredito_${nome}`);
  if (!usaCreditoField) return;

  const value = parseAmount(usaCreditoField.value);
  if (value > saldo) {
    usaCreditoField.value = saldo;
    showStatus(`Non puoi usare più di €${formatSaldo(saldo)} di credito`, 'error');
  }
}

function handleCreditoDebitoInput(nome, saldo) {
  const creditoLasciato = document.getElementById(`credito_${nome}`);
  const debitoLasciato = document.getElementById(`debito_${nome}`);
  const debitoSaldato = document.getElementById(`debitoSaldato_${nome}`);
  const usaCredito = document.getElementById(`usaCredito_${nome}`);

  const creditoValue = creditoLasciato ? parseAmount(creditoLasciato.value) : 0;
  const debitoValue = debitoLasciato ? parseAmount(debitoLasciato.value) : 0;
  const usaCreditoValue = usaCredito ? parseAmount(usaCredito.value) : 0;
  const debitoSaldatoValue = debitoSaldato ? parseAmount(debitoSaldato.value) : 0;

  const creditoDisponibile = saldo > 0 ? saldo : 0;
  const usaCreditoParziale = usaCreditoValue > 0 && usaCreditoValue < creditoDisponibile;
  const saldaDebito = debitoSaldatoValue > 0;

  // Reset: enable all fields
  [creditoLasciato, debitoLasciato, debitoSaldato].forEach(el => {
    if (el) el.disabled = false;
  });

  // Apply business rules
  if (usaCreditoValue > 0 && creditoLasciato) {
    creditoLasciato.disabled = true;
    creditoLasciato.value = '';
  }

  if (usaCreditoParziale && debitoLasciato) {
    debitoLasciato.disabled = true;
    debitoLasciato.value = '';
  }

  if (saldaDebito && debitoLasciato) {
    debitoLasciato.disabled = true;
    debitoLasciato.value = '';
  }

  if (creditoValue > 0 && debitoLasciato) {
    debitoLasciato.disabled = true;
    debitoLasciato.value = '';
  }

  if (debitoValue > 0 && creditoLasciato) {
    creditoLasciato.disabled = true;
    creditoLasciato.value = '';
  }
}

function handleContoProduttoreInput(nome, saldo) {
  const contoProduttore = document.getElementById(`contoProduttore_${nome}`);
  const importoSaldato = document.getElementById(`importo_${nome}`);
  const usaCredito = document.getElementById(`usaCredito_${nome}`);
  const debitoSaldato = document.getElementById(`debitoSaldato_${nome}`);
  const creditoLasciato = document.getElementById(`credito_${nome}`);
  const debitoLasciato = document.getElementById(`debito_${nome}`);

  if (!contoProduttore || !importoSaldato) return;

  const contoProduttoreValue = parseAmount(contoProduttore.value);
  const importoSaldatoValue = parseAmount(importoSaldato.value);
  const usaCreditoValue = usaCredito ? parseAmount(usaCredito.value) : 0;
  const debitoSaldatoValue = debitoSaldato ? parseAmount(debitoSaldato.value) : 0;

  // Only auto-calculate if we have an importo_saldato value
  if (importoSaldatoValue === 0 && usaCreditoValue === 0 && debitoSaldatoValue === 0) {
    return;
  }

  // Formula: conto_produttore = importo_saldato + usa_credito + debito_lasciato - credito_lasciato - debito_saldato
  // Rearranged: diff = importo_saldato + usa_credito - debito_saldato - conto_produttore
  // If diff > 0: credito_lasciato = diff
  // If diff < 0: debito_lasciato = -diff
  // If diff = 0: in pari

  const diff = importoSaldatoValue + usaCreditoValue - debitoSaldatoValue - contoProduttoreValue;

  // Check if credito/debito fields have been manually modified by user (not auto-calculated)
  const creditoIsManual = creditoLasciato && creditoLasciato.dataset.autoCalculated !== 'true' && creditoLasciato.value && !creditoLasciato.disabled;
  const debitoIsManual = debitoLasciato && debitoLasciato.dataset.autoCalculated !== 'true' && debitoLasciato.value && !debitoLasciato.disabled;

  // Don't auto-fill if user has manually entered values
  if (creditoIsManual || debitoIsManual) {
    return;
  }

  // Auto-fill based on calculation
  if (diff > 0) {
    // Leaving credit
    if (creditoLasciato && !creditoLasciato.disabled) {
      creditoLasciato.value = roundUpCents(diff);
      creditoLasciato.dataset.autoCalculated = 'true';
    }
    if (debitoLasciato && !debitoLasciato.disabled) {
      debitoLasciato.value = '';
      delete debitoLasciato.dataset.autoCalculated;
    }
  } else if (diff < 0) {
    // Leaving debt
    if (debitoLasciato && !debitoLasciato.disabled) {
      debitoLasciato.value = roundUpCents(-diff);
      debitoLasciato.dataset.autoCalculated = 'true';
    }
    if (creditoLasciato && !creditoLasciato.disabled) {
      creditoLasciato.value = '';
      delete creditoLasciato.dataset.autoCalculated;
    }
  } else {
    // In pari
    if (creditoLasciato && !creditoLasciato.disabled) {
      creditoLasciato.value = '';
      delete creditoLasciato.dataset.autoCalculated;
    }
    if (debitoLasciato && !debitoLasciato.disabled) {
      debitoLasciato.value = '';
      delete debitoLasciato.dataset.autoCalculated;
    }
  }

  // Trigger credito/debito validation
  handleCreditoDebitoInput(nome, saldo);
}

// ===== CALCULATIONS =====

function updatePagatoProduttore() {
  // Recalculate pagato field using smart input manager
  if (discrepanzaPagatoProduttoreEnabled) return;
  if (smartInputManager) {
    smartInputManager.updateField('pagato');
  }
}

function updateLasciatoInCassa() {
  // Recalculate lasciato field using smart input manager
  if (discrepanzaCassaEnabled) return;
  if (smartInputManager) {
    smartInputManager.updateField('lasciato');
  }
}

// ===== SAVE DATA =====

async function saveData() {
  const data = document.getElementById('data').value;
  const trovatoInCassa = roundUpCents(parseAmount(document.getElementById('trovatoInCassa').value));
  const pagatoProduttore = roundUpCents(parseAmount(document.getElementById('pagatoProduttore').value));
  const noteGiornata = document.getElementById('noteGiornata').value || '';

  if (!data) {
    showStatus('Inserisci la data', 'error');
    return;
  }

  const select = document.getElementById('participant-select');
  const currentNome = select.value;

  if (!currentNome) {
    await saveCassaOnly();
    return;
  }

  const debitoLasciato = parseAmount(document.getElementById(`debito_${currentNome}`).value);
  const creditoLasciato = parseAmount(document.getElementById(`credito_${currentNome}`).value);

  if (debitoLasciato > 0 && creditoLasciato > 0) {
    showStatus(`Errore: non puoi lasciare sia credito che debito contemporaneamente`, 'error');
    return;
  }

  await saveWithParticipant(data, trovatoInCassa, pagatoProduttore, noteGiornata, currentNome);
}

async function saveCassaOnly() {
  // Read values from DOM
  const data = document.getElementById('data').value;
  const trovatoInCassa = roundUpCents(parseAmount(document.getElementById('trovatoInCassa').value));
  const pagatoProduttore = roundUpCents(parseAmount(document.getElementById('pagatoProduttore').value));
  const noteGiornata = document.getElementById('noteGiornata').value || '';

  if (!data) {
    showStatus('Inserisci la data', 'error');
    return;
  }

  showStatus('Salvataggio dati cassa in corso...', 'success');

  // Always read from DOM
  let lasciatoInCassa = roundUpCents(parseAmount(document.getElementById('lasciatoInCassa').value));

  // Check for overrides using smart input manager OR legacy checkboxes
  const discrepanzaTrovata = (smartInputManager.hasSignificantOverride('trovato') || discrepanzaTrovataEnabled);
  const discrepanzaPagato = (smartInputManager.hasSignificantOverride('pagato') || discrepanzaPagatoProduttoreEnabled);
  const discrepanzaCassa = (smartInputManager.hasSignificantOverride('lasciato') || discrepanzaCassaEnabled);

  try {
    const response = await fetch('/api/consegna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data, trovatoInCassa, pagatoProduttore, lasciatoInCassa,
        discrepanzaCassa,
        discrepanzaTrovata,
        discrepanzaPagato,
        noteGiornata,
        partecipanti: [],
      }),
    });

    const result = await response.json();

    if (result.success) {
      showStatus('Dati cassa salvati con successo!', 'success');
      setTimeout(() => checkDateData(), 1000);
    } else {
      showStatus('Errore: ' + result.error, 'error');
    }
  } catch (error) {
    showStatus('Errore durante il salvataggio: ' + error.message, 'error');
  }
}

async function saveWithParticipant(data, trovatoInCassa, pagatoProduttore, noteGiornata, currentNome) {
  showStatus('Salvataggio in corso...', 'success');

  const p = participants.find(part => part.nome === currentNome);
  if (!p) {
    showStatus('Partecipante non trovato', 'error');
    return;
  }

  const importoSaldato = roundUpCents(parseAmount(document.getElementById(`importo_${currentNome}`).value));
  const usaCredito = roundUpCents(parseAmount(document.getElementById(`usaCredito_${currentNome}`)?.value || '0'));
  const debitoLasciato = roundUpCents(parseAmount(document.getElementById(`debito_${currentNome}`).value));
  const creditoLasciato = roundUpCents(parseAmount(document.getElementById(`credito_${currentNome}`).value));
  const debitoSaldato = roundUpCents(parseAmount(document.getElementById(`debitoSaldato_${currentNome}`)?.value || '0'));
  const saldaDebitoTotale = document.getElementById(`saldaDebito_${currentNome}`)?.checked || false;
  const note = document.getElementById(`note_${currentNome}`).value || '';

  let saldoCorrente = saldiBefore[currentNome] !== undefined ? saldiBefore[currentNome] : (p.saldo || 0);

  if (usaCredito > 0) saldoCorrente -= usaCredito;

  if (saldaDebitoTotale && saldoCorrente < 0) {
    saldoCorrente = 0;
  } else if (debitoSaldato > 0 && saldoCorrente < 0) {
    saldoCorrente = Math.min(0, saldoCorrente + debitoSaldato);
  }

  if (debitoLasciato > 0) saldoCorrente -= debitoLasciato;
  if (creditoLasciato > 0) saldoCorrente += creditoLasciato;

  const partecipantiData = [{
    nome: currentNome,
    saldaTutto: false,
    importoSaldato, usaCredito, debitoLasciato, creditoLasciato,
    saldaDebitoTotale, debitoSaldato, note,
    nuovoSaldo: roundUpCents(saldoCorrente)
  }];

  // Always read from DOM
  let lasciatoInCassa = roundUpCents(parseAmount(document.getElementById('lasciatoInCassa').value));

  // Check for overrides using smart input manager OR legacy checkboxes
  const discrepanzaTrovata = (smartInputManager.hasSignificantOverride('trovato') || discrepanzaTrovataEnabled);
  const discrepanzaPagato = (smartInputManager.hasSignificantOverride('pagato') || discrepanzaPagatoProduttoreEnabled);
  const discrepanzaCassa = (smartInputManager.hasSignificantOverride('lasciato') || discrepanzaCassaEnabled);

  try {
    const response = await fetch('/api/consegna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data, trovatoInCassa, pagatoProduttore, lasciatoInCassa,
        discrepanzaCassa,
        discrepanzaTrovata,
        discrepanzaPagato,
        noteGiornata,
        partecipanti: partecipantiData,
      }),
    });

    const result = await response.json();

    if (result.success) {
      showStatus('Dati salvati con successo!', 'success');
      setTimeout(() => {
        document.getElementById('selected-participants').innerHTML = '';
        document.getElementById('participant-select').value = '';
        checkDateData();
        updateSaveButtonVisibility();
      }, 1000);
    } else {
      showStatus('Errore: ' + result.error, 'error');
    }
  } catch (error) {
    showStatus('Errore durante il salvataggio: ' + error.message, 'error');
  }
}

// ===== BUTTON VISIBILITY =====

function updateSaveButtonVisibility() {
  const saveBtnCassa = document.getElementById('save-btn-cassa');
  const saveBtnParticipant = document.getElementById('save-btn-participant');

  if (!saveBtnCassa || !saveBtnParticipant) return;

  const hasManualCashInput = smartInputManager &&
    Object.keys(smartInputManager.getManualOverrides()).length > 0;
  const hasParticipantSelected = document.getElementById('participant-select')?.value !== '';

  // Show button in appropriate section
  if (hasParticipantSelected) {
    // Show button under participant section
    saveBtnCassa.style.display = 'none';
    saveBtnParticipant.style.display = 'block';
  } else if (hasManualCashInput) {
    // Show button under cash section
    saveBtnCassa.style.display = 'block';
    saveBtnParticipant.style.display = 'none';
  } else {
    // Hide both buttons
    saveBtnCassa.style.display = 'none';
    saveBtnParticipant.style.display = 'none';
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize smart input manager
  initSmartInputs();

  // Set initial date (last consegna or today)
  try {
    const response = await fetch('/api/storico');
    const result = await response.json();

    if (result.success && result.consegne.length > 0) {
      // Populate consegneDates Set for calendar indicators
      consegneDates = new Set(result.consegne.map(c => c.data));
      setDateDisplay(result.consegne[0].data);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setDateDisplay(today);
    }
  } catch (error) {
    console.error('Error loading last date:', error);
    const today = new Date().toISOString().split('T')[0];
    setDateDisplay(today);
  }

  loadData();
});

// ===== CLICK OUTSIDE HANDLER =====

// Close date picker when clicking outside
document.addEventListener('click', function(event) {
  if (!isPickerOpen) return;

  const pickerContainer = document.getElementById('date-picker-container');
  const dateButton = document.querySelector('.change-date-btn');

  // Check if click is outside picker and not on the button
  if (pickerContainer && dateButton) {
    const isClickInsidePicker = pickerContainer.contains(event.target);
    const isClickOnButton = dateButton.contains(event.target);

    if (!isClickInsidePicker && !isClickOnButton) {
      toggleDatePicker();
    }
  }
});
