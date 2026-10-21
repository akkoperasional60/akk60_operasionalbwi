import { AttendanceRecord } from '../types';

// Mock service for attendance management
// In a real app, this would connect to a backend API/Firebase
const mockAttendance: AttendanceRecord[] = [
  // Example: Crew member 1 (crw-01) is absent today (2026-09-23)
  { id: 'att-1', crewId: 'crw-01', date: '2026-09-23', status: 'absent', reason: 'Ijin Sakit' },
  { id: 'att-2', crewId: 'crw-01', date: '2026-09-22', status: 'absent', reason: 'Ijin Sakit' },
  { id: 'att-3', crewId: 'crw-01', date: '2026-09-21', status: 'absent', reason: 'Ijin Sakit' },
  { id: 'att-4', crewId: 'crw-01', date: '2026-09-20', status: 'absent', reason: 'Ijin Sakit' },
];

export const attendanceService = {
  getAttendanceByDate: (date: string): AttendanceRecord[] => {
    return mockAttendance.filter(record => record.date === date);
  },
  
  addAttendanceRecord: (record: AttendanceRecord): void => {
    mockAttendance.push(record);
  },

  getAllAttendanceRecords: (): AttendanceRecord[] => {
    return mockAttendance;
  },
  
  isCrewAvailable: (crewId: string, date: string): boolean => {
    const records = mockAttendance.filter(record => record.date === date);
    const record = records.find(r => r.crewId === crewId);
    return !record || record.status === 'present';
  },

  getAttendanceStatus: (crewId: string, date: string): AttendanceRecord | undefined => {
    return mockAttendance.find(record => record.crewId === crewId && record.date === date);
  }
};
