'use strict';

const express = require('express');
const batchController = require('../controllers/batchController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, batchController.list);
router.get('/:id', authenticate, batchController.getById);
router.post('/', authenticate, batchController.create);
router.put('/:id', authenticate, requireRole('super_admin', 'admin'), batchController.update);
router.delete('/:id', authenticate, requireRole('super_admin', 'admin'), batchController.remove);

module.exports = router;
