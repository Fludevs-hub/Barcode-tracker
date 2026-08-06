'use strict';

const express = require('express');
const authRoutes = require('./authRoutes');
const studyRoutes = require('./studyRoutes');
const batchRoutes = require('./batchRoutes');
const batchController = require('../controllers/batchController');
const { userRouter, dashboardRouter } = require('./userRoutes');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use('/auth', authRoutes);
router.get('/me', authenticate, authController.me);
router.use('/studies', studyRoutes);
router.get('/continuity', authenticate, batchController.continuity);
router.use('/batches', batchRoutes);
router.use('/dashboard', dashboardRouter);
router.use('/users', userRouter);

module.exports = router;
