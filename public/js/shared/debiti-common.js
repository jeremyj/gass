// ===== SHARED DEBITI LOGIC =====
// Used by both debiti.js (mobile) and debiti-desktop.js
//
// Depends on: participants (defined in page-specific JS)
// Depends on: utils.js

// ===== DATA LOADING =====

async function loadParticipants() {
  try {
    const dateInput = document.getElementById('data');
    const date = dateInput ? dateInput.value : null;
    const today = toLocalDateString();

    let url = '/api/participants';
    if (date && date !== today) {
      url += `?date=${date}`;
    }

    const result = await API.get(url);
    participants = result.participants;
    renderParticipants();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

// ===== HELPERS =====

function isViewingToday() {
  const dateInput = document.getElementById('data');
  const today = toLocalDateString();
  return !dateInput || dateInput.value === today;
}
