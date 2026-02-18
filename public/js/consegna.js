// ===== STATE MANAGEMENT =====

let participants = [];
let existingConsegnaMovimenti = null;
let saldiBefore = {};

// Calendar state now managed in calendar.js

// Track original values for unsaved changes detection
let originalParticipantValues = {};
let noteGiornataModified = false;
let originalNoteGiornata = '';

// Consegna status tracking
let currentConsegnaId = null;
let isConsegnaClosed = false;

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

// ===== CASSA CALCULATIONS =====

function calculatePagatoProduttore() {
  let totalPagato = 0;
  if (existingConsegnaMovimenti && existingConsegnaMovimenti.length > 0) {
    existingConsegnaMovimenti.forEach(m => {
      // Pagato produttore = sum of all conto_produttore values
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
  const value = calculatePagatoProduttore();
  pagatoField.value = formatNumber(value);
}

function updateLasciatoInCassa() {
  const lasciatoField = document.getElementById('lasciatoInCassa');
  const value = calculateLasciatoInCassa();
  lasciatoField.value = formatNumber(value);
}


// ===== CALENDAR AND DATE PICKER =====
// Calendar and date picker functions are now in calendar.js
// We only keep the page-specific callback

async function loadConsegneDates() {
  try {
    const response = await fetch('/api/storico');
    const result = await response.json();

    if (result.success) {
      const dates = result.consegne.map(c => c.data);
      setConsegneDates(dates); // Update calendar.js with the dates
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

    // Close any open participant card when date changes
    const container = document.getElementById('selected-participants');
    if (container) container.innerHTML = '';

    const select = document.getElementById('participant-select');
    if (select) select.value = '';

    const infoBadge = document.getElementById('participant-info-badge');
    if (infoBadge) infoBadge.style.display = 'block';

    // Clear saved original values
    originalParticipantValues = {};
  } catch (error) {
    console.error('Error checking date data:', error);
  }
}

function loadExistingConsegna(result) {
  const trovatoField = document.getElementById('trovatoInCassa');
  const noteField = document.getElementById('noteGiornata');

  // Load movements first (needed for calculations)
  existingConsegnaMovimenti = result.movimenti || [];
  saldiBefore = result.saldiBefore || {};

  // Set trovato from stored value, formatted
  trovatoField.value = formatNumber(result.consegna.trovato_in_cassa || 0);

  // Store original note value for change detection
  originalNoteGiornata = result.consegna.note || '';
  noteField.value = originalNoteGiornata;
  noteGiornataModified = false;

  // Calculate and display pagato and lasciato
  updatePagatoProduttore();
  updateLasciatoInCassa();

  updateMovimentiCounter();
  renderMovimentiGiorno();
  updateNoteButtonVisibility();

  // Update consegna status (closed/open)
  updateConsegnaStatusUI(result.consegna);
}

function loadNewConsegna(result) {
  const trovatoField = document.getElementById('trovatoInCassa');
  const noteField = document.getElementById('noteGiornata');

  // Clear movements
  existingConsegnaMovimenti = null;
  saldiBefore = {};

  // Set trovato from previous lasciato, formatted
  trovatoField.value = formatNumber(result.lasciatoPrecedente ?? 0);

  // Reset note tracking
  originalNoteGiornata = '';
  noteField.value = '';
  noteGiornataModified = false;

  // Calculate and display pagato and lasciato
  updatePagatoProduttore();
  updateLasciatoInCassa();

  updateMovimentiCounter();
  renderMovimentiGiorno();
  updateNoteButtonVisibility();

  // No consegna exists yet - hide status section
  updateConsegnaStatusUI(null);
}

// ===== NOTE MANAGEMENT =====

function onNoteGiornataChange() {
  const currentNote = document.getElementById('noteGiornata').value || '';
  noteGiornataModified = (currentNote !== originalNoteGiornata);
  updateNoteButtonVisibility();
}

function updateNoteButtonVisibility() {
  const saveNoteBtn = document.getElementById('save-note-btn');
  if (!saveNoteBtn) return;

  // Don't show save button if consegna is closed (admin must reopen first)
  if (isConsegnaClosed) {
    saveNoteBtn.style.display = 'none';
    return;
  }

  if (noteGiornataModified) {
    saveNoteBtn.style.display = 'block';
  } else {
    saveNoteBtn.style.display = 'none';
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
      closedBadge.style.display = 'block';
      if (isAdmin()) {
        closeBtn.style.display = 'block';
        closeBtn.innerHTML = '🔓 Riapri Consegna';
        closeBtn.style.background = '#28a745';
      } else {
        closeBtn.style.display = 'none';
      }
      // Disable all inputs when consegna is closed (admin must reopen first to edit)
      disableConsegnaInputs();
    } else {
      closedBadge.style.display = 'none';
      closeBtn.style.display = 'block';
      closeBtn.innerHTML = '🔒 Chiudi Consegna';
      closeBtn.style.background = '#dc3545';
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

  // Hide save note button
  const saveNoteBtn = document.getElementById('save-note-btn');
  if (saveNoteBtn) saveNoteBtn.style.display = 'none';

  // Hide movimenti section and ensure cassa is open when consegna is closed
  const movimentiSection = document.querySelector('.section-movimenti');
  if (movimentiSection) movimentiSection.style.display = 'none';

  // Ensure cassa accordion is open
  const cassaContent = document.getElementById('content-cassa');
  const cassaArrow = document.getElementById('arrow-cassa');
  if (cassaContent && !cassaContent.classList.contains('show')) {
    cassaContent.classList.add('show');
    if (cassaArrow) {
      cassaArrow.classList.add('expanded');
      cassaArrow.textContent = '▲';
    }
  }
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

  // Restore movimenti section visibility
  const movimentiSection = document.querySelector('.section-movimenti');
  if (movimentiSection) movimentiSection.style.display = '';
}

async function saveNoteOnly() {
  const data = getSelectedDate();
  const trovatoInCassa = parseAmount(document.getElementById('trovatoInCassa').value);
  const pagatoProduttore = calculatePagatoProduttore();
  const lasciatoInCassa = calculateLasciatoInCassa();
  const noteGiornata = document.getElementById('noteGiornata').value || '';

  if (!data) {
    showStatus('Errore: data non valida', 'error');
    return;
  }

  showStatus('Salvataggio note in corso...', 'success');

  try {
    const response = await fetch('/api/consegna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data,
        trovatoInCassa,
        pagatoProduttore,
        lasciatoInCassa,
        noteGiornata,
        partecipanti: [],
      }),
    });

    const result = await response.json();

    if (result.success) {
      showStatus('Note salvate con successo!', 'success');
      // Reset note modified flag
      originalNoteGiornata = noteGiornata;
      noteGiornataModified = false;
      updateNoteButtonVisibility();
      // Reload to get fresh data
      setTimeout(() => checkDateData(), 1000);
    } else {
      showStatus('Errore: ' + result.error, 'error');
    }
  } catch (error) {
    showStatus('Errore durante il salvataggio: ' + error.message, 'error');
  }
}

// ===== RENDERING =====

function renderParticipantSelect() {
  const select = document.getElementById('participant-select');
  if (!select) return;

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
  if (!select) return;

  const id = parseInt(select.value);

  const container = document.getElementById('selected-participants');
  if (!container) return;

  container.innerHTML = '';

  const infoBadge = document.getElementById('participant-info-badge');

  if (!id) {
    if (infoBadge) infoBadge.style.display = 'block';
    updateLasciatoInCassa();
    return;
  }

  if (infoBadge) infoBadge.style.display = 'none';
  renderParticipant(id);
  updateLasciatoInCassa();
}

function renderMovimentiGiorno() {
  const container = document.getElementById('movimenti-giorno');
  if (!container) return;

  if (!existingConsegnaMovimenti || existingConsegnaMovimenti.length === 0) {
    container.innerHTML = '';
    return;
  }

  const rows = existingConsegnaMovimenti.map((m, idx) => {
    const bgColor = idx % 2 === 0 ? '#FFFFFF' : '#E3F2FD';
    return `
      <tr style="background: ${bgColor};">
        <td style="padding: 8px;"><strong>${escapeHtml(m.nome)}</strong></td>
        <td style="padding: 8px; text-align: right;">${m.importo_saldato ? '€' + formatNumber(m.importo_saldato) : ''}</td>
        <td style="padding: 8px; text-align: right;">${m.usa_credito ? '€' + formatNumber(m.usa_credito) : ''}</td>
        <td style="padding: 8px; text-align: right;">${m.debito_lasciato ? '€' + formatNumber(m.debito_lasciato) : ''}</td>
        <td style="padding: 8px; text-align: right;">${m.credito_lasciato ? '€' + formatNumber(m.credito_lasciato) : ''}</td>
        <td style="padding: 8px; text-align: right;">${m.debito_saldato ? '€' + formatNumber(m.debito_saldato) : ''}</td>
        <td style="padding: 8px;">${escapeHtml(m.note || '')}</td>
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

  // Load existing data if available (with timeout to ensure DOM is ready)
  setTimeout(() => {
    loadExistingParticipantData(id, saldo);
    // Save original values after form is fully loaded
    setTimeout(() => saveOriginalParticipantValues(id), 10);
  }, 0);
}

function loadExistingParticipantData(id, saldo) {
  if (!existingConsegnaMovimenti) return;

  const movimento = existingConsegnaMovimenti.find(m => m.partecipante_id === id);
  if (!movimento) return;

  // Populate fields with existing data
  const contoProduttoreField = document.getElementById(`contoProduttore_${id}`);
  if (contoProduttoreField && movimento.conto_produttore) {
    contoProduttoreField.value = movimento.conto_produttore;
  }

  const importoField = document.getElementById(`importo_${id}`);
  if (importoField && movimento.importo_saldato) {
    importoField.value = movimento.importo_saldato;
  }

  const usaCreditoField = document.getElementById(`usaCredito_${id}`);
  const usaInteroCreditoCheckbox = document.getElementById(`usaInteroCreditoCheckbox_${id}`);

  if (usaCreditoField && movimento.usa_credito) {
    usaCreditoField.value = movimento.usa_credito;
    usaCreditoField.disabled = true; // Always disabled - system-managed

    // If usa_credito equals the full credit amount, check the "usa intero credito" checkbox
    if (usaInteroCreditoCheckbox && saldo > 0 && Math.abs(movimento.usa_credito - saldo) < 0.01) {
      usaInteroCreditoCheckbox.checked = true;
    }
  }

  const creditoField = document.getElementById(`credito_${id}`);
  if (creditoField && movimento.credito_lasciato) {
    creditoField.value = movimento.credito_lasciato;
  }

  const debitoField = document.getElementById(`debito_${id}`);
  if (debitoField && movimento.debito_lasciato) {
    debitoField.value = movimento.debito_lasciato;
  }

  const debitoSaldatoField = document.getElementById(`debitoSaldato_${id}`);
  if (debitoSaldatoField && movimento.debito_saldato) {
    debitoSaldatoField.value = movimento.debito_saldato;
    debitoSaldatoField.disabled = true; // Always disabled - system-managed
  }

  const noteField = document.getElementById(`note_${id}`);
  if (noteField && movimento.note) {
    noteField.value = movimento.note;
  }

  // Check and set checkboxes if applicable
  if (movimento.salda_debito_totale === 1) {
    const saldaCheckbox = document.getElementById(`saldaDebito_${id}`);
    if (saldaCheckbox) {
      saldaCheckbox.checked = true;
      const debitoSaldatoFieldInner = document.getElementById(`debitoSaldato_${id}`);
      if (debitoSaldatoFieldInner) {
        debitoSaldatoFieldInner.disabled = true;
      }
    }
  }

  // Apply business rules to correctly set disabled states based on loaded data
  handleCreditoDebitoInput(id, saldo);
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

    <button class="big-btn big-btn-success" onclick="saveParticipant(${id})">
      💾 Salva Movimento
    </button>
    <button class="big-btn big-btn-secondary" onclick="removeParticipant(${id})">
      ✖️ Chiudi
    </button>
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
    card.appendChild(createHiddenInput(`usaInteroCreditoCheckbox_${id}`, 'false'));
  }
  if (!haDebito) {
    card.appendChild(createHiddenInput(`saldaDebito_${id}`, 'false'));
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


// ===== PARTICIPANT INTERACTION =====

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

function validateCreditoMax(id, saldo) {
  const usaCreditoField = document.getElementById(`usaCredito_${id}`);
  if (!usaCreditoField) return;

  const value = parseAmount(usaCreditoField.value);
  if (value > saldo) {
    usaCreditoField.value = saldo;
    showStatus(`Non puoi usare più di €${formatSaldo(saldo)} di credito`, 'error');
  }
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

function handleCreditoDebitoInput(id, saldo) {
  // Credit/debt fields are now always disabled and auto-calculated
  const creditoLasciato = document.getElementById(`credito_${id}`);
  const debitoLasciato = document.getElementById(`debito_${id}`);
  const debitoSaldato = document.getElementById(`debitoSaldato_${id}`);
  const usaCredito = document.getElementById(`usaCredito_${id}`);

  // All compensation and result fields are always disabled - managed by system only
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
  // Rearranged: diff = importo_saldato + usa_credito - debito_saldato - conto_produttore
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

// ===== MOVEMENTS COUNTER =====

function updateMovimentiCounter() {
  // Counter removed - title is now just "MOVIMENTI"
}

// ===== UNSAVED CHANGES DETECTION =====

function saveOriginalParticipantValues(id) {
  originalParticipantValues[id] = {
    importo: document.getElementById(`importo_${id}`)?.value || '',
    usaCredito: document.getElementById(`usaCredito_${id}`)?.value || '',
    credito: document.getElementById(`credito_${id}`)?.value || '',
    debito: document.getElementById(`debito_${id}`)?.value || '',
    debitoSaldato: document.getElementById(`debitoSaldato_${id}`)?.value || '',
    note: document.getElementById(`note_${id}`)?.value || ''
  };
}

function hasUnsavedParticipantChanges(id) {
  if (!originalParticipantValues[id]) {
    return false;
  }

  const original = originalParticipantValues[id];
  const current = {
    importo: document.getElementById(`importo_${id}`)?.value || '',
    usaCredito: document.getElementById(`usaCredito_${id}`)?.value || '',
    credito: document.getElementById(`credito_${id}`)?.value || '',
    debito: document.getElementById(`debito_${id}`)?.value || '',
    debitoSaldato: document.getElementById(`debitoSaldato_${id}`)?.value || '',
    note: document.getElementById(`note_${id}`)?.value || ''
  };

  return original.importo !== current.importo ||
         original.usaCredito !== current.usaCredito ||
         original.credito !== current.credito ||
         original.debito !== current.debito ||
         original.debitoSaldato !== current.debitoSaldato ||
         original.note !== current.note;
}

// ===== PARTICIPANT FORM ACTIONS =====

async function saveParticipant(id) {
  const data = document.getElementById('data').value;
  const trovatoInCassa = roundUpCents(parseAmount(document.getElementById('trovatoInCassa').value));
  const pagatoProduttore = roundUpCents(parseAmount(document.getElementById('pagatoProduttore').value));
  const noteGiornata = document.getElementById('noteGiornata').value || '';

  if (!data) {
    showStatus('Inserisci la data', 'error');
    return;
  }

  const debitoLasciato = parseAmount(document.getElementById(`debito_${id}`).value);
  const creditoLasciato = parseAmount(document.getElementById(`credito_${id}`).value);

  if (debitoLasciato > 0 && creditoLasciato > 0) {
    showStatus(`Errore: non puoi lasciare sia credito che debito contemporaneamente`, 'error');
    return;
  }

  await saveWithParticipant(data, trovatoInCassa, pagatoProduttore, noteGiornata, id);
}

function removeParticipant(id) {
  // Check for unsaved changes
  if (hasUnsavedParticipantChanges(id)) {
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
  delete originalParticipantValues[id];

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
  const lasciatoInCassa = roundUpCents(parseAmount(document.getElementById('lasciatoInCassa').value));
  const noteGiornata = document.getElementById('noteGiornata').value || '';

  if (!data) {
    showStatus('Inserisci la data', 'error');
    return;
  }

  showStatus('Salvataggio dati cassa in corso...', 'success');

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
      showStatus('✓ Cassa salvata', 'success');
      await loadConsegneDates(); // Refresh calendar
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

  // Always read calculated values from DOM
  const lasciatoInCassa = roundUpCents(parseAmount(document.getElementById('lasciatoInCassa').value));

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
      delete originalParticipantValues[currentId];
    } else {
      showStatus('Errore: ' + result.error, 'error');
    }
  } catch (error) {
    showStatus('Errore durante il salvataggio: ' + error.message, 'error');
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize calendar with page-specific callback
  initCalendar({
    onDateSelected: checkDateData
  });

  try {
    const response = await fetch('/api/storico');
    const result = await response.json();

    if (result.success && result.consegne.length > 0) {
      // Populate consegneDates for calendar indicators
      const dates = result.consegne.map(c => c.data);
      setConsegneDates(dates);
    }
  } catch (error) {
    console.error('Error loading storico dates:', error);
  }

  // Use restoreDateFromStorage which handles reload vs tab navigation
  const dateToLoad = restoreDateFromStorage();
  setDateDisplay(dateToLoad);

  loadData();
});
