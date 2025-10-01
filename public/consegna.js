let participants = [];
let selectedParticipants = new Set();

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
    // Arrotonda ai decimi (10 centesimi): 0.0, 0.1, 0.2, etc.
    return Math.round(amount * 10) / 10;
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
        if (!selectedParticipants.has(p.nome)) {
            const option = document.createElement('option');
            option.value = p.nome;
            option.textContent = p.nome;
            select.appendChild(option);
        }
    });
}

function showParticipantForm() {
    const select = document.getElementById('participant-select');
    const nome = select.value;

    if (!nome) {
        // Clear current participant
        document.getElementById('selected-participants').innerHTML = '';
        return;
    }

    // Show only this participant (replace previous)
    document.getElementById('selected-participants').innerHTML = '';
    renderParticipant(nome);
}

function addAllParticipants() {
    participants.forEach(p => {
        selectedParticipants.add(p.nome);
    });
    renderSelectedParticipants();
}

function renderSelectedParticipants() {
    const container = document.getElementById('selected-participants');
    container.innerHTML = '';

    selectedParticipants.forEach(nome => {
        renderParticipant(nome);
    });
}

function renderParticipant(nome) {
    const container = document.getElementById('selected-participants');
    const p = participants.find(part => part.nome === nome);
    if (!p) return;

    const saldo = p.saldo || 0;
    const haCredito = saldo > 0;
        const haDebito = saldo < 0;

        const formatSaldo = (val) => {
            const formatted = Math.abs(val).toFixed(1);
            return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
        };

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
                    <label>Usa credito (€) - max €${saldo.toFixed(1)}:</label>
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
                    <label for="saldaDebito_${nome}">Salda debito totale (€${Math.abs(saldo).toFixed(1)})</label>
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

        // Setup hidden fields for participants without credit/debt
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
    });
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

    // Get currently displayed participant from select
    const select = document.getElementById('participant-select');
    const currentNome = select.value;

    if (!currentNome) {
        showStatus('Seleziona un partecipante', 'error');
        return;
    }

    // Validazione: controlla che non abbia sia credito che debito lasciato
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

    if (saldaTutto) {
        saldoCorrente = 0;
    } else if (importoSaldato > 0) {
        saldoCorrente = 0;
    }

    if (usaCredito > 0) {
        saldoCorrente -= usaCredito;
    }

    if (debitoLasciato > 0) {
        saldoCorrente -= debitoLasciato;
    }
    if (creditoLasciato > 0) {
        saldoCorrente += creditoLasciato;
    }
    if (saldaDebitoTotale && saldoCorrente < 0) {
        saldoCorrente = 0;
    } else if (debitoSaldato > 0 && saldoCorrente < 0) {
        saldoCorrente = Math.min(0, saldoCorrente + debitoSaldato);
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
            }),
        });

        const result = await response.json();

        if (result.success) {
            showStatus('Dati salvati con successo!', 'success');
            setTimeout(() => {
                selectedParticipants.clear();
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

            selectedParticipants.clear();
            result.movimenti.forEach(m => {
                selectedParticipants.add(m.nome);
            });
            renderSelectedParticipants();
            renderParticipantSelect();

            result.movimenti.forEach(m => {
                const nome = m.nome;

                const saldaCheck = document.getElementById(`salda_${nome}`);
                if (saldaCheck) {
                    saldaCheck.checked = m.salda_tutto;
                    if (m.salda_tutto) toggleSaldaTutto(nome);
                }

                const fields = {
                    importo: m.importo_saldato,
