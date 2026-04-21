require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { initialize } = require('./database/init');
const authRoutes = require('./routes/auth');
const leaveRoutes = require('./routes/leaves');
const hrRoutes = require('./routes/hr');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled for inline scripts in static files
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static Files ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/hr', hrRoutes);

// ─── Fallback: serve index.html for unknown routes ─────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Global Error Handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong.' });
});

// ─── Initialize DB & Start Server ──────────────────────────
initialize();

app.listen(PORT, () => {
  console.log(`\n🚀 Attendance Dashboard running at http://localhost:${PORT}\n`);
  console.log('   HR Credentials:');
  console.log('   ─────────────────────────────');
  console.log('   HR001 → password: admin@hr1');
  console.log('   HR002 → password: admin@hr2');
  console.log('   HR003 → password: admin@hr3');
  console.log('   ─────────────────────────────\n');
});
