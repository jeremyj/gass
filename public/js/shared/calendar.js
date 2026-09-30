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

function renderDatePicker() {
  const container = document.getElementById('date-picker-container');
  if (!container) return;

  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const firstDay = new Date(pickerYear, pickerMonth, 1);
  const lastDay = new Date(pickerYear, pickerMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Convert to Monday=0

  const today = new Date();
  const dataInput = document.getElementById('data');
  const selectedDateStr = dataInput ? dataInput.value : '';

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
    html += '<div class="date-picker-legend-color"></div>';
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

  // Set picker to the same month/year
  pickerYear = parseInt(year);
  pickerMonth = parseInt(month) - 1;

  // Persist selected date in sessionStorage (for tab navigation)
  sessionStorage.setItem('gass_selected_date', dateStr);

  // Call page-specific callback
  if (onDateSelected) {
    onDateSelected(dateStr);
  }
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
