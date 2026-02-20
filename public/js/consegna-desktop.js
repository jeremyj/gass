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

  existingConsegnaMovimenti = result.movimenti || [];
  saldiBefore = result.saldiBefore || {};

  trovatoField.value = formatNumber(result.consegna.trovato_in_cassa || 0);
  pagatoField.value = formatNumber(result.consegna.pagato_produttore || 0);
  lasciatoField.value = formatNumber(result.consegna.lasciato_in_cassa || 0);

  originalNoteGiornata = result.consegna.note || '';
  document.getElementById('noteGiornata').value = originalNoteGiornata;
  noteGiornataModified = false;

  renderMovimentiGiorno();
  updateSaveButtonVisibility();
  updateConsegnaStatusUI(result.consegna);

  // Show participant section for existing consegna
  showPartecipantiSection();
  const annullaBtn = document.getElementById('btn-annulla-consegna');
  if (annullaBtn) annullaBtn.style.display = isConsegnaClosed ? 'none' : '';
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

  originalNoteGiornata = '';
  document.getElementById('noteGiornata').value = '';
  noteGiornataModified = false;

  renderMovimentiGiorno();
  updateSaveButtonVisibility();
  updateConsegnaStatusUI(null);

  // Hide participant section, show "Nuova Consegna" button
  hidePartecipantiSection();
}

// ===== RENDERING =====

function renderMovimentiGiorno() {
  const container = document.getElementById('movimenti-giorno');

  if (!existingConsegnaMovimenti || existingConsegnaMovimenti.length === 0) {
    container.innerHTML = '';
    return;
  }

  const rows = existingConsegnaMovimenti.map((m) => {
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

  populateExistingMovimento(id);
  syncDebitoCreditoVisibility(id);
}

function populateExistingMovimento(id) {
  if (!existingConsegnaMovimenti || existingConsegnaMovimenti.length === 0) {
    return;
  }

  const movimento = existingConsegnaMovimenti.find(m => m.partecipante_id === id);
  if (!movimento) {
    return;
  }

  const p = participants.find(part => part.id === id);
  const saldo = saldiBefore[id] !== undefined ? saldiBefore[id] : (p ? p.saldo || 0 : 0);

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
      if (fieldId.includes('usaCredito_') || fieldId.includes('debitoSaldato_')) {
        field.disabled = true;
      }
    }
  }

  const usaCreditoField = document.getElementById(`usaCredito_${id}`);
  const usaInteroCreditoCheckbox = document.getElementById(`usaInteroCreditoCheckbox_${id}`);

  if (usaCreditoField && movimento.usa_credito && usaInteroCreditoCheckbox && saldo > 0) {
    if (Math.abs(movimento.usa_credito - saldo) < 0.01) {
      usaInteroCreditoCheckbox.checked = true;
      usaCreditoField.disabled = true;
    }
  }

  if (movimento.salda_debito_totale === 1) {
    const saldaCheckbox = document.getElementById(`saldaDebito_${id}`);
    if (saldaCheckbox) {
      saldaCheckbox.checked = true;
      const debitoSaldatoField = document.getElementById(`debitoSaldato_${id}`);
      if (debitoSaldatoField) {
        debitoSaldatoField.disabled = true;
      }
    }
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

    <div class="flow-section flow-btn-row">
      <button type="submit" class="btn-save" id="save-btn-participant-inline">
        💾 Salva Movimento
      </button>
      <button type="button" class="btn-secondary" onclick="clearParticipantForm()">
        Annulla
      </button>
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

  if (currentConsegnaId) {
    statusSection.style.display = 'flex';

    if (isConsegnaClosed) {
      closedBadge.style.display = 'inline-block';
      if (isAdmin()) {
        closeBtn.style.display = 'inline-block';
        closeBtn.innerHTML = '🔓 Riapri Consegna';
        closeBtn.className = 'btn-success';
      } else {
        closeBtn.style.display = 'none';
      }
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
    enableConsegnaInputs(); // Restore inputs for dates with no consegna
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

function clearParticipantForm() {
  const select = document.getElementById('participant-select');
  select.value = '';
  showParticipantForm();
}

// ===== SAVE DATA =====

async function saveCassaOnly() {
  const data = document.getElementById('data').value;
  const trovatoInCassa = roundUpCents(parseAmount(document.getElementById('trovatoInCassa').value));
  const pagatoProduttore = roundUpCents(parseAmount(document.getElementById('pagatoProduttore').value));
  const noteGiornata = document.getElementById('noteGiornata').value || '';

  if (!data) {
    showStatus('Inserisci la data', 'error');
    return;
  }

  showStatus('Salvataggio dati cassa in corso...', 'success');

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

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
  initCalendar({ onDateSelected: checkDateData });

  // Ensure user data is loaded before rendering consegna status
  await checkSession();
  await loadConsegneDates();

  const dateToLoad = restoreDateFromStorage();
  setDateDisplay(dateToLoad); // triggers checkDateData → loadData(dateValue)
});
