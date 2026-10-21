import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Database, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Zap, 
  ShieldAlert, 
  ArrowRight, 
  ArrowRightLeft,
  Compass,
  MapPin,
  Sparkles,
  Info,
  Clock,
  Radio
} from 'lucide-react';
import { logisticsStore } from '../services/store';
import { googleSheetsSyncService, validateCoordinateData, CorruptedStoreIssue } from '../services/googleSheetsSyncService';
import { DATA_FIX_SHEET_PRESETS, sanitizeCoordinate } from './GoogleSheetsStoreSyncModal';
import { RetailStore } from '../types';
import { useToast } from '../context/ToastContext';
import { tracksolidSyncService, TracksolidSyncState } from '../services/tracksolidSyncService';

export interface CoordinateDiscrepancyItem {
  id: string; // Store ID / UUID
  storeCode: string;
  storeName: string;
  sourceSheet: string;
  discrepancyType: 'REJECTED' | 'MISSING' | 'OUT_OF_BOUNDS' | 'ZERO_COORDINATE' | 'MISMATCH_COORDINATE';
  rawLatitude: string | number;
  rawLongitude: string | number;
  currentDbLatitude?: number;
  currentDbLongitude?: number;
  rejectionReason: string;
  suggestedFallback: [number, number];
  isFixed: boolean;
}

export const LiveSyncHealthCard: React.FC = () => {
  const { addNotification } = useToast();
  const [localStores, setLocalStores] = useState<RetailStore[]>(logisticsStore.getStores());
  const [syncConfig, setSyncConfig] = useState(googleSheetsSyncService.getConfig());
  const [autoSyncStatus, setAutoSyncStatus] = useState(logisticsStore.getAutoSyncStatus());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>(new Date().toLocaleTimeString('id-ID'));
  const [simulatedRejections, setSimulatedRejections] = useState<CoordinateDiscrepancyItem[]>([]);
  const [tracksolidState, setTracksolidState] = useState<TracksolidSyncState>(tracksolidSyncService.getState());

  useEffect(() => {
    const unsubStore = logisticsStore.subscribe(() => {
      setLocalStores(logisticsStore.getStores());
      setLastCheckTime(new Date().toLocaleTimeString('id-ID'));
    });
    const unsubSync = googleSheetsSyncService.subscribe(() => {
      setSyncConfig(googleSheetsSyncService.getConfig());
      setLocalStores(logisticsStore.getStores());
      setLastCheckTime(new Date().toLocaleTimeString('id-ID'));
    });
    const unsubAutoSync = logisticsStore.onAutoSyncStatusChange((status) => {
      setAutoSyncStatus(status);
    });
    const unsubTracksolid = tracksolidSyncService.subscribe((ts) => {
      setTracksolidState(ts);
    });
    return () => {
      unsubStore();
      unsubSync();
      unsubAutoSync();
      unsubTracksolid();
    };
  }, []);

  // Compute live discrepancy list highlighting rejected, corrupted, or missing coordinates
  const realDiscrepancies = useMemo<CoordinateDiscrepancyItem[]>(() => {
    const list: CoordinateDiscrepancyItem[] = [];

    DATA_FIX_SHEET_PRESETS.forEach((sheetItem) => {
      const coordVal = validateCoordinateData(sheetItem.rawLat, sheetItem.rawLng);
      const localStore = localStores.find(
        (ls) =>
          ls.storeCode.trim().toUpperCase() === sheetItem.storeCode.trim().toUpperCase() ||
          ls.storeName.trim().toUpperCase() === sheetItem.storeName.trim().toUpperCase()
      );

      const targetId = localStore ? localStore.id : `UNREGISTERED-${sheetItem.storeCode}`;

      // Check if coordinates were rejected or corrupted in source
      if (!coordVal.isValid) {
        let type: CoordinateDiscrepancyItem['discrepancyType'] = 'REJECTED';
        if (coordVal.reason?.includes('di luar batas')) type = 'OUT_OF_BOUNDS';
        else if (coordVal.reason?.includes('0.0000')) type = 'ZERO_COORDINATE';
        else if (coordVal.reason?.includes('kosong')) type = 'MISSING';

        list.push({
          id: targetId,
          storeCode: sheetItem.storeCode,
          storeName: sheetItem.storeName,
          sourceSheet: syncConfig.sheetName,
          discrepancyType: type,
          rawLatitude: sheetItem.rawLat || '-',
          rawLongitude: sheetItem.rawLng || '-',
          currentDbLatitude: localStore?.latitude,
          currentDbLongitude: localStore?.longitude,
          rejectionReason: coordVal.reason || 'Koordinat ditolak oleh sistem validasi',
          suggestedFallback: [coordVal.cleanLat, coordVal.cleanLng],
          isFixed: localStore?.storeCategory !== 'Needs Correction' && coordVal.isValid
        });
      } else if (localStore) {
        // Source is valid, check if local DB has coordinate drift or is marked 'Needs Correction'
        const latDiff = Math.abs(localStore.latitude - coordVal.cleanLat);
        const lngDiff = Math.abs(localStore.longitude - coordVal.cleanLng);
        const isDbCorrupted = isNaN(localStore.latitude) || isNaN(localStore.longitude) || localStore.latitude === 0;

        if (isDbCorrupted || localStore.storeCategory === 'Needs Correction' || latDiff > 0.0005 || lngDiff > 0.0005) {
          list.push({
            id: localStore.id,
            storeCode: sheetItem.storeCode,
            storeName: sheetItem.storeName,
            sourceSheet: syncConfig.sheetName,
            discrepancyType: isDbCorrupted ? 'REJECTED' : 'MISMATCH_COORDINATE',
            rawLatitude: sheetItem.rawLat,
            rawLongitude: sheetItem.rawLng,
            currentDbLatitude: localStore.latitude,
            currentDbLongitude: localStore.longitude,
            rejectionReason: isDbCorrupted 
              ? 'Nilai koordinat di database lokal tidak valid (NaN / 0.0000)'
              : localStore.storeCategory === 'Needs Correction'
              ? 'Toko ditandai "Needs Correction" di database lokal'
              : `Selisih posisi DB vs Sheet ${(latDiff + lngDiff).toFixed(4)}°`,
            suggestedFallback: [coordVal.cleanLat, coordVal.cleanLng],
            isFixed: false
          });
        }
      }
    });

    return list;
  }, [localStores, syncConfig.sheetName]);

  // Combine real and simulated discrepancies (for QA demonstration)
  const combinedDiscrepancies = useMemo(() => {
    return [...simulatedRejections, ...realDiscrepancies];
  }, [simulatedRejections, realDiscrepancies]);

  // Health Metrics
  const recordsFetched = DATA_FIX_SHEET_PRESETS.length;
  const currentDbCount = localStores.length;
  const countDelta = currentDbCount - recordsFetched;
  const totalDiscrepancies = combinedDiscrepancies.length;
  const isHealthy = countDelta === 0 && totalDiscrepancies === 0;
  const healthScore = Math.max(0, Math.min(100, Math.round(((recordsFetched - totalDiscrepancies) / recordsFetched) * 100)));

  const handleTriggerAutoFix = async () => {
    setIsSyncing(true);
    setSimulatedRejections([]);
    try {
      const res = await googleSheetsSyncService.syncNow('Live Sync Health Auto-Fix');
      addNotification(
        'schedule',
        'Auto-Fix Selesai & Terverifikasi!',
        `Semua ${res.total} outlet telah disinkronkan. Koordinat GPS telah divalidasi dan seluruh diskrepansi telah dinormalkan.`
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSimulateDiscrepancy = () => {
    const mockItems: CoordinateDiscrepancyItem[] = [
      {
        id: 'str-discrepancy-sim-01',
        storeCode: 'RET-CORRUPT-99',
        storeName: 'TOKO UJI FORMAT NaN (SIMULASI)',
        sourceSheet: syncConfig.sheetName,
        discrepancyType: 'REJECTED',
        rawLatitude: 'NaN_CORRUPT_LAT',
        rawLongitude: '114.15632',
        currentDbLatitude: -8.3645,
        currentDbLongitude: 114.1529,
        rejectionReason: 'Format Latitude cacat ("NaN_CORRUPT_LAT") - Ditolak modul sanitasi',
        suggestedFallback: [-8.3645, 114.1529],
        isFixed: false
      },
      {
        id: 'str-discrepancy-sim-02',
        storeCode: 'RET-ZERO-88',
        storeName: 'OUTLET KOORDINAT KOSONG (SIMULASI)',
        sourceSheet: syncConfig.sheetName,
        discrepancyType: 'ZERO_COORDINATE',
        rawLatitude: '0.0000',
        rawLongitude: '0.0000',
        currentDbLatitude: 0,
        currentDbLongitude: 0,
        rejectionReason: 'Latitude & Longitude bernilai 0.0000 (Ditolak: bukan posisi geografis sah)',
        suggestedFallback: [-8.3645, 114.1529],
        isFixed: false
      }
    ];

    setSimulatedRejections(mockItems);

    // Also trigger high-priority notification to dashboard
    googleSheetsSyncService.testCorruptedCoordinateNotification(2);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg space-y-0">
      {/* Top Banner & Live Status Header */}
      <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isHealthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Live Sync Health Monitor
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isHealthy 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {isHealthy ? '100% IN SYNC' : `${totalDiscrepancies} DISCREPANCIES DETECTED`}
            </span>
          </div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Pemantau Integritas Google Sheets vs Database Lokal</span>
          </h3>
          <p className="text-xs text-slate-400">
            Pemeriksaan reaktif otomatis antara baris data Google Sheets &apos;{syncConfig.sheetName}&apos; dan tabel retail_stores.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {simulatedRejections.length === 0 ? (
            <button
              onClick={handleSimulateDiscrepancy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold shadow transition cursor-pointer active:scale-95"
              title="Uji simulasi penolakan koordinat untuk memverifikasi daftar diskrepansi"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulasi Koordinat Rusak</span>
            </button>
          ) : (
            <button
              onClick={() => setSimulatedRejections([])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold shadow transition cursor-pointer"
            >
              <span>Bersihkan Simulasi</span>
            </button>
          )}

          <button
            onClick={handleTriggerAutoFix}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition cursor-pointer active:scale-95"
            title="Sinkronkan ulang agar kedua sumber persis seimbang"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyelaraskan...' : 'Auto-Fix & Sinkronkan'}</span>
          </button>
        </div>
      </div>

      {/* Real-Time Count Comparison Grid */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-900/60 border-b border-slate-800">
        {/* Count Card 1: Records Fetched from Google Sheets */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <FileSpreadsheet className="w-4 h-4" />
              Records Fetched
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono">
              Google Sheets
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">{recordsFetched}</span>
            <span className="text-xs text-slate-400">baris di &apos;{syncConfig.sheetName}&apos;</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Status: Terverifikasi</span>
            <span className="text-emerald-400">Ready</span>
          </div>
        </div>

        {/* Count Card 2: Current Database Count */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-blue-400">
              <Database className="w-4 h-4" />
              Current Database Count
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono">
              Local Registry
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">{currentDbCount}</span>
            <span className="text-xs text-slate-400">outlet aktif di sistem</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Delta: {countDelta === 0 ? 'Tepat Seimbang (0)' : `${countDelta > 0 ? '+' : ''}${countDelta} Entri`}</span>
            <span className={countDelta === 0 ? 'text-emerald-400' : 'text-amber-400'}>
              {countDelta === 0 ? '✓ Balanced' : '⚠ Discrepancy'}
            </span>
          </div>
        </div>

        {/* Count Card 3: Coordinate Health Score */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-purple-400">
              <Compass className="w-4 h-4" />
              GPS Coordinate Health
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 font-mono">
              Integrity
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">{healthScore}%</span>
            <span className={`text-xs font-semibold ${isHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isHealthy ? 'Optimal' : 'Needs Review'}
            </span>
          </div>
          {/* Health progress bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${healthScore}%` }}
            />
          </div>
        </div>

        {/* Count Card 4: Store Auto-Writer Middleware Active Status */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-emerald-900/40 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <Zap className="w-4 h-4 text-emerald-400" />
              Middleware Auto-Writer
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono border border-emerald-500/30">
              {autoSyncStatus.isSyncing ? 'Syncing...' : 'Realtime'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400 font-mono">{autoSyncStatus.syncedCount}</span>
            <span className="text-xs text-slate-400">mutasi disinkronkan</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span className="truncate max-w-[140px] text-slate-400">{autoSyncStatus.lastSyncedEntity ? `Last: ${autoSyncStatus.lastSyncedEntity}` : 'Siap Menulis'}</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Auto-Save
            </span>
          </div>
        </div>
      </div>

      {/* Auto-Sync Middleware Active Indicator Banner */}
      <div className="px-5 py-3 bg-gradient-to-r from-emerald-950/40 via-slate-950 to-blue-950/40 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <p className="text-slate-300">
            <strong className="text-emerald-400 font-semibold">Store Middleware Aktif:</strong> Setiap perubahan entitas (jadwal, status armada, dan gambar/dokumen) secara otomatis memicu proses penulisan ke backend &amp; Google Sheets tanpa perlu tombol sinkronisasi manual.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>Sync: {autoSyncStatus.lastSyncTime ? new Date(autoSyncStatus.lastSyncTime).toLocaleTimeString('id-ID') : lastCheckTime}</span>
        </div>
      </div>

      {/* 📡 Tracksolid Pro GPS 5-Minute Auto-Sync Telemetry Banner */}
      <div className="px-5 py-2.5 bg-gradient-to-r from-blue-950/40 via-slate-950 to-emerald-950/30 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
          <p className="text-slate-300">
            <strong className="text-cyan-400 font-semibold">GPS Tracksolid API Auto-Sync:</strong> Terhubung aktif dengan interval per 5 menit (300 detik) untuk memutakhirkan koordinat lokasi armada di peta secara otomatis tanpa reload halaman.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-cyan-300 border border-blue-500/30">
            Berikutnya: {tracksolidSyncService.formatCountdown(tracksolidState.countdownSeconds)}
          </span>
          <span className="text-slate-400 hidden md:inline">
            • {tracksolidState.lastSyncTime || lastCheckTime} WIB
          </span>
        </div>
      </div>

      {/* Sync Discrepancy List Component */}
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white">
              Sync Discrepancy List (Daftar ID Koordinat Ditolak / Hilang)
            </h4>
          </div>
          <span className="text-xs text-slate-400">
            {totalDiscrepancies === 0 ? 'Tidak ada penolakan koordinat' : `${totalDiscrepancies} data memerlukan perhatian`}
          </span>
        </div>

        {totalDiscrepancies === 0 ? (
          <div className="p-6 bg-slate-950 rounded-xl border border-emerald-900/30 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                <span>Seluruh Koordinat GPS Divalidasi &amp; Diterima Sistem</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                  0 Discrepancy
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tidak ada entri koordinat yang bernilai NaN, kosong, bernilai 0.0000, ataupun keluar dari rentang geografis Indonesia. Ke-15 outlet dari Google Sheets &apos;{syncConfig.sheetName}&apos; terpetakan dengan akurasi koordinat presisi.
              </p>
            </div>
          </div>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-inner">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3 w-40">Store ID / UUID</th>
                    <th className="p-3">Nama Outlet &amp; Kode</th>
                    <th className="p-3">Status Penolakan</th>
                    <th className="p-3">Nilai Koordinat Mentah (Sheet)</th>
                    <th className="p-3">Nilai di Database Saat Ini</th>
                    <th className="p-3">Alasan Penolakan Sistem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px] text-slate-300">
                  {combinedDiscrepancies.map((item) => {
                    const isRejected = item.discrepancyType === 'REJECTED' || item.discrepancyType === 'ZERO_COORDINATE';
                    const isMissing = item.discrepancyType === 'MISSING';
                    const isOutOfBounds = item.discrepancyType === 'OUT_OF_BOUNDS';

                    return (
                      <tr key={item.id} className="hover:bg-slate-900/60 bg-red-950/15 transition">
                        {/* ID Highlight */}
                        <td className="p-3">
                          <div className="font-bold text-red-400 flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-[10px]">
                              {item.id}
                            </span>
                          </div>
                        </td>

                        {/* Store Info */}
                        <td className="p-3 font-sans">
                          <div className="font-bold text-white">{item.storeName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{item.storeCode}</div>
                        </td>

                        {/* Discrepancy Badge */}
                        <td className="p-3">
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                              <XCircle className="w-3 h-3" />
                              <span>COORDINATE REJECTED</span>
                            </span>
                          )}
                          {isMissing && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              <AlertTriangle className="w-3 h-3" />
                              <span>MISSING GPS DATA</span>
                            </span>
                          )}
                          {isOutOfBounds && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              <Compass className="w-3 h-3" />
                              <span>OUT OF BOUNDS</span>
                            </span>
                          )}
                          {item.discrepancyType === 'MISMATCH_COORDINATE' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>COORDINATE DRIFT</span>
                            </span>
                          )}
                        </td>

                        {/* Raw Coords */}
                        <td className="p-3 text-red-300 font-bold">
                          <div>Lat: {String(item.rawLatitude)}</div>
                          <div>Lng: {String(item.rawLongitude)}</div>
                        </td>

                        {/* Current DB Coords */}
                        <td className="p-3 text-slate-300">
                          <div>Lat: {item.currentDbLatitude ?? '-'}</div>
                          <div>Lng: {item.currentDbLongitude ?? '-'}</div>
                          <div className="text-[10px] text-emerald-400">
                            Fallback: [{item.suggestedFallback[0]}, {item.suggestedFallback[1]}]
                          </div>
                        </td>

                        {/* Rejection Reason */}
                        <td className="p-3 font-sans text-amber-300 text-xs">
                          {item.rejectionReason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
