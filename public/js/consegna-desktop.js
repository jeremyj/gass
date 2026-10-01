// ===== STATE MANAGEMENT =====

let participants = [];
let existingConsegnaMovimenti = null;
let saldiBefore = {};
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

  existingConsegnaMovimenti = result.movimenti || [];
  saldiBefore = result.saldiBefore || {};

  trovatoField.value = formatNumber(result.consegna.trovato_in_cassa || 0);
  pagatoField.value = formatNumber(result.consegna.pagato_produttore || 0);
  lasciatoField.value = formatNumber(result.consegna.lasciato_in_cassa || 0);
  updateIncassato();
  updateCassaWarning();

  originalNoteGiornata = result.consegna.note || '';
  document.getElementById('noteGiornata').value = originalNoteGiornata;
  noteGiornataModified = false;

  renderMovimentiGiorno();
  updateSaveButtonVisibility();
  updateConsegnaStatusUI(result.consegna);

  // Show participant section for existing consegna
  showPartecipantiSection();
  showNoteGiornata();
}

function loadNewConsegna(result) {
  const trovatoField = document.getElementById('trovatoInCassa');
  const pagatoField = document.getElementById('pagatoProduttore');
  const lasciatoField = document.getElementById('lasciatoInCassa');

  existingConsegnaMovimenti = [];
  saldiBefore = result.saldiBefore || {};

  const trovatoValue = result.lasciatoPrecedente ?? 0;
  trovatoField.value = formatNumber(trovatoValue);
  pagatoField.value = formatNumber(0);
  lasciatoField.value = formatNumber(trovatoValue);
  updateIncassato();
  updateCassaWarning();

  originalNoteGiornata = '';
  document.getElementById('noteGiornata').value = '';
  noteGiornataModified = false;

  renderMovimentiGiorno();
  updateSaveButtonVisibility();
  updateConsegnaStatusUI(null);

  // Hide participant section, show "Nuova Consegna" button
  hidePartecipantiSection();
  hideNoteGiornata();
}

// ===== RENDERING =====

// Zeros render as "–" so the real figures stand out
function cell(value, cls = '') {
  return value ? `<td class="${cls}">${formatNumber(value)}</td>` : '<td class="mute">–</td>';
}

function renderMovimentiGiorno() {
  const container = document.getElementById('movimenti-giorno');
  const movimenti = existingConsegnaMovimenti || [];

  if (movimenti.length === 0) {
    container.innerHTML = '';
    return;
  }

  const sum = fn => roundToCents(movimenti.reduce((acc, m) => acc + (fn(m) || 0), 0));
  const rows = movimenti.map(m => `
      <tr class="clickable" onclick="openMovimento(${m.partecipante_id})">
        <td class="nm">${escapeHtml(m.nome)}</td>
        ${cell(m.conto_produttore)}
        ${cell(m.importo_saldato)}
        ${m.credito_lasciato ? `<td class="cr">+${formatNumber(m.credito_lasciato)}</td>` : '<td class="mute">–</td>'}
        ${debitoNuovo(m) ? `<td class="db">−${formatNumber(debitoNuovo(m))}</td>` : '<td class="mute">–</td>'}
        ${cell(m.usa_credito)}
        ${cell(debitoPagato(m))}
        <td class="nt">${escapeHtml(m.note || '')}</td>
      </tr>
    `).join('');

  container.innerHTML = `
    <table class="t">
      <thead>
        <tr>
          <th>Partecipante</th>
          <th>Conto produttore</th>
          <th>Importo saldato</th>
          <th>Lascia credito</th>
          <th>Lascia debito</th>
          <th>Usa credito</th>
          <th>Salda debito</th>
          <th class="nt">Note</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td>Totale</td>
          ${cell(sum(m => m.conto_produttore))}
          ${cell(sum(m => m.importo_saldato))}
          ${cell(sum(m => m.credito_lasciato))}
          ${cell(sum(debitoNuovo))}
          ${cell(sum(m => m.usa_credito))}
          ${cell(sum(debitoPagato))}
          <td></td>
        </tr>
      </tfoot>
    </table>
  `;
}

const PARTICIPANT_BUTTONS_HTML = `
    <div class="entry-actions">
      <button type="button" class="btn btn-line" onclick="closeParticipant()">Annulla</button>
      <button type="submit" class="btn btn-go" id="save-btn-participant-inline">Salva movimento</button>
    </div>
  `;

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

  renderParticipant(id, PARTICIPANT_BUTTONS_HTML);
  updateLasciatoInCassa();
  updateSaveButtonVisibility();
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

  if (isConsegnaClosed) {
    saveBtnCassa.style.display = 'none';
    return;
  }

  if (noteGiornataModified) {
    saveBtnCassa.style.display = 'inline-block';
  } else {
    saveBtnCassa.style.display = 'none';
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

  if (!currentConsegnaId) {
    statusSection.style.display = 'none';
    enableConsegnaInputs(); // Restore inputs for dates with no consegna
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
    disableConsegnaInputs();
  } else {
    enableConsegnaInputs();
  }
}

function disableConsegnaInputs() {
  const noteField = document.getElementById('noteGiornata');
  if (noteField) noteField.disabled = true;

  const select = document.getElementById('participant-select');
  if (select) select.disabled = true;

  document.querySelector('.container')?.classList.add('consegna-closed');

  const saveBtnCassa = document.getElementById('save-btn-cassa');
  if (saveBtnCassa) saveBtnCassa.style.display = 'none';
}

function enableConsegnaInputs() {
  const noteField = document.getElementById('noteGiornata');
  if (noteField) noteField.disabled = false;

  const select = document.getElementById('participant-select');
  if (select) select.disabled = false;

  document.querySelector('.container')?.classList.remove('consegna-closed');
}

function closeParticipant() {
  const select = document.getElementById('participant-select');
  select.value = '';
  showParticipantForm();
}

// ===== SAVE DATA =====

async function saveCassaOnly() {
  if (!document.getElementById('data').value) {
    showStatus('Inserisci la data', 'error');
    return;
  }

  showStatus('Salvataggio dati cassa in corso...', 'success');

  try {
    await postConsegna([]);

    showStatus('Dati cassa salvati con successo!', 'success');
    originalNoteGiornata = document.getElementById('noteGiornata').value || '';
    noteGiornataModified = false;
    setTimeout(() => checkDateData(), 1000);
  } catch (error) {
    showStatus('Errore durante il salvataggio: ' + error.message, 'error');
  }
}

async function saveWithParticipant(currentId) {
  showStatus('Salvataggio in corso...', 'success');

  try {
    await postConsegna([readMovimentoForm(currentId)]);

    showStatus('Movimento salvato', 'success');
    setTimeout(() => {
      document.getElementById('selected-participants').innerHTML = '';
      document.getElementById('participant-select').value = '';
      checkDateData();
      updateSaveButtonVisibility();
    }, 1000);
  } catch (error) {
    showStatus('Errore durante il salvataggio: ' + error.message, 'error');
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
  initCalendar({ onDateSelected: checkDateData });

  // Ensure user data is loaded before rendering consegna status
  await sessionReady;
  await loadConsegneDates();

  const dateToLoad = restoreDateFromStorage();
  setDateDisplay(dateToLoad); // triggers checkDateData → loadData(dateValue)
});
