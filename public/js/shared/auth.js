/**
 * Authentication utilities
 * Shared across all pages for session management and logout
 */

// Global user state
let currentUser = null;

// Inject change password modal into page
function injectChangePasswordModal() {
  // Check if modal already exists
  if (document.getElementById('change-password-modal')) return;

  const modalHtml = `
    <div id="change-password-modal" class="modal" style="display:none;">
      <div class="modal-content">
        <h3>Cambia Password</h3>
        <form id="change-password-form" onsubmit="event.preventDefault(); submitPasswordChange();">
          <div class="form-group">
            <label>Password Attuale:</label>
            <input type="password" id="current-password" required>
          </div>
          <div class="form-group">
            <label>Nuova Password:</label>
            <input type="password" id="new-password" required minlength="4">
          </div>
          <div class="form-group">
            <label>Conferma Nuova Password:</label>
            <input type="password" id="confirm-password" required minlength="4">
          </div>
          <div id="password-error" class="error-message" style="display:none;"></div>
          <div class="modal-buttons">
            <button type="submit" class="btn-save">Salva</button>
            <button type="button" onclick="closePasswordModal()">Annulla</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Add modal styles if not already present
  if (!document.getElementById('modal-styles')) {
    const styles = `
      <style id="modal-styles">
        .modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: white;
          padding: 20px;
          border-radius: 8px;
          min-width: 300px;
          max-width: 90%;
        }
        .modal-content h3 {
          margin-top: 0;
        }
        .modal-content .form-group {
          margin-bottom: 15px;
        }
        .modal-content label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .modal-content input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          box-sizing: border-box;
        }
        .modal-buttons {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 20px;
        }
        .modal-buttons button {
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        .error-message {
          color: #d32f2f;
          padding: 10px;
          background: #ffebee;
          border-radius: 4px;
          margin-bottom: 10px;
        }
        .btn-change-password {
          background: none;
          border: 1px solid currentColor;
          color: inherit;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
          margin-right: 8px;
        }
        .btn-change-password:hover {
          background: rgba(255,255,255,0.1);
        }
      </style>
    `;
    document.head.insertAdjacentHTML('beforeend', styles);
  }
}

// Show change password modal
function showPasswordModal() {
  injectChangePasswordModal();
  document.getElementById('change-password-modal').style.display = 'flex';
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-password').value = '';
  document.getElementById('password-error').style.display = 'none';
  document.getElementById('current-password').focus();
}

// Close change password modal
function closePasswordModal() {
  document.getElementById('change-password-modal').style.display = 'none';
}

// Submit password change
async function submitPasswordChange() {
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const errorDiv = document.getElementById('password-error');

  // Validate
  if (newPassword !== confirmPassword) {
    errorDiv.textContent = 'Le nuove password non coincidono';
    errorDiv.style.display = 'block';
    return;
  }

  if (newPassword.length < 4) {
    errorDiv.textContent = 'La nuova password deve essere di almeno 4 caratteri';
    errorDiv.style.display = 'block';
    return;
  }

  try {
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const result = await response.json();

    if (result.success) {
      closePasswordModal();
      alert('Password modificata con successo!');
    } else {
      errorDiv.textContent = result.error || 'Errore durante la modifica';
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    console.error('Password change error:', error);
    errorDiv.textContent = 'Errore di connessione';
    errorDiv.style.display = 'block';
  }
}

// Check session and display user info
async function checkSession() {
  try {
    const response = await fetch('/api/auth/session');
    const data = await response.json();

    if (data.authenticated && data.user) {
      // Store user data globally
      currentUser = data.user;

      // Display user info in header
      const userDisplay = document.getElementById('user-display');
      if (userDisplay) {
        const adminBadge = data.user.isAdmin ? ' [Admin]' : '';
        userDisplay.textContent = `👤 ${data.user.displayName}${adminBadge}`;

        // Inject change password button if not already present
        if (!document.getElementById('btn-change-password')) {
          const btn = document.createElement('button');
          btn.id = 'btn-change-password';
          btn.type = 'button';
          btn.className = 'btn-change-password';
          btn.textContent = '🔑';
          btn.title = 'Cambia Password';
          btn.onclick = showPasswordModal;
          userDisplay.parentNode.insertBefore(btn, userDisplay.nextSibling);
        }
      }

      // Show logs nav item only for admins
      const navLogs = document.getElementById('nav-logs');
      if (navLogs) {
        navLogs.style.display = data.user.isAdmin ? '' : 'none';
      }

      return data.user;
    } else {
      // Not authenticated, redirect to login
      currentUser = null;
      window.location.href = '/login';
      return null;
    }
  } catch (error) {
    console.error('Session check error:', error);
    currentUser = null;
    window.location.href = '/login';
    return null;
  }
}

// Helper function to check admin status
function isAdmin() {
  return currentUser && currentUser.isAdmin === true;
}

// Handle logout
async function handleLogout() {
  if (!confirm('Sei sicuro di voler uscire?')) {
    return;
  }

  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      window.location.href = '/login';
    } else {
      alert('Errore durante il logout');
    }
  } catch (error) {
    console.error('Logout error:', error);
    alert('Errore durante il logout');
  }
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
  checkSession();
});
