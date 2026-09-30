// ===== SHARED CONSEGNA BUSINESS LOGIC =====
// Used by both consegna.js (mobile) and consegna-desktop.js
//
// Depends on these globals defined in page-specific JS:
//   participants, existingConsegnaMovimenti, saldiBefore,
//   currentConsegnaId, isConsegnaClosed
// Depends on: utils.js, calendar.js (loadConsegneDates, getSelectedDate), api-client.js (API)

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
  updateCassaWarning();
}

// Flag a negative lasciato in cassa while the consegna is still being entered
function updateCassaWarning() {
  const lasciatoField = document.getElementById('lasciatoInCassa');
  const warning = document.getElementById('cassa-warning');
  const lasciato = parseAmount(lasciatoField.value);
  const negativa = lasciato < 0;

  lasciatoField.classList.toggle('input-cassa-negativa', negativa);
  if (warning) {
    warning.textContent = negativa
      ? `⚠️ Cassa negativa: mancano €${formatSaldo(lasciato)}. Controlla i movimenti prima di chiudere.`
      : '';
    warning.style.display = negativa ? 'block' : 'none';
  }
}

// Summary of the current consegna shown in close/annulla confirmations
function consegnaSummaryDetails() {
  const movimenti = existingConsegnaMovimenti || [];
  const incassato = movimenti.reduce((sum, m) => sum + (m.importo_saldato || 0), 0);
  return [
    ['Movimenti', String(movimenti.length)],
    ['Incassato', `€${formatNumber(roundUpCents(incassato))}`],
    ['Pagato produttore', `€${document.getElementById('pagatoProduttore').value || '0'}`],
    ['Lasciato in cassa', `€${document.getElementById('lasciatoInCassa').value || '0'}`]
  ];
}

// ===== DATA LOADING =====

async function loadData(date = null) {
  try {
    let url = '/api/participants';
    if (date) {
      const today = toLocalDateString();
      if (date !== today) {
        url += `?date=${date}`;
      }
    }

    const result = await API.get(url);
    participants = result.participants;
    renderParticipantSelect();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
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
      await API.post(`/api/consegna/${currentConsegnaId}/reopen`, {});
      showStatus('Consegna riaperta', 'success');
    } else {
      const negativa = parseAmount(document.getElementById('lasciatoInCassa').value) < 0;
      const ok = await confirmDialog({
        title: 'Chiudere la consegna?',
        message: (negativa ? '⚠️ La cassa è negativa. ' : '') +
          'Dopo la chiusura i dati non potranno essere modificati (solo un admin può riaprirla).',
        details: consegnaSummaryDetails(),
        confirmText: 'Chiudi consegna',
        danger: true
      });
      if (!ok) return;
      await API.post(`/api/consegna/${currentConsegnaId}/close`, {});
      showStatus('Consegna chiusa', 'success');
    }
    await checkDateData();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

// ===== CREDIT/DEBIT HANDLING =====

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
    const remainingCreditEl = document.getElementById(`remainingCredit_${id}`);
    if (remainingCreditEl) remainingCreditEl.textContent = '';
    const remainingDebtEl = document.getElementById(`remainingDebt_${id}`);
    if (remainingDebtEl) remainingDebtEl.textContent = '';
    syncDebitoCreditoVisibility(id);
    return;
  }

  const shouldAutoCompensate = importoSaldatoValue > 0;
  const debitoPreesistente = saldo < 0 ? Math.abs(saldo) : 0;
  const creditoPreesistente = saldo > 0 ? saldo : 0;

  let diff = Math.round((importoSaldatoValue - contoProduttoreValue) * 100) / 100;

  // dataset.full marks a debt paid off / credit used up entirely (shown in the section title, not in the field)
  if (usaCredito) {
    usaCredito.value = '';
    usaCredito.dataset.full = '';
  }
  if (debitoSaldato) {
    debitoSaldato.value = '';
    debitoSaldato.dataset.submitValue = '';
    debitoSaldato.dataset.full = '';
  }

  let debitoSaldabileUsed = 0;
  let remainingDebtCarryForward = 0;
  if (shouldAutoCompensate && diff > 0 && debitoPreesistente > 0) {
    const debitoSaldabile = Math.min(diff, debitoPreesistente);
    debitoSaldabileUsed = debitoSaldabile;
    remainingDebtCarryForward = Math.round((debitoPreesistente - debitoSaldabile) * 100) / 100;
    const saldaTuttoIlDebito = debitoSaldabile === debitoPreesistente;

    if (debitoSaldato) {
      debitoSaldato.dataset.submitValue = String(debitoPreesistente);
      debitoSaldato.dataset.full = saldaTuttoIlDebito ? 'true' : '';
      debitoSaldato.value = debitoSaldabile;
    }
    diff = diff - debitoSaldabile;
  }

  let creditoUsabileUsed = 0;
  if (shouldAutoCompensate && diff < 0 && creditoPreesistente > 0) {
    const creditoUsabile = Math.min(Math.abs(diff), creditoPreesistente);
    creditoUsabileUsed = creditoUsabile;
    const usaTuttoIlCredito = creditoUsabile === creditoPreesistente;

    if (usaCredito) {
      usaCredito.value = creditoUsabile;
      usaCredito.dataset.full = usaTuttoIlCredito ? 'true' : '';
    }
    diff = diff + creditoUsabile;
  }

  if (creditoLasciato) {
    creditoLasciato.value = diff > 0 ? diff : '';
  }
  if (debitoLasciato) {
    if (diff < 0) {
      debitoLasciato.value = -diff;
    } else {
      debitoLasciato.value = remainingDebtCarryForward > 0 ? remainingDebtCarryForward : '';
    }
  }

  // Update debt status display in section title
  const remainingDebtEl = document.getElementById(`remainingDebt_${id}`);
  if (remainingDebtEl) {
    if (debitoSaldabileUsed > 0) {
      // Remaining debt is shown in the debitoLasciato field; only show "saldato!" when fully paid
      remainingDebtEl.textContent = remainingDebtCarryForward === 0 ? '👉 debito saldato' : '';
    } else if (diff < 0 && debitoPreesistente > 0) {
      remainingDebtEl.textContent = `👉 nuovo debito €${formatNumber(debitoPreesistente + Math.abs(diff))}`;
    } else {
      remainingDebtEl.textContent = '';
    }
  }

  // Update new total credit display
  const remainingCreditEl = document.getElementById(`remainingCredit_${id}`);
  if (remainingCreditEl) {
    if (creditoUsabileUsed > 0) {
      const remaining = creditoPreesistente - creditoUsabileUsed;
      remainingCreditEl.textContent = remaining > 0 ? `👉 nuovo credito €${formatNumber(remaining)}` : '👉 credito esaurito';
    } else if (diff > 0 && creditoPreesistente > 0) {
      remainingCreditEl.textContent = `👉 nuovo credito €${formatNumber(creditoPreesistente + diff)}`;
    } else if (diff < 0 && creditoPreesistente > 0) {
      const newCredit = Math.round((creditoPreesistente + diff) * 100) / 100;
      if (newCredit > 0) {
        remainingCreditEl.textContent = `👉 nuovo credito €${formatNumber(newCredit)}`;
      } else if (newCredit === 0) {
        remainingCreditEl.textContent = '👉 credito esaurito';
      } else {
        remainingCreditEl.textContent = `👉 nuovo debito €${formatNumber(-newCredit)}`;
      }
    } else {
      remainingCreditEl.textContent = '';
    }
  }

  syncDebitoCreditoVisibility(id);
}

// The partial field shows only when part of the debt/credit is used; a full payoff shows in the title
function syncPartialFieldVisibility(id, fieldId) {
  const field = document.getElementById(`${fieldId}_${id}`);
  const group = field && field.closest('.form-group');
  if (!group) return;
  const importo = document.getElementById(`importo_${id}`);
  const hasImporto = importo && parseAmount(importo.value) > 0;
  const partial = hasImporto && parseAmount(field.value) > 0 && field.dataset.full !== 'true';
  group.style.display = partial ? '' : 'none';
}

function syncDebitoCreditoVisibility(id) {
  syncPartialFieldVisibility(id, 'debitoSaldato');
  syncPartialFieldVisibility(id, 'usaCredito');
}

// ===== NUOVA CONSEGNA FLOW =====

function getPartecipantiSection() {
  return document.getElementById('section-movimenti') || document.getElementById('section-partecipanti');
}

function showPartecipantiSection() {
  const section = getPartecipantiSection();
  if (section) section.style.display = 'block';
  const btn = document.getElementById('btn-nuova-consegna');
  if (btn) btn.style.display = 'none';
}

function hidePartecipantiSection() {
  const section = getPartecipantiSection();
  if (section) section.style.display = 'none';
  const btn = document.getElementById('btn-nuova-consegna');
  if (btn) btn.style.display = 'block';
}

function showNoteGiornata() {
  const group = document.getElementById('note-giornata-group');
  if (group) group.style.display = 'block';
}

function hideNoteGiornata() {
  const group = document.getElementById('note-giornata-group');
  if (group) group.style.display = 'none';
}

function startNuovaConsegna() {
  showPartecipantiSection();
  showNoteGiornata();
  // Show status section with only annulla button (no consegna yet, so hide close/badge)
  const statusSection = document.getElementById('consegna-status-section');
  if (statusSection) statusSection.style.display = statusSection.closest('.section') ? 'flex' : 'block';
  const closeBtn = document.getElementById('close-consegna-btn');
  if (closeBtn) closeBtn.style.display = 'none';
  const closedBadge = document.getElementById('closed-badge');
  if (closedBadge) closedBadge.style.display = 'none';
  const annullaBtn = document.getElementById('btn-annulla-consegna');
  if (annullaBtn) annullaBtn.style.display = statusSection?.closest('.section') ? 'inline-block' : 'block';
}

async function annullaConsegna() {
  if (currentConsegnaId) {
    const ok = await confirmDialog({
      title: 'Annullare la consegna?',
      message: 'La consegna e tutti i suoi movimenti verranno eliminati, e i saldi dei partecipanti ricalcolati.',
      details: consegnaSummaryDetails(),
      confirmText: 'Elimina consegna',
      danger: true
    });
    if (!ok) return;
    try {
      await API.delete(`/api/consegna/${currentConsegnaId}`);
      showStatus('Consegna annullata', 'success');
      await loadConsegneDates();
      await checkDateData();
    } catch (error) {
      showStatus('Errore: ' + error.message, 'error');
    }
  } else {
    hidePartecipantiSection();
    hideNoteGiornata();
    const statusSection = document.getElementById('consegna-status-section');
    if (statusSection) statusSection.style.display = 'none';
  }
}

// ===== SECTION BUILDERS =====

function buildCreditoSection(id, saldoText, saldoClass) {
  return `
    <div class="flow-section flow-credito">
      <div class="flow-section-title">
        <span>CREDITO<span class="saldo-info ${saldoClass}">${escapeHtml(saldoText)}</span><span id="remainingCredit_${id}" class="remaining-debt-info"></span></span>
      </div>
      <div class="form-group">
        <label>Usa credito parziale:</label>
        <input type="text" inputmode="decimal" id="usaCredito_${id}" placeholder="0.00" disabled>
      </div>
    </div>
  `;
}

function buildDebitoSection(id, saldoText, saldoClass) {
  return `
    <div class="flow-section flow-debito">
      <div class="flow-section-title">
        <span>DEBITO INIZIALE<span class="saldo-info ${saldoClass}">${escapeHtml(saldoText)}</span><span id="remainingDebt_${id}" class="remaining-debt-info"></span></span>
      </div>
      <div class="form-group">
        <label>Salda parziale:</label>
        <input type="text" inputmode="decimal" id="debitoSaldato_${id}" placeholder="0.00" disabled>
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

// The movimento as it will be submitted. debitoSaldato sends the whole prior debt
// (dataset.submitValue) while the field displays only the part paid now.
function readMovimentoForm(id) {
  const amount = fieldId => parseAmount(document.getElementById(fieldId)?.value || '0');
  const debitoSaldatoEl = document.getElementById(`debitoSaldato_${id}`);
  return {
    partecipante_id: id,
    contoProduttore: roundUpCents(amount(`contoProduttore_${id}`)),
    importoSaldato: roundUpCents(amount(`importo_${id}`)),
    usaCredito: amount(`usaCredito_${id}`),
    debitoLasciato: amount(`debito_${id}`),
    creditoLasciato: amount(`credito_${id}`),
    saldaDebitoTotale: debitoSaldatoEl?.dataset.full === 'true',
    debitoSaldato: parseAmount(debitoSaldatoEl?.dataset.submitValue || debitoSaldatoEl?.value || '0'),
    note: document.getElementById(`note_${id}`)?.value || ''
  };
}

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
