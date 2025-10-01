let participants = [];

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

    if (!nome) return;

    renderParticipant(nome);
}

function renderParticipant(nome) {
    const container = document.getElementById('selected-participants');
    const p = participants.find(part => part.nome === nome);
    if (!p) return;

    const saldo = p.saldo || 0;
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
            <div class="checkbox-group">
                <input type="checkbox" id="salda_${nome}" onchange="toggleSaldaTutto('${nome}')">
                <label for="salda_${nome}">Salda tutto</label>
            </div>
            <div class="form-group">
                <label>Importo saldato (€):</label>
                <input type="text" inputmode="decimal" id="importo_${nome}" placeholder="0.00">
            </div>
        </div>

        ${haCredito ? `
        <div class="flow-section flow-credito">
            <div class="flow-section-title">2. USA SALDO PRECEDENTE</div>
            <div class="form-group">
                <label>Usa credito (€) - max €${formatSaldo(saldo)}:</label>
                <input type="text" inputmode="decimal" id="usaCredito_${nome}" placeholder="0.00">
            </div>
        </div>
        ` : ''}

        <div class="flow-section">
            <div class="flow-section-title">3. NUOVO SALDO</div>
            <div class="row">
                <div class="form-group">
                    <label>Lascia credito (€):</label>
                    <input type="text" inputmode="decimal" id="credito_${nome}" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Lascia debito (€):</label>
                    <input type="text" inputmode="decimal" id="debito_${nome}" placeholder="0.00">
                </div>
            </div>
        </div>

        ${haDebito ? `
        <div class="flow-section flow-debito">
            <div class="flow-section-title">4. SALDA DEBITO PRECEDENTE</div>
            <div class="checkbox-group">
                <input type="checkbox" id="saldaDebito_${nome}" onchange="toggleSaldaDebito('${nome}')">
                <label for="saldaDebito_${nome}">Salda debito totale (€${formatSaldo(saldo)})</label>
            </div>
            <div class="form-group">
                <label>Salda parziale (€):</label>
                <input type="text" inputmode="decimal" id="debitoSaldato_${nome}" placeholder="0.00">
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

function toggleSaldaTutto(nome) {
    const checkbox = document.getElementById(`salda_${nome}`);
    const importoField = document.getElementById(`importo_${nome}`);

    if (checkbox.checked) {
        importoField.disabled = true;
        importoField.value = '';
    } else {
        importoField.disabled = false;
    }
}

function toggleSaldaDebito(nome) {
    const checkbox = document.getElementById(`saldaDebito_${nome}`);
    const debitoField = document.getElementById(`debitoSaldato_${nome}`);

    if (checkbox && debitoField) {
        if (checkbox.checked) {
            debitoField.disabled = true;
            debitoField.value = '';
        } else {
            debitoField.disabled = false;
        }
    }
}

async function saveData() {
    const data = document.getElementById('data').value;
    const trovatoInCassa = roundUpCents(parseAmount(document.getElementById('trovatoInCassa').value));
    const pagatoProduttore = roundUpCents(parseAmount(document.getElementById('pagatoProduttore').value));
    const lasciatoInCassa = roundUpCents(parseAmount(document.getElementById('lasciatoInCassa').value));

    if (!data) {
        showStatus('Inserisci la data', 'error');
        return;
    }

    const select = document.getElementById('participant-select');
    const currentNome = select.value;

    if (!currentNome) {
        showStatus('Seleziona un partecipante', 'error');
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

    const saldaTutto = document.getElementById(`salda_${currentNome}`)?.checked || false;
    const importoSaldato = roundUpCents(parseAmount(document.getElementById(`importo_${currentNome}`).value));
    const usaCredito = roundUpCents(parseAmount(document.getElementById(`usaCredito_${currentNome}`)?.value || '0'));
    const debitoSaldato = roundUpCents(parseAmount(document.getElementById(`debitoSaldato_${currentNome}`)?.value || '0'));
    const saldaDebitoTotale = document.getElementById(`saldaDebito_${currentNome}`)?.checked || false;
    const note = document.getElementById(`note_${currentNome}`).value || '';

    let saldoCorrente = p.saldo || 0;

    // 1. Gestione pagamento/salda tutto
    if (saldaTutto) {
        // Salda tutto azzera il debito/credito esistente
        saldoCorrente = 0;
    }
    // Nota: importoSaldato NON modifica il saldo, è solo un pagamento

    // 2. Usa credito esistente (sottrae dal credito)
    if (usaCredito > 0) {
        saldoCorrente -= usaCredito;
    }

    // 3. Salda debito esistente
    if (saldaDebitoTotale && saldoCorrente < 0) {
        saldoCorrente = 0;
    } else if (debitoSaldato > 0 && saldoCorrente < 0) {
        saldoCorrente = Math.min(0, saldoCorrente + debitoSaldato);
    }

    // 4. Nuovo debito/credito da lasciare
    if (debitoLasciato > 0) {
        saldoCorrente -= debitoLasciato;
    }
    if (creditoLasciato > 0) {
        saldoCorrente += creditoLasciato;
    }

    const partecipantiData = [{
        nome: currentNome,
        saldaTutto,
        importoSaldato,
        usaCredito,
        debitoLasciato: roundUpCents(debitoLasciato),
        creditoLasciato: roundUpCents(creditoLasciato),
        saldaDebitoTotale,
        debitoSaldato,
        note,
        nuovoSaldo: roundUpCents(saldoCorrente)
    }];

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
            document.getElementById('trovatoInCassa').value = result.consegna.trovato_in_cassa || '';
            document.getElementById('pagatoProduttore').value = result.consegna.pagato_produttore || '';
            document.getElementById('lasciatoInCassa').value = result.consegna.lasciato_in_cassa || '';

            showStatus('Dati esistenti caricati per questa data', 'success');
        } else {
            document.getElementById('trovatoInCassa').value = '';
            document.getElementById('pagatoProduttore').value = '';
            document.getElementById('lasciatoInCassa').value = '';
        }
    } catch (error) {
        console.error('Error checking date data:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('data').valueAsDate = new Date();
    updateDateDisplay();
    loadData();
});
