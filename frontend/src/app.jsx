import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';

import SignIn from './components/auth/SignIn';
import SignUp from './components/auth/SignUp';
import ProtectedRoute from './components/common/ProtectedRoute';
import LoadingSpinner from './components/common/LoadingSpinner';
import Navbar from './components/common/Navbar';
import AdminDashboard from './components/dashboard/AdminDashboard';
import EmployeeDashboard from './components/dashboard/EmployeeDashboard';
import EmployeeList from './components/employees/EmployeeList';
import EmployeeForm from './components/employees/EmployeeForm';
import EmployeeView from './components/employees/EmployeeView';
import MyProfile from './components/profile/MyProfile';
import AttendanceAdmin from './components/attendance/AttendanceAdmin';
import AttendanceEmployee from './components/attendance/AttendanceEmployee';
import TimeOffAdmin from './components/timeoff/TimeOffAdmin';
import TimeOffEmployee from './components/timeoff/TimeOffEmployee';

function Layout() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Outlet />
            </main>
        </div>
    );
}

/** Guard that only allows specified roles; others go to /dashboard */
function RoleGuard({ roles, children }) {
    const { user } = useAuth();
    if (!roles.includes(user?.role)) {
        return <Navigate to="/dashboard" replace />;
    }
    return children;
}

/** Route to admin or employee dashboard based on role */
function DashboardRouter() {
    const { user } = useAuth();
    if (!user) return null;
    return ['admin', 'hr_officer'].includes(user.role)
        ? <AdminDashboard />
        : <EmployeeDashboard />;
}

function AttendanceRouter() {
    const { user } = useAuth();
    return ['admin', 'hr_officer'].includes(user?.role)
        ? <AttendanceAdmin />
        : <AttendanceEmployee />;
}

function TimeOffRouter() {
    const { user } = useAuth();
    return ['admin', 'hr_officer'].includes(user?.role)
        ? <TimeOffAdmin />
        : <TimeOffEmployee />;
}

function App() {
    const { loading, isAuthenticated } = useAuth();

    if (loading) {
        return <LoadingSpinner fullScreen />;
    }

    return (
        <>
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: { background: '#363636', color: '#fff' }
                }}
            />

            <Routes>
                {/* Public routes — redirect authenticated users to dashboard */}
                <Route
                    path="/signin"
                    element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <SignIn />}
                />
                <Route
                    path="/signup"
                    element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <SignUp />}
                />

                {/* Protected routes */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                        {/* Dashboard — role-based rendering */}
                        <Route path="/dashboard" element={<DashboardRouter />} />

                        {/* Employee management — admin/HR only */}
                        <Route path="/employees" element={
                            <RoleGuard roles={['admin', 'hr_officer']}>
                                <EmployeeList />
                            </RoleGuard>
                        } />
                        <Route path="/employees/new" element={
                            <RoleGuard roles={['admin', 'hr_officer']}>
                                <EmployeeForm />
                            </RoleGuard>
                        } />

                        {/* Employee profile view — accessible to all, controller enforces data scoping */}
                        <Route path="/employees/:id" element={<EmployeeView />} />

                        {/* My Profile — any authenticated user */}
                        <Route path="/profile" element={<MyProfile />} />

                        {/* Attendance — role-based component */}
                        <Route path="/attendance" element={<AttendanceRouter />} />

                        {/* Time Off — role-based component */}
                        <Route path="/timeoff" element={<TimeOffRouter />} />
                    </Route>
                </Route>

                {/* Root redirect */}
                <Route
                    path="/"
                    element={<Navigate to={isAuthenticated ? '/dashboard' : '/signin'} replace />}
                />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </>
    );
}

export default App;