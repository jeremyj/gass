/**
 * Authentication utilities
 * Shared across all pages for session management and logout
 */

// Check session and display user info
async function checkSession() {
  try {
    const response = await fetch('/api/auth/session');
    const data = await response.json();

    if (data.authenticated && data.user) {
      // Display user info in header
      const userDisplay = document.getElementById('user-display');
      if (userDisplay) {
        userDisplay.textContent = `👤 ${data.user.displayName}`;
      }
      return data.user;
    } else {
      // Not authenticated, redirect to login
      window.location.href = '/login';
      return null;
    }
  } catch (error) {
    console.error('Session check error:', error);
    window.location.href = '/login';
    return null;
  }
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
