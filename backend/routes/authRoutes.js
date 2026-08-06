'use strict';

const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { rateLimit, ipKey } = require('../middleware/rateLimit');

const router = express.Router();

// Brute-force guards on the unauthenticated auth surface.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, key: ipKey });
const mfaLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 5, key: ipKey });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, key: ipKey });
const refreshLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, key: ipKey });

router.get('/signup/studies', authController.signupStudies);
router.post('/register', registerLimiter, authController.register);
router.post('/onboarding/studies', authenticate, authController.onboardingStudies);
router.post('/login', loginLimiter, authController.login);
router.post('/verify-mfa', mfaLimiter, authController.verifyMfa);
router.post('/refresh', refreshLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.get('/providers', authController.providers);
router.get('/google', authController.oauthStart('google'));
router.get('/google/callback', authController.oauthCallback('google'));
router.get('/microsoft', authController.oauthStart('microsoft'));
router.get('/microsoft/callback', authController.oauthCallback('microsoft'));
router.get('/me', authenticate, authController.me);
router.post('/mfa/setup', authenticate, authController.mfaSetup);
router.post('/mfa/enable', authenticate, authController.mfaEnable);
router.post('/mfa/disable', authenticate, authController.mfaDisable);

module.exports = router;
