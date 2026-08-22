const express = require('express');
const bcrypt = require('bcryptjs');
const { db, seedLeaveBalances } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const PUBLIC_FIELDS = `id, employee_code, name, email, role, department, designation, phone, address, emergency_contact, joining_date, status, created_at`;

// GET /api/employees - Admin: list all, filterable
router.get('/', requireRole('admin'), (req, res) => {
    const { department, status, q } = req.query;
    let sql = `SELECT ${PUBLIC_FIELDS} FROM users WHERE 1=1`;
    const params = [];

    if (department) {
        sql += ` AND department = ?`;
        params.push(department);
    }
    if (status) {
        sql += ` AND status = ?`;
        params.push(status);
    }
    if (q) {
        sql += ` AND (name LIKE ? OR employee_code LIKE ? OR email LIKE ?)`;
        const like = `%${q}%`;
        params.push(like, like, like);
    }
    sql += ` ORDER BY created_at DESC`;

    const rows = db.prepare(sql).all(...params);
    res.json({ employees: rows });
});

// GET /api/employees/me - own profile
router.get('/me', (req, res) => {
    const row = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(req.user.id);
    res.json({ employee: row });
});

// PATCH /api/employees/me - self-update limited fields
router.patch('/me', (req, res) => {
    const allowed = ['phone', 'address', 'emergency_contact'];
    const updates = [];
    const params = [];

    for (const field of allowed) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`);
            params.push(req.body[field]);
        }
    }
    if (updates.length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided' });
    }

    params.push(req.user.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    logAudit(req.user.id, 'PROFILE_SELF_UPDATE', `user:${req.user.id}`, JSON.stringify(req.body));

    const row = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(req.user.id);
    res.json({ employee: row });
});

// GET /api/employees/:id - Admin view of any employee
router.get('/:id', requireRole('admin'), (req, res) => {
    const row = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Employee not found' });
    res.json({ employee: row });
});

// POST /api/employees - Admin creates a new employee
router.post('/', requireRole('admin'), (req, res) => {
    const { name, email, password, department, designation, phone, role } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase());
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const count = db.prepare(`SELECT COUNT(*) AS n FROM users`).get().n;
    const code = 'EMP' + String(count + 1).padStart(3, '0');
    const hash = bcrypt.hashSync(password, 10);

    const info = db
        .prepare(
            `INSERT INTO users (employee_code, name, email, password_hash, role, department, designation, phone, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`
        )
        .run(code, name, email.toLowerCase(), hash, role === 'admin' ? 'admin' : 'employee', department || '', designation || '', phone || '');

    seedLeaveBalances(info.lastInsertRowid);
    logAudit(req.user.id, 'EMPLOYEE_CREATE', `user:${info.lastInsertRowid}`, name);

    const row = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json({ employee: row });
});

// PATCH /api/employees/:id - Admin edits any field
router.patch('/:id', requireRole('admin'), (req, res) => {
    const allowed = ['name', 'department', 'designation', 'phone', 'address', 'emergency_contact', 'status', 'role'];
    const updates = [];
    const params = [];

    for (const field of allowed) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`);
            params.push(req.body[field]);
        }
    }
    if (updates.length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided' });
    }

    params.push(req.params.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    logAudit(req.user.id, 'EMPLOYEE_UPDATE', `user:${req.params.id}`, JSON.stringify(req.body));

    const row = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(req.params.id);
    res.json({ employee: row });
});

// DELETE /api/employees/:id - Admin deactivates (soft delete)
router.delete('/:id', requireRole('admin'), (req, res) => {
    db.prepare(`UPDATE users SET status = 'inactive' WHERE id = ?`).run(req.params.id);
    logAudit(req.user.id, 'EMPLOYEE_DEACTIVATE', `user:${req.params.id}`, '');
    res.json({ message: 'Employee deactivated' });
});

function logAudit(actorId, action, target, detail) {
    db.prepare(`INSERT INTO audit_log (actor_id, action, target, detail) VALUES (?, ?, ?, ?)`).run(
        actorId,
        action,
        target,
        detail
    );
}

module.exports = router;
