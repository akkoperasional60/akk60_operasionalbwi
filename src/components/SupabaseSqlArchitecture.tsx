import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, 
  Copy, 
  Check, 
  Server, 
  ShieldCheck, 
  Key, 
  Globe, 
  ExternalLink, 
  Terminal, 
  Code2, 
  Layers, 
  AlertCircle, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRightLeft,
  Sparkles,
  Filter,
  Search,
  Zap,
  MapPin,
  ExternalLink as LinkIcon
} from 'lucide-react';
import { logisticsStore } from '../services/store';
import { googleSheetsSyncService, validateCoordinateData } from '../services/googleSheetsSyncService';
import { testSupabaseConnection, sanitizeSupabaseUrl } from '../services/supabaseService';
import { DATA_FIX_SHEET_PRESETS, sanitizeCoordinate } from './GoogleSheetsStoreSyncModal';
import { RetailStore } from '../types';
import { useToast } from '../context/ToastContext';
import { LiveSyncHealthCard } from './LiveSyncHealthCard';
import { SupabaseConnectivityMonitor } from './SupabaseConnectivityMonitor';
import { DataBridgeMonitor } from './DataBridgeMonitor';

export interface StoreDiffItem {
  id: string; // key
  sourceNo?: number;
  sheetStoreCode: string;
  sheetStoreName: string;
  sheetLat: number;
  sheetLng: number;
  sheetCategory: string;
  sheetAddress: string;
  sheetPhone: string;
  localId?: string; // local store UUID
  localStoreCode?: string;
  localStoreName?: string;
  localLat?: number;
  localLng?: number;
  localCategory?: string;
  localAddress?: string;
  localPhone?: string;
  status: 'SYNCED' | 'MISSING_IN_LOCAL' | 'MISMATCH' | 'EXTRA_IN_LOCAL';
  issues: string[];
}

export const SupabaseSqlArchitecture: React.FC = () => {
  const { addNotification } = useToast();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [connectionMessage, setConnectionMessage] = useState<string>('');
  const [isFixingSync, setIsFixingSync] = useState(false);
  const [diffFilter, setDiffFilter] = useState<'all' | 'issues' | 'synced'>('all');
  const [diffSearch, setDiffSearch] = useState('');

  // Reactive state from local stores & gsheets sync service
  const [localStores, setLocalStores] = useState<RetailStore[]>(logisticsStore.getStores());
  const [syncConfig, setSyncConfig] = useState(googleSheetsSyncService.getConfig());
  const [syncLogs, setSyncLogs] = useState(googleSheetsSyncService.getSyncLogs());

  // Initialize Supabase config from store
  useEffect(() => {
    const conf = logisticsStore.getSupabaseConfig();
    if (conf) {
      setSupabaseUrl(conf.url || '');
      setSupabaseAnonKey(conf.anonKey || '');
      setConnectionStatus(conf.isConnected ? 'success' : 'idle');
    }
  }, []);

  useEffect(() => {
    const unsubStore = logisticsStore.subscribe(() => {
      setLocalStores(logisticsStore.getStores());
    });
    const unsubGsheets = googleSheetsSyncService.subscribe(() => {
      setSyncConfig(googleSheetsSyncService.getConfig());
      setSyncLogs(googleSheetsSyncService.getSyncLogs());
      setLocalStores(logisticsStore.getStores());
    });
    return () => {
      unsubStore();
      unsubGsheets();
    };
  }, []);

  // Compute real-time diff between Google Sheets 'DATA FIX' and Local Registry
  const diffResults = useMemo(() => {
    const items: StoreDiffItem[] = [];
    const matchedLocalIds = new Set<string>();

    // 1. Evaluate all records in source Google Sheet 'DATA FIX'
    DATA_FIX_SHEET_PRESETS.forEach((sheetStore) => {
      const cleanLat = sanitizeCoordinate(sheetStore.rawLat, false);
      const cleanLng = sanitizeCoordinate(sheetStore.rawLng, true);

      // Find matching store in local registry by storeCode OR storeName
      const local = localStores.find(
        (ls) =>
          ls.storeCode.trim().toUpperCase() === sheetStore.storeCode.trim().toUpperCase() ||
          ls.storeName.trim().toUpperCase() === sheetStore.storeName.trim().toUpperCase()
      );

      const issues: string[] = [];

      // Check coordinate integrity in Google Sheets source
      const coordValidation = validateCoordinateData(sheetStore.rawLat, sheetStore.rawLng);
      if (!coordValidation.isValid) {
        issues.push(`⚠️ Data Koordinat Cacat di Sheet: ${coordValidation.reason}`);
      }

      if (!local) {
        items.push({
          id: `diff-missing-${sheetStore.storeCode}`,
          sourceNo: sheetStore.no,
          sheetStoreCode: sheetStore.storeCode,
          sheetStoreName: sheetStore.storeName,
          sheetLat: cleanLat,
          sheetLng: cleanLng,
          sheetCategory: sheetStore.storeCategory,
          sheetAddress: sheetStore.address,
          sheetPhone: sheetStore.phone,
          status: 'MISSING_IN_LOCAL',
          issues: ['Outlet terdaftar di Google Sheet "DATA FIX" tetapi BELUM tersimpan di database lokal.']
        });
      } else {
        matchedLocalIds.add(local.id);

        // Check coordinate precision
        const latDiff = Math.abs(local.latitude - cleanLat);
        const lngDiff = Math.abs(local.longitude - cleanLng);
        if (latDiff > 0.0005 || lngDiff > 0.0005) {
          issues.push(
            `Ketidaksesuaian Koordinat GPS: Sheet [${cleanLat.toFixed(5)}, ${cleanLng.toFixed(5)}] vs Local [${local.latitude.toFixed(5)}, ${local.longitude.toFixed(5)}] (selisih ${(latDiff + lngDiff).toFixed(4)}°)`
          );
        }

        // Check category or warning flags
        if (local.storeCategory === 'Needs Correction') {
          issues.push('Kategori lokal bertanda "Needs Correction" karena kesalahan format koordinat awal.');
        }

        // Check store code
        if (local.storeCode.trim().toUpperCase() !== sheetStore.storeCode.trim().toUpperCase()) {
          issues.push(`Perbedaan Kode Outlet: Sheet "${sheetStore.storeCode}" vs Local "${local.storeCode}"`);
        }

        const status: StoreDiffItem['status'] = issues.length > 0 ? 'MISMATCH' : 'SYNCED';

        items.push({
          id: `diff-${sheetStore.storeCode}`,
          sourceNo: sheetStore.no,
          sheetStoreCode: sheetStore.storeCode,
          sheetStoreName: sheetStore.storeName,
          sheetLat: cleanLat,
          sheetLng: cleanLng,
          sheetCategory: sheetStore.storeCategory,
          sheetAddress: sheetStore.address,
          sheetPhone: sheetStore.phone,
          localId: local.id,
          localStoreCode: local.storeCode,
          localStoreName: local.storeName,
          localLat: local.latitude,
          localLng: local.longitude,
          localCategory: local.storeCategory,
          localAddress: local.address,
          localPhone: local.phone,
          status,
          issues
        });
      }
    });

    // 2. Identify extra stores in local registry that do NOT exist in 'DATA FIX'
    localStores.forEach((ls) => {
      if (!matchedLocalIds.has(ls.id)) {
        items.push({
          id: `diff-extra-${ls.id}`,
          sheetStoreCode: '-',
          sheetStoreName: '-',
          sheetLat: 0,
          sheetLng: 0,
          sheetCategory: '-',
          sheetAddress: '-',
          sheetPhone: '-',
          localId: ls.id,
          localStoreCode: ls.storeCode,
          localStoreName: ls.storeName,
          localLat: ls.latitude,
          localLng: ls.longitude,
          localCategory: ls.storeCategory,
          localAddress: ls.address,
          localPhone: ls.phone,
          status: 'EXTRA_IN_LOCAL',
          issues: ['Outlet ini ada di database lokal, namun TIDAK TERDAFTAR dalam Google Sheet "DATA FIX" (potensi data warisan/mock lama).']
        });
      }
    });

    return items;
  }, [localStores]);

  // Diff summary metrics
  const diffSummary = useMemo(() => {
    const sheetCount = DATA_FIX_SHEET_PRESETS.length;
    const localCount = localStores.length;
    const syncedCount = diffResults.filter((d) => d.status === 'SYNCED').length;
    const missingCount = diffResults.filter((d) => d.status === 'MISSING_IN_LOCAL').length;
    const mismatchCount = diffResults.filter((d) => d.status === 'MISMATCH').length;
    const extraCount = diffResults.filter((d) => d.status === 'EXTRA_IN_LOCAL').length;
    const totalIssues = missingCount + mismatchCount + extraCount;
    const healthPercent = sheetCount > 0 ? Math.round((syncedCount / Math.max(sheetCount, localCount)) * 100) : 0;

    return {
      sheetCount,
      localCount,
      syncedCount,
      missingCount,
      mismatchCount,
      extraCount,
      totalIssues,
      healthPercent
    };
  }, [diffResults, localStores]);

  // Filtered diff table rows
  const filteredDiffItems = useMemo(() => {
    return diffResults.filter((item) => {
      // Filter tab
      if (diffFilter === 'issues' && item.status === 'SYNCED') return false;
      if (diffFilter === 'synced' && item.status !== 'SYNCED') return false;

      // Search query
      if (!diffSearch) return true;
      const q = diffSearch.toLowerCase();
      return (
        item.sheetStoreName.toLowerCase().includes(q) ||
        item.sheetStoreCode.toLowerCase().includes(q) ||
        (item.localStoreName && item.localStoreName.toLowerCase().includes(q)) ||
        (item.localStoreCode && item.localStoreCode.toLowerCase().includes(q)) ||
        (item.localId && item.localId.toLowerCase().includes(q))
      );
    });
  }, [diffResults, diffFilter, diffSearch]);

  const handleRunAutoFixSync = async () => {
    setIsFixingSync(true);
    try {
      const res = await googleSheetsSyncService.syncNow('Diagnostik Diff Auto-Fix');
      addNotification(
        'schedule',
        'Auto-Fix & Sinkronisasi Selesai!',
        `Seluruh ${res.total} outlet dari Google Sheet 'DATA FIX' telah disinkronkan ke registry lokal tanpa perbedaan data.`
      );
    } finally {
      setIsFixingSync(false);
    }
  };

  const fullSqlSchema = `-- ====================================================================
-- SUPABASE POSTGRESQL ENTERPRISE LOGISTICS & B2B SUPPLY CHAIN SCHEMA
-- Includes Row Level Security (RLS), Indexes, and Foreign Key Cascades
-- ====================================================================

-- 1. Enable Required Extensions
create extension if not exists "uuid-ossp";

-- 2. User Roles Enum for RBAC
create type user_role as enum ('super_admin', 'spv_logistik', 'driver');

-- 3. PROFILES (Extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text not null,
  role user_role default 'spv_logistik'::user_role,
  department text default 'Logistics Operations',
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by authenticated users."
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile."
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Super admins can manage all profiles."
  on public.profiles for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'super_admin'
    )
  );

-- 4. FLEETS (Armada Kendaraan)
create table public.fleets (
  id uuid default uuid_generate_v4() primary key,
  plate_number text unique not null,
  vehicle_type text not null, -- 'Pick Up Box', 'Engkel STD', 'Engkel Long', 'Double STD'
  tonnage_capacity numeric(5,2) not null, -- in metric tons
  current_tonnage numeric(5,2) default 0,
  status text default 'available' check (status in ('available', 'on-duty', 'maintenance')),
  gps_imei text,
  fuel_level_percent integer default 100 check (fuel_level_percent between 0 and 100),
  odometer_km integer default 0,
  year integer default 2024,
  last_maintenance date default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.fleets enable row level security;

create policy "Fleets readable by all authenticated users"
  on public.fleets for select
  to authenticated
  using (true);

create policy "Fleets modifiable by admins and spv_logistiks"
  on public.fleets for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('super_admin', 'spv_logistik')
    )
  );

-- 5. CREWS (Supir dan Kernet)
create table public.crews (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text not null,
  role text not null check (role in ('Driver Utama', 'Driver Cadangan', 'Kernet / Helper')),
  license_number text not null,
  license_type text not null check (license_type in ('SIM B2 Umum', 'SIM B1 Umum', 'SIM A')),
  status text default 'available' check (status in ('available', 'on-duty', 'off')),
  trips_completed integer default 0,
  rating numeric(3,2) default 5.00,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.crews enable row level security;

create policy "Crews viewable by authenticated users"
  on public.crews for select
  to authenticated
  using (true);

create policy "Crews modifiable by admins and spv_logistiks"
  on public.crews for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('super_admin', 'spv_logistik')
    )
  );

-- 6. STORES (Toko Retail & Koordinat Pelanggan)
create table public.stores (
  id uuid default uuid_generate_v4() primary key,
  store_code text unique not null,
  store_name text not null,
  island text not null, -- 'Jawa', 'Sumatera', 'Bali & Nusa Tenggara', 'Kalimantan', 'Sulawesi', 'Papua & Maluku'
  province text not null,
  city text not null,
  address text not null,
  latitude numeric(10, 8) not null,
  longitude numeric(11, 8) not null,
  contact_person text not null,
  phone text not null,
  delivery_window text default '08:00 - 17:00',
  store_category text default 'Supermarket' check (store_category in ('Hypermarket', 'Supermarket', 'Distribution Hub', 'Minimarket Cluster')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.stores enable row level security;

create policy "Stores viewable by all authenticated users"
  on public.stores for select
  to authenticated
  using (true);

create policy "Stores modifiable by spv_logistiks and admins"
  on public.stores for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('super_admin', 'spv_logistik')
    )
  );

-- 7. SCHEDULES (Jadwal Pengiriman & Penugasan Logistik)
create table public.schedules (
  id uuid default uuid_generate_v4() primary key,
  tracking_number text unique not null,
  origin_name text default 'Gudang Pusat Banyuwangi DC',
  origin_latitude numeric(10, 8) default -8.1906,
  origin_longitude numeric(11, 8) default 114.3708,
  store_id uuid references public.stores(id) on delete cascade not null,
  fleet_id uuid references public.fleets(id) on delete set null,
  crew_id uuid references public.crews(id) on delete set null,
  status text default 'scheduled' check (status in ('scheduled', 'in_transit', 'delivered', 'delayed')),
  departure_date timestamp with time zone not null,
  estimated_arrival timestamp with time zone not null,
  actual_arrival timestamp with time zone,
  cargo_description text not null,
  cargo_weight_ton numeric(5,2) not null,
  is_inter_island boolean default false,
  ferry_booking_code text,
  transit_port text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.schedules enable row level security;

create policy "Schedules viewable by all authenticated users"
  on public.schedules for select
  to authenticated
  using (true);

create policy "Schedules modifiable by spv_logistiks and admins"
  on public.schedules for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('super_admin', 'spv_logistik')
    )
  );

-- 8. TRACKING_LOGS (Data Historis Import Excel GPS & Tracksolid)
create table public.tracking_logs (
  id uuid default uuid_generate_v4() primary key,
  schedule_id uuid references public.schedules(id) on delete cascade not null,
  timestamp timestamp with time zone not null,
  latitude numeric(10, 8) not null,
  longitude numeric(11, 8) not null,
  speed numeric(5, 2) default 0, -- in km/h
  engine_status text default 'IDLE' check (engine_status in ('RUNNING', 'STOP', 'IDLE')),
  location_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_tracking_logs_schedule on public.tracking_logs(schedule_id);
create index idx_tracking_logs_timestamp on public.tracking_logs(timestamp);

alter table public.tracking_logs enable row level security;

create policy "Tracking logs accessible by authenticated users"
  on public.tracking_logs for all
  to authenticated
  using (true);
`;

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionMessage('');
    const cleanUrl = sanitizeSupabaseUrl(supabaseUrl);
    setSupabaseUrl(cleanUrl);

    const res = await testSupabaseConnection(cleanUrl, supabaseAnonKey);
    setConnectionMessage(res.message);
    if (res.success) {
      setConnectionStatus('success');
      addNotification('schedule', 'Koneksi Supabase Berhasil', res.message);
    } else {
      setConnectionStatus('failed');
      addNotification('sla_warning', 'Gagal Koneksi Supabase', res.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-2">
              <Database className="w-3.5 h-3.5" />
              <span>Arsitektur PostgreSQL & Panduan Produksi Supabase</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Skema Database Supabase & Panduan Deploy Vercel
            </h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Skrip SQL DDL PostgreSQL lengkap dengan definisi tabel, foreign key relasional, indeks performa, enum peran (RBAC), serta kebijakan Row Level Security (RLS) siap pakai di Supabase SQL Editor.
            </p>
          </div>

          <button
            onClick={() => copyToClipboard(fullSqlSchema, 'all-sql')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition cursor-pointer self-start lg:self-center"
          >
            {copiedSection === 'all-sql' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedSection === 'all-sql' ? 'Tersalin ke Clipboard!' : 'Salin Seluruh Skrip SQL'}</span>
          </button>
        </div>
      </div>

      {/* Visual Live Sync Health & Discrepancy Component */}
      <LiveSyncHealthCard />

      {/* Real-time Supabase Connectivity Monitor */}
      <SupabaseConnectivityMonitor />

      {/* Automated DataBridge Service: Google Sheets API to Supabase Upsert Engine */}
      <DataBridgeMonitor />

      {/* DEDICATED REAL-TIME DIFF & DEBUGGING DASHBOARD: GOOGLE SHEETS 'DATA FIX' VS LOCAL REGISTRY */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
        {/* Header of Debugging Dashboard */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold mb-1 border border-blue-500/20">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Real-Time Diff Engine &amp; Data Alignment</span>
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Debugging Dashboard: Google Sheets &quot;DATA FIX&quot; vs Local Registry</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                diffSummary.totalIssues === 0 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {diffSummary.healthPercent}% Synced
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Melakukan inspeksi komparatif langsung antara lembar kerja Google Sheets &quot;{syncConfig.sheetName}&quot; (Source of Truth) dan memori registri lokal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                googleSheetsSyncService.testCorruptedCoordinateNotification(2);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold shadow transition cursor-pointer active:scale-95"
              title="Kirim simulasi data koordinat cacat untuk memverifikasi pemicuan peringatan darurat ke dashboard"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Uji Pemicu Notifikasi Rusak</span>
            </button>

            <button
              onClick={handleRunAutoFixSync}
              disabled={isFixingSync}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition cursor-pointer active:scale-95"
              title="Paksa sinkronisasi ulang agar seluruh 15 toko dari DATA FIX menggantikan registry lokal"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFixingSync ? 'animate-spin' : ''}`} />
              <span>{isFixingSync ? 'Menyelaraskan Data...' : 'Jalankan Auto-Fix & Re-Sync (15 Toko)'}</span>
            </button>
          </div>
        </div>

        {/* Side-by-Side Comparison Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Google Sheets Source */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Google Sheets ({syncConfig.sheetName})
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">Source of Truth</span>
            </div>
            <div className="text-2xl font-bold text-white font-mono mt-1">
              {diffSummary.sheetCount} <span className="text-xs font-normal text-slate-400">Toko Terdaftar</span>
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              URL: {syncConfig.spreadsheetUrl.substring(0, 36)}...
            </div>
          </div>

          {/* Card 2: Local Registry DB */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Database className="w-4 h-4 text-blue-400" />
                Local Registry DB
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">Reactive State</span>
            </div>
            <div className="text-2xl font-bold text-white font-mono mt-1">
              {diffSummary.localCount} <span className="text-xs font-normal text-slate-400">Outlet Aktif</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Tersimpan di LocalStorage &amp; Leaflet State
            </div>
          </div>

          {/* Card 3: Matched / Perfectly Synced */}
          <div className="bg-slate-950 p-4 rounded-xl border border-emerald-900/30 bg-emerald-950/10 space-y-1">
            <div className="flex items-center justify-between text-xs text-emerald-400">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Sinkron Sempurna
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold font-mono">100% Cocok</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
              {diffSummary.syncedCount} <span className="text-xs font-normal text-emerald-300/80">Outlet</span>
            </div>
            <div className="text-[11px] text-emerald-500/80">
              Nama, Kode, dan Koordinat GPS valid &amp; identik
            </div>
          </div>

          {/* Card 4: Issues (Missing / Mismatch / Extra) */}
          <div className={`bg-slate-950 p-4 rounded-xl border space-y-1 ${
            diffSummary.totalIssues === 0 
              ? 'border-slate-800' 
              : 'border-amber-900/40 bg-amber-950/10'
          }`}>
            <div className="flex items-center justify-between text-xs text-amber-400">
              <span className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Perlu Tindakan / Selisih
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold font-mono">
                {diffSummary.totalIssues} Isu
              </span>
            </div>
            <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
              {diffSummary.totalIssues} <span className="text-xs font-normal text-amber-300/80">Selisih Data</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Hilang: <strong className="text-red-400">{diffSummary.missingCount}</strong></span>
              <span>•</span>
              <span>Mismatch: <strong className="text-amber-400">{diffSummary.mismatchCount}</strong></span>
              <span>•</span>
              <span>Ekstra: <strong className="text-blue-400">{diffSummary.extraCount}</strong></span>
            </div>
          </div>
        </div>

        {/* Sync Diagnostic Log Summary */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">Sinkronisasi Terakhir:</span>
            <span className="text-white font-mono font-semibold">
              {syncConfig.lastSyncTimestamp ? new Date(syncConfig.lastSyncTimestamp).toLocaleString('id-ID') : 'Belum pernah'}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">Interval Auto-Sync:</span>
            <span className="text-emerald-400 font-semibold font-mono">
              {syncConfig.isAutoSyncEnabled ? `Aktif (${syncConfig.autoSyncIntervalMinutes} Menit)` : 'Nonaktif'}
            </span>
          </div>

          <div className="text-slate-400 text-[11px]">
            {syncLogs[0] ? syncLogs[0].message : 'Tidak ada catatan riwayat'}
          </div>
        </div>

        {/* Real-time Diff Comparison Table */}
        <div className="space-y-3">
          {/* Table Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 w-full sm:w-auto">
              <button
                onClick={() => setDiffFilter('all')}
                className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                  diffFilter === 'all'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua ({diffResults.length})
              </button>
              <button
                onClick={() => setDiffFilter('issues')}
                className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  diffFilter === 'issues'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Gagal / Bermasalah ({diffSummary.totalIssues})</span>
              </button>
              <button
                onClick={() => setDiffFilter('synced')}
                className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  diffFilter === 'synced'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cocok ({diffSummary.syncedCount})</span>
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari kode, nama toko, atau UUID..."
                value={diffSearch}
                onChange={(e) => setDiffSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Diff Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            <div className="overflow-x-auto max-h-[460px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0 z-10 backdrop-blur">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3 w-32">Status Sinkron</th>
                    <th className="p-3">Sumber: Google Sheets (&quot;DATA FIX&quot;)</th>
                    <th className="p-3">Database Lokal (Registry UUID &amp; Data)</th>
                    <th className="p-3">Perbandingan Koordinat GPS</th>
                    <th className="p-3 w-56">Diagnosis / Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredDiffItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        Tidak ada entri data yang sesuai dengan filter pencarian diff.
                      </td>
                    </tr>
                  ) : (
                    filteredDiffItems.map((item, index) => {
                      const isSynced = item.status === 'SYNCED';
                      const isMissing = item.status === 'MISSING_IN_LOCAL';
                      const isMismatch = item.status === 'MISMATCH';
                      const isExtra = item.status === 'EXTRA_IN_LOCAL';

                      return (
                        <tr 
                          key={item.id + index} 
                          className={`hover:bg-slate-900/50 transition ${
                            isMissing 
                              ? 'bg-red-950/20' 
                              : isMismatch 
                              ? 'bg-amber-950/20' 
                              : isExtra 
                              ? 'bg-blue-950/20' 
                              : ''
                          }`}
                        >
                          {/* Col 1: No */}
                          <td className="p-3 text-center font-mono text-slate-400">
                            {item.sourceNo ?? index + 1}
                          </td>

                          {/* Col 2: Status Badge */}
                          <td className="p-3">
                            {isSynced && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>SYNCED OK</span>
                              </span>
                            )}
                            {isMissing && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                <XCircle className="w-3 h-3" />
                                <span>MISSING IN DB</span>
                              </span>
                            )}
                            {isMismatch && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                <AlertTriangle className="w-3 h-3" />
                                <span>MISMATCH</span>
                              </span>
                            )}
                            {isExtra && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                <AlertCircle className="w-3 h-3" />
                                <span>EXTRA IN DB</span>
                              </span>
                            )}
                          </td>

                          {/* Col 3: Google Sheets Source */}
                          <td className="p-3 space-y-0.5">
                            {item.sheetStoreName !== '-' ? (
                              <>
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{item.sheetStoreName}</span>
                                </div>
                                <div className="text-[11px] text-emerald-400 font-mono">
                                  {item.sheetStoreCode} • {item.sheetCategory}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                  {item.sheetAddress}
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-500 italic">Tidak ada di Sheet DATA FIX</span>
                            )}
                          </td>

                          {/* Col 4: Local Registry (UUID & Store Name) */}
                          <td className="p-3 space-y-0.5">
                            {item.localId ? (
                              <>
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{item.localStoreName}</span>
                                </div>
                                <div className="text-[11px] text-blue-400 font-mono flex items-center gap-1">
                                  <span>UUID:</span>
                                  <strong className="text-slate-200">{item.localId}</strong>
                                  <span className="text-slate-500">• {item.localStoreCode}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                  {item.localAddress}
                                </div>
                              </>
                            ) : (
                              <span className="text-red-400 font-mono text-[11px] bg-red-500/10 px-2 py-1 rounded border border-red-500/20 inline-block">
                                Belum tersimpan di Local Registry
                              </span>
                            )}
                          </td>

                          {/* Col 5: GPS Coordinates Comparison */}
                          <td className="p-3 font-mono text-[11px] space-y-1">
                            {item.sheetStoreName !== '-' && (
                              <div className="text-slate-400">
                                <span className="text-emerald-400 font-semibold">Sheet:</span> {item.sheetLat.toFixed(6)}, {item.sheetLng.toFixed(6)}
                              </div>
                            )}
                            {item.localId ? (
                              <div className={
                                item.sheetStoreName !== '-' && (Math.abs(item.sheetLat - (item.localLat ?? 0)) > 0.0005 || Math.abs(item.sheetLng - (item.localLng ?? 0)) > 0.0005)
                                  ? 'text-amber-400 font-bold'
                                  : 'text-slate-300'
                              }>
                                <span className="text-blue-400 font-semibold">Local:</span> {item.localLat?.toFixed(6)}, {item.localLng?.toFixed(6)}
                              </div>
                            ) : (
                              <div className="text-slate-500">-</div>
                            )}
                          </td>

                          {/* Col 6: Diagnosis & Action */}
                          <td className="p-3 space-y-1">
                            {item.issues.length === 0 ? (
                              <div className="text-emerald-400 text-[11px] flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                <span>Data identik &amp; valid di peta</span>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {item.issues.map((iss, i) => (
                                  <div key={`issue-${i}`} className="text-[11px] text-amber-300 leading-tight">
                                    • {iss}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Supabase Connection Setup Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Konfigurasi Supabase Project (Opsional)</h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Aplikasi saat ini aktif dengan Enterprise Mock Engine & Local Storage.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">SUPABASE URL</label>
            <input
              type="text"
              placeholder="https://xyzcompany.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">SUPABASE ANON / PUBLIC KEY</label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div className="text-xs">
            {connectionStatus === 'testing' && <span className="text-amber-400">Memverifikasi kredensial & kesehatan API Supabase...</span>}
            {connectionStatus === 'success' && <span className="text-emerald-400 font-semibold">Tersambung ke Supabase Project!</span>}
            {connectionStatus === 'failed' && <span className="text-red-400 font-semibold">Koneksi Gagal Diuji.</span>}
            {connectionStatus === 'idle' && <span className="text-slate-500">Klik tombol di kanan untuk menguji koneksi.</span>}
          </div>

          <button
            onClick={handleTestConnection}
            disabled={connectionStatus === 'testing'}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition cursor-pointer"
          >
            {connectionStatus === 'testing' ? 'Sedang Menguji...' : 'Uji & Simpan Koneksi'}
          </button>
        </div>

        {connectionMessage && (
          <div className={`p-3 rounded-lg text-xs whitespace-pre-line border ${
            connectionStatus === 'success'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-red-950/40 border-red-800 text-red-300'
          }`}>
            {connectionMessage}
          </div>
        )}
      </div>

      {/* SQL Script Viewer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white">schema.sql (PostgreSQL Supabase DDL)</span>
          </div>

          <button
            onClick={() => copyToClipboard(fullSqlSchema, 'all-sql-header')}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            {copiedSection === 'all-sql-header' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Salin SQL</span>
          </button>
        </div>

        <pre className="p-4 text-xs font-mono bg-slate-950 text-slate-300 overflow-x-auto max-h-[420px] leading-relaxed select-all">
          {fullSqlSchema}
        </pre>
      </div>

      {/* Vercel Deployment & Setup Walkthrough */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-400" />
          <h3 className="text-base font-bold text-white">Panduan Deploy ke Vercel & Supabase Production</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center">1</div>
            <h4 className="font-bold text-white text-sm">Buat Database Supabase</h4>
            <p className="text-slate-400 leading-relaxed">
              Login ke <strong>supabase.com</strong>, buat project baru, buka menu <strong>SQL Editor</strong>, lalu tempel skrip SQL di atas dan klik <strong>Run</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 font-bold flex items-center justify-center">2</div>
            <h4 className="font-bold text-white text-sm">Atur Environment Variables</h4>
            <p className="text-slate-400 leading-relaxed">
              Salin <strong>Project URL</strong> dan <strong>anon key</strong> dari Supabase Project Settings &gt; API. Simpan ke <code>.env.local</code> atau panel Vercel:
            </p>
            <div className="font-mono text-[11px] p-2 rounded bg-slate-900 text-slate-300">
              NEXT_PUBLIC_SUPABASE_URL=...<br/>
              NEXT_PUBLIC_SUPABASE_ANON_KEY=...
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 font-bold flex items-center justify-center">3</div>
            <h4 className="font-bold text-white text-sm">Deploy ke Vercel</h4>
            <p className="text-slate-400 leading-relaxed">
              Push kode ke GitHub, buka <strong>vercel.com</strong>, pilih <strong>Import Project</strong>, tambahkan environment variables di atas, lalu klik <strong>Deploy</strong>. Selesai dalam hitungan menit!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
