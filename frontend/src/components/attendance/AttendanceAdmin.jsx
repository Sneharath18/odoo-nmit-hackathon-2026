import React, { useState, useEffect } from 'react';
import attendanceService from '../../services/attendanceService';
import LoadingSpinner from '../common/LoadingSpinner';
import StatusBadge from '../common/StatusBadge';
import { formatDate, formatTime } from '../../utils/helpers';
import { HiChevronLeft, HiChevronRight, HiSearch } from 'react-icons/hi';

const AttendanceAdmin = () => {
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState('day'); // day or month
    const [pagination, setPagination] = useState({});

    useEffect(() => {
        fetchAttendance();
    }, [selectedDate, viewMode]);

    const fetchAttendance = async () => {
        try {
            setLoading(true);
            const params = { date: selectedDate };
            const response = await attendanceService.getAllAttendance(params);
            setAttendance(response.data.attendance);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error('Failed to fetch attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const changeDate = (direction) => {
        const current = new Date(selectedDate);
        current.setDate(current.getDate() + direction);
        setSelectedDate(current.toISOString().split('T')[0]);
    };

    const filteredAttendance = attendance.filter(record => {
        if (!search) return true;
        const name = `${record.employee?.firstName} ${record.employee?.lastName}`.toLowerCase();
        return name.includes(search.toLowerCase());
    });

    return (
        <div>
            <h1 className="page-title mb-6">Attendance</h1>

            {/* Controls */}
            <div className="card mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* Date Navigation */}
                    <div className="flex items-center space-x-3">
                        <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
                            <HiChevronLeft className="w-5 h-5" />
                        </button>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="input-field w-auto"
                        />
                        <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-100 rounded-lg">
                            <HiChevronRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode(viewMode === 'day' ? 'month' : 'day')}
                            className="btn-secondary text-sm"
                        >
                            {viewMode === 'day' ? 'Day' : 'Month'}
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <HiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search employee..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input-field pl-9"
                        />
                    </div>
                </div>
            </div>

            {/* Date Header */}
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                    {formatDate(selectedDate, 'EEEE, dd MMMM yyyy')}
                </h2>
                <p className="text-sm text-gray-500">{pagination.total || 0} records</p>
            </div>

            {/* Table */}
            {loading ? (
                <LoadingSpinner />
            ) : filteredAttendance.length === 0 ? (
                <div className="card text-center py-8">
                    <p className="text-gray-500">No attendance records found</p>
                </div>
            ) : (
                <div className="card overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="table-header">
                                <th className="px-4 py-3">Employee</th>
                                <th className="px-4 py-3">Check In</th>
                                <th className="px-4 py-3">Check Out</th>
                                <th className="px-4 py-3">Work Hours</th>
                                <th className="px-4 py-3">Extra Hours</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredAttendance.map((record) => (
                                <tr key={record._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-medium text-primary-700">
                                                {record.employee?.firstName?.charAt(0)}{record.employee?.lastName?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{record.employee?.firstName} {record.employee?.lastName}</p>
                                                <p className="text-xs text-gray-500">{record.employee?.employeeCode}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm">{formatTime(record.checkIn)}</td>
                                    <td className="px-4 py-3 text-sm">{formatTime(record.checkOut)}</td>
                                    <td className="px-4 py-3 text-sm font-medium">
                                        {record.workHours ? `${record.workHours.toFixed(2)}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {record.extraHours > 0 ? (
                                            <span className="text-green-600 font-medium">+{record.extraHours.toFixed(2)}</span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={record.status} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AttendanceAdmin;