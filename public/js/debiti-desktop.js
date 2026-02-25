// ===== STATE MANAGEMENT =====

let participants = [];
let editingId = null;

// ===== UI HELPERS =====

function showAddForm() {
  document.getElementById('add-form').style.display = 'block';
  document.getElementById('new-name').value = '';
  document.getElementById('new-name').focus();
}

function hideAddForm() {
  document.getElementById('add-form').style.display = 'none';
  document.getElementById('new-name').value = '';
  document.getElementById('new-username').value = '';
  document.getElementById('new-password').value = '';
}

// ===== RENDERING =====

function renderParticipants() {
  const tbody = document.getElementById('participants-body');
  tbody.innerHTML = '';

  if (participants.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">Nessun partecipante</td></tr>`;
    return;
  }

  participants.forEach(p => {
    const row = createParticipantRow(p);
    tbody.appendChild(row);
  });
}

function createParticipantRow(p) {
  const row = document.createElement('tr');
  const saldoClass = p.saldo < 0 ? 'saldo-debito' : p.saldo > 0 ? 'saldo-credito' : '';
  const saldoText = formatNumber(p.saldo);
  const adminBadge = p.is_admin ? '<span class="admin-badge">Admin</span>' : '';

  const canEdit = isAdmin() && isViewingToday();

  row.innerHTML = `
    ${isAdmin() ? `<td>${escapeHtml(p.username) || '-'}${adminBadge}</td>` : ''}
    <td><strong>${escapeHtml(p.nome)}</strong></td>
    <td class="${saldoClass}">
      <span id="saldo-view-${p.id}">€${saldoText}</span>
      <input type="text" inputmode="decimal" id="saldo-edit-${p.id}" value="${p.saldo}"
             class="initially-hidden"
             oninput="normalizeInputField(this)"
             onfocus="handleInputFocus(this)"
             onkeydown="if(event.key==='Enter'){event.preventDefault();saveSaldo(${p.id})}">
    </td>
    <td>${formatDateItalian(p.ultima_modifica)}</td>
    ${isAdmin() ? `<td style="white-space: nowrap">
      <button onclick="editSaldo(${p.id})" id="edit-btn-${p.id}" ${canEdit ? '' : 'disabled'}>Modifica Saldo</button>
      <button onclick="saveSaldo(${p.id})" id="save-btn-${p.id}" class="btn-save initially-hidden">Salva</button>
      <button onclick="cancelEdit(${p.id})" id="cancel-btn-${p.id}" class="initially-hidden">Annulla</button>
      <button onclick="showEditUserModal(${p.id})">Modifica Utente</button>
      <button onclick="showTransactionsModal(${p.id})">Transazioni</button>
    </td>` : `<td>
      <button onclick="showTransactionsModal(${p.id})">Transazioni</button>
    </td>`}
  `;

  return row;
}

// ===== EDIT SALDO =====

function editSaldo(id) {
  editingId = id;
  const inputField = document.getElementById(`saldo-edit-${id}`);

  document.getElementById(`saldo-view-${id}`).style.display = 'none';
  inputField.style.display = 'inline-block';
  document.getElementById(`edit-btn-${id}`).style.display = 'none';
  document.getElementById(`save-btn-${id}`).style.display = 'inline-block';
  document.getElementById(`cancel-btn-${id}`).style.display = 'inline-block';

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
      headers: { 'Content-Type': 'application/json' },
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

// ===== ADD/DELETE PARTICIPANT =====

async function addParticipant() {
  const nome = document.getElementById('new-name').value.trim();
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value;

  if (!nome || !username || !password) {
    showStatus('Tutti i campi sono obbligatori', 'error');
    return;
  }

  if (password.length < 4) {
    showStatus('La password deve essere di almeno 4 caratteri', 'error');
    return;
  }

  try {
    const response = await fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, username, password }),
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

// ===== TRANSACTIONS MODAL =====

function injectTransactionsModal() {
  if (document.getElementById('transactions-modal')) return;

  const modalHtml = `
    <div id="transactions-modal" class="modal" style="display:none;">
      <div class="modal-content modal-content-wide">
        <div class="modal-header-row">
          <h3 id="transactions-modal-title">Transazioni</h3>
          <button type="button" class="modal-close-btn" onclick="closeTransactionsModal()">&times;</button>
        </div>
        <div id="transactions-modal-body">
          <p>Caricamento...</p>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function showTransactionsModal(id) {
  injectTransactionsModal();

  const participant = participants.find(p => p.id === id);
  const name = participant ? participant.nome : '';
  document.getElementById('transactions-modal-title').textContent = `Transazioni - ${name}`;
  document.getElementById('transactions-modal-body').innerHTML = '<p>Caricamento...</p>';
  document.getElementById('transactions-modal').style.display = 'flex';

  try {
    const response = await fetch(`/api/participants/${id}/transactions`);
    const result = await response.json();

    if (result.success) {
      renderTransactionsTable(result.transactions);
    } else {
      document.getElementById('transactions-modal-body').innerHTML = `<p>Errore: ${escapeHtml(result.error)}</p>`;
    }
  } catch (error) {
    document.getElementById('transactions-modal-body').innerHTML = '<p>Errore di connessione</p>';
  }
}

function renderTransactionsTable(transactions) {
  const body = document.getElementById('transactions-modal-body');

  if (transactions.length === 0) {
    body.innerHTML = '<p>Nessuna transazione</p>';
    return;
  }

  const rows = transactions.map(t => {
    const saldoEffect = (t.credito_lasciato || 0) - (t.debito_lasciato || 0) - (t.usa_credito || 0) + (t.debito_saldato || 0);
    let effectClass = '';
    let effectText = 'Pari';

    if (saldoEffect > 0) {
      effectClass = 'saldo-credito';
      effectText = `+${formatNumber(saldoEffect)} €`;
    } else if (saldoEffect < 0) {
      effectClass = 'saldo-debito';
      effectText = `${formatNumber(saldoEffect)} €`;
    }

    return `
      <tr>
        <td>${formatDateItalian(t.consegna_data)}</td>
        <td class="col-num">${t.conto_produttore ? '€' + formatNumber(t.conto_produttore) : '-'}</td>
        <td class="col-num">${t.importo_saldato ? '€' + formatNumber(t.importo_saldato) : '-'}</td>
        <td class="col-num col-credito">${t.credito_lasciato ? '€' + formatNumber(t.credito_lasciato) : '-'}</td>
        <td class="col-num col-debito">${t.debito_lasciato ? '€' + formatNumber(t.debito_lasciato) : '-'}</td>
        <td class="col-num col-credito">${t.usa_credito ? '€' + formatNumber(t.usa_credito) : '-'}</td>
        <td class="col-num col-debito">${t.debito_saldato ? '€' + formatNumber(t.debito_saldato) : '-'}</td>
        <td class="${effectClass}" style="font-weight:bold;">${effectText}</td>
        <td class="col-note">${escapeHtml(t.note)}</td>
      </tr>
    `;
  }).join('');

  body.innerHTML = `
    <table class="transactions-table">
      <thead>
        <tr>
          <th>Data</th>
          <th class="col-num">Conto</th>
          <th class="col-num">Saldato</th>
          <th class="col-num">+Credito</th>
          <th class="col-num">+Debito</th>
          <th class="col-num">-Credito</th>
          <th class="col-num">-Debito</th>
          <th>Effetto</th>
          <th class="col-note">Note</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function closeTransactionsModal() {
  document.getElementById('transactions-modal').style.display = 'none';
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
  initCalendar({ onDateSelected: loadParticipants });

  const dateToLoad = restoreDateFromStorage();
  setDateDisplay(dateToLoad);

  // Ensure user data is loaded before rendering participant rows
  await checkSession();

  if (!isAdmin()) {
    const addBtn = document.getElementById('btn-add-participant');
    if (addBtn) addBtn.style.display = 'none';
    const thUsername = document.getElementById('th-username');
    if (thUsername) thUsername.style.display = 'none';
  }

  loadParticipants();
  loadConsegneDates();
});

// ===== EDIT USER MODAL =====

let editingUserId = null;

async function showEditUserModal(id) {
  editingUserId = id;

  try {
    const response = await fetch('/api/users');
    const result = await response.json();

    if (!result.success) {
      showStatus('Errore: ' + result.error, 'error');
      return;
    }

    const user = result.users.find(u => u.id === id);
    if (!user) {
      showStatus('Utente non trovato', 'error');
      return;
    }

    document.getElementById('edit-user-username').textContent = user.username;
    document.getElementById('edit-user-displayname').value = user.displayName;
    document.getElementById('edit-user-password').value = '';
    document.getElementById('edit-user-isadmin').checked = user.isAdmin;
    document.getElementById('edit-user-error').style.display = 'none';

    document.getElementById('edit-user-modal').style.display = 'flex';
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

function closeEditUserModal() {
  document.getElementById('edit-user-modal').style.display = 'none';
  editingUserId = null;
}

async function deleteUserFromModal() {
  const username = document.getElementById('edit-user-username').textContent;
  if (!confirm(`Sei sicuro di voler eliminare l'utente "${username}"?\n\nQuesta azione non può essere annullata.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/participants/${editingUserId}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (result.success) {
      closeEditUserModal();
      showStatus('Utente eliminato con successo!', 'success');
      loadParticipants();
    } else {
      const errorDiv = document.getElementById('edit-user-error');
      errorDiv.textContent = result.error || 'Errore durante l\'eliminazione';
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    const errorDiv = document.getElementById('edit-user-error');
    errorDiv.textContent = 'Errore di connessione';
    errorDiv.style.display = 'block';
  }
}

async function submitEditUser() {
  const displayName = document.getElementById('edit-user-displayname').value.trim();
  const newPassword = document.getElementById('edit-user-password').value;
  const isAdmin = document.getElementById('edit-user-isadmin').checked;
  const errorDiv = document.getElementById('edit-user-error');

  if (!displayName) {
    errorDiv.textContent = 'Il nome è obbligatorio';
    errorDiv.style.display = 'block';
    return;
  }

  if (newPassword && newPassword.length < 4) {
    errorDiv.textContent = 'La password deve essere di almeno 4 caratteri';
    errorDiv.style.display = 'block';
    return;
  }

  const data = { displayName, isAdmin };
  if (newPassword) {
    data.newPassword = newPassword;
  }

  try {
    const response = await fetch(`/api/users/${editingUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      closeEditUserModal();
      showStatus('Utente aggiornato con successo!', 'success');
      loadParticipants();
    } else {
      errorDiv.textContent = result.error || 'Errore durante l\'aggiornamento';
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    errorDiv.textContent = 'Errore di connessione';
    errorDiv.style.display = 'block';
  }
}
