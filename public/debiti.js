let participants = [];
let editingId = null;

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status ' + type;
    setTimeout(() => {
        status.className = 'status';
    }, 5000);
}

function formatDateItalian(dateStr) {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
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

function showAddForm() {
    document.getElementById('add-form').style.display = 'block';
    document.getElementById('new-name').value = '';
    document.getElementById('new-name').focus();
}

function hideAddForm() {
    document.getElementById('add-form').style.display = 'none';
}

async function loadParticipants() {
    try {
        const response = await fetch('/api/participants');
        const result = await response.json();

        if (result.success) {
            participants = result.participants;
            renderParticipants();
        } else {
            showStatus('Errore: ' + result.error, 'error');
        }
    } catch (error) {
        showStatus('Errore: ' + error.message, 'error');
    }
}

function renderParticipants() {
    const tbody = document.getElementById('participants-body');
    tbody.innerHTML = '';

    if (participants.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nessun partecipante</td></tr>';
        return;
    }

    participants.forEach(p => {
        const row = document.createElement('tr');

        const saldoClass = p.saldo < 0 ? 'saldo-debito' : p.saldo > 0 ? 'saldo-credito' : '';
        const saldoText = p.saldo.toFixed(2);

        row.innerHTML = `
            <td><strong>${p.nome}</strong></td>
            <td class="${saldoClass}">
                <span id="saldo-view-${p.id}">€${saldoText}</span>
                <input type="text" inputmode="decimal" id="saldo-edit-${p.id}" value="${p.saldo}" style="display: none;" oninput="normalizeInputField(this)" onkeydown="if(event.key==='Enter'){event.preventDefault();saveSaldo(${p.id})}">
            </td>
            <td>${formatDateItalian(p.ultima_modifica)}</td>
            <td>
                <button onclick="editSaldo(${p.id})" id="edit-btn-${p.id}">Modifica</button>
                <button onclick="saveSaldo(${p.id})" id="save-btn-${p.id}" style="display: none;" class="btn-save">Salva</button>
                <button onclick="cancelEdit(${p.id})" id="cancel-btn-${p.id}" style="display: none;">Annulla</button>
                <button onclick="deleteParticipant(${p.id})" class="btn-delete">Elimina</button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

function editSaldo(id) {
    editingId = id;
    const inputField = document.getElementById(`saldo-edit-${id}`);

    document.getElementById(`saldo-view-${id}`).style.display = 'none';
    inputField.style.display = 'inline-block';
    document.getElementById(`edit-btn-${id}`).style.display = 'none';
    document.getElementById(`save-btn-${id}`).style.display = 'inline-block';
    document.getElementById(`cancel-btn-${id}`).style.display = 'inline-block';

    // Clear if value is 0 and focus
    if (inputField.value === '0' || inputField.value === '0.0' || inputField.value === '0.00') {
        inputField.value = '';
    }
    inputField.focus();
    inputField.select();
}

function cancelEdit(id) {
    const participant = participants.find(p => p.id === id);
    document.getElementById(`saldo-edit-${id}`).value = participant.saldo;
    document.getElementById(`saldo-view-${id}`).style.display = 'inline';
    document.getElementById(`saldo-edit-${id}`).style.display = 'none';
    document.getElementById(`edit-btn-${id}`).style.display = 'inline-block';
    document.getElementById(`save-btn-${id}`).style.display = 'none';
    document.getElementById(`cancel-btn-${id}`).style.display = 'none';
    editingId = null;
}

async function saveSaldo(id) {
    const newSaldo = parseFloat(document.getElementById(`saldo-edit-${id}`).value);

    try {
        const response = await fetch(`/api/participants/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ saldo: newSaldo }),
        });

        const result = await response.json();

        if (result.success) {
            showStatus('Saldo aggiornato con successo!', 'success');
            loadParticipants();
            editingId = null;
        } else {
            showStatus('Errore: ' + result.error, 'error');
        }
    } catch (error) {
        showStatus('Errore durante l\'aggiornamento: ' + error.message, 'error');
    }
}

async function addParticipant() {
    const nome = document.getElementById('new-name').value.trim();

    if (!nome) {
        showStatus('Inserisci un nome', 'error');
        return;
    }

    try {
        const response = await fetch('/api/participants', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nome }),
        });

        const result = await response.json();

        if (result.success) {
            showStatus('Partecipante aggiunto con successo!', 'success');
            hideAddForm();
            loadParticipants();
        } else {
            showStatus('Errore: ' + result.error, 'error');
        }
    } catch (error) {
        showStatus('Errore durante l\'aggiunta: ' + error.message, 'error');
    }
}

async function deleteParticipant(id) {
    const participant = participants.find(p => p.id === id);
    if (!confirm(`Sei sicuro di voler eliminare ${participant.nome}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/participants/${id}`, {
            method: 'DELETE',
        });

        const result = await response.json();

        if (result.success) {
            showStatus('Partecipante eliminato con successo!', 'success');
            loadParticipants();
        } else {
            showStatus('Errore: ' + result.error, 'error');
        }
    } catch (error) {
        showStatus('Errore durante l\'eliminazione: ' + error.message, 'error');
    }
}

async function syncParticipants() {
    showStatus('Sincronizzazione in corso...', 'success');

    try {
        const response = await fetch('/api/sync-participants', {
            method: 'POST',
        });

        const result = await response.json();

        if (result.success) {
            showStatus('Partecipanti sincronizzati con successo!', 'success');
            loadParticipants();
        } else {
            showStatus('Errore: ' + result.error, 'error');
        }
    } catch (error) {
        showStatus('Errore durante la sincronizzazione: ' + error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadParticipants();
});
