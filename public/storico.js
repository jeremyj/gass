function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status ' + type;
    setTimeout(() => {
        status.className = 'status';
    }, 5000);
}

function formatDateItalian(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

async function loadStorico() {
    showStatus('Caricamento in corso...', 'success');

    try {
        const response = await fetch('/api/storico/dettaglio');
        const result = await response.json();

        if (result.success) {
            renderStorico(result.storico);
            showStatus('Storico caricato con successo!', 'success');
        } else {
            showStatus('Errore: ' + result.error, 'error');
        }
    } catch (error) {
        showStatus('Errore: ' + error.message, 'error');
    }
}

function renderStorico(storico) {
    const container = document.getElementById('storico-list');
    container.innerHTML = '';

    if (storico.length === 0) {
        container.innerHTML = '<p>Nessuna consegna registrata</p>';
        return;
    }

    storico.forEach((consegna, index) => {
        const section = document.createElement('div');
        section.className = 'section';
        section.style.background = '#FFF9C4';
        section.style.marginBottom = '20px';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '15px';

        // Calcola discrepanza con consegna precedente
        let discrepanzaWarning = '';
        if (consegna.discrepanza_cassa) {
            let discrepanzaImporto = 0;
            if (index < storico.length - 1) {
                const consegnaPrecedente = storico[index + 1]; // Array ordinato DESC
                discrepanzaImporto = consegna.trovato_in_cassa - consegnaPrecedente.lasciato_in_cassa;
            }
            const segno = discrepanzaImporto >= 0 ? '+' : '';
            const color = discrepanzaImporto >= 0 ? '#2e7d32' : '#d32f2f';
            discrepanzaWarning = `<span style="color: ${color}; font-weight: bold; margin-left: 15px;">⚠️ DISCREPANZA CASSA ${segno}€${discrepanzaImporto.toFixed(2)}</span>`;
        }

        header.innerHTML = `
            <div>
                <h3 style="margin: 0; color: #2c3e50; display: inline;">Data: ${formatDateItalian(consegna.data)}</h3>
                ${discrepanzaWarning}
            </div>
            <button class="btn-delete" onclick="deleteConsegna(${consegna.id})">Elimina</button>
        `;

        const infoTable = document.createElement('table');
        infoTable.innerHTML = `
            <thead>
                <tr style="background: #FFEB3B; color: white;">
                    <th>Trovato in Cassa</th>
                    <th>Pagato Produttore</th>
                    <th>Lasciato in Cassa</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>€${consegna.trovato_in_cassa.toFixed(2)}</td>
                    <td>€${consegna.pagato_produttore.toFixed(2)}</td>
                    <td>€${consegna.lasciato_in_cassa.toFixed(2)}</td>
                </tr>
            </tbody>
        `;

        section.appendChild(header);
        section.appendChild(infoTable);

        if (consegna.movimenti && consegna.movimenti.length > 0) {
            const movimentiTitle = document.createElement('h4');
            movimentiTitle.textContent = 'Movimenti Partecipanti';
            movimentiTitle.style.marginTop = '20px';
            movimentiTitle.style.marginBottom = '10px';

            const movimentiTable = document.createElement('table');
            movimentiTable.innerHTML = `
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Importo Saldato</th>
                        <th>Usa Credito</th>
                        <th>Debito Lasciato</th>
                        <th>Credito Lasciato</th>
                        <th>Debito Saldato</th>
                        <th>Note</th>
                    </tr>
                </thead>
                <tbody>
                    ${consegna.movimenti.map((m, idx) => {
                        const bgColor = idx % 2 === 0 ? '#FFFFFF' : '#E3F2FD';
                        return `
                            <tr style="background: ${bgColor};">
                                <td><strong>${m.nome}</strong></td>
                                <td>${m.importo_saldato ? '€' + m.importo_saldato.toFixed(2) : ''}</td>
                                <td>${m.usa_credito ? '€' + m.usa_credito.toFixed(2) : ''}</td>
                                <td>${m.debito_lasciato ? '€' + m.debito_lasciato.toFixed(2) : ''}</td>
                                <td>${m.credito_lasciato ? '€' + m.credito_lasciato.toFixed(2) : ''}</td>
                                <td>${m.debito_saldato ? '€' + m.debito_saldato.toFixed(2) : ''}</td>
                                <td>${m.note || ''}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            `;

            section.appendChild(movimentiTitle);
            section.appendChild(movimentiTable);
        }

        container.appendChild(section);
    });
}

async function deleteConsegna(id) {
    if (!confirm('Sei sicuro di voler eliminare questa consegna?')) {
        return;
    }

    showStatus('Eliminazione in corso...', 'success');

    try {
        const response = await fetch(`/api/consegna/${id}`, {
            method: 'DELETE',
        });

        const result = await response.json();

        if (result.success) {
            showStatus('Consegna eliminata con successo!', 'success');
            loadStorico();
        } else {
            showStatus('Errore: ' + result.error, 'error');
        }
    } catch (error) {
        showStatus('Errore durante l\'eliminazione: ' + error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadStorico();
});
