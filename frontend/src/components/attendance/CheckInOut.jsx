import React, { useState, useEffect } from 'react';
import attendanceService from '../../services/attendanceService';
import toast from 'react-hot-toast';
import { formatTime } from '../../utils/helpers';

const CheckInOut = () => {
    const [isCheckedIn, setIsCheckedIn] = useState(false);
    const [checkInTime, setCheckInTime] = useState(null);
    const [loading, setLoading] = useState(false);
    const [elapsed, setElapsed] = useState('');

    useEffect(() => {
        fetchStatus();
    }, []);

    // Update elapsed time
    useEffect(() => {
        let interval;
        if (isCheckedIn && checkInTime) {
            interval = setInterval(() => {
                const now = new Date();
                const start = new Date(checkInTime);
                const diff = Math.floor((now - start) / 1000);
                const hours = Math.floor(diff / 3600);
                const mins = Math.floor((diff % 3600) / 60);
                setElapsed(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
            }, 60000);

            // Initial calculation
            const now = new Date();
            const start = new Date(checkInTime);
            const diff = Math.floor((now - start) / 1000);
            const hours = Math.floor(diff / 3600);
            const mins = Math.floor((diff % 3600) / 60);
            setElapsed(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
        }
        return () => clearInterval(interval);
    }, [isCheckedIn, checkInTime]);

    const fetchStatus = async () => {
        try {
            const response = await attendanceService.getStatus();
            setIsCheckedIn(response.data.isCheckedIn);
            if (response.data.todayRecord?.checkIn) {
                setCheckInTime(response.data.todayRecord.checkIn);
            }
        } catch (error) {
            // Silently fail
        }
    };

    const handleCheckIn = async () => {
        setLoading(true);
        try {
            const response = await attendanceService.checkIn();
            setIsCheckedIn(true);
            setCheckInTime(response.data.attendance.checkIn);
            toast.success('Checked in successfully!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Check-in failed');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckOut = async () => {
        setLoading(true);
        try {
            await attendanceService.checkOut();
            setIsCheckedIn(false);
            setElapsed('');
            toast.success('Checked out successfully!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Check-out failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center space-x-2">
            {/* Status Dot */}
            <div className={`w-3 h-3 rounded-full ${isCheckedIn ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>

            {/* Elapsed time */}
            {isCheckedIn && elapsed && (
                <span className="text-xs text-gray-500 hidden sm:block">Since {formatTime(checkInTime)}</span>
            )}

            {/* Button */}
            <button
                onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
                disabled={loading}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${isCheckedIn
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                    : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                    }`}
            >
                {loading ? '...' : isCheckedIn ? 'Check Out →' : 'Check In →'}
            </button>
        </div>
    );
};

export default CheckInOut;