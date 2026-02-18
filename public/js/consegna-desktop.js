// ===== STATE MANAGEMENT =====

let participants = [];
let existingConsegnaMovimenti = null;
let saldiBefore = {};
let noteGiornataModified = false;
let originalNoteGiornata = '';

// Consegna status tracking
let currentConsegnaId = null;
let isConsegnaClosed = false;

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
  html += `<button type="button" class="date-picker-nav" onclick="changePickerMonth(-1, event)">◀</button>`;
  html += `<div class="date-picker-month">${monthNames[pickerMonth]} ${pickerYear}</div>`;
  html += `<button type="button" class="date-picker-nav" onclick="changePickerMonth(1, event)">▶</button>`;
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

  // Legend (only show if we have consegne dates)
  if (consegneDates.size > 0) {
    html += '<div class="date-picker-legend">';
    html += '<div class="date-picker-legend-item">';
    html += '<div class="date-picker-legend-color" style="background: #2ecc71;"></div>';
    html += '<span>Con consegna</span>';
    html += '</div>';
    html += '</div>';
  }

  container.innerHTML = html;
}

function changePickerMonth(delta, event) {
  if (event) {
    event.stopPropagation();
  }
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

  // Save to sessionStorage for tab navigation
  sessionStorage.setItem('gass_selected_date', dateStr);

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

    // Close any open participant form when date changes
    const container = document.getElementById('selected-participants');
    if (container) container.innerHTML = '';

    const select = document.getElementById('participant-select');
    if (select) select.value = '';
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

  // Set stored values with formatting
  trovatoField.value = formatNumber(result.consegna.trovato_in_cassa || 0);
  pagatoField.value = formatNumber(result.consegna.pagato_produttore || 0);
  lasciatoField.value = formatNumber(result.consegna.lasciato_in_cassa || 0);

  // Store original note value for change detection
  originalNoteGiornata = result.consegna.note || '';
  document.getElementById('noteGiornata').value = originalNoteGiornata;
  noteGiornataModified = false;

  renderMovimentiGiorno();
  updateSaveButtonVisibility();

  // Update consegna status (closed/open)
  updateConsegnaStatusUI(result.consegna);
}

function loadNewConsegna(result) {
  const trovatoField = document.getElementById('trovatoInCassa');
  const pagatoField = document.getElementById('pagatoProduttore');
  const lasciatoField = document.getElementById('lasciatoInCassa');

  // Clear movements
  existingConsegnaMovimenti = [];
  saldiBefore = result.saldiBefore || {};

  // Set trovato from previous lasciato
  const trovatoValue = result.lasciatoPrecedente ?? 0;
  trovatoField.value = formatNumber(trovatoValue);

  // Initialize other fields to 0
  pagatoField.value = formatNumber(0);
  lasciatoField.value = formatNumber(trovatoValue); // lasciato = trovato when no movements

  // Reset note tracking
  originalNoteGiornata = '';
  document.getElementById('noteGiornata').value = '';
  noteGiornataModified = false;

  renderMovimentiGiorno();
  updateSaveButtonVisibility();

  // No consegna exists yet - hide status section
  updateConsegnaStatusUI(null);
}


// ===== RENDERING =====

function renderParticipantSelect() {
  const select = document.getElementById('participant-select');
  select.innerHTML = '<option value="">-- Seleziona un partecipante --</option>';

  participants.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.nome;
    select.appendChild(option);
  });
}

function showParticipantForm() {
  const select = document.getElementById('participant-select');
  const id = parseInt(select.value);

  const container = document.getElementById('selected-participants');
  container.innerHTML = '';

  if (!id) {
    updateLasciatoInCassa();
    updateSaveButtonVisibility();
    return;
  }

  renderParticipant(id);
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
        <td><strong>${escapeHtml(m.nome)}</strong></td>
        <td class="text-right">${m.conto_produttore ? '€' + formatNumber(m.conto_produttore) : ''}</td>
        <td class="text-right">${m.importo_saldato ? '€' + formatNumber(m.importo_saldato) : ''}</td>
        <td class="text-right">${m.credito_lasciato ? '€' + formatNumber(m.credito_lasciato) : ''}</td>
        <td class="text-right">${m.debito_lasciato ? '€' + formatNumber(m.debito_lasciato) : ''}</td>
        <td class="text-right">${m.usa_credito ? '€' + formatNumber(m.usa_credito) : ''}</td>
        <td class="text-right">${m.debito_saldato ? '€' + formatNumber(m.debito_saldato) : ''}</td>
        <td>${escapeHtml(m.note || '')}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <h3>Movimenti del Giorno</h3>
    <table class="movimenti-table">
      <thead>
        <tr>
          <th>Nome</th>
          <th class="text-right">Conto Produttore</th>
          <th class="text-right">Importo Saldato</th>
          <th class="text-right">Lascia Credito</th>
          <th class="text-right">Lascia Debito</th>
          <th class="text-right">Usa Credito</th>
          <th class="text-right">Salda Debito</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderParticipant(id) {
  const container = document.getElementById('selected-participants');
  const p = participants.find(part => part.id === id);
  if (!p) return;

  const saldo = saldiBefore[id] !== undefined ? saldiBefore[id] : (p.saldo || 0);
  const haCredito = saldo > 0;
  const haDebito = saldo < 0;

  const saldoText = saldo < 0
    ? `€${formatSaldo(saldo)}`
    : saldo > 0 ? `€${formatSaldo(saldo)}` : 'IN PARI';
  const saldoClass = saldo < 0 ? 'saldo-debito' : saldo > 0 ? 'saldo-credito' : '';

  const card = document.createElement('div');
  card.className = 'participant-card-flow';
  card.innerHTML = buildParticipantCardHTML(id, p.nome, saldo, saldoText, saldoClass, haCredito, haDebito);
  addHiddenFields(card, id, haCredito, haDebito);
  container.appendChild(card);

  // Populate fields with existing movimento data if editing
  populateExistingMovimento(id);
}

function populateExistingMovimento(id) {
  if (!existingConsegnaMovimenti || existingConsegnaMovimenti.length === 0) {
    return;
  }

  const movimento = existingConsegnaMovimenti.find(m => m.partecipante_id === id);
  if (!movimento) {
    return;
  }

  // Get current saldo for this participant
  const p = participants.find(part => part.id === id);
  const saldo = saldiBefore[id] !== undefined ? saldiBefore[id] : (p ? p.saldo || 0 : 0);

  // Populate form fields with existing values
  const fields = {
    [`contoProduttore_${id}`]: movimento.conto_produttore || '',
    [`importo_${id}`]: movimento.importo_saldato || '',
    [`usaCredito_${id}`]: movimento.usa_credito || '',
    [`credito_${id}`]: movimento.credito_lasciato || '',
    [`debito_${id}`]: movimento.debito_lasciato || '',
    [`debitoSaldato_${id}`]: movimento.debito_saldato || '',
    [`note_${id}`]: movimento.note || ''
  };

  for (const [fieldId, value] of Object.entries(fields)) {
    const field = document.getElementById(fieldId);
    if (field && value !== '') {
      field.value = value;
      // All compensation fields are always disabled - system-managed
      if (fieldId.includes('usaCredito_') || fieldId.includes('debitoSaldato_')) {
        field.disabled = true;
      }
    }
  }

  // Handle "usa intero credito" checkbox
  const usaCreditoField = document.getElementById(`usaCredito_${id}`);
  const usaInteroCreditoCheckbox = document.getElementById(`usaInteroCreditoCheckbox_${id}`);

  if (usaCreditoField && movimento.usa_credito && usaInteroCreditoCheckbox && saldo > 0) {
    // If usa_credito equals the full credit amount, check the checkbox
    if (Math.abs(movimento.usa_credito - saldo) < 0.01) {
      usaInteroCreditoCheckbox.checked = true;
      usaCreditoField.disabled = true;
    }
  }

  // Handle "salda intero debito" checkbox
  if (movimento.salda_debito_totale === 1) {
    const saldaCheckbox = document.getElementById(`saldaDebito_${id}`);
    if (saldaCheckbox) {
      saldaCheckbox.checked = true;
      // Also disable the partial debito field if checkbox is checked
      const debitoSaldatoField = document.getElementById(`debitoSaldato_${id}`);
      if (debitoSaldatoField) {
        debitoSaldatoField.disabled = true;
      }
    }
  }
}

function buildParticipantCardHTML(id, nome, saldo, saldoText, saldoClass, haCredito, haDebito) {
  return `
    <div class="flow-section">
      <div class="flow-section-title">PAGAMENTO</div>
      <div class="form-group">
        <label>Conto Produttore:</label>
        <input type="text" inputmode="decimal" id="contoProduttore_${id}" placeholder="0.00"
               oninput="normalizeInputField(this); handleContoProduttoreInput(${id}, ${saldo})"
               onfocus="handleInputFocus(this)">
      </div>
      <div class="form-group">
        <label>Importo saldato:</label>
        <input type="text" inputmode="decimal" id="importo_${id}" placeholder="0.00"
               oninput="normalizeInputField(this); handleContoProduttoreInput(${id}, ${saldo}); updateLasciatoInCassa()"
               onfocus="handleInputFocus(this)">
      </div>
    </div>

    ${haCredito ? buildCreditoSection(id, nome, saldo, saldoText, saldoClass) : ''}

    ${haDebito ? buildDebitoSection(id, nome, saldo, saldoText, saldoClass) : ''}

    <div class="flow-section">
      <div class="row">
        <div class="form-group">
          <label>Lascia credito:</label>
          <input type="text" inputmode="decimal" id="credito_${id}" placeholder="0.00" disabled
                 oninput="normalizeInputField(this); delete this.dataset.autoCalculated; handleCreditoDebitoInput(${id}, ${saldo})"
                 onfocus="handleInputFocus(this)">
        </div>
        <div class="form-group">
          <label>Lascia debito:</label>
          <input type="text" inputmode="decimal" id="debito_${id}" placeholder="0.00" disabled
                 oninput="normalizeInputField(this); delete this.dataset.autoCalculated; handleCreditoDebitoInput(${id}, ${saldo})"
                 onfocus="handleInputFocus(this)">
        </div>
      </div>
    </div>

    <div class="flow-section">
      <div class="form-group">
        <label>Note:</label>
        <input type="text" id="note_${id}" placeholder="Note aggiuntive">
      </div>
    </div>

    <div class="flow-section" style="text-align: center; display: flex; gap: 10px; justify-content: center;">
      <button type="submit" class="btn-save" id="save-btn-participant-inline">
        💾 Salva Movimento
      </button>
      <button type="button" class="btn-secondary" onclick="clearParticipantForm()">
        Annulla
      </button>
    </div>
  `;
}

function buildCreditoSection(id, nome, saldo, saldoText, saldoClass) {
  return `
    <div class="flow-section flow-credito">
      <div class="flow-section-title">
        <span>CREDITO <span class="saldo-info ${saldoClass}">${escapeHtml(saldoText)}</span></span>
      </div>
      <div class="checkbox-group">
        <input type="checkbox" id="usaInteroCreditoCheckbox_${id}" onchange="toggleUsaInteroCredito(${id}, ${saldo})">
        <label for="usaInteroCreditoCheckbox_${id}">Usa intero credito</label>
      </div>
      <div class="form-group">
        <label>Usa credito parziale:</label>
        <input type="text" inputmode="decimal" id="usaCredito_${id}" placeholder="0.00" disabled
               oninput="normalizeInputField(this); validateCreditoMax(${id}, ${saldo}); handleContoProduttoreInput(${id}, ${saldo}); handleCreditoDebitoInput(${id}, ${saldo})"
               onfocus="handleInputFocus(this)">
      </div>
    </div>
  `;
}

function buildDebitoSection(id, nome, saldo, saldoText, saldoClass) {
  return `
    <div class="flow-section flow-debito">
      <div class="flow-section-title">
        <span>DEBITO <span class="saldo-info ${saldoClass}">${escapeHtml(saldoText)}</span></span>
      </div>
      <div class="checkbox-group">
        <input type="checkbox" id="saldaDebito_${id}" onchange="toggleSaldaDebito(${id}, ${saldo})">
        <label for="saldaDebito_${id}">Salda intero debito</label>
      </div>
      <div class="form-group">
        <label>Salda parziale:</label>
        <input type="text" inputmode="decimal" id="debitoSaldato_${id}" placeholder="0.00" disabled
               oninput="normalizeInputField(this); handleContoProduttoreInput(${id}, ${saldo}); handleCreditoDebitoInput(${id}, ${saldo})"
               onfocus="handleInputFocus(this)">
      </div>
    </div>
  `;
}

function addHiddenFields(card, id, haCredito, haDebito) {
  if (!haCredito) {
    card.appendChild(createHiddenInput(`usaCredito_${id}`, '0'));
  }
  if (!haDebito) {
    card.appendChild(createHiddenInput(`debitoSaldato_${id}`, '0'));
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

function toggleUsaInteroCredito(id, saldo) {
  const checkbox = document.getElementById(`usaInteroCreditoCheckbox_${id}`);
  const usaCreditoField = document.getElementById(`usaCredito_${id}`);

  if (checkbox && usaCreditoField) {
    if (checkbox.checked) {
      usaCreditoField.disabled = true;
      usaCreditoField.value = saldo;
    } else {
      usaCreditoField.disabled = false;
      usaCreditoField.value = '';
    }
  }

  // Trigger auto-calculation with new usaCredito value
  handleContoProduttoreInput(id, saldo);
  handleCreditoDebitoInput(id, saldo);
}

function toggleSaldaDebito(id, saldo) {
  const checkbox = document.getElementById(`saldaDebito_${id}`);
  const debitoField = document.getElementById(`debitoSaldato_${id}`);

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
    const p = participants.find(part => part.id === id);
    saldo = saldiBefore[id] !== undefined ? saldiBefore[id] : (p ? p.saldo || 0 : 0);
  }

  // Trigger auto-calculation with new debitoSaldato value
  handleContoProduttoreInput(id, saldo);
  handleCreditoDebitoInput(id, saldo);
}

// ===== CASSA CALCULATIONS =====

function calculatePagatoProduttore() {
  let totalPagato = 0;
  if (existingConsegnaMovimenti && existingConsegnaMovimenti.length > 0) {
    existingConsegnaMovimenti.forEach(m => {
      totalPagato += (m.conto_produttore || 0);
    });
  }
  return roundUpCents(totalPagato);
}

function calculateLasciatoInCassa() {
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

function updatePagatoProduttore() {
  const pagatoField = document.getElementById('pagatoProduttore');
  const calculatedValue = calculatePagatoProduttore();
  pagatoField.value = formatNumber(calculatedValue);
}

function updateLasciatoInCassa() {
  const lasciatoField = document.getElementById('lasciatoInCassa');
  const calculatedValue = calculateLasciatoInCassa();
  lasciatoField.value = formatNumber(calculatedValue);
}

// ===== PARTICIPANT INTERACTION =====

function validateCreditoMax(id, saldo) {
  const usaCreditoField = document.getElementById(`usaCredito_${id}`);
  if (!usaCreditoField) return;

  const value = parseAmount(usaCreditoField.value);
  if (value > saldo) {
    usaCreditoField.value = saldo;
    showStatus(`Non puoi usare più di €${formatSaldo(saldo)} di credito`, 'error');
  }
}

function handleCreditoDebitoInput(id, saldo) {
  // Credit/debt fields are now always disabled and auto-calculated
  // This function only enforces that all 4 fields are always disabled
  const creditoLasciato = document.getElementById(`credito_${id}`);
  const debitoLasciato = document.getElementById(`debito_${id}`);
  const usaCredito = document.getElementById(`usaCredito_${id}`);
  const debitoSaldato = document.getElementById(`debitoSaldato_${id}`);

  // All compensation and result fields are always disabled - system-managed only
  if (creditoLasciato) creditoLasciato.disabled = true;
  if (debitoLasciato) debitoLasciato.disabled = true;
  if (usaCredito) usaCredito.disabled = true;
  if (debitoSaldato) debitoSaldato.disabled = true;
}

function handleContoProduttoreInput(id, saldo) {
  const contoProduttore = document.getElementById(`contoProduttore_${id}`);
  const importoSaldato = document.getElementById(`importo_${id}`);
  const usaCredito = document.getElementById(`usaCredito_${id}`);
  const debitoSaldato = document.getElementById(`debitoSaldato_${id}`);
  const creditoLasciato = document.getElementById(`credito_${id}`);
  const debitoLasciato = document.getElementById(`debito_${id}`);

  if (!contoProduttore || !importoSaldato) return;

  const contoProduttoreValue = parseAmount(contoProduttore.value);
  const importoSaldatoValue = parseAmount(importoSaldato.value);
  const usaCreditoValue = usaCredito ? parseAmount(usaCredito.value) : 0;
  const debitoSaldatoValue = debitoSaldato ? parseAmount(debitoSaldato.value) : 0;

  // Only auto-calculate if we have any payment-related value
  // Skip only if ALL values are zero AND conto_produttore is also zero
  if (importoSaldatoValue === 0 && usaCreditoValue === 0 && debitoSaldatoValue === 0 && contoProduttoreValue === 0) {
    return;
  }

  // Formula: conto_produttore = importo_saldato + usa_credito + debito_lasciato - credito_lasciato - debito_saldato
  // Rearranged: diff = importo_saldato - conto_produttore
  // If diff > 0: credito_lasciato = diff
  // If diff < 0: debito_lasciato = -diff
  // If diff = 0: in pari

  // Check if credito/debito fields have been manually modified by user (not auto-calculated)
  // A field is manual if: has value AND was not auto-calculated AND is not disabled
  const creditoValue = creditoLasciato ? parseAmount(creditoLasciato.value) : 0;
  const debitoValue = debitoLasciato ? parseAmount(debitoLasciato.value) : 0;

  const creditoIsManual = creditoLasciato && creditoValue > 0 && creditoLasciato.dataset.autoCalculated !== 'true' && !creditoLasciato.disabled;
  const debitoIsManual = debitoLasciato && debitoValue > 0 && debitoLasciato.dataset.autoCalculated !== 'true' && !debitoLasciato.disabled;

  // Don't auto-fill if user has manually entered values
  if (creditoIsManual || debitoIsManual) {
    return;
  }

  // AUTO-COMPENSATION: Bidirectional credit/debt compensation
  // Trigger auto-compensation when conto_produttore is set
  // This allows compensation even when importo_saldato = 0 (e.g., using credit to offset goods received)
  const shouldAutoCompensate = contoProduttoreValue > 0;

  const debitoPreesistente = saldo < 0 ? Math.abs(saldo) : 0;
  const creditoPreesistente = saldo > 0 ? saldo : 0;
  const saldaDebitoCheckbox = document.getElementById(`saldaDebito_${id}`);
  const usaInteroCreditoCheckbox = document.getElementById(`usaInteroCreditoCheckbox_${id}`);

  // Compensation fields are always system-managed (always recalculated)
  // Calculate diff without any compensation values (they will be auto-populated)
  let diff = importoSaldatoValue - contoProduttoreValue;

  // Reset compensation fields first (will be repopulated if needed)
  if (usaCredito) {
    usaCredito.value = '';
    usaCredito.disabled = true;
  }
  if (usaInteroCreditoCheckbox) {
    usaInteroCreditoCheckbox.checked = false;
  }
  if (debitoSaldato) {
    debitoSaldato.value = '';
    debitoSaldato.disabled = true;
  }
  if (saldaDebitoCheckbox) {
    saldaDebitoCheckbox.checked = false;
  }

  // Case 1: Creating credit while participant has existing debt - auto-compensate
  if (shouldAutoCompensate && diff > 0 && debitoPreesistente > 0) {
    const debitoSaldabile = Math.min(diff, debitoPreesistente);
    const saldaTuttoIlDebito = debitoSaldabile === debitoPreesistente;

    // Auto-populate debito_saldato field (always disabled, system-managed)
    if (debitoSaldato) {
      debitoSaldato.value = roundUpCents(debitoSaldabile);
      debitoSaldato.disabled = true;
    }

    // Check "Salda intero debito" only if paying ALL existing debt
    if (saldaDebitoCheckbox) {
      saldaDebitoCheckbox.checked = saldaTuttoIlDebito;
    }

    // Recalculate diff after debt payment
    diff = diff - debitoSaldabile;
  }

  // Case 2: Creating debt while participant has existing credit - auto-compensate
  if (shouldAutoCompensate && diff < 0 && creditoPreesistente > 0) {
    const creditoUsabile = Math.min(Math.abs(diff), creditoPreesistente);
    const usaTuttoIlCredito = creditoUsabile === creditoPreesistente;

    // Auto-populate usa_credito field (always disabled, system-managed)
    if (usaCredito) {
      usaCredito.value = roundUpCents(creditoUsabile);
      usaCredito.disabled = true;
    }

    // Check "Usa intero credito" only if using ALL available credit
    if (usaInteroCreditoCheckbox) {
      usaInteroCreditoCheckbox.checked = usaTuttoIlCredito;
    }

    // Recalculate diff after credit usage
    diff = diff + creditoUsabile;
  }

  // Auto-fill based on calculation - fields are ALWAYS disabled
  if (diff > 0) {
    // Leaving credit
    if (creditoLasciato) {
      creditoLasciato.value = roundUpCents(diff);
      creditoLasciato.disabled = true;
    }
    if (debitoLasciato) {
      debitoLasciato.value = '';
      debitoLasciato.disabled = true;
    }
  } else if (diff < 0) {
    // Leaving debt
    if (debitoLasciato) {
      debitoLasciato.value = roundUpCents(-diff);
      debitoLasciato.disabled = true;
    }
    if (creditoLasciato) {
      creditoLasciato.value = '';
      creditoLasciato.disabled = true;
    }
  } else {
    // In pari
    if (creditoLasciato) {
      creditoLasciato.value = '';
      creditoLasciato.disabled = true;
    }
    if (debitoLasciato) {
      debitoLasciato.value = '';
      debitoLasciato.disabled = true;
    }
  }
}

// ===== CALCULATIONS =====
// Note: updatePagatoProduttore() and updateLasciatoInCassa() are defined earlier in CASSA CALCULATIONS section

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
  const currentId = parseInt(select.value);

  if (!currentId) {
    await saveCassaOnly();
    return;
  }

  const debitoLasciato = parseAmount(document.getElementById(`debito_${currentId}`).value);
  const creditoLasciato = parseAmount(document.getElementById(`credito_${currentId}`).value);

  if (debitoLasciato > 0 && creditoLasciato > 0) {
    showStatus(`Errore: non puoi lasciare sia credito che debito contemporaneamente`, 'error');
    return;
  }

  await saveWithParticipant(data, trovatoInCassa, pagatoProduttore, noteGiornata, currentId);
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

  try {
    const response = await fetch('/api/consegna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data, trovatoInCassa, pagatoProduttore, lasciatoInCassa,
        noteGiornata,
        partecipanti: [],
      }),
    });

    const result = await response.json();

    if (result.success) {
      showStatus('Dati cassa salvati con successo!', 'success');
      // Reset note modified flag
      originalNoteGiornata = document.getElementById('noteGiornata').value || '';
      noteGiornataModified = false;
      setTimeout(() => checkDateData(), 1000);
    } else {
      showStatus('Errore: ' + result.error, 'error');
    }
  } catch (error) {
    showStatus('Errore durante il salvataggio: ' + error.message, 'error');
  }
}

async function saveWithParticipant(data, trovatoInCassa, pagatoProduttore, noteGiornata, currentId) {
  showStatus('Salvataggio in corso...', 'success');

  const p = participants.find(part => part.id === currentId);
  if (!p) {
    showStatus('Partecipante non trovato', 'error');
    return;
  }

  const contoProduttore = roundUpCents(parseAmount(document.getElementById(`contoProduttore_${currentId}`).value));
  const importoSaldato = roundUpCents(parseAmount(document.getElementById(`importo_${currentId}`).value));
  const usaCredito = roundUpCents(parseAmount(document.getElementById(`usaCredito_${currentId}`)?.value || '0'));
  const debitoLasciato = roundUpCents(parseAmount(document.getElementById(`debito_${currentId}`).value));
  const creditoLasciato = roundUpCents(parseAmount(document.getElementById(`credito_${currentId}`).value));
  const debitoSaldato = roundUpCents(parseAmount(document.getElementById(`debitoSaldato_${currentId}`)?.value || '0'));
  const saldaDebitoTotale = document.getElementById(`saldaDebito_${currentId}`)?.checked || false;
  const note = document.getElementById(`note_${currentId}`).value || '';

  const partecipantiData = [{
    partecipante_id: currentId,
    saldaTutto: false,
    contoProduttore, importoSaldato, usaCredito, debitoLasciato, creditoLasciato,
    saldaDebitoTotale, debitoSaldato, note,
  }];

  // Always read from DOM
  let lasciatoInCassa = roundUpCents(parseAmount(document.getElementById('lasciatoInCassa').value));

  try {
    const response = await fetch('/api/consegna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data, trovatoInCassa, pagatoProduttore, lasciatoInCassa,
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

function onNoteGiornataChange() {
  const currentNote = document.getElementById('noteGiornata').value || '';
  noteGiornataModified = (currentNote !== originalNoteGiornata);
  updateSaveButtonVisibility();
}

function updateSaveButtonVisibility() {
  const saveBtnCassa = document.getElementById('save-btn-cassa');
  if (!saveBtnCassa) return;

  // Don't show save button if consegna is closed (admin must reopen first)
  if (isConsegnaClosed) {
    saveBtnCassa.style.display = 'none';
    return;
  }

  // Show cassa save button only when note has been modified
  if (noteGiornataModified) {
    saveBtnCassa.style.display = 'block';
    saveBtnCassa.textContent = '💾 Salva Note';
  } else {
    saveBtnCassa.style.display = 'none';
  }
}

// ===== CONSEGNA STATUS MANAGEMENT =====

function updateConsegnaStatusUI(consegna) {
  currentConsegnaId = consegna?.id || null;
  isConsegnaClosed = consegna?.chiusa === true;

  const statusSection = document.getElementById('consegna-status-section');
  const closeBtn = document.getElementById('close-consegna-btn');
  const closedBadge = document.getElementById('closed-badge');

  if (!statusSection) return;

  // Only show section if consegna exists
  if (currentConsegnaId) {
    statusSection.style.display = 'block';

    if (isConsegnaClosed) {
      closedBadge.style.display = 'inline-block';
      if (isAdmin()) {
        closeBtn.style.display = 'inline-block';
        closeBtn.innerHTML = '🔓 Riapri Consegna';
        closeBtn.className = 'btn-success';
      } else {
        closeBtn.style.display = 'none';
      }
      // Disable all inputs when consegna is closed (admin must reopen first to edit)
      disableConsegnaInputs();
    } else {
      closedBadge.style.display = 'none';
      closeBtn.style.display = 'inline-block';
      closeBtn.innerHTML = '🔒 Chiudi Consegna';
      closeBtn.className = 'btn-danger';
      enableConsegnaInputs();
    }
  } else {
    statusSection.style.display = 'none';
  }
}

async function toggleConsegnaStatus() {
  if (!currentConsegnaId) return;

  try {
    if (isConsegnaClosed) {
      // Reopen (admin only - backend will verify)
      await API.reopenConsegna(currentConsegnaId);
      showStatus('Consegna riaperta', 'success');
    } else {
      // Close
      if (!confirm('Sei sicuro di voler chiudere questa consegna? I dati non potranno essere modificati.')) return;
      await API.closeConsegna(currentConsegnaId);
      showStatus('Consegna chiusa', 'success');
    }
    await checkDateData(); // Reload
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

function disableConsegnaInputs() {
  // Disable note field
  const noteField = document.getElementById('noteGiornata');
  if (noteField) noteField.disabled = true;

  // Disable participant select
  const select = document.getElementById('participant-select');
  if (select) select.disabled = true;

  // Add closed indicator class to container
  document.querySelector('.container')?.classList.add('consegna-closed');

  // Hide save button
  const saveBtnCassa = document.getElementById('save-btn-cassa');
  if (saveBtnCassa) saveBtnCassa.style.display = 'none';
}

function enableConsegnaInputs() {
  // Enable note field
  const noteField = document.getElementById('noteGiornata');
  if (noteField) noteField.disabled = false;

  // Enable participant select
  const select = document.getElementById('participant-select');
  if (select) select.disabled = false;

  // Remove closed indicator class
  document.querySelector('.container')?.classList.remove('consegna-closed');
}

function clearParticipantForm() {
  const select = document.getElementById('participant-select');
  select.value = '';
  showParticipantForm();
}

// ===== INITIALIZATION =====

function restoreDateFromStorage() {
  // Check if this is a page reload vs tab navigation
  const navEntry = performance.getEntriesByType('navigation')[0];
  const isReload = navEntry && navEntry.type === 'reload';

  // On reload, always use today's date
  if (isReload) {
    const today = new Date().toISOString().split('T')[0];
    sessionStorage.setItem('gass_selected_date', today);
    return today;
  }

  // On tab navigation, restore from sessionStorage
  const savedDate = sessionStorage.getItem('gass_selected_date');
  if (savedDate) {
    return savedDate;
  }

  return new Date().toISOString().split('T')[0];
}

function saveDateToStorage(dateStr) {
  sessionStorage.setItem('gass_selected_date', dateStr);
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/api/storico');
    const result = await response.json();

    if (result.success && result.consegne.length > 0) {
      // Populate consegneDates Set for calendar indicators
      consegneDates = new Set(result.consegne.map(c => c.data));
    }
  } catch (error) {
    console.error('Error loading storico dates:', error);
  }

  // Use restoreDateFromStorage which handles reload vs tab navigation
  const dateToLoad = restoreDateFromStorage();
  setDateDisplay(dateToLoad);

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
