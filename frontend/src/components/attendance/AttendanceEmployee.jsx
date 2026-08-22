import React, { useState, useEffect } from 'react';
import attendanceService from '../../services/attendanceService';
import LoadingSpinner from '../common/LoadingSpinner';
import StatusBadge from '../common/StatusBadge';
import { formatDate, formatTime } from '../../utils/helpers';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';

const AttendanceEmployee = () => {
    const [attendance, setAttendance] = useState([]);
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    useEffect(() => {
        fetchAttendance();
    }, [currentMonth, currentYear]);

    const fetchAttendance = async () => {
        try {
            setLoading(true);
            const response = await attendanceService.getMyAttendance({
                month: currentMonth,
                year: currentYear
            });
            setAttendance(response.data.attendance);
            setSummary(response.data.summary);
        } catch (error) {
            console.error('Failed to fetch attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const prevMonth = () => {
        if (currentMonth === 1) {
            setCurrentMonth(12);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const nextMonth = () => {
        if (currentMonth === 12) {
            setCurrentMonth(1);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return (
        <div>
            <h1 className="page-title mb-6">Attendance</h1>

            {/* Navigation & Summary */}
            <div className="card mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* Month Navigation */}
                    <div className="flex items-center space-x-3">
                        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                            <HiChevronLeft className="w-5 h-5" />
                        </button>
                        <h2 className="text-lg font-semibold">
                            {monthNames[currentMonth - 1]} {currentYear}
                        </h2>
                        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                            <HiChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Summary Stats */}
                    <div className="flex flex-wrap gap-4">
                        <SummaryBadge label="Days Present" value={summary.presentDays || 0} color="green" />
                        <SummaryBadge label="Leaves" value={summary.leaveDays || 0} color="blue" />
                        <SummaryBadge label="Total Working" value={summary.totalWorkingDays || 0} color="gray" />
                    </div>
                </div>
            </div>

            {/* Attendance Table */}
            {loading ? (
                <LoadingSpinner />
            ) : attendance.length === 0 ? (
                <div className="card text-center py-8">
                    <p className="text-gray-500">No attendance records for this month</p>
                </div>
            ) : (
                <div className="card overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="table-header">
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Check In</th>
                                <th className="px-4 py-3">Check Out</th>
                                <th className="px-4 py-3">Work Hours</th>
                                <th className="px-4 py-3">Extra Hours</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {attendance.map((record) => (
                                <tr key={record._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium">{formatDate(record.date)}</td>
                                    <td className="px-4 py-3 text-sm">{formatTime(record.checkIn)}</td>
                                    <td className="px-4 py-3 text-sm">{formatTime(record.checkOut)}</td>
                                    <td className="px-4 py-3 text-sm font-medium">
                                        {record.workHours ? `${record.workHours.toFixed(2)} hrs` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {record.extraHours > 0 ? (
                                            <span className="text-green-600 font-medium">+{record.extraHours.toFixed(2)} hrs</span>
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

const SummaryBadge = ({ label, value, color }) => {
    const colors = {
        green: 'bg-green-50 text-green-700 border-green-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        gray: 'bg-gray-50 text-gray-700 border-gray-200',
        red: 'bg-red-50 text-red-700 border-red-200'
    };

    return (
        <div className={`px-3 py-1.5 rounded-lg border text-sm ${colors[color]}`}>
            <span className="font-medium">{value}</span>{' '}
            <span className="text-xs opacity-75">{label}</span>
        </div>
    );
};

export default AttendanceEmployee;