// ===== STATE MANAGEMENT =====

let participants = [];

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

  const list = visibleParticipants();
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">Nessun partecipante</td></tr>`;
    return;
  }

  list.forEach(p => {
    const row = createParticipantRow(p);
    tbody.appendChild(row);
  });

  renderSaldiHint();
}

function createParticipantRow(p) {
  const row = document.createElement('tr');
  const saldo = saldoLabel(p.saldo);
  const adminBadge = (p.is_admin ? '<span class="admin-badge">admin</span>' : '')
    + (p.stato === 'attivo' ? '' : `<span class="admin-badge">${p.stato}</span>`);

  const canEdit = isAdmin() && isViewingToday();
  if (p.stato === 'disattivato') row.classList.add('off');

  row.innerHTML = `
    <td class="nm">${escapeHtml(p.nome)}</td>
    ${isAdmin() ? `<td class="left">${escapeHtml(p.username) || '–'}${adminBadge}</td>` : ''}
    <td>
      <span id="saldo-view-${p.id}" class="pill ${saldo.cls}">${saldo.amount} ${saldo.word}</span>
      <input type="text" inputmode="decimal" id="saldo-edit-${p.id}" value="${formatNumber(p.saldo)}"
             class="saldo-input initially-hidden" aria-label="Nuovo saldo (negativo = debito)"
             oninput="normalizeInputField(this)"
             onfocus="handleInputFocus(this)"
             onkeydown="if(event.key==='Enter'){event.preventDefault();saveSaldo(${p.id})}">
    </td>
    <td>${formatDateItalian(p.ultima_modifica)}</td>
    <td class="lk">
      <button type="button" class="link-btn" onclick="showTransactionsModal(${p.id})">Transazioni</button>
      ${isAdmin() ? `<button type="button" class="link-btn" onclick="showEditUserModal(${p.id})">Modifica utente</button>` : ''}
      ${canEdit ? `
        <button type="button" class="link-btn" onclick="editSaldo(${p.id})" id="edit-btn-${p.id}">Modifica saldo</button>
        <button type="button" class="link-btn initially-hidden" onclick="saveSaldo(${p.id})" id="save-btn-${p.id}">Salva</button>
        <button type="button" class="link-btn initially-hidden" onclick="cancelEdit(${p.id})" id="cancel-btn-${p.id}">Annulla</button>
      ` : ''}
    </td>
  `;

  return row;
}

// ===== EDIT SALDO =====

function editSaldo(id) {
  const inputField = document.getElementById(`saldo-edit-${id}`);

  document.getElementById(`saldo-view-${id}`).style.display = 'none';
  inputField.style.display = 'inline-block';
  document.getElementById(`edit-btn-${id}`).style.display = 'none';
  document.getElementById(`save-btn-${id}`).style.display = 'inline-block';
  document.getElementById(`cancel-btn-${id}`).style.display = 'inline-block';

  handleInputFocus(inputField);
  inputField.focus();
  inputField.select();
}

function cancelEdit(id) {
  const participant = participants.find(p => p.id === id);
  document.getElementById(`saldo-edit-${id}`).value = formatNumber(participant.saldo);
  document.getElementById(`saldo-view-${id}`).style.display = 'inline';
  document.getElementById(`saldo-edit-${id}`).style.display = 'none';
  document.getElementById(`edit-btn-${id}`).style.display = 'inline-block';
  document.getElementById(`save-btn-${id}`).style.display = 'none';
  document.getElementById(`cancel-btn-${id}`).style.display = 'none';
}

async function saveSaldo(id) {
  const newSaldo = parseAmount(document.getElementById(`saldo-edit-${id}`).value);

  try {
    await API.put(`/api/participants/${id}`, { saldo: newSaldo });
    showStatus('Saldo aggiornato con successo!', 'success');
    loadParticipants();
  } catch (error) {
    showStatus('Errore durante l\'aggiornamento: ' + error.message, 'error');
  }
}

// ===== ADD PARTICIPANT =====

async function addParticipant() {
  const nome = document.getElementById('new-name').value.trim();
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value;

  if (!nome || !username || !password) {
    showStatus('Tutti i campi sono obbligatori', 'error');
    return;
  }

  if (password.length < 8) {
    showStatus('La password deve essere di almeno 8 caratteri', 'error');
    return;
  }

  try {
    await API.post('/api/participants', { nome, username, password });
    showStatus('Partecipante aggiunto con successo!', 'success');
    hideAddForm();
    loadParticipants();
  } catch (error) {
    showStatus('Errore durante l\'aggiunta: ' + error.message, 'error');
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
          <button type="button" class="modal-close-btn" onclick="closeTransactionsModal()" aria-label="Chiudi">&times;</button>
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
  document.getElementById('transactions-modal-title').textContent = `Transazioni di ${name}`;
  document.getElementById('transactions-modal-body').innerHTML = '<p>Caricamento...</p>';
  document.getElementById('transactions-modal').style.display = 'flex';

  try {
    const result = await API.get(`/api/participants/${id}/transactions`);
    renderTransactionsTable(result.transactions);
  } catch (error) {
    document.getElementById('transactions-modal-body').innerHTML = `<p>Errore: ${escapeHtml(error.message)}</p>`;
  }
}

function renderTransactionsTable(transactions) {
  const body = document.getElementById('transactions-modal-body');

  if (transactions.length === 0) {
    body.innerHTML = '<p>Nessuna transazione</p>';
    return;
  }

  const num = (value, cls = '') => value ? `<td class="${cls}">${formatNumber(value)}</td>` : '<td class="mute">–</td>';
  const rows = transactions.map(t => {
    const saldo = saldoLabel(t.saldo_dopo);
    const saldoCell = `<td><span class="pill ${saldo.cls}">${saldo.amount}</span></td>`;

    if (t.tipo === 'rettifica') {
      return `
      <tr>
        <td class="left">${formatDateItalian(t.data)}</td>
        <td colspan="6" class="left">Rettifica manuale ${formatSigned(t.importo)}</td>
        ${saldoCell}
        <td class="nt">${escapeHtml(t.note)}</td>
      </tr>
    `;
    }

    return `
      <tr>
        <td class="left">${formatDateItalian(t.data)}</td>
        ${num(t.conto_produttore)}
        ${num(t.importo_saldato)}
        ${num(t.credito_lasciato, 'cr')}
        ${num(debitoNuovo(t), 'db')}
        ${num(t.usa_credito)}
        ${num(debitoPagato(t))}
        ${saldoCell}
        <td class="nt">${escapeHtml(t.note)}</td>
      </tr>
    `;
  }).join('');

  body.innerHTML = `
    <table class="t">
      <thead>
        <tr>
          <th class="left">Data</th>
          <th>Conto</th>
          <th>Saldato</th>
          <th>Lascia credito</th>
          <th>Lascia debito</th>
          <th>Usa credito</th>
          <th>Salda debito</th>
          <th>Saldo dopo</th>
          <th class="nt">Note</th>
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

  // Ensure user data is loaded before rendering participant rows
  await sessionReady;

  const dateToLoad = restoreDateFromStorage();
  setDateDisplay(dateToLoad);

  if (!isAdmin()) {
    const addBtn = document.getElementById('btn-add-participant');
    if (addBtn) addBtn.style.display = 'none';
    const thUsername = document.getElementById('th-username');
    if (thUsername) thUsername.style.display = 'none';
  } else {
    document.getElementById('show-inactive-wrap').classList.remove('initially-hidden');
  }

  loadParticipants();
  loadConsegneDates();
});

// ===== EDIT USER MODAL =====

let editingUserId = null;
let editingUserStato = null;

async function showEditUserModal(id) {
  editingUserId = id;

  try {
    const result = await API.get('/api/users');
    const user = result.users.find(u => u.id === id);
    if (!user) {
      showStatus('Utente non trovato', 'error');
      return;
    }

    document.getElementById('edit-user-username').textContent = user.username;
    document.getElementById('edit-user-displayname').value = user.displayName;
    document.getElementById('edit-user-password').value = '';
    document.getElementById('edit-user-error').style.display = 'none';
    editingUserStato = user.stato;
    document.querySelector(`input[name="edit-user-stato"][value="${user.stato}"]`).checked = true;

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
  const ok = await confirmDialog({
    title: "Eliminare l'utente?",
    message: 'Questa azione non può essere annullata.',
    details: [['Utente', username]],
    confirmText: 'Elimina utente',
    danger: true
  });
  if (!ok) return;

  try {
    await API.delete(`/api/participants/${editingUserId}`);
    closeEditUserModal();
    showStatus('Utente eliminato con successo!', 'success');
    loadParticipants();
  } catch (error) {
    const errorDiv = document.getElementById('edit-user-error');
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  }
}

async function submitEditUser() {
  const displayName = document.getElementById('edit-user-displayname').value.trim();
  const newPassword = document.getElementById('edit-user-password').value;
  const errorDiv = document.getElementById('edit-user-error');

  if (!displayName) {
    errorDiv.textContent = 'Il nome è obbligatorio';
    errorDiv.style.display = 'block';
    return;
  }

  if (newPassword && newPassword.length < 8) {
    errorDiv.textContent = 'La password deve essere di almeno 8 caratteri';
    errorDiv.style.display = 'block';
    return;
  }

  const stato = document.querySelector('input[name="edit-user-stato"]:checked').value;
  if (stato !== editingUserStato && stato !== 'attivo') {
    const username = document.getElementById('edit-user-username').textContent;
    const saldo = saldoLabel(participants.find(p => p.id === editingUserId)?.saldo || 0);
    const ok = await confirmDialog({
      title: stato === 'sospeso' ? "Sospendere l'utente?" : "Disattivare l'utente?",
      message: (stato === 'sospeso'
        ? 'Non farà più turni; i suoi turni nelle prossime 12 settimane restano da coprire.'
        : 'Non comparirà più negli elenchi e non potrà accedere; i suoi turni futuri restano da coprire.')
        + (saldo.cls && stato === 'disattivato' ? ` Attenzione: ha ancora ${saldo.amount} di ${saldo.word}.` : ''),
      details: [['Utente', username], ['Saldo', `${saldo.amount} ${saldo.word}`]],
      confirmText: stato === 'sospeso' ? 'Sospendi' : 'Disattiva utente',
      danger: stato === 'disattivato'
    });
    if (!ok) return;
  }

  const data = { displayName, stato };
  if (newPassword) {
    data.newPassword = newPassword;
  }

  try {
    await API.put(`/api/users/${editingUserId}`, data);
    closeEditUserModal();
    showStatus('Utente aggiornato con successo!', 'success');
    loadParticipants();
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  }
}
