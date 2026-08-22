const express = require('express');
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}
function nowTimeStr() {
    return new Date().toISOString().slice(11, 19);
}

// POST /api/attendance/check-in
router.post('/check-in', (req, res) => {
    const date = todayStr();
    const existing = db
        .prepare(`SELECT * FROM attendance WHERE user_id = ? AND date = ?`)
        .get(req.user.id, date);

    if (existing && existing.check_in) {
        return res.status(409).json({ error: 'Already checked in today' });
    }

    if (existing) {
        db.prepare(`UPDATE attendance SET check_in = ?, status = 'Present' WHERE id = ?`).run(
            nowTimeStr(),
            existing.id
        );
    } else {
        db.prepare(
            `INSERT INTO attendance (user_id, date, check_in, status) VALUES (?, ?, ?, 'Present')`
        ).run(req.user.id, date, nowTimeStr());
    }

    const row = db.prepare(`SELECT * FROM attendance WHERE user_id = ? AND date = ?`).get(req.user.id, date);
    res.json({ attendance: row });
});

// POST /api/attendance/check-out
router.post('/check-out', (req, res) => {
    const date = todayStr();
    const existing = db
        .prepare(`SELECT * FROM attendance WHERE user_id = ? AND date = ?`)
        .get(req.user.id, date);

    if (!existing || !existing.check_in) {
        return res.status(400).json({ error: 'You must check in before checking out' });
    }
    if (existing.check_out) {
        return res.status(409).json({ error: 'Already checked out today' });
    }

    db.prepare(`UPDATE attendance SET check_out = ? WHERE id = ?`).run(nowTimeStr(), existing.id);
    const row = db.prepare(`SELECT * FROM attendance WHERE id = ?`).get(existing.id);
    res.json({ attendance: row });
});

// GET /api/attendance/me?from=&to=
router.get('/me', (req, res) => {
    const { from, to } = req.query;
    let sql = `SELECT * FROM attendance WHERE user_id = ?`;
    const params = [req.user.id];

    if (from) {
        sql += ` AND date >= ?`;
        params.push(from);
    }
    if (to) {
        sql += ` AND date <= ?`;
        params.push(to);
    }
    sql += ` ORDER BY date DESC`;

    const rows = db.prepare(sql).all(...params);
    res.json({ attendance: rows });
});

// GET /api/attendance/today - today's status for current user
router.get('/today', (req, res) => {
    const row = db
        .prepare(`SELECT * FROM attendance WHERE user_id = ? AND date = ?`)
        .get(req.user.id, todayStr());
    res.json({ attendance: row || null });
});

// GET /api/attendance - Admin: team-wide view
router.get('/', requireRole('admin'), (req, res) => {
    const { from, to, department, user_id } = req.query;
    let sql = `
    SELECT a.*, u.name, u.employee_code, u.department
    FROM attendance a
    JOIN users u ON u.id = a.user_id
    WHERE 1=1`;
    const params = [];

    if (from) {
        sql += ` AND a.date >= ?`;
        params.push(from);
    }
    if (to) {
        sql += ` AND a.date <= ?`;
        params.push(to);
    }
    if (department) {
        sql += ` AND u.department = ?`;
        params.push(department);
    }
    if (user_id) {
        sql += ` AND a.user_id = ?`;
        params.push(user_id);
    }
    sql += ` ORDER BY a.date DESC, u.name ASC`;

    const rows = db.prepare(sql).all(...params);
    res.json({ attendance: rows });
});

// PATCH /api/attendance/:id - Admin manual correction (reason required)
router.patch('/:id', requireRole('admin'), (req, res) => {
    const { status, check_in, check_out, note } = req.body;
    if (!note) {
        return res.status(400).json({ error: 'A reason/comment is required for manual corrections' });
    }

    const updates = [];
    const params = [];
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (check_in !== undefined) { updates.push('check_in = ?'); params.push(check_in); }
    if (check_out !== undefined) { updates.push('check_out = ?'); params.push(check_out); }
    updates.push('note = ?');
    params.push(note);

    params.push(req.params.id);
    db.prepare(`UPDATE attendance SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    db.prepare(`INSERT INTO audit_log (actor_id, action, target, detail) VALUES (?, 'ATTENDANCE_CORRECTION', ?, ?)`).run(
        req.user.id,
        `attendance:${req.params.id}`,
        note
    );

    const row = db.prepare(`SELECT * FROM attendance WHERE id = ?`).get(req.params.id);
    res.json({ attendance: row });
});

module.exports = router;
