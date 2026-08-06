'use strict';

const {
  publicUser,
  signAccess,
  signMfaPending,
  verifyToken,
  verifyTotp,
  generateMfaSecret,
  mfaKeyUri,
  issueRefreshCookie,
  rotateRefresh,
  revokeRefreshCookie,
  clearRefreshCookie,
} = require('../middleware/auth');
const UserModel = require('../models/UserModel');

// Body carries only the short-lived access token + user. The refresh token
// lives in an httpOnly cookie set by issueRefreshCookie — never in JS reach.
function authResponse(user) {
  return {
    token: signAccess(user),
    user: publicUser(user),
  };
}

// Start a logged-in session: set the refresh cookie and return the JSON body.
function startSession(res, user) {
  issueRefreshCookie(res, user);
  return authResponse(user);
}

module.exports = {
  authResponse,
  startSession,
  publicUser,
  signMfaPending,
  verifyToken,
  verifyTotp,
  generateMfaSecret,
  mfaKeyUri,
  issueRefreshCookie,
  rotateRefresh,
  revokeRefreshCookie,
  clearRefreshCookie,
  UserModel,
};
