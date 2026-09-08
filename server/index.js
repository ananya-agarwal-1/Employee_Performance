const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 1. Load environment variables from .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    // Continue with environment or defaults
  }
}

const db = require('./db');
const authRoutes = require('./routes/authRoutes');
const managerRoutes = require('./routes/managerRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const seniorRoutes = require('./routes/seniorRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// 2. Configure middleware
app.use(cors());
app.use(express.json());

// 3. Root health check
app.get('/', (req, res) => {
  res.send('Work Management System API is running.');
});

// 4. Detailed Database Health Check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Verify MySQL database connection with a lightweight query
    const [result] = await db.query('SELECT 1 + 1 AS db_check');
    return res.status(200).json({
      status: 'ok',
      server: 'running',
      database: 'connected',
      check: result[0].db_check,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Health check database error:', err);
    return res.status(500).json({
      status: 'error',
      server: 'running',
      database: 'disconnected',
      error: err.message
    });
  }
});

// 5. Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/senior', seniorRoutes);

// 6. Handle undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.url} - Endpoint not found.`
  });
});

// 7. Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error.',
    error: err.message
  });
});

// 8. Start Server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
