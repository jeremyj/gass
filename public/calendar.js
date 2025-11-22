// ===== SHARED CALENDAR AND DATE PICKER UTILITIES =====
// Used across consegna.js and debiti.js

// ===== STATE MANAGEMENT =====

let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth();
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
  if (config.consegneDates) {
    consegneDates = new Set(config.consegneDates);
  }
}

// ===== CALENDAR MODAL =====

function showCalendarModal() {
  const calendar = document.getElementById('calendar-container');
  if (calendar) {
    // Reset to current month when opening
    const today = new Date();
    currentCalendarYear = today.getFullYear();
    currentCalendarMonth = today.getMonth();

    renderCalendar();
    calendar.classList.toggle('hidden');
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
  const dataInput = document.getElementById('data');
  const dataDisplayInput = document.getElementById('data-display');
  const headerDateDisplay = document.getElementById('header-date-display');

  if (dataInput) {
    dataInput.value = dateStr;
  }

  if (dataDisplayInput) {
    const [year, month, day] = dateStr.split('-');
    dataDisplayInput.value = `${day}-${month}-${year}`;
  }

  // Update header date display
  if (headerDateDisplay) {
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) {
      headerDateDisplay.textContent = 'Oggi';
    } else {
      const [year, month, day] = dateStr.split('-');
      headerDateDisplay.textContent = '⚠️ ' + `${day}/${month}/${year}`;
    }
  }

  // Persist selected date in localStorage
  localStorage.setItem('gass_selected_date', dateStr);

  renderDatePicker();

  // Call page-specific callback
  if (onDateSelected) {
    onDateSelected(dateStr);
  }

  // Close the date picker after selection
  toggleDatePicker();
}

// ===== CALENDAR (for modal) =====

function renderCalendar() {
  const container = document.getElementById('calendar-container');
  if (!container) return;

  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const today = new Date();
  const dataInput = document.getElementById('data');
  const selectedDate = dataInput ? dataInput.value : '';

  // Get first and last day of month
  const firstDay = new Date(currentCalendarYear, currentCalendarMonth, 1);
  const lastDay = new Date(currentCalendarYear, currentCalendarMonth + 1, 0);

  // Adjust firstDay to Monday (1 = Monday, 0 = Sunday)
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1; // Convert Sunday from 0 to 6

  let html = '<div class="calendar">';

  // Header
  html += '<div class="calendar-header">';
  html += `<button type="button" class="calendar-nav" onclick="changeMonth(-1, event)">◀</button>`;
  html += `<h3>${monthNames[currentCalendarMonth]} ${currentCalendarYear}</h3>`;
  html += `<button type="button" class="calendar-nav" onclick="changeMonth(1, event)">▶</button>`;
  html += '</div>';

  // Weekdays
  html += '<div class="calendar-weekdays">';
  weekDays.forEach(day => {
    html += `<div class="calendar-weekday">${day}</div>`;
  });
  html += '</div>';

  // Days
  html += '<div class="calendar-days">';

  // Empty cells before first day
  for (let i = 0; i < startDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  // Days of month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === today.toISOString().split('T')[0];
    const isSelected = dateStr === selectedDate;
    const hasConsegna = consegneDates.has(dateStr);

    let classes = 'calendar-day';
    if (isToday) classes += ' today';
    if (isSelected) classes += ' selected';
    if (hasConsegna) classes += ' has-consegna';
    else classes += ' no-consegna';

    html += `<div class="${classes}" onclick="selectDate('${dateStr}')">${day}</div>`;
  }

  html += '</div>';

  // Legend
  html += '<div class="calendar-legend">';
  html += '<div class="calendar-legend-item">';
  html += '<div class="calendar-legend-color" style="background: #2ecc71;"></div>';
  html += '<span>Con consegna</span>';
  html += '</div>';
  html += '</div>';

  html += '</div>';
  container.innerHTML = html;
}

function changeMonth(delta, event) {
  if (event) {
    event.stopPropagation();
  }
  currentCalendarMonth += delta;
  if (currentCalendarMonth > 11) {
    currentCalendarMonth = 0;
    currentCalendarYear++;
  } else if (currentCalendarMonth < 0) {
    currentCalendarMonth = 11;
    currentCalendarYear--;
  }
  renderCalendar();
}

function selectDate(dateStr) {
  setDateDisplay(dateStr);
  renderCalendar();
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

  // Update header date display
  if (headerDateDisplay) {
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) {
      headerDateDisplay.textContent = 'Oggi';
    } else {
      headerDateDisplay.textContent = '⚠️ ' + formatDateItalian(dateStr);
    }
  }

  // Set picker to the same month/year
  pickerYear = parseInt(year);
  pickerMonth = parseInt(month) - 1;

  // Also set calendar to same month/year
  currentCalendarYear = parseInt(year);
  currentCalendarMonth = parseInt(month) - 1;

  // Persist selected date in localStorage
  localStorage.setItem('gass_selected_date', dateStr);

  // Call page-specific callback
  if (onDateSelected) {
    onDateSelected(dateStr);
  }
}

// ===== HELPER FUNCTIONS =====

function setConsegneDates(dates) {
  consegneDates = new Set(dates);
  // Re-render if calendar/picker is visible
  const calendarContainer = document.getElementById('calendar-container');
  const pickerContainer = document.getElementById('date-picker-container');

  if (calendarContainer && !calendarContainer.classList.contains('hidden')) {
    renderCalendar();
  }

  if (pickerContainer && pickerContainer.style.display !== 'none') {
    renderDatePicker();
  }
}

function getSelectedDate() {
  const dataInput = document.getElementById('data');
  return dataInput ? dataInput.value : null;
}

function restoreDateFromStorage() {
  const savedDate = localStorage.getItem('gass_selected_date');
  if (savedDate) {
    return savedDate;
  }
  return new Date().toISOString().split('T')[0];
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
