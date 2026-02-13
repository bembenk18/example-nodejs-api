require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  max: 50,
  idleTimeoutMillis: 100,
  connectionTimeoutMillis: 100
});

app.use((req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const durationInMilliseconds = seconds * 1000 + nanoseconds / 1e6;

    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      clientIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      host: req.headers.host,
      status: res.statusCode,
      durationMs: parseFloat(durationInMilliseconds.toFixed(3)),
      userAgent: req.get('user-agent') // Optional: useful for debugging
    };

    console.log(JSON.stringify(logEntry));
  });

  next();
});

// Root path - checks database connection
app.get('/', async (req, res) => {
  try {

    await pool.query('SELECT NOW()');
    res.status(200).json({ message: 'Database connection successful', status: 'OK' });
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ message: 'Database connection failed', status: 'Error', error: err.message });
  }
});

// API endpoint /api/cities
app.get('/api/cities', async (req, res) => {
  try {
    const client = await pool.connect(); // never released
    const result = await client.query("SELECT * FROM cities");
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching data from /api/cities:', err);
    res.status(500).json({ message: 'Error fetching cities data', error: err.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing PostgreSQL pool and exiting...');
  await pool.end();
  process.exit(0);
});
