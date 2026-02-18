// ===== SHARED DEBITI LOGIC =====
// Used by both debiti.js (mobile) and debiti-desktop.js
//
// Depends on: participants (defined in page-specific JS)
// Depends on: utils.js, calendar.js (setConsegneDates)

// ===== DATA LOADING =====

async function loadParticipants() {
  try {
    const dateInput = document.getElementById('data');
    const date = dateInput ? dateInput.value : null;
    const today = new Date().toISOString().split('T')[0];

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
      setConsegneDates(result.consegne.map(c => c.data));
    }
  } catch (error) {
    console.error('Error loading consegne dates:', error);
  }
}

// ===== HELPERS =====

function isViewingToday() {
  const dateInput = document.getElementById('data');
  const today = new Date().toISOString().split('T')[0];
  return !dateInput || dateInput.value === today;
}
