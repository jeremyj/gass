// ===== STATE MANAGEMENT =====

let participants = [];
let existingConsegnaMovimenti = null;
let saldiBefore = {};
let discrepanzaCassaEnabled = false;
let discrepanzaTrovataEnabled = false;
let discrepanzaPagatoProduttoreEnabled = false;

let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth();
let consegneDates = new Set(); // Store dates with saved consegne

// Track original values for unsaved changes detection
let originalParticipantValues = {};

// Smart Override State
let smartOverrides = {
  trovato: false,
  pagato: false,
  lasciato: false
};

// Store original values when focusing on smart inputs
let originalValues = {
  trovato: null,
  pagato: null,
  lasciato: null
};

// ===== ACCORDION FUNCTIONS =====

function toggleAccordion(section) {
  const content = document.getElementById(`content-${section}`);
  const arrow = document.getElementById(`arrow-${section}`);

  if (content.classList.contains('show')) {
    content.classList.remove('show');
    arrow.classList.remove('expanded');
    arrow.textContent = '▼';
  } else {
    content.classList.add('show');
    arrow.classList.add('expanded');
    arrow.textContent = '▲';
  }
}

// ===== SMART OVERRIDE FUNCTIONS =====

function enableSmartInput(input, type) {
  // Save the original value when focusing
  originalValues[type] = input.value;

  // When clicking on a smart input, make it editable
  input.classList.remove('auto');
  input.classList.add('manual');
  input.removeAttribute('readonly');

  const badge = document.getElementById(`badge-${type}`);
  badge.classList.remove('auto');
  badge.classList.add('manual');
  badge.textContent = 'MANUALE';

  smartOverrides[type] = true;
  checkShowSalvaCassaButton();
}

function updateSmartInput(input, type) {
  // Keep the manual state while typing
  if (input.value) {
    smartOverrides[type] = true;
  }
  checkShowSalvaCassaButton();
}

function checkSmartInputEmpty(input, type) {
  // If user clears the field OR value is unchanged, revert to AUTO
  const isEmpty = !input.value || input.value.trim() === '';
  const isUnchanged = input.value === originalValues[type];

  if (isEmpty || isUnchanged) {
    input.classList.remove('manual');
    input.classList.add('auto');
    input.setAttribute('readonly', 'readonly');

    const badge = document.getElementById(`badge-${type}`);
    badge.classList.remove('manual');
    badge.classList.add('auto');
    badge.textContent = 'AUTO';

    smartOverrides[type] = false;

    // Recalculate auto value
    if (type === 'trovato') {
      // Will be set from previous lasciato
    } else if (type === 'pagato') {
      updatePagatoProduttore();
    } else if (type === 'lasciato') {
      updateLasciatoInCassa();
    }

    checkShowSalvaCassaButton();
  }
}

function calculatePagatoProduttore() {
  // Wrapper for compatibility
  updatePagatoProduttore();
}

function checkShowSalvaCassaButton() {
  const button = document.getElementById('btn-salva-cassa');
  const hasOverride = smartOverrides.trovato || smartOverrides.pagato || smartOverrides.lasciato;

  if (hasOverride) {
    button.classList.remove('hidden');
  } else {
    button.classList.add('hidden');
  }
}

// ===== CALENDAR MODAL =====

function showCalendarModal() {
  const calendar = document.getElementById('calendar-container');
  calendar.classList.toggle('hidden');
}

// ===== HEADER DATE UPDATE =====

function updateHeaderDate() {
  const dateInput = document.getElementById('data');
  const headerDate = document.getElementById('header-date');

  if (dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    if (dateInput.value === today) {
      headerDate.textContent = 'Oggi';
    } else {
      headerDate.textContent = formatDateItalian(dateInput.value);
    }
  }
}

// ===== DATE HANDLING =====

function formatDateItalian(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function updateDateDisplay() {
  // Legacy function - now using updateHeaderDate()
  updateHeaderDate();
  if (document.getElementById('data').value) {
    checkDateData();
  }
}

function selectDate(dateStr) {
  document.getElementById('data').value = dateStr;
  updateHeaderDate();
  renderCalendar();
  checkDateData();
}

// ===== CALENDAR =====

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
  const trovatoField = document.getElementById('trovatoInCassa');
  const pagatoField = document.getElementById('pagatoProduttore');
  const lasciatoField = document.getElementById('lasciatoInCassa');

  trovatoField.value = result.consegna.trovato_in_cassa || '';
  pagatoField.value = result.consegna.pagato_produttore || '';
  lasciatoField.value = result.consegna.lasciato_in_cassa || '';
  document.getElementById('noteGiornata').value = result.consegna.note || '';

  // First, reset ALL fields to AUTO state
  smartOverrides.trovato = false;
  smartOverrides.pagato = false;
  smartOverrides.lasciato = false;

  // Reset trovato to AUTO
  trovatoField.classList.remove('manual');
  trovatoField.classList.add('auto');
  trovatoField.setAttribute('readonly', 'readonly');
  let badge = document.getElementById('badge-trovato');
  if (badge) {
    badge.classList.remove('manual');
    badge.classList.add('auto');
    badge.textContent = 'AUTO';
  }

  // Reset pagato to AUTO
  pagatoField.classList.remove('manual');
  pagatoField.classList.add('auto');
  pagatoField.setAttribute('readonly', 'readonly');
  badge = document.getElementById('badge-pagato');
  if (badge) {
    badge.classList.remove('manual');
    badge.classList.add('auto');
    badge.textContent = 'AUTO';
  }

  // Reset lasciato to AUTO
  lasciatoField.classList.remove('manual');
  lasciatoField.classList.add('auto');
  lasciatoField.setAttribute('readonly', 'readonly');
  badge = document.getElementById('badge-lasciato');
  if (badge) {
    badge.classList.remove('manual');
    badge.classList.add('auto');
    badge.textContent = 'AUTO';
  }

  // Then, apply MANUAL state only where needed
  if (result.consegna.discrepanza_trovata === 1) {
    smartOverrides.trovato = true;
    trovatoField.classList.remove('auto');
    trovatoField.classList.add('manual');
    trovatoField.removeAttribute('readonly');
    badge = document.getElementById('badge-trovato');
    if (badge) {
      badge.classList.remove('auto');
      badge.classList.add('manual');
      badge.textContent = 'MANUALE';
    }
  }

  if (result.consegna.discrepanza_pagato === 1) {
    smartOverrides.pagato = true;
    pagatoField.classList.remove('auto');
    pagatoField.classList.add('manual');
    pagatoField.removeAttribute('readonly');
    badge = document.getElementById('badge-pagato');
    if (badge) {
      badge.classList.remove('auto');
      badge.classList.add('manual');
      badge.textContent = 'MANUALE';
    }
  }

  if (result.consegna.discrepanza_cassa === 1) {
    smartOverrides.lasciato = true;
    lasciatoField.classList.remove('auto');
    lasciatoField.classList.add('manual');
    lasciatoField.removeAttribute('readonly');
    badge = document.getElementById('badge-lasciato');
    if (badge) {
      badge.classList.remove('auto');
      badge.classList.add('manual');
      badge.textContent = 'MANUALE';
    }
  }

  checkShowSalvaCassaButton();

  existingConsegnaMovimenti = result.movimenti || [];
  saldiBefore = result.saldiBefore || {};

  updateMovimentiCounter();
  renderMovimentiGiorno();
}

function loadNewConsegna(result) {
  const trovatoField = document.getElementById('trovatoInCassa');
  const pagatoField = document.getElementById('pagatoProduttore');
  const lasciatoField = document.getElementById('lasciatoInCassa');

  trovatoField.value = result.lasciatoPrecedente ?? '';
  pagatoField.value = '';
  lasciatoField.value = '';
  document.getElementById('noteGiornata').value = '';

  // Reset all smart override states to AUTO
  smartOverrides.trovato = false;
  smartOverrides.pagato = false;
  smartOverrides.lasciato = false;

  // Reset trovato field to AUTO
  trovatoField.classList.remove('manual');
  trovatoField.classList.add('auto');
  trovatoField.setAttribute('readonly', 'readonly');
  const badgeTrovato = document.getElementById('badge-trovato');
  if (badgeTrovato) {
    badgeTrovato.classList.remove('manual');
    badgeTrovato.classList.add('auto');
    badgeTrovato.textContent = 'AUTO';
  }

  // Reset pagato field to AUTO
  pagatoField.classList.remove('manual');
  pagatoField.classList.add('auto');
  pagatoField.setAttribute('readonly', 'readonly');
  const badgePagato = document.getElementById('badge-pagato');
  if (badgePagato) {
    badgePagato.classList.remove('manual');
    badgePagato.classList.add('auto');
    badgePagato.textContent = 'AUTO';
  }

  // Reset lasciato field to AUTO
  lasciatoField.classList.remove('manual');
  lasciatoField.classList.add('auto');
  lasciatoField.setAttribute('readonly', 'readonly');
  const badgeLasciato = document.getElementById('badge-lasciato');
  if (badgeLasciato) {
    badgeLasciato.classList.remove('manual');
    badgeLasciato.classList.add('auto');
    badgeLasciato.textContent = 'AUTO';
  }

  checkShowSalvaCassaButton();

  existingConsegnaMovimenti = null;
  saldiBefore = {};

  updateMovimentiCounter();
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

  const infoBadge = document.getElementById('participant-info-badge');

  if (!nome) {
    infoBadge.style.display = 'block';
    updateLasciatoInCassa();
    return;
  }

  infoBadge.style.display = 'none';
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
    ? `€${formatSaldo(saldo)}`
    : saldo > 0 ? `€${formatSaldo(saldo)}` : 'IN PARI';
  const saldoClass = saldo < 0 ? 'saldo-debito' : saldo > 0 ? 'saldo-credito' : '';

  const card = document.createElement('div');
  card.className = 'participant-card-flow';
  card.innerHTML = buildParticipantCardHTML(nome, saldo, saldoText, saldoClass, haCredito, haDebito);
  container.appendChild(card);

  addHiddenFields(card, nome, haCredito, haDebito);

  // Add click handler to header to close card
  setTimeout(() => {
    const header = document.getElementById(`header-${nome.replace(/\s/g, '_')}`);
    if (header) {
      header.addEventListener('click', (e) => {
        // Don't close if clicking on input fields or buttons
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
          removeParticipant(nome);
        }
      });
    }
  }, 100);

  // Load existing data if available (with timeout to ensure DOM is ready)
  setTimeout(() => {
    loadExistingParticipantData(nome, saldo);
    // Save original values after form is fully loaded
    setTimeout(() => saveOriginalParticipantValues(nome), 10);
  }, 0);
}

function loadExistingParticipantData(nome, saldo) {
  if (!existingConsegnaMovimenti) return;

  const movimento = existingConsegnaMovimenti.find(m => m.nome === nome);
  if (!movimento) return;

  // Populate fields with existing data
  const importoField = document.getElementById(`importo_${nome}`);
  if (importoField && movimento.importo_saldato) {
    importoField.value = movimento.importo_saldato;
  }

  const usaCreditoField = document.getElementById(`usaCredito_${nome}`);
  const usaInteroCreditoCheckbox = document.getElementById(`usaInteroCreditoCheckbox_${nome}`);

  let hasUsaCredito = false;
  if (usaCreditoField && movimento.usa_credito) {
    usaCreditoField.value = movimento.usa_credito;
    hasUsaCredito = true;

    // If usa_credito equals the full credit amount, check the "usa intero credito" checkbox
    if (usaInteroCreditoCheckbox && saldo > 0 && Math.abs(movimento.usa_credito - saldo) < 0.01) {
      usaInteroCreditoCheckbox.checked = true;
      usaCreditoField.disabled = true;
    }
  }

  const creditoField = document.getElementById(`credito_${nome}`);
  if (creditoField && movimento.credito_lasciato) {
    creditoField.value = movimento.credito_lasciato;
  }

  const debitoField = document.getElementById(`debito_${nome}`);
  if (debitoField && movimento.debito_lasciato) {
    debitoField.value = movimento.debito_lasciato;
  }

  const debitoSaldatoField = document.getElementById(`debitoSaldato_${nome}`);
  if (debitoSaldatoField && movimento.debito_saldato) {
    debitoSaldatoField.value = movimento.debito_saldato;
  }

  const noteField = document.getElementById(`note_${nome}`);
  if (noteField && movimento.note) {
    noteField.value = movimento.note;
  }

  // Check and set checkboxes if applicable
  if (movimento.salda_tutto === 1) {
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

  // Apply business rules to correctly set disabled states based on loaded data
  // This ensures that when user unchecks a checkbox, the fields don't remain incorrectly disabled
  handleCreditoDebitoInput(nome, saldo);
}

function buildParticipantCardHTML(nome, saldo, saldoText, saldoClass, haCredito, haDebito) {
  return `
    <div class="flow-header" id="header-${nome.replace(/\s/g, '_')}" style="cursor: pointer;">
      <div class="participant-name">${nome}</div>
    </div>

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

    <button class="big-btn big-btn-success" onclick="saveParticipant('${nome}')">
      💾 Salva Movimento
    </button>
    <button class="big-btn big-btn-secondary" onclick="removeParticipant('${nome}')">
      ✖️ Chiudi
    </button>
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

  // Only auto-calculate if we have a conto_produttore value
  if (contoProduttoreValue === 0) {
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
  if (discrepanzaPagatoProduttoreEnabled) return;

  let totalPagato = 0;

  if (existingConsegnaMovimenti && existingConsegnaMovimenti.length > 0) {
    existingConsegnaMovimenti.forEach(m => {
      // Conto produttore = importo_saldato + usa_credito + debito_lasciato - credito_lasciato - debito_saldato
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

  // Calculate total cash collected (incassato)
  // Incassato = sum of all importo_saldato (physical cash given by participants)
  let incassato = 0;
  if (existingConsegnaMovimenti && existingConsegnaMovimenti.length > 0) {
    existingConsegnaMovimenti.forEach(m => {
      incassato += (m.importo_saldato || 0);
    });
  }

  // Formula: Lasciato = Trovato + Incassato - Pagato Produttore
  const lasciatoInCassa = roundUpCents(trovatoInCassa + incassato - pagatoProduttore);
  document.getElementById('lasciatoInCassa').value = lasciatoInCassa;
}

// ===== MOVEMENTS COUNTER =====

function updateMovimentiCounter() {
  const count = existingConsegnaMovimenti ? existingConsegnaMovimenti.length : 0;
  const movimentiTitle = document.getElementById('movimenti-title');
  if (movimentiTitle) {
    movimentiTitle.textContent = `📦 MOVIMENTI (${count} salvat${count === 1 ? 'o' : 'i'})`;
  }
}

// ===== UNSAVED CHANGES DETECTION =====

function saveOriginalParticipantValues(nome) {
  // Save current form values as original values
  originalParticipantValues[nome] = {
    importo: document.getElementById(`importo_${nome}`)?.value || '',
    usaCredito: document.getElementById(`usaCredito_${nome}`)?.value || '',
    credito: document.getElementById(`credito_${nome}`)?.value || '',
    debito: document.getElementById(`debito_${nome}`)?.value || '',
    debitoSaldato: document.getElementById(`debitoSaldato_${nome}`)?.value || '',
    note: document.getElementById(`note_${nome}`)?.value || ''
  };
}

function hasUnsavedParticipantChanges(nome) {
  // Check if current form values differ from original values
  if (!originalParticipantValues[nome]) {
    return false;
  }

  const original = originalParticipantValues[nome];
  const current = {
    importo: document.getElementById(`importo_${nome}`)?.value || '',
    usaCredito: document.getElementById(`usaCredito_${nome}`)?.value || '',
    credito: document.getElementById(`credito_${nome}`)?.value || '',
    debito: document.getElementById(`debito_${nome}`)?.value || '',
    debitoSaldato: document.getElementById(`debitoSaldato_${nome}`)?.value || '',
    note: document.getElementById(`note_${nome}`)?.value || ''
  };

  return original.importo !== current.importo ||
         original.usaCredito !== current.usaCredito ||
         original.credito !== current.credito ||
         original.debito !== current.debito ||
         original.debitoSaldato !== current.debitoSaldato ||
         original.note !== current.note;
}

// ===== PARTICIPANT FORM ACTIONS =====

async function saveParticipant(nome) {
  const data = document.getElementById('data').value;
  const trovatoInCassa = roundUpCents(parseAmount(document.getElementById('trovatoInCassa').value));
  const pagatoProduttore = roundUpCents(parseAmount(document.getElementById('pagatoProduttore').value));
  const noteGiornata = document.getElementById('noteGiornata').value || '';

  if (!data) {
    showStatus('Inserisci la data', 'error');
    return;
  }

  const debitoLasciato = parseAmount(document.getElementById(`debito_${nome}`).value);
  const creditoLasciato = parseAmount(document.getElementById(`credito_${nome}`).value);

  if (debitoLasciato > 0 && creditoLasciato > 0) {
    showStatus(`Errore: non puoi lasciare sia credito che debito contemporaneamente`, 'error');
    return;
  }

  await saveWithParticipant(data, trovatoInCassa, pagatoProduttore, noteGiornata, nome);
}

function removeParticipant(nome) {
  // Check for unsaved changes
  if (hasUnsavedParticipantChanges(nome)) {
    if (!confirm('Ci sono modifiche non salvate. Vuoi chiudere senza salvare?')) {
      return; // User cancelled, keep form open
    }
  }

  const container = document.getElementById('selected-participants');
  container.innerHTML = '';

  const select = document.getElementById('participant-select');
  select.value = '';

  const infoBadge = document.getElementById('participant-info-badge');
  if (infoBadge) {
    infoBadge.style.display = 'block';
  }

  // Clear saved values
  delete originalParticipantValues[nome];

  updateLasciatoInCassa();
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

  // Always read from DOM - updateLasciatoInCassa() has already calculated the correct value
  let lasciatoInCassa = roundUpCents(parseAmount(document.getElementById('lasciatoInCassa').value));

  try {
    const response = await fetch('/api/consegna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data, trovatoInCassa, pagatoProduttore, lasciatoInCassa,
        discrepanzaCassa: smartOverrides.lasciato || discrepanzaCassaEnabled,
        discrepanzaTrovata: smartOverrides.trovato || discrepanzaTrovataEnabled,
        discrepanzaPagato: smartOverrides.pagato || discrepanzaPagatoProduttoreEnabled,
        noteGiornata,
        partecipanti: [],
      }),
    });

    const result = await response.json();

    if (result.success) {
      showStatus('✓ Cassa salvata', 'success');
      await loadConsegneDates(); // Refresh calendar
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

  // Always read from DOM - updateLasciatoInCassa() has already calculated the correct value
  let lasciatoInCassa = roundUpCents(parseAmount(document.getElementById('lasciatoInCassa').value));

  try {
    const response = await fetch('/api/consegna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data, trovatoInCassa, pagatoProduttore, lasciatoInCassa,
        discrepanzaCassa: smartOverrides.lasciato || discrepanzaCassaEnabled,
        discrepanzaTrovata: smartOverrides.trovato || discrepanzaTrovataEnabled,
        discrepanzaPagato: smartOverrides.pagato || discrepanzaPagatoProduttoreEnabled,
        noteGiornata,
        partecipanti: partecipantiData,
      }),
    });

    const result = await response.json();

    if (result.success) {
      showStatus('✓ Movimento salvato', 'success');

      // Reload consegna data to get updated movements
      await checkDateData();

      // Update movements counter
      updateMovimentiCounter();

      // Update Pagato Produttore with new total
      updatePagatoProduttore();

      await loadConsegneDates(); // Refresh calendar

      // Close participant card after save
      const container = document.getElementById('selected-participants');
      container.innerHTML = '';

      const select = document.getElementById('participant-select');
      select.value = '';

      const infoBadge = document.getElementById('participant-info-badge');
      if (infoBadge) {
        infoBadge.style.display = 'block';
      }

      // Clear saved values
      delete originalParticipantValues[currentNome];
    } else {
      showStatus('Errore: ' + result.error, 'error');
    }
  } catch (error) {
    showStatus('Errore durante il salvataggio: ' + error.message, 'error');
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
  // Load consegne dates for calendar
  await loadConsegneDates();

  // Set initial date (last consegna or today)
  try {
    const response = await fetch('/api/storico');
    const result = await response.json();

    if (result.success && result.storico.length > 0) {
      document.getElementById('data').value = result.storico[0].data;
      // Set calendar to the month of the last consegna
      const lastDate = new Date(result.storico[0].data);
      currentCalendarYear = lastDate.getFullYear();
      currentCalendarMonth = lastDate.getMonth();
    } else {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      document.getElementById('data').value = todayStr;
    }
  } catch (error) {
    console.error('Error loading last date:', error);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    document.getElementById('data').value = todayStr;
  }

  renderCalendar();
  updateHeaderDate();
  await checkDateData();
  loadData();
});
