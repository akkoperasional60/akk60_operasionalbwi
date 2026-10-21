import { DriverShiftCheckin, ShiftVerificationMethod } from '../types';
import { getSupabaseClient } from './supabaseService';

const SHIFTS_STORAGE_KEY = 'akk_driver_shifts_v2';
const PINS_STORAGE_KEY = 'akk_driver_pins_v2';

class DriverShiftService {
  /**
   * Get all recorded shifts from storage
   */
  public getShifts(): DriverShiftCheckin[] {
    try {
      const raw = localStorage.getItem(SHIFTS_STORAGE_KEY);
      if (!raw) {
        // Return sample initial shift for primary driver
        const today = new Date().toISOString().split('T')[0];
        const sample: DriverShiftCheckin[] = [
          {
            id: `SHIFT-INIT-1`,
            driverId: 'crew-01',
            driverName: 'Ach Taufiq',
            fleetId: 'fl-01',
            plateNumber: 'P 8848 U',
            vehicleType: 'Engkel Long Box',
            date: today,
            checkinTime: new Date(Date.now() - 3600000 * 3).toISOString(),
            checkinTimeFormatted: '06:30 WIB',
            verificationMethod: 'biometric',
            biometricType: 'fingerprint',
            locationName: 'DC PT. Anugrah Kemasan Kreatif - Sukowidi Banyuwangi',
            latitude: -8.1906,
            longitude: 114.3708,
            status: 'checked_in',
            shiftName: 'Shift Pagi Operasional (06:00 - 15:00 WIB)',
            odometerStartKm: 124580,
            notes: 'Check-in sidik jari berhasil di gerbang DC Banyuwangi.',
            synced: true,
            createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
          }
        ];
        localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(sample));
        return sample;
      }
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Get active shift for specific driver today (status !== 'checked_out')
   */
  public getActiveShift(driverId: string): DriverShiftCheckin | null {
    const today = new Date().toISOString().split('T')[0];
    const shifts = this.getShifts();
    
    // Find today's active shift for this driver
    const active = shifts.find(
      s => s.driverId === driverId && s.date === today && s.status !== 'checked_out'
    );

    return active || null;
  }

  /**
   * Verify driver PIN (defaults to '1234' if none configured)
   */
  public verifyPin(driverId: string, inputPin: string): boolean {
    try {
      const rawPins = localStorage.getItem(PINS_STORAGE_KEY);
      const pins: Record<string, string> = rawPins ? JSON.parse(rawPins) : {};
      const expectedPin = pins[driverId] || '1234';
      return inputPin.trim() === expectedPin.trim();
    } catch {
      return inputPin.trim() === '1234';
    }
  }

  /**
   * Set or update custom PIN for a driver
   */
  public setPin(driverId: string, newPin: string): boolean {
    try {
      const rawPins = localStorage.getItem(PINS_STORAGE_KEY);
      const pins: Record<string, string> = rawPins ? JSON.parse(rawPins) : {};
      pins[driverId] = newPin.trim();
      localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(pins));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check in driver with Biometric or PIN verification and log entry timestamp
   */
  public async checkInDriver(params: {
    driverId: string;
    driverName: string;
    fleetId?: string;
    plateNumber?: string;
    vehicleType?: string;
    verificationMethod: ShiftVerificationMethod;
    biometricType?: 'fingerprint' | 'face_id';
    pin?: string;
    shiftName?: string;
    odometerStartKm?: number;
    notes?: string;
  }): Promise<{ success: boolean; shift?: DriverShiftCheckin; message: string }> {
    // 1. PIN verification check if PIN method is used
    if (params.verificationMethod === 'pin') {
      if (!params.pin || !this.verifyPin(params.driverId, params.pin)) {
        return {
          success: false,
          message: 'PIN verifikasi tidak sesuai. Gunakan PIN default 1234 atau sesuaikan di profil.'
        };
      }
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeFormatted = `${hours}:${minutes} WIB`;

    const newShift: DriverShiftCheckin = {
      id: `SHIFT-${Date.now()}-${Math.floor(Math.random() * 899 + 100)}`,
      driverId: params.driverId,
      driverName: params.driverName,
      fleetId: params.fleetId,
      plateNumber: params.plateNumber || 'P 8848 U',
      vehicleType: params.vehicleType || 'Engkel Long Box',
      date: dateStr,
      checkinTime: now.toISOString(),
      checkinTimeFormatted: timeFormatted,
      verificationMethod: params.verificationMethod,
      biometricType: params.biometricType || (params.verificationMethod === 'biometric' ? 'fingerprint' : undefined),
      locationName: 'DC PT. Anugrah Kemasan Kreatif - Sukowidi Banyuwangi',
      latitude: -8.1906,
      longitude: 114.3708,
      status: 'checked_in',
      shiftName: params.shiftName || 'Shift Pagi Operasional (06:00 - 15:00 WIB)',
      odometerStartKm: params.odometerStartKm || 124500,
      notes: params.notes || `Presensi masuk resmi via verifikasi ${params.verificationMethod === 'biometric' ? 'Biometrik' : 'PIN'}.`,
      synced: false,
      createdAt: now.toISOString()
    };

    // 2. Persist to Local Storage
    const shifts = this.getShifts();
    shifts.unshift(newShift);
    localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));

    // 3. Attempt Supabase Remote Sync
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.from('attendance').insert([
          {
            crew_id: params.driverId,
            date: dateStr,
            status: 'present',
            reason: `Shift Check-in (${params.verificationMethod}) ${timeFormatted}`
          }
        ]);
        if (!error) {
          newShift.synced = true;
          // Update synced status in local storage
          localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));
        }
      } catch (err) {
        console.warn('Supabase attendance sync error (saved locally):', err);
      }
    }

    // 4. Notify Listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-shift-updated', { detail: newShift }));
    }

    return {
      success: true,
      shift: newShift,
      message: `Presensi masuk berhasil! Shift dimulai pukul ${timeFormatted}.`
    };
  }

  /**
   * Check out driver / end shift
   */
  public async checkOutDriver(driverId: string, notes?: string): Promise<{ success: boolean; message: string }> {
    const shifts = this.getShifts();
    const active = shifts.find(s => s.driverId === driverId && s.status !== 'checked_out');

    if (!active) {
      return { success: false, message: 'Tidak ditemukan shift aktif yang sedang berjalan.' };
    }

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    active.status = 'checked_out';
    active.checkoutTime = now.toISOString();
    active.checkoutTimeFormatted = `${hours}:${minutes} WIB`;
    if (notes) {
      active.notes = (active.notes ? active.notes + ' | ' : '') + `Checkout: ${notes}`;
    }

    localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-shift-updated', { detail: active }));
    }

    return {
      success: true,
      message: `Shift selesai pada pukul ${active.checkoutTimeFormatted}. Terima kasih atas kerja keras Anda!`
    };
  }
}

export const driverShiftService = new DriverShiftService();
