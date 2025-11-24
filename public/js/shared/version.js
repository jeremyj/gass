/**
 * Load and display application version
 */
async function loadAppVersion() {
  try {
    const response = await fetch('/api/version');
    const data = await response.json();
    const versionElement = document.getElementById('app-version');
    if (versionElement && data.version) {
      versionElement.textContent = `v${data.version}`;
    }
  } catch (error) {
    console.error('Failed to load version:', error);
  }
}

// Load version when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadAppVersion);
} else {
  loadAppVersion();
}
