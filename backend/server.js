require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

require('./db'); // initializes schema + seeds default admin

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leaves');
const payrollRoutes = require('./routes/payroll');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'dayflow-hrms' }));

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Central error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Dayflow HRMS running at http://localhost:${PORT}`);
});
