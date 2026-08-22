const express = require('express');
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/payroll/me - employee's own payslips
router.get('/me', (req, res) => {
    const rows = db
        .prepare(`SELECT * FROM payslips WHERE user_id = ? ORDER BY year DESC, month DESC`)
        .all(req.user.id);
    res.json({ payslips: rows });
});

// GET /api/payroll/:userId - Admin view of a specific employee's payslips
router.get('/:userId', requireRole('admin'), (req, res) => {
    const rows = db
        .prepare(`SELECT * FROM payslips WHERE user_id = ? ORDER BY year DESC, month DESC`)
        .all(req.params.userId);
    res.json({ payslips: rows });
});

// POST /api/payroll - Admin generates/uploads a payslip for a pay cycle
router.post('/', requireRole('admin'), (req, res) => {
    const { user_id, month, year, basic, allowances, deductions } = req.body;
    if (!user_id || !month || !year) {
        return res.status(400).json({ error: 'user_id, month and year are required' });
    }

    const b = Number(basic) || 0;
    const a = Number(allowances) || 0;
    const d = Number(deductions) || 0;
    const net = b + a - d;

    const existing = db
        .prepare(`SELECT id FROM payslips WHERE user_id = ? AND month = ? AND year = ?`)
        .get(user_id, month, year);

    if (existing) {
        db.prepare(
            `UPDATE payslips SET basic = ?, allowances = ?, deductions = ?, net_pay = ?, generated_at = datetime('now') WHERE id = ?`
        ).run(b, a, d, net, existing.id);
    } else {
        db.prepare(
            `INSERT INTO payslips (user_id, month, year, basic, allowances, deductions, net_pay)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(user_id, month, year, b, a, d, net);
    }

    db.prepare(`INSERT INTO notifications (user_id, message) VALUES (?, ?)`).run(
        user_id,
        `Your payslip for ${month}/${year} is now available.`
    );

    const row = db
        .prepare(`SELECT * FROM payslips WHERE user_id = ? AND month = ? AND year = ?`)
        .get(user_id, month, year);
    res.status(201).json({ payslip: row });
});

module.exports = router;
