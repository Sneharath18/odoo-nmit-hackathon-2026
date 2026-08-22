const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'data', 'dayflow.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- Schema ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','employee')) DEFAULT 'employee',
  department TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  emergency_contact TEXT DEFAULT '',
  joining_date TEXT DEFAULT (date('now')),
  status TEXT NOT NULL CHECK(status IN ('active','inactive')) DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  status TEXT NOT NULL DEFAULT 'Present',
  note TEXT DEFAULT '',
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS leave_balances (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, leave_type)
);

CREATE TABLE IF NOT EXISTS leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days REAL NOT NULL,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('Pending','Approved','Rejected','Cancelled')) DEFAULT 'Pending',
  admin_comment TEXT DEFAULT '',
  decided_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS payslips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  basic REAL NOT NULL DEFAULT 0,
  allowances REAL NOT NULL DEFAULT 0,
  deductions REAL NOT NULL DEFAULT 0,
  net_pay REAL NOT NULL DEFAULT 0,
  generated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, month, year)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// ---------- Seed default admin ----------
const DEFAULT_LEAVE_TYPES = [
    { type: 'Paid', balance: 12 },
    { type: 'Sick', balance: 8 },
    { type: 'Unpaid', balance: 999 },
];

function seedLeaveBalances(userId) {
    const insert = db.prepare(
        `INSERT OR IGNORE INTO leave_balances (user_id, leave_type, balance) VALUES (?, ?, ?)`
    );
    DEFAULT_LEAVE_TYPES.forEach((lt) => insert.run(userId, lt.type, lt.balance));
}

function ensureAdmin() {
    const existing = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get();
    if (existing) return;

    const hash = bcrypt.hashSync('Admin@123', 10);
    const info = db
        .prepare(
            `INSERT INTO users (employee_code, name, email, password_hash, role, department, designation, status)
       VALUES (?, ?, ?, ?, 'admin', ?, ?, 'active')`
        )
        .run('ADM001', 'Dayflow Admin', 'admin@dayflow.local', hash, 'Human Resources', 'HR Officer');

    seedLeaveBalances(info.lastInsertRowid);
    console.log('Seeded default admin -> email: admin@dayflow.local | password: Admin@123');
}

ensureAdmin();

module.exports = { db, seedLeaveBalances };
