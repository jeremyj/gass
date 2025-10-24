// ===== STATE MANAGEMENT =====

let participants = [];
let editingId = null;

let pickerYear = new Date().getFullYear();
let pickerMonth = new Date().getMonth();
let isPickerOpen = false;

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
  html += `<button type="button" class="date-picker-nav" onclick="changePickerMonth(-1)">◀</button>`;
  html += `<div class="date-picker-month">${monthNames[pickerMonth]} ${pickerYear}</div>`;
  html += `<button type="button" class="date-picker-nav" onclick="changePickerMonth(1)">▶</button>`;
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

    let classes = 'date-picker-day';
    if (isToday) classes += ' today';
    if (isSelected) classes += ' selected';

    html += `<div class="${classes}" onclick="selectPickerDate('${dateStr}')">${day}</div>`;
  }
  html += '</div>';

  container.innerHTML = html;
}

function changePickerMonth(delta) {
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
}

// ===== UI HELPERS =====

function showAddForm() {
  document.getElementById('add-form').style.display = 'block';
  document.getElementById('new-name').value = '';
  document.getElementById('new-name').focus();
}

function hideAddForm() {
  document.getElementById('add-form').style.display = 'none';
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

// ===== RENDERING =====

function renderParticipants() {
  const tbody = document.getElementById('participants-body');
  tbody.innerHTML = '';

  if (participants.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nessun partecipante</td></tr>';
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
  const saldoText = p.saldo.toFixed(2);

  row.innerHTML = `
    <td><strong>${p.nome}</strong></td>
    <td class="${saldoClass}">
      <span id="saldo-view-${p.id}">€${saldoText}</span>
      <input type="text" inputmode="decimal" id="saldo-edit-${p.id}" value="${p.saldo}"
             style="display: none;"
             oninput="normalizeInputField(this)"
             onfocus="handleInputFocus(this)"
             onkeydown="if(event.key==='Enter'){event.preventDefault();saveSaldo(${p.id})}">
    </td>
    <td>${formatDateItalian(p.ultima_modifica)}</td>
    <td>
      <button onclick="editSaldo(${p.id})" id="edit-btn-${p.id}">Modifica</button>
      <button onclick="saveSaldo(${p.id})" id="save-btn-${p.id}" style="display: none;" class="btn-save">Salva</button>
      <button onclick="cancelEdit(${p.id})" id="cancel-btn-${p.id}" style="display: none;">Annulla</button>
    </td>
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

  if (!nome) {
    showStatus('Inserisci un nome', 'error');
    return;
  }

  try {
    const response = await fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

// ===== SYNC (UNUSED) =====

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

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  setDateDisplay(today);

  loadParticipants();
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
