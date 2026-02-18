// ===== STATE MANAGEMENT =====

let participants = [];
let editingId = null;

let pickerYear = new Date().getFullYear();
let pickerMonth = new Date().getMonth();
let isPickerOpen = false;
let consegneDates = new Set();

// ===== DATE PICKER =====

function toggleDatePicker() {
  const container = document.getElementById('date-picker-container');
  isPickerOpen = !isPickerOpen;

  if (isPickerOpen) {
    renderDatePicker();
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}

function renderDatePicker() {
  const container = document.getElementById('date-picker-container');
  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const firstDay = new Date(pickerYear, pickerMonth, 1);
  const lastDay = new Date(pickerYear, pickerMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Convert to Monday=0

  const today = new Date();
  const selectedDateStr = document.getElementById('data').value;

  let html = '<div class="date-picker-header">';
  html += `<button type="button" class="date-picker-nav" onclick="changePickerMonth(-1, event)">◀</button>`;
  html += `<div class="date-picker-month">${monthNames[pickerMonth]} ${pickerYear}</div>`;
  html += `<button type="button" class="date-picker-nav" onclick="changePickerMonth(1, event)">▶</button>`;
  html += '</div>';

  html += '<div class="date-picker-weekdays">';
  weekDays.forEach(day => {
    html += `<div class="date-picker-weekday">${day}</div>`;
  });
  html += '</div>';

  html += '<div class="date-picker-days">';
  for (let i = 0; i < startingDayOfWeek; i++) {
    html += '<div class="date-picker-day empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = today.getDate() === day && today.getMonth() === pickerMonth && today.getFullYear() === pickerYear;
    const isSelected = dateStr === selectedDateStr;
    const hasConsegna = consegneDates.has(dateStr);

    let classes = 'date-picker-day';
    if (isToday) classes += ' today';
    if (isSelected) classes += ' selected';
    if (hasConsegna) classes += ' has-consegna';

    html += `<div class="${classes}" onclick="selectPickerDate('${dateStr}')">${day}</div>`;
  }
  html += '</div>';

  // Legend (only show if we have consegne dates)
  if (consegneDates.size > 0) {
    html += '<div class="date-picker-legend">';
    html += '<div class="date-picker-legend-item">';
    html += '<div class="date-picker-legend-color" style="background: #2ecc71;"></div>';
    html += '<span>Con consegna</span>';
    html += '</div>';
    html += '</div>';
  }

  container.innerHTML = html;
}

function changePickerMonth(delta, event) {
  if (event) {
    event.stopPropagation();
  }
  pickerMonth += delta;
  if (pickerMonth > 11) {
    pickerMonth = 0;
    pickerYear++;
  } else if (pickerMonth < 0) {
    pickerMonth = 11;
    pickerYear--;
  }
  renderDatePicker();
}

function selectPickerDate(dateStr) {
  document.getElementById('data').value = dateStr;
  const [year, month, day] = dateStr.split('-');
  document.getElementById('data-display').value = `${day}-${month}-${year}`;

  // Update header date display
  setDateDisplay(dateStr);

  renderDatePicker();
  loadParticipants();

  // Close the date picker after selection
  toggleDatePicker();
}

function setDateDisplay(dateStr) {
  const [year, month, day] = dateStr.split('-');
  document.getElementById('data-display').value = `${day}-${month}-${year}`;
  document.getElementById('data').value = dateStr;

  // Update header date display
  const today = new Date().toISOString().split('T')[0];
  const headerDateDisplay = document.getElementById('header-date-display');
  if (headerDateDisplay) {
    if (dateStr === today) {
      headerDateDisplay.textContent = 'Oggi';
    } else {
      headerDateDisplay.textContent = '⚠️ ' + formatDateItalian(dateStr);
    }
  }

  // Set picker to the same month/year
  pickerYear = parseInt(year);
  pickerMonth = parseInt(month) - 1;

  // Save to sessionStorage for tab navigation
  sessionStorage.setItem('gass_selected_date', dateStr);
}

function restoreDateFromStorage() {
  // Check if this is a page reload vs tab navigation
  const navEntry = performance.getEntriesByType('navigation')[0];
  const isReload = navEntry && navEntry.type === 'reload';

  // On reload, always use today's date
  if (isReload) {
    const today = new Date().toISOString().split('T')[0];
    sessionStorage.setItem('gass_selected_date', today);
    return today;
  }

  // On tab navigation, restore from sessionStorage
  const savedDate = sessionStorage.getItem('gass_selected_date');
  if (savedDate) {
    return savedDate;
  }

  return new Date().toISOString().split('T')[0];
}

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

// ===== DATA LOADING =====

async function loadParticipants() {
  try {
    const dateInput = document.getElementById('data');
    const date = dateInput ? dateInput.value : null;
    const today = new Date().toISOString().split('T')[0];

    // Build URL with optional date parameter
    // For today's date, don't pass date parameter to get current saldi from partecipanti table
    let url = '/api/participants';
    if (date && date !== today) {
      url += `?date=${date}`;
    }

    const response = await fetch(url);
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

async function loadConsegneDates() {
  try {
    const response = await fetch('/api/storico');
    const result = await response.json();

    if (result.success) {
      consegneDates = new Set(result.consegne.map(c => c.data));
    }
  } catch (error) {
    console.error('Error loading consegne dates:', error);
  }
}

// ===== RENDERING =====

function renderParticipants() {
  const tbody = document.getElementById('participants-body');
  tbody.innerHTML = '';

  const colspan = isAdmin() ? 5 : 4;

  if (participants.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center;">Nessun partecipante</td></tr>`;
    return;
  }

  participants.forEach(p => {
    const row = createParticipantRow(p);
    tbody.appendChild(row);
  });
}

function isViewingToday() {
  const dateInput = document.getElementById('data');
  const today = new Date().toISOString().split('T')[0];
  return !dateInput || dateInput.value === today;
}

function createParticipantRow(p) {
  const row = document.createElement('tr');
  const saldoClass = p.saldo < 0 ? 'saldo-debito' : p.saldo > 0 ? 'saldo-credito' : '';
  const saldoText = formatNumber(p.saldo);
  const adminBadge = p.is_admin ? '<span class="admin-badge">Admin</span>' : '';

  // Only show actions column for admin users viewing today's date
  // Historical saldi cannot be edited (they are calculated from movimenti)
  const canEdit = isAdmin() && isViewingToday();
  const actionsColumn = isAdmin()
    ? `<td>
         <button onclick="editSaldo(${p.id})" id="edit-btn-${p.id}" ${canEdit ? '' : 'disabled'}>Modifica Saldo</button>
         <button onclick="saveSaldo(${p.id})" id="save-btn-${p.id}" style="display: none;" class="btn-save">Salva</button>
         <button onclick="cancelEdit(${p.id})" id="cancel-btn-${p.id}" style="display: none;">Annulla</button>
         <button onclick="showEditUserModal(${p.id})">Modifica Utente</button>
       </td>`
    : '';

  row.innerHTML = `
    <td>${escapeHtml(p.username) || '-'}${adminBadge}</td>
    <td><strong>${escapeHtml(p.nome)}</strong></td>
    <td class="${saldoClass}">
      <span id="saldo-view-${p.id}">€${saldoText}</span>
      <input type="text" inputmode="decimal" id="saldo-edit-${p.id}" value="${p.saldo}"
             style="display: none;"
             oninput="normalizeInputField(this)"
             onfocus="handleInputFocus(this)"
             onkeydown="if(event.key==='Enter'){event.preventDefault();saveSaldo(${p.id})}">
    </td>
    <td>${formatDateItalian(p.ultima_modifica)}</td>
    ${actionsColumn}
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

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
  // Restore date (today on reload, preserved on tab navigation)
  const dateToLoad = restoreDateFromStorage();
  setDateDisplay(dateToLoad);

  loadParticipants();
  loadConsegneDates();
});

// ===== CLICK OUTSIDE HANDLER =====

// Close date picker when clicking outside
document.addEventListener('click', function(event) {
  if (!isPickerOpen) return;

  const pickerContainer = document.getElementById('date-picker-container');
  const dateButton = document.querySelector('.change-date-btn');

  // Check if click is outside picker and not on the button
  if (pickerContainer && dateButton) {
    const isClickInsidePicker = pickerContainer.contains(event.target);
    const isClickOnButton = dateButton.contains(event.target);

    if (!isClickInsidePicker && !isClickOnButton) {
      toggleDatePicker();
    }
  }
});

// ===== EDIT USER MODAL (Admin only) =====

let editingUserId = null;

async function showEditUserModal(id) {
  editingUserId = id;

  // Fetch full user info from /api/users
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

    // Populate modal fields
    document.getElementById('edit-user-username').textContent = user.username;
    document.getElementById('edit-user-displayname').value = user.displayName;
    document.getElementById('edit-user-password').value = '';
    document.getElementById('edit-user-isadmin').checked = user.isAdmin;
    document.getElementById('edit-user-error').style.display = 'none';

    // Show modal
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
