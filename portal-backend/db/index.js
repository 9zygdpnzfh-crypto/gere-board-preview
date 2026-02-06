const { Pool } = require('pg');

const pool = new Pool({
  user: 'shareerobinson',
  host: 'localhost',
  database: 'portal_db',
  password: '',
  port: 5432,
});

module.exports = pool;

