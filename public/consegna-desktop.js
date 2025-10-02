// ===== STATE MANAGEMENT =====

let participants = [];
let existingConsegnaMovimenti = null;
let saldiBefore = {};
let discrepanzaCassaEnabled = false;
let discrepanzaTrovataEnabled = false;
let discrepanzaPagatoProduttoreEnabled = false;


// ===== DATE HANDLING =====

function formatDateItalian(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// ===== DATE PICKER =====

let pickerYear = new Date().getFullYear();
let pickerMonth = new Date().getMonth();
let isPickerOpen = false;

function toggleDatePicker() {
  const container = document.getElementById('date-picker-container');
  isPickerOpen = !isPickerOpen;

  if (isPickerOpen) {
    renderDatePicker();
    container.style.display = 'block';

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', closeDatePickerOnClickOutside);
    }, 0);
  } else {
    container.style.display = 'none';
    document.removeEventListener('click', closeDatePickerOnClickOutside);
  }
}

function closeDatePickerOnClickOutside(e) {
  const container = document.getElementById('date-picker-container');
  const display = document.getElementById('data-display');

  if (!container.contains(e.target) && e.target !== display) {
    toggleDatePicker();
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
  toggleDatePicker();
  checkDateData();
}

function setDateDisplay(dateStr) {
  const [year, month, day] = dateStr.split('-');
  document.getElementById('data-display').value = `${day}-${month}-${year}`;
  document.getElementById('data').value = dateStr;

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

async function loadData() {
  try {
    const response = await fetch('/api/participants');
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
    const response = await fetch(`/api/consegna/${dateValue}`);
    const result = await response.json();

    if (result.success && result.found) {
      loadExistingConsegna(result);
    } else {
      loadNewConsegna(result);
    }
  } catch (error) {
    console.error('Error checking date data:', error);
  }
}

function loadExistingConsegna(result) {
  document.getElementById('trovatoInCassa').value = result.consegna.trovato_in_cassa || '';
  document.getElementById('pagatoProduttore').value = result.consegna.pagato_produttore || '';
  document.getElementById('lasciatoInCassa').value = result.consegna.lasciato_in_cassa || '';
  document.getElementById('noteGiornata').value = result.consegna.note || '';

  restoreOverrideCheckbox('discrepanzaCassa', 'lasciatoInCassa',
    result.consegna.discrepanza_cassa, () => discrepanzaCassaEnabled = true, () => discrepanzaCassaEnabled = false);

  restoreOverrideCheckbox('discrepanzaCassaTrovata', 'trovatoInCassa',
    result.consegna.discrepanza_trovata, () => discrepanzaTrovataEnabled = true, () => discrepanzaTrovataEnabled = false);

  restoreOverrideCheckbox('discrepanzaPagatoProduttore', 'pagatoProduttore',
    result.consegna.discrepanza_pagato, () => discrepanzaPagatoProduttoreEnabled = true, () => discrepanzaPagatoProduttoreEnabled = false);

  existingConsegnaMovimenti = result.movimenti || [];
  saldiBefore = result.saldiBefore || {};

  renderMovimentiGiorno();
  showStatus('Dati esistenti caricati per questa data', 'success');
}

function loadNewConsegna(result) {
  const trovatoField = document.getElementById('trovatoInCassa');
  trovatoField.value = result.lasciatoPrecedente ?? '';

  document.getElementById('pagatoProduttore').value = '';
  document.getElementById('lasciatoInCassa').value = '';
  document.getElementById('noteGiornata').value = '';

  existingConsegnaMovimenti = null;
  saldiBefore = {};

  renderMovimentiGiorno();
  updatePagatoProduttore();
}

function restoreOverrideCheckbox(checkboxId, fieldId, flagValue, enableFn, disableFn) {
  const checkbox = document.getElementById(checkboxId);
  const field = document.getElementById(fieldId);

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
    return;
  }

  renderParticipant(nome);
  updateLasciatoInCassa();
}

function renderMovimentiGiorno() {
  const container = document.getElementById('movimenti-giorno');

  if (!existingConsegnaMovimenti || existingConsegnaMovimenti.length === 0) {
    container.innerHTML = '';
    return;
  }

  const rows = existingConsegnaMovimenti.map((m, idx) => {
    const bgColor = idx % 2 === 0 ? '#FFFFFF' : '#E3F2FD';
    return `
      <tr style="background: ${bgColor};">
        <td style="padding: 8px;"><strong>${m.nome}</strong></td>
        <td style="padding: 8px; text-align: right;">${m.importo_saldato ? '€' + m.importo_saldato.toFixed(2) : ''}</td>
        <td style="padding: 8px; text-align: right;">${m.usa_credito ? '€' + m.usa_credito.toFixed(2) : ''}</td>
        <td style="padding: 8px; text-align: right;">${m.debito_lasciato ? '€' + m.debito_lasciato.toFixed(2) : ''}</td>
        <td style="padding: 8px; text-align: right;">${m.credito_lasciato ? '€' + m.credito_lasciato.toFixed(2) : ''}</td>
        <td style="padding: 8px; text-align: right;">${m.debito_saldato ? '€' + m.debito_saldato.toFixed(2) : ''}</td>
        <td style="padding: 8px;">${m.note || ''}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <h3 style="margin-bottom: 10px;">Movimenti del Giorno</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <thead><tr style="background: #FFEB3B; color: white;">
        <th style="padding: 10px; text-align: left;">Nome</th>
        <th style="padding: 10px; text-align: right;">Importo Saldato</th>
        <th style="padding: 10px; text-align: right;">Usa Credito</th>
        <th style="padding: 10px; text-align: right;">Debito Lasciato</th>
        <th style="padding: 10px; text-align: right;">Credito Lasciato</th>
        <th style="padding: 10px; text-align: right;">Debito Saldato</th>
        <th style="padding: 10px; text-align: left;">Note</th>
      </tr></thead>
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
    ? `DEBITO: €${formatSaldo(saldo)}`
    : saldo > 0 ? `CREDITO: €${formatSaldo(saldo)}` : 'IN PARI';
  const saldoClass = saldo < 0 ? 'saldo-debito' : saldo > 0 ? 'saldo-credito' : '';

  const card = document.createElement('div');
  card.className = 'participant-card-flow';
  card.innerHTML = buildParticipantCardHTML(nome, saldo, saldoText, saldoClass, haCredito, haDebito);
  container.appendChild(card);

  addHiddenFields(card, nome, haCredito, haDebito);
}

function buildParticipantCardHTML(nome, saldo, saldoText, saldoClass, haCredito, haDebito) {
  return `
    <div class="flow-header">
      <div class="participant-name">${nome}</div>
      <div class="saldo-info ${saldoClass}">${saldoText}</div>
    </div>

    <div class="flow-section">
      <div class="flow-section-title">1. PAGAMENTO OGGI</div>
      <div class="form-group">
        <label>Importo saldato:</label>
        <input type="text" inputmode="decimal" id="importo_${nome}" placeholder="0.00"
               oninput="normalizeInputField(this); updateLasciatoInCassa()"
               onfocus="handleInputFocus(this)">
      </div>
    </div>

    ${haCredito ? buildCreditoSection(nome, saldo) : ''}

    <div class="flow-section">
      <div class="flow-section-title">3. NUOVO SALDO</div>
      <div class="row">
        <div class="form-group">
          <label>Lascia credito:</label>
          <input type="text" inputmode="decimal" id="credito_${nome}" placeholder="0.00"
                 oninput="normalizeInputField(this); handleCreditoDebitoInput('${nome}', ${saldo})"
                 onfocus="handleInputFocus(this)">
        </div>
        <div class="form-group">
          <label>Lascia debito:</label>
          <input type="text" inputmode="decimal" id="debito_${nome}" placeholder="0.00"
                 oninput="normalizeInputField(this); handleCreditoDebitoInput('${nome}', ${saldo})"
                 onfocus="handleInputFocus(this)">
        </div>
      </div>
    </div>

    ${haDebito ? buildDebitoSection(nome, saldo) : ''}

    <div class="flow-section">
      <div class="form-group">
        <label>Note:</label>
        <input type="text" id="note_${nome}" placeholder="Note aggiuntive">
      </div>
    </div>
  `;
}

function buildCreditoSection(nome, saldo) {
  return `
    <div class="flow-section flow-credito">
      <div class="flow-section-title">2. USA SALDO PRECEDENTE</div>
      <div class="checkbox-group">
        <input type="checkbox" id="usaInteroCreditoCheckbox_${nome}" onchange="toggleUsaInteroCredito('${nome}', ${saldo})">
        <label for="usaInteroCreditoCheckbox_${nome}">Usa intero credito €${formatSaldo(saldo)}</label>
      </div>
      <div class="form-group">
        <label>Usa credito parziale:</label>
        <input type="text" inputmode="decimal" id="usaCredito_${nome}" placeholder="0.00"
               oninput="normalizeInputField(this); validateCreditoMax('${nome}', ${saldo}); handleCreditoDebitoInput('${nome}', ${saldo})"
               onfocus="handleInputFocus(this)">
      </div>
    </div>
  `;
}

function buildDebitoSection(nome, saldo) {
  return `
    <div class="flow-section flow-debito">
      <div class="flow-section-title">4. SALDA DEBITO PRECEDENTE</div>
      <div class="checkbox-group">
        <input type="checkbox" id="saldaDebito_${nome}" onchange="toggleSaldaDebito('${nome}', ${saldo})">
        <label for="saldaDebito_${nome}">Salda intero debito €${formatSaldo(saldo)}</label>
      </div>
      <div class="form-group">
        <label>Salda parziale:</label>
        <input type="text" inputmode="decimal" id="debitoSaldato_${nome}" placeholder="0.00"
               oninput="normalizeInputField(this); handleCreditoDebitoInput('${nome}', ${saldo})"
               onfocus="handleInputFocus(this)">
      </div>
    </div>
  `;
}

function addHiddenFields(card, nome, haCredito, haDebito) {
  if (!haCredito) {
    card.appendChild(createHiddenInput(`usaCredito_${nome}`, '0'));
    card.appendChild(createHiddenInput(`usaInteroCreditoCheckbox_${nome}`, 'false'));
  }
  if (!haDebito) {
    card.appendChild(createHiddenInput(`saldaDebito_${nome}`, 'false'));
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

// ===== OVERRIDE TOGGLES =====

function toggleDiscrepanzaCassa() {
  toggleOverrideCheckbox('discrepanzaCassa', 'lasciatoInCassa',
    enabled => discrepanzaCassaEnabled = enabled, updateLasciatoInCassa);
}

function toggleDiscrepanzaCassaTrovata() {
  toggleOverrideCheckbox('discrepanzaCassaTrovata', 'trovatoInCassa',
    enabled => discrepanzaTrovataEnabled = enabled);
}

function toggleDiscrepanzaPagatoProduttore() {
  toggleOverrideCheckbox('discrepanzaPagatoProduttore', 'pagatoProduttore',
    enabled => discrepanzaPagatoProduttoreEnabled = enabled, updatePagatoProduttore);
}

function toggleOverrideCheckbox(checkboxId, fieldId, setEnabled, recalculateFn) {
  const checkbox = document.getElementById(checkboxId);
  const field = document.getElementById(fieldId);

  if (checkbox.checked) {
    setEnabled(true);
    field.readOnly = false;
    field.style.cursor = 'text';
    field.style.background = '#fff';
    field.focus();
  } else {
    setEnabled(false);
    field.readOnly = true;
    field.style.cursor = 'not-allowed';
    field.style.background = '#f0f0f0';
    if (recalculateFn) recalculateFn();
  }
}

// ===== PARTICIPANT INTERACTION =====

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

function validateCreditoMax(nome, saldo) {
  const usaCreditoField = document.getElementById(`usaCredito_${nome}`);
  if (!usaCreditoField) return;

  const value = parseAmount(usaCreditoField.value);
  if (value > saldo) {
    usaCreditoField.value = saldo;
    showStatus(`Non puoi usare più di €${formatSaldo(saldo)} di credito`, 'error');
  }
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

function handleCreditoDebitoInput(nome, saldo) {
  const creditoLasciato = document.getElementById(`credito_${nome}`);
  const debitoLasciato = document.getElementById(`debito_${nome}`);
  const debitoSaldato = document.getElementById(`debitoSaldato_${nome}`);
  const saldaDebitoCheckbox = document.getElementById(`saldaDebito_${nome}`);
  const usaCredito = document.getElementById(`usaCredito_${nome}`);

  const creditoValue = creditoLasciato ? parseAmount(creditoLasciato.value) : 0;
  const debitoValue = debitoLasciato ? parseAmount(debitoLasciato.value) : 0;
  const usaCreditoValue = usaCredito ? parseAmount(usaCredito.value) : 0;
  const debitoSaldatoValue = debitoSaldato ? parseAmount(debitoSaldato.value) : 0;
  const saldaDebitoChecked = saldaDebitoCheckbox && saldaDebitoCheckbox.checked;

  const creditoDisponibile = saldo > 0 ? saldo : 0;
  const usaCreditoParziale = usaCreditoValue > 0 && usaCreditoValue < creditoDisponibile;
  const saldaDebito = saldaDebitoChecked || debitoSaldatoValue > 0;

  // Reset: enable all fields
  [creditoLasciato, debitoLasciato, debitoSaldato, saldaDebitoCheckbox].forEach(el => {
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

// ===== CALCULATIONS =====

function updatePagatoProduttore() {
  if (discrepanzaPagatoProduttoreEnabled) return;

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

  document.getElementById('pagatoProduttore').value = roundUpCents(totalPagato);
  updateLasciatoInCassa();
}

function updateLasciatoInCassa() {
  if (discrepanzaCassaEnabled) return;

  const trovatoInCassa = parseAmount(document.getElementById('trovatoInCassa').value);
  const pagatoProduttore = parseAmount(document.getElementById('pagatoProduttore').value);

  const lasciatoInCassa = roundUpCents(trovatoInCassa - pagatoProduttore);
  document.getElementById('lasciatoInCassa').value = lasciatoInCassa;
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

  let lasciatoInCassa;
  if (discrepanzaCassaEnabled) {
    lasciatoInCassa = roundUpCents(parseAmount(document.getElementById('lasciatoInCassa').value));
  } else {
    lasciatoInCassa = roundUpCents(trovatoInCassa - pagatoProduttore);
    document.getElementById('lasciatoInCassa').value = lasciatoInCassa;
  }

  try {
    const response = await fetch('/api/consegna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data, trovatoInCassa, pagatoProduttore, lasciatoInCassa,
        discrepanzaCassa: discrepanzaCassaEnabled,
        discrepanzaTrovata: discrepanzaTrovataEnabled,
        discrepanzaPagato: discrepanzaPagatoProduttoreEnabled,
        noteGiornata,
        partecipanti: [],
      }),
    });

    const result = await response.json();

    if (result.success) {
      showStatus('Dati cassa salvati con successo!', 'success');
      setTimeout(() => loadData(), 1000);
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

  let lasciatoInCassa;
  if (discrepanzaCassaEnabled) {
    lasciatoInCassa = roundUpCents(parseAmount(document.getElementById('lasciatoInCassa').value));
  } else {
    lasciatoInCassa = roundUpCents(trovatoInCassa - pagatoProduttore);
    document.getElementById('lasciatoInCassa').value = lasciatoInCassa;
  }

  try {
    const response = await fetch('/api/consegna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data, trovatoInCassa, pagatoProduttore, lasciatoInCassa,
        discrepanzaCassa: discrepanzaCassaEnabled,
        discrepanzaTrovata: discrepanzaTrovataEnabled,
        discrepanzaPagato: discrepanzaPagatoProduttoreEnabled,
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
        loadData();
      }, 1000);
    } else {
      showStatus('Errore: ' + result.error, 'error');
    }
  } catch (error) {
    showStatus('Errore durante il salvataggio: ' + error.message, 'error');
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
  // Set initial date (last consegna or today)
  try {
    const response = await fetch('/api/storico');
    const result = await response.json();

    if (result.success && result.storico.length > 0) {
      setDateDisplay(result.storico[0].data);
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
