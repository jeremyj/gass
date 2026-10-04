// ===== SHARED CONSEGNA BUSINESS LOGIC =====
// Used by both consegna.js (mobile) and consegna-desktop.js
//
// Depends on these globals defined in page-specific JS:
//   participants, existingConsegnaMovimenti, saldiBefore,
//   currentConsegnaId, isConsegnaClosed
// and these page-specific functions: saveWithParticipant(id), saveCassaOnly() (desktop only)
// Depends on: utils.js, calendar.js (setDateDisplay, getSelectedDate), api-client.js (API)

// ===== OPENING =====

// Date to open: ?data= from Storico, else the server's pick (last turno to finish, or today)
async function dataIniziale() {
  const fromUrl = new URLSearchParams(location.search).get('data');
  // A real yyyy-mm-dd only: 2026-02-31 would roll over to March
  if (fromUrl && toLocalDateString(new Date(`${fromUrl}T00:00:00`)) === fromUrl) return fromUrl;
  try {
    return (await API.get('/api/consegna/apertura')).data;
  } catch (error) {
    return toLocalDateString();
  }
}

// Other consegne still open, each linked so someone completes it
async function renderAvvisoAperte() {
  const el = document.getElementById('avviso-aperte');
  if (!el) return;
  let aperte = [];
  try {
    aperte = (await API.get('/api/consegna/apertura')).aperte.filter(c => c.data !== getSelectedDate());
  } catch (error) {
    aperte = [];
  }
  // One sentence, however many: each date links to its consegna
  const links = aperte.map(c => `<a class="link-btn" href="${consegnaHref(c.data)}">${formatDateLong(c.data)}</a>`);
  const elenco = links.length > 1 ? `${links.slice(0, -1).join(', ')} e ${links[links.length - 1]}` : links[0];
  el.innerHTML = links.length > 1
    ? `<p>Sono ancora aperte le consegne di ${elenco}.</p>`
    : `<p>La consegna di ${elenco} è ancora aperta.</p>`;
  el.classList.toggle('initially-hidden', !aperte.length);
}

// ===== QUOTA TEATRO IN THE DAY'S LIST =====

// People who paid a quota teatro in this consegna but have no movimento
let teatroExtra = [];

// After a quota is recorded: show it in the list without reloading the page
function addTeatroToList(id, nome, importo) {
  const m = (existingConsegnaMovimenti || []).find(x => x.partecipante_id === id);
  const t = teatroExtra.find(x => x.user_id === id);
  if (m) m.teatro = roundToCents((m.teatro || 0) + importo);
  else if (t) t.importo = roundToCents(t.importo + importo);
  else teatroExtra.push({ user_id: id, nome, importo });
  renderMovimentiGiorno();
}

// "conto 15, pagato 25, salda debito 8, quota teatro 15" (mobile list rows)
function movimentoDetails(m) {
  const details = [`conto <b>${formatNumber(m.conto_produttore || 0)}</b>`, `pagato <b>${formatNumber(m.importo_saldato || 0)}</b>`];
  if (debitoPagato(m)) details.push(`salda debito <b>${formatNumber(debitoPagato(m))}</b>`);
  if (m.usa_credito) details.push(`usa credito <b>${formatNumber(m.usa_credito)}</b>`);
  if (m.teatro) details.push(`quota teatro <b>${formatNumber(m.teatro)}</b>`);
  return details.join(', ');
}

// ===== CASSA CALCULATIONS =====

function calculatePagatoProduttore() {
  let totalPagato = 0;
  if (existingConsegnaMovimenti && existingConsegnaMovimenti.length > 0) {
    existingConsegnaMovimenti.forEach(m => {
      totalPagato += (m.conto_produttore || 0);
    });
  }
  return roundToCents(totalPagato);
}

function calculateIncassato() {
  const movimenti = existingConsegnaMovimenti || [];
  return roundToCents(movimenti.reduce((sum, m) => sum + (m.importo_saldato || 0), 0));
}

function calculateLasciatoInCassa() {
  const trovatoInCassa = parseAmount(document.getElementById('trovatoInCassa').value);
  const pagatoProduttore = parseAmount(document.getElementById('pagatoProduttore').value);
  return roundToCents(trovatoInCassa + calculateIncassato() - pagatoProduttore - usciteCassaValue());
}

// ===== NOTE AND USCITE DI CASSA (saved together by the page's Salva button) =====

// Uscite rows of the form; rows left empty are dropped (that is how an uscita is removed)
function readUscite() {
  return [...document.querySelectorAll('#uscite-edit .uscita')].map(row => ({
    importo: roundToCents(parseAmount(row.querySelector('.uscita-importo').value)),
    motivo: row.querySelector('.uscita-motivo').value.trim()
  })).filter(u => u.importo || u.motivo);
}

function usciteCassaValue() {
  return roundToCents(readUscite().reduce((sum, u) => sum + u.importo, 0));
}

function usciteRowHtml(u = {}) {
  return `
    <div class="uscita">
      <input type="text" inputmode="decimal" class="input-field uscita-importo" placeholder="0" aria-label="Importo uscita"
             value="${u.importo ? formatNumber(u.importo) : ''}" oninput="normalizeInputField(this); onNoteGiornataChange()">
      <input type="text" class="input-field uscita-motivo" placeholder="Motivo, es. quote al teatro" aria-label="Motivo uscita"
             value="${escapeHtml(u.motivo || '')}" oninput="onNoteGiornataChange()">
      <button type="button" class="uscita-add" aria-label="Aggiungi un'altra uscita" onclick="addUscitaRow()">+</button>
    </div>`;
}

function addUscitaRow() {
  const list = document.getElementById('uscite-edit');
  list.insertAdjacentHTML('beforeend', usciteRowHtml());
  list.lastElementChild.querySelector('.uscita-importo').focus();
}

// Fill note and uscite from a saved consegna (null = new); returns the snapshot to detect changes against
function fillGiornata(consegna, uscite = []) {
  document.getElementById('noteGiornata').value = consegna?.note || '';
  document.getElementById('uscite-edit').innerHTML = (uscite.length ? uscite : [{}]).map(usciteRowHtml).join('');
  updateUsciteView();
  return giornataSnapshot();
}

function giornataSnapshot() {
  return JSON.stringify([document.getElementById('noteGiornata').value, readUscite()]);
}

function setGiornataDisabled(disabled) {
  document.querySelectorAll('#noteGiornata, #uscite-edit input, #uscite-edit button')
    .forEach(el => { el.disabled = disabled; });
}

// "teatro 45, tofu 20"; a single uscita shows only its motivo (the total is next to it)
function descrizioneUscite(uscite) {
  return uscite.length === 1 ? uscite[0].motivo : uscite.map(u => `${u.motivo} ${formatNumber(u.importo)}`).join(', ');
}

// The uscite line of the cassa, shown only when there are uscite
function updateUsciteView() {
  const view = document.getElementById('uscite-view');
  const uscite = usciteCassaValue();
  view.classList.toggle('initially-hidden', !(uscite > 0));
  view.querySelector('output').value = formatNumber(uscite);
  view.querySelector('.uscite-motivo').textContent = descrizioneUscite(readUscite());
}

// Incassato is display-only (the cassa row shows the whole sum trovato + incassato − pagato)
function updateIncassato() {
  const field = document.getElementById('incassatoCassa');
  if (field) field.value = formatNumber(calculateIncassato());
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
  updateIncassato();
  updateUsciteView();
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
      ? `Cassa negativa: mancano ${formatEuro(Math.abs(lasciato))}. Controlla i movimenti prima di chiudere.`
      : '';
    warning.style.display = negativa ? 'block' : 'none';
  }
}

// Summary of the current consegna shown in close/annulla confirmations
function consegnaSummaryDetails() {
  const amount = id => formatEuro(parseAmount(document.getElementById(id).value));
  return [
    ['Movimenti', String((existingConsegnaMovimenti || []).length)],
    ['Incassato', formatEuro(calculateIncassato())],
    ['Pagato produttore', amount('pagatoProduttore')],
    ...(usciteCassaValue() > 0 ? [['Uscite di cassa', formatEuro(usciteCassaValue())]] : []),
    ['Lasciato in cassa', amount('lasciatoInCassa')]
  ];
}

// ===== DATA LOADING =====

async function loadData() {
  try {
    const result = await API.get('/api/participants');
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

  select.innerHTML = '<option value="">+ Aggiungi partecipante</option>';

  // Disattivati can't be added (sospesi can); their saved movimenti still open from the day's list
  participants.filter(p => p.stato !== 'disattivato').forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.nome;
    select.appendChild(option);
  });
}

// Open a saved movimento from the day's list (same as picking the participant in the select)
function openMovimento(id) {
  const select = document.getElementById('participant-select');
  if (isConsegnaClosed || !select) return;
  if (!select.querySelector(`option[value="${id}"]`)) {
    const p = participants.find(p => p.id === id);
    select.add(new Option(p ? p.nome : id, id));
  }
  select.value = id;
  showParticipantForm();
  document.getElementById('selected-participants')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// The day's movimenti, shown as a list (mobile) or table (desktop): the outcome of one movimento
function esitoMovimento(m) {
  if (m.credito_lasciato > 0) return { cls: 'cr', amount: formatSigned(m.credito_lasciato), word: 'credito' };
  if (m.debito_lasciato > 0) return { cls: 'db', amount: formatSigned(-m.debito_lasciato), word: 'debito' };
  return { cls: '', amount: '–', word: 'saldato' }; // nothing left over today; the saldo may still hold older credit/debt
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
      const { canali } = await API.get('/api/consegna/report-canali').catch(() => ({ canali: [] }));
      const ok = await confirmDialog({
        title: 'Chiudere la consegna?',
        message: (negativa ? '⚠️ La cassa è negativa. ' : '') +
          'Dopo la chiusura i dati non potranno essere modificati (solo un admin può riaprirla).',
        details: consegnaSummaryDetails(),
        checks: canali.map(c => [c, c === 'telegram' ? 'Invia il report su Telegram' : 'Invia il report per email']),
        confirmText: 'Chiudi consegna',
        danger: true
      });
      if (!ok) return;
      await API.post(`/api/consegna/${currentConsegnaId}/close`, { report: Array.isArray(ok) ? ok : [] });
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
      debitoSaldato.value = formatNumber(debitoSaldabile);
    }
    diff = diff - debitoSaldabile;
  }

  let creditoUsabileUsed = 0;
  if (shouldAutoCompensate && diff < 0 && creditoPreesistente > 0) {
    const creditoUsabile = Math.min(Math.abs(diff), creditoPreesistente);
    creditoUsabileUsed = creditoUsabile;
    const usaTuttoIlCredito = creditoUsabile === creditoPreesistente;

    if (usaCredito) {
      usaCredito.value = formatNumber(creditoUsabile);
      usaCredito.dataset.full = usaTuttoIlCredito ? 'true' : '';
    }
    diff = diff + creditoUsabile;
  }

  if (creditoLasciato) {
    creditoLasciato.value = diff > 0 ? formatNumber(diff) : '';
  }
  if (debitoLasciato) {
    if (diff < 0) {
      debitoLasciato.value = formatNumber(-diff);
    } else {
      debitoLasciato.value = remainingDebtCarryForward > 0 ? formatNumber(remainingDebtCarryForward) : '';
    }
  }

  // Update debt status display in section title
  const remainingDebtEl = document.getElementById(`remainingDebt_${id}`);
  if (remainingDebtEl) {
    if (debitoSaldabileUsed > 0) {
      // Remaining debt is shown in the debitoLasciato field; only show "saldato!" when fully paid
      remainingDebtEl.textContent = remainingDebtCarryForward === 0 ? 'Debito saldato per intero' : '';
    } else if (diff < 0 && debitoPreesistente > 0) {
      remainingDebtEl.textContent = `Debito totale dopo oggi: ${formatEuro(debitoPreesistente + Math.abs(diff))}`;
    } else {
      remainingDebtEl.textContent = '';
    }
  }

  // Update new total credit display
  const remainingCreditEl = document.getElementById(`remainingCredit_${id}`);
  if (remainingCreditEl) {
    if (creditoUsabileUsed > 0) {
      const remaining = creditoPreesistente - creditoUsabileUsed;
      remainingCreditEl.textContent = remaining > 0 ? `Credito dopo oggi: ${formatEuro(remaining)}` : 'Credito usato per intero';
    } else if (diff > 0 && creditoPreesistente > 0) {
      remainingCreditEl.textContent = `Credito totale dopo oggi: ${formatEuro(creditoPreesistente + diff)}`;
    } else if (diff < 0 && creditoPreesistente > 0) {
      const newCredit = Math.round((creditoPreesistente + diff) * 100) / 100;
      if (newCredit > 0) {
        remainingCreditEl.textContent = `Credito dopo oggi: ${formatEuro(newCredit)}`;
      } else if (newCredit === 0) {
        remainingCreditEl.textContent = 'Credito usato per intero';
      } else {
        remainingCreditEl.textContent = `Debito dopo oggi: ${formatEuro(-newCredit)}`;
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
  syncResultVisibility(id);

  // The steps box shows only when it has a partial line or a status note in it
  const passi = document.getElementById(`passi_${id}`);
  if (passi) {
    const lines = [...passi.querySelectorAll('.computed')].some(el => el.style.display !== 'none');
    const notes = [...passi.querySelectorAll('.passo-note')].some(el => el.textContent !== '');
    passi.style.display = lines || notes ? '' : 'none';
  }
}

// The result shows "Lascia credito" or "Lascia debito" only when set, "In pari" otherwise
function syncResultVisibility(id) {
  const shown = {};
  ['credito', 'debito'].forEach(fieldId => {
    const field = document.getElementById(`${fieldId}_${id}`);
    shown[fieldId] = !!field && parseAmount(field.value) > 0;
    const group = field && field.closest('.form-group');
    if (group) group.style.display = shown[fieldId] ? '' : 'none';
  });
  const pari = document.getElementById(`pari_${id}`);
  if (pari) pari.style.display = shown.credito || shown.debito ? 'none' : '';
  const risult = document.getElementById(`risult_${id}`);
  if (risult) {
    risult.classList.toggle('is-cr', shown.credito);
    risult.classList.toggle('is-db', shown.debito);
  }
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
  renderQuoteOggi();
}

function hidePartecipantiSection() {
  const section = getPartecipantiSection();
  if (section) section.style.display = 'none';
  const btn = document.getElementById('btn-nuova-consegna');
  if (btn) btn.style.display = 'block';
  renderQuoteOggi();
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
  // Show the status line with only the annulla button (no consegna yet, so hide close/badges)
  const statusSection = document.getElementById('consegna-status-section');
  if (statusSection) statusSection.style.display = 'flex';
  ['close-consegna-btn', 'closed-badge'].forEach(elId => {
    const el = document.getElementById(elId);
    if (el) el.style.display = 'none';
  });
  const openBadge = document.getElementById('open-badge');
  if (openBadge) openBadge.style.display = 'inline';
  const annullaBtn = document.getElementById('btn-annulla-consegna');
  if (annullaBtn) annullaBtn.style.display = 'inline';
}

async function annullaConsegna() {
  if (currentConsegnaId) {
    const ok = await confirmDialog({
      title: 'Annullare la consegna?',
      message: 'La consegna e tutti i suoi movimenti verranno eliminati, e i saldi dei partecipanti ricalcolati. Anche le quote teatro registrate in questa consegna verranno eliminate.',
      details: consegnaSummaryDetails(),
      confirmText: 'Elimina consegna',
      danger: true
    });
    if (!ok) return;
    try {
      await API.delete(`/api/consegna/${currentConsegnaId}`);
      showStatus('Consegna annullata', 'success');
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

// A computed amount shown as a text line ("Salda parte del debito    3 €"); the disabled input
// keeps the value readMovimentoForm submits
function buildComputedLine(id, fieldId, label) {
  return `
    <p class="form-group computed">
      <label for="${fieldId}_${id}">${label}</label>
      <span><input type="text" id="${fieldId}_${id}" disabled> €</span>
    </p>
  `;
}

function saldoPrimaText(saldo) {
  if (saldo > 0) return `credito ${formatSigned(saldo)}`;
  if (saldo < 0) return `debito ${formatSigned(saldo)}`;
  return 'in pari';
}

function createHiddenInput(id, value) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.id = id;
  input.value = value;
  return input;
}

// ===== PARTICIPANT CARD =====

// Render the participant's movimento form and fill it from the saved movimento, if any.
// buttonsHtml is the page-specific button row. Returns false when the participant is unknown.
function renderParticipant(id, buttonsHtml) {
  const container = document.getElementById('selected-participants');
  const p = participants.find(part => part.id === id);
  if (!p) return false;

  const saldo = saldiBefore[id] !== undefined ? saldiBefore[id] : (p.saldo || 0);
  const haCredito = saldo > 0;
  const haDebito = saldo < 0;

  const card = document.createElement('div');
  card.className = 'participant-card-flow';
  card.innerHTML = buildParticipantCardHTML(id, p.nome, saldo, haCredito, haDebito, buttonsHtml);
  addHiddenFields(card, id, haCredito, haDebito);
  container.appendChild(card);

  populateExistingMovimento(id, saldo);
  if (document.getElementById(`contoProduttore_${id}`)?.value) {
    handleContoProduttoreInput(id, saldo);
  }
  syncDebitoCreditoVisibility(id);
  return true;
}

function populateExistingMovimento(id, saldo) {
  if (!existingConsegnaMovimenti) return;

  const movimento = existingConsegnaMovimenti.find(m => m.partecipante_id === id);
  if (!movimento) return;

  const fields = {
    [`contoProduttore_${id}`]: movimento.conto_produttore,
    [`importo_${id}`]: movimento.importo_saldato,
    [`usaCredito_${id}`]: movimento.usa_credito,
    [`credito_${id}`]: movimento.credito_lasciato,
    [`debito_${id}`]: movimento.debito_lasciato,
    [`debitoSaldato_${id}`]: movimento.debito_saldato,
    [`note_${id}`]: movimento.note
  };

  for (const [fieldId, value] of Object.entries(fields)) {
    const field = document.getElementById(fieldId);
    if (field && value) {
      field.value = fieldId.startsWith('note_') ? value : formatNumber(value);
    }
  }

  // Whole credit used / whole debt paid: shown in the section title instead of the partial field
  const usaCreditoField = document.getElementById(`usaCredito_${id}`);
  if (usaCreditoField && movimento.usa_credito && saldo > 0 && Math.abs(movimento.usa_credito - saldo) < 0.01) {
    usaCreditoField.dataset.full = 'true';
  }

  const debitoSaldatoField = document.getElementById(`debitoSaldato_${id}`);
  if (debitoSaldatoField && movimento.salda_debito_totale === 1) {
    debitoSaldatoField.dataset.full = 'true';
  }

  syncDebitoCreditoVisibility(id);
}

function buildParticipantCardHTML(id, nome, saldo, haCredito, haDebito, buttonsHtml) {
  const saldoClass = saldo > 0 ? 'cr' : saldo < 0 ? 'db' : '';
  return `
    <div class="entry-head">
      <button type="button" class="entry-back" onclick="closeParticipant(${id})" aria-label="Indietro">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>
      </button>
      <div>
        <h3 class="entry-name">${escapeHtml(nome)}</h3>
        <span class="pill ${saldoClass}">prima di oggi: ${saldoPrimaText(saldo)}</span>
      </div>
    </div>

    <div class="entry-body">
      <div class="entry-fields">
        <div class="form-group fld">
          <label for="contoProduttore_${id}">Conto produttore</label>
          <span class="fld-in"><input type="text" inputmode="decimal" id="contoProduttore_${id}" placeholder="0"
                 oninput="normalizeInputField(this); handleContoProduttoreInput(${id}, ${saldo})"
                 onfocus="handleInputFocus(this)"><span class="unit">€</span></span>
        </div>
        <div class="form-group fld">
          <label for="importo_${id}">Importo saldato</label>
          <span class="fld-in"><input type="text" inputmode="decimal" id="importo_${id}" placeholder="0"
                 oninput="normalizeInputField(this); handleContoProduttoreInput(${id}, ${saldo}); updateLasciatoInCassa()"
                 onfocus="handleInputFocus(this)"><span class="unit">€</span></span>
        </div>
      </div>

      <div class="passi" id="passi_${id}">
        ${haCredito ? buildComputedLine(id, 'usaCredito', 'Usa parte del credito') : ''}
        ${haDebito ? buildComputedLine(id, 'debitoSaldato', 'Salda parte del debito') : ''}
        ${haCredito ? `<p id="remainingCredit_${id}" class="passo-note"></p>` : ''}
        ${haDebito ? `<p id="remainingDebt_${id}" class="passo-note"></p>` : ''}
      </div>

      <div class="risult" id="risult_${id}">
        <div class="cr">${buildComputedLine(id, 'credito', 'Lascia credito')}</div>
        <div class="db">${buildComputedLine(id, 'debito', 'Lascia debito')}</div>
        <p id="pari_${id}" class="form-group computed"><label>Esito</label><span>saldato, niente da riportare</span></p>
      </div>

      <div class="form-group fld fld-note">
        <label for="note_${id}">Note</label>
        <input type="text" id="note_${id}" placeholder="Aggiungi una nota">
      </div>

      ${teatroButtonHtml(id)}

      ${buttonsHtml}
    </div>
  `;
}

// ===== QUOTA TEATRO =====
// Paid apart from the movimento: the money goes to the cassa teatro, not the consegna cassa

function teatroButtonHtml(id) {
  const residuo = participants.find(p => p.id === id)?.teatro_residuo || 0;
  if (residuo <= 0) return '';
  return `<div class="teatro-box" id="teatro_${id}">
    <button type="button" class="teatro-btn" onclick="openTeatro(${id})"><span>Quota teatro</span><span>dovuti ${formatEuro(residuo)} ▸</span></button>
  </div>`;
}

// Same rule as the server: the amount covers the owed semesters oldest first
function teatroAllocate(righe, importo) {
  let left = importo;
  return righe.map(r => {
    const resto = roundToCents(r.dovuto - r.pagato);
    const copre = Math.min(resto, Math.max(left, 0));
    left = roundToCents(left - copre);
    return { ...r, resto, copre };
  });
}

async function openTeatro(id) {
  const box = document.getElementById(`teatro_${id}`);
  try {
    const stato = await API.get(`/api/teatro/utente/${id}`);
    box.dataset.righe = JSON.stringify(stato.righe.filter(r => r.dovuto > r.pagato));
    box.innerHTML = `
      <h4><span>Quota teatro</span><span>dovuti ${formatEuro(stato.residuo)}</span></h4>
      <div id="teatroRighe_${id}"></div>
      <div class="form-group fld teatro-importo">
        <label for="teatroImporto_${id}" data-tip="teatro_versato">Importo versato</label>
        <span class="fld-in"><input type="text" inputmode="decimal" id="teatroImporto_${id}" placeholder="0"
              oninput="normalizeInputField(this); renderTeatro(${id})" onfocus="handleInputFocus(this)"><span class="unit">€</span></span>
      </div>
      <p class="teatro-resto" id="teatroResto_${id}"></p>
      <button type="button" class="btn btn-line" onclick="registraTeatro(${id})">Registra quota</button>`;
    renderTeatro(id);
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

function renderTeatro(id) {
  const box = document.getElementById(`teatro_${id}`);
  const importo = parseAmount(document.getElementById(`teatroImporto_${id}`).value) || 0;
  const righe = teatroAllocate(JSON.parse(box.dataset.righe), importo);
  document.getElementById(`teatroRighe_${id}`).innerHTML = righe.map(r => `
    <p class="teatro-riga"><span>${escapeHtml(r.label)} <small>da pagare ${formatEuro(r.resto)}</small></span>
      <b class="${r.copre >= r.resto ? 'ok' : r.copre > 0 ? 'part' : ''}">${r.copre >= r.resto ? `${formatEuro(r.copre)} ✓` : r.copre > 0 ? `${formatNumber(r.copre)} di ${formatEuro(r.resto)}` : '–'}</b></p>`).join('');
  const dovuto = righe.reduce((s, r) => s + r.resto, 0);
  const resto = roundToCents(dovuto - importo);
  document.getElementById(`teatroResto_${id}`).textContent = !importo ? '' : resto > 0
    ? `Resta da pagare ${formatEuro(resto)}` : resto < 0 ? `In anticipo ${formatEuro(-resto)} sul prossimo semestre` : 'Tutto pagato';
}

async function registraTeatro(id) {
  const importo = parseAmount(document.getElementById(`teatroImporto_${id}`).value);
  if (!(importo > 0)) return showStatus('Scrivi l\'importo versato', 'error');
  const p = participants.find(x => x.id === id);
  const ok = await confirmDialog({
    title: 'Registrare la quota teatro?',
    message: 'I soldi vanno nella cassa del teatro, non in quella della consegna.',
    details: [[p.nome, formatEuro(importo)], ['', document.getElementById(`teatroResto_${id}`).textContent]],
    confirmText: 'Registra quota'
  });
  if (!ok) return;
  try {
    // A quota is recorded inside a consegna: a new one not saved yet is saved first (cassa only)
    if (!currentConsegnaId) {
      await postConsegna([]);
      const { consegna } = await API.get(`/api/consegna/${document.getElementById('data').value}`);
      updateConsegnaStatusUI(consegna);
    }
    await API.post('/api/teatro/pagamenti', { userId: id, importo, consegnaId: currentConsegnaId });
    const stato = await API.get(`/api/teatro/utente/${id}`);
    p.teatro_residuo = roundToCents(stato.residuo - stato.anticipo);
    const box = document.getElementById(`teatro_${id}`);
    box.outerHTML = teatroButtonHtml(id) || `<p class="teatro-done">Quota teatro registrata: ${formatEuro(importo)}</p>`;
    showStatus('Quota teatro registrata', 'success');
    loadQuoteOggi();
    addTeatroToList(id, p.nome, importo);
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

// Quotas collected in this consegna, shown with the cassa but outside its totals
let quoteOggi = 0;

async function loadQuoteOggi() {
  try {
    quoteOggi = currentConsegnaId ? (await API.get(`/api/teatro/consegna/${currentConsegnaId}`)).totale : 0;
  } catch (error) {
    quoteOggi = 0;
  }
  renderQuoteOggi();
}

function renderQuoteOggi() {
  const el = document.getElementById('quote-teatro-oggi');
  if (!el) return;
  el.querySelector('output').textContent = formatEuro(quoteOggi);
  el.classList.toggle('initially-hidden', !quoteOggi);
}

function addHiddenFields(card, id, haCredito, haDebito) {
  if (!haCredito) {
    card.appendChild(createHiddenInput(`usaCredito_${id}`, '0'));
  }
  if (!haDebito) {
    card.appendChild(createHiddenInput(`debitoSaldato_${id}`, '0'));
  }
}

// ===== SAVE DATA =====

// The movimento as it will be submitted. debitoSaldato sends the whole prior debt
// (dataset.submitValue) while the field displays only the part paid now.
function readMovimentoForm(id) {
  const amount = fieldId => parseAmount(document.getElementById(fieldId)?.value || '0');
  const debitoSaldatoEl = document.getElementById(`debitoSaldato_${id}`);
  return {
    partecipante_id: id,
    contoProduttore: roundToCents(amount(`contoProduttore_${id}`)),
    importoSaldato: roundToCents(amount(`importo_${id}`)),
    usaCredito: amount(`usaCredito_${id}`),
    debitoLasciato: amount(`debito_${id}`),
    creditoLasciato: amount(`credito_${id}`),
    saldaDebitoTotale: debitoSaldatoEl?.dataset.full === 'true',
    debitoSaldato: parseAmount(debitoSaldatoEl?.dataset.submitValue || debitoSaldatoEl?.value || '0'),
    note: document.getElementById(`note_${id}`)?.value || ''
  };
}

// POST the consegna for the selected date with the current cassa fields and note
function postConsegna(partecipanti) {
  const amount = id => roundToCents(parseAmount(document.getElementById(id).value));
  return API.post('/api/consegna', {
    data: document.getElementById('data').value,
    trovatoInCassa: amount('trovatoInCassa'),
    pagatoProduttore: amount('pagatoProduttore'),
    lasciatoInCassa: amount('lasciatoInCassa'),
    noteGiornata: document.getElementById('noteGiornata').value || '',
    uscite: readUscite(),
    partecipanti,
  });
}

// Validate and save one participant's movimento (saveWithParticipant is page-specific)
async function saveParticipant(id) {
  if (!document.getElementById('data').value) {
    showStatus('Inserisci la data', 'error');
    return;
  }

  const debitoLasciato = parseAmount(document.getElementById(`debito_${id}`).value);
  const creditoLasciato = parseAmount(document.getElementById(`credito_${id}`).value);

  if (debitoLasciato > 0 && creditoLasciato > 0) {
    showStatus(`Errore: non puoi lasciare sia credito che debito contemporaneamente`, 'error');
    return;
  }

  if (!participants.find(p => p.id === id)) {
    showStatus('Partecipante non trovato', 'error');
    return;
  }

  // The quota teatro box is open but nothing was registered: ask before saving without it
  const teatroIn = document.getElementById(`teatroImporto_${id}`);
  if (teatroIn) {
    const importo = parseAmount(teatroIn.value) || 0;
    const ok = await confirmDialog({
      title: 'Quota teatro non registrata',
      message: importo > 0
        ? `Hai scritto ${formatEuro(importo)} di quota teatro ma non hai premuto "Registra quota". Il movimento si salva senza la quota.`
        : 'Hai aperto la quota teatro ma non hai registrato niente. Il movimento si salva senza la quota.',
      confirmText: 'Salva senza quota'
    });
    if (!ok) return;
  }

  await saveWithParticipant(id);
}

// Desktop form submit: cassa only, or the selected participant's movimento
async function saveData() {
  const currentId = parseInt(document.getElementById('participant-select').value);

  if (!currentId) {
    await saveCassaOnly();
    return;
  }

  await saveParticipant(currentId);
}
