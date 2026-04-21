const express = require('express');
const { db } = require('../database/init');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('hr'));

/**
 * GET /api/hr/leaves to get all leave applications with optional status filter
 * Query params: ?status=pending|approved|rejected|cancelled
 */
router.get('/leaves', (req, res) => {
  try {
    const { status } = req.query;

    let leaves;
    if (status) {
      leaves = db.prepare(`
        SELECT * FROM leaves WHERE status = ? ORDER BY applied_on DESC
      `).all(status);
    } else {
      leaves = db.prepare(`
        SELECT * FROM leaves ORDER BY applied_on DESC
      `).all();
    }

    res.json({ leaves });
  } catch (err) {
    console.error('HR fetch leaves error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /api/hr/leaves/date/:date to get all leaves that overlap with a specific date (approved and pending)
 */
router.get('/leaves/date/:date', (req, res) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format.' });
    }

    const leaves = db.prepare(`
      SELECT * FROM leaves
      WHERE from_date <= ? AND to_date >= ?
        AND status IN ('approved', 'pending')
      ORDER BY employee_name ASC
    `).all(date, date);

    res.json({ date, leaves, count: leaves.length });
  } catch (err) {
    console.error('HR date filter error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PATCH /api/hr/leaves/:id to approve or reject a leave application -> Body: { action: "approved" | "rejected" }
 */
router.patch('/leaves/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const { employee_id: hrId, name: hrName } = req.user;

    if (!action || !['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "approved" or "rejected".' });
    }
    const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(id);
    if (!leave) {
      return res.status(404).json({ error: 'Leave application not found.' });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({ error: `Cannot modify a leave that is already ${leave.status}.` });
    }

    db.prepare(`
      UPDATE leaves
      SET status = ?, action_by = ?, action_by_name = ?, action_on = datetime('now')
      WHERE id = ?
    `).run(action, hrId, hrName, id);

    res.json({ message: `Leave ${action} successfully.` });
  } catch (err) {
    console.error('HR action error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /api/hr/stats to get leave statistics: count of people on leave per date (next 30 days)
 */
router.get('/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      WITH RECURSIVE dates(date) AS (
        SELECT date('now')
        UNION ALL
        SELECT date(date, '+1 day')
        FROM dates
        WHERE date < date('now', '+30 days')
      )
      SELECT
        d.date,
        COUNT(l.id) as leave_count
      FROM dates d
      LEFT JOIN leaves l ON d.date >= l.from_date AND d.date <= l.to_date
        AND l.status = 'approved'
      GROUP BY d.date
      ORDER BY d.date
    `).all();

    const today = new Date().toISOString().split('T')[0];
    const todayOnLeave = db.prepare(`
      SELECT COUNT(*) as count FROM leaves
      WHERE from_date <= ? AND to_date >= ? AND status = 'approved'
    `).get(today, today);

    const pendingCount = db.prepare(`
      SELECT COUNT(*) as count FROM leaves WHERE status = 'pending'
    `).get();

    res.json({
      stats,
      today: {
        date: today,
        on_leave: todayOnLeave.count,
        pending: pendingCount.count,
      },
    });
  } catch (err) {
    console.error('HR stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
