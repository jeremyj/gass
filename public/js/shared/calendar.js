// ===== SHARED CALENDAR AND DATE UTILITIES =====
// Month grid for the date fields, and the page header date (setDateDisplay)

// ===== DATE PICKER =====

// Month grid of the date fields.
// onDay(dateStr) / onNav(delta) return the onclick JS for a day / the arrows.
function pickerHtml(year, month, selectedStr, { onDay, onNav, footer = '' }) {
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
    html += `<div class="${classes}" onclick="${onDay(dateStr)}">${day}</div>`;
  }
  html += '</div>';

  return html + `<div class="date-picker-legend">${footer}</div>`;
}

// ===== DATE DISPLAY =====

function setDateDisplay(dateStr) {
  const dataInput = document.getElementById('data');
  const headerDateDisplay = document.getElementById('header-date-display');

  if (!dateStr) return;

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

function getSelectedDate() {
  const dataInput = document.getElementById('data');
  return dataInput ? dataInput.value : null;
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
  document.getElementById(id).dispatchEvent(new Event('change'));
}

document.addEventListener('click', function(event) {
  for (const [id, f] of Object.entries(dateFields)) {
    if (f.popup.classList.contains('initially-hidden')) continue;
    if (!f.popup.contains(event.target) && event.target.id !== id) closeDateField(id);
  }
});
