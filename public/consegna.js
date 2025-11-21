// ===== STATE MANAGEMENT =====

let participants = [];
let existingConsegnaMovimenti = null;
let saldiBefore = {};

// Calendar state now managed in calendar.js

// Track original values for unsaved changes detection
let originalParticipantValues = {};

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
  noteField.value = result.consegna.note || '';

  // Calculate and display pagato and lasciato
  updatePagatoProduttore();
  updateLasciatoInCassa();

  updateMovimentiCounter();
  renderMovimentiGiorno();
}

function loadNewConsegna(result) {
  const trovatoField = document.getElementById('trovatoInCassa');
  const noteField = document.getElementById('noteGiornata');

  // Clear movements
  existingConsegnaMovimenti = null;
  saldiBefore = {};

  // Set trovato from previous lasciato, formatted
  trovatoField.value = formatNumber(result.lasciatoPrecedente ?? 0);
  noteField.value = '';

  // Calculate and display pagato and lasciato
  updatePagatoProduttore();
  updateLasciatoInCassa();

  updateMovimentiCounter();
  renderMovimentiGiorno();
}


// ===== RENDERING =====

function renderParticipantSelect() {
  const select = document.getElementById('participant-select');
  if (!select) return;

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
  if (!select) return;

  const nome = select.value;

  const container = document.getElementById('selected-participants');
  if (!container) return;

  container.innerHTML = '';

  const infoBadge = document.getElementById('participant-info-badge');

  if (!nome) {
    if (infoBadge) infoBadge.style.display = 'block';
    updateLasciatoInCassa();
    return;
  }

  if (infoBadge) infoBadge.style.display = 'none';
  renderParticipant(nome);
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
        <td style="padding: 8px;"><strong>${m.nome}</strong></td>
        <td style="padding: 8px; text-align: right;">${m.importo_saldato ? '€' + formatNumber(m.importo_saldato) : ''}</td>
        <td style="padding: 8px; text-align: right;">${m.usa_credito ? '€' + formatNumber(m.usa_credito) : ''}</td>
        <td style="padding: 8px; text-align: right;">${m.debito_lasciato ? '€' + formatNumber(m.debito_lasciato) : ''}</td>
        <td style="padding: 8px; text-align: right;">${m.credito_lasciato ? '€' + formatNumber(m.credito_lasciato) : ''}</td>
        <td style="padding: 8px; text-align: right;">${m.debito_saldato ? '€' + formatNumber(m.debito_saldato) : ''}</td>
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
  const contoProduttoreField = document.getElementById(`contoProduttore_${nome}`);
  if (contoProduttoreField && movimento.conto_produttore) {
    contoProduttoreField.value = movimento.conto_produttore;
  }

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

  // Apply business rules to correctly set disabled states based on loaded data
  // This ensures that when user unchecks a checkbox, the fields don't remain incorrectly disabled
  handleCreditoDebitoInput(nome, saldo);
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
          <input type="text" inputmode="decimal" id="credito_${nome}" placeholder="0.00" disabled
                 oninput="normalizeInputField(this); delete this.dataset.autoCalculated; handleCreditoDebitoInput('${nome}', ${saldo})"
                 onfocus="handleInputFocus(this)">
        </div>
        <div class="form-group">
          <label>Lascia debito:</label>
          <input type="text" inputmode="decimal" id="debito_${nome}" placeholder="0.00" disabled
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

  // Trigger auto-calculation with new usaCredito value
  handleContoProduttoreInput(nome, saldo);
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

  // Trigger auto-calculation with new debitoSaldato value
  handleContoProduttoreInput(nome, saldo);
  handleCreditoDebitoInput(nome, saldo);
}

function handleCreditoDebitoInput(nome, saldo) {
  // Credit/debt fields are now always disabled and auto-calculated
  // This function only manages debitoSaldato field state
  const creditoLasciato = document.getElementById(`credito_${nome}`);
  const debitoLasciato = document.getElementById(`debito_${nome}`);
  const debitoSaldato = document.getElementById(`debitoSaldato_${nome}`);
  const saldaDebitoCheckbox = document.getElementById(`saldaDebito_${nome}`);
  const usaCredito = document.getElementById(`usaCredito_${nome}`);

  const usaCreditoValue = usaCredito ? parseAmount(usaCredito.value) : 0;
  const debitoSaldatoValue = debitoSaldato ? parseAmount(debitoSaldato.value) : 0;
  const saldaDebitoChecked = saldaDebitoCheckbox && saldaDebitoCheckbox.checked;

  const creditoDisponibile = saldo > 0 ? saldo : 0;
  const usaCreditoParziale = usaCreditoValue > 0 && usaCreditoValue < creditoDisponibile;
  const saldaDebito = saldaDebitoChecked || debitoSaldatoValue > 0;

  // Ensure credit/debt fields are always disabled
  if (creditoLasciato) creditoLasciato.disabled = true;
  if (debitoLasciato) debitoLasciato.disabled = true;

  // Reset debitoSaldato and checkbox
  if (debitoSaldato) debitoSaldato.disabled = false;
  if (saldaDebitoCheckbox) saldaDebitoCheckbox.disabled = false;

  // Apply business rules for debitoSaldato
  if (usaCreditoParziale && saldaDebitoCheckbox) {
    saldaDebitoCheckbox.disabled = true;
  }

  if (saldaDebito && debitoSaldato) {
    debitoSaldato.disabled = true;
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

  let diff = importoSaldatoValue + usaCreditoValue - debitoSaldatoValue - contoProduttoreValue;

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

  // AUTO-COMPENSATION: If we're leaving credit but participant has existing debt, auto-compensate
  const debitoPreesistente = saldo < 0 ? Math.abs(saldo) : 0;
  const saldaDebitoCheckbox = document.getElementById(`saldaDebito_${nome}`);

  if (diff > 0 && debitoPreesistente > 0) {
    // We have credit that can compensate existing debt
    if (diff >= debitoPreesistente) {
      // Credit fully covers debt - auto-check "Salda intero debito"
      if (debitoSaldato) {
        debitoSaldato.value = roundUpCents(debitoPreesistente);
        debitoSaldato.disabled = true;
      }
      if (saldaDebitoCheckbox) {
        saldaDebitoCheckbox.checked = true;
      }
      // Recalculate diff after debt compensation
      diff = diff - debitoPreesistente;
    } else {
      // Credit partially covers debt - auto-populate partial payment
      if (debitoSaldato) {
        debitoSaldato.value = roundUpCents(diff);
        debitoSaldato.disabled = false; // Allow manual adjustment for partial payment
      }
      if (saldaDebitoCheckbox) {
        saldaDebitoCheckbox.checked = false;
      }
      // All credit used for debt payment
      diff = 0;
    }
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
        discrepanzaCassa: 0,
        discrepanzaTrovata: 0,
        discrepanzaPagato: 0,
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

async function saveWithParticipant(data, trovatoInCassa, pagatoProduttore, noteGiornata, currentNome) {
  showStatus('Salvataggio in corso...', 'success');

  const p = participants.find(part => part.nome === currentNome);
  if (!p) {
    showStatus('Partecipante non trovato', 'error');
    return;
  }

  const contoProduttore = roundUpCents(parseAmount(document.getElementById(`contoProduttore_${currentNome}`).value));
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
    contoProduttore, importoSaldato, usaCredito, debitoLasciato, creditoLasciato,
    saldaDebitoTotale, debitoSaldato, note,
    nuovoSaldo: roundUpCents(saldoCorrente)
  }];

  // Always read calculated values from DOM
  const lasciatoInCassa = roundUpCents(parseAmount(document.getElementById('lasciatoInCassa').value));

  try {
    const response = await fetch('/api/consegna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data, trovatoInCassa, pagatoProduttore, lasciatoInCassa,
        discrepanzaCassa: 0,
        discrepanzaTrovata: 0,
        discrepanzaPagato: 0,
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
  // Initialize calendar with page-specific callback
  initCalendar({
    onDateSelected: checkDateData
  });

  // With empty database, always use today instead of potentially stale localStorage date
  const savedDate = localStorage.getItem('gass_selected_date');

  try {
    const response = await fetch('/api/storico');
    const result = await response.json();

    if (result.success && result.consegne.length > 0) {
      // Populate consegneDates for calendar indicators
      const dates = result.consegne.map(c => c.data);
      setConsegneDates(dates);

      // Use saved date if available, otherwise use last consegna
      const dateToLoad = savedDate || result.consegne[0].data;
      setDateDisplay(dateToLoad);
    } else {
      // Empty database: ignore saved date, always use today
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
