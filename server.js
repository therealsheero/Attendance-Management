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

app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', authRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/hr', hrRoutes);
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong.' });
});
initialize();

app.listen(PORT, () => {
  console.log(`\n🚀 Attendance Dashboard running at http://localhost:${PORT}\n`);
});
