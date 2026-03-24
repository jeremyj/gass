/**
 * OIDC Authentication Routes (Authentik)
 *
 * Activated only when OIDC_ISSUER is set in environment.
 * Handles login redirect, callback, and logout for OpenID Connect.
 *
 * Session fields set on successful login:
 *   req.session.userId, username, displayName, isAdmin, authMethod='oidc'
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
} = process.env;

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
      scope: 'openid profile email',
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

    // Read claims from id_token (includes groups from Authentik)
    const claims = tokenSet.claims();
    const username = claims.preferred_username || claims.sub;
    const groups = claims.groups || [];

    console.log(`[OIDC] ${timestamp} - Callback for username: ${username}, groups: ${groups}`);

    // Look up existing GASS user by username
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      console.log(`[OIDC] ${timestamp} - Login rejected: username '${username}' not found in GASS`);
      return res.redirect('/login?error=user_not_found');
    }

    // Determine admin status from Authentik group
    const isAdmin = Array.isArray(groups) && groups.includes(OIDC_ADMIN_GROUP);

    // Regenerate session to prevent session fixation
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

    console.log(`[OIDC] ${timestamp} - Login successful: ${username} (ID: ${user.id}, Admin: ${isAdmin})`);

    res.redirect('/consegna');
  } catch (err) {
    console.error('[OIDC] Callback error:', err.message);
    res.redirect('/login?error=oidc_error');
  }
});

/**
 * GET /auth/oidc/logout
 * Destroy local session and redirect to Authentik end-session endpoint.
 */
router.get('/logout', async (req, res) => {
  const username = req.session?.username || 'unknown';
  const timestamp = new Date().toISOString();

  console.log(`[OIDC] ${timestamp} - Logout request from user: ${username}`);

  req.session.destroy(async (err) => {
    if (err) console.error('[OIDC] Session destroy error:', err.message);

    try {
      const client = await getOidcClient();
      const endSessionUrl = client.issuer.metadata.end_session_endpoint;
      if (endSessionUrl) {
        const logoutUrl = new URL(endSessionUrl);
        logoutUrl.searchParams.set('post_logout_redirect_uri', OIDC_REDIRECT_URI.replace('/auth/oidc/callback', '/login'));
        res.redirect(logoutUrl.toString());
      } else {
        res.redirect('/login');
      }
    } catch {
      res.redirect('/login');
    }
  });
});

module.exports = router;
