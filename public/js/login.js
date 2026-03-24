/**
 * Login Page
 * Handles user authentication (local and OIDC)
 */

const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const errorMessage = document.getElementById('error-message');

// Show OIDC button if enabled, hide local form behind a link
fetch('/api/auth/config')
  .then(r => r.json())
  .then(({ oidcEnabled }) => {
    if (!oidcEnabled) return;
    document.getElementById('oidc-section').style.display = 'block';
    loginForm.style.display = 'none';
    document.getElementById('show-local-login').addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.style.display = 'block';
      document.getElementById('show-local-login').style.display = 'none';
    });
  })
  .catch(() => {}); // silently ignore — OIDC section stays hidden

// Show errors from OIDC callback redirects (?error=...)
const urlError = new URLSearchParams(window.location.search).get('error');
if (urlError) {
  const messages = {
    user_not_found: 'Il tuo utente Authentik non è registrato in GASS. Contatta un amministratore.',
    oidc_error: 'Errore durante l\'autenticazione con Authentik. Riprova.',
    oidc_unavailable: 'Servizio di autenticazione non disponibile. Riprova più tardi.'
  };
  showError(messages[urlError] || 'Errore di accesso. Riprova.');
}

// Handle form submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showError('Inserisci username e password');
    return;
  }

  try {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Accesso in corso...';
    hideError();

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Successful login, redirect to consegna
      window.location.href = '/consegna';
    } else {
      // Login failed
      showError(data.message || 'Username o password non corretti');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Accedi';
    }

  } catch (error) {
    console.error('Login error:', error);
    showError('Errore durante l\'accesso. Riprova.');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Accedi';
  }
});

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
}

function hideError() {
  errorMessage.style.display = 'none';
}

// Allow Enter key to submit
document.getElementById('password').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loginForm.dispatchEvent(new Event('submit'));
  }
});
