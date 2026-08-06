'use strict';

const express = require('express');
const userController = require('../controllers/userController');
const dashboardController = require('../controllers/dashboardController');
const { authenticate, requireRole } = require('../middleware/auth');

const userRouter = express.Router();
userRouter.get('/', authenticate, requireRole('super_admin', 'admin'), userController.list);
userRouter.post('/', authenticate, requireRole('super_admin', 'admin'), userController.create);
userRouter.put('/:id', authenticate, requireRole('super_admin'), userController.updateProfile);
userRouter.put('/:id/role', authenticate, requireRole('super_admin', 'admin'), userController.updateRole);
userRouter.put('/:id/studies', authenticate, requireRole('super_admin', 'admin'), userController.updateStudies);

const dashboardRouter = express.Router();
dashboardRouter.get('/', authenticate, dashboardController.get);

module.exports = { userRouter, dashboardRouter };
