let participants = [];
let existingConsegnaMovimenti = null; // Store existing movimenti for the selected date
let saldiBefore = {}; // Store saldi before the existing consegna
let discrepanzaCassaEnabled = false; // Track discrepanza cassa checkbox state
let totalImportoSaldatoBefore = 0; // Store total importo_saldato before editing

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status ' + type;
    setTimeout(() => {
        status.className = 'status';
    }, 5000);
}

function normalizeDecimal(value) {
    if (typeof value === 'string') {
        return value.replace(',', '.');
    }
    return value;
}

function parseAmount(value) {
    const normalized = normalizeDecimal(value);
    return parseFloat(normalized) || 0;
}

function normalizeInputField(input) {
    // Replace comma with dot in real-time
    if (input.value.includes(',')) {
        const cursorPos = input.selectionStart;
        input.value = input.value.replace(',', '.');
        input.setSelectionRange(cursorPos, cursorPos);
    }

    // Validate it's a valid decimal number (allow numbers, single dot, optional negative)
    const valid = /^-?\d*\.?\d*$/.test(input.value);
    if (!valid && input.value !== '') {
        // Remove invalid characters
        input.value = input.value.slice(0, -1);
    }
}

function handleInputFocus(input) {
    if (input.value === '0' || input.value === '0.0' || input.value === '0.00') {
        input.value = '';
    }
}

function roundUpCents(amount) {
    return Math.round(amount * 10) / 10;
}

function formatSaldo(val) {
    const formatted = Math.abs(val).toFixed(1);
    return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
}

function formatDateItalian(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

function updateDateDisplay() {
    const dateInput = document.getElementById('data');
    const displayInput = document.getElementById('data-display');
    if (dateInput.value) {
        displayInput.value = formatDateItalian(dateInput.value);
        checkDateData();
    }
}

async function loadData() {
    showStatus('Caricamento in corso...', 'success');

    try {
        const response = await fetch('/api/participants');
        const result = await response.json();

        if (result.success) {
            participants = result.participants;
            renderParticipantSelect();
            document.getElementById('data').valueAsDate = new Date();
            updateDateDisplay();
            showStatus('Dati caricati con successo!', 'success');
        } else {
            showStatus('Errore: ' + result.error, 'error');
        }
    } catch (error) {
        showStatus('Errore: ' + error.message, 'error');
    }
}

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

    if (!nome) {
        // Reset total importo to include all movements
        if (existingConsegnaMovimenti && existingConsegnaMovimenti.length > 0) {
            totalImportoSaldatoBefore = 0;
            existingConsegnaMovimenti.forEach(m => {
                totalImportoSaldatoBefore += m.importo_saldato || 0;
            });
        }
        updateLasciatoInCassa();
        return;
    }

    // Aggiorna totalImportoSaldatoBefore escludendo il partecipante corrente
    totalImportoSaldatoBefore = 0;
    if (existingConsegnaMovimenti && existingConsegnaMovimenti.length > 0) {
        existingConsegnaMovimenti.forEach(m => {
            if (m.nome !== nome) {
                totalImportoSaldatoBefore += m.importo_saldato || 0;
            }
        });
    }

    renderParticipant(nome);
    updateLasciatoInCassa();
}

function renderParticipant(nome) {
    const container = document.getElementById('selected-participants');
    const p = participants.find(part => part.nome === nome);
    if (!p) return;

    // Use saldo before this consegna if editing existing
    let saldo = saldiBefore[nome] !== undefined ? saldiBefore[nome] : (p.saldo || 0);
    const haCredito = saldo > 0;
    const haDebito = saldo < 0;

    const saldoText = saldo < 0
        ? `DEBITO: €${formatSaldo(saldo)}`
        : saldo > 0
            ? `CREDITO: €${formatSaldo(saldo)}`
            : 'IN PARI';
    const saldoClass = saldo < 0 ? 'saldo-debito' : saldo > 0 ? 'saldo-credito' : '';

    const card = document.createElement('div');
    card.className = 'participant-card-flow';
    card.innerHTML = `
        <div class="flow-header">
            <div class="participant-name">${nome}</div>
            <div class="saldo-info ${saldoClass}">${saldoText}</div>
        </div>

        <div class="flow-section">
            <div class="flow-section-title">1. PAGAMENTO OGGI</div>
            <div class="form-group">
                <label>Importo saldato:</label>
                <input type="text" inputmode="decimal" id="importo_${nome}" placeholder="0.00" oninput="normalizeInputField(this); updateLasciatoInCassa()" onfocus="handleInputFocus(this)">
            </div>
        </div>

        ${haCredito ? `
        <div class="flow-section flow-credito">
            <div class="flow-section-title">2. USA SALDO PRECEDENTE</div>
            <div class="checkbox-group">
                <input type="checkbox" id="usaInteroCreditoCheckbox_${nome}" onchange="toggleUsaInteroCredito('${nome}', ${saldo})">
                <label for="usaInteroCreditoCheckbox_${nome}">Usa intero credito €${formatSaldo(saldo)}</label>
            </div>
            <div class="form-group">
                <label>Usa credito parziale:</label>
                <input type="text" inputmode="decimal" id="usaCredito_${nome}" placeholder="0.00" oninput="normalizeInputField(this); validateCreditoMax('${nome}', ${saldo}); handleCreditoDebitoInput('${nome}', ${saldo})" onfocus="handleInputFocus(this)">
            </div>
        </div>
        ` : ''}

        <div class="flow-section">
            <div class="flow-section-title">3. NUOVO SALDO</div>
            <div class="row">
                <div class="form-group">
                    <label>Lascia credito:</label>
                    <input type="text" inputmode="decimal" id="credito_${nome}" placeholder="0.00" oninput="normalizeInputField(this); handleCreditoDebitoInput('${nome}', ${saldo})" onfocus="handleInputFocus(this)">
                </div>
                <div class="form-group">
                    <label>Lascia debito:</label>
                    <input type="text" inputmode="decimal" id="debito_${nome}" placeholder="0.00" oninput="normalizeInputField(this); handleCreditoDebitoInput('${nome}', ${saldo})" onfocus="handleInputFocus(this)">
                </div>
            </div>
        </div>

        ${haDebito ? `
        <div class="flow-section flow-debito">
            <div class="flow-section-title">4. SALDA DEBITO PRECEDENTE</div>
            <div class="checkbox-group">
                <input type="checkbox" id="saldaDebito_${nome}" onchange="toggleSaldaDebito('${nome}', ${saldo})">
                <label for="saldaDebito_${nome}">Salda intero debito €${formatSaldo(saldo)}</label>
            </div>
            <div class="form-group">
                <label>Salda parziale:</label>
                <input type="text" inputmode="decimal" id="debitoSaldato_${nome}" placeholder="0.00" oninput="normalizeInputField(this); handleCreditoDebitoInput('${nome}', ${saldo})" onfocus="handleInputFocus(this)">
            </div>
        </div>
        ` : ''}

        <div class="flow-section">
            <div class="form-group">
                <label>Note:</label>
                <input type="text" id="note_${nome}" placeholder="Note aggiuntive">
            </div>
        </div>
    `;
    container.appendChild(card);

    if (!haCredito) {
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.id = `usaCredito_${nome}`;
        hidden.value = '0';
        card.appendChild(hidden);

        const hiddenCheckbox = document.createElement('input');
        hiddenCheckbox.type = 'hidden';
        hiddenCheckbox.id = `usaInteroCreditoCheckbox_${nome}`;
        hiddenCheckbox.value = 'false';
        card.appendChild(hiddenCheckbox);
    }
    if (!haDebito) {
        const hiddenCheck = document.createElement('input');
        hiddenCheck.type = 'hidden';
        hiddenCheck.id = `saldaDebito_${nome}`;
        hiddenCheck.value = 'false';
        card.appendChild(hiddenCheck);

        const hiddenAmount = document.createElement('input');
        hiddenAmount.type = 'hidden';
        hiddenAmount.id = `debitoSaldato_${nome}`;
        hiddenAmount.value = '0';
        card.appendChild(hiddenAmount);
    }
}

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
            // Set the field to the absolute value of the debt
            debitoField.value = Math.abs(saldo);
        } else {
            debitoField.disabled = false;
            debitoField.value = '';
        }
    }

    // Get the participant's saldo if not provided
    if (!saldo) {
        const p = participants.find(part => part.nome === nome);
        saldo = saldiBefore[nome] !== undefined ? saldiBefore[nome] : (p ? p.saldo || 0 : 0);
    }

    handleCreditoDebitoInput(nome, saldo);
}

function toggleDiscrepanzaCassa() {
    const checkbox = document.getElementById('discrepanzaCassa');
    const lasciatoField = document.getElementById('lasciatoInCassa');

    if (checkbox.checked) {
        discrepanzaCassaEnabled = true;
        lasciatoField.readOnly = false;
        lasciatoField.style.cursor = 'text';
        lasciatoField.style.background = '#fff';
        lasciatoField.focus();
    } else {
        discrepanzaCassaEnabled = false;
        lasciatoField.readOnly = true;
        lasciatoField.style.cursor = 'not-allowed';
        lasciatoField.style.background = '#f0f0f0';
        updateLasciatoInCassa();
    }
}

function toggleDiscrepanzaCassaTrovata() {
    const checkbox = document.getElementById('discrepanzaCassaTrovata');
    const trovatoField = document.getElementById('trovatoInCassa');

    if (checkbox.checked) {
        trovatoField.readOnly = false;
        trovatoField.style.cursor = 'text';
        trovatoField.style.background = '#fff';
        trovatoField.focus();
    } else {
        trovatoField.readOnly = true;
        trovatoField.style.cursor = 'not-allowed';
        trovatoField.style.background = '#f0f0f0';
    }
}

function updateLasciatoInCassa() {
    if (discrepanzaCassaEnabled) {
        return; // Non aggiornare se discrepanza è abilitata
    }

    const trovatoInCassa = parseAmount(document.getElementById('trovatoInCassa').value);
    const pagatoProduttore = parseAmount(document.getElementById('pagatoProduttore').value);

    // Calcola totale importi saldati
    let totalImportoSaldato = 0;

    const select = document.getElementById('participant-select');
    const currentNome = select.value;

    // Se c'è un partecipante selezionato, usa totalImportoSaldatoBefore + importo corrente
    if (currentNome) {
        totalImportoSaldato = totalImportoSaldatoBefore;
        const importoField = document.getElementById(`importo_${currentNome}`);
        if (importoField) {
            const importoCorrente = parseAmount(importoField.value);
            totalImportoSaldato += importoCorrente;
        }
    } else {
        // Nessun partecipante selezionato: calcola da tutti i movimenti esistenti
        if (existingConsegnaMovimenti && existingConsegnaMovimenti.length > 0) {
            existingConsegnaMovimenti.forEach(m => {
                totalImportoSaldato += m.importo_saldato || 0;
            });
        }
    }

    const lasciatoInCassa = roundUpCents(trovatoInCassa - pagatoProduttore + totalImportoSaldato);
    document.getElementById('lasciatoInCassa').value = lasciatoInCassa;
}

function handleCreditoDebitoInput(nome, saldo) {
    const creditoLasciato = document.getElementById(`credito_${nome}`);
    const debitoLasciato = document.getElementById(`debito_${nome}`);
    const debitoSaldato = document.getElementById(`debitoSaldato_${nome}`);
    const saldaDebitoCheckbox = document.getElementById(`saldaDebito_${nome}`);
    const usaCredito = document.getElementById(`usaCredito_${nome}`);

    // Valori correnti
    const creditoLasciatoValue = creditoLasciato ? parseAmount(creditoLasciato.value) : 0;
    const debitoLasciatoValue = debitoLasciato ? parseAmount(debitoLasciato.value) : 0;
    const usaCreditoValue = usaCredito ? parseAmount(usaCredito.value) : 0;
    const debitoSaldatoValue = debitoSaldato ? parseAmount(debitoSaldato.value) : 0;
    const saldaDebitoChecked = saldaDebitoCheckbox && saldaDebitoCheckbox.checked;

    // Calcoli derivati
    const creditoDisponibile = saldo > 0 ? saldo : 0;
    const debitoDisponibile = saldo < 0 ? Math.abs(saldo) : 0;
    const usaInteroCredito = usaCreditoValue > 0 && usaCreditoValue >= creditoDisponibile;
    const usaCreditoParziale = usaCreditoValue > 0 && usaCreditoValue < creditoDisponibile;
    const saldaDebito = saldaDebitoChecked || debitoSaldatoValue > 0;

    // Reset: abilita tutti i campi
    if (creditoLasciato) creditoLasciato.disabled = false;
    if (debitoLasciato) debitoLasciato.disabled = false;
    if (debitoSaldato) debitoSaldato.disabled = false;
    if (saldaDebitoCheckbox) saldaDebitoCheckbox.disabled = false;

    // REGOLA 1: Non puoi lasciare credito E debito contemporaneamente
    if (creditoLasciatoValue > 0 && debitoLasciatoValue > 0) {
        // Questo sarà gestito dalla validazione in saveData
    }

    // REGOLA 2: Se usi credito (intero o parziale), disabilita "Lascia credito"
    if (usaCreditoValue > 0) {
        if (creditoLasciato) {
            creditoLasciato.disabled = true;
            creditoLasciato.value = '';
        }
    }

    // REGOLA 3: Se usi credito PARZIALE, disabilita "Lascia debito"
    // (hai ancora credito residuo, non puoi accumulare debito)
    if (usaCreditoParziale) {
        if (debitoLasciato) {
            debitoLasciato.disabled = true;
            debitoLasciato.value = '';
        }
    }

    // REGOLA 4: Se salda debito (intero o parziale), disabilita "Lascia debito"
    // (non ha senso saldare debito e contemporaneamente lasciarne di nuovo dalla sezione 3)
    if (saldaDebito) {
        if (debitoLasciato) {
            debitoLasciato.disabled = true;
            debitoLasciato.value = '';
        }
        // MA permetti di lasciare credito (Scenario 10: salda debito + paga + lascia credito)
    }

    // REGOLA 5: Se lascia credito, disabilita "Lascia debito"
    if (creditoLasciatoValue > 0) {
        if (debitoLasciato) {
            debitoLasciato.disabled = true;
            debitoLasciato.value = '';
        }
        // MA permetti di saldare debito (Scenario 14: salda debito + lascia credito)
    }

    // REGOLA 6: Se lascia debito, disabilita "Lascia credito"
    if (debitoLasciatoValue > 0) {
        if (creditoLasciato) {
            creditoLasciato.disabled = true;
            creditoLasciato.value = '';
        }
        // MA permetti di saldare debito precedente (Scenario 13: salda debito parziale + lascia nuovo debito)
    }
}

async function saveData() {
    const data = document.getElementById('data').value;
    const trovatoInCassa = roundUpCents(parseAmount(document.getElementById('trovatoInCassa').value));
    const pagatoProduttore = roundUpCents(parseAmount(document.getElementById('pagatoProduttore').value));

    if (!data) {
        showStatus('Inserisci la data', 'error');
        return;
    }

    const select = document.getElementById('participant-select');
    const currentNome = select.value;

    // Permetti salvataggio senza partecipante (solo dati cassa)
    if (!currentNome) {
        showStatus('Salvataggio dati cassa in corso...', 'success');

        let lasciatoInCassa;
        if (discrepanzaCassaEnabled) {
            lasciatoInCassa = roundUpCents(parseAmount(document.getElementById('lasciatoInCassa').value));
        } else {
            // Calcola totale importi da tutti i movimenti esistenti
            let totalImportoSaldato = 0;
            if (existingConsegnaMovimenti && existingConsegnaMovimenti.length > 0) {
                existingConsegnaMovimenti.forEach(m => {
                    totalImportoSaldato += m.importo_saldato || 0;
                });
            }
            lasciatoInCassa = roundUpCents(trovatoInCassa - pagatoProduttore + totalImportoSaldato);
            document.getElementById('lasciatoInCassa').value = lasciatoInCassa;
        }

        try {
            const response = await fetch('/api/consegna', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    data,
                    trovatoInCassa,
                    pagatoProduttore,
                    lasciatoInCassa,
                    discrepanzaCassa: discrepanzaCassaEnabled,
                    partecipanti: [],
                }),
            });

            const result = await response.json();

            if (result.success) {
                showStatus('Dati cassa salvati con successo!', 'success');
                setTimeout(() => {
                    loadData();
                }, 1000);
            } else {
                showStatus('Errore: ' + result.error, 'error');
            }
        } catch (error) {
            showStatus('Errore durante il salvataggio: ' + error.message, 'error');
        }
        return;
    }

    const debitoLasciato = parseAmount(document.getElementById(`debito_${currentNome}`).value);
    const creditoLasciato = parseAmount(document.getElementById(`credito_${currentNome}`).value);

    if (debitoLasciato > 0 && creditoLasciato > 0) {
        showStatus(`Errore: non puoi lasciare sia credito che debito contemporaneamente`, 'error');
        return;
    }

    showStatus('Salvataggio in corso...', 'success');

    const p = participants.find(part => part.nome === currentNome);
    if (!p) {
        showStatus('Partecipante non trovato', 'error');
        return;
    }

    const importoSaldato = roundUpCents(parseAmount(document.getElementById(`importo_${currentNome}`).value));
    const usaCredito = roundUpCents(parseAmount(document.getElementById(`usaCredito_${currentNome}`)?.value || '0'));
    const debitoSaldato = roundUpCents(parseAmount(document.getElementById(`debitoSaldato_${currentNome}`)?.value || '0'));
    const saldaDebitoTotale = document.getElementById(`saldaDebito_${currentNome}`)?.checked || false;
    const note = document.getElementById(`note_${currentNome}`).value || '';

    // Use saldo before consegna if editing existing, otherwise current saldo
    let saldoCorrente = saldiBefore[currentNome] !== undefined ? saldiBefore[currentNome] : (p.saldo || 0);

    // Nota: importoSaldato e saldaTutto NON modificano il saldo, sono solo pagamenti

    // 1. Usa credito esistente (sottrae dal credito)
    if (usaCredito > 0) {
        saldoCorrente -= usaCredito;
    }

    // 2. Salda debito esistente
    if (saldaDebitoTotale && saldoCorrente < 0) {
        saldoCorrente = 0;
    } else if (debitoSaldato > 0 && saldoCorrente < 0) {
        saldoCorrente = Math.min(0, saldoCorrente + debitoSaldato);
    }

    // 3. Nuovo debito/credito da lasciare
    if (debitoLasciato > 0) {
        saldoCorrente -= debitoLasciato;
    }
    if (creditoLasciato > 0) {
        saldoCorrente += creditoLasciato;
    }

    const partecipantiData = [{
        nome: currentNome,
        saldaTutto: false,
        importoSaldato,
        usaCredito,
        debitoLasciato: roundUpCents(debitoLasciato),
        creditoLasciato: roundUpCents(creditoLasciato),
        saldaDebitoTotale,
        debitoSaldato,
        note,
        nuovoSaldo: roundUpCents(saldoCorrente)
    }];

    // Calcola totale importi saldati usando la stessa logica di updateLasciatoInCassa
    let totalImportoSaldato = totalImportoSaldatoBefore + importoSaldato;

    let lasciatoInCassa;
    if (discrepanzaCassaEnabled) {
        // Use manual value if discrepanza is enabled
        lasciatoInCassa = roundUpCents(parseAmount(document.getElementById('lasciatoInCassa').value));
    } else {
        // Auto-calculate
        lasciatoInCassa = roundUpCents(trovatoInCassa - pagatoProduttore + totalImportoSaldato);
        // Update the UI field
        document.getElementById('lasciatoInCassa').value = lasciatoInCassa;
    }

    try {
        const response = await fetch('/api/consegna', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data,
                trovatoInCassa,
                pagatoProduttore,
                lasciatoInCassa,
                discrepanzaCassa: discrepanzaCassaEnabled,
                partecipanti: partecipantiData,
            }),
        });

        const result = await response.json();

        if (result.success) {
            showStatus('Dati salvati con successo!', 'success');
            setTimeout(() => {
                document.getElementById('selected-participants').innerHTML = '';
                select.value = '';
                loadData();
            }, 1000);
        } else {
            showStatus('Errore: ' + result.error, 'error');
        }
    } catch (error) {
        showStatus('Errore durante il salvataggio: ' + error.message, 'error');
    }
}

async function checkDateData() {
    const dateValue = document.getElementById('data').value;
    if (!dateValue) return;

    try {
        const response = await fetch(`/api/consegna/${dateValue}`);
        const result = await response.json();

        if (result.success && result.found) {
            // Existing consegna - load data
            document.getElementById('trovatoInCassa').value = result.consegna.trovato_in_cassa || '';
            document.getElementById('pagatoProduttore').value = result.consegna.pagato_produttore || '';
            document.getElementById('lasciatoInCassa').value = result.consegna.lasciato_in_cassa || '';

            // Ripristina stato checkbox discrepanza SOLO se era effettivamente abilitata
            const discrepanzaCheckbox = document.getElementById('discrepanzaCassa');
            const lasciatoField = document.getElementById('lasciatoInCassa');
            if (result.consegna.discrepanza_cassa === 1) {
                discrepanzaCheckbox.checked = true;
                discrepanzaCassaEnabled = true;
                lasciatoField.readOnly = false;
                lasciatoField.style.cursor = 'text';
                lasciatoField.style.background = '#fff';
            } else {
                discrepanzaCheckbox.checked = false;
                discrepanzaCassaEnabled = false;
                lasciatoField.readOnly = true;
                lasciatoField.style.cursor = 'not-allowed';
                lasciatoField.style.background = '#f0f0f0';
            }

            // Store movimenti and saldi before this consegna
            existingConsegnaMovimenti = result.movimenti || [];
            saldiBefore = result.saldiBefore || {};

            // Calcola totale importi saldati (senza includere nessun partecipante corrente)
            totalImportoSaldatoBefore = 0;
            if (existingConsegnaMovimenti.length > 0) {
                existingConsegnaMovimenti.forEach(m => {
                    totalImportoSaldatoBefore += m.importo_saldato || 0;
                });
            }

            showStatus('Dati esistenti caricati per questa data', 'success');
        } else {
            // New date - auto-populate trovato with previous lasciato
            if (result.lasciatoPrecedente !== undefined && result.lasciatoPrecedente !== null) {
                document.getElementById('trovatoInCassa').value = result.lasciatoPrecedente;
            } else {
                document.getElementById('trovatoInCassa').value = '';
            }
            document.getElementById('pagatoProduttore').value = '';
            document.getElementById('lasciatoInCassa').value = '';
            existingConsegnaMovimenti = null;
            saldiBefore = {};
            totalImportoSaldatoBefore = 0;
        }
    } catch (error) {
        console.error('Error checking date data:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Carica l'ultima data disponibile dallo storico
    try {
        const response = await fetch('/api/storico');
        const result = await response.json();

        if (result.success && result.storico.length > 0) {
            // Prendi la data più recente (primo elemento, array ordinato DESC)
            const ultimaData = result.storico[0].data;
            document.getElementById('data').value = ultimaData;
        } else {
            // Nessuna consegna esistente, usa data odierna
            document.getElementById('data').valueAsDate = new Date();
        }
    } catch (error) {
        console.error('Error loading last date:', error);
        // Fallback to today's date
        document.getElementById('data').valueAsDate = new Date();
    }

    updateDateDisplay();
    loadData();
});
