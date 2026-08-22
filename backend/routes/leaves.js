const express = require('express');
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function daysBetween(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
}

function notify(userId, message) {
    db.prepare(`INSERT INTO notifications (user_id, message) VALUES (?, ?)`).run(userId, message);
}

// GET /api/leaves/balances - own leave balances
router.get('/balances', (req, res) => {
    const rows = db
        .prepare(`SELECT leave_type, balance FROM leave_balances WHERE user_id = ?`)
        .all(req.user.id);
    res.json({ balances: rows });
});

// POST /api/leaves - apply for leave
router.post('/', (req, res) => {
    const { leave_type, start_date, end_date, reason } = req.body;
    if (!leave_type || !start_date || !end_date) {
        return res.status(400).json({ error: 'Leave type, start date and end date are required' });
    }

    const days = daysBetween(start_date, end_date);
    if (days <= 0) {
        return res.status(400).json({ error: 'End date must be on or after the start date' });
    }

    const balanceRow = db
        .prepare(`SELECT balance FROM leave_balances WHERE user_id = ? AND leave_type = ?`)
        .get(req.user.id, leave_type);

    if (!balanceRow) {
        return res.status(400).json({ error: `Unknown leave type: ${leave_type}` });
    }
    if (balanceRow.balance < days) {
        return res.status(400).json({ error: `Insufficient ${leave_type} leave balance (available: ${balanceRow.balance})` });
    }

    const info = db
        .prepare(
            `INSERT INTO leaves (user_id, leave_type, start_date, end_date, days, reason)
       VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(req.user.id, leave_type, start_date, end_date, days, reason || '');

    // Notify all admins
    const admins = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all();
    admins.forEach((a) => notify(a.id, `${req.user.name} applied for ${leave_type} leave (${days} day${days > 1 ? 's' : ''})`));

    const row = db.prepare(`SELECT * FROM leaves WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json({ leave: row });
});

// GET /api/leaves/me - own leave history
router.get('/me', (req, res) => {
    const rows = db
        .prepare(`SELECT * FROM leaves WHERE user_id = ? ORDER BY created_at DESC`)
        .all(req.user.id);
    res.json({ leaves: rows });
});

// PATCH /api/leaves/:id/cancel - employee cancels own pending request
router.patch('/:id/cancel', (req, res) => {
    const leave = db.prepare(`SELECT * FROM leaves WHERE id = ?`).get(req.params.id);
    if (!leave || leave.user_id !== req.user.id) {
        return res.status(404).json({ error: 'Leave request not found' });
    }
    if (leave.status !== 'Pending') {
        return res.status(400).json({ error: 'Only pending requests can be cancelled' });
    }

    db.prepare(`UPDATE leaves SET status = 'Cancelled', decided_at = datetime('now') WHERE id = ?`).run(req.params.id);
    const row = db.prepare(`SELECT * FROM leaves WHERE id = ?`).get(req.params.id);
    res.json({ leave: row });
});

// GET /api/leaves - Admin: all requests, filterable by status
router.get('/', requireRole('admin'), (req, res) => {
    const { status } = req.query;
    let sql = `
    SELECT l.*, u.name, u.employee_code, u.department
    FROM leaves l JOIN users u ON u.id = l.user_id
    WHERE 1=1`;
    const params = [];
    if (status) {
        sql += ` AND l.status = ?`;
        params.push(status);
    }
    sql += ` ORDER BY l.created_at DESC`;

    const rows = db.prepare(sql).all(...params);
    res.json({ leaves: rows });
});

// PATCH /api/leaves/:id/decide - Admin approves/rejects
router.patch('/:id/decide', requireRole('admin'), (req, res) => {
    const { decision, comment } = req.body; // decision: 'Approved' | 'Rejected'
    if (!['Approved', 'Rejected'].includes(decision)) {
        return res.status(400).json({ error: "Decision must be 'Approved' or 'Rejected'" });
    }

    const leave = db.prepare(`SELECT * FROM leaves WHERE id = ?`).get(req.params.id);
    if (!leave) return res.status(404).json({ error: 'Leave request not found' });
    if (leave.status !== 'Pending') {
        return res.status(400).json({ error: 'This request has already been decided' });
    }

    db.prepare(
        `UPDATE leaves SET status = ?, admin_comment = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ?`
    ).run(decision, comment || '', req.user.id, req.params.id);

    if (decision === 'Approved') {
        db.prepare(
            `UPDATE leave_balances SET balance = balance - ? WHERE user_id = ? AND leave_type = ?`
        ).run(leave.days, leave.user_id, leave.leave_type);
    }

    notify(leave.user_id, `Your ${leave.leave_type} leave request (${leave.start_date} to ${leave.end_date}) was ${decision.toLowerCase()}.`);

    const row = db.prepare(`SELECT * FROM leaves WHERE id = ?`).get(req.params.id);
    res.json({ leave: row });
});

module.exports = router;
