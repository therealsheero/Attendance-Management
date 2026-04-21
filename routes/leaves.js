const express = require('express');
const { db } = require('../database/init');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/**
 * POST /api/leaves to apply for a new leave
 */
router.post('/', (req, res) => {
  try {
    const { leave_type, from_date, to_date, reason } = req.body;
    const { employee_id, name } = req.user;
    if (!leave_type || !from_date || !to_date || !reason) {
      return res.status(400).json({ error: 'All fields are required: leave_type, from_date, to_date, reason' });
    }

    const validTypes = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Compensatory Off', 'Special Leave'];
    if (!validTypes.includes(leave_type)) {
      return res.status(400).json({ error: `Invalid leave type. Must be one of: ${validTypes.join(', ')}` });
    }

    if (new Date(from_date) > new Date(to_date)) {
      return res.status(400).json({ error: '"From date" cannot be after "To date".' });
    }

    const result = db.prepare(`
      INSERT INTO leaves (employee_id, employee_name, leave_type, from_date, to_date, reason, status, applied_on)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
    `).run(employee_id, name, leave_type, from_date, to_date, reason.trim());

    res.status(201).json({
      message: 'Leave application submitted successfully!',
      leave_id: result.lastInsertRowid,
    });
  } catch (err) {
    console.error('Apply leave error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /api/leaves/my to get all leaves for the logged-in employee
 */
router.get('/my', (req, res) => {
  try {
    const { employee_id } = req.user;

    const leaves = db.prepare(`
      SELECT * FROM leaves WHERE employee_id = ? ORDER BY applied_on DESC
    `).all(employee_id);

    res.json({ leaves });
  } catch (err) {
    console.error('Fetch leaves error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PATCH /api/leaves/:id/cancel to cancel/withdraw a pending leave from employees side
 */
router.patch('/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const { employee_id } = req.user;
    const leave = db.prepare('SELECT * FROM leaves WHERE id = ? AND employee_id = ?').get(id, employee_id);

    if (!leave) {
      return res.status(404).json({ error: 'Leave application not found.' });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({ error: `Cannot cancel a leave that is already ${leave.status}.` });
    }

    db.prepare(`
      UPDATE leaves SET status = 'cancelled', action_on = datetime('now') WHERE id = ?
    `).run(id);

    res.json({ message: 'Leave application cancelled successfully.' });
  } catch (err) {
    console.error('Cancel leave error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
