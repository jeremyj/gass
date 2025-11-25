/**
 * Authentication utilities
 * Shared across all pages for session management and logout
 */

// Global user state
let currentUser = null;

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
      }

      // Show admin hint badge only for admins
      const adminHintBadge = document.getElementById('admin-hint-badge');
      if (adminHintBadge && data.user.isAdmin) {
        adminHintBadge.style.display = 'block';
      }

      // Show logs nav item only for admins
      const navLogs = document.getElementById('nav-logs');
      if (navLogs) {
        navLogs.style.display = data.user.isAdmin ? '' : 'none';
      }

      // Hide admin-only elements for non-admins
      if (!data.user.isAdmin) {
        // Desktop saldi: hide add button and actions column
        const btnAddParticipant = document.getElementById('btn-add-participant');
        if (btnAddParticipant) btnAddParticipant.style.display = 'none';

        const thAzioni = document.getElementById('th-azioni');
        if (thAzioni) thAzioni.style.display = 'none';
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
