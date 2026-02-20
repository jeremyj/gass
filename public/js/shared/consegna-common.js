// ===== SHARED CONSEGNA BUSINESS LOGIC =====
// Used by both consegna.js (mobile) and consegna-desktop.js
//
// Depends on these globals defined in page-specific JS:
//   participants, existingConsegnaMovimenti, saldiBefore,
//   currentConsegnaId, isConsegnaClosed
// Depends on: utils.js, calendar.js (setConsegneDates, getSelectedDate), api-client.js (API)

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
  const value = calculatePagatoProduttore();
  pagatoField.value = formatNumber(value);
}

function updateLasciatoInCassa() {
  const lasciatoField = document.getElementById('lasciatoInCassa');
  const value = calculateLasciatoInCassa();
  lasciatoField.value = formatNumber(value);
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

async function loadConsegneDates() {
  try {
    const response = await fetch('/api/storico');
    const result = await response.json();

    if (result.success) {
      setConsegneDates(result.consegne.map(c => c.data));
    }
  } catch (error) {
    console.error('Error loading consegne dates:', error);
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

// ===== CONSEGNA STATUS =====

async function toggleConsegnaStatus() {
  if (!currentConsegnaId) return;

  try {
    if (isConsegnaClosed) {
      await API.reopenConsegna(currentConsegnaId);
      showStatus('Consegna riaperta', 'success');
    } else {
      if (!confirm('Sei sicuro di voler chiudere questa consegna? I dati non potranno essere modificati.')) return;
      await API.closeConsegna(currentConsegnaId);
      showStatus('Consegna chiusa', 'success');
    }
    await checkDateData();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

// ===== CREDIT/DEBIT HANDLING =====

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
  // Credit/debt fields are always disabled and auto-calculated
  const creditoLasciato = document.getElementById(`credito_${id}`);
  const debitoLasciato = document.getElementById(`debito_${id}`);
  const usaCredito = document.getElementById(`usaCredito_${id}`);
  const debitoSaldato = document.getElementById(`debitoSaldato_${id}`);

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

  if (importoSaldatoValue === 0 && usaCreditoValue === 0 && debitoSaldatoValue === 0 && contoProduttoreValue === 0) {
    syncDebitoCreditoVisibility(id);
    return;
  }

  const creditoValue = creditoLasciato ? parseAmount(creditoLasciato.value) : 0;
  const debitoValue = debitoLasciato ? parseAmount(debitoLasciato.value) : 0;

  const creditoIsManual = creditoLasciato && creditoValue > 0 && creditoLasciato.dataset.autoCalculated !== 'true' && !creditoLasciato.disabled;
  const debitoIsManual = debitoLasciato && debitoValue > 0 && debitoLasciato.dataset.autoCalculated !== 'true' && !debitoLasciato.disabled;

  if (creditoIsManual || debitoIsManual) {
    return;
  }

  const shouldAutoCompensate = contoProduttoreValue > 0;
  const debitoPreesistente = saldo < 0 ? Math.abs(saldo) : 0;
  const creditoPreesistente = saldo > 0 ? saldo : 0;
  const saldaDebitoCheckbox = document.getElementById(`saldaDebito_${id}`);
  const usaInteroCreditoCheckbox = document.getElementById(`usaInteroCreditoCheckbox_${id}`);

  let diff = importoSaldatoValue - contoProduttoreValue;

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

  if (shouldAutoCompensate && diff > 0 && debitoPreesistente > 0) {
    const debitoSaldabile = Math.min(diff, debitoPreesistente);
    const saldaTuttoIlDebito = debitoSaldabile === debitoPreesistente;

    if (debitoSaldato) {
      debitoSaldato.value = roundUpCents(debitoSaldabile);
      debitoSaldato.disabled = true;
    }
    if (saldaDebitoCheckbox) {
      saldaDebitoCheckbox.checked = saldaTuttoIlDebito;
    }
    diff = diff - debitoSaldabile;
  }

  if (shouldAutoCompensate && diff < 0 && creditoPreesistente > 0) {
    const creditoUsabile = Math.min(Math.abs(diff), creditoPreesistente);
    const usaTuttoIlCredito = creditoUsabile === creditoPreesistente;

    if (usaCredito) {
      usaCredito.value = roundUpCents(creditoUsabile);
      usaCredito.disabled = true;
    }
    if (usaInteroCreditoCheckbox) {
      usaInteroCreditoCheckbox.checked = usaTuttoIlCredito;
    }
    diff = diff + creditoUsabile;
  }

  if (diff > 0) {
    if (creditoLasciato) {
      creditoLasciato.value = roundUpCents(diff);
      creditoLasciato.disabled = true;
    }
    if (debitoLasciato) {
      debitoLasciato.value = '';
      debitoLasciato.disabled = true;
    }
  } else if (diff < 0) {
    if (debitoLasciato) {
      debitoLasciato.value = roundUpCents(-diff);
      debitoLasciato.disabled = true;
    }
    if (creditoLasciato) {
      creditoLasciato.value = '';
      creditoLasciato.disabled = true;
    }
  } else {
    if (creditoLasciato) {
      creditoLasciato.value = '';
      creditoLasciato.disabled = true;
    }
    if (debitoLasciato) {
      debitoLasciato.value = '';
      debitoLasciato.disabled = true;
    }
  }

  syncDebitoCreditoVisibility(id);
}

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

  syncDebitoVisibility(id);
  handleContoProduttoreInput(id, saldo);
  handleCreditoDebitoInput(id, saldo);
}

function syncDebitoVisibility(id) {
  const checkbox = document.getElementById(`saldaDebito_${id}`);
  const debitoField = document.getElementById(`debitoSaldato_${id}`);
  if (!checkbox || !debitoField) return;

  const importo = document.getElementById(`importo_${id}`);
  const hasImporto = importo && parseAmount(importo.value) > 0;

  const checkboxGroup = checkbox.closest('.checkbox-group');
  const partialGroup = debitoField.closest('.form-group');

  if (!hasImporto) {
    if (checkboxGroup) checkboxGroup.style.display = 'none';
    if (partialGroup) partialGroup.style.display = 'none';
    return;
  }

  const isChecked = checkbox.checked;
  const partialValue = parseAmount(debitoField.value);

  // Hide both when no debt is being paid (nothing auto-filled nor manually entered)
  if (!isChecked && partialValue === 0) {
    if (checkboxGroup) checkboxGroup.style.display = 'none';
    if (partialGroup) partialGroup.style.display = 'none';
    return;
  }

  // Mutual exclusivity: hide checkbox only when partial has value AND checkbox not checked
  const hasPartialValue = !isChecked && partialValue > 0;
  if (checkboxGroup) checkboxGroup.style.display = hasPartialValue ? 'none' : '';
  if (partialGroup) partialGroup.style.display = isChecked ? 'none' : '';
}

function syncCreditoVisibility(id) {
  const checkbox = document.getElementById(`usaInteroCreditoCheckbox_${id}`);
  const usaCreditoField = document.getElementById(`usaCredito_${id}`);
  if (!checkbox || !usaCreditoField) return;

  const importo = document.getElementById(`importo_${id}`);
  const hasImporto = importo && parseAmount(importo.value) > 0;

  const checkboxGroup = checkbox.closest('.checkbox-group');
  const formGroup = usaCreditoField.closest('.form-group');

  // Show only when importo is present AND credit is being used (checkbox checked or partial entered)
  const show = hasImporto && (checkbox.checked || parseAmount(usaCreditoField.value) > 0);
  if (checkboxGroup) checkboxGroup.style.display = show ? '' : 'none';
  if (formGroup) formGroup.style.display = show ? '' : 'none';
}

function syncDebitoCreditoVisibility(id) {
  syncDebitoVisibility(id);
  syncCreditoVisibility(id);
}

// ===== NUOVA CONSEGNA FLOW =====

function getPartecipantiSection() {
  return document.getElementById('section-movimenti') || document.getElementById('section-partecipanti');
}

function showPartecipantiSection() {
  const section = getPartecipantiSection();
  if (section) section.style.display = '';
  const btn = document.getElementById('btn-nuova-consegna');
  if (btn) btn.style.display = 'none';
}

function hidePartecipantiSection() {
  const section = getPartecipantiSection();
  if (section) section.style.display = 'none';
  const btn = document.getElementById('btn-nuova-consegna');
  if (btn) btn.style.display = '';
  const annullaBtn = document.getElementById('btn-annulla-consegna');
  if (annullaBtn) annullaBtn.style.display = 'none';
}

function startNuovaConsegna() {
  showPartecipantiSection();
  const annullaBtn = document.getElementById('btn-annulla-consegna');
  if (annullaBtn) annullaBtn.style.display = '';
}

async function annullaConsegna() {
  if (currentConsegnaId) {
    if (!confirm('Sei sicuro di voler annullare questa consegna? Tutti i movimenti verranno eliminati.')) return;
    try {
      const response = await fetch(`/api/consegna/${currentConsegnaId}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        showStatus('Consegna annullata', 'success');
        await loadConsegneDates();
        await checkDateData();
      } else {
        showStatus('Errore: ' + result.error, 'error');
      }
    } catch (error) {
      showStatus('Errore: ' + error.message, 'error');
    }
  } else {
    hidePartecipantiSection();
  }
}

// ===== SECTION BUILDERS =====

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
               oninput="normalizeInputField(this); syncDebitoVisibility(${id}); handleContoProduttoreInput(${id}, ${saldo}); handleCreditoDebitoInput(${id}, ${saldo})"
               onfocus="handleInputFocus(this)">
      </div>
    </div>
  `;
}

function createHiddenInput(id, value) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.id = id;
  input.value = value;
  return input;
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
