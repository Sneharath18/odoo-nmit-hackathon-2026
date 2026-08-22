if (Dayflow.requireRole('employee')) {
    const u = Dayflow.user();
    document.getElementById('whoName').textContent = u.name;
    document.getElementById('logoutBtn').onclick = Dayflow.logout;

    // ---------- Navigation ----------
    const navItems = document.querySelectorAll('.nav-item');
    const views = {
        home: document.getElementById('view-home'),
        attendance: document.getElementById('view-attendance'),
        leave: document.getElementById('view-leave'),
        payroll: document.getElementById('view-payroll'),
        profile: document.getElementById('view-profile'),
    };
    function showView(name) {
        Object.entries(views).forEach(([k, el]) => el.style.display = k === name ? '' : 'none');
        navItems.forEach(n => n.classList.toggle('active', n.dataset.view === name));
        if (name === 'attendance') loadAttendance('30');
        if (name === 'leave') loadLeave();
        if (name === 'payroll') loadPayroll();
        if (name === 'profile') loadProfile();
    }
    navItems.forEach(n => n.onclick = () => showView(n.dataset.view));

    document.getElementById('todayDate').textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // ---------- Home ----------
    async function loadHome() {
        const [dash, today] = await Promise.all([
            Dayflow.get('/dashboard/employee'),
            Dayflow.get('/attendance/today'),
        ]);
        renderCheckActions(today.attendance);
        renderRail(today.attendance);

        const stats = [
            { label: 'Paid leave left', value: (dash.balances.find(b => b.leave_type === 'Paid') || {}).balance ?? 0, cls: 'cobalt' },
            { label: 'Sick leave left', value: (dash.balances.find(b => b.leave_type === 'Sick') || {}).balance ?? 0, cls: 'amber' },
            { label: 'Pending requests', value: dash.pendingLeaves, cls: '' },
            { label: "Today's status", value: today.attendance ? today.attendance.status : 'Not checked in', cls: 'success' },
        ];
        document.getElementById('homeStats').innerHTML = stats.map(s => `
      <div class="card stat-card">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value ${s.cls}" style="${typeof s.value === 'string' && isNaN(s.value) ? 'font-size:20px' : ''}">${s.value}</div>
      </div>`).join('');

        const tbody = document.querySelector('#homeLeaveTable tbody');
        tbody.innerHTML = dash.recentLeaves.length ? dash.recentLeaves.map(l => `
      <tr>
        <td>${l.leave_type}</td>
        <td>${Dayflow.fmtDate(l.start_date)} → ${Dayflow.fmtDate(l.end_date)}</td>
        <td>${l.days}</td>
        <td><span class="badge ${Dayflow.badgeClass(l.status)}">${l.status}</span></td>
      </tr>`).join('') : `<tr><td colspan="4" class="empty-state">No leave requests yet</td></tr>`;
    }

    function renderCheckActions(att) {
        const el = document.getElementById('checkActions');
        if (!att || !att.check_in) {
            el.innerHTML = `<button class="btn btn-primary" id="btnCheckIn">Check in</button>`;
            document.getElementById('btnCheckIn').onclick = doCheckIn;
        } else if (att.check_in && !att.check_out) {
            el.innerHTML = `<button class="btn btn-primary" id="btnCheckOut">Check out</button>`;
            document.getElementById('btnCheckOut').onclick = doCheckOut;
        } else {
            el.innerHTML = `<span class="badge badge-approved">Day complete · in ${att.check_in} / out ${att.check_out}</span>`;
        }
    }

    function renderRail(att) {
        const steps = document.querySelectorAll('#dayRail .rp');
        steps.forEach(s => s.classList.remove('done', 'now'));
        if (!att || !att.check_in) {
            steps[0].classList.add('now');
        } else if (att.check_in && !att.check_out) {
            steps[0].classList.add('done'); steps[1].classList.add('now');
        } else if (att.check_out) {
            steps[0].classList.add('done'); steps[1].classList.add('done'); steps[2].classList.add('done'); steps[3].classList.add('now');
        }
    }

    async function doCheckIn() {
        try {
            await Dayflow.post('/attendance/check-in');
            Dayflow.toast('Checked in for today', 'success');
            loadHome();
        } catch (err) { Dayflow.toast(err.message, 'error'); }
    }
    async function doCheckOut() {
        try {
            await Dayflow.post('/attendance/check-out');
            Dayflow.toast('Checked out — have a good evening', 'success');
            loadHome();
        } catch (err) { Dayflow.toast(err.message, 'error'); }
    }

    // ---------- Attendance ----------
    document.querySelectorAll('#view-attendance .pill').forEach(p => {
        p.onclick = () => {
            document.querySelectorAll('#view-attendance .pill').forEach(x => x.classList.remove('active'));
            p.classList.add('active');
            loadAttendance(p.dataset.range);
        };
    });

    async function loadAttendance(range) {
        let from;
        if (range === '30') from = daysAgo(30);
        if (range === '90') from = daysAgo(90);
        const query = from ? `?from=${from}` : '';
        const data = await Dayflow.get(`/attendance/me${query}`);
        const tbody = document.querySelector('#attendanceTable tbody');
        tbody.innerHTML = data.attendance.length ? data.attendance.map(a => `
      <tr>
        <td>${Dayflow.fmtDate(a.date)}</td>
        <td>${a.check_in || '—'}</td>
        <td>${a.check_out || '—'}</td>
        <td><span class="badge ${Dayflow.badgeClass(a.status)}">${a.status}</span></td>
        <td class="muted">${a.note || ''}</td>
      </tr>`).join('') : `<tr><td colspan="5" class="empty-state">No attendance records in this range</td></tr>`;
    }
    function daysAgo(n) {
        const d = new Date(); d.setDate(d.getDate() - n);
        return d.toISOString().slice(0, 10);
    }

    // ---------- Leave ----------
    async function loadLeave() {
        const [balances, leaves] = await Promise.all([
            Dayflow.get('/leaves/balances'),
            Dayflow.get('/leaves/me'),
        ]);

        document.getElementById('balanceCards').innerHTML = balances.balances.map(b => `
      <div class="card stat-card">
        <div class="stat-label">${b.leave_type} leave</div>
        <div class="stat-value cobalt">${b.balance}</div>
      </div>`).join('');

        const tbody = document.querySelector('#leaveTable tbody');
        tbody.innerHTML = leaves.leaves.length ? leaves.leaves.map(l => `
      <tr>
        <td>${l.leave_type}</td>
        <td>${Dayflow.fmtDate(l.start_date)}</td>
        <td>${Dayflow.fmtDate(l.end_date)}</td>
        <td>${l.days}</td>
        <td class="muted">${l.reason || '—'}</td>
        <td><span class="badge ${Dayflow.badgeClass(l.status)}">${l.status}</span></td>
        <td>${l.status === 'Pending' ? `<button class="btn btn-ghost btn-small" data-cancel="${l.id}">Cancel</button>` : ''}</td>
      </tr>`).join('') : `<tr><td colspan="7" class="empty-state">You haven't requested any leave yet</td></tr>`;

        tbody.querySelectorAll('[data-cancel]').forEach(btn => {
            btn.onclick = async () => {
                try {
                    await Dayflow.patch(`/leaves/${btn.dataset.cancel}/cancel`);
                    Dayflow.toast('Leave request cancelled');
                    loadLeave();
                } catch (err) { Dayflow.toast(err.message, 'error'); }
            };
        });
    }

    const leaveBackdrop = document.getElementById('leaveModalBackdrop');
    document.getElementById('openLeaveModal').onclick = () => leaveBackdrop.classList.add('show');
    document.getElementById('cancelLeaveModal').onclick = () => leaveBackdrop.classList.remove('show');

    document.getElementById('leaveForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await Dayflow.post('/leaves', {
                leave_type: document.getElementById('leaveType').value,
                start_date: document.getElementById('leaveStart').value,
                end_date: document.getElementById('leaveEnd').value,
                reason: document.getElementById('leaveReason').value,
            });
            Dayflow.toast('Leave request submitted', 'success');
            leaveBackdrop.classList.remove('show');
            e.target.reset();
            loadLeave();
        } catch (err) { Dayflow.toast(err.message, 'error'); }
    });

    // ---------- Payroll ----------
    async function loadPayroll() {
        const data = await Dayflow.get('/payroll/me');
        const tbody = document.querySelector('#payrollTable tbody');
        const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        tbody.innerHTML = data.payslips.length ? data.payslips.map(p => `
      <tr>
        <td>${months[p.month]} ${p.year}</td>
        <td>₹${p.basic.toLocaleString()}</td>
        <td>₹${p.allowances.toLocaleString()}</td>
        <td>₹${p.deductions.toLocaleString()}</td>
        <td><b>₹${p.net_pay.toLocaleString()}</b></td>
      </tr>`).join('') : `<tr><td colspan="5" class="empty-state">No payslips have been generated yet</td></tr>`;
    }

    // ---------- Profile ----------
    async function loadProfile() {
        const data = await Dayflow.get('/employees/me');
        const e = data.employee;
        document.getElementById('profileReadonly').innerHTML = `
      <div class="field"><label>Employee code</label><div>${e.employee_code}</div></div>
      <div class="field"><label>Name</label><div>${e.name}</div></div>
      <div class="field"><label>Email</label><div>${e.email}</div></div>
      <div class="field"><label>Department</label><div>${e.department || '—'}</div></div>
      <div class="field"><label>Designation</label><div>${e.designation || '—'}</div></div>
      <div class="field"><label>Joining date</label><div>${Dayflow.fmtDate(e.joining_date)}</div></div>
    `;
        document.getElementById('pfPhone').value = e.phone || '';
        document.getElementById('pfAddress').value = e.address || '';
        document.getElementById('pfEmergency').value = e.emergency_contact || '';
    }

    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await Dayflow.patch('/employees/me', {
                phone: document.getElementById('pfPhone').value,
                address: document.getElementById('pfAddress').value,
                emergency_contact: document.getElementById('pfEmergency').value,
            });
            Dayflow.toast('Profile updated', 'success');
        } catch (err) { Dayflow.toast(err.message, 'error'); }
    });

    document.getElementById('whoRole').textContent = 'Employee';
    loadHome();
}