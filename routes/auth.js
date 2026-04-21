const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/init');

const router = express.Router();

/**
 * POST /api/auth/register for employee self-registration
 */
router.post('/register', (req, res) => {
  try {
    const { employee_id, name, password } = req.body;

    // Validation
    if (!employee_id || !name || !password) {
      return res.status(400).json({ error: 'All fields are required: employee_id, name, password' });
    }

    if (employee_id.trim().length < 2) {
      return res.status(400).json({ error: 'Employee ID must be at least 2 characters.' });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }
    const existing = db.prepare('SELECT id FROM employees WHERE employee_id = ?').get(employee_id.trim());
    if (existing) {
      return res.status(409).json({ error: 'Employee ID already registered.' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare(
      'INSERT INTO employees (employee_id, name, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(employee_id.trim(), name.trim(), passwordHash, 'employee');

    res.status(201).json({ message: 'Registration successful! You can now login.' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/login for login for both employees and HR(admin)
 */
router.post('/login', (req, res) => {
  try {
    const { employee_id, password } = req.body;

    if (!employee_id || !password) {
      return res.status(400).json({ error: 'Employee ID and password are required.' });
    }
    const user = db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(employee_id.trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid Employee ID or password.' });
    }
    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid Employee ID or password.' });
    }
    const token = jwt.sign(
      {
        id: user.id,
        employee_id: user.employee_id,
        name: user.name,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: {
        employee_id: user.employee_id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
