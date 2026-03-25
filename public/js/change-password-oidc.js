document.getElementById('change-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const errorEl = document.getElementById('error-message');
  const btn = document.getElementById('submit-btn');

  errorEl.textContent = '';

  if (newPassword !== confirmPassword) {
    errorEl.textContent = 'Le password non coincidono.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Salvataggio...';

  try {
    const res = await fetch('/auth/oidc/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword, confirmPassword }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      window.location.href = '/consegna';
    } else {
      errorEl.textContent = data.error || 'Errore durante la modifica della password.';
      btn.disabled = false;
      btn.textContent = 'Salva password';
    }
  } catch {
    errorEl.textContent = 'Errore di rete. Riprova.';
    btn.disabled = false;
    btn.textContent = 'Salva password';
  }
});
