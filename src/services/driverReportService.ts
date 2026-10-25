export interface DriverHelperReport {
  id: string;
  timestamp: string;
  date?: string; // YYYY-MM-DD
  driverId: string;
  driverName: string;
  userRole?: string;
  helperName?: string;
  plateNumber: string;
  category: 'kendala_jalan' | 'akhir_kiriman' | 'istirahat' | 'update_lokasi' | 'presensi_shift' | 'pin_keamanan' | 'mode_offline';
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
  // Data Presensi Check-In & Check-Out Terpadu + PIN Keamanan
  shiftId?: string;
  checkinTimeFormatted?: string;
  checkoutTimeFormatted?: string;
  securityPin?: string;
  // Data Peringatan Aktivasi Mode Offline Kru Pengiriman
  offlineStatus?: 'masih_offline' | 'sudah_online';
  offlineActivatedAt?: string;
  onlineRestoredAt?: string;
  // Data Kendala Mengantri di Customer (Mulai Antri -> Selang Beberapa Menit Keluar dari Customer)
  customerQueueStatus?: 'sedang_mengantri' | 'selesai_antri';
  customerQueueStartIso?: string;
  customerQueueStartFormatted?: string;
  customerQueueExitFormatted?: string;
  customerQueueDurationMinutes?: number;
  customerOutletName?: string;
  // Solusi & Arahan dari SPV Logistik / Super Admin
  solution?: string;
  solutionBy?: string;
  solutionAt?: string;
  driverAcknowledged?: boolean;
  driverAcknowledgedAt?: string;
}

const STORAGE_KEY = 'akk_driver_helper_reports_v2';

export const getLocalDateStr = (input?: string | Date): string => {
  if (!input) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

class DriverReportService {
  private memoryReports: DriverHelperReport[] | null = null;
  private seqCounter = 0;

  private getInitialReports(): DriverHelperReport[] {
    const today = getLocalDateStr(new Date());
    const yesterdayDate = new Date(Date.now() - 86400000);
    const yesterday = getLocalDateStr(yesterdayDate);

    return [
      {
        id: 'REP-2026-001',
        timestamp: new Date(Date.now() - 86400000 - 1000 * 60 * 45).toISOString(),
        date: yesterday,
        driverId: 'crew-01',
        driverName: 'Zainul Agustiar',
        userRole: 'Driver',
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
        solutionAt: new Date(Date.now() - 86400000 - 1000 * 60 * 30).toISOString(),
        driverAcknowledged: true,
        driverAcknowledgedAt: new Date(Date.now() - 86400000 - 1000 * 60 * 20).toISOString()
      },
      {
        id: 'REP-2026-002',
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        date: today,
        driverId: 'crew-02',
        driverName: 'Ach Taufiq',
        userRole: 'Driver',
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
        userRole: 'Driver',
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
        userRole: 'Driver',
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
        verifiedBy: 'SPV Logistik',
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
          const seenIds = new Set<string>();
          let hadDuplicates = false;
          const normalized = parsed.map((r, index) => {
            let uniqueId = r.id || `REP-2026-${1000 + index}`;
            if (seenIds.has(uniqueId)) {
              hadDuplicates = true;
              uniqueId = `${uniqueId}-${index + 1}`;
            }
            seenIds.add(uniqueId);
            const hasSol = Boolean(r.solution && r.solution.trim());
            const isConstraintCategory = r.category === 'kendala_jalan' || r.category === 'mode_offline';
            const resolvedStatus =
              hasSol && r.status === 'pending'
                ? 'resolved'
                : !isConstraintCategory && r.status === 'pending'
                ? 'verified'
                : r.status;
            return {
              ...r,
              id: uniqueId,
              status: resolvedStatus,
              date: r.timestamp ? getLocalDateStr(new Date(r.timestamp)) : (r.date || getLocalDateStr())
            };
          });
          if (hadDuplicates) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
            } catch {}
          }
          return normalized;
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
    report: Omit<DriverHelperReport, 'id' | 'timestamp' | 'status'> & { status?: 'pending' | 'verified' | 'follow_up' | 'resolved' }
  ): DriverHelperReport {
    const list = this.getReports();
    const now = new Date();
    this.seqCounter += 1;
    let uniqueId = `REP-${now.getFullYear()}-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
    while (list.some(r => r.id === uniqueId)) {
      uniqueId = `REP-${now.getFullYear()}-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}-${this.seqCounter}`;
    }
    const isConstraintCategory = report.category === 'kendala_jalan' || report.category === 'mode_offline';
    const defaultStatus = isConstraintCategory ? 'pending' : 'verified';
    const newReport: DriverHelperReport = {
      ...report,
      id: uniqueId,
      timestamp: now.toISOString(),
      date: getLocalDateStr(now),
      status: report.status || defaultStatus
    };
    list.unshift(newReport);
    this.saveReports(list);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: newReport }));
    }
    return newReport;
  }

  /**
   * Mencatat Check-In atau menggabungkan Check-Out ke dalam satu laporan terpadu di Laporan Kiriman Kru
   */
  public upsertShiftCheckinCheckoutReport(params: {
    shiftId: string;
    driverId: string;
    driverName: string;
    userRole?: string;
    plateNumber: string;
    areaName?: string;
    checkinTimeFormatted: string;
    checkoutTimeFormatted?: string;
    securityPin?: string;
  }): DriverHelperReport {
    const list = this.getReports();
    const today = getLocalDateStr();

    // Cari laporan presensi aktif untuk shiftId atau driverId pada hari ini
    const existingIdx = list.findIndex(
      r =>
        r.category === 'presensi_shift' &&
        (r.shiftId === params.shiftId || (r.driverId === params.driverId && r.date === today && !r.checkoutTimeFormatted))
    );

    if (existingIdx >= 0) {
      const existing = list[existingIdx];
      const mergedCheckout = params.checkoutTimeFormatted || existing.checkoutTimeFormatted;
      const mergedPin = params.securityPin || existing.securityPin || '****';
      const updatedNotes = mergedCheckout
        ? `[PRESENSI SHIFT TERPADU] Check-In: ${existing.checkinTimeFormatted || params.checkinTimeFormatted} | Check-Out: ${mergedCheckout} | PIN Keamanan: ${mergedPin}`
        : `[PRESENSI CHECK-IN] Waktu Masuk: ${params.checkinTimeFormatted} (Status: Sedang Bertugas) | PIN Keamanan: ${mergedPin}`;

      list[existingIdx] = {
        ...existing,
        driverName: params.driverName || existing.driverName,
        userRole: params.userRole || existing.userRole,
        plateNumber: params.plateNumber || existing.plateNumber,
        areaName: params.areaName || existing.areaName,
        checkoutTimeFormatted: mergedCheckout,
        securityPin: mergedPin,
        notes: updatedNotes,
        status: 'verified',
        verifiedBy: 'Sistem Presensi Terpadu',
        verifiedAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      };

      this.saveReports(list);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: list[existingIdx] }));
      }
      return list[existingIdx];
    }

    const pinStr = params.securityPin || '****';
    const initialNotes = params.checkoutTimeFormatted
      ? `[PRESENSI SHIFT TERPADU] Check-In: ${params.checkinTimeFormatted} | Check-Out: ${params.checkoutTimeFormatted} | PIN Keamanan: ${pinStr}`
      : `[PRESENSI CHECK-IN] Waktu Masuk: ${params.checkinTimeFormatted} (Status: Sedang Bertugas) | PIN Keamanan: ${pinStr}`;

    return this.addReport({
      driverId: params.driverId,
      driverName: params.driverName,
      userRole: params.userRole || 'Driver',
      plateNumber: params.plateNumber || 'P 8848 U',
      category: 'presensi_shift',
      areaName: params.areaName || 'Presensi Operasional DC',
      notes: initialNotes,
      shiftId: params.shiftId,
      checkinTimeFormatted: params.checkinTimeFormatted,
      checkoutTimeFormatted: params.checkoutTimeFormatted,
      securityPin: pinStr,
      status: 'verified',
      verifiedBy: 'Sistem Presensi Terpadu'
    });
  }

  /**
   * Mencatat perubahan / pembuatan PIN Keamanan baru (2x verifikasi) ke dalam Laporan Kiriman Kru
   */
  public recordPinChangeReport(params: {
    driverId: string;
    driverName: string;
    userRole?: string;
    plateNumber: string;
    areaName?: string;
    newPin: string;
  }): DriverHelperReport {
    const list = this.getReports();
    const today = getLocalDateStr();

    // Update juga securityPin pada laporan presensi hari ini jika sudah ada
    const activeShiftIdx = list.findIndex(
      r => r.category === 'presensi_shift' && r.driverId === params.driverId && r.date === today
    );
    if (activeShiftIdx >= 0) {
      list[activeShiftIdx].securityPin = params.newPin;
      list[activeShiftIdx].notes = list[activeShiftIdx].notes.replace(
        /PIN Keamanan \(2x Verifikasi\): [0-9*]+/,
        `PIN Keamanan (2x Verifikasi): ${params.newPin}`
      );
      this.saveReports(list);
    }

    return this.addReport({
      driverId: params.driverId,
      driverName: params.driverName,
      userRole: params.userRole || 'Driver',
      plateNumber: params.plateNumber || 'P 8848 U',
      category: 'pin_keamanan',
      areaName: params.areaName || 'Keamanan Akun Kru DC',
      securityPin: params.newPin,
      notes: `[DATA PIN KEAMANAN KRU] Pengguna memperbarui / mengaktifkan PIN Keamanan (Verifikasi 2x): ${params.newPin}`,
      status: 'verified',
      verifiedBy: 'Otentikasi PIN 2x Verifikasi'
    });
  }

  public updateReportSolution(
    id: string,
    solution: string,
    solutionBy: string = 'SPV Logistik DC',
    newStatus: 'verified' | 'follow_up' | 'pending' | 'resolved' = 'resolved'
  ): boolean {
    const list = this.getReports();
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) {
      list[idx].solution = solution;
      list[idx].solutionBy = solutionBy;
      list[idx].solutionAt = new Date().toISOString();
      list[idx].status = newStatus === 'pending' ? 'resolved' : newStatus;
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

  /**
   * Mencatat siapa saja kru yang mengaktifkan Mode Offline sebagai peringatan bagi Tim Pengiriman
   * agar segera di-online-kan kembali.
   */
  public recordOfflineModeActivation(params: {
    driverId: string;
    driverName: string;
    userRole?: string;
    helperName?: string;
    plateNumber: string;
    areaName?: string;
    modeType?: 'simulasi' | 'jaringan';
  }): DriverHelperReport {
    const list = this.getReports();
    const today = getLocalDateStr();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    const existingIdx = list.findIndex(
      r =>
        r.category === 'mode_offline' &&
        r.date === today &&
        r.offlineStatus === 'masih_offline' &&
        (r.driverId === params.driverId || r.driverName.toLowerCase() === params.driverName.toLowerCase())
    );

    const warningNote = `[PERINGATAN MODE OFFLINE AKTIF] ${params.driverName} (${params.userRole || 'Driver'}${params.helperName ? ` • Helper: ${params.helperName}` : ''}) mengaktifkan Mode Offline pada pukul ${timeStr}. PERINGATAN TIM PENGIRIMAN: Harap segera di-online-kan kembali agar sinkronisasi data & GPS berjalan real-time!`;

    if (existingIdx >= 0) {
      list[existingIdx] = {
        ...list[existingIdx],
        driverName: params.driverName || list[existingIdx].driverName,
        userRole: params.userRole || list[existingIdx].userRole,
        helperName: params.helperName || list[existingIdx].helperName,
        plateNumber: params.plateNumber || list[existingIdx].plateNumber,
        areaName: params.areaName || list[existingIdx].areaName,
        offlineStatus: 'masih_offline',
        offlineActivatedAt: list[existingIdx].offlineActivatedAt || timeStr,
        onlineRestoredAt: undefined,
        notes: warningNote,
        status: 'pending',
        timestamp: now.toISOString()
      };
      this.saveReports(list);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: list[existingIdx] }));
      }
      return list[existingIdx];
    }

    return this.addReport({
      driverId: params.driverId,
      driverName: params.driverName,
      userRole: params.userRole || 'Driver',
      helperName: params.helperName,
      plateNumber: params.plateNumber || 'P 8848 U',
      category: 'mode_offline',
      areaName: params.areaName || 'Rute Pengiriman Aktif',
      offlineStatus: 'masih_offline',
      offlineActivatedAt: timeStr,
      notes: warningNote,
      status: 'pending'
    });
  }

  /**
   * Menandai bahwa kru yang sebelumnya mengaktifkan Mode Offline sudah kembali Online
   */
  public markOfflineModeRestored(params: {
    reportId?: string;
    driverId?: string;
    driverName?: string;
    restoredBy?: string;
  }): DriverHelperReport | null {
    const list = this.getReports();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    let updatedReport: DriverHelperReport | null = null;

    list.forEach((r, idx) => {
      if (r.category !== 'mode_offline') return;
      const matchById = params.reportId && r.id === params.reportId;
      const matchByDriver =
        !params.reportId &&
        r.offlineStatus === 'masih_offline' &&
        ((params.driverId && r.driverId === params.driverId) ||
          (params.driverName && r.driverName.toLowerCase() === params.driverName.toLowerCase()));

      if (matchById || matchByDriver) {
        const cleanBaseNote = r.notes.replace(/\s*\|\s*\[SUDAH ONLINE KEMBALI.*?\]/g, '');
        list[idx] = {
          ...r,
          offlineStatus: 'sudah_online',
          onlineRestoredAt: timeStr,
          status: 'verified',
          verifiedBy: params.restoredBy || 'Tim Pengiriman (Online Kembali)',
          verifiedAt: now.toISOString(),
          notes: `${cleanBaseNote} | [SUDAH ONLINE KEMBALI pukul ${timeStr} oleh ${params.restoredBy || r.driverName}]`,
          solution:
            r.solution && r.solution.trim()
              ? r.solution
              : `Mode Offline telah dimatikan dan perangkat kembali Online pada pukul ${timeStr}.`,
          solutionBy: r.solutionBy || params.restoredBy || 'Sistem Monitoring Online',
          solutionAt: r.solutionAt || now.toISOString(),
          driverAcknowledged: true,
          driverAcknowledgedAt: now.toISOString()
        };
        updatedReport = list[idx];
      }
    });

    if (updatedReport) {
      this.saveReports(list);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: updatedReport }));
        window.dispatchEvent(new CustomEvent('akk-force-online-mode'));
      }
    }
    return updatedReport;
  }

  /**
   * Mencatat ketika kru mengalami kendala sedang mengantri di customer,
   * lalu beberapa menit kemudian baru keluar dari customer tersebut.
   */
  public startCustomerQueueReport(params: {
    driverId: string;
    driverName: string;
    userRole?: string;
    helperName?: string;
    plateNumber: string;
    areaName: string;
    customerOutletName?: string;
    deliveryId?: string;
    notes?: string;
    photoUrl?: string | null;
    latitude?: number;
    longitude?: number;
    gmapsUrl?: string;
  }): DriverHelperReport {
    const list = this.getReports();
    const today = getLocalDateStr();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const outlet = params.customerOutletName || params.areaName || 'Customer / Toko Tujuan';

    const existingIdx = list.findIndex(
      r =>
        r.category === 'kendala_jalan' &&
        r.date === today &&
        r.customerQueueStatus === 'sedang_mengantri' &&
        (r.driverId === params.driverId || r.driverName.toLowerCase() === params.driverName.toLowerCase())
    );

    const queueNote = params.notes?.trim()
      ? `[ANTRI DI CUSTOMER: ${outlet}] Mulai Mengantri: ${timeStr} (Status: Sedang Mengantri di Customer) — ${params.notes.trim()}`
      : `[ANTRI DI CUSTOMER: ${outlet}] Mulai Mengantri: ${timeStr} (Status: Sedang Mengantri Bongkar/Muat di Customer, menunggu keluar dari customer).`;

    if (existingIdx >= 0) {
      list[existingIdx] = {
        ...list[existingIdx],
        areaName: params.areaName || list[existingIdx].areaName,
        customerOutletName: outlet,
        customerQueueStatus: 'sedang_mengantri',
        customerQueueStartIso: list[existingIdx].customerQueueStartIso || now.toISOString(),
        customerQueueStartFormatted: list[existingIdx].customerQueueStartFormatted || timeStr,
        photoUrl: params.photoUrl || list[existingIdx].photoUrl,
        notes: queueNote,
        timestamp: now.toISOString()
      };
      this.saveReports(list);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: list[existingIdx] }));
      }
      return list[existingIdx];
    }

    return this.addReport({
      driverId: params.driverId,
      driverName: params.driverName,
      userRole: params.userRole || 'Driver',
      helperName: params.helperName,
      plateNumber: params.plateNumber,
      category: 'kendala_jalan',
      areaName: params.areaName,
      deliveryId: params.deliveryId,
      customerOutletName: outlet,
      customerQueueStatus: 'sedang_mengantri',
      customerQueueStartIso: now.toISOString(),
      customerQueueStartFormatted: timeStr,
      notes: queueNote,
      photoUrl: params.photoUrl,
      latitude: params.latitude,
      longitude: params.longitude,
      gmapsUrl: params.gmapsUrl,
      status: 'pending'
    });
  }

  /**
   * Menyelesaikan antrean ketika kru sudah keluar dari customer setelah selang beberapa menit
   */
  public completeCustomerQueueExit(params: {
    reportId?: string;
    driverId?: string;
    driverName?: string;
    simulatedExtraMinutes?: number;
    exitNotes?: string;
  }): DriverHelperReport | null {
    const list = this.getReports();
    const now = new Date();
    let targetIdx = -1;

    if (params.reportId) {
      targetIdx = list.findIndex(r => r.id === params.reportId);
    }
    if (targetIdx < 0) {
      targetIdx = list.findIndex(
        r =>
          r.customerQueueStatus === 'sedang_mengantri' &&
          ((params.driverId && r.driverId === params.driverId) ||
            (params.driverName && r.driverName.toLowerCase() === params.driverName.toLowerCase()))
      );
    }

    if (targetIdx < 0) return null;

    const existing = list[targetIdx];
    const startMs = existing.customerQueueStartIso ? new Date(existing.customerQueueStartIso).getTime() : new Date(existing.timestamp).getTime();
    const extraMs = (params.simulatedExtraMinutes || 0) * 60000;
    const effectiveExitDate = new Date(Math.max(now.getTime(), startMs + 60000) + extraMs);
    const durationMin = Math.max(1, Math.round((effectiveExitDate.getTime() - startMs) / 60000));

    const startFormatted =
      existing.customerQueueStartFormatted ||
      new Date(startMs).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const exitFormatted =
      effectiveExitDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const outlet = existing.customerOutletName || existing.areaName || 'Customer';

    const extraNoteText = params.exitNotes?.trim() ? ` | Catatan Keluar: ${params.exitNotes.trim()}` : '';
    const updatedNotes = `[SELESAI ANTRI & KELUAR DARI CUSTOMER: ${outlet}] Mulai Antri: ${startFormatted} ➔ Keluar dari Customer: ${exitFormatted} (Selang Waktu Mengantri: ${durationMin} Menit)${extraNoteText}`;

    list[targetIdx] = {
      ...existing,
      customerQueueStatus: 'selesai_antri',
      customerQueueStartFormatted: startFormatted,
      customerQueueExitFormatted: exitFormatted,
      customerQueueDurationMinutes: durationMin,
      notes: updatedNotes,
      status: existing.solution && existing.solution.trim() ? 'resolved' : 'verified',
      verifiedBy: existing.verifiedBy || 'Konfirmasi Keluar Customer (Kru)',
      verifiedAt: now.toISOString()
    };

    this.saveReports(list);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: list[targetIdx] }));
    }
    return list[targetIdx];
  }

  public submitReport(params: {
    driverId: string;
    driverName: string;
    driverPhone?: string;
    plateNumber: string;
    category: 'kendala_jalan' | 'akhir_kiriman' | 'istirahat' | 'update_lokasi' | 'presensi_shift' | 'pin_keamanan' | 'mode_offline';
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
