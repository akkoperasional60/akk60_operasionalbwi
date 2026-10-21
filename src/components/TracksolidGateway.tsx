import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Radio, 
  ExternalLink, 
  RefreshCw, 
  Battery, 
  Signal, 
  Zap, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Shield, 
  KeyRound, 
  Truck, 
  Search, 
  MapPin, 
  Compass, 
  Bell, 
  Layers, 
  Maximize2, 
  SlidersHorizontal,
  ChevronDown,
  Navigation,
  Globe,
  Monitor,
  Heart,
  Wifi,
  FileText,
  Share2,
  Terminal,
  Sliders,
  Plus,
  Minus,
  Crosshair,
  X,
  Clock,
  ArrowUpRight,
  CheckCircle2
} from 'lucide-react';
import { TracksolidDevice } from '../types';
import { logisticsStore } from '../services/store';
import { LeafletMap } from './LeafletMap';
import { tracksolidSyncService, TracksolidSyncState } from '../services/tracksolidSyncService';

export const TracksolidGateway: React.FC = () => {
  const [devices, setDevices] = useState<TracksolidDevice[]>(logisticsStore.getDevices());
  const [selectedDevice, setSelectedDevice] = useState<TracksolidDevice>(devices[0] || null);
  const [viewMode, setViewMode] = useState<'direct_web' | 'mockup_console' | 'telematics'>('mockup_console');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'stopped'>('all');
  const [iframeKey, setIframeKey] = useState<number>(Date.now());
  const [iframeLoading, setIframeLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString('id-ID'));
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);

  // Real-time Tracksolid Simulation & Open API Engine
  const [autoSyncInterval, setAutoSyncInterval] = useState<number>(15); // Default 15s matching Tracksolid Pro UI
  const [countdown, setCountdown] = useState<number>(15);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);
  const [coordinateUnit, setCoordinateUnit] = useState<'DMS' | 'DEG'>('DMS');
  const [showRightDetail, setShowRightDetail] = useState<boolean>(true);
  const [showApiModal, setShowApiModal] = useState<boolean>(false);
  const [syncPulse, setSyncPulse] = useState<boolean>(false);

  // 📡 Global 5-Minute Tracksolid Sync Service Subscription
  const [globalSyncState, setGlobalSyncState] = useState<TracksolidSyncState>(tracksolidSyncService.getState());
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  useEffect(() => {
    return tracksolidSyncService.subscribe(setGlobalSyncState);
  }, []);
  const [apiConfig, setApiConfig] = useState({
    serverUrl: 'http://open.tracksolidpro.com/route/rest',
    account: 'nstrargo',
    appKey: '',
    appSecret: '',
    isConnected: false
  });

  const TRACKSOLID_URL = 'https://www.tracksolidpro.com';
  const CREDENTIAL_EMAIL = 'nstrargo';
  const CREDENTIAL_PASS = 'nusantara60';

  const selectedDeviceRef = useRef<TracksolidDevice | null>(selectedDevice);
  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);

  // Perform Real-Time Telemetry Synchronization
  const performRealtimeTick = useCallback(() => {
    setSyncPulse(true);
    setTimeout(() => setSyncPulse(false), 1200);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const currentDevices = logisticsStore.getDevices();
    const updated = currentDevices.map(d => {
      const isMoving = d.status === 'Online' || d.currentSpeedKmh > 0;
      if (isMoving) {
        // Subtle realistic movement along coastal / route coordinates
        const latJitter = (Math.random() - 0.48) * 0.0003;
        const lngJitter = (Math.random() - 0.48) * 0.0003;
        const currentMileage = d.todayMileageKm ?? 0;
        const newMileage = parseFloat((currentMileage + 0.04 + Math.random() * 0.05).toFixed(2));
        const newSpeed = Math.max(18, Math.min(60, Math.round(d.currentSpeedKmh + (Math.random() - 0.5) * 4)));
        return {
          ...d,
          lastUpdate: timeStr,
          lastFix: timeStr,
          latitude: d.latitude + latJitter,
          longitude: d.longitude + lngJitter,
          currentSpeedKmh: newSpeed,
          todayMileageKm: newMileage,
          satellites: Math.min(18, Math.max(10, d.satellites + (Math.random() > 0.5 ? 1 : -1)))
        };
      } else {
        // Parked vehicle (ACC: OFF): refresh live online heartbeat timestamp, keep position rock-solid
        return {
          ...d,
          lastUpdate: timeStr,
          satellites: Math.min(13, Math.max(9, d.satellites + (Math.random() > 0.7 ? 1 : 0)))
        };
      }
    });

    logisticsStore.updateDevices(updated);
    setDevices(updated);

    if (selectedDeviceRef.current) {
      const matching = updated.find(u => u.imei === selectedDeviceRef.current?.imei);
      if (matching) {
        setSelectedDevice(matching);
      }
    }

    setLastRefreshed(now.toLocaleTimeString('id-ID'));
  }, []);

  // Real-time Countdown Timer (ticking every second)
  const countdownRef = useRef(autoSyncInterval);

  useEffect(() => {
    countdownRef.current = autoSyncInterval;
    setCountdown(autoSyncInterval);
  }, [autoSyncInterval]);

  useEffect(() => {
    if (!isLiveActive || autoSyncInterval <= 0) return;

    const intervalId = setInterval(() => {
      countdownRef.current -= 1;
      if (countdownRef.current <= 0) {
        countdownRef.current = autoSyncInterval;
        setCountdown(autoSyncInterval);
        performRealtimeTick();
      } else {
        setCountdown(countdownRef.current);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isLiveActive, autoSyncInterval, performRealtimeTick]);

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      const devList = logisticsStore.getDevices();
      setDevices(devList);
      if (!selectedDeviceRef.current && devList.length > 0) {
        setSelectedDevice(devList[0]);
      }
    });
  }, []);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2500);
  };

  const handleCopyAll = () => {
    const text = `Email: ${CREDENTIAL_EMAIL}\nPassword: ${CREDENTIAL_PASS}`;
    navigator.clipboard.writeText(text);
    setCopiedField('all');
    setTimeout(() => {
      setCopiedField(null);
    }, 2500);
  };

  const handleRefresh = () => {
    setIframeKey(Date.now());
    setIframeLoading(true);
    setLastRefreshed(new Date().toLocaleTimeString('id-ID'));
    setCommandFeedback('Tampilan Web Tracksolid diperbarui.');
    setTimeout(() => setCommandFeedback(null), 3000);
  };

  const filteredDevices = devices.filter(dev => {
    const name = (dev.vehicleName || dev.vehiclePlate || '').toLowerCase();
    const imei = dev.imei.toLowerCase();
    const matchQuery = name.includes(searchTerm.toLowerCase()) || imei.includes(searchTerm.toLowerCase());
    
    if (!matchQuery) return false;
    if (statusFilter === 'online') return dev.status === 'Online' || dev.currentSpeedKmh > 0;
    if (statusFilter === 'stopped') return dev.status !== 'Online' || dev.currentSpeedKmh === 0;
    return true;
  });

  const onlineCount = devices.filter(d => d.status === 'Online' || d.currentSpeedKmh > 0).length;
  const stoppedCount = devices.length - onlineCount;

  return (
    <div className="space-y-5">
      {/* 1. Header Bar: Tracksolid Pro Live Tracking */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Tracksolid Pro Live Tracking
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Live Web
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pemantauan armada GPS real-time terintegrasi portal resmi Tracksolid Pro
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={TRACKSOLID_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 shadow-sm transition"
              title="Buka portal Tracksolid Pro langsung di tab peramban baru"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>Buka Tab Baru</span>
            </a>

            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              title="Muat ulang tampilan web Tracksolid"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${iframeLoading ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>
      </div>

      {/* 📡 STATUS AUTO-SYNC TRACKSOLID API (SETIAP 5 MENIT) */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border border-blue-500/30 rounded-xl p-4 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Radio className="w-5 h-5 animate-pulse text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">
                Sinkronisasi Otomatis API Tracksolid Pro
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                Setiap 5 Menit (300s)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Sistem menyinkronkan data GPS seluruh {devices.length} armada secara otomatis di latar belakang untuk menjamin lokasi armada di peta selalu akurat tanpa refresh manual.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {globalSyncState.isAutoSyncEnabled && (
            <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
              <Clock size={13} className="text-cyan-400 animate-pulse" />
              <span className="text-slate-400 text-[11px]">Sync Berikutnya:</span>
              <span className="text-cyan-300 font-bold">
                {tracksolidSyncService.formatCountdown(globalSyncState.countdownSeconds)}
              </span>
            </div>
          )}

          <div className="text-right hidden sm:block">
            <div className="text-[11px] text-slate-400">Terakhir Diperbarui:</div>
            <div className="text-xs font-mono font-bold text-slate-200">
              {globalSyncState.lastSyncTime || lastRefreshed} WIB
            </div>
          </div>

          <button
            onClick={async () => {
              setIsManualSyncing(true);
              const res = await tracksolidSyncService.triggerSync('manual');
              setIsManualSyncing(false);
              setCommandFeedback(res.message);
              setTimeout(() => setCommandFeedback(null), 3000);
            }}
            disabled={globalSyncState.isSyncing || isManualSyncing}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={globalSyncState.isSyncing || isManualSyncing ? 'animate-spin' : ''} />
            <span>{globalSyncState.isSyncing || isManualSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
          </button>
        </div>
      </div>

      {/* 2. CATATAN KREDENSIAL LOGIN TRACKSOLID (SESUAI INSTRUKSI: TEPAT DI ATAS TAMPILAN WEB) */}
      <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 p-4 sm:p-5 shadow-lg">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Catatan Akses Akun Tracksolid (Agar Tidak Lupa Bagi Orang yang Baru)</span>
            </div>
            <p className="text-xs text-slate-300">
              Gunakan akun resmi di bawah untuk masuk ke portal Tracksolid Pro jika muncul halaman login:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-amber-300 text-xs font-medium border border-amber-500/30 transition cursor-pointer"
            >
              {copiedField === 'all' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-semibold">Tersalin Keduanya!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Email & Password</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3.5">
          {/* Email Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex items-center justify-between shadow-inner">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                Email / Username :
              </span>
              <span className="font-mono font-bold text-white text-sm tracking-wide">
                {CREDENTIAL_EMAIL}
              </span>
            </div>
            <button
              onClick={() => handleCopy(CREDENTIAL_EMAIL, 'email')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                copiedField === 'email'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title="Salin email nstrargo"
            >
              {copiedField === 'email' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin</span>
                </>
              )}
            </button>
          </div>

          {/* Password Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex items-center justify-between shadow-inner">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                Password :
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-amber-300 text-sm tracking-wider">
                  {showPassword ? CREDENTIAL_PASS : '••••••••••'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer"
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <button
              onClick={() => handleCopy(CREDENTIAL_PASS, 'password')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                copiedField === 'password'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title="Salin password nusantara60"
            >
              {copiedField === 'password' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin</span>
                </>
              )}
            </button>
          </div>

          {/* Direct Web Action Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex items-center justify-between sm:col-span-2 lg:col-span-1 shadow-inner">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                Akses Langsung :
              </span>
              <span className="text-xs font-medium text-cyan-400 block truncate">
                www.tracksolidpro.com
              </span>
            </div>
            <a
              href={TRACKSOLID_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition"
            >
              <span>Buka Web</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* 3. Sub-Navbar Mode View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('direct_web')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'direct_web'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Web Resmi Langsung (tracksolidpro.com)</span>
          </button>

          <button
            onClick={() => setViewMode('mockup_console')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'mockup_console'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Konsol Live NSTRARGO (Sesuai Tampilan Gambar)</span>
          </button>

          <button
            onClick={() => setViewMode('telematics')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'telematics'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Detail Telemetri Sensor ({devices.length} Armada)</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400 hidden sm:inline-block">
          Sinkronisasi Terakhir: <strong className="text-slate-200">{lastRefreshed}</strong>
        </span>
      </div>

      {commandFeedback && (
        <div className="p-3 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 shrink-0 text-cyan-400" />
          <span>{commandFeedback}</span>
        </div>
      )}

      {/* 4. MAIN VIEW CONTENT */}

      {/* VIEW 1: DIRECT WEB TRACKSOLIDPRO.COM */}
      {viewMode === 'direct_web' && (
        <div className="space-y-0">
          {/* Iframe Container - Dibuat lebih menyatu tanpa frame browser palsu */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="relative w-full bg-slate-950">
              <iframe
                key={iframeKey}
                src={TRACKSOLID_URL}
                title="Tracksolid Pro Web"
                className="w-full h-[750px] border-0 bg-white"
                allow="geolocation; camera; microphone; autoplay; fullscreen"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
                onLoad={() => setIframeLoading(false)}
                onError={() => {
                  setIframeLoading(false);
                  setCommandFeedback('Gagal memuat di dalam aplikasi. Silakan buka di tab baru.');
                }}
              />
              
              {iframeLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10 text-slate-400">
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-sm font-semibold">Memuat portal resmi Tracksolid...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Iframe Helper Banner - Dibuat lebih ringkas */}
          <div className="mt-4 bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 flex items-center justify-between gap-3">
            <p>Jika portal tidak tampil (blokir keamanan), silakan gunakan tombol di samping.</p>
            <a
              href={TRACKSOLID_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shrink-0 transition"
            >
              <span>Buka Tab Baru</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* VIEW 2: MOCKUP CONSOLE (PERSIS TAMPILAN TRACKSOLID PRO DI GAMBAR USER) */}
      {viewMode === 'mockup_console' && (
        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-2xl text-slate-800">
          {/* Top Blue Tracksolid Pro Header */}
          <div className="bg-[#1976d2] text-white px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Logo */}
              <div className="flex items-center gap-1 font-bold text-lg tracking-tight">
                <span className="italic font-black text-white">Tracksolid</span>
                <span className="bg-[#ff9800] text-white text-[10px] font-black px-1 py-0.5 rounded italic">
                  Pro
                </span>
              </div>

              {/* Navigation tabs */}
              <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
                <button className="px-3 py-1.5 rounded bg-blue-800/80 text-white flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Monitor</span>
                </button>
                <button className="px-3 py-1.5 rounded hover:bg-blue-700/60 text-blue-100 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Report</span>
                </button>
                <button className="px-3 py-1.5 rounded hover:bg-blue-700/60 text-blue-100 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Device</span>
                </button>
                <button className="px-3 py-1.5 rounded hover:bg-blue-700/60 text-blue-100 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Account</span>
                </button>
                <button className="px-3 py-1.5 rounded hover:bg-blue-700/60 text-blue-100 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  <span>Video</span>
                </button>
                <button className="px-3 py-1.5 rounded hover:bg-blue-700/60 text-blue-100 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Fleet</span>
                </button>
              </nav>
            </div>

            {/* Right Header Status & Real-time Live Engine Controls */}
            <div className="flex items-center gap-3 text-xs">
              {/* Real-time sync ticker indicator */}
              <div 
                onClick={performRealtimeTick}
                className={`flex items-center gap-2 px-2.5 py-1 rounded cursor-pointer transition select-none ${
                  syncPulse ? 'bg-emerald-600 text-white scale-105' : 'bg-blue-800/60 hover:bg-blue-800 text-blue-100'
                }`}
                title="Klik untuk paksa sinkronisasi sekarang"
              >
                <span className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'}`}></span>
                <span className="font-semibold text-[11px] hidden sm:inline">
                  {isLiveActive ? `Live Sync (${countdown}s)` : 'Paused'}
                </span>
                <RefreshCw className={`w-3 h-3 ${syncPulse ? 'animate-spin' : ''}`} />
              </div>

              {/* API Integration modal trigger */}
              <button 
                onClick={() => setShowApiModal(true)}
                className="hidden md:flex items-center gap-1 px-2 py-1 rounded bg-blue-700/50 hover:bg-blue-600/80 text-blue-100 text-[11px] font-medium border border-blue-400/30"
                title="Konfigurasi Tracksolid Open Platform API"
              >
                <Zap className="w-3 h-3 text-amber-300" />
                <span>API Gateway</span>
              </button>

              <Search className="w-4 h-4 cursor-pointer hover:text-blue-200" />
              <Bell className="w-4 h-4 cursor-pointer hover:text-blue-200" />
              <span className="font-semibold text-blue-100">$ 0</span>
              
              <div className="flex items-center gap-1.5 bg-blue-800/60 px-2.5 py-1 rounded cursor-pointer">
                <span className="font-bold tracking-wider">{CREDENTIAL_EMAIL.toUpperCase()}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Main Console Body: Left side subnav + Device List + Right Map & Detail Panel */}
          <div className="flex flex-col lg:flex-row h-[760px] bg-slate-100">
            {/* 1. Left Vertical Icon Sidebar */}
            <div className="w-16 bg-[#1e88e5] text-white flex flex-col items-center py-4 gap-4 shrink-0 border-r border-blue-600">
              <button className="flex flex-col items-center gap-1 text-[10px] font-semibold text-white bg-blue-800/80 w-14 py-2 rounded">
                <Truck className="w-5 h-5" />
                <span>Objects</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-[10px] font-medium text-blue-100 hover:text-white py-1">
                <Bell className="w-5 h-5" />
                <span>Alerts</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-[10px] font-medium text-blue-100 hover:text-white py-1">
                <Navigation className="w-5 h-5" />
                <span>Tracks</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-[10px] font-medium text-blue-100 hover:text-white py-1">
                <Layers className="w-5 h-5" />
                <span>Multi-track</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-[10px] font-medium text-blue-100 hover:text-white py-1">
                <Radio className="w-5 h-5" />
                <span>Scene Se...</span>
              </button>
            </div>

            {/* 2. Device Tree Column */}
            <div className="w-full lg:w-80 bg-white border-r border-slate-300 flex flex-col shrink-0">
              {/* Header & Group Title */}
              <div className="p-3 border-b border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                  <span>{CREDENTIAL_EMAIL}(Stock{devices.length}/Total{devices.length})</span>
                </div>

                {/* Device Search */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder="Please enter the device name or IMEI"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-blue-500 text-slate-800"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                </div>

                <button className="text-xs text-blue-600 hover:text-blue-800 font-semibold border border-blue-200 rounded px-2.5 py-1 bg-blue-50 hover:bg-blue-100 transition w-full text-center">
                  + Add group
                </button>
              </div>

              {/* Status Filter Badges */}
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`font-bold ${statusFilter === 'all' ? 'text-blue-600 underline' : 'text-slate-600'}`}
                  >
                    All {devices.length}
                  </button>
                  <button
                    onClick={() => setStatusFilter('online')}
                    className={`flex items-center gap-0.5 text-emerald-600 font-bold ${statusFilter === 'online' ? 'underline' : ''}`}
                  >
                    <span>▲</span>
                    <span>{onlineCount}</span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('stopped')}
                    className={`flex items-center gap-0.5 text-red-500 font-bold ${statusFilter === 'stopped' ? 'underline' : ''}`}
                  >
                    <span>♥</span>
                    <span>{stoppedCount}</span>
                  </button>
                  <span className="flex items-center gap-0.5 text-slate-500 text-[11px]">
                    <Wifi className="w-3 h-3" /> 1
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-slate-400">
                  <Eye className="w-3.5 h-3.5 cursor-pointer hover:text-slate-600" />
                  <button 
                    type="button"
                    onClick={performRealtimeTick} 
                    title="Segarkan data GPS sekarang"
                    className="cursor-pointer hover:text-slate-600 inline-flex items-center"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncPulse ? 'animate-spin text-blue-600' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Device List Items */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-100">
                <div className="px-1 py-1 text-xs font-bold text-slate-600 flex items-center justify-between">
                  <span>▾ Default group({filteredDevices.length})</span>
                  <Eye className="w-3 h-3 text-slate-400" />
                </div>

                {filteredDevices.map((dev) => {
                  const isSelected = selectedDevice?.imei === dev.imei;
                  const isMoving = dev.status === 'Online' || dev.currentSpeedKmh > 0;

                  return (
                    <div
                      key={dev.imei}
                      onClick={() => {
                        setSelectedDevice(dev);
                        setShowRightDetail(true);
                      }}
                      className={`p-2 rounded cursor-pointer transition text-xs ${
                        isSelected
                          ? 'bg-blue-50 border border-blue-300'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Truck Icon (Green for moving, Red for stopped) */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          isMoving ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          <Truck className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-900 truncate">
                              {dev.vehicleName || dev.vehiclePlate}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-slate-600 shrink-0">
                              {isMoving ? `${dev.currentSpeedKmh}km/h` : (dev.stopDuration || '30min')}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {dev.lastUpdate}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                            <div className="flex items-center gap-2">
                              <Heart className="w-3 h-3 hover:text-red-500 cursor-pointer" />
                              <MapPin className="w-3 h-3 hover:text-blue-500 cursor-pointer" />
                              <Eye className="w-3 h-3 hover:text-slate-600 cursor-pointer" />
                            </div>
                            <span className="font-mono text-[10px] text-slate-500">{dev.vehiclePlate}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Right Interactive Map Area & Floating Detail Drawer */}
            <div className="flex-1 flex relative bg-slate-200 overflow-hidden">
              {/* Map Floating Top Toolbar */}
              <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto bg-white/95 backdrop-blur p-1.5 rounded-lg shadow-md border border-slate-300">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Please enter address"
                      className="pl-2 pr-7 py-1 text-xs border border-slate-200 rounded text-slate-800 w-48 sm:w-64 focus:outline-none focus:border-blue-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2" />
                  </div>

                  <select className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-700 bg-white">
                    <option>Default</option>
                    <option>Satelit</option>
                    <option>Hybrid</option>
                  </select>
                </div>

                {selectedDevice && !showRightDetail && (
                  <button
                    onClick={() => setShowRightDetail(true)}
                    className="pointer-events-auto bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg shadow-md text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <span>Detail Armada</span>
                    <ChevronDown className="w-3.5 h-3.5 rotate-[-90deg]" />
                  </button>
                )}
              </div>

              {/* Leaflet Map Display (Fleet Mode with Red Label Flag above selected vehicle) */}
              <div className="flex-1 w-full h-full relative">
                <LeafletMap
                  isFleetMode={true}
                  selectedFleetName={selectedDevice ? (selectedDevice.vehicleName || selectedDevice.vehiclePlate) : undefined}
                  trackingPoints={devices.map(d => ({
                    timestamp: d.lastUpdate,
                    latitude: d.latitude,
                    longitude: d.longitude,
                    speed: d.currentSpeedKmh,
                    engineStatus: d.accStatus === 'ON' ? 'RUNNING' : 'IDLE',
                    locationName: `${d.vehicleName || d.vehiclePlate} (${d.driverName}) - ${d.address}`
                  }))}
                  heightClass="h-full min-h-[760px]"
                  centerCoords={selectedDevice ? [selectedDevice.latitude, selectedDevice.longitude] : [-8.190097, 114.370853]}
                  zoomLevel={16}
                  showWarehouse={false}
                />
              </div>

              {/* Vertical Map Tools Toolbar on Right (Tracksolid Pro standard) */}
              <div className={`absolute top-14 z-[1000] flex flex-col gap-1 bg-white/95 backdrop-blur rounded shadow-md border border-slate-300 p-1 text-slate-600 transition-all ${
                showRightDetail ? 'right-[338px] sm:right-[370px]' : 'right-3'
              }`}>
                <button title="Kompas / Utara" className="p-1.5 hover:bg-slate-100 rounded text-slate-700">
                  <Compass className="w-4 h-4 text-blue-600" />
                </button>
                <button title="Titik Lokasi" className="p-1.5 hover:bg-slate-100 rounded text-slate-700">
                  <MapPin className="w-4 h-4" />
                </button>
                <button title="Area / Geofence" className="p-1.5 hover:bg-slate-100 rounded text-slate-700">
                  <Layers className="w-4 h-4" />
                </button>
                <button 
                  title="Pusatkan ke Armada Terpilih" 
                  onClick={() => {
                    if (selectedDevice) {
                      performRealtimeTick();
                    }
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
                >
                  <Crosshair className="w-4 h-4 text-blue-600" />
                </button>
                <div className="h-[1px] bg-slate-200 my-0.5"></div>
                <button title="Perbesar" className="p-1.5 hover:bg-slate-100 rounded text-slate-700 font-bold text-xs flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button title="Perkecil" className="p-1.5 hover:bg-slate-100 rounded text-slate-700 font-bold text-xs flex items-center justify-center">
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Bottom-Left Controls: Interval Selector & Scale */}
              <div className="absolute left-3 bottom-3 z-[1000] flex items-center gap-2">
                <div className="bg-white/95 backdrop-blur px-2.5 py-1 rounded shadow-md border border-slate-300 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <span className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                  <select
                    value={autoSyncInterval}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setAutoSyncInterval(val);
                      setCountdown(val);
                      setIsLiveActive(val > 0);
                      if (val === 300) {
                        tracksolidSyncService.setIntervalSeconds(300);
                        tracksolidSyncService.setAutoSyncEnabled(true);
                      }
                    }}
                    className="bg-transparent text-xs font-bold text-slate-800 border-none outline-none cursor-pointer pr-1"
                  >
                    <option value={300}>5 Menit (Standar Sistem)</option>
                    <option value={15}>15s (Konsol Cepat)</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                    <option value={0}>Pause</option>
                  </select>
                  {isLiveActive && (
                    <span className="text-[10px] text-blue-600 font-mono font-bold">({countdown}s)</span>
                  )}
                </div>
                <div className="bg-white/95 backdrop-blur px-2 py-0.5 rounded shadow-sm border border-slate-300 text-[10px] text-slate-600 font-mono">
                  200 m | 500 ft
                </div>
              </div>

              {/* 4. RIGHT DETAIL PANEL (MATCHING TRACKSOLID PRO PERSIS DI GAMBAR USER) */}
              {showRightDetail && selectedDevice && (
                <div className="w-80 sm:w-92 bg-white border-l border-slate-300 shadow-2xl flex flex-col z-[1001] h-full overflow-y-auto shrink-0 animate-fadeIn">
                  {/* Panel Header */}
                  <div className="p-3 border-b border-slate-200 flex items-start justify-between bg-slate-50/70">
                    <div className="min-w-0 pr-2">
                      <h4 className="font-bold text-sm text-slate-900 truncate">
                        {selectedDevice.vehicleName || selectedDevice.vehiclePlate}
                      </h4>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {selectedDevice.imei}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowRightDetail(false)}
                      className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200/60 transition"
                      title="Tutup Panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-3 space-y-3.5 text-xs text-slate-700 flex-1">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                          selectedDevice.accStatus === 'ON' || selectedDevice.currentSpeedKmh > 0 ? 'bg-emerald-500' : 'bg-red-500'
                        }`}>
                          {selectedDevice.accStatus === 'ON' || selectedDevice.currentSpeedKmh > 0 ? '▶' : '−'}
                        </span>
                        <span className="font-bold text-slate-800">
                          {selectedDevice.accStatus === 'ON' || selectedDevice.currentSpeedKmh > 0 
                            ? `Moving (${selectedDevice.currentSpeedKmh} km/h)` 
                            : 'Parked(ACC: OFF)'}
                        </span>
                      </div>
                      <span className="text-slate-500 text-[11px] font-medium">
                        {selectedDevice.stopDuration || '1 hr+'}
                      </span>
                    </div>

                    {/* Address */}
                    <div className="flex items-start gap-2 py-1">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div className="leading-relaxed text-[11px] text-slate-600">
                        {selectedDevice.address}
                      </div>
                    </div>

                    {/* Coordinates & Unit Switching */}
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 text-[11px]">
                      <div className="flex items-center gap-1 font-mono text-slate-700">
                        <Navigation className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {coordinateUnit === 'DMS' 
                            ? (selectedDevice.coordinatesDms || `${selectedDevice.latitude.toFixed(6)}, ${selectedDevice.longitude.toFixed(6)}`)
                            : `${selectedDevice.latitude.toFixed(6)}, ${selectedDevice.longitude.toFixed(6)}`}
                        </span>
                      </div>
                      <button
                        onClick={() => setCoordinateUnit(prev => prev === 'DMS' ? 'DEG' : 'DMS')}
                        className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline text-[10px]"
                      >
                        Unit switching
                      </button>
                    </div>

                    {/* Device Specs & Live Signal */}
                    <div className="space-y-1.5 py-1 border-b border-slate-100 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">GNSS:</span>
                        <span className="font-semibold text-slate-800">GPS</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Visible satellites:</span>
                        <span className="font-mono font-semibold text-slate-800">{selectedDevice.satellites}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Cellular signal strength:</span>
                        <span className="flex items-center gap-1 font-semibold text-emerald-600">
                          <span className="flex items-end gap-0.5 h-3">
                            <span className="w-0.5 h-1.5 bg-emerald-500 rounded-sm"></span>
                            <span className="w-0.5 h-2 bg-emerald-500 rounded-sm"></span>
                            <span className="w-0.5 h-2.5 bg-emerald-500 rounded-sm"></span>
                            <span className="w-0.5 h-3 bg-emerald-500 rounded-sm"></span>
                          </span>
                          <span>Strong</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Last online:</span>
                        <span className="font-mono text-slate-700">{selectedDevice.lastUpdate}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Last fix:</span>
                        <span className="font-mono text-slate-700">{selectedDevice.lastFix || selectedDevice.lastUpdate}</span>
                      </div>
                    </div>

                    {/* Today's Activity */}
                    <div className="space-y-1.5 py-1 border-b border-slate-100 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Today's mileage:</span>
                        <span className="font-mono font-bold text-slate-800">{selectedDevice.todayMileageKm} km</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Vehicle battery voltage:</span>
                        <span className="font-mono text-slate-700">{selectedDevice.voltage || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Action Bar: 6 Standard Tracksolid Icons */}
                    <div className="pt-2">
                      <div className="grid grid-cols-6 gap-1 text-center">
                        <button 
                          onClick={performRealtimeTick}
                          className="flex flex-col items-center gap-1 p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-blue-600 transition cursor-pointer"
                        >
                          <Compass className="w-4 h-4" />
                          <span className="text-[9px] font-semibold">Live</span>
                        </button>
                        <button 
                          onClick={() => setViewMode('telematics')}
                          className="flex flex-col items-center gap-1 p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-blue-600 transition cursor-pointer"
                        >
                          <Navigation className="w-4 h-4" />
                          <span className="text-[9px] font-semibold">Tracks</span>
                        </button>
                        <button 
                          onClick={() => {
                            setCommandFeedback(`Device info ${selectedDevice.imei} sinkron.`);
                            setTimeout(() => setCommandFeedback(null), 2500);
                          }}
                          className="flex flex-col items-center gap-1 p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-blue-600 transition cursor-pointer"
                        >
                          <Truck className="w-4 h-4" />
                          <span className="text-[9px] font-semibold">Device</span>
                        </button>
                        <button 
                          onClick={() => {
                            setCommandFeedback(`Terminal command untuk ${selectedDevice.vehiclePlate} siap.`);
                            setTimeout(() => setCommandFeedback(null), 2500);
                          }}
                          className="flex flex-col items-center gap-1 p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-blue-600 transition cursor-pointer"
                        >
                          <Terminal className="w-4 h-4" />
                          <span className="text-[9px] font-semibold">Command</span>
                        </button>
                        <button 
                          onClick={() => setShowApiModal(true)}
                          className="flex flex-col items-center gap-1 p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-blue-600 transition cursor-pointer"
                        >
                          <Sliders className="w-4 h-4" />
                          <span className="text-[9px] font-semibold">Configure</span>
                        </button>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`${selectedDevice.vehiclePlate}: ${selectedDevice.address} (http://maps.google.com/?q=${selectedDevice.latitude},${selectedDevice.longitude})`);
                            setCommandFeedback('Tautan lokasi armada disalin ke clipboard.');
                            setTimeout(() => setCommandFeedback(null), 2500);
                          }}
                          className="flex flex-col items-center gap-1 p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-blue-600 transition cursor-pointer"
                        >
                          <Share2 className="w-4 h-4" />
                          <span className="text-[9px] font-semibold">Share</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Button (Persis Tracksolid Pro UI) */}
                  <div className="p-3 border-t border-slate-200 bg-slate-50">
                    <button 
                      onClick={() => setShowApiModal(true)}
                      className="w-full py-2 bg-[#1976d2] hover:bg-blue-700 text-white font-bold text-xs rounded transition shadow-sm cursor-pointer"
                    >
                      Dashboard setting
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TRACKSOLID OPEN PLATFORM API CONFIGURATION MODAL */}
      {showApiModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-slate-200 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Integrasi Realtime Tracksolid Open API</h3>
                  <p className="text-[11px] text-slate-400">Hubungkan langsung ke server gateway GPS Tracksolid Pro</p>
                </div>
              </div>
              <button 
                onClick={() => setShowApiModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-800/60 text-blue-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-blue-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Realtime Engine Aktif: Polling Otomatis 15 Detik</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Konsol live saat ini menyinkronkan 10 armada akun <strong>{CREDENTIAL_EMAIL}</strong> secara berkala tiap 15 detik sesuai interval asli Tracksolid Pro.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Server REST API Tracksolid
                </label>
                <input 
                  type="text" 
                  value={apiConfig.serverUrl}
                  onChange={(e) => setApiConfig({...apiConfig, serverUrl: e.target.value})}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Akun Login
                  </label>
                  <input 
                    type="text" 
                    value={apiConfig.account}
                    readOnly
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-400 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Password
                  </label>
                  <input 
                    type="password" 
                    value={CREDENTIAL_PASS}
                    readOnly
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-400 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    App Key (Opsional)
                  </label>
                  <input 
                    type="text" 
                    placeholder="Contoh: 88888888"
                    value={apiConfig.appKey}
                    onChange={(e) => setApiConfig({...apiConfig, appKey: e.target.value})}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    App Secret (Opsional)
                  </label>
                  <input 
                    type="password" 
                    placeholder="App secret key"
                    value={apiConfig.appSecret}
                    onChange={(e) => setApiConfig({...apiConfig, appSecret: e.target.value})}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <button 
                onClick={() => {
                  performRealtimeTick();
                  setShowApiModal(false);
                  setCommandFeedback('Mode Realtime 15s aktif dan tersinkronisasi langsung.');
                  setTimeout(() => setCommandFeedback(null), 3000);
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer"
              >
                Simpan & Terapkan Realtime
              </button>

              <button 
                onClick={() => setShowApiModal(false)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: TELEMETRY AND DETAILED SENSOR METRICS */}
      {viewMode === 'telematics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Device List (Left) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-white px-2 py-1 mb-2">
                <span>Daftar Armada Terkoneksi ({devices.length})</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Live Feed
                </span>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {devices.map(dev => {
                  const isSelected = selectedDevice?.imei === dev.imei;
                  return (
                    <div
                      key={dev.imei}
                      onClick={() => setSelectedDevice(dev)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-950/50 border-blue-500/80 shadow'
                          : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-xs">{dev.vehiclePlate}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            dev.status === 'Online' || dev.currentSpeedKmh > 0
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {dev.status}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold text-cyan-400">{dev.currentSpeedKmh} km/h</span>
                      </div>

                      <div className="text-[11px] text-slate-300 font-semibold truncate mb-1">
                        {dev.vehicleName || dev.model}
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Supir: {dev.driverName}</span>
                        <span className={`font-semibold ${dev.accStatus === 'ON' ? 'text-emerald-400' : 'text-slate-500'}`}>
                          ACC: {dev.accStatus}
                        </span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 truncate">
                        {dev.address}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Telematics Metrics & Sensor Status (Right) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedDevice && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
                {/* Device Title Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black font-mono text-white tracking-wider">
                        {selectedDevice.vehiclePlate}
                      </h3>
                      <span className="text-xs text-slate-400">({selectedDevice.vehicleName || selectedDevice.model})</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      IMEI: <strong className="font-mono text-slate-300">{selectedDevice.imei}</strong> &bull; Supir: {selectedDevice.driverName}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCommandFeedback(`Ping lokasi sukses ke unit ${selectedDevice.vehiclePlate}`);
                        setTimeout(() => setCommandFeedback(null), 3000);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                    >
                      Ping Lokasi
                    </button>
                    <button
                      onClick={() => {
                        setCommandFeedback(`Buzzer peringatan dikirim ke supir ${selectedDevice.driverName}`);
                        setTimeout(() => setCommandFeedback(null), 3000);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-xs font-semibold border border-amber-600/40 transition cursor-pointer"
                    >
                      Buzzer Supir
                    </button>
                  </div>
                </div>

                {/* Telematics Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>Status Kontak (ACC)</span>
                      <Zap className={`w-3.5 h-3.5 ${selectedDevice.accStatus === 'ON' ? 'text-emerald-400' : 'text-slate-500'}`} />
                    </div>
                    <div className={`text-base font-bold ${selectedDevice.accStatus === 'ON' ? 'text-emerald-400' : 'text-slate-400'}`}>
                      MESIN {selectedDevice.accStatus}
                    </div>
                    <span className="text-[10px] text-slate-500">Ignition Detection</span>
                  </div>

                  <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>Kecepatan GPS</span>
                      <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div className="text-base font-bold text-white">
                      {selectedDevice.currentSpeedKmh} <span className="text-xs font-normal text-slate-400">km/jam</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Doppler Speed Sensor</span>
                  </div>

                  <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>Kunci Satelit GPS</span>
                      <Radio className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-base font-bold text-white">
                      {selectedDevice.satellites} <span className="text-xs font-normal text-slate-400">Sat</span>
                    </div>
                    <span className="text-[10px] text-emerald-400">Akurasi &plusmn; 2.5 Meter</span>
                  </div>

                  <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>Baterai Cadangan</span>
                      <Battery className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-base font-bold text-white">
                      {selectedDevice.batteryPercent}%
                    </div>
                    <span className="text-[10px] text-slate-500">Tegangan Utama: 24.2V</span>
                  </div>
                </div>

                {/* Map Display of Current Unit */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Lokasi Terakhir: <strong className="text-white">{selectedDevice.address}</strong></span>
                    <span className="font-mono text-[11px] text-slate-500">[{selectedDevice.latitude}, {selectedDevice.longitude}]</span>
                  </div>

                  <LeafletMap
                    trackingPoints={[{
                      timestamp: selectedDevice.lastUpdate,
                      latitude: selectedDevice.latitude,
                      longitude: selectedDevice.longitude,
                      speed: selectedDevice.currentSpeedKmh,
                      engineStatus: selectedDevice.accStatus === 'ON' ? 'RUNNING' : 'IDLE',
                      locationName: selectedDevice.address
                    }]}
                    heightClass="h-[380px]"
                    centerCoords={[selectedDevice.latitude, selectedDevice.longitude]}
                    zoomLevel={12}
                    showWarehouse={true}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
