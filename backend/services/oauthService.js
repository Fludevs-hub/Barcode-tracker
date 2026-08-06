'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

const PROVIDERS = {
  google: {
    label: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
  },
  microsoft: {
    label: 'Microsoft',
    authUrl: `https://login.microsoftonline.com/${config.oauth.microsoft.tenantId}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${config.oauth.microsoft.tenantId}/oauth2/v2.0/token`,
    userUrl: 'https://graph.microsoft.com/v1.0/me',
    scope: 'openid email profile User.Read',
  },
};

function providerConfig(name) {
  const cfg = config.oauth[name];
  if (!cfg?.clientId || !cfg?.clientSecret) return null;
  return { ...PROVIDERS[name], ...cfg };
}

function enabledProviders() {
  return {
    google: !!providerConfig('google'),
    microsoft: !!providerConfig('microsoft'),
  };
}

function signState(provider) {
  return jwt.sign(
    { provider, nonce: crypto.randomBytes(16).toString('hex'), type: 'oauth_state' },
    config.jwtSecret,
    { expiresIn: '10m' }
  );
}

function verifyState(state, expectedProvider) {
  const payload = jwt.verify(state, config.jwtSecret);
  if (payload.type !== 'oauth_state' || payload.provider !== expectedProvider) {
    throw new Error('Invalid OAuth state.');
  }
  return payload;
}

function buildAuthorizeUrl(provider) {
  const cfg = providerConfig(provider);
  if (!cfg) throw new Error(`${PROVIDERS[provider].label} sign-in is not configured.`);

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: cfg.scope,
    state: signState(provider),
    prompt: 'select_account',
  });

  if (provider === 'microsoft') params.set('response_mode', 'query');
  return `${cfg.authUrl}?${params.toString()}`;
}

async function exchangeCode(provider, code) {
  const cfg = providerConfig(provider);
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    redirect_uri: cfg.redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'OAuth token exchange failed.');
  return data.access_token;
}

async function fetchProfile(provider, accessToken) {
  const cfg = providerConfig(provider);
  const res = await fetch(cfg.userUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Could not load your profile from the provider.');

  if (provider === 'google') {
    return {
      sub: data.sub,
      email: data.email?.toLowerCase(),
      emailVerified: data.email_verified === true || data.email_verified === 'true',
      name: data.name || data.email?.split('@')[0] || 'User',
    };
  }

  // Microsoft Graph doesn't return a verification flag. A populated `mail` is a
  // provisioned mailbox (trustworthy); userPrincipalName alone is not, so we
  // treat that fallback as unverified.
  const email = (data.mail || data.userPrincipalName || '').toLowerCase();
  return {
    sub: data.id,
    email,
    emailVerified: !!data.mail,
    name: data.displayName || email.split('@')[0] || 'User',
  };
}

function redirectWithError(message) {
  return `${config.frontendUrl}/login?oauth_error=${encodeURIComponent(message)}`;
}

function redirectWithMfa(mfaToken, user) {
  const params = new URLSearchParams({
    mfa_token: mfaToken,
    username: user.username,
    name: user.name,
  });
  return `${config.frontendUrl}/login?${params.toString()}`;
}

function redirectWithSession(session) {
  // Refresh token is set as an httpOnly cookie server-side — only the short-lived
  // access token + user ride the fragment.
  const hash = new URLSearchParams({
    token: session.token,
    user: Buffer.from(JSON.stringify(session.user)).toString('base64url'),
  });
  return `${config.frontendUrl}/login/oauth#${hash.toString()}`;
}

module.exports = {
  enabledProviders,
  buildAuthorizeUrl,
  verifyState,
  exchangeCode,
  fetchProfile,
  redirectWithError,
  redirectWithMfa,
  redirectWithSession,
};
