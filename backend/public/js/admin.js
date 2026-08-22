if (Dayflow.requireRole('admin')) {
    const u = Dayflow.user();
    document.getElementById('whoName').textContent = u.name;
    document.getElementById('logoutBtn').onclick = Dayflow.logout;
    document.getElementById('todayDate').textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // ---------- Navigation ----------
    const navItems = document.querySelectorAll('.nav-item');
    const views = {
        home: document.getElementById('view-home'),
        employees: document.getElementById('view-employees'),
        attendance: document.getElementById('view-attendance'),
        approvals: document.getElementById('view-approvals'),
        payroll: document.getElementById('view-payroll'),
    };
    function showView(name) {
        Object.entries(views).forEach(([k, el]) => el.style.display = k === name ? '' : 'none');
        navItems.forEach(n => n.classList.toggle('active', n.dataset.view === name));
        if (name === 'home') loadHome();
        if (name === 'employees') loadEmployees();
        if (name === 'attendance') loadAttendance();
        if (name === 'approvals') loadApprovals('Pending');
        if (name === 'payroll') loadPayrollForm();
    }
    navItems.forEach(n => n.onclick = () => showView(n.dataset.view));

    // ---------- Overview ----------
    async function loadHome() {
        const data = await Dayflow.get('/dashboard/admin');
        const stats = [
            { label: 'Active employees', value: data.totalEmployees, cls: 'cobalt' },
            { label: 'Present today', value: data.presentToday, cls: 'success' },
            { label: 'Pending leave', value: data.pendingLeaves, cls: 'amber' },
            { label: 'On leave today', value: data.onLeaveToday, cls: '' },
        ];
        document.getElementById('adminStats').innerHTML = stats.map(s => `
      <div class="card stat-card">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value ${s.cls}">${s.value}</div>
      </div>`).join('');

        const tbody = document.querySelector('#homeApprovalsTable tbody');
        tbody.innerHTML = data.recentLeaves.length ? data.recentLeaves.map(l => `
      <tr>
        <td>${l.name} <span class="muted">(${l.employee_code})</span></td>
        <td>${l.leave_type}</td>
        <td>${Dayflow.fmtDate(l.start_date)} → ${Dayflow.fmtDate(l.end_date)}</td>
        <td>${l.days}</td>
        <td>
          <button class="btn btn-success btn-small" data-approve="${l.id}">Approve</button>
          <button class="btn btn-danger btn-small" data-reject="${l.id}">Reject</button>
        </td>
      </tr>`).join('') : `<tr><td colspan="5" class="empty-state">No pending requests — nice and clear</td></tr>`;

        wireDecisionButtons(tbody, loadHome);
    }

    // ---------- Employees ----------
    async function loadEmployees(q) {
        const query = q ? `?q=${encodeURIComponent(q)}` : '';
        const data = await Dayflow.get(`/employees${query}`);
        const tbody = document.querySelector('#employeesTable tbody');
        tbody.innerHTML = data.employees.length ? data.employees.map(e => `
      <tr>
        <td class="muted">${e.employee_code}</td>
        <td>${e.name}</td>
        <td>${e.department || '—'}</td>
        <td>${e.designation || '—'}</td>
        <td><span class="badge ${Dayflow.badgeClass(e.status)}">${e.status}</span></td>
        <td>
          <button class="btn btn-ghost btn-small" data-edit='${JSON.stringify(e)}'>Edit</button>
          ${e.status === 'active' ? `<button class="btn btn-danger btn-small" data-deactivate="${e.id}">Deactivate</button>` : ''}
        </td>
      </tr>`).join('') : `<tr><td colspan="6" class="empty-state">No employees match your search</td></tr>`;

        tbody.querySelectorAll('[data-edit]').forEach(btn => {
            btn.onclick = () => openEditEmployee(JSON.parse(btn.dataset.edit));
        });
        tbody.querySelectorAll('[data-deactivate]').forEach(btn => {
            btn.onclick = async () => {
                if (!confirm('Deactivate this employee?')) return;
                try {
                    await Dayflow.del(`/employees/${btn.dataset.deactivate}`);
                    Dayflow.toast('Employee deactivated');
                    loadEmployees(document.getElementById('empSearch').value);
                } catch (err) { Dayflow.toast(err.message, 'error'); }
            };
        });
    }

    let searchTimer;
    document.getElementById('empSearch').addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => loadEmployees(e.target.value), 250);
    });

    const addBackdrop = document.getElementById('addEmpBackdrop');
    document.getElementById('openAddEmployee').onclick = () => addBackdrop.classList.add('show');
    document.getElementById('cancelAddEmp').onclick = () => addBackdrop.classList.remove('show');
    document.getElementById('addEmpForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await Dayflow.post('/employees', {
                name: document.getElementById('aeName').value.trim(),
                email: document.getElementById('aeEmail').value.trim(),
                department: document.getElementById('aeDept').value.trim(),
                designation: document.getElementById('aeDesig').value.trim(),
                password: document.getElementById('aePassword').value,
                role: document.getElementById('aeRole').value,
            });
            Dayflow.toast('Employee added', 'success');
            addBackdrop.classList.remove('show');
            e.target.reset();
            loadEmployees();
        } catch (err) { Dayflow.toast(err.message, 'error'); }
    });

    const editBackdrop = document.getElementById('editEmpBackdrop');
    function openEditEmployee(emp) {
        document.getElementById('eeId').value = emp.id;
        document.getElementById('eeName').value = emp.name;
        document.getElementById('eeDept').value = emp.department || '';
        document.getElementById('eeDesig').value = emp.designation || '';
        document.getElementById('eeStatus').value = emp.status;
        editBackdrop.classList.add('show');
    }
    document.getElementById('cancelEditEmp').onclick = () => editBackdrop.classList.remove('show');
    document.getElementById('editEmpForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const id = document.getElementById('eeId').value;
            await Dayflow.patch(`/employees/${id}`, {
                name: document.getElementById('eeName').value.trim(),
                department: document.getElementById('eeDept').value.trim(),
                designation: document.getElementById('eeDesig').value.trim(),
                status: document.getElementById('eeStatus').value,
            });
            Dayflow.toast('Employee updated', 'success');
            editBackdrop.classList.remove('show');
            loadEmployees(document.getElementById('empSearch').value);
        } catch (err) { Dayflow.toast(err.message, 'error'); }
    });

    // ---------- Attendance ----------
    const attDate = document.getElementById('attDate');
    attDate.value = new Date().toISOString().slice(0, 10);
    attDate.addEventListener('change', loadAttendance);

    async function loadAttendance() {
        const d = attDate.value;
        const data = await Dayflow.get(`/attendance?from=${d}&to=${d}`);
        const tbody = document.querySelector('#adminAttendanceTable tbody');
        tbody.innerHTML = data.attendance.length ? data.attendance.map(a => `
      <tr>
        <td>${a.name} <span class="muted">(${a.employee_code})</span></td>
        <td>${a.department || '—'}</td>
        <td>${a.check_in || '—'}</td>
        <td>${a.check_out || '—'}</td>
        <td><span class="badge ${Dayflow.badgeClass(a.status)}">${a.status}</span></td>
        <td><button class="btn btn-ghost btn-small" data-correct='${JSON.stringify(a)}'>Correct</button></td>
      </tr>`).join('') : `<tr><td colspan="6" class="empty-state">No attendance recorded for this date</td></tr>`;

        tbody.querySelectorAll('[data-correct]').forEach(btn => {
            btn.onclick = () => openCorrect(JSON.parse(btn.dataset.correct));
        });
    }

    const correctBackdrop = document.getElementById('correctBackdrop');
    function openCorrect(a) {
        document.getElementById('caId').value = a.id;
        document.getElementById('caStatus').value = a.status;
        document.getElementById('caCheckIn').value = a.check_in || '';
        document.getElementById('caCheckOut').value = a.check_out || '';
        document.getElementById('caNote').value = '';
        correctBackdrop.classList.add('show');
    }
    document.getElementById('cancelCorrect').onclick = () => correctBackdrop.classList.remove('show');
    document.getElementById('correctForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const id = document.getElementById('caId').value;
            await Dayflow.patch(`/attendance/${id}`, {
                status: document.getElementById('caStatus').value,
                check_in: document.getElementById('caCheckIn').value || undefined,
                check_out: document.getElementById('caCheckOut').value || undefined,
                note: document.getElementById('caNote').value,
            });
            Dayflow.toast('Attendance corrected', 'success');
            correctBackdrop.classList.remove('show');
            loadAttendance();
        } catch (err) { Dayflow.toast(err.message, 'error'); }
    });

    // ---------- Approvals ----------
    document.querySelectorAll('#view-approvals .pill').forEach(p => {
        p.onclick = () => {
            document.querySelectorAll('#view-approvals .pill').forEach(x => x.classList.remove('active'));
            p.classList.add('active');
            loadApprovals(p.dataset.status);
        };
    });

    async function loadApprovals(status) {
        const query = status ? `?status=${status}` : '';
        const data = await Dayflow.get(`/leaves${query}`);
        const tbody = document.querySelector('#approvalsTable tbody');
        tbody.innerHTML = data.leaves.length ? data.leaves.map(l => `
      <tr>
        <td>${l.name} <span class="muted">(${l.employee_code})</span></td>
        <td>${l.leave_type}</td>
        <td>${Dayflow.fmtDate(l.start_date)} → ${Dayflow.fmtDate(l.end_date)}</td>
        <td>${l.days}</td>
        <td class="muted">${l.reason || '—'}</td>
        <td><span class="badge ${Dayflow.badgeClass(l.status)}">${l.status}</span></td>
        <td>${l.status === 'Pending' ? `
          <button class="btn btn-success btn-small" data-approve="${l.id}">Approve</button>
          <button class="btn btn-danger btn-small" data-reject="${l.id}">Reject</button>` : (l.admin_comment ? `<span class="muted">${l.admin_comment}</span>` : '')}
        </td>
      </tr>`).join('') : `<tr><td colspan="7" class="empty-state">No requests in this filter</td></tr>`;

        wireDecisionButtons(tbody, () => loadApprovals(document.querySelector('#view-approvals .pill.active').dataset.status));
    }

    const decideBackdrop = document.getElementById('decideBackdrop');
    let onDecideDone = () => { };
    function wireDecisionButtons(scope, onDone) {
        onDecideDone = onDone;
        scope.querySelectorAll('[data-approve]').forEach(btn => {
            btn.onclick = () => openDecide(btn.dataset.approve, 'Approved');
        });
        scope.querySelectorAll('[data-reject]').forEach(btn => {
            btn.onclick = () => openDecide(btn.dataset.reject, 'Rejected');
        });
    }
    function openDecide(leaveId, decision) {
        document.getElementById('dLeaveId').value = leaveId;
        document.getElementById('dDecision').value = decision;
        document.getElementById('decideTitle').textContent = decision === 'Approved' ? 'Approve leave request' : 'Reject leave request';
        document.getElementById('confirmDecide').className = 'btn btn-small ' + (decision === 'Approved' ? 'btn-success' : 'btn-danger');
        document.getElementById('confirmDecide').textContent = decision;
        document.getElementById('dComment').value = '';
        decideBackdrop.classList.add('show');
    }
    document.getElementById('cancelDecide').onclick = () => decideBackdrop.classList.remove('show');
    document.getElementById('decideForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const id = document.getElementById('dLeaveId').value;
            const decision = document.getElementById('dDecision').value;
            await Dayflow.patch(`/leaves/${id}/decide`, {
                decision,
                comment: document.getElementById('dComment').value,
            });
            Dayflow.toast(`Leave ${decision.toLowerCase()}`, 'success');
            decideBackdrop.classList.remove('show');
            onDecideDone();
        } catch (err) { Dayflow.toast(err.message, 'error'); }
    });

    // ---------- Payroll ----------
    async function loadPayrollForm() {
        const data = await Dayflow.get('/employees?status=active');
        const select = document.getElementById('prEmployee');
        select.innerHTML = data.employees.map(e => `<option value="${e.id}">${e.name} (${e.employee_code})</option>`).join('');
    }
    document.getElementById('payrollForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await Dayflow.post('/payroll', {
                user_id: document.getElementById('prEmployee').value,
                month: document.getElementById('prMonth').value,
                year: document.getElementById('prYear').value,
                basic: document.getElementById('prBasic').value,
                allowances: document.getElementById('prAllowances').value,
                deductions: document.getElementById('prDeductions').value,
            });
            Dayflow.toast('Payslip generated', 'success');
            e.target.reset();
            document.getElementById('prYear').value = 2026;
        } catch (err) { Dayflow.toast(err.message, 'error'); }
    });

    loadHome();
}
