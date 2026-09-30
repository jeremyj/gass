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

// ===== DATA LOADING =====

async function checkDateData() {
  const dateValue = document.getElementById('data').value;
  if (!dateValue) return;

  try {
    await loadData(dateValue);

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

  renderMovimentiGiorno();
  updateNoteButtonVisibility();

  // Update consegna status (closed/open)
  updateConsegnaStatusUI(result.consegna);

  // Show participant section for existing consegna
  showPartecipantiSection();
  showNoteGiornata();
}

function loadNewConsegna(result) {
  const trovatoField = document.getElementById('trovatoInCassa');
  const noteField = document.getElementById('noteGiornata');

  // Clear movements
  existingConsegnaMovimenti = null;
  saldiBefore = result.saldiBefore || {};

  // Set trovato from previous lasciato, formatted
  trovatoField.value = formatNumber(result.lasciatoPrecedente ?? 0);

  // Reset note tracking
  originalNoteGiornata = '';
  noteField.value = '';
  noteGiornataModified = false;

  // Calculate and display pagato and lasciato
  updatePagatoProduttore();
  updateLasciatoInCassa();

  renderMovimentiGiorno();
  updateNoteButtonVisibility();

  // No consegna exists yet - hide status section
  updateConsegnaStatusUI(null);

  // Hide participant section, show "Nuova Consegna" button
  hidePartecipantiSection();
  hideNoteGiornata();
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

  const annullaBtn = document.getElementById('btn-annulla-consegna');

  // Only show section if consegna exists
  if (currentConsegnaId) {
    statusSection.style.display = 'block';

    if (isConsegnaClosed) {
      closedBadge.style.display = 'block';
      if (isAdmin()) {
        closeBtn.style.display = 'block';
        closeBtn.innerHTML = '🔓 Riapri Consegna';
        closeBtn.classList.remove('big-btn-danger');
        closeBtn.classList.add('big-btn-success');
      } else {
        closeBtn.style.display = 'none';
      }
      if (annullaBtn) annullaBtn.style.display = 'none';
      // Disable all inputs when consegna is closed (admin must reopen first to edit)
      disableConsegnaInputs();
    } else {
      closedBadge.style.display = 'none';
      closeBtn.style.display = 'block';
      closeBtn.innerHTML = '🔒 Chiudi Consegna';
      closeBtn.classList.remove('big-btn-success');
      closeBtn.classList.add('big-btn-danger');
      // Deleting a saved consegna is admin-only (server enforces it too)
      if (annullaBtn) annullaBtn.style.display = isAdmin() ? 'block' : 'none';
      enableConsegnaInputs();
    }
  } else {
    statusSection.style.display = 'none';
    enableConsegnaInputs(); // Restore inputs/visibility for dates with no consegna
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
  const movimentiSection = document.getElementById('section-movimenti');
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
  const movimentiSection = document.getElementById('section-movimenti');
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

function renderMovimentiGiorno() {
  const container = document.getElementById('movimenti-giorno');
  if (!container) return;

  if (!existingConsegnaMovimenti || existingConsegnaMovimenti.length === 0) {
    container.innerHTML = '';
    return;
  }

  const rows = existingConsegnaMovimenti.map((m) => {
    return `
      <tr>
        <td><strong>${escapeHtml(m.nome)}</strong></td>
        <td class="text-right">${m.importo_saldato ? '€' + formatNumber(m.importo_saldato) : ''}</td>
        <td class="text-right">${m.usa_credito ? '€' + formatNumber(m.usa_credito) : ''}</td>
        <td class="text-right">${debitoNuovo(m) ? '€' + formatNumber(debitoNuovo(m)) : ''}</td>
        <td class="text-right">${m.credito_lasciato ? '€' + formatNumber(m.credito_lasciato) : ''}</td>
        <td class="text-right">${debitoPagato(m) ? '€' + formatNumber(debitoPagato(m)) : ''}</td>
        <td>${escapeHtml(m.note || '')}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <h3 style="margin-bottom: 10px;">Movimenti del Giorno</h3>
    <table class="movimenti-giorno-table">
      <thead><tr>
        <th>Nome</th>
        <th class="text-right">Importo Saldato</th>
        <th class="text-right">Usa Credito</th>
        <th class="text-right">Debito Lasciato</th>
        <th class="text-right">Credito Lasciato</th>
        <th class="text-right">Debito Saldato</th>
        <th>Note</th>
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

  const saldoText = saldo !== 0 ? `€${formatSaldo(saldo)}` : 'IN PARI';
  const saldoClass = saldo < 0 ? 'saldo-debito' : saldo > 0 ? 'saldo-credito' : '';

  const card = document.createElement('div');
  card.className = 'participant-card-flow';
  card.innerHTML = buildParticipantCardHTML(id, p.nome, saldo, saldoText, saldoClass, haCredito, haDebito);
  addHiddenFields(card, id, haCredito, haDebito);
  container.appendChild(card);

  // Load existing data if available (with timeout to ensure DOM is ready)
  setTimeout(() => {
    loadExistingParticipantData(id, saldo);
    if (document.getElementById(`contoProduttore_${id}`)?.value) {
      handleContoProduttoreInput(id, saldo);
    }
    syncDebitoCreditoVisibility(id);
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

  if (usaCreditoField && movimento.usa_credito) {
    usaCreditoField.value = movimento.usa_credito;
    // Whole credit used: shown in the section title instead of the partial field
    usaCreditoField.dataset.full = saldo > 0 && Math.abs(movimento.usa_credito - saldo) < 0.01 ? 'true' : '';
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
  }

  const noteField = document.getElementById(`note_${id}`);
  if (noteField && movimento.note) {
    noteField.value = movimento.note;
  }

  // Whole debt paid: shown in the section title instead of the partial field
  if (debitoSaldatoField && movimento.salda_debito_totale === 1) {
    debitoSaldatoField.dataset.full = 'true';
  }

  syncDebitoCreditoVisibility(id);
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

    ${haCredito ? buildCreditoSection(id, saldoText, saldoClass) : ''}
    ${haDebito ? buildDebitoSection(id, saldoText, saldoClass) : ''}

    <div class="flow-section">
      <div class="row">
        <div class="form-group">
          <label>Lascia credito:</label>
          <input type="text" inputmode="decimal" id="credito_${id}" placeholder="0.00" disabled>
        </div>
        <div class="form-group">
          <label>Lascia debito:</label>
          <input type="text" inputmode="decimal" id="debito_${id}" placeholder="0.00" disabled>
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

function addHiddenFields(card, id, haCredito, haDebito) {
  if (!haCredito) {
    card.appendChild(createHiddenInput(`usaCredito_${id}`, '0'));
  }
  if (!haDebito) {
    card.appendChild(createHiddenInput(`debitoSaldato_${id}`, '0'));
  }
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

// ===== UNSAVED CHANGES DETECTION =====

// Compare what would be submitted, so the check matches the save exactly
function saveOriginalParticipantValues(id) {
  originalParticipantValues[id] = JSON.stringify(readMovimentoForm(id));
}

function hasUnsavedParticipantChanges(id) {
  if (!originalParticipantValues[id]) {
    return false;
  }
  return originalParticipantValues[id] !== JSON.stringify(readMovimentoForm(id));
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

async function removeParticipant(id) {
  // Check for unsaved changes
  if (hasUnsavedParticipantChanges(id)) {
    const ok = await confirmDialog({
      title: 'Modifiche non salvate',
      message: 'Vuoi chiudere senza salvare?',
      confirmText: 'Chiudi senza salvare',
      danger: true
    });
    if (!ok) return; // User cancelled, keep form open
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

  const partecipantiData = [readMovimentoForm(currentId)];

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

  await loadConsegneDates();

  // Use restoreDateFromStorage which handles reload vs tab navigation
  const dateToLoad = restoreDateFromStorage();
  setDateDisplay(dateToLoad); // triggers checkDateData → loadData(dateValue)
});
