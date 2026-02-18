// ===== SHARED UTILITY FUNCTIONS =====
// Used across consegna.js, storico.js, and debiti.js

// Escape HTML special characters to prevent XSS
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Display status message to user
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status ' + type;
  setTimeout(() => {
    status.className = 'status';
  }, 5000);
}

// Format date from yyyy-mm-dd to dd/mm/yyyy
function formatDateItalian(dateStr) {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// Replace comma with dot and validate decimal input in real-time
function normalizeInputField(input) {
  if (input.value.includes(',')) {
    const cursorPos = input.selectionStart;
    input.value = input.value.replace(',', '.');
    input.setSelectionRange(cursorPos, cursorPos);
  }

  const valid = /^-?\d*\.?\d*$/.test(input.value);
  if (!valid && input.value !== '') {
    input.value = input.value.slice(0, -1);
  }
}

// Clear zero values on input focus for easier editing
function handleInputFocus(input) {
  if (input.value === '0' || input.value === '0.0' || input.value === '0.00') {
    input.value = '';
  }
}

// Normalize decimal string (comma to dot)
function normalizeDecimal(value) {
  if (typeof value === 'string') {
    return value.replace(',', '.');
  }
  return value;
}

// Parse amount string to number with decimal normalization
function parseAmount(value) {
  const normalized = normalizeDecimal(value);
  return parseFloat(normalized) || 0;
}

// Round to 0.1€ (1 decimo) - matches server-side rounding
function roundUpCents(amount) {
  return Math.round(amount * 10) / 10;
}

// Format saldo for display (remove unnecessary .0)
function formatSaldo(val) {
  const formatted = Math.abs(val).toFixed(1);
  return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
}

// Format a number for display, hiding .00 decimals
function formatNumber(value) {
  if (value === null || value === undefined) return '';
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  return num % 1 === 0 ? num.toString() : num.toFixed(2);
}

// View mode switching removed - using only user-agent detection now
