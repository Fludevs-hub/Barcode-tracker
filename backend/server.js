'use strict';

const app = require('./app');
const config = require('./config');

app.listen(config.port, () => {
  console.log(`Barcode tracker API running at http://localhost:${config.port}`);
});
