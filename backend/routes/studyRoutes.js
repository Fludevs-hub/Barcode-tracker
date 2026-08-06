'use strict';

const express = require('express');
const studyController = require('../controllers/studyController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, studyController.list);
router.post('/', authenticate, requireRole('super_admin', 'admin'), studyController.create);
router.put('/:id', authenticate, requireRole('super_admin', 'admin'), studyController.update);

module.exports = router;
