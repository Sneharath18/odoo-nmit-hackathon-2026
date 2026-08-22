const express = require('express');
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

// GET /api/dashboard/admin - summary counts for admin home
router.get('/admin', requireRole('admin'), (req, res) => {
    const today = todayStr();
    const totalEmployees = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'employee' AND status = 'active'`).get().n;
    const presentToday = db.prepare(`SELECT COUNT(*) AS n FROM attendance WHERE date = ? AND status = 'Present'`).get(today).n;
    const pendingLeaves = db.prepare(`SELECT COUNT(*) AS n FROM leaves WHERE status = 'Pending'`).get().n;
    const onLeaveToday = db
        .prepare(
            `SELECT COUNT(*) AS n FROM leaves WHERE status = 'Approved' AND date(?) BETWEEN date(start_date) AND date(end_date)`
        )
        .get(today).n;

    const recentLeaves = db
        .prepare(
            `SELECT l.*, u.name, u.employee_code FROM leaves l JOIN users u ON u.id = l.user_id
       WHERE l.status = 'Pending' ORDER BY l.created_at DESC LIMIT 5`
        )
        .all();

    res.json({
        totalEmployees,
        presentToday,
        pendingLeaves,
        onLeaveToday,
        recentLeaves,
    });
});

// GET /api/dashboard/employee - summary for employee home
router.get('/employee', (req, res) => {
    const today = todayStr();
    const attendanceToday = db
        .prepare(`SELECT * FROM attendance WHERE user_id = ? AND date = ?`)
        .get(req.user.id, today);
    const balances = db
        .prepare(`SELECT leave_type, balance FROM leave_balances WHERE user_id = ?`)
        .all(req.user.id);
    const pendingLeaves = db
        .prepare(`SELECT COUNT(*) AS n FROM leaves WHERE user_id = ? AND status = 'Pending'`)
        .get(req.user.id).n;
    const recentLeaves = db
        .prepare(`SELECT * FROM leaves WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`)
        .all(req.user.id);

    res.json({
        attendanceToday: attendanceToday || null,
        balances,
        pendingLeaves,
        recentLeaves,
    });
});

// GET /api/dashboard/notifications
router.get('/notifications', (req, res) => {
    const rows = db
        .prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`)
        .all(req.user.id);
    res.json({ notifications: rows });
});

// PATCH /api/dashboard/notifications/:id/read
router.patch('/notifications/:id/read', (req, res) => {
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
    res.json({ ok: true });
});

module.exports = router;
