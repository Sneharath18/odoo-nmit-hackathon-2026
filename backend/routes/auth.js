const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, seedLeaveBalances } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
    return jwt.sign(
        { id: user.id, role: user.role, name: user.name, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
}

function nextEmployeeCode() {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM users`).get();
    return 'EMP' + String(row.n + 1).padStart(3, '0');
}

// Self-service signup -> always created as 'employee'
router.post('/signup', (req, res) => {
    const { name, email, password, department, designation, phone } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase());
    if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const code = nextEmployeeCode();

    const info = db
        .prepare(
            `INSERT INTO users (employee_code, name, email, password_hash, role, department, designation, phone, status)
       VALUES (?, ?, ?, ?, 'employee', ?, ?, ?, 'active')`
        )
        .run(code, name, email.toLowerCase(), hash, department || '', designation || '', phone || '');

    seedLeaveBalances(info.lastInsertRowid);

    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(info.lastInsertRowid);
    const token = signToken(user);

    res.status(201).json({
        token,
        user: sanitize(user),
    });
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.status === 'inactive') {
        return res.status(403).json({ error: 'This account has been deactivated. Contact HR.' });
    }

    const token = signToken(user);
    res.json({ token, user: sanitize(user) });
});

router.get('/me', authenticate, (req, res) => {
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: sanitize(user) });
});

function sanitize(user) {
    const { password_hash, ...rest } = user;
    return rest;
}

module.exports = router;
