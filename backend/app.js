'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const cors = require('./middleware/cors');
const securityHeaders = require('./middleware/securityHeaders');
const { signResponsePhotos, verifyUpload } = require('./middleware/signedUploads');
const apiRoutes = require('./routes');
const healthRoutes = require('./routes/healthRoutes');

require('./models/database');

const app = express();
app.use(securityHeaders);
app.use(cors);
app.use(signResponsePhotos);
app.use(express.json({ limit: '12mb' }));

fs.mkdirSync(config.uploadDir, { recursive: true });
app.use('/uploads', verifyUpload, express.static(config.uploadDir));

app.use('/api', healthRoutes);
app.use('/api', apiRoutes);

if (fs.existsSync(config.frontendDist)) {
  app.use(express.static(config.frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(config.frontendDist, 'index.html'));
  });
}

module.exports = app;
