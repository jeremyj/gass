// ===== SHARED CALENDAR AND DATE PICKER UTILITIES =====
// Used across consegna.js and debiti.js

// ===== STATE MANAGEMENT =====

let consegneDates = new Set(); // Store dates with saved consegne

// Date picker state
let pickerYear = new Date().getFullYear();
let pickerMonth = new Date().getMonth();
let isPickerOpen = false;

// Callback functions (to be set by individual pages)
let onDateSelected = null; // Called when a date is selected

// ===== CONFIGURATION =====

function initCalendar(config = {}) {
  if (config.onDateSelected) {
    onDateSelected = config.onDateSelected;
  }
}

// ===== DATE PICKER =====

function toggleDatePicker() {
  const container = document.getElementById('date-picker-container');
  if (!container) return;

  isPickerOpen = !isPickerOpen;

  if (isPickerOpen) {
    // Reset to current month when opening
    const today = new Date();
    pickerYear = today.getFullYear();
    pickerMonth = today.getMonth();

    renderDatePicker();
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}

// Month grid shared by the page date picker and the date fields.
// onDay(dateStr) / onNav(delta) return the onclick JS for a day / the arrows.
function pickerHtml(year, month, selectedStr, { onDay, onNav, marked = new Set(), footer = '' }) {
  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Convert to Monday=0
  const todayStr = toLocalDateString();

  let html = '<div class="date-picker-header">';
  html += `<button type="button" class="date-picker-nav" onclick="${onNav(-1)}">◀</button>`;
  html += `<div class="date-picker-month">${monthNames[month]} ${year}</div>`;
  html += `<button type="button" class="date-picker-nav" onclick="${onNav(1)}">▶</button>`;
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
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let classes = 'date-picker-day';
    if (dateStr === todayStr) classes += ' today';
    if (dateStr === selectedStr) classes += ' selected';
    if (marked.has(dateStr)) classes += ' has-consegna';
    html += `<div class="${classes}" onclick="${onDay(dateStr)}">${day}</div>`;
  }
  html += '</div>';

  return html + `<div class="date-picker-legend">${footer}</div>`;
}

function renderDatePicker() {
  const container = document.getElementById('date-picker-container');
  if (!container) return;

  const dataInput = document.getElementById('data');
  // Footer: legend (only if we have consegne dates) and the "Oggi" shortcut
  let footer = '';
  if (consegneDates.size > 0) {
    footer += '<div class="date-picker-legend-item"><div class="date-picker-legend-color"></div><span>Con consegna</span></div>';
  }
  footer += `<button type="button" class="date-picker-today" onclick="selectPickerDate(toLocalDateString())">Oggi</button>`;

  container.innerHTML = pickerHtml(pickerYear, pickerMonth, dataInput ? dataInput.value : '', {
    onDay: d => `selectPickerDate('${d}')`,
    onNav: delta => `changePickerMonth(${delta}, event)`,
    marked: consegneDates,
    footer
  });
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
  setDateDisplay(dateStr);
  toggleDatePicker();
}

// ===== DATE DISPLAY =====

function setDateDisplay(dateStr) {
  const dataInput = document.getElementById('data');
  const dataDisplayInput = document.getElementById('data-display');
  const headerDateDisplay = document.getElementById('header-date-display');

  if (!dateStr) return;

  const [year, month, day] = dateStr.split('-');

  if (dataDisplayInput) {
    dataDisplayInput.value = `${day}-${month}-${year}`;
  }

  if (dataInput) {
    dataInput.value = dateStr;
  }

  // Header: "martedì 4 novembre"; the label above it (data-label / data-today) says whether it's today
  if (headerDateDisplay) {
    headerDateDisplay.textContent = formatDateLong(dateStr);
  }
  const headerWhen = document.getElementById('header-when');
  if (headerWhen) {
    const isToday = dateStr === toLocalDateString();
    headerWhen.textContent = isToday ? headerWhen.dataset.today : headerWhen.dataset.label;
    headerWhen.classList.toggle('not-today', !isToday);
  }
  applySeason(dateStr);
}

// ===== HELPER FUNCTIONS =====

function setConsegneDates(dates) {
  consegneDates = new Set(dates);
  // Re-render if picker is visible
  const pickerContainer = document.getElementById('date-picker-container');
  if (pickerContainer && pickerContainer.style.display !== 'none') {
    renderDatePicker();
  }
}

async function loadConsegneDates() {
  try {
    const result = await API.get('/api/storico');
    setConsegneDates(result.consegne.map(c => c.data));
  } catch (error) {
    console.error('Error loading consegne dates:', error);
  }
}

function getSelectedDate() {
  const dataInput = document.getElementById('data');
  return dataInput ? dataInput.value : null;
}

function restoreDateFromStorage() {
  // Check if this is a page reload vs tab navigation
  const navEntry = performance.getEntriesByType('navigation')[0];
  const isReload = navEntry && navEntry.type === 'reload';

  // On reload, always use today's date
  if (isReload) {
    const today = toLocalDateString();
    sessionStorage.setItem('gass_selected_date', today);
    return today;
  }

  // On tab navigation, restore from sessionStorage
  const savedDate = sessionStorage.getItem('gass_selected_date');
  if (savedDate) {
    return savedDate;
  }

  return toLocalDateString();
}

// ===== DATE FIELDS =====
// A text input that opens the app calendar. The yyyy-mm-dd value lives in
// dataset.value (read with dateFieldValue), the input shows dd/mm/yyyy.
// The popup sits on <body> so a modal's scroll box does not clip it.

const dateFields = {}; // id -> { year, month, popup }

function initDateField(id) {
  const input = document.getElementById(id);
  input.readOnly = true;
  input.classList.add('date-field');
  const popup = document.createElement('div');
  popup.className = 'date-picker-popup date-field-popup initially-hidden';
  document.body.appendChild(popup);
  dateFields[id] = { year: 0, month: 0, popup };
  input.addEventListener('click', () => toggleDateField(id));
}

function setDateField(id, dateStr) {
  const input = document.getElementById(id);
  input.dataset.value = dateStr || '';
  input.value = dateStr ? formatDateItalian(dateStr) : '';
}

function dateFieldValue(id) {
  return document.getElementById(id).dataset.value || '';
}

function toggleDateField(id) {
  const f = dateFields[id];
  if (!f.popup.classList.contains('initially-hidden')) return closeDateField(id);
  const [y, m] = (dateFieldValue(id) || toLocalDateString()).split('-').map(Number);
  f.year = y; f.month = m - 1;
  renderDateField(id);
  f.popup.classList.remove('initially-hidden');
  // Below the field, or above it when the window has no room left below
  const r = document.getElementById(id).getBoundingClientRect();
  const h = f.popup.offsetHeight + 12;
  const top = r.bottom + h > window.innerHeight && r.top > h ? r.top - h : r.bottom;
  f.popup.style.top = `${top + window.scrollY}px`;
  f.popup.style.left = `${r.left + window.scrollX}px`;
}

function closeDateField(id) {
  dateFields[id].popup.classList.add('initially-hidden');
}

function renderDateField(id) {
  const f = dateFields[id];
  f.popup.innerHTML = pickerHtml(f.year, f.month, dateFieldValue(id), {
    onDay: d => `pickDateField('${id}', '${d}')`,
    onNav: delta => `moveDateField('${id}', ${delta}, event)`,
    footer: `<button type="button" class="date-picker-today" onclick="pickDateField('${id}', toLocalDateString())">Oggi</button>`
  });
}

function moveDateField(id, delta, event) {
  if (event) event.stopPropagation();
  const f = dateFields[id];
  const d = new Date(f.year, f.month + delta, 1);
  f.year = d.getFullYear(); f.month = d.getMonth();
  renderDateField(id);
}

function pickDateField(id, dateStr) {
  setDateField(id, dateStr);
  closeDateField(id);
}

document.addEventListener('click', function(event) {
  for (const [id, f] of Object.entries(dateFields)) {
    if (f.popup.classList.contains('initially-hidden')) continue;
    if (!f.popup.contains(event.target) && event.target.id !== id) closeDateField(id);
  }
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
