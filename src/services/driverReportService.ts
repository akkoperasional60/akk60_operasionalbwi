export interface DriverHelperReport {
  id: string;
  timestamp: string;
  date?: string; // YYYY-MM-DD
  driverId: string;
  driverName: string;
  helperName?: string;
  plateNumber: string;
  category: 'kendala_jalan' | 'akhir_kiriman' | 'istirahat' | 'update_lokasi';
  areaName: string;
  deliveryId?: string;
  notes: string;
  photoUrl?: string | null;
  latitude?: number;
  longitude?: number;
  gmapsUrl?: string;
  status: 'pending' | 'verified' | 'follow_up' | 'resolved';
  verifiedBy?: string;
  verifiedAt?: string;
  // 💡 Solusi & Arahan dari SPV Logistik / Super Admin
  solution?: string;
  solutionBy?: string;
  solutionAt?: string;
  driverAcknowledged?: boolean;
  driverAcknowledgedAt?: string;
}

const STORAGE_KEY = 'akk_driver_helper_reports_v2';

class DriverReportService {
  private memoryReports: DriverHelperReport[] | null = null;

  private getInitialReports(): DriverHelperReport[] {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    return [
      {
        id: 'REP-2026-001',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        date: today,
        driverId: 'crew-01',
        driverName: 'Zainul Agustiar',
        helperName: 'Rifaldi Aminullah',
        plateNumber: 'P 8125 VC',
        category: 'kendala_jalan',
        areaName: 'SUSULAN ROGOJAMPI (Banyuwangi)',
        notes: 'Terjadi antrean padat di persimpangan Rogojampi akibat pasar tumpah pagi hari, estimasi keterlambatan tiba di titik bongkar sekitar 20 menit.',
        photoUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
        latitude: -8.3075,
        longitude: 114.2975,
        gmapsUrl: 'https://www.google.com/maps?q=-8.3075,114.2975',
        status: 'follow_up',
        solution: 'Gunakan jalur alternatif lingkar barat Rogojampi tembus Gladag. SPV sudah mengabari PIC toko bahwa kiriman mundur 20 menit namun tetap tiba sebelum jam 10 pagi.',
        solutionBy: 'Muhammad Syaiful Bahri (SPV Logistik)',
        solutionAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        driverAcknowledged: true,
        driverAcknowledgedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString()
      },
      {
        id: 'REP-2026-002',
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        date: today,
        driverId: 'crew-02',
        driverName: 'Ach Taufiq',
        helperName: 'Budi Santoso',
        plateNumber: 'P 8848 U',
        category: 'kendala_jalan',
        areaName: 'GENTENG WETAN (Banyuwangi)',
        notes: 'Akses jembatan masuk sedang diperbaiki satu jalur buka-tutup. Membutuhkan izin lewat rute jalan alternatif atau tunggu 30 menit.',
        photoUrl: 'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=600&auto=format&fit=crop&q=80',
        latitude: -8.3580,
        longitude: 114.1550,
        gmapsUrl: 'https://www.google.com/maps?q=-8.3580,114.1550',
        status: 'pending',
        solution: '',
        solutionBy: '',
        driverAcknowledged: false
      },
      {
        id: 'REP-2026-003',
        timestamp: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
        date: today,
        driverId: 'crew-02',
        driverName: 'Ach Taufiq',
        helperName: 'Budi Santoso',
        plateNumber: 'P 8848 U',
        category: 'akhir_kiriman',
        areaName: 'RITEL SRONO (Banyuwangi)',
        notes: 'Seluruh karton box telah selesai dibongkar di gudang toko retail mitra dalam kondisi utuh dan baik, diterima oleh Pak Wahyu (PIC Toko).',
        photoUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
        latitude: -8.3980,
        longitude: 114.2650,
        gmapsUrl: 'https://www.google.com/maps?q=-8.3980,114.2650',
        status: 'verified',
        verifiedBy: 'SPV Logistik DC',
        verifiedAt: new Date(Date.now() - 1000 * 60 * 300).toISOString()
      },
      {
        id: 'REP-2026-004',
        timestamp: new Date(Date.now() - 86400000 - 1000 * 60 * 120).toISOString(),
        date: yesterday,
        driverId: 'crew-03',
        driverName: 'Hendra Setiawan',
        helperName: 'Agus Purnomo',
        plateNumber: 'DK 8214 AB',
        category: 'update_lokasi',
        areaName: 'SEMPU KALISTAIL (Banyuwangi)',
        notes: 'Posisi armada sedang melintasi jalur alternatif Genteng - Kalistail untuk menghindari penutupan jalan perbaikan jembatan.',
        photoUrl: 'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=600&auto=format&fit=crop&q=80',
        latitude: -8.3650,
        longitude: 114.1530,
        gmapsUrl: 'https://www.google.com/maps?q=-8.3650,114.1530',
        status: 'verified',
        verifiedBy: 'Dispatcher DC',
        verifiedAt: new Date(Date.now() - 86400000 - 1000 * 60 * 60).toISOString()
      }
    ];
  }

  private getStoredReports(): DriverHelperReport[] {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed: DriverHelperReport[] = JSON.parse(data);
          return parsed.map(r => ({
            ...r,
            date: r.date || (r.timestamp ? r.timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10))
          }));
        }
        const init = this.getInitialReports();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(init));
        return init;
      } catch (e) {
        console.warn('Failed to read from localStorage:', e);
      }
    }
    if (!this.memoryReports) {
      this.memoryReports = this.getInitialReports();
    }
    return this.memoryReports;
  }

  private saveReports(list: DriverHelperReport[]): void {
    this.memoryReports = list;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
      }
    }
  }

  public getReports(): DriverHelperReport[] {
    return this.getStoredReports();
  }

  public addReport(
    report: Omit<DriverHelperReport, 'id' | 'timestamp' | 'status'>
  ): DriverHelperReport {
    const list = this.getReports();
    const now = new Date();
    const newReport: DriverHelperReport = {
      ...report,
      id: `REP-${now.getFullYear()}-${Date.now().toString().slice(-5)}`,
      timestamp: now.toISOString(),
      date: now.toISOString().slice(0, 10),
      status: 'pending'
    };
    list.unshift(newReport);
    this.saveReports(list);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: newReport }));
    }
    return newReport;
  }

  public updateReportSolution(
    id: string,
    solution: string,
    solutionBy: string = 'SPV Logistik DC',
    newStatus: 'verified' | 'follow_up' | 'pending' | 'resolved' = 'follow_up'
  ): boolean {
    const list = this.getReports();
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) {
      list[idx].solution = solution;
      list[idx].solutionBy = solutionBy;
      list[idx].solutionAt = new Date().toISOString();
      list[idx].status = newStatus;
      list[idx].driverAcknowledged = false;
      this.saveReports(list);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: list[idx] }));
      }
      return true;
    }
    return false;
  }

  public acknowledgeReportSolution(id: string): boolean {
    const list = this.getReports();
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) {
      list[idx].driverAcknowledged = true;
      list[idx].driverAcknowledgedAt = new Date().toISOString();
      this.saveReports(list);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: list[idx] }));
      }
      return true;
    }
    return false;
  }

  public updateReportStatus(
    id: string,
    status: 'verified' | 'follow_up' | 'pending' | 'resolved',
    verifiedBy: string = 'SPV Logistik'
  ): boolean {
    const list = this.getReports();
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) {
      list[idx].status = status;
      list[idx].verifiedBy = verifiedBy;
      list[idx].verifiedAt = new Date().toISOString();
      this.saveReports(list);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: list[idx] }));
      }
      return true;
    }
    return false;
  }

  public deleteReport(id: string): boolean {
    const list = this.getReports();
    const filtered = list.filter(r => r.id !== id);
    this.saveReports(filtered);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-report-updated'));
    }
    return true;
  }

  public submitReport(params: {
    driverId: string;
    driverName: string;
    driverPhone?: string;
    plateNumber: string;
    category: 'kendala_jalan' | 'akhir_kiriman' | 'istirahat' | 'update_lokasi';
    reportText?: string;
    notes?: string;
    latitude?: number;
    longitude?: number;
    locationName?: string;
    areaName?: string;
    helperName?: string;
    photoUrl?: string;
  }): DriverHelperReport {
    return this.addReport({
      driverId: params.driverId,
      driverName: params.driverName,
      helperName: params.helperName,
      plateNumber: params.plateNumber,
      category: params.category,
      areaName: params.areaName || params.locationName || 'Lokasi Kendala Lapangan',
      notes: params.notes || params.reportText || '',
      latitude: params.latitude,
      longitude: params.longitude,
      photoUrl: params.photoUrl
    });
  }

  public resolveReport(
    id: string,
    solution: string,
    solutionBy: string = 'SPV Logistik DC'
  ): DriverHelperReport | null {
    const success = this.updateReportSolution(id, solution, solutionBy, 'resolved');
    if (success) {
      return this.getReports().find(r => r.id === id) || null;
    }
    return null;
  }
}

export const driverReportService = new DriverReportService();
