/**
 * OIDC Authentication Routes (Authentik)
 *
 * Activated only when OIDC_ISSUER is set in environment.
 * Handles login redirect, callback, logout, and first-login password change.
 *
 * Session fields set on successful login:
 *   req.session.userId, username, displayName, isAdmin, authMethod='oidc'
 *   req.session.idToken           — raw ID token (for end-session logout)
 *   req.session.requirePasswordChange — true if user must change password
 */

const express = require('express');
const { Issuer, generators } = require('openid-client');
const db = require('../config/database');

const router = express.Router();

const {
  OIDC_ISSUER,
  OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET,
  OIDC_REDIRECT_URI,
  OIDC_ADMIN_GROUP = 'gass-admin',
  AUTHENTIK_API_TOKEN,
} = process.env;

// Derive Authentik API base URL from issuer (e.g. https://auth.x86.it)
const AUTHENTIK_API_URL = process.env.AUTHENTIK_API_URL || (OIDC_ISSUER && new URL(OIDC_ISSUER).origin);

// Shared OIDC client instance (initialized lazily on first request)
let oidcClient = null;

async function getOidcClient() {
  if (oidcClient) return oidcClient;
  const issuer = await Issuer.discover(OIDC_ISSUER);
  oidcClient = new issuer.Client({
    client_id: OIDC_CLIENT_ID,
    client_secret: OIDC_CLIENT_SECRET,
    redirect_uris: [OIDC_REDIRECT_URI],
    response_types: ['code'],
  });
  return oidcClient;
}

/**
 * GET /auth/oidc/login
 * Redirect user to Authentik authorization endpoint.
 */
router.get('/login', async (req, res) => {
  try {
    const client = await getOidcClient();
    const state = generators.state();
    const nonce = generators.nonce();

    req.session.oidcState = state;
    req.session.oidcNonce = nonce;

    const url = client.authorizationUrl({
      scope: 'openid profile email groups gass',
      state,
      nonce,
    });

    res.redirect(url);
  } catch (err) {
    console.error('[OIDC] Login redirect error:', err.message);
    res.redirect('/login?error=oidc_unavailable');
  }
});

/**
 * GET /auth/oidc/callback
 * Handle authorization code callback from Authentik.
 */
router.get('/callback', async (req, res) => {
  const timestamp = new Date().toISOString();

  try {
    const client = await getOidcClient();
    const { oidcState, oidcNonce } = req.session;

    const params = client.callbackParams(req);
    const tokenSet = await client.callback(OIDC_REDIRECT_URI, params, {
      state: oidcState,
      nonce: oidcNonce,
    });

    const claims = tokenSet.claims();
    const username = claims.preferred_username || claims.sub;
    const groups = claims.groups || [];
    const requirePasswordChange = claims.requirePasswordChange === true;

    console.log(`[OIDC] ${timestamp} - Callback: username=${username}, groups=${groups}, requirePasswordChange=${requirePasswordChange}`);

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      console.log(`[OIDC] ${timestamp} - Login rejected: username '${username}' not found in GASS`);
      return res.redirect('/login?error=user_not_found');
    }

    const isAdmin = Array.isArray(groups) && groups.includes(OIDC_ADMIN_GROUP);

    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.displayName = user.display_name;
    req.session.isAdmin = isAdmin;
    req.session.authMethod = 'oidc';
    req.session.idToken = tokenSet.id_token;
    req.session.requirePasswordChange = requirePasswordChange;

    console.log(`[OIDC] ${timestamp} - Login successful: ${username} (Admin: ${isAdmin})`);

    if (requirePasswordChange) {
      return res.redirect('/cambia-password');
    }
    res.redirect('/consegna');
  } catch (err) {
    console.error('[OIDC] Callback error:', err.message);
    res.redirect('/login?error=oidc_error');
  }
});

/**
 * POST /auth/oidc/change-password
 * Change password on first login via Authentik Admin API.
 */
router.post('/change-password', async (req, res) => {
  if (!req.session?.userId || req.session.authMethod !== 'oidc') {
    return res.status(401).json({ error: 'Non autenticato' });
  }
  if (!req.session.requirePasswordChange) {
    return res.status(403).json({ error: 'Password change not required' });
  }

  const { newPassword, confirmPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'La password deve essere di almeno 8 caratteri' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Le password non coincidono' });
  }

  const username = req.session.username;
  const timestamp = new Date().toISOString();

  try {
    const headers = {
      'Authorization': `Bearer ${AUTHENTIK_API_TOKEN}`,
      'Content-Type': 'application/json',
    };

    // 1. Look up Authentik user by username
    const searchRes = await fetch(`${AUTHENTIK_API_URL}/api/v3/core/users/?username=${encodeURIComponent(username)}`, { headers });
    const searchData = await searchRes.json();
    const authentikUser = searchData.results?.[0];
    if (!authentikUser) {
      return res.status(404).json({ error: 'Utente non trovato in Authentik' });
    }
    const pk = authentikUser.pk;

    // 2. Set new password
    const pwRes = await fetch(`${AUTHENTIK_API_URL}/api/v3/core/users/${pk}/set_password/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ password: newPassword }),
    });
    if (!pwRes.ok) {
      throw new Error(`set_password failed: ${pwRes.status}`);
    }

    // 3. Clear requirePasswordChange flag (merge with existing attributes)
    const currentAttrs = authentikUser.attributes || {};
    const newAttrs = {
      ...currentAttrs,
      settings: { ...(currentAttrs.settings || {}), requirePasswordChange: false },
    };
    const patchRes = await fetch(`${AUTHENTIK_API_URL}/api/v3/core/users/${pk}/`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ attributes: newAttrs }),
    });
    if (!patchRes.ok) {
      throw new Error(`patch attributes failed: ${patchRes.status}`);
    }

    req.session.requirePasswordChange = false;
    console.log(`[OIDC] ${timestamp} - Password changed via API for user: ${username}`);

    res.json({ success: true });
  } catch (err) {
    console.error('[OIDC] change-password error:', err.message);
    res.status(500).json({ error: 'Errore durante la modifica della password' });
  }
});

/**
 * GET /auth/oidc/logout
 * Destroy local session and redirect to Authentik end-session endpoint.
 * Passes id_token_hint so Authentik auto-redirects back to GASS.
 */
router.get('/logout', async (req, res) => {
  const username = req.session?.username || 'unknown';
  const idToken = req.session?.idToken;
  const timestamp = new Date().toISOString();

  console.log(`[OIDC] ${timestamp} - Logout request from user: ${username}`);

  req.session.destroy(async (err) => {
    if (err) console.error('[OIDC] Session destroy error:', err.message);

    try {
      const client = await getOidcClient();
      const endSessionUrl = client.issuer.metadata.end_session_endpoint;
      if (endSessionUrl) {
        const logoutUrl = new URL(endSessionUrl);
        if (idToken) logoutUrl.searchParams.set('id_token_hint', idToken);
        logoutUrl.searchParams.set('post_logout_redirect_uri', OIDC_REDIRECT_URI.replace('/auth/oidc/callback', '/login'));
        return res.redirect(logoutUrl.toString());
      }
    } catch {
      // fall through
    }
    res.redirect('/login');
  });
});

module.exports = router;
