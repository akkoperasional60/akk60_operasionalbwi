import {
  Schedule,
  OutboundWaybill,
  OutboundWaybillStatus,
  OutboundWaybillCargoItem
} from '../types';
import { logisticsStore } from './store';

const STORAGE_KEY = 'akk_driver_outbound_waybills_v2';

class DriverWaybillService {
  /**
   * Derive a structured Outbound Waybill (Surat Jalan Keluar) from a delivery Schedule
   */
  public generateWaybillFromSchedule(schedule: Schedule): OutboundWaybill {
    const rawDate = schedule.departureDate || new Date().toISOString().split('T')[0];
    const dateFormatted = rawDate.replace(/-/g, '/');
    const cleanNum = schedule.id.replace(/\D/g, '').slice(-4) || '1024';
    const waybillNumber = `SJ-OUT/AKK/${dateFormatted.slice(0, 7)}/${cleanNum}`;

    // Calculate box quantities based on ton capacity or description
    const weightTon = schedule.cargoWeightTon || 2.5;
    const totalWeightKg = Math.round(weightTon * 1000);
    const estKoli = Math.round(totalWeightKg / 14); // Average ~14kg per corrugated carton box

    const cargoItems: OutboundWaybillCargoItem[] = [
      {
        id: `cargo-${schedule.id}-1`,
        itemCode: 'BOX-CB-A1',
        description: `${schedule.cargoDescription || 'Karton Box Corrugated'} (Standar Industri PT AKK)`,
        boxDimensions: '40 x 30 x 28 cm',
        quantity: Math.round(estKoli * 0.65),
        unit: 'Koli',
        weightKg: Math.round(totalWeightKg * 0.65),
        notes: 'Double Wall (K200/M150/K200)'
      },
      {
        id: `cargo-${schedule.id}-2`,
        itemCode: 'BOX-CB-B2',
        description: 'Karton Box Custom Cetak Logo (Die-Cut Inner Box)',
        boxDimensions: '32 x 22 x 18 cm',
        quantity: Math.round(estKoli * 0.35),
        unit: 'Koli',
        weightKg: Math.round(totalWeightKg * 0.35),
        notes: 'Single Wall High Density'
      }
    ];

    const sealNumber = `SEAL-AKK-${cleanNum.padStart(4, '0')}`;

    // Map schedule status to waybill status
    let status: OutboundWaybillStatus = 'checker_verified';
    if (schedule.status === 'scheduled') {
      status = 'checker_verified';
    } else if (schedule.status === 'picked_up') {
      status = 'gate_out';
    } else if (schedule.status === 'in_transit') {
      status = 'in_transit';
    } else if (schedule.status === 'delivered') {
      status = 'delivered';
    }

    const statusLabels: Record<OutboundWaybillStatus, string> = {
      draft: 'Draft Manifest',
      loading: 'Proses Pemuatan (Loading Bay)',
      sealed: 'Segel Terpasang',
      checker_verified: 'Diverifikasi Checker Gudang',
      gate_out: 'Gate-Out Gerbang DC (Berangkat)',
      in_transit: 'Dalam Perjalanan Pengantaran',
      delivered: 'Diterima Toko (Selesai)'
    };

    const crewName = schedule.crew?.name || 'Ach Taufiq';
    const crewPhone = schedule.crew?.phone || '0812-3456-7890';
    const fleetPlate = schedule.fleet?.plateNumber || 'P 8848 U';
    const fleetType = schedule.fleet?.vehicleType || 'Engkel Long Box';

    return {
      id: `WB-${schedule.id}`,
      waybillNumber,
      scheduleId: schedule.id,
      trackingNumber: schedule.trackingNumber,
      poNumber: `PO-AKK-${cleanNum}`,
      date: rawDate,
      gateOutTime: '07:30 WIB',
      estimatedArrival: schedule.estimatedArrival || '14:00 WIB',
      originWarehouse: {
        name: 'Distribution Center (DC) PT Anugrah Kemasan Kreatif',
        address: 'Kawasan Pergudangan Logistik Industri Banyuwangi KM 12, Jawa Timur',
        phone: '(0333) 412890',
        gateNumber: 'Gate Keluar Outbound Bay 03'
      },
      destination: {
        storeName: schedule.store?.storeName || schedule.areaName || 'Toko Mitra Distribusi',
        areaName: schedule.areaName || schedule.store?.city || 'Area Banyuwangi & Sekitarnya',
        city: schedule.store?.city || 'Banyuwangi',
        province: schedule.store?.province || 'Jawa Timur',
        address: schedule.store?.address || 'Jl. Raya Distribusi Logistik No. 45',
        contactPerson: schedule.store?.contactPerson || 'Bpk. Herman (Staff Penerima Gudang)',
        phone: schedule.store?.phone || '0821-9876-5432'
      },
      fleet: {
        id: schedule.fleetId,
        plateNumber: fleetPlate,
        vehicleType: fleetType,
        initialCode: schedule.fleet?.initialCode || 'WB-01'
      },
      crew: {
        driverId: schedule.crewId,
        driverName: crewName,
        driverPhone: crewPhone,
        licenseType: schedule.crew?.licenseType || 'SIM B1 Umum',
        helperName: schedule.crewHelper?.name || 'Budi Santoso',
        helper2Name: schedule.crewHelper2?.name
      },
      cargoItems,
      totalKoli: estKoli,
      totalWeightKg,
      securitySealNumber: sealNumber,
      status,
      statusLabel: statusLabels[status],
      checkerName: 'Rahmat Hidayat (Checker Outbound DC)',
      checkerNotes: 'Karton box kering, kondisi segel utuh, muatan disusun stabil sesuai SOP distribusi PT AKK.',
      driverNotes: schedule.notes || '',
      signedByDriver: true,
      signedByDriverAt: `${rawDate} 07:15 WIB`,
      signedByChecker: true,
      signedByCheckerAt: `${rawDate} 07:25 WIB`,
      // 4 Role-based digital signatures
      preparedByName: 'MUHAMMAD SYAIFUL BAHRI',
      preparedBySigned: true,
      preparedBySignedAt: `${rawDate} 07:10 WIB`,
      acknowledgedByName: 'Hadi Purnomo',
      acknowledgedBySigned: true,
      acknowledgedBySignedAt: `${rawDate} 07:20 WIB`,
      securityOfficerName: 'Slamet Riyadi (Security)',
      securitySigned: true,
      securitySignedAt: `${rawDate} 07:30 WIB`,
      driverSigned: true,
      driverSignedAt: `${rawDate} 07:35 WIB`,
      qrCodeData: `PT_AKK|${waybillNumber}|${fleetPlate}|${sealNumber}|${rawDate}`,
      synced: true,
      createdAt: schedule.createdAt || new Date().toISOString()
    };
  }

  public getStoredWaybills(): Record<string, OutboundWaybill> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  public saveWaybill(waybill: OutboundWaybill): void {
    try {
      const existing = this.getStoredWaybills();
      existing[waybill.id] = waybill;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (err) {
      console.error('Failed to save waybill to localStorage:', err);
    }
  }

  public getWaybillForSchedule(schedule: Schedule): OutboundWaybill {
    const stored = this.getStoredWaybills();
    const key = `WB-${schedule.id}`;
    if (stored[key]) {
      return stored[key];
    }
    const generated = this.generateWaybillFromSchedule(schedule);
    stored[key] = generated;
    this.saveWaybill(generated);
    return generated;
  }

  public getWaybillsForDriver(driverId: string, schedules: Schedule[]): OutboundWaybill[] {
    const driverSchedules = schedules.filter(
      s => s.crewId === driverId || (s.crew && s.crew.id === driverId)
    );

    return driverSchedules.map(sch => this.getWaybillForSchedule(sch));
  }

  public updateWaybillStatus(
    waybillId: string,
    status: OutboundWaybillStatus,
    notes?: string
  ): boolean {
    try {
      const stored = this.getStoredWaybills();
      if (!stored[waybillId]) return false;

      const statusLabels: Record<OutboundWaybillStatus, string> = {
        draft: 'Draft Manifest',
        loading: 'Proses Pemuatan (Loading Bay)',
        sealed: 'Segel Terpasang',
        checker_verified: 'Diverifikasi Checker Gudang',
        gate_out: 'Gate-Out Gerbang DC (Berangkat)',
        in_transit: 'Dalam Perjalanan Pengantaran',
        delivered: 'Diterima Toko (Selesai)'
      };

      stored[waybillId].status = status;
      stored[waybillId].statusLabel = statusLabels[status];
      if (notes) {
        stored[waybillId].driverNotes = notes;
      }
      if (status === 'gate_out') {
        const now = new Date();
        stored[waybillId].gateOutTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
        try {
          const wb = stored[waybillId];
          logisticsStore.recordGateOut(
            wb.scheduleId,
            wb.fleet.plateNumber,
            wb.crew.driverName,
            wb.destination.storeName || wb.destination.areaName,
            wb.fleet.initialCode
          );
        } catch (err) {
          console.warn('[WaybillService] Failed to record gate out to security:', err);
        }
      }
      this.saveWaybill(stored[waybillId]);
      return true;
    } catch {
      return false;
    }
  }
}

export const driverWaybillService = new DriverWaybillService();
