import React, { useState, useEffect, useMemo } from 'react';
import { Store, MapPin, Search, Filter, Plus, Compass, Navigation, Phone, Clock, Layers, Building2, Trash2, FileSpreadsheet, RefreshCw, Route, Maximize2, Minimize2, Star, Users, Target, Circle, Download, CheckCircle2, X } from 'lucide-react';
import { LeafletMap } from './LeafletMap';
import { RetailStore } from '../types';
import { logisticsStore, isAreaRouteItem } from '../services/store';
import { GoogleSheetsStoreSyncModal } from './GoogleSheetsStoreSyncModal';
import { googleSheetsSyncService } from '../services/googleSheetsSyncService';
import { CENTRAL_WAREHOUSE } from '../data/mockData';
import { extractCoordinatesFromObject, normalizeStoreWithCoordinates, getStoreLocationType, getStorePriorityLevel } from '../utils/coordinateParser';
import { calculateDistanceKm } from '../utils/distance';

interface CustomerMappingProps {
  onScheduleForStore?: (store: RetailStore) => void;
}

export const CustomerMapping: React.FC<CustomerMappingProps> = ({ onScheduleForStore }) => {
  const [stores, setStores] = useState<RetailStore[]>(() => {
    const s = logisticsStore.getStores().filter(store => !isAreaRouteItem(store));
    console.log(`[CustomerMapping INITIAL] Loaded ${s.length} verified retail stores from database.`);
    return s.map((store, idx) => normalizeStoreWithCoordinates(store, idx));
  });
  const [syncConfig, setSyncConfig] = useState(googleSheetsSyncService.getConfig());
  
  // Real-time Fetch & Diagnostic state
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'fetching' | 'success' | 'error'>('success');
  const [diagnosticLogs, setDiagnosticLogs] = useState<Array<{ id: string; timestamp: string; message: string; count: number; level: 'info' | 'success' | 'warning' }>>(() => [
    {
      id: 'diag-init',
      timestamp: new Date().toLocaleTimeString(),
      message: `Inisialisasi CustomerMapping: Terbaca ${logisticsStore.getStores().length} toko aktif dari database.`,
      count: logisticsStore.getStores().length,
      level: logisticsStore.getStores().length > 0 ? 'success' : 'info'
    }
  ]);
  const [showDiagnosticsDrawer, setShowDiagnosticsDrawer] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState<boolean>(false);

  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [priorityLayerFilter, setPriorityLayerFilter] = useState<'all' | 'high_priority'>('all');
  const [selectedIsland, setSelectedIsland] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStore, setSelectedStore] = useState<RetailStore | null>(null);
  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);
  const [isGoogleSheetsSyncOpen, setIsGoogleSheetsSyncOpen] = useState(false);

  // Dedicated Priority Level Checkbox Filters State
  const [selectedPriorities, setSelectedPriorities] = useState<Set<'High' | 'Medium' | 'Low'>>(
    new Set(['High', 'Medium', 'Low'])
  );

  const handlePriorityCheckboxToggle = (level: 'High' | 'Medium' | 'Low') => {
    setSelectedPriorities(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  const handleSelectAllPriorities = () => {
    if (selectedPriorities.size === 3) {
      setSelectedPriorities(new Set());
    } else {
      setSelectedPriorities(new Set(['High', 'Medium', 'Low']));
    }
  };

  const priorityCounts = useMemo(() => {
    const counts = { High: 0, Medium: 0, Low: 0 };
    stores.forEach(st => {
      const level = getStorePriorityLevel(st);
      counts[level]++;
    });
    return counts;
  }, [stores]);

  const handleStorePriorityChange = (storeId: string, level: 'High' | 'Medium' | 'Low') => {
    const storeToUpdate = stores.find(s => s.id === storeId);
    if (!storeToUpdate) return;

    const updatedStore = {
      ...storeToUpdate,
      priorityLevel: level
    };

    logisticsStore.updateStore(storeId, { priorityLevel: level });

    setStores(prev => prev.map(s => s.id === storeId ? updatedStore : s));

    if (selectedStore && selectedStore.id === storeId) {
      setSelectedStore(updatedStore);
    }

    const now = new Date().toLocaleTimeString();
    setDiagnosticLogs(prev => [
      { id: 'diag-' + Date.now(), timestamp: now, message: `Mengubah prioritas "${storeToUpdate.storeName}" menjadi ${level}`, count: stores.length, level: 'success' },
      ...prev
    ]);
  };

  // Radius Search & GIS Proximity Analysis State
  const [isRadiusMode, setIsRadiusMode] = useState<boolean>(false);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [radiusCenter, setRadiusCenter] = useState<[number, number] | null>(CENTRAL_WAREHOUSE.coordinates);
  const [radiusPivotLabel, setRadiusPivotLabel] = useState<string>('Gudang Banyuwangi DC (Pusat Logistik)');
  const [enableClustering, setEnableClustering] = useState<boolean>(false);
  const [forceMapUpdateKey, setForceMapUpdateKey] = useState<number>(0);

  const handleMapClickForRadius = (coords: [number, number]) => {
    setRadiusCenter(coords);
    setRadiusPivotLabel(`Titik Peta (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`);
  };

  const storesWithinRadius = useMemo(() => {
    if (!radiusCenter) return [];
    const [cLat, cLng] = radiusCenter;
    return stores
      .map(st => {
        const lat = Number(st.latitude);
        const lng = Number(st.longitude);
        const distanceKm = calculateDistanceKm(cLat, cLng, lat, lng);
        return { store: st, distanceKm };
      })
      .filter(item => item.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [stores, radiusCenter, radiusKm]);

  const exportRadiusStoresToCSV = () => {
    if (storesWithinRadius.length === 0) return;
    const headers = ['Kode Toko', 'Nama Toko', 'Kategori', 'Kota', 'Pulau', 'Jarak dari Pusat (km)', 'Alamat', 'Telepon', 'Jendela Pengiriman'];
    const rows = storesWithinRadius.map(item => [
      item.store.storeCode,
      `"${item.store.storeName.replace(/"/g, '""')}"`,
      item.store.storeCategory,
      item.store.city,
      item.store.island,
      item.distanceKm,
      `"${item.store.address.replace(/"/g, '""')}"`,
      item.store.phone || '-',
      item.store.deliveryWindow
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Daftar_Toko_Radius_${radiusKm}km_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const runDiagnosticSync = async () => {
    setFetchStatus('fetching');
    const now = new Date().toLocaleTimeString();
    console.log(`[CustomerMapping DIAGNOSTIC START] Executing full dataset sync and diagnostic check at ${now}`);
    
    setDiagnosticLogs(prev => [
      { id: 'diag-' + Date.now(), timestamp: now, message: 'Menjalankan diagnostik & pembacaan seluruh dataset toko dari database...', count: stores.length, level: 'info' },
      ...prev
    ]);

    try {
      const res = await googleSheetsSyncService.syncNow('Diagnostik Manual CustomerMapping');
      const freshStores = logisticsStore.getStores().map((st, idx) => normalizeStoreWithCoordinates(st, idx));
      setStores(freshStores);
      setFetchStatus('success');
      const timeEnd = new Date().toLocaleTimeString();
      
      console.log(`[CustomerMapping DIAGNOSTIC SUCCESS] Database verified. Total stores active in memory: ${freshStores.length}`);
      setDiagnosticLogs(prev => [
        { id: 'diag-' + Date.now(), timestamp: timeEnd, message: `Diagnostik Sukses: Terbaca seluruh ${freshStores.length} toko retail aktif dari database.`, count: freshStores.length, level: 'success' },
        ...prev
      ]);
    } catch (err: any) {
      setFetchStatus('error');
      const timeErr = new Date().toLocaleTimeString();
      console.error(`[CustomerMapping DIAGNOSTIC ERROR]`, err);
      setDiagnosticLogs(prev => [
        { id: 'diag-' + Date.now(), timestamp: timeErr, message: `Diagnostik Error: ${err?.message || 'Gagal sinkronisasi toko'}`, count: stores.length, level: 'warning' },
        ...prev
      ]);
    }
  };

  useEffect(() => {
    const current = logisticsStore.getStores();
    console.log(`[CustomerMapping EFFECT] Database store count: ${current.length}`);
    
    if (
      current.length === 0 || 
      current.some(s => s.storeName.includes('Freshman') || s.storeName.includes('Sophomore'))
    ) {
      runDiagnosticSync();
    }

    const unsubStore = logisticsStore.subscribe(() => {
      const updated = logisticsStore.getStores().map((st, idx) => normalizeStoreWithCoordinates(st, idx));
      console.log(`[CustomerMapping EVENT] logisticsStore updated. Count: ${updated.length}`);
      setStores(updated);
    });
    const unsubGsheets = googleSheetsSyncService.subscribe(() => {
      setSyncConfig(googleSheetsSyncService.getConfig());
      const updated = logisticsStore.getStores().map((st, idx) => normalizeStoreWithCoordinates(st, idx));
      console.log(`[CustomerMapping EVENT] googleSheetsSyncService updated. Count: ${updated.length}`);
      setStores(updated);
    });
    return () => {
      unsubStore();
      unsubGsheets();
    };
  }, []);

  // Helper to fetch delivery routes from schedule simulations
  const routesForWeek = useMemo(() => {
    try {
      const saved = localStorage.getItem('akk_simulasi_weeks_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
        const allRoutes: any[] = [];
        Object.values(parsed).forEach((weekRoutes: any) => {
          if (Array.isArray(weekRoutes)) {
            allRoutes.push(...weekRoutes);
          }
        });
        return allRoutes.length > 0 ? allRoutes : (parsed[1] || []);
      }
    } catch {
      // ignore
    }
    return [];
  }, []);

  // Transform routes into polylines for the map
  const routePolylines = useMemo(() => {
    if (!showRoutes) return [];
    
    // Group routes by day to draw separate lines or all at once?
    // Let's draw all routes for the week, maybe color coded by day.
    return routesForWeek.map((route: any) => {
      const store = stores.find(s => s.storeName === route.route) || stores.find(s => route.route.includes(s.storeName));
      if (store) {
        const sLat = Number(store.latitude);
        const sLng = Number(store.longitude);
        if (isNaN(sLat) || isNaN(sLng) || !isFinite(sLat) || !isFinite(sLng) || sLat === 0 || sLng === 0) return null;
        return {
          coords: [[-8.2333, 114.3667], [sLat, sLng]] as [number, number][],
          color: route.day === 'Senin' ? '#ef4444' : route.day === 'Selasa' ? '#f59e0b' : route.day === 'Rabu' ? '#10b981' : route.day === 'Kamis' ? '#3b82f6' : route.day === 'Jumat' ? '#8b5cf6' : '#ec4899'
        };
      }
      return null;
    }).filter((p: any): p is { coords: [number, number][]; color: string } => p !== null);
  }, [routesForWeek, stores, showRoutes]);

  // Form State for new store
  const [newStore, setNewStore] = useState({
    storeCode: 'RET-NEW-' + Math.floor(Math.random() * 900 + 100),
    storeName: '',
    island: 'Jawa' as RetailStore['island'],
    province: 'DKI Jakarta',
    city: 'Jakarta Timur',
    address: '',
    latitude: -6.2088,
    longitude: 106.8456,
    contactPerson: '',
    phone: '',
    deliveryWindow: '08:00 - 17:00',
    storeCategory: 'Supermarket' as RetailStore['storeCategory']
  });

  const filteredStores = useMemo(() => {
    return stores.filter(st => {
      const matchesIsland = selectedIsland === 'all' || st.island === selectedIsland;
      const matchesCategory = selectedCategory === 'all' || st.storeCategory === selectedCategory;
      const matchesSearch =
        st.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.storeCode.toLowerCase().includes(searchQuery.toLowerCase());

      const level = getStorePriorityLevel(st);
      const matchesPriorityCheckbox = selectedPriorities.has(level);
      const matchesPriorityLayer = priorityLayerFilter === 'all' || level === 'High';

      return matchesIsland && matchesCategory && matchesSearch && matchesPriorityCheckbox && matchesPriorityLayer;
    });
  }, [stores, selectedIsland, selectedCategory, searchQuery, selectedPriorities, priorityLayerFilter]);

  // Comprehensive Delivery Loop Polyline connecting ALL 15 stores
  const plannedPolylineCoords = useMemo(() => {
    if (!showRoutes || filteredStores.length === 0) return [];

    // Sort stores logically for an optimal, realistic distribution delivery route:
    // 1. From Central Warehouse DC (Kalipuro)
    // 2. North/Kalipuro stores (e.g., Hotel Ketapang Indah)
    // 3. Banyuwangi Kota stores (Abba Mart, Kurnia Sobo, RSI Fatimah)
    // 4. Down to the Genteng cluster stores (Asmuin, Damai, Santoso, Kawi, Holly, Lima Sepuluh, Usaha Jaya 1 & 2, Bu Tiwi, Melati, Bu Yuli)
    // 5. Returning back to Central Warehouse
    const sortedStores = [...filteredStores].sort((a, b) => {
      const latA = Number(a.latitude) || 0;
      const latB = Number(b.latitude) || 0;
      return latB - latA; // North to South
    });

    return [
      CENTRAL_WAREHOUSE.coordinates,
      ...sortedStores
        .map(s => {
          const lat = Number(s.latitude);
          const lng = Number(s.longitude);
          if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng) || lat === 0 || lng === 0) return null;
          return [lat, lng] as [number, number];
        })
        .filter((c): c is [number, number] => c !== null),
      CENTRAL_WAREHOUSE.coordinates
    ];
  }, [showRoutes, filteredStores]);

  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStore.storeName || !newStore.address) return;

    logisticsStore.addStore(newStore);
    setIsAddStoreOpen(false);
    setNewStore({
      storeCode: 'RET-NEW-' + Math.floor(Math.random() * 900 + 100),
      storeName: '',
      island: 'Jawa',
      province: 'DKI Jakarta',
      city: 'Jakarta Timur',
      address: '',
      latitude: -6.2088,
      longitude: 106.8456,
      contactPerson: '',
      phone: '',
      deliveryWindow: '08:00 - 17:00',
      storeCategory: 'Supermarket'
    });
  };

  const banyuwangiCount = stores.filter(s => getStoreLocationType(s) === 'dalam_kota').length;
  const outOfTownCount = stores.filter(s => getStoreLocationType(s) === 'luar_kota').length;
  const outerIslandCount = stores.filter(s => getStoreLocationType(s) === 'luar_pulau').length;

  return (
    <div className="space-y-6">
      {/* Header & Quick Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-2">
              <Compass className="w-3.5 h-3.5" />
              <span>Jaringan Toko Retail & Logistik Antar-Pulau</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Pemetaan Daerah Pelanggan & Route Intelligence
            </h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Memetakan sebaran toko retail ritel modern, hypermarket, dan distribution hub di seluruh kepulauan Indonesia dari Gudang Pusat Banyuwangi DC.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            <button
              onClick={() => googleSheetsSyncService.syncNow('Picu Cepat Toolbar')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold shadow-md transition cursor-pointer border border-emerald-500/40"
              title="Perbarui & sinkronkan ulang langsung seluruh data toko dari sheet 'DATA FIX'"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-200" />
              <span>Sinkronkan Toko ({stores.length})</span>
            </button>

            <button
              onClick={() => setIsGoogleSheetsSyncOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-800/90 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition cursor-pointer border border-emerald-500/50"
              title="Atur & Sinkronkan Otomatis Data Google Sheets 'DATA FIX'"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300 animate-pulse" />
              <span>Google Sheets ({syncConfig.sheetName})</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5"></span>
            </button>

            <button
              onClick={() => setIsAddStoreOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Toko Retail Baru</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 text-xs">Total Toko Retail</span>
            <div className="text-xl font-bold text-white mt-0.5">{stores.length} Outlet</div>
            <span className="text-[11px] text-slate-500">Terdaftar Aktif</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 text-xs">Dalam Kota (Banyuwangi)</span>
            <div className="text-xl font-bold text-indigo-400 mt-0.5">{banyuwangiCount} Outlet</div>
            <span className="text-[11px] text-slate-500">Klaster Banyuwangi</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 text-xs">Luar Kota (Jawa Timur)</span>
            <div className="text-xl font-bold text-rose-400 mt-0.5">{outOfTownCount} Outlet</div>
            <span className="text-[11px] text-slate-500">Jember, Situbondo, Lumajang, dll</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 text-xs">Luar Pulau (Antar-Pulau)</span>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{outerIslandCount} Outlet</div>
            <span className="text-[11px] text-slate-500">Area Bali & Kepulauan</span>
          </div>
        </div>

        {/* Real-time Fetch & Diagnostic Status Banner */}
        <div className="mt-4 bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${fetchStatus === 'success' ? 'bg-emerald-400 animate-pulse' : fetchStatus === 'fetching' ? 'bg-amber-400 animate-spin' : 'bg-rose-400'}`}></div>
            <div>
              <div className="font-bold text-white flex items-center gap-2">
                <span>Status Sinkronisasi Real-Time:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  stores.length > 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {stores.length > 0 ? `🟢 Aktif (${stores.length} Toko Terdaftar)` : `🟡 Memuat (0 Toko)`}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Sumber Sheet: <strong className="text-slate-200">{syncConfig.sheetName}</strong> &bull; Terakhir Diperiksa: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runDiagnosticSync}
              disabled={fetchStatus === 'fetching'}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetchStatus === 'fetching' ? 'animate-spin' : ''}`} />
              <span>{fetchStatus === 'fetching' ? 'Memindai...' : `🔍 Jalankan Diagnostik Toko (${stores.length})`}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDiagnosticsDrawer(!showDiagnosticsDrawer)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer"
            >
              {showDiagnosticsDrawer ? 'Sembunyikan Log Diagnostik' : `Lihat Log Diagnostik (${diagnosticLogs.length})`}
            </button>
          </div>
        </div>

        {/* Expandable Diagnostic Log Drawer */}
        {showDiagnosticsDrawer && (
          <div className="mt-3 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-850">
              <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-400">Log Diagnostik Sistem (Real-Time Database Watcher)</span>
              <span>Total Log: {diagnosticLogs.length}</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
              {diagnosticLogs.map(log => (
                <div key={log.id} className="flex items-start justify-between gap-2 p-1.5 rounded bg-slate-900/80 border border-slate-850">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-500 select-none">[{log.timestamp}]</span>
                    <span className={log.level === 'success' ? 'text-emerald-300 font-semibold' : log.level === 'warning' ? 'text-amber-300 font-semibold' : 'text-slate-300'}>
                      {log.message}
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 shrink-0 font-sans font-bold">
                    {log.count} toko
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dedicated Priority Level Checkbox Filtering Interface */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                <span>Filter Tingkat Prioritas Pelanggan (Priority Level Checkboxes)</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-mono border border-blue-500/30 font-semibold">
                  {selectedPriorities.size} dari 3 Tingkat Aktif
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Centang untuk menyaring visibility penanda toko di peta berdasarkan level prioritas distribusi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllPriorities}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{selectedPriorities.size === 3 ? 'Hapus Semua Centang' : 'Pilih Semua (High, Med, Low)'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* High Priority Checkbox */}
          <label
            onClick={() => handlePriorityCheckboxToggle('High')}
            className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
              selectedPriorities.has('High')
                ? 'bg-amber-500/15 border-amber-500/60 text-white ring-1 ring-amber-400/30 shadow-lg'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={selectedPriorities.has('High')}
                onChange={() => {}}
                className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 focus:ring-offset-slate-900 cursor-pointer"
              />
              <div className="flex items-center gap-1.5">
                <Star className={`w-4 h-4 ${selectedPriorities.has('High') ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
                <div>
                  <div className="font-bold text-xs">High Priority (Tinggi)</div>
                  <div className="text-[10px] text-slate-400">Hypermarket, Supermarket, Hub</div>
                </div>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              selectedPriorities.has('High') ? 'bg-amber-500/30 text-amber-300 border border-amber-400/30' : 'bg-slate-800 text-slate-500'
            }`}>
              {priorityCounts.High}
            </span>
          </label>

          {/* Medium Priority Checkbox */}
          <label
            onClick={() => handlePriorityCheckboxToggle('Medium')}
            className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
              selectedPriorities.has('Medium')
                ? 'bg-indigo-500/15 border-indigo-500/60 text-white ring-1 ring-indigo-400/30 shadow-lg'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={selectedPriorities.has('Medium')}
                onChange={() => {}}
                className="w-4 h-4 rounded border-slate-700 text-indigo-500 focus:ring-indigo-400 focus:ring-offset-slate-900 cursor-pointer"
              />
              <div className="flex items-center gap-1.5">
                <Building2 className={`w-4 h-4 ${selectedPriorities.has('Medium') ? 'text-indigo-400' : 'text-slate-500'}`} />
                <div>
                  <div className="font-bold text-xs">Medium Priority (Sedang)</div>
                  <div className="text-[10px] text-slate-400">Minimarket Cluster, Distributor</div>
                </div>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              selectedPriorities.has('Medium') ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-400/30' : 'bg-slate-800 text-slate-500'
            }`}>
              {priorityCounts.Medium}
            </span>
          </label>

          {/* Low Priority Checkbox */}
          <label
            onClick={() => handlePriorityCheckboxToggle('Low')}
            className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
              selectedPriorities.has('Low')
                ? 'bg-slate-800/90 border-slate-600 text-white ring-1 ring-slate-500/30 shadow-lg'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={selectedPriorities.has('Low')}
                onChange={() => {}}
                className="w-4 h-4 rounded border-slate-700 text-slate-400 focus:ring-slate-400 focus:ring-offset-slate-900 cursor-pointer"
              />
              <div className="flex items-center gap-1.5">
                <Store className={`w-4 h-4 ${selectedPriorities.has('Low') ? 'text-slate-300' : 'text-slate-500'}`} />
                <div>
                  <div className="font-bold text-xs">Low Priority (Standar)</div>
                  <div className="text-[10px] text-slate-400">Toko Kelontong & Outlet Kecil</div>
                </div>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              selectedPriorities.has('Low') ? 'bg-slate-700 text-slate-200 border border-slate-600' : 'bg-slate-800 text-slate-500'
            }`}>
              {priorityCounts.Low}
            </span>
          </label>
        </div>
      </div>

      {/* Main Map & Filter Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Map */}
        <div className="lg:col-span-8 space-y-4">
          {/* Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari nama toko, kota, atau kode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => setIsMapFullscreen(!isMapFullscreen)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow ${
                  isMapFullscreen
                    ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
                title={isMapFullscreen ? 'Keluar dari layar penuh' : 'Buka peta dalam mode layar penuh (Fullscreen)'}
              >
                {isMapFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Keluar Fullscreen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Layar Penuh (Fullscreen)</span>
                  </>
                )}
              </button>

              <button 
                type="button"
                onClick={() => setIsRadiusMode(!isRadiusMode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow ${
                  isRadiusMode
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-blue-500/20'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300'
                } border border-slate-800`}
                title="Aktifkan Cari Radius / Analisis Jangkauan Lingkar Toko"
              >
                <Target className="w-3.5 h-3.5 text-blue-400" />
                <span>Radius Search ({radiusKm}km)</span>
              </button>

              <button 
                type="button"
                onClick={() => setEnableClustering(!enableClustering)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow ${
                  enableClustering
                    ? 'bg-amber-600 text-white ring-2 ring-amber-400 shadow-amber-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
                title={enableClustering ? 'Matikan Pengelompokan Klaster (Tampilkan Semua Pin Individual)' : 'Aktifkan Pengelompokan Klaster'}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{enableClustering ? 'Mode Klaster' : `Pin Individu (${filteredStores.length})`}</span>
              </button>

              <button 
                type="button"
                onClick={() => setForceMapUpdateKey(prev => prev + 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer flex items-center gap-1.5 shadow"
                title="Paksa Perbarui & Muat Ulang Penanda Peta"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                <span>Reset Penanda</span>
              </button>

              <button 
                type="button"
                onClick={() => setShowRoutes(!showRoutes)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${showRoutes ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400'} border border-slate-800 transition cursor-pointer flex items-center gap-1.5`}
                title="Tampilkan/Sembunyikan garis rute pengiriman"
              >
                <Route className="w-3.5 h-3.5" />
                <span>{showRoutes ? 'Sembunyikan Rute' : 'Tampilkan Rute'}</span>
              </button>
              <select
                value={selectedIsland}
                onChange={(e) => setSelectedIsland(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Semua Pulau</option>
                <option value="Jawa">Pulau Jawa</option>
                <option value="Sumatera">Sumatera</option>
                <option value="Bali & Nusa Tenggara">Bali & Nusa Tenggara</option>
                <option value="Kalimantan">Kalimantan</option>
                <option value="Sulawesi">Sulawesi</option>
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Semua Kategori</option>
                <option value="Hypermarket">Hypermarket</option>
                <option value="Supermarket">Supermarket</option>
                <option value="Distribution Hub">Distribution Hub</option>
              </select>
            </div>
          </div>

          {/* Interactive Leaflet Map */}
          <div
            id="customer-mapping-container"
            className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col w-full h-[620px] min-h-[500px]"
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2.5 px-1 shrink-0 gap-2 flex-wrap">
              <div className="flex items-center gap-3.5 flex-wrap text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block ring-2 ring-amber-300/40"></span>
                  <span className="font-semibold text-slate-200">Gudang Banyuwangi DC</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block ring-2 ring-indigo-300/40"></span>
                  <span className="font-semibold text-slate-200">Dalam Kota (Banyuwangi)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 inline-block ring-2 ring-rose-300/40"></span>
                  <span className="font-semibold text-rose-300">Luar Kota (Jember, Situbondo, Lumajang, dll)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-300/40"></span>
                  <span className="font-semibold text-emerald-300">Luar Pulau (Antar-Pulau)</span>
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Menampilkan <strong className="text-white">{filteredStores.length}</strong> dari {stores.length} toko
              </span>
            </div>

            <div className="relative z-0 flex-1 w-full min-h-0 flex flex-col">
              <LeafletMap
                stores={filteredStores}
                selectedStoreId={selectedStore?.id}
                onSelectStore={(st) => setSelectedStore(st)}
                onSchedule={onScheduleForStore}
                highlightIsland={selectedIsland}
                heightClass="h-full w-full flex-1 min-h-0"
                showWarehouse={true}
                plannedPolyline={plannedPolylineCoords}
                externalIsFullscreen={isMapFullscreen}
                onToggleFullscreen={() => setIsMapFullscreen(!isMapFullscreen)}
                priorityFilter={priorityLayerFilter}
                onPriorityFilterChange={(f) => setPriorityLayerFilter(f)}
                isRadiusMode={isRadiusMode}
                radiusKm={radiusKm}
                radiusCenter={radiusCenter}
                onMapClickForRadius={handleMapClickForRadius}
                enableClustering={enableClustering}
                forceUpdateTrigger={forceMapUpdateKey}
                selectedPriorities={selectedPriorities}
                onTogglePriority={handlePriorityCheckboxToggle}
                onChangeStorePriority={handleStorePriorityChange}
              />
            </div>
          </div>

          {/* Radius Search & GIS Proximity Analysis Card */}
          {isRadiusMode && (
            <div className="bg-slate-900 border border-blue-500/60 rounded-xl p-4 shadow-2xl space-y-4 animate-card-fade-in text-xs text-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Analisis Proksimitas Radius GIS</h3>
                    <p className="text-[11px] text-slate-400">Pusat Acuan: <strong className="text-blue-300">{radiusPivotLabel}</strong></p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportRadiusStoresToCSV}
                    disabled={storesWithinRadius.length === 0}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ekspor CSV ({storesWithinRadius.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsRadiusMode(false)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                    title="Tutup Panel Radius"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Pivot & Radius Selector Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pivot Center Selection */}
                <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="font-bold text-slate-300 text-[11px] uppercase tracking-wider block">1. Pilih Pusat Titik Radius</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setRadiusCenter(CENTRAL_WAREHOUSE.coordinates);
                        setRadiusPivotLabel('Gudang Banyuwangi DC (Pusat Logistik)');
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                        radiusCenter && radiusCenter[0] === CENTRAL_WAREHOUSE.coordinates[0] && radiusCenter[1] === CENTRAL_WAREHOUSE.coordinates[1]
                          ? 'bg-blue-600 text-white shadow ring-1 ring-blue-400'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      🏢 Gudang DC Banyuwangi
                    </button>

                    {selectedStore && (
                      <button
                        type="button"
                        onClick={() => {
                          const lat = Number(selectedStore.latitude);
                          const lng = Number(selectedStore.longitude);
                          if (!isNaN(lat) && !isNaN(lng)) {
                            setRadiusCenter([lat, lng]);
                            setRadiusPivotLabel(`${selectedStore.storeName} (${selectedStore.storeCode})`);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                          radiusCenter && selectedStore && radiusCenter[0] === Number(selectedStore.latitude)
                            ? 'bg-amber-600 text-white shadow ring-1 ring-amber-400'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        🛍️ {selectedStore.storeName}
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 italic mt-1">
                    💡 Klik di mana saja pada peta untuk menetapkan titik pusat lingkaran bebas.
                  </p>
                </div>

                {/* Radius Distance Control */}
                <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300 text-[11px] uppercase tracking-wider block">2. Ukuran Jangkauan Radius</span>
                    <span className="font-mono font-extrabold text-blue-400 text-sm">{radiusKm} KM</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[2, 5, 10, 25, 50].map(km => (
                      <button
                        key={km}
                        type="button"
                        onClick={() => setRadiusKm(km)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                          radiusKm === km
                            ? 'bg-blue-600 text-white shadow'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        {km} km
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer mt-1"
                  />
                </div>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Toko Dalam Radius</span>
                  <span className="text-base font-extrabold text-blue-400">{storesWithinRadius.length} Outlet</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Jangkauan ≤ {radiusKm} km</span>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Toko Terdekat</span>
                  <span className="text-sm font-bold text-emerald-400 truncate">
                    {storesWithinRadius[0] ? `${storesWithinRadius[0].distanceKm} km` : '-'}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    {storesWithinRadius[0] ? storesWithinRadius[0].store.storeName : 'Tidak ada toko'}
                  </span>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Toko Terjauh</span>
                  <span className="text-sm font-bold text-amber-400 truncate">
                    {storesWithinRadius.length > 0 ? `${storesWithinRadius[storesWithinRadius.length - 1].distanceKm} km` : '-'}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    {storesWithinRadius.length > 0 ? storesWithinRadius[storesWithinRadius.length - 1].store.storeName : '-'}
                  </span>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Lingkar Jarak</span>
                  <span className="text-sm font-bold text-indigo-400">
                    {Math.round(storesWithinRadius.reduce((sum, item) => sum + item.distanceKm, 0) * 10) / 10} km
                  </span>
                  <span className="text-[10px] text-slate-500">Estimasi Kumulatif</span>
                </div>
              </div>

              {/* Table / List of Stores within Radius */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>DAFTAR OUTLET DALAM RADIUS ({storesWithinRadius.length})</span>
                  <span>Urut berdasarkan jarak terdekat</span>
                </div>

                {storesWithinRadius.length === 0 ? (
                  <div className="p-6 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-500">
                    Tidak ada toko pelanggan ditemukan dalam radius {radiusKm} km dari pusat acuan saat ini.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 font-sans">
                    {storesWithinRadius.map(({ store, distanceKm }) => (
                      <div
                        key={store.id}
                        onClick={() => setSelectedStore(store)}
                        className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                          selectedStore?.id === store.id
                            ? 'bg-blue-950/80 border-blue-500 text-white shadow'
                            : 'bg-slate-950 hover:bg-slate-850 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-extrabold flex items-center justify-center text-[10px] shrink-0 border border-blue-500/30">
                            {distanceKm}k
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs truncate flex items-center gap-1.5">
                              <span>{store.storeName}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-400 font-mono">
                                {store.storeCode}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {store.address} &bull; {store.city}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {distanceKm} km
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Selected Store Details & Store List */}
        <div className="lg:col-span-4 space-y-4">
          {/* Selected Store Inspector */}
          {selectedStore ? (
            <div className="bg-slate-900 border border-blue-500/50 rounded-xl p-5 shadow-lg space-y-4 animate-card-fade-in">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {selectedStore.storeCategory}
                </span>
                <span className="text-xs font-mono text-slate-400">{selectedStore.storeCode}</span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white">{selectedStore.storeName}</h3>
                <p className="text-xs text-slate-400 mt-1 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span>{selectedStore.address}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-800">
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[11px]">Wilayah / Pulau:</span>
                  <div className="font-semibold text-white mt-0.5">{selectedStore.island}</div>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[11px]">Kota:</span>
                  <div className="font-semibold text-white mt-0.5">{selectedStore.city}</div>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[11px]">Jendela Kirim:</span>
                  <div className="font-semibold text-amber-400 mt-0.5">{selectedStore.deliveryWindow}</div>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[11px]">PIC Toko:</span>
                  <div className="font-semibold text-white mt-0.5">{selectedStore.contactPerson}</div>
                </div>
              </div>

              {/* Atur Tingkat Prioritas Pelanggan (Priority Level Editor) */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-400" />
                  <span>Atur Tingkat Prioritas Pelanggan:</span>
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['High', 'Medium', 'Low'] as const).map((level) => {
                    const active = getStorePriorityLevel(selectedStore) === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => handleStorePriorityChange(selectedStore.id, level)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-extrabold transition cursor-pointer text-center border ${
                          active
                            ? level === 'High'
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow shadow-amber-500/20'
                              : level === 'Medium'
                              ? 'bg-indigo-600 text-white border-indigo-400 shadow shadow-indigo-600/20'
                              : 'bg-slate-700 text-white border-slate-500 shadow'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 leading-normal italic">
                  * Mengubah tingkat ini akan langsung memperbarui pin di peta dan indikator filter prioritas.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${selectedStore.phone}`}
                    className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Hubungi PIC</span>
                  </a>

                  {onScheduleForStore && (
                    <button
                      onClick={() => onScheduleForStore(selectedStore)}
                      className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Buat Jadwal</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (window.confirm(`Apakah Anda yakin ingin menghapus pelanggan "${selectedStore.storeName}" dari database? Tindakan ini tidak dapat dibatalkan.`)) {
                      logisticsStore.deleteStore(selectedStore.id);
                      setSelectedStore(null);
                    }
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-rose-950/20 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-500 text-rose-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Pelanggan</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
              <Store className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <div className="text-xs font-semibold text-slate-300">Pilih Toko di Peta atau Daftar</div>
              <p className="text-[11px] text-slate-500 mt-1">Klik marker toko pada peta untuk menginspeksi rute & detail outlet.</p>
            </div>
          )}

          {/* Compact Store List */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Daftar Toko Retail ({filteredStores.length})</span>
              <span className="text-[11px] text-slate-500">Filter Aktif</span>
            </div>

            <div className="divide-y divide-slate-800 max-h-[380px] overflow-y-auto">
              {filteredStores.map(store => {
                const isSelected = selectedStore?.id === store.id;
                const locType = getStoreLocationType(store);
                return (
                  <div
                    key={store.id}
                    onClick={() => setSelectedStore(store)}
                    className={`p-3 text-xs cursor-pointer transition group relative ${
                      isSelected ? 'bg-blue-600/15 border-l-4 border-blue-500' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-semibold text-white pr-6">{store.storeName}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          locType === 'luar_pulau'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : locType === 'luar_kota'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        }`}>
                          {locType === 'luar_pulau' ? store.island : locType === 'luar_kota' ? 'Luar Kota' : 'Banyuwangi'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Apakah Anda yakin ingin menghapus pelanggan "${store.storeName}" dari database?`)) {
                              logisticsStore.deleteStore(store.id);
                              if (selectedStore?.id === store.id) {
                                setSelectedStore(null);
                              }
                            }
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition opacity-0 group-hover:opacity-100 cursor-pointer"
                          title="Hapus Pelanggan"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{store.city} &bull; {store.storeCategory}</span>
                      <span className="font-mono text-slate-500">{store.storeCode}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add Store Modal */}
      {isAddStoreOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                Tambah Toko Retail Pelanggan Baru
              </h3>
              <button
                onClick={() => setIsAddStoreOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveStore} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Kode Pelanggan</label>
                  <input
                    type="text"
                    required
                    value={newStore.storeCode}
                    onChange={(e) => setNewStore({ ...newStore, storeCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Kategori Toko</label>
                  <select
                    value={newStore.storeCategory}
                    onChange={(e) => setNewStore({ ...newStore, storeCategory: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="Toko Retail">Toko Retail</option>
                    <option value="Toko Grosir">Toko Grosir</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Nama Toko Retail</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Hypermart Mall Panakkukang Makassar"
                  value={newStore.storeName}
                  onChange={(e) => setNewStore({ ...newStore, storeName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Pulau</label>
                  <select
                    value={newStore.island}
                    onChange={(e) => setNewStore({ ...newStore, island: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="Jawa">Jawa</option>
                    <option value="Sumatera">Sumatera</option>
                    <option value="Bali & Nusa Tenggara">Bali & Nusa Tenggara</option>
                    <option value="Kalimantan">Kalimantan</option>
                    <option value="Sulawesi">Sulawesi</option>
                    <option value="Papua & Maluku">Papua & Maluku</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Kota / Kabupaten</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kota Makassar"
                    value={newStore.city}
                    onChange={(e) => setNewStore({ ...newStore, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Alamat Lengkap</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Jl. Pengayoman No. 12..."
                  value={newStore.address}
                  onChange={(e) => setNewStore({ ...newStore, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newStore.latitude}
                    onChange={(e) => setNewStore({ ...newStore, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newStore.longitude}
                    onChange={(e) => setNewStore({ ...newStore, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Nomor Telepon</label>
                <input
                  type="text"
                  required
                  placeholder="+62 812..."
                  value={newStore.phone}
                  onChange={(e) => setNewStore({ ...newStore, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddStoreOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow"
                >
                  Simpan Toko
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Integrasi Google Sheets DATA FIX */}
      <GoogleSheetsStoreSyncModal
        isOpen={isGoogleSheetsSyncOpen}
        onClose={() => setIsGoogleSheetsSyncOpen(false)}
        onSuccessSync={() => setStores(logisticsStore.getStores())}
      />
    </div>
  );
};
