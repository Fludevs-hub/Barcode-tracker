'use strict';

const crypto = require('crypto');
const authService = require('../services/authService');
const oauthService = require('../services/oauthService');
const StudyModel = require('../models/StudyModel');
const config = require('../config');

const MAX_SIGNUP_STUDIES = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.signupStudies = (req, res) => {
  const studies = StudyModel.listNamesForSignup();
  res.json({ studies, max_selection: MAX_SIGNUP_STUDIES });
};

/** Validate a study selection (1..MAX). Returns { ids } or { error }. */
function validateStudySelection(study_ids) {
  if (!Array.isArray(study_ids) || study_ids.length === 0) {
    return { error: 'Select at least one study.' };
  }
  if (study_ids.length > MAX_SIGNUP_STUDIES) {
    return { error: `You can select up to ${MAX_SIGNUP_STUDIES} studies.` };
  }
  const uniqueIds = [...new Set(study_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (uniqueIds.length !== study_ids.length) {
    return { error: 'Study selection is invalid.' };
  }
  const knownStudies = StudyModel.findByIds(uniqueIds);
  if (knownStudies.length !== uniqueIds.length) {
    return { error: 'One or more selected studies are invalid.' };
  }
  return { ids: uniqueIds };
}

/** First-time social sign-in: the signed-in user picks their own studies. */
exports.onboardingStudies = (req, res) => {
  const user = authService.UserModel.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.role !== 'user') {
    // Non-user roles see all studies; nothing to assign.
    return res.json(authService.startSession(res, user));
  }

  const { study_ids = [] } = req.body || {};
  const result = validateStudySelection(study_ids);
  if (result.error) return res.status(400).json({ error: result.error });

  authService.UserModel.setStudyLinks(user.id, result.ids);
  res.json(authService.startSession(res, authService.UserModel.findById(user.id)));
};

exports.register = (req, res) => {
  const { name, email, password, confirm_password, study_ids = [] } = req.body || {};
  const displayName = String(name || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!displayName) return res.status(400).json({ error: 'Enter your name.' });
  if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!password) return res.status(400).json({ error: 'Enter a password.' });
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (password !== confirm_password) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }
  const selection = validateStudySelection(study_ids);
  if (selection.error) return res.status(400).json({ error: selection.error });
  const uniqueIds = selection.ids;

  // Non-enumerable registration: respond identically whether or not the email
  // already exists, and don't auto-log-in (which would reveal success). Always
  // run a hash so response timing doesn't leak existence either.
  const NEUTRAL = { ok: true, message: 'If that email is available, your account is ready. Sign in to continue.' };
  try {
    if (authService.UserModel.findByEmail(normalizedEmail)) {
      authService.UserModel.hashPassword(password); // equalize timing, then stop
      return res.status(202).json(NEUTRAL);
    }
    const username = authService.UserModel.uniqueUsername(normalizedEmail.split('@')[0]);
    const info = authService.UserModel.create({
      username,
      passwordHash: authService.UserModel.hashPassword(password),
      displayName,
      role: 'user',
      email: normalizedEmail,
    });
    authService.UserModel.setStudyLinks(info.lastInsertRowid, uniqueIds);
    res.status(202).json(NEUTRAL);
  } catch {
    // Even on a race/uniqueness error, stay neutral.
    res.status(202).json(NEUTRAL);
  }
};

exports.providers = (req, res) => {
  res.json(oauthService.enabledProviders());
};

exports.oauthStart = (provider) => (req, res) => {
  try {
    res.redirect(oauthService.buildAuthorizeUrl(provider));
  } catch (e) {
    res.redirect(oauthService.redirectWithError(e.message));
  }
};

exports.oauthCallback = (provider) => async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;
  if (error) {
    return res.redirect(oauthService.redirectWithError(errorDescription || error));
  }
  if (!code || !state) {
    return res.redirect(oauthService.redirectWithError('OAuth sign-in was cancelled or incomplete.'));
  }

  try {
    oauthService.verifyState(state, provider);
    const accessToken = await oauthService.exchangeCode(provider, code);
    const profile = await oauthService.fetchProfile(provider, accessToken);

    if (!profile.email) {
      return res.redirect(oauthService.redirectWithError('Your account did not return an email address.'));
    }

    let user = authService.UserModel.findByOAuth(provider, profile.sub);

    // Linking to a pre-existing account by email is only safe when the provider
    // vouches the email is verified — otherwise it's an account-takeover vector.
    if (!user) {
      const byEmail = authService.UserModel.findByEmail(profile.email);
      if (byEmail) {
        if (!profile.emailVerified) {
          return res.redirect(oauthService.redirectWithError(
            'We could not verify your email with the provider. Sign in with your password to link this account.'
          ));
        }
        user = byEmail;
      }
    }

    if (!user) {
      // First-time social sign-in: create a 'user' account with no studies yet.
      // The frontend will route them through study selection before the dashboard.
      const username = authService.UserModel.uniqueUsername(profile.email.split('@')[0] || 'user');
      const info = authService.UserModel.create({
        username,
        passwordHash: authService.UserModel.hashPassword(crypto.randomBytes(24).toString('hex')),
        displayName: profile.name || username,
        role: 'user',
        email: profile.email,
      });
      user = authService.UserModel.findById(info.lastInsertRowid);
    }

    authService.UserModel.linkOAuth(user.id, {
      provider,
      sub: profile.sub,
      email: profile.email,
    });
    user = authService.UserModel.findById(user.id);

    if (user.mfa_enabled) {
      return res.redirect(oauthService.redirectWithMfa(
        authService.signMfaPending(user),
        { username: user.username, name: user.display_name }
      ));
    }

    authService.issueRefreshCookie(res, user);
    return res.redirect(oauthService.redirectWithSession(authService.authResponse(user)));
  } catch (e) {
    console.error(`[oauth:${provider}] callback failed:`, e);
    return res.redirect(oauthService.redirectWithError(e.message || 'OAuth sign-in failed.'));
  }
};

exports.login = (req, res) => {
  const { username, password } = req.body || {};
  const loginId = String(username || '').trim();
  if (!loginId || !password) return res.status(400).json({ error: 'Enter a username and password.' });

  let user = authService.UserModel.findByUsername(loginId);
  if (!user && loginId.includes('@')) {
    user = authService.UserModel.findByEmail(loginId.toLowerCase());
  }
  if (!user || !authService.UserModel.verifyPassword(user, password)) {
    return res.status(401).json({ error: 'Username or password is incorrect.' });
  }

  if (user.mfa_enabled) {
    return res.json({
      step: 'mfa',
      mfa_token: authService.signMfaPending(user),
      user: { username: user.username, name: user.display_name },
    });
  }

  res.json(authService.startSession(res, user));
};

exports.verifyMfa = (req, res) => {
  const { mfa_token, code } = req.body || {};
  if (!mfa_token || !code) return res.status(400).json({ error: 'Enter your verification code.' });

  let payload;
  try {
    payload = authService.verifyToken(mfa_token, 'mfa_pending');
  } catch {
    return res.status(401).json({ error: 'Verification session expired. Sign in again.' });
  }

  const user = authService.UserModel.findById(payload.id);
  if (!user || !user.mfa_enabled || !user.mfa_secret) {
    return res.status(401).json({ error: 'Two-factor authentication is not enabled for this account.' });
  }
  if (!authService.verifyTotp(user.mfa_secret, code)) {
    return res.status(401).json({ error: 'Verification code is incorrect.' });
  }

  res.json(authService.startSession(res, user));
};

exports.refresh = (req, res) => {
  // Refresh token comes from the httpOnly cookie; rotate it (revoke old, set new).
  let user;
  try {
    user = authService.rotateRefresh(req, res);
  } catch {
    authService.clearRefreshCookie(res);
    return res.status(401).json({ error: 'Refresh token expired. Sign in again.' });
  }
  res.json(authService.authResponse(user));
};

exports.logout = (req, res) => {
  authService.revokeRefreshCookie(req, res);
  res.json({ ok: true });
};

exports.me = (req, res) => {
  const user = authService.UserModel.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: authService.publicUser(user) });
};

exports.mfaSetup = (req, res) => {
  const user = authService.UserModel.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const secret = authService.generateMfaSecret();
  authService.UserModel.setMfaSecret(user.id, secret);
  res.json({
    secret,
    otpauth_url: authService.mfaKeyUri(user.username, secret),
    issuer: config.mfaIssuer,
  });
};

exports.mfaEnable = (req, res) => {
  const { code } = req.body || {};
  const user = authService.UserModel.findById(req.user.id);
  if (!user?.mfa_secret) return res.status(400).json({ error: 'Start MFA setup first.' });
  if (!authService.verifyTotp(user.mfa_secret, code)) {
    return res.status(400).json({ error: 'Verification code is incorrect.' });
  }
  authService.UserModel.enableMfa(user.id);
  res.json({ ok: true, mfa_enabled: true });
};

exports.mfaDisable = (req, res) => {
  const { password, code } = req.body || {};
  const user = authService.UserModel.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (!password || !authService.UserModel.verifyPassword(user, password)) {
    return res.status(401).json({ error: 'Password is incorrect.' });
  }
  if (user.mfa_enabled && !authService.verifyTotp(user.mfa_secret, code)) {
    return res.status(401).json({ error: 'Verification code is incorrect.' });
  }
  authService.UserModel.disableMfa(user.id);
  res.json({ ok: true, mfa_enabled: false });
};
