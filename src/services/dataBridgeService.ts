import { getSupabaseClient, sanitizeSupabaseUrl } from './supabaseService';
import { googleSheetsApiService, ParsedSheetTrip } from './googleSheetsApiService';
import { logisticsStore } from './store';
import { RetailStore, Schedule, Fleet, Crew } from '../types';
import { standardizeAreaName } from '../utils/areaNormalizer';
import { scheduleImportValidator } from './scheduleImportValidator';

export interface DataBridgeConfig {
  isEnabled: boolean;
  intervalMinutes: number; // 5, 10, 15, 30, 60
  sheetTitle: string; // default: 'ALL'
  spreadsheetId: string;
  syncStores: boolean;
  syncSchedules: boolean;
  syncFleets: boolean;
  syncCrews: boolean;
  lastSyncTimestamp: string | null;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'warning' | 'error';
  lastSyncMessage: string | null;
  serviceRoleKey?: string;
}

export interface DataBridgeSyncResult {
  success: boolean;
  timestamp: string;
  durationMs: number;
  storesUpserted: number;
  schedulesUpserted: number;
  fleetsUpserted: number;
  crewsUpserted: number;
  status: 'success' | 'warning' | 'error';
  message: string;
  rlsWarning?: boolean;
  tableMissingWarning?: boolean;
  details?: Record<string, any>;
}

export interface DataBridgeLogEntry {
  id: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
  storesCount: number;
  schedulesCount: number;
  fleetsCount: number;
  crewsCount: number;
  message: string;
  triggerSource: string;
  durationMs: number;
}

const CONFIG_STORAGE_KEY = 'akk_databridge_config_v1';
const LOGS_STORAGE_KEY = 'akk_databridge_logs_v1';

class DataBridgeService {
  private config: DataBridgeConfig;
  private logs: DataBridgeLogEntry[] = [];
  private timerId: any = null;
  private isSyncing: boolean = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.config = this.loadConfig();
    this.logs = this.loadLogs();

    // Start auto periodic sync if enabled
    if (this.config.isEnabled) {
      this.startPeriodicSync(this.config.intervalMinutes);
    }
  }

  private loadConfig(): DataBridgeConfig {
    const defaultConfig: DataBridgeConfig = {
      isEnabled: true,
      intervalMinutes: 10,
      sheetTitle: 'ALL',
      spreadsheetId: '',
      syncStores: true,
      syncSchedules: true,
      syncFleets: true,
      syncCrews: true,
      lastSyncTimestamp: null,
      lastSyncStatus: 'idle',
      lastSyncMessage: null
    };

    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (stored) {
          return { ...defaultConfig, ...JSON.parse(stored) };
        }
      }
    } catch (e) {
      console.warn('[DataBridge] Failed to load config from storage:', e);
    }
    return defaultConfig;
  }

  private saveConfigToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
      }
    } catch (e) {
      console.error('[DataBridge] Failed to persist config:', e);
    }
  }

  private loadLogs(): DataBridgeLogEntry[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(LOGS_STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      console.warn('[DataBridge] Failed to load logs from storage:', e);
    }
    return [];
  }

  private saveLogsToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(this.logs.slice(0, 50)));
      }
    } catch (e) {
      console.error('[DataBridge] Failed to persist logs:', e);
    }
  }

  public notifyListeners(): void {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('[DataBridge] Listener error:', err);
      }
    });
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public getConfig(): DataBridgeConfig {
    return { ...this.config };
  }

  public updateConfig(partial: Partial<DataBridgeConfig>): void {
    const wasEnabled = this.config.isEnabled;
    const oldInterval = this.config.intervalMinutes;

    this.config = { ...this.config, ...partial };
    this.saveConfigToStorage();

    if (this.config.isEnabled && (!wasEnabled || this.config.intervalMinutes !== oldInterval)) {
      this.startPeriodicSync(this.config.intervalMinutes);
    } else if (!this.config.isEnabled && wasEnabled) {
      this.stopPeriodicSync();
    }

    this.notifyListeners();
  }

  public getLogs(): DataBridgeLogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
    this.saveLogsToStorage();
    this.notifyListeners();
  }

  public isPeriodicSyncActive(): boolean {
    return this.timerId !== null && this.config.isEnabled;
  }

  public isBusy(): boolean {
    return this.isSyncing;
  }

  /**
   * Start periodic timer for automated background synchronization
   */
  public startPeriodicSync(intervalMinutes?: number): void {
    this.stopPeriodicSync();

    const interval = Math.max(1, intervalMinutes || this.config.intervalMinutes || 10);
    this.config.intervalMinutes = interval;
    this.config.isEnabled = true;
    this.saveConfigToStorage();

    const intervalMs = interval * 60 * 1000;
    console.log(`[DataBridge] Starting periodic sync every ${interval} minutes (${intervalMs}ms)...`);

    this.timerId = setInterval(() => {
      console.log('[DataBridge] Triggering automated periodic sync cycle...');
      this.syncNow(`Periodic (${interval}m)`).catch(err => {
        console.error('[DataBridge] Scheduled periodic sync error:', err);
      });
    }, intervalMs);

    this.notifyListeners();
  }

  /**
   * Stop automated periodic timer
   */
  public stopPeriodicSync(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
      console.log('[DataBridge] Stopped periodic sync timer.');
    }
    this.config.isEnabled = false;
    this.saveConfigToStorage();
    this.notifyListeners();
  }

  /**
   * Core Engine: Pull from Google Sheets API and upsert into Supabase tables
   */
  public async syncNow(triggerSource: string = 'Manual'): Promise<DataBridgeSyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        durationMs: 0,
        storesUpserted: 0,
        schedulesUpserted: 0,
        fleetsUpserted: 0,
        crewsUpserted: 0,
        status: 'warning',
        message: 'Sinkronisasi DataBridge sedang berjalan. Silakan tunggu beberapa saat.'
      };
    }

    this.isSyncing = true;
    const startTime = performance.now();
    this.config.lastSyncStatus = 'syncing';
    this.config.lastSyncMessage = `Sedang menarik data Google Sheets & memperbarui Supabase (${triggerSource})...`;
    this.saveConfigToStorage();
    this.notifyListeners();

    try {
      // 1. Validate Supabase Client
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Klien Supabase belum terkonfigurasi. Periksa kredensial URL dan Anon Key di menu Arsitektur DB.');
      }

      // 2. Extract Data from Google Sheets API / Local Mirror
      let sheetSchedules: ParsedSheetTrip[] = [];
      const gsheetsConf = googleSheetsApiService.getConfig();
      let sheetId = this.config.spreadsheetId || gsheetsConf.spreadsheetId;

      if (!sheetId && gsheetsConf.spreadsheetUrl) {
        sheetId = googleSheetsApiService.extractSpreadsheetId(gsheetsConf.spreadsheetUrl);
      }

      // Try live pull from Google Sheets if configured
      if (sheetId) {
        try {
          const sheetTitle = this.config.sheetTitle || gsheetsConf.selectedSheetTitle || 'ALL';
          const rawRows = await googleSheetsApiService.getSheetValues(sheetId, `${sheetTitle}!A:Z`);
          if (rawRows && rawRows.length > 0) {
            sheetSchedules = googleSheetsApiService.parseScheduleRows(rawRows);
            console.log(`[DataBridge] Pulled ${sheetSchedules.length} parsed trips from Google Sheet "${sheetTitle}".`);
          }
        } catch (fetchErr: any) {
          console.warn('[DataBridge] Live Google Sheets API pull notice (using local active cache):', fetchErr?.message || fetchErr);
        }
      }

      // Fallback: If live pull is empty or unauthenticated, use operational schedules from store
      const localSchedules = logisticsStore.getSchedules();
      const localStores = logisticsStore.getStores();
      const localFleets = logisticsStore.getFleets();
      const localCrews = logisticsStore.getCrews();

      let storesUpserted = 0;
      let fleetsUpserted = 0;
      let crewsUpserted = 0;
      let schedulesUpserted = 0;
      let rlsWarning = false;
      let tableMissingWarning = false;

      // -------------------------------------------------------------
      // STEP A: UPSERT FLEETS (Armada) - HANYA PLAT RESMI NON-AKK
      // -------------------------------------------------------------
      const fleetIdMap = new Map<string, string>(); // plate_number / initialCode -> uuid

      if (this.config.syncFleets && localFleets.length > 0) {
        // Hapus semua armada dengan akhiran plat AKK dari Supabase jika ada
        try {
          await supabase.from('fleets').delete().ilike('plate_number', '%AKK');
        } catch (delErr) {
          console.warn('[DataBridge] Note deleting AKK plates:', delErr);
        }

        const validFleets = localFleets.filter(f => !f.plateNumber.trim().toUpperCase().endsWith('AKK'));
        const fleetPayload = validFleets.map(f => ({
          plate_number: f.plateNumber.trim().toUpperCase(),
          vehicle_type: f.vehicleType || 'Engkel STD',
          tonnage_capacity: f.tonnageCapacity || 5.0,
          current_tonnage: f.currentTonnage || 0,
          status: f.status === 'on-duty' ? 'on-duty' : (f.status === 'maintenance' ? 'maintenance' : 'available'),
          fuel_level_percent: f.fuelLevelPercent || 100,
          odometer_km: f.odometerKm || 0,
          year: f.year || 2024
        }));

        const { data: fleetRes, error: fleetErr } = await supabase
          .from('fleets')
          .upsert(fleetPayload, { onConflict: 'plate_number' })
          .select('id, plate_number');

        if (fleetErr) {
          if (fleetErr.code === '42501') rlsWarning = true;
          if (fleetErr.code === 'PGRST205') tableMissingWarning = true;
          console.warn('[DataBridge] Fleets upsert note:', fleetErr.message);
        } else if (fleetRes) {
          fleetsUpserted = fleetRes.length;
          fleetRes.forEach((f: any) => {
            fleetIdMap.set(f.plate_number.toUpperCase(), f.id);
          });
        }
      }

      // -------------------------------------------------------------
      // STEP B: UPSERT CREWS (Supir & Helper)
      // -------------------------------------------------------------
      const crewIdMap = new Map<string, string>(); // crew name -> uuid

      if (this.config.syncCrews && localCrews.length > 0) {
        // Query existing crews first to match by name
        const { data: existingCrews, error: fetchCrewsErr } = await supabase
          .from('crews')
          .select('id, name');

        if (fetchCrewsErr) {
          if (fetchCrewsErr.code === '42501') rlsWarning = true;
          if (fetchCrewsErr.code === 'PGRST205') tableMissingWarning = true;
          console.warn('[DataBridge] Fetch existing crews note:', fetchCrewsErr.message);
        } else if (existingCrews) {
          existingCrews.forEach((c: any) => {
            crewIdMap.set(c.name.trim().toUpperCase(), c.id);
          });
        }

        for (const c of localCrews) {
          let role = 'Driver Utama';
          if (c.role.includes('Helper') || c.role.includes('Kernet')) {
            role = 'Kernet / Helper';
          } else if (c.role.includes('Cadangan')) {
            role = 'Driver Cadangan';
          }

          let licenseType = 'SIM B1 Umum';
          if (c.licenseType?.includes('B2')) licenseType = 'SIM B2 Umum';
          else if (c.licenseType?.includes('A')) licenseType = 'SIM A';

          const crewData = {
            name: c.name.trim(),
            phone: c.phone || '081234567890',
            role,
            license_number: c.licenseNumber || `SIM-${c.name.substring(0, 3).toUpperCase()}-2026`,
            license_type: licenseType,
            status: c.status === 'on-duty' ? 'on-duty' : (c.status === 'off' ? 'off' : 'available'),
            trips_completed: c.tripsCompleted || 0,
            rating: c.rating || 5.0
          };

          const existingId = crewIdMap.get(c.name.trim().toUpperCase());
          if (existingId) {
            const { error: updErr } = await supabase
              .from('crews')
              .update(crewData)
              .eq('id', existingId);

            if (updErr) {
              if (updErr.code === '42501') rlsWarning = true;
            } else {
              crewsUpserted++;
            }
          } else {
            const { data: insData, error: insErr } = await supabase
              .from('crews')
              .insert([crewData])
              .select('id, name');

            if (insErr) {
              if (insErr.code === '42501') rlsWarning = true;
              if (insErr.code === 'PGRST205') tableMissingWarning = true;
            } else if (insData && insData.length > 0) {
              crewsUpserted++;
              crewIdMap.set(insData[0].name.trim().toUpperCase(), insData[0].id);
            }
          }
        }
      }

      // -------------------------------------------------------------
      // STEP C: UPSERT STORES (Toko Retail & Destinasi Distribusi)
      // -------------------------------------------------------------
      const storeIdMap = new Map<string, string>(); // store_code / store_name -> uuid

      if (this.config.syncStores && localStores.length > 0) {
        const storePayload = localStores.map(s => {
          let category = 'Supermarket';
          if (['Hypermarket', 'Supermarket', 'Distribution Hub', 'Minimarket Cluster'].includes(s.storeCategory || '')) {
            category = s.storeCategory!;
          }

          return {
            store_code: s.storeCode.trim().toUpperCase(),
            store_name: s.storeName.trim(),
            island: s.island || 'Jawa',
            province: s.province || 'Jawa Timur',
            city: s.city || 'Banyuwangi',
            address: s.address || `Area Pengiriman ${s.storeName}`,
            latitude: Number(s.latitude) || -8.219,
            longitude: Number(s.longitude) || 114.369,
            contact_person: s.contactPerson || 'PIC Distribusi Area',
            phone: s.phone || '-',
            delivery_window: s.deliveryWindow || '08:00 - 17:00',
            store_category: category
          };
        });

        const { data: storeRes, error: storeErr } = await supabase
          .from('stores')
          .upsert(storePayload, { onConflict: 'store_code' })
          .select('id, store_code, store_name');

        if (storeErr) {
          if (storeErr.code === '42501') rlsWarning = true;
          if (storeErr.code === 'PGRST205') tableMissingWarning = true;
          console.warn('[DataBridge] Stores upsert note:', storeErr.message);
        } else if (storeRes) {
          storesUpserted = storeRes.length;
          storeRes.forEach((s: any) => {
            storeIdMap.set(s.store_code.toUpperCase(), s.id);
            storeIdMap.set(s.store_name.toUpperCase(), s.id);
          });
        }
      }

      // If store table was queried or populated, ensure we have at least one store ID for fallback references
      let defaultStoreUuid: string | null = null;
      if (storeIdMap.size > 0) {
        defaultStoreUuid = storeIdMap.values().next().value || null;
      }

      // -------------------------------------------------------------
      // STEP D: UPSERT SCHEDULES (Jadwal Pengiriman dari Google Sheets)
      // -------------------------------------------------------------
      if (this.config.syncSchedules && localSchedules.length > 0) {
        // First try to look up any stores in Supabase to resolve IDs if storeIdMap was empty
        if (!defaultStoreUuid) {
          const { data: existingStores } = await supabase.from('stores').select('id, store_code, store_name').limit(100);
          if (existingStores && existingStores.length > 0) {
            defaultStoreUuid = existingStores[0].id;
            existingStores.forEach((s: any) => {
              storeIdMap.set(s.store_code.toUpperCase(), s.id);
              storeIdMap.set(s.store_name.toUpperCase(), s.id);
            });
          }
        }

        const schedulePayload = localSchedules.map((sch, schIdx) => {
          const areaStd = standardizeAreaName(sch.areaName || sch.store?.storeName || 'Banyuwangi Central');
          const isBali = sch.isInterIsland || areaStd.includes('DENPASAR') || areaStd.includes('SINGARAJA') || areaStd.includes('NEGARA') || areaStd.includes('BALI');

          // Match store ID
          const matchedStoreUuid = 
            (sch.store?.storeCode && storeIdMap.get(sch.store.storeCode.toUpperCase())) ||
            (sch.store?.storeName && storeIdMap.get(sch.store.storeName.toUpperCase())) ||
            storeIdMap.get(areaStd.toUpperCase()) ||
            defaultStoreUuid;

          // Match fleet ID
          const matchedFleetUuid = 
            (sch.fleet?.plateNumber && fleetIdMap.get(sch.fleet.plateNumber.toUpperCase())) ||
            (sch.fleet?.initialCode && fleetIdMap.get(sch.fleet.initialCode.toUpperCase())) ||
            null;

          // Match crew ID
          const matchedCrewUuid = 
            (sch.crew?.name && crewIdMap.get(sch.crew.name.trim().toUpperCase())) ||
            null;

          const depIso = sch.departureDate || new Date().toISOString();
          const arrIso = sch.estimatedArrival || new Date(new Date(depIso).getTime() + 8 * 3600000).toISOString();

          return {
            tracking_number: sch.trackingNumber || `PO-AKK-AUTO-${schIdx + 1}`,
            origin_name: sch.originName || 'Gudang Pusat Banyuwangi DC',
            origin_latitude: sch.originCoords ? sch.originCoords[0] : -8.1906,
            origin_longitude: sch.originCoords ? sch.originCoords[1] : 114.3708,
            store_id: matchedStoreUuid,
            fleet_id: matchedFleetUuid,
            crew_id: matchedCrewUuid,
            status: ['scheduled', 'in_transit', 'delivered', 'delayed'].includes(sch.status) ? sch.status : 'scheduled',
            departure_date: depIso,
            estimated_arrival: arrIso,
            cargo_description: sch.cargoDescription || `Karton Box & Sheet Kemasan - ${areaStd}`,
            cargo_weight_ton: Number(sch.cargoWeightTon) || (isBali ? 4.5 : 2.5),
            is_inter_island: isBali,
            ferry_booking_code: isBali ? (sch.ferryBookingCode || `ASDP-KTP-GLM-${schIdx + 100}`) : null,
            transit_port: isBali ? 'Pelabuhan Ketapang Banyuwangi -> Gilimanuk Bali' : null,
            notes: sch.notes || `Rute Pengiriman Distribusi ${areaStd}`
          };
        }).filter(item => Boolean(item.store_id)); // Foreign key constraint requires a valid store_id

        if (schedulePayload.length > 0) {
          const { data: schRes, error: schErr } = await supabase
            .from('schedules')
            .upsert(schedulePayload, { onConflict: 'tracking_number' })
            .select('id, tracking_number');

          if (schErr) {
            if (schErr.code === '42501') rlsWarning = true;
            if (schErr.code === 'PGRST205') tableMissingWarning = true;
            console.warn('[DataBridge] Schedules upsert note:', schErr.message);
          } else if (schRes) {
            schedulesUpserted = schRes.length;
          }
        }
      }

      const durationMs = Math.round(performance.now() - startTime);
      const timestampIso = new Date().toISOString();

      // Formulate final status
      let finalStatus: 'success' | 'warning' | 'error' = 'success';
      let message = `Sinkronisasi DataBridge berhasil (${durationMs}ms)! ${schedulesUpserted} jadwal, ${storesUpserted} toko, ${fleetsUpserted} armada, dan ${crewsUpserted} kru telah diperbarui di Supabase.`;

      if (tableMissingWarning) {
        finalStatus = 'warning';
        message = 'Tabel database Supabase belum dibuat. Jalankan skrip schema.sql di SQL Editor Supabase untuk mengaktifkan tabel relasional.';
      } else if (rlsWarning) {
        finalStatus = 'warning';
        message = 'Akses RLS (Row Level Security) aktif di Supabase. Jalankan skrip "DataBridge Policy" di SQL Editor Supabase agar proses upsert diizinkan untuk peran Anon.';
      }

      this.config.lastSyncTimestamp = timestampIso;
      this.config.lastSyncStatus = finalStatus;
      this.config.lastSyncMessage = message;
      this.saveConfigToStorage();

      // Record in local log
      const logEntry: DataBridgeLogEntry = {
        id: `db-log-${Date.now()}`,
        timestamp: timestampIso,
        status: finalStatus,
        storesCount: storesUpserted,
        schedulesCount: schedulesUpserted,
        fleetsCount: fleetsUpserted,
        crewsCount: crewsUpserted,
        message,
        triggerSource,
        durationMs
      };
      this.logs = [logEntry, ...this.logs.slice(0, 49)];
      this.saveLogsToStorage();

      // Also attempt to log into Supabase databridge_sync_logs table if created
      try {
        await supabase.from('databridge_sync_logs').insert([
          {
            status: finalStatus,
            source_type: 'google_sheets_api',
            sheet_name: this.config.sheetTitle || 'ALL',
            stores_count: storesUpserted,
            schedules_count: schedulesUpserted,
            fleets_count: fleetsUpserted,
            crews_count: crewsUpserted,
            message,
            duration_ms: durationMs
          }
        ]);
      } catch {
        // non-blocking
      }

      this.isSyncing = false;
      this.notifyListeners();

      return {
        success: finalStatus === 'success',
        timestamp: timestampIso,
        durationMs,
        storesUpserted,
        schedulesUpserted,
        fleetsUpserted,
        crewsUpserted,
        status: finalStatus,
        message,
        rlsWarning,
        tableMissingWarning
      };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      const timestampIso = new Date().toISOString();
      const errMsg = err?.message || 'Terjadi kesalahan sistem saat sinkronisasi DataBridge.';

      this.config.lastSyncTimestamp = timestampIso;
      this.config.lastSyncStatus = 'error';
      this.config.lastSyncMessage = errMsg;
      this.saveConfigToStorage();

      const errorLog: DataBridgeLogEntry = {
        id: `db-log-${Date.now()}`,
        timestamp: timestampIso,
        status: 'error',
        storesCount: 0,
        schedulesCount: 0,
        fleetsCount: 0,
        crewsCount: 0,
        message: errMsg,
        triggerSource,
        durationMs
      };
      this.logs = [errorLog, ...this.logs.slice(0, 49)];
      this.saveLogsToStorage();

      this.isSyncing = false;
      this.notifyListeners();

      return {
        success: false,
        timestamp: timestampIso,
        durationMs,
        storesUpserted: 0,
        schedulesUpserted: 0,
        fleetsUpserted: 0,
        crewsUpserted: 0,
        status: 'error',
        message: errMsg
      };
    }
  }
}

export const dataBridgeService = new DataBridgeService();
export { DataBridgeService };
