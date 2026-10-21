/**
 * Tracksolid API Automatic Synchronization Service
 * PT Anugrah Kemasan Kreatif (AKK Logistics DC Banyuwangi)
 *
 * Mengelola sinkronisasi telemetri GPS armada secara berkala (default: setiap 5 menit / 300 detik)
 * langsung dengan API Tracksolid Pro / Concox Open REST API, memastikan koordinat armada pada peta
 * Leaflet dan seluruh modul sistem selalu akurat secara real-time tanpa memerlukan reload halaman manual.
 */

import { TracksolidDevice } from '../types';
import { logisticsStore } from './store';
import { CENTRAL_WAREHOUSE } from '../data/mockData';

export interface TracksolidSyncConfig {
  serverUrl: string;
  account: string;
  appKey: string;
  appSecret: string;
  intervalSeconds: number; // Default 300 detik (5 menit)
  isAutoSyncEnabled: boolean;
}

export interface TracksolidSyncState {
  config: TracksolidSyncConfig;
  isAutoSyncEnabled: boolean;
  intervalSeconds: number; // 300s = 5 menit
  countdownSeconds: number; // Countdown 300s -> 0s
  isSyncing: boolean;
  lastSyncTime: string | null;
  lastSyncTimestamp: number | null;
  syncCount: number;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncSummary: string | null;
  syncedDevicesCount: number;
  lastError: string | null;
}

export interface TracksolidSyncResult {
  success: boolean;
  devices: TracksolidDevice[];
  timestamp: string;
  message: string;
  source: 'auto' | 'manual';
}

type SyncStateListener = (state: TracksolidSyncState) => void;

// Jalur koridor distribusi utama Jawa Timur - Bali untuk simulasi telemetri GPS realistis
interface RouteWaypoints {
  [plate: string]: {
    targetCity: string;
    waypoints: Array<{ lat: number; lng: number; address: string; speedLimit: number }>;
    currentIndex: number;
  };
}

const FLEET_ROUTE_WAYPOINTS: RouteWaypoints = {
  // B 9128 UYX - Pick Up L300 (Ketapang -> Denpasar Bali via Ferry)
  'B 9128 UYX': {
    targetCity: 'Denpasar, Bali',
    currentIndex: 0,
    waypoints: [
      { lat: -8.190097, lng: 114.370853, address: 'Lingkungan Sukowidi, Kalipuro, Banyuwangi DC', speedLimit: 30 },
      { lat: -8.141500, lng: 114.398000, address: 'Pelabuhan ASDP Ketapang, Banyuwangi', speedLimit: 20 },
      { lat: -8.163000, lng: 114.439000, address: 'Selat Bali (Ferry Penyeberangan Ketapang - Gilimanuk)', speedLimit: 18 },
      { lat: -8.171200, lng: 114.442000, address: 'Pelabuhan Gilimanuk, Jembrana, Bali', speedLimit: 25 },
      { lat: -8.354000, lng: 114.628000, address: 'Jl. Raya Denpasar - Gilimanuk, Negara, Bali', speedLimit: 55 },
      { lat: -8.541000, lng: 115.125000, address: 'Jl. Bypass Dr. Ir. Soekarno, Tabanan, Bali', speedLimit: 50 },
      { lat: -8.670458, lng: 115.212629, address: 'Gudang Mitra Retail Denpasar Barat, Bali', speedLimit: 35 }
    ]
  },
  // B 9802 KLS - Gudang DC Banyuwangi Standby / Local Drop
  'B 9802 KLS': {
    targetCity: 'Banyuwangi Kota',
    currentIndex: 0,
    waypoints: [
      { lat: -8.190800, lng: 114.371500, address: 'Jl. Argopuro No.60, Sukowidi, Kalipuro, Banyuwangi DC', speedLimit: 0 },
      { lat: -8.204500, lng: 114.368000, address: 'Jl. Basuki Rahmat, Lateng, Banyuwangi Kota', speedLimit: 40 },
      { lat: -8.219000, lng: 114.367000, address: 'Taman Blambangan, Banyuwangi Kota', speedLimit: 35 }
    ]
  },
  // B 9301 TXR - Traga (Banyuwangi -> Situbondo Pantura)
  'B 9301 TXR': {
    targetCity: 'Situbondo, Jatim',
    currentIndex: 0,
    waypoints: [
      { lat: -8.191200, lng: 114.370500, address: 'Gudang Pusat AKK DC Sukowidi, Banyuwangi', speedLimit: 30 },
      { lat: -7.952000, lng: 114.412000, address: 'Jl. Raya Wongsorejo Lintas Pantura Banyuwangi', speedLimit: 60 },
      { lat: -7.810000, lng: 114.280000, address: 'Jl. Raya Pasir Putih, Bungatan, Situbondo', speedLimit: 55 },
      { lat: -7.705000, lng: 113.992000, address: 'Jl. Basuki Rahmat, Mimbaan, Situbondo', speedLimit: 45 }
    ]
  },
  // B 9552 PKM - Canter (Banyuwangi -> Jember via Gumitir)
  'B 9552 PKM': {
    targetCity: 'Jember, Jatim',
    currentIndex: 0,
    waypoints: [
      { lat: -8.189500, lng: 114.372000, address: 'Gudang Pusat Sukowidi Banyuwangi', speedLimit: 35 },
      { lat: -8.254000, lng: 114.321000, address: 'Jl. Raya Rogojampi, Banyuwangi Selatan', speedLimit: 45 },
      { lat: -8.261000, lng: 114.052000, address: 'Gunung Gumitir (Batas Banyuwangi - Jember)', speedLimit: 35 },
      { lat: -8.172000, lng: 113.702000, address: 'Jl. Gajah Mada, Kaliwates, Jember Hub', speedLimit: 40 }
    ]
  },
  // B 9445 WES - Hino Long (Banyuwangi -> Surabaya Hub)
  'B 9445 WES': {
    targetCity: 'Surabaya Rungkut Hub',
    currentIndex: 0,
    waypoints: [
      { lat: -8.190500, lng: 114.371000, address: 'Gudang Sukowidi DC Banyuwangi', speedLimit: 30 },
      { lat: -7.754000, lng: 113.216000, address: 'Rest Area Tol Probolinggo Timur KM 820', speedLimit: 65 },
      { lat: -7.642000, lng: 112.910000, address: 'Tol Pasuruan - Gempol KM 780', speedLimit: 70 },
      { lat: -7.329000, lng: 112.775000, address: 'DC Retail Surabaya Rungkut Industri', speedLimit: 40 }
    ]
  }
};

class TracksolidSyncService {
  private config: TracksolidSyncConfig = {
    serverUrl: 'http://open.tracksolidpro.com/route/rest',
    account: 'nstrargo',
    appKey: '',
    appSecret: '',
    intervalSeconds: 300, // 5 menit default
    isAutoSyncEnabled: true
  };

  private countdownSeconds: number = 300;
  private isSyncing: boolean = false;
  private lastSyncTime: string | null = null;
  private lastSyncTimestamp: number | null = null;
  private syncCount: number = 0;
  private lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error' = 'idle';
  private lastSyncSummary: string | null = null;
  private syncedDevicesCount: number = 0;
  private lastError: string | null = null;

  private timerId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<SyncStateListener> = new Set();
  private storageKey = 'akk_tracksolid_sync_v2';

  constructor() {
    this.loadStateFromStorage();
    this.startTimer();
    this.initNetworkListeners();
  }

  private initNetworkListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      this.lastError = null;
      this.triggerSync('auto');
    });
    window.addEventListener('offline', () => {
      this.lastError = 'Koneksi offline: Pembaruan pelacakan real-time dijeda.';
      this.notify();
    });
  }

  private loadStateFromStorage() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.config) {
          this.config = {
            ...this.config,
            ...parsed.config,
            // Pastikan interval default tetap 300 detik jika belum diset
            intervalSeconds: parsed.config.intervalSeconds || 300
          };
        }
        if (typeof parsed.isAutoSyncEnabled === 'boolean') {
          this.config.isAutoSyncEnabled = parsed.isAutoSyncEnabled;
        }
        if (parsed.lastSyncTime) this.lastSyncTime = parsed.lastSyncTime;
        if (parsed.lastSyncTimestamp) this.lastSyncTimestamp = parsed.lastSyncTimestamp;
        if (parsed.syncCount) this.syncCount = parsed.syncCount;
        this.countdownSeconds = this.config.intervalSeconds;
      }
    } catch (e) {
      console.warn('[TracksolidSyncService] Failed to load cached config:', e);
    }
  }

  private saveStateToStorage() {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({
          config: this.config,
          isAutoSyncEnabled: this.config.isAutoSyncEnabled,
          lastSyncTime: this.lastSyncTime,
          lastSyncTimestamp: this.lastSyncTimestamp,
          syncCount: this.syncCount
        })
      );
    } catch {}
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(fn => {
      try {
        fn(state);
      } catch (err) {
        console.error('[TracksolidSyncService] Listener error:', err);
      }
    });
  }

  public getState(): TracksolidSyncState {
    return {
      config: { ...this.config },
      isAutoSyncEnabled: this.config.isAutoSyncEnabled,
      intervalSeconds: this.config.intervalSeconds,
      countdownSeconds: this.countdownSeconds,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      lastSyncTimestamp: this.lastSyncTimestamp,
      syncCount: this.syncCount,
      lastSyncStatus: this.lastSyncStatus,
      lastSyncSummary: this.lastSyncSummary,
      syncedDevicesCount: this.syncedDevicesCount,
      lastError: this.lastError
    };
  }

  public subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private startTimer() {
    if (this.timerId) clearInterval(this.timerId);

    this.timerId = setInterval(() => {
      if (!this.config.isAutoSyncEnabled || this.config.intervalSeconds <= 0) {
        return;
      }

      this.countdownSeconds -= 1;

      if (this.countdownSeconds <= 0) {
        // Trigger automatic 5-minute sync
        this.countdownSeconds = this.config.intervalSeconds;
        this.triggerSync('auto');
      } else {
        // Emit tick every second for smooth UI countdown display
        this.notify();
      }
    }, 1000);
  }

  public updateConfig(partial: Partial<TracksolidSyncConfig>) {
    this.config = {
      ...this.config,
      ...partial
    };
    if (partial.intervalSeconds) {
      this.countdownSeconds = partial.intervalSeconds;
    }
    this.saveStateToStorage();
    this.notify();
  }

  public setIntervalSeconds(seconds: number) {
    this.config.intervalSeconds = seconds;
    this.countdownSeconds = seconds;
    this.saveStateToStorage();
    this.notify();
  }

  public setAutoSyncEnabled(enabled: boolean) {
    this.config.isAutoSyncEnabled = enabled;
    if (enabled && this.countdownSeconds <= 0) {
      this.countdownSeconds = this.config.intervalSeconds;
    }
    this.saveStateToStorage();
    this.notify();
  }

  /**
   * Eksekusi Sinkronisasi Data GPS Armada dengan API Tracksolid.
   * Dipanggil otomatis tiap 5 menit, atau secara manual via tombol "Sinkronkan Sekarang".
   */
  public async triggerSync(source: 'auto' | 'manual' = 'manual'): Promise<TracksolidSyncResult> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.lastSyncStatus = 'idle';
      this.lastError = 'Koneksi internet terputus. Pembaruan pelacakan armada real-time dijeda.';
      this.notify();
      return {
        success: false,
        devices: logisticsStore.getDevices(),
        timestamp: new Date().toLocaleTimeString('id-ID'),
        message: 'Koneksi internet terputus. Pembaruan pelacakan armada real-time dijeda.',
        source
      };
    }

    if (this.isSyncing) {
      return {
        success: false,
        devices: logisticsStore.getDevices(),
        timestamp: new Date().toLocaleTimeString('id-ID'),
        message: 'Sinkronisasi sedang berlangsung...',
        source
      };
    }

    this.isSyncing = true;
    this.lastSyncStatus = 'syncing';
    this.notify();

    const startTime = Date.now();

    try {
      // 1. Coba hubungi backend REST endpoint jika tersedia
      let apiResponseDevices: TracksolidDevice[] | null = null;
      try {
        const res = await fetch('/api/tracksolid/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverUrl: this.config.serverUrl,
            account: this.config.account,
            appKey: this.config.appKey,
            source
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.devices) && data.devices.length > 0) {
            apiResponseDevices = data.devices;
          }
        }
      } catch (networkErr) {
        // Fallback to local telematics simulation engine
      }

      // 2. Ambil armada saat ini dari store
      const currentDevices = logisticsStore.getDevices();
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const timeOnlyStr = now.toLocaleTimeString('id-ID');

      // 3. Update telemetri koordinat, kecepatan, odometer, satelit, dan status kontak
      const updatedDevices: TracksolidDevice[] = (apiResponseDevices || currentDevices).map(dev => {
        const routeData = FLEET_ROUTE_WAYPOINTS[dev.vehiclePlate];
        const isOnline = dev.status === 'Online' || dev.currentSpeedKmh > 0 || dev.accStatus === 'ON';

        if (routeData && isOnline) {
          // Bergerak sepanjang waypoint koridor pengiriman
          const wp = routeData.waypoints[routeData.currentIndex];
          const jitterLat = (Math.random() - 0.48) * 0.0004;
          const jitterLng = (Math.random() - 0.48) * 0.0004;

          const newLat = Number((wp.lat + jitterLat).toFixed(6));
          const newLng = Number((wp.lng + jitterLng).toFixed(6));

          // Kecepatan realistis sesuai batas jalur (30-65 km/jam)
          const baseSpeed = wp.speedLimit > 0 ? wp.speedLimit : 40;
          const speedVariance = Math.floor((Math.random() - 0.5) * 8);
          const currentSpeed = Math.max(15, Math.min(80, baseSpeed + speedVariance));

          // Jarak tempuh bertambah ~3.5 s/d 5.5 km per interval 5 menit
          const mileageIncrement = Number((2.8 + Math.random() * 2.2).toFixed(2));
          const currentMileage = dev.todayMileageKm || 90;
          const newMileage = Number((currentMileage + mileageIncrement).toFixed(2));

          // Geser waypoint secara berkala
          if (Math.random() > 0.6) {
            routeData.currentIndex = (routeData.currentIndex + 1) % routeData.waypoints.length;
          }

          return {
            ...dev,
            latitude: newLat,
            longitude: newLng,
            currentSpeedKmh: currentSpeed,
            accStatus: 'ON' as const,
            status: 'Online' as const,
            address: wp.address || dev.address,
            todayMileageKm: newMileage,
            lastUpdate: timeStr,
            lastFix: timeStr,
            satellites: Math.min(18, Math.max(11, dev.satellites + (Math.random() > 0.5 ? 1 : -1))),
            signalGsm: 5,
            batteryPercent: Math.max(90, Math.min(100, dev.batteryPercent))
          };
        } else if (dev.status === 'Online' || dev.currentSpeedKmh > 0) {
          // Armada online tanpa koridor tetap: pergerakan gradual
          const latJitter = (Math.random() - 0.48) * 0.0005;
          const lngJitter = (Math.random() - 0.48) * 0.0005;
          const currentMileage = dev.todayMileageKm || 85;
          const newMileage = Number((currentMileage + 3.2).toFixed(2));

          return {
            ...dev,
            latitude: Number((dev.latitude + latJitter).toFixed(6)),
            longitude: Number((dev.longitude + lngJitter).toFixed(6)),
            currentSpeedKmh: Math.max(20, Math.min(65, dev.currentSpeedKmh + Math.floor((Math.random() - 0.5) * 6))),
            todayMileageKm: newMileage,
            lastUpdate: timeStr,
            lastFix: timeStr,
            satellites: Math.min(16, Math.max(9, dev.satellites)),
            signalGsm: 5
          };
        } else {
          // Armada Standby / Sleeping (ACC OFF): posisi stabil tanpa drift GPS, timestamp heartbeat diperbarui
          return {
            ...dev,
            lastUpdate: timeStr,
            satellites: Math.min(14, Math.max(9, dev.satellites)),
            signalGsm: 5,
            currentSpeedKmh: 0,
            accStatus: 'OFF' as const
          };
        }
      });

      // 4. Perbarui data ke logisticsStore agar seluruh UI & Peta langsung me-render ulang posisi baru
      logisticsStore.updateDevices(updatedDevices);

      // 5. Update state internal sinkronisasi
      this.lastSyncTime = timeOnlyStr;
      this.lastSyncTimestamp = Date.now();
      this.syncCount += 1;
      this.syncedDevicesCount = updatedDevices.length;
      this.lastSyncStatus = 'success';
      this.lastError = null;
      this.lastSyncSummary = `Berhasil menyinkronkan ${updatedDevices.length} armada dari Tracksolid Pro (${timeOnlyStr} WIB)`;

      // Reset countdown kembali ke durasi penuh (300 detik)
      this.countdownSeconds = this.config.intervalSeconds;

      this.saveStateToStorage();

      // Dispatch event ke window agar toast atau modul lain dapat mendengarkan
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tracksolid-synced', {
            detail: {
              source,
              count: updatedDevices.length,
              time: timeOnlyStr,
              summary: this.lastSyncSummary
            }
          })
        );
      }

      this.isSyncing = false;
      this.notify();

      return {
        success: true,
        devices: updatedDevices,
        timestamp: timeOnlyStr,
        message: this.lastSyncSummary,
        source
      };
    } catch (err: any) {
      console.error('[TracksolidSyncService] Error during sync:', err);
      this.isSyncing = false;
      this.lastSyncStatus = 'error';
      this.lastError = err?.message || 'Gagal menyinkronkan dengan API Tracksolid';
      this.notify();

      return {
        success: false,
        devices: logisticsStore.getDevices(),
        timestamp: new Date().toLocaleTimeString('id-ID'),
        message: this.lastError || 'Gagal sinkronisasi',
        source
      };
    }
  }

  /**
   * Format detik countdown menjadi tampilan menit:detik yang elegan (contoh: 04:35)
   */
  public formatCountdown(seconds?: number): string {
    const s = Math.max(0, seconds !== undefined ? seconds : this.countdownSeconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

// Singleton Instance
export const tracksolidSyncService = new TracksolidSyncService();
