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

// ===== DATA LOADING =====

async function checkDateData() {
  const dateValue = document.getElementById('data').value;
  if (!dateValue) return;

  try {
    await loadData(dateValue);

    const result = await API.get(`/api/consegna/${dateValue}`);

    if (result.found) {
      loadExistingConsegna(result);
    } else {
      loadNewConsegna(result);
    }

    // Close any open participant card when date changes
    const container = document.getElementById('selected-participants');
    if (container) container.innerHTML = '';

    const select = document.getElementById('participant-select');
    if (select) select.value = '';

    // Clear saved original values
    originalParticipantValues = {};

    renderAvvisoAperte();
  } catch (error) {
    console.error('Error checking date data:', error);
  }
}

function loadExistingConsegna(result) {
  const trovatoField = document.getElementById('trovatoInCassa');
  const noteField = document.getElementById('noteGiornata');

  // Load movements first (needed for calculations)
  existingConsegnaMovimenti = result.movimenti || [];
  teatroExtra = result.teatroExtra || [];
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
  teatroExtra = [];
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
  loadQuoteOggi();
  isConsegnaClosed = consegna?.chiusa === true;

  const statusSection = document.getElementById('consegna-status-section');
  if (!statusSection) return;

  const closeBtn = document.getElementById('close-consegna-btn');
  const annullaBtn = document.getElementById('btn-annulla-consegna');

  // Only show the status line if the consegna exists
  if (!currentConsegnaId) {
    statusSection.style.display = 'none';
    enableConsegnaInputs(); // Restore inputs/visibility for dates with no consegna
    return;
  }

  statusSection.style.display = 'flex';
  document.getElementById('closed-badge').style.display = isConsegnaClosed ? 'inline' : 'none';
  document.getElementById('open-badge').style.display = isConsegnaClosed ? 'none' : 'inline';
  closeBtn.textContent = isConsegnaClosed ? 'Riapri consegna' : 'Chiudi consegna';
  // Anyone can close; only an admin can reopen or delete a saved consegna (server enforces it too)
  closeBtn.style.display = !isConsegnaClosed || isAdmin() ? 'inline' : 'none';
  annullaBtn.style.display = !isConsegnaClosed && isAdmin() ? 'inline' : 'none';

  if (isConsegnaClosed) {
    disableConsegnaInputs(); // admin must reopen first to edit
  } else {
    enableConsegnaInputs();
  }
}

// A closed consegna keeps its list of movimenti visible, read-only (.consegna-closed hides the add select)
function disableConsegnaInputs() {
  const noteField = document.getElementById('noteGiornata');
  if (noteField) noteField.disabled = true;

  const select = document.getElementById('participant-select');
  if (select) select.disabled = true;

  document.querySelector('.container')?.classList.add('consegna-closed');

  const saveNoteBtn = document.getElementById('save-note-btn');
  if (saveNoteBtn) saveNoteBtn.style.display = 'none';
}

function enableConsegnaInputs() {
  const noteField = document.getElementById('noteGiornata');
  if (noteField) noteField.disabled = false;

  const select = document.getElementById('participant-select');
  if (select) select.disabled = false;

  document.querySelector('.container')?.classList.remove('consegna-closed');
}

async function saveNoteOnly() {
  const noteGiornata = document.getElementById('noteGiornata').value || '';

  if (!getSelectedDate()) {
    showStatus('Errore: data non valida', 'error');
    return;
  }

  showStatus('Salvataggio note in corso...', 'success');

  try {
    await postConsegna([]);

    showStatus('Note salvate con successo!', 'success');
    // Reset note modified flag
    originalNoteGiornata = noteGiornata;
    noteGiornataModified = false;
    updateNoteButtonVisibility();
    // Reload to get fresh data
    setTimeout(() => checkDateData(), 1000);
  } catch (error) {
    showStatus('Errore durante il salvataggio: ' + error.message, 'error');
  }
}

// ===== RENDERING =====

function renderMovimentiGiorno() {
  const container = document.getElementById('movimenti-giorno');
  if (!container) return;

  const movimenti = existingConsegnaMovimenti || [];
  const count = document.getElementById('movimenti-count');
  if (count) count.textContent = movimenti.length === 1 ? '1 partecipante' : `${movimenti.length} partecipanti`;

  container.innerHTML = movimenti.map(m => {
    const esito = esitoMovimento(m);
    return `
      <li onclick="openMovimento(${m.partecipante_id})">
        <span class="nm">${escapeHtml(m.nome)}</span>
        <span class="sub">${movimentoDetails(m)}</span>
        <span class="esito ${esito.cls}"><b>${esito.amount}</b><small>${esito.word}</small></span>
        ${m.note ? `<span class="nota">${escapeHtml(m.note)}</span>` : ''}
      </li>
    `;
  }).join('') + teatroExtra.map(t => `
      <li class="inert">
        <span class="nm">${escapeHtml(t.nome)}</span>
        <span class="sub">quota teatro <b>${formatNumber(t.importo)}</b></span>
        <span class="esito"><b>–</b><small>solo teatro</small></span>
      </li>
  `).join('');
}

function participantButtonsHTML(id) {
  return `
    <div class="entry-actions">
      <button type="button" class="btn btn-line" onclick="closeParticipant(${id})">Annulla</button>
      <button type="button" class="btn btn-go" onclick="saveParticipant(${id})">Salva movimento</button>
    </div>
  `;
}

function showParticipantForm() {
  const select = document.getElementById('participant-select');
  if (!select) return;

  const id = parseInt(select.value);

  const container = document.getElementById('selected-participants');
  if (!container) return;

  container.innerHTML = '';

  if (!id) {
    updateLasciatoInCassa();
    return;
  }

  if (renderParticipant(id, participantButtonsHTML(id))) {
    saveOriginalParticipantValues(id);
  }
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

async function closeParticipant(id) {
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

  // Clear saved values
  delete originalParticipantValues[id];

  updateLasciatoInCassa();
}

// ===== SAVE DATA =====

async function saveWithParticipant(currentId) {
  showStatus('Salvataggio in corso...', 'success');

  try {
    await postConsegna([readMovimentoForm(currentId)]);

    showStatus('Movimento salvato', 'success');

    // Reload consegna data to get updated movements
    await checkDateData();


    // Close participant card after save
    const container = document.getElementById('selected-participants');
    container.innerHTML = '';

    const select = document.getElementById('participant-select');
    select.value = '';

    // Clear saved values
    delete originalParticipantValues[currentId];
  } catch (error) {
    showStatus('Errore durante il salvataggio: ' + error.message, 'error');
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
  // Reopen/annulla are admin-only: know the user before rendering the consegna status
  await sessionReady;
  setDateDisplay(await dataIniziale());
  checkDateData();
});
