const Dayflow = (() => {
    function token() { return localStorage.getItem('dayflow_token'); }
    function setToken(t) { localStorage.setItem('dayflow_token', t); }
    function clearToken() { localStorage.removeItem('dayflow_token'); localStorage.removeItem('dayflow_user'); }
    function user() {
        try { return JSON.parse(localStorage.getItem('dayflow_user')); } catch { return null; }
    }
    function setUser(u) { localStorage.setItem('dayflow_user', JSON.stringify(u)); }

    async function request(method, path, body) {
        const headers = { 'Content-Type': 'application/json' };
        const t = token();
        if (t) headers['Authorization'] = `Bearer ${t}`;

        const res = await fetch(`/api${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        let data = {};
        try { data = await res.json(); } catch { /* no body */ }

        if (!res.ok) {
            if (res.status === 401) {
                clearToken();
                if (!location.pathname.endsWith('index.html') && location.pathname !== '/') {
                    location.href = '/index.html';
                }
            }
            throw new Error(data.error || 'Something went wrong. Please try again.');
        }
        return data;
    }

    function requireAuth() {
        if (!token() || !user()) {
            location.href = '/index.html';
            return false;
        }
        return true;
    }

    function requireRole(role) {
        if (!requireAuth()) return false;
        if (user().role !== role) {
            location.href = user().role === 'admin' ? '/admin.html' : '/employee.html';
            return false;
        }
        return true;
    }

    function toast(message, type = '') {
        let wrap = document.querySelector('.toast-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'toast-wrap';
            document.body.appendChild(wrap);
        }
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = message;
        wrap.appendChild(el);
        setTimeout(() => el.remove(), 3800);
    }

    function fmtDate(d) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function badgeClass(status) {
        return 'badge-' + String(status || '').toLowerCase().replace(/\s+/g, '-').replace('on-leave', 'onleave');
    }

    function logout() {
        clearToken();
        location.href = '/index.html';
    }

    return {
        get: (p) => request('GET', p), post: (p, b) => request('POST', p, b),
        patch: (p, b) => request('PATCH', p, b), del: (p) => request('DELETE', p),
        token, setToken, clearToken, user, setUser, requireAuth, requireRole,
        toast, fmtDate, badgeClass, logout
    };
})();