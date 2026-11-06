// Builds the Express app and connects every route file to its URL.
// All routes are already connected, so you normally do NOT need to edit this file -
// just fill in your own route / controller / model files.

const path = require('path');
const express = require('express');

const app = express();
app.use(express.json());

// ---------- API (everything under /api) ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', require('./routes/authRoutes'));

// Admin features (admin login required)
app.use('/api/centres', require('./routes/centreRoutes'));
app.use('/api/classes', require('./routes/classRoutes'));          // also /venues and /instructors
app.use('/api/members', require('./routes/memberRoutes'));         // members = students, as seen by the admin
app.use('/api/belts', require('./routes/beltRoutes'));
app.use('/api/gradings', require('./routes/gradingRoutes'));
app.use('/api/fees', require('./routes/feeRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

// Student portal (student login required)
app.use('/api/student', require('./routes/studentPortalRoutes'));

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));

// ---------- Pages (HTML/CSS/JS from the /frontend folder) ----------
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Any error thrown inside a controller ends up here
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

module.exports = app;
