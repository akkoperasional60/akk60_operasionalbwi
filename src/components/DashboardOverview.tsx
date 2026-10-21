import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, 
  Store, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  Ship, 
  Compass, 
  Radio, 
  FileSpreadsheet, 
  Plus, 
  Navigation, 
  Briefcase, 
  ShoppingBag,
  Calendar,
  Filter,
  RotateCcw,
  Gauge,
  User,
  Check,
  Fuel,
  Info,
  ChevronDown,
  Sparkles,
  MapPin,
  Eye,
  Users,
  ChevronRight,
  Wrench,
  Bell,
  ShieldAlert,
  Zap,
  Award,
  TrendingUp,
  Repeat,
  Sliders,
  Settings,
  X,
  Save,
  BarChart3
} from 'lucide-react';
import { FleetPerformanceInsight } from './FleetPerformanceInsight';
import { FleetTaxMonitoringPanel } from './FleetTaxMonitoringPanel';
import { DeliveryHeatmap } from './DeliveryHeatmap';
import { RouteSlaDeviationSummary } from './RouteSlaDeviationSummary';
import { FleetPerformanceSummaryWidget } from './FleetPerformanceSummaryWidget';
import { FleetLiveMap } from './FleetLiveMap';
import { WeeklyIdleReportWidget } from './WeeklyIdleReportWidget';
import { Schedule, Fleet, RetailStore, Crew, TracksolidDevice } from '../types';
import { logisticsStore } from '../services/store';
import { NavTab } from './Sidebar';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export interface NotificationThresholds {
  idleMinutesThreshold: number; // e.g. 60 mins (Fleet stationary/idle threshold)
  slaWarningPercentage: number; // e.g. 85% (SLA threshold)
  maxSpeedKmh: number; // e.g. 80 km/h (Speed overlimit threshold)
  maintenanceKmThreshold: number; // e.g. 500 km before target service
  taxExpirationDaysThreshold: number; // e.g. 30 days before tax/KIR expiry
  enableIdleAlerts: boolean;
  enableSlaAlerts: boolean;
  enableSpeedAlerts: boolean;
  enableMaintenanceAlerts: boolean;
}

export const DEFAULT_NOTIFICATION_THRESHOLDS: NotificationThresholds = {
  idleMinutesThreshold: 60,
  slaWarningPercentage: 85,
  maxSpeedKmh: 80,
  maintenanceKmThreshold: 500,
  taxExpirationDaysThreshold: 30,
  enableIdleAlerts: true,
  enableSlaAlerts: true,
  enableSpeedAlerts: true,
  enableMaintenanceAlerts: true,
};

interface NotificationThresholdModalProps {
  thresholds: NotificationThresholds;
  onSave: (newThresholds: NotificationThresholds) => void;
  onClose: () => void;
  onTestIdleAlert: (idleMins: number) => void;
}

const NotificationThresholdModal: React.FC<NotificationThresholdModalProps> = ({
  thresholds,
  onSave,
  onClose,
  onTestIdleAlert,
}) => {
  const [formState, setFormState] = useState<NotificationThresholds>(thresholds);
  const [isSaved, setIsSaved] = useState(false);

  const handlePreset = (type: 'standard' | 'strict' | 'relaxed') => {
    if (type === 'standard') {
      setFormState({
        ...DEFAULT_NOTIFICATION_THRESHOLDS,
      });
    } else if (type === 'strict') {
      setFormState({
        ...DEFAULT_NOTIFICATION_THRESHOLDS,
        idleMinutesThreshold: 30,
        slaWarningPercentage: 90,
        maxSpeedKmh: 75,
      });
    } else if (type === 'relaxed') {
      setFormState({
        ...DEFAULT_NOTIFICATION_THRESHOLDS,
        idleMinutesThreshold: 90,
        slaWarningPercentage: 80,
        maxSpeedKmh: 90,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formState);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-800/90 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sliders size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Konfigurasi Ambang Batas (Threshold) Notifikasi Logistik</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono border border-amber-500/30">
                  Akses Admin Logistik
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Atur aturan &amp; batas toleransi pengingat otomatis untuk armada idle, SLA pengiriman, dan pemeliharaan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/80 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Quick Preset Selector */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              ⚡ Preset Cepat Aturan Operasional
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handlePreset('standard')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
                  formState.idleMinutesThreshold === 60 && formState.slaWarningPercentage === 85
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-amber-400">Standar AKK</div>
                <div className="text-[10px] text-slate-400 font-normal">Idle 60 mnt | SLA 85%</div>
              </button>

              <button
                type="button"
                onClick={() => handlePreset('strict')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
                  formState.idleMinutesThreshold === 30 && formState.slaWarningPercentage === 90
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-xs'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-rose-400">Ketat (High Priority)</div>
                <div className="text-[10px] text-slate-400 font-normal">Idle 30 mnt | SLA 90%</div>
              </button>

              <button
                type="button"
                onClick={() => handlePreset('relaxed')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
                  formState.idleMinutesThreshold === 90 && formState.slaWarningPercentage === 80
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-xs'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-emerald-400">Longgar (Rute Jauh)</div>
                <div className="text-[10px] text-slate-400 font-normal">Idle 90 mnt | SLA 80%</div>
              </button>
            </div>
          </div>

          {/* Rule 1: Idle Stationary Alert Threshold (60 Minutes) */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Truck size={16} className="text-amber-400" />
                <span>1. Ambang Batas Armada Tidak Bergerak (Idle / Diam)</span>
              </label>
              <button
                type="button"
                onClick={() => setFormState(prev => ({ ...prev, enableIdleAlerts: !prev.enableIdleAlerts }))}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                  formState.enableIdleAlerts
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-700 text-slate-400 border-slate-600'
                }`}
              >
                {formState.enableIdleAlerts ? 'Aktif' : 'Non-Aktif'}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Kirim pengingat otomatis jika status GPS armada dalam rute pengiriman aktif diam/tidak bergerak melebihi batas waktu yang dikonfigurasi (misal: 60 menit).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-slate-950/80 p-3 rounded-lg border border-slate-800">
              <div className="sm:col-span-8 space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Batas Waktu Idle (Menit)</span>
                  <span className="font-mono font-bold text-amber-400">{formState.idleMinutesThreshold} Menit</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={180}
                  step={5}
                  value={formState.idleMinutesThreshold}
                  onChange={e => setFormState(prev => ({ ...prev, idleMinutesThreshold: Number(e.target.value) }))}
                  className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>15 mnt</span>
                  <span>60 mnt (Default)</span>
                  <span>180 mnt</span>
                </div>
              </div>

              <div className="sm:col-span-4 flex items-center justify-end gap-2">
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={formState.idleMinutesThreshold}
                  onChange={e => setFormState(prev => ({ ...prev, idleMinutesThreshold: Math.max(5, Number(e.target.value)) }))}
                  className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold text-right focus:outline-none focus:border-amber-400"
                />
                <span className="text-xs text-slate-400 font-medium">mnt</span>
              </div>
            </div>
          </div>

          {/* Rule 2: SLA Warning Threshold */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Gauge size={16} className="text-emerald-400" />
                <span>2. Ambang Batas Ketercapaian SLA Pengiriman (%)</span>
              </label>
              <button
                type="button"
                onClick={() => setFormState(prev => ({ ...prev, enableSlaAlerts: !prev.enableSlaAlerts }))}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                  formState.enableSlaAlerts
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-700 text-slate-400 border-slate-600'
                }`}
              >
                {formState.enableSlaAlerts ? 'Aktif' : 'Non-Aktif'}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tandai pengiriman sebagai 'Risiko SLA' dan ubah warna gauge meter menjadi merah saat ketercapaian SLA turun di bawah batas persentase ini.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-slate-950/80 p-3 rounded-lg border border-slate-800">
              <div className="sm:col-span-8 space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Persentase Kritis SLA</span>
                  <span className="font-mono font-bold text-emerald-400">{formState.slaWarningPercentage}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={95}
                  step={1}
                  value={formState.slaWarningPercentage}
                  onChange={e => setFormState(prev => ({ ...prev, slaWarningPercentage: Number(e.target.value) }))}
                  className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="sm:col-span-4 flex items-center justify-end gap-2">
                <input
                  type="number"
                  min={50}
                  max={99}
                  value={formState.slaWarningPercentage}
                  onChange={e => setFormState(prev => ({ ...prev, slaWarningPercentage: Number(e.target.value) }))}
                  className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold text-right focus:outline-none focus:border-emerald-400"
                />
                <span className="text-xs text-slate-400 font-medium">%</span>
              </div>
            </div>
          </div>

          {/* Rule 3: Speed Overlimit & Tax Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Speed Limit */}
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/80 space-y-2">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-rose-400" />
                <span>Batas Kecepatan Maks (km/jam)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={40}
                  max={130}
                  value={formState.maxSpeedKmh}
                  onChange={e => setFormState(prev => ({ ...prev, maxSpeedKmh: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-rose-400"
                />
                <span className="text-xs text-slate-400">km/h</span>
              </div>
            </div>

            {/* Tax Expiry Days */}
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/80 space-y-2">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock size={14} className="text-blue-400" />
                <span>Pengingat Pajak/KIR (Hari)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={90}
                  value={formState.taxExpirationDaysThreshold}
                  onChange={e => setFormState(prev => ({ ...prev, taxExpirationDaysThreshold: Number(e.target.value) }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-blue-400"
                />
                <span className="text-xs text-slate-400">Hari</span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onTestIdleAlert(formState.idleMinutesThreshold)}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Zap size={14} className="text-amber-400" />
              <span>Uji Notifikasi Idle ({formState.idleMinutesThreshold} mnt)</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                {isSaved ? <Check size={16} /> : <Save size={16} />}
                <span>{isSaved ? 'Tersimpan!' : 'Simpan Threshold Notifikasi'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DashboardOverviewProps {
  onNavigate: (tab: NavTab) => void;
}

interface SlaGaugeChartProps {
  value: number;
  target?: number;
  enableAnimation?: boolean;
  alertThreshold?: number;
}

const SlaGaugeChart: React.FC<SlaGaugeChartProps> = ({ 
  value, 
  target = 95.0, 
  enableAnimation = true,
  alertThreshold = 85 
}) => {
  const radius = 75;
  const strokeWidth = 14;
  const center = 100;
  const circumference = Math.PI * radius; // ~235.6
  
  const clampedValue = Math.min(100, Math.max(0, value));
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  const isBelowAlertThreshold = clampedValue < alertThreshold;

  let gaugeColor = "#10b981"; // Emerald
  let needleColor = "#ffffff";
  let textColorClass = "text-emerald-400";
  let statusBadge = "EXCELLENT (SLA TARGET MET)";
  let badgeStyle = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";

  if (clampedValue < alertThreshold) {
    gaugeColor = "#ef4444"; // Red
    needleColor = "#ef4444"; // Needle turns Red below threshold
    textColorClass = `text-rose-500 ${enableAnimation ? 'animate-pulse' : ''}`;
    statusBadge = `ALERT: SLA DROPPED BELOW ${alertThreshold}%`;
    badgeStyle = `bg-rose-500/25 text-rose-400 border-rose-500/50 shadow-sm ${enableAnimation ? 'animate-pulse' : ''}`;
  } else if (clampedValue < target) {
    gaugeColor = "#f59e0b"; // Amber
    needleColor = "#f59e0b";
    textColorClass = "text-amber-400";
    statusBadge = "ATTENTION (NEAR SLA LIMIT)";
    badgeStyle = "bg-amber-500/20 text-amber-400 border-amber-500/40";
  }

  const needleAngle = -90 + (clampedValue / 100) * 180;
  
  // 95% Target Notch Coordinates
  const targetRad = Math.PI - (target / 100) * Math.PI;
  const targetX = center + (radius + 2) * Math.cos(targetRad);
  const targetY = 100 - (radius + 2) * Math.sin(targetRad);

  // Alert Threshold Notch Coordinates
  const alertRad = Math.PI - (alertThreshold / 100) * Math.PI;
  const alertX = center + (radius + 2) * Math.cos(alertRad);
  const alertY = 100 - (radius + 2) * Math.sin(alertRad);

  const transitionClass = enableAnimation ? "transition-all duration-1000 ease-out" : "";
  const needleTransitionClass = enableAnimation ? "transition-transform duration-1000 ease-out" : "";

  return (
    <div className="flex flex-col items-center justify-center relative py-1">
      <svg width="220" height="125" viewBox="0 0 200 115" className="overflow-visible">
        <defs>
          <linearGradient id="gaugeBgGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
            <stop offset="60%" stopColor="#f59e0b" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.6} />
          </linearGradient>
          {enableAnimation && (
            <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          )}
        </defs>

        {/* Outer Background Track */}
        <path
          d="M 25 100 A 75 75 0 0 1 175 100"
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Color Gradient Track */}
        <path
          d="M 25 100 A 75 75 0 0 1 175 100"
          fill="none"
          stroke="url(#gaugeBgGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.3}
        />

        {/* Filled Gauge Arc */}
        <path
          d="M 25 100 A 75 75 0 0 1 175 100"
          fill="none"
          stroke={gaugeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={transitionClass}
          filter={enableAnimation ? "url(#gaugeGlow)" : undefined}
        />

        {/* Alert Threshold Notch */}
        <g>
          <circle cx={alertX} cy={alertY} r="3.5" fill="#ef4444" stroke="#0f172a" strokeWidth="1.5" />
          <text x={alertX - 22} y={alertY - 6} fill="#ef4444" fontSize="7.5" fontWeight="bold">
            Batas {alertThreshold}%
          </text>
        </g>

        {/* Target 95% Indicator Notch */}
        <g>
          <circle cx={targetX} cy={targetY} r="4" fill="#fbbf24" stroke="#0f172a" strokeWidth="1.5" />
          <text x={targetX - 10} y={targetY - 8} fill="#fbbf24" fontSize="8" fontWeight="bold">
            Target {target}%
          </text>
        </g>

        {/* Gauge Needle (Turns Red if below 85%) */}
        <g transform={`rotate(${needleAngle}, 100, 100)`} className={needleTransitionClass}>
          <line x1="100" y1="100" x2="100" y2="35" stroke={needleColor} strokeWidth="3" strokeLinecap="round" />
          <polygon points="97,100 103,100 100,30" fill={needleColor} />
          <circle cx="100" cy="100" r="6" fill={gaugeColor} stroke="#ffffff" strokeWidth="2" />
        </g>
      </svg>

      {/* Percentage Value Display (Turns Red below 85%) */}
      <div className="text-center -mt-5 space-y-0.5">
        <div className="text-3xl font-black font-mono tracking-tight flex items-center justify-center gap-0.5">
          <span className={isBelowAlertThreshold && enableAnimation ? "text-rose-500 animate-pulse" : isBelowAlertThreshold ? "text-rose-500" : "text-white"}>
            {clampedValue.toFixed(1)}
          </span>
          <span className={`${textColorClass} text-xl`}>%</span>
        </div>
        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
          Pencapaian SLA Realtime
        </div>
        <div className={`mt-1 px-3 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 shadow-xs ${badgeStyle}`}>
          <Gauge size={11} />
          <span>{statusBadge}</span>
        </div>
      </div>
    </div>
  );
};

const MONTH_OPTIONS = [
  'Semua Bulan',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
];

const YEAR_OPTIONS = ['2024', '2025', '2026', '2027'];

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const [schedules, setSchedules] = useState<Schedule[]>(logisticsStore.getSchedules());
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());
  const [stores, setStores] = useState<RetailStore[]>(logisticsStore.getStores());
  const [crews, setCrews] = useState<Crew[]>(logisticsStore.getCrews());
  const [devices, setDevices] = useState<TracksolidDevice[]>(logisticsStore.getDevices());

  // Filter States: Bulan, Tahun, dan Armada
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    try {
      return localStorage.getItem('akk_dashboard_filter_month') || 'September';
    } catch {
      return 'September';
    }
  });

  const [selectedYear, setSelectedYear] = useState<string>(() => {
    try {
      return localStorage.getItem('akk_dashboard_filter_year') || '2026';
    } catch {
      return '2026';
    }
  });

  const [selectedFleetId, setSelectedFleetId] = useState<string>(() => {
    try {
      return localStorage.getItem('akk_dashboard_filter_fleet') || 'all';
    } catch {
      return 'all';
    }
  });

  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // SLA Performance Card View Mode: 'gauge' (Realtime Gauge) vs 'trend' (Last 7 Days Area Chart)
  const [slaViewMode, setSlaViewMode] = useState<'gauge' | 'trend'>('gauge');

  // Custom Notification Thresholds State (Admin configured)
  const [notificationThresholds, setNotificationThresholds] = useState<NotificationThresholds>(() => {
    try {
      const saved = localStorage.getItem('akk_notification_thresholds_custom');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_NOTIFICATION_THRESHOLDS;
  });

  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);

  const handleSaveThresholds = (newThresholds: NotificationThresholds) => {
    setNotificationThresholds(newThresholds);
    try {
      localStorage.setItem('akk_notification_thresholds_custom', JSON.stringify(newThresholds));
    } catch (e) {
      console.error('Failed to save notification thresholds to localStorage:', e);
    }
  };

  const triggerIdleAlertTest = (idleMins: number) => {
    const activeSchedule = filteredSchedules.find(s => s.status === 'in_transit') || filteredSchedules[0];
    const plate = activeSchedule?.fleet?.plateNumber || 'P 9812 AK';
    const driver = activeSchedule?.crew?.name || 'Budi Santoso';
    const dest = activeSchedule?.store?.storeName || 'Indomaret Banyuwangi Super';

    logisticsStore.emitNotification(
      'sla_warning',
      `🛑 Peringatan Armada Tidak Bergerak (> ${idleMins} Menit): ${plate}`,
      `GPS mendeteksi armada ${plate} (${driver}) rute ke ${dest} telah diam/tidak bergerak selama ${idleMins} menit berturut-turut di Jalur Pantura. Harap lakukan konfirmasi ke driver!`,
      true
    );
  };

  // Toggle switch state for smooth animations (UI responsiveness on low-end devices)
  const [enableGaugeAnimation, setEnableGaugeAnimation] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('akk_sla_gauge_animation');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleGaugeAnimation = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEnableGaugeAnimation(prev => {
      const next = !prev;
      try {
        localStorage.setItem('akk_sla_gauge_animation', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Real-time SLA Tolerance Alert State & Cache Ref to prevent toast spamming
  const warnedSlaRef = React.useRef<Set<string>>(new Set());
  const warnedGeofenceRef = React.useRef<Set<string>>(new Set());
  const warnedCriticalRef = React.useRef<Set<string>>(new Set());
  const [slaAlertLastTriggered, setSlaAlertLastTriggered] = useState<string | null>(null);

  // Helper function to calculate SLA progression and tolerance
  const getScheduleSlaMetric = (sch: Schedule) => {
    const now = new Date().getTime();
    const departure = sch.departureDate ? new Date(sch.departureDate).getTime() : now - 4 * 3600000;
    const estimated = sch.estimatedArrival ? new Date(sch.estimatedArrival).getTime() : departure + 10 * 3600000;
    const totalSlaMs = Math.max(3600000, estimated - departure);
    const totalSlaHours = Number((totalSlaMs / (1000 * 3600)).toFixed(1));

    let elapsedMs = Math.max(0, now - departure);

    // Realistic elapsed simulation for mock/preset schedules in transit:
    if (departure < now - 24 * 3600000) {
      const seedRatios: Record<string, number> = {
        'sch-01': 0.88, // 88% - Mendekati batas toleransi SLA (Sisa 1.8 jam)
        'sch-02': 0.84, // 84% - Mendekati batas toleransi SLA
        'sch-03': 0.65, // 65% - On-track
        'sch-04': 0.15  // 15% - Scheduled
      };
      const ratio = seedRatios[sch.id] ?? (sch.status === 'in_transit' ? 0.82 : 0.4);
      elapsedMs = totalSlaMs * ratio;
    }

    const elapsedHours = Number((elapsedMs / (1000 * 3600)).toFixed(1));
    const remainingMs = Math.max(0, totalSlaMs - elapsedMs);
    const remainingMinutes = Math.round(remainingMs / (1000 * 60));
    const remainingHours = Number((remainingMinutes / 60).toFixed(1));
    const progressPercent = Math.min(100, Math.round((elapsedMs / totalSlaMs) * 100));

    // Ambang batas toleransi SLA: jika waktu tempuh >= 80% dari target SLA atau sisa toleransi <= 90 menit
    const isNearToleranceLimit = sch.status === 'in_transit' && (progressPercent >= 80 || remainingMinutes <= 90);
    const isExceeded = sch.status === 'in_transit' && progressPercent >= 100;

    return {
      totalSlaHours,
      elapsedHours,
      remainingMinutes,
      remainingHours,
      progressPercent,
      isNearToleranceLimit,
      isExceeded
    };
  };

  const triggerSlaToleranceAlert = (sch: Schedule, manual = false) => {
    const metrics = getScheduleSlaMetric(sch);
    const plate = sch.fleet?.plateNumber || sch.fleetId || 'Armada';
    const initialCode = sch.fleet?.initialCode ? `[${sch.fleet.initialCode}] ` : '';
    const driver = sch.crew?.name || 'Driver';
    const dest = sch.store?.storeName || 'Outlet Tujuan';

    logisticsStore.emitNotification(
      'sla_warning',
      `⚠️ Peringatan Toleransi SLA: ${initialCode}${plate}`,
      `Waktu tempuh armada ${initialCode}${plate} (${driver}) rute ke ${dest} telah mencapai ${metrics.progressPercent}% dari target SLA (${metrics.elapsedHours} jam / ${metrics.totalSlaHours} jam). Sisa toleransi waktu tiba tinggal ${metrics.remainingMinutes} menit sebelum melewati batas perjanjian layanan (SLA)!`,
      true
    );

    setSlaAlertLastTriggered(new Date().toLocaleTimeString('id-ID'));
  };

  useEffect(() => {
    const checkCriticalSchedules = () => {
      const schedules = logisticsStore.getSchedules();
      const crews = logisticsStore.getCrews();

      const today = new Date().toISOString().split('T')[0];
      const criticalSchedulesToday = schedules.filter(s => 
        s.status === 'scheduled' && 
        s.isInterIsland && 
        s.departureDate.startsWith(today)
      );
      
      const availableBackupDrivers = crews.filter(c => c.role === 'Driver Cadangan' && c.status === 'available');

      if (criticalSchedulesToday.length > 0 && availableBackupDrivers.length === 0) {
        const key = `crit-${today}-${criticalSchedulesToday.length}`;
        if (!warnedCriticalRef.current.has(key)) {
          warnedCriticalRef.current.add(key);
          logisticsStore.emitNotification(
            'schedule',
            '⚠️ Peringatan Kritis: Kekurangan Driver Cadangan',
            `Terdapat ${criticalSchedulesToday.length} jadwal pengiriman inter-island hari ini tanpa cadangan driver aktif.`,
            true
          );
        }
      }
    };

    const checkGeofencing = () => {
      const devices = logisticsStore.getDevices();
      const schedules = logisticsStore.getSchedules();
      const stores = logisticsStore.getStores();

      const RADIUS_KM = 5; // 5 km radius

      schedules.forEach(schedule => {
        if (schedule.status === 'in_transit' && schedule.storeId) {
          const store = stores.find(s => s.id === schedule.storeId);
          const device = devices.find(d => d.vehiclePlate === schedule.fleet?.plateNumber);

          if (store && device) {
            const distance = calculateDistance(
              device.latitude,
              device.longitude,
              store.latitude,
              store.longitude
            );

            if (distance > RADIUS_KM) {
              const geofenceKey = `gf-${schedule.id}-${device.vehiclePlate}`;
              if (!warnedGeofenceRef.current.has(geofenceKey)) {
                warnedGeofenceRef.current.add(geofenceKey);
                logisticsStore.emitNotification(
                  'geofence',
                  '📍 Peringatan Geofencing',
                  `Armada ${device.vehiclePlate} (${schedule.fleet?.plateNumber}) keluar dari radius area distribusi (${distance.toFixed(1)} km dari tujuan).`,
                  true
                );
              }
            }
          }
        }
      });
    };

    const checkSlaToleranceAlerts = () => {
      const allSchedules = logisticsStore.getSchedules();
      const inTransitSchedules = allSchedules.filter(s => s.status === 'in_transit');

      inTransitSchedules.forEach(sch => {
        const metrics = getScheduleSlaMetric(sch);
        if (metrics.isNearToleranceLimit && !warnedSlaRef.current.has(sch.id)) {
          warnedSlaRef.current.add(sch.id);
          triggerSlaToleranceAlert(sch);
        }
      });
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Initial check on load
    checkCriticalSchedules();
    checkGeofencing();
    checkSlaToleranceAlerts();

    // Periodic check every 30 seconds for live SLA tolerance monitoring
    const slaTimer = setInterval(() => {
      checkSlaToleranceAlerts();
    }, 30000);

    const unsubscribe = logisticsStore.subscribe(() => {
      setSchedules(logisticsStore.getSchedules());
      setFleets(logisticsStore.getFleets());
      setStores(logisticsStore.getStores());
      setCrews(logisticsStore.getCrews());
      setDevices(logisticsStore.getDevices());
      
      checkCriticalSchedules();
      checkGeofencing();
      checkSlaToleranceAlerts();
    });

    return () => {
      clearInterval(slaTimer);
      unsubscribe();
    };
  }, []);

  // Save filters to localStorage for persistence across tab navigation
  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    try {
      localStorage.setItem('akk_dashboard_filter_month', month);
    } catch {}
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    try {
      localStorage.setItem('akk_dashboard_filter_year', year);
    } catch {}
  };

  const handleFleetChange = (fleetId: string) => {
    setSelectedFleetId(fleetId);
    try {
      localStorage.setItem('akk_dashboard_filter_fleet', fleetId);
    } catch {}
  };

  const handleResetFilters = () => {
    setSelectedMonth('Semua Bulan');
    setSelectedYear('2026');
    setSelectedFleetId('all');
    try {
      localStorage.setItem('akk_dashboard_filter_month', 'Semua Bulan');
      localStorage.setItem('akk_dashboard_filter_year', '2026');
      localStorage.setItem('akk_dashboard_filter_fleet', 'all');
    } catch {}
  };

  const handleSetCurrentMonth = () => {
    setSelectedMonth('September');
    setSelectedYear('2026');
    try {
      localStorage.setItem('akk_dashboard_filter_month', 'September');
      localStorage.setItem('akk_dashboard_filter_year', '2026');
    } catch {}
  };

  // Selected Fleet Object & matching Tracksolid Device
  const selectedFleet = useMemo(() => {
    if (selectedFleetId === 'all') return null;
    return fleets.find(f => f.id === selectedFleetId) || null;
  }, [fleets, selectedFleetId]);

  const selectedCrew = useMemo(() => {
    if (!selectedFleet) return null;
    return crews.find(c => c.id === selectedFleet.driverId || c.currentFleetId === selectedFleet.id) || null;
  }, [crews, selectedFleet]);

  const matchedDevice = useMemo(() => {
    if (!selectedFleet) return null;
    return devices.find(d => 
      d.vehiclePlate === selectedFleet.plateNumber || 
      (selectedFleet.gpsImei && d.imei === selectedFleet.gpsImei)
    ) || null;
  }, [devices, selectedFleet]);

  // Filtered schedules based on Month, Year, and Fleet
  const filteredSchedules = useMemo(() => {
    return schedules.filter(sch => {
      // 1. Filter Armada
      if (selectedFleetId !== 'all' && sch.fleetId !== selectedFleetId) {
        return false;
      }

      // 2. Filter Tanggal (Bulan & Tahun)
      const dateStr = sch.departureDate || sch.createdAt;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          // Check Year
          if (selectedYear !== 'Semua Tahun' && d.getFullYear().toString() !== selectedYear) {
            return false;
          }

          // Check Month
          if (selectedMonth !== 'Semua Bulan') {
            const monthIdx = MONTH_OPTIONS.indexOf(selectedMonth) - 1; // 0 for Jan, 8 for Sep
            if (monthIdx >= 0 && d.getMonth() !== monthIdx) {
              return false;
            }
          }
        }
      }

      return true;
    });
  }, [schedules, selectedFleetId, selectedMonth, selectedYear]);

  // Derived KPI Metrics
  const activeDeliveries = useMemo(() => {
    return filteredSchedules.filter(s => s.status === 'in_transit');
  }, [filteredSchedules]);

  const overriddenSchedules = useMemo(() => {
    return schedules.filter(s => s.isUrgentOverride || (s.notes && (s.notes.toLowerCase().includes('override') || s.notes.toLowerCase().includes('darurat'))));
  }, [schedules]);

  const scheduledDeliveries = useMemo(() => {
    return filteredSchedules.filter(s => s.status === 'scheduled');
  }, [filteredSchedules]);

  const deliveredDeliveries = useMemo(() => {
    return filteredSchedules.filter(s => s.status === 'delivered');
  }, [filteredSchedules]);

  const totalFilteredCount = filteredSchedules.length;
  const interIslandCount = useMemo(() => {
    return filteredSchedules.filter(s => s.isInterIsland).length;
  }, [filteredSchedules]);

  // Real-time SLA Metrics Calculation for Supervisor Performance Metrics Card
  const realtimeSlaMetrics = useMemo(() => {
    const total = filteredSchedules.length;
    if (total === 0) {
      return {
        percentage: 98.6,
        onTimeCount: 0,
        totalEvaluated: 0,
        atRiskCount: 0,
        delayedCount: 0,
        targetSla: 95.0,
        avgBufferMins: 38
      };
    }

    let onTime = 0;
    let atRisk = 0;
    let delayed = 0;

    filteredSchedules.forEach(sch => {
      const metric = getScheduleSlaMetric(sch);
      if (sch.status === 'delivered') {
        onTime++;
      } else if (sch.status === 'in_transit') {
        if (metric.isExceeded) {
          delayed++;
        } else if (metric.isNearToleranceLimit) {
          atRisk++;
          onTime++; // still within SLA window
        } else {
          onTime++;
        }
      } else {
        onTime++;
      }
    });

    const percentage = Math.min(100, Math.max(0, Number(((onTime / total) * 100).toFixed(1))));

    return {
      percentage,
      onTimeCount: onTime,
      totalEvaluated: total,
      atRiskCount: atRisk,
      delayedCount: delayed,
      targetSla: 95.0,
      avgBufferMins: atRisk > 0 ? 18 : 42
    };
  }, [filteredSchedules]);

  // Last 7 Days SLA Trend Data for Area Chart Toggle
  const last7DaysSlaTrend = useMemo(() => {
    return [
      { day: 'Sen', date: '21 Sep', slaPercent: 96.2, deliveries: 18 },
      { day: 'Sel', date: '22 Sep', slaPercent: 98.4, deliveries: 22 },
      { day: 'Rab', date: '23 Sep', slaPercent: 94.1, deliveries: 19 },
      { day: 'Kam', date: '24 Sep', slaPercent: 97.8, deliveries: 25 },
      { day: 'Jum', date: '25 Sep', slaPercent: 99.0, deliveries: 28 },
      { day: 'Sab', date: '26 Sep', slaPercent: 95.5, deliveries: 20 },
      { day: 'Min', date: '27 Sep', slaPercent: realtimeSlaMetrics.percentage, deliveries: realtimeSlaMetrics.totalEvaluated || 15 }
    ];
  }, [realtimeSlaMetrics.percentage, realtimeSlaMetrics.totalEvaluated]);

  const avg7DaysSla = useMemo(() => {
    const sum = last7DaysSlaTrend.reduce((acc, curr) => acc + curr.slaPercent, 0);
    return Number((sum / last7DaysSlaTrend.length).toFixed(1));
  }, [last7DaysSlaTrend]);

  const onDutyFleets = fleets.filter(f => f.status === 'on-duty');
  const availableFleets = fleets.filter(f => f.status === 'available');
  const fleetUtilizationPercent = fleets.length > 0 ? Math.round((onDutyFleets.length / fleets.length) * 100) : 0;

  // Stores touched in filtered schedules
  const servedStoresCount = useMemo(() => {
    const storeIds = new Set(filteredSchedules.map(s => s.storeId));
    return storeIds.size > 0 ? storeIds.size : (selectedFleet ? 2 : stores.length);
  }, [filteredSchedules, stores, selectedFleet]);

  // Dynamic Chart Data generation based on Month & Fleet Filter
  const weeklyPerformanceData = useMemo(() => {
    const isSingleFleet = selectedFleetId !== 'all';
    const volumeMultiplier = isSingleFleet ? 0.22 : 1.0;

    // Days of week
    const baseDays = [
      { day: 'Sen', baseOnTime: 18, baseDelay: 1, baseVol: 240 },
      { day: 'Sel', baseOnTime: 22, baseDelay: 0, baseVol: 310 },
      { day: 'Rab', baseOnTime: 25, baseDelay: 1, baseVol: 350 },
      { day: 'Kam', baseOnTime: 20, baseDelay: 0, baseVol: 280 },
      { day: 'Jum', baseOnTime: 28, baseDelay: 2, baseVol: 410 },
      { day: 'Sab', baseOnTime: 16, baseDelay: 0, baseVol: 210 },
      { day: 'Min', baseOnTime: 12, baseDelay: 0, baseVol: 160 },
    ];

    // Seed modifier according to month name to show real variability
    const monthSeed = (MONTH_OPTIONS.indexOf(selectedMonth) + 1) * 3;

    return baseDays.map((b, idx) => {
      const dayFactor = 1 + ((idx + monthSeed) % 5) * 0.05;
      const vol = Math.round(b.baseVol * volumeMultiplier * dayFactor);
      const onTime = isSingleFleet 
        ? Math.max(1, Math.round((b.baseOnTime * 0.15))) 
        : Math.round(b.baseOnTime * dayFactor);
      const delay = Math.round(b.baseDelay * (isSingleFleet ? 0.3 : 1));

      return {
        day: b.day,
        PengirimanTepatWaktu: onTime,
        Tertunda: delay,
        VolumeTonase: vol
      };
    });
  }, [selectedMonth, selectedFleetId]);

  // Dynamic Customer Distribution per Area based on Fleet and Month
  const areaCustomerDistribution = useMemo(() => {
    // Dynamic month multiplier for realistic variation
    const monthSeed = Math.max(0, MONTH_OPTIONS.indexOf(selectedMonth));
    const mFactor = monthSeed <= 0 ? 1 : 1 + ((monthSeed % 4) - 1.5) * 0.05;

    // Filter by specific fleet
    if (selectedFleet) {
      const cap = selectedFleet.tonnageCapacity || 15;
      return [
        {
          area: 'Area Jawa Timur & Madura',
          shortName: 'Jatim & Madura',
          cities: 'Banyuwangi, Surabaya, Malang, Sidoarjo',
          customers: Math.max(2, Math.round(6 * (cap / 15))),
          shipments: Math.max(4, Math.round(12 * (cap / 15))),
          tonase: Math.round(cap * 2.4),
          armada: 1,
          color: '#3b82f6', // blue
          tag: 'Rute Langsung Hub Banyuwangi',
          keyClients: ['DC Retail Surabaya Rungkut', 'Wings Surya DC Surabaya', 'Pabrik Rokok Jatim']
        },
        {
          area: 'Area Bali & Nusa Tenggara',
          shortName: 'Bali & NT',
          cities: 'Denpasar, Badung, Gianyar, Mataram',
          customers: Math.max(1, Math.round(4 * (cap / 15))),
          shipments: Math.max(2, Math.round(8 * (cap / 15))),
          tonase: Math.round(cap * 1.6),
          armada: 1,
          color: '#10b981', // emerald
          tag: 'Ferry Ro-Ro Ketapang-Gilimanuk',
          keyClients: ['Grand Lucky Sanur Bali', 'Tiara Dewata Supermarket', 'Hardys Denpasar']
        },
        {
          area: 'Area Jawa Tengah & DIY',
          shortName: 'Jateng & DIY',
          cities: 'Semarang, Solo, Sleman',
          customers: Math.max(1, Math.round(2 * (cap / 15))),
          shipments: Math.max(1, Math.round(4 * (cap / 15))),
          tonase: Math.round(cap * 0.9),
          armada: 1,
          color: '#f59e0b', // amber
          tag: 'Jalur Tol Trans Jawa',
          keyClients: ['Super Indo Majapahit Semarang', 'Sentra Distributor Solo']
        }
      ];
    }

    // Default National Logistics Area Distribution
    return [
      {
        area: 'Area Jawa Timur & Madura',
        shortName: 'Jatim & Madura',
        cities: 'Banyuwangi, Surabaya, Sidoarjo, Malang',
        customers: Math.round(18 * mFactor),
        shipments: Math.round(42 * mFactor),
        tonase: Math.round(540 * mFactor),
        armada: 6,
        color: '#3b82f6',
        tag: 'Pusat Hub Banyuwangi DC',
        keyClients: ['DC Retail Surabaya Rungkut', 'Wings Surya Group', 'PT Mayora Indah Jawa Timur']
      },
      {
        area: 'Area Bali & Nusa Tenggara',
        shortName: 'Bali & NT',
        cities: 'Denpasar, Badung, Gianyar, Mataram',
        customers: Math.round(12 * mFactor),
        shipments: Math.round(28 * mFactor),
        tonase: Math.round(280 * mFactor),
        armada: 4,
        color: '#10b981',
        tag: 'Penyeberangan Selat Bali',
        keyClients: ['Grand Lucky Supermarket Sanur', 'Hypermart Bali Galeria', 'DC Ritel Badung']
      },
      {
        area: 'Area Jawa Tengah & DIY',
        shortName: 'Jateng & DIY',
        cities: 'Semarang, Solo, Kudus, Sleman',
        customers: Math.round(8 * mFactor),
        shipments: Math.round(18 * mFactor),
        tonase: Math.round(210 * mFactor),
        armada: 3,
        color: '#f59e0b',
        tag: 'Tol Trans Jawa & Pantura',
        keyClients: ['Super Indo Majapahit Semarang', 'Mitra Kemasan Solo', 'Sentra Industri Kudus']
      },
      {
        area: 'Area Jawa Barat & Jabodetabek',
        shortName: 'Jabar & Jabodetabek',
        cities: 'Bandung, Bekasi, Cikarang, Jakarta',
        customers: Math.round(6 * mFactor),
        shipments: Math.round(14 * mFactor),
        tonase: Math.round(170 * mFactor),
        armada: 2,
        color: '#6366f1',
        tag: 'Koridor Barat & Industri',
        keyClients: ['Transmart Buah Batu Bandung', 'PT Indomarco Prismatama', 'Lion Superindo Cikarang']
      },
      {
        area: 'Area Sumatera (Selatan & Utara)',
        shortName: 'Sumatera',
        cities: 'Lampung, Palembang, Medan',
        customers: Math.round(5 * mFactor),
        shipments: Math.round(9 * mFactor),
        tonase: Math.round(135 * mFactor),
        armada: 2,
        color: '#8b5cf6',
        tag: 'Lintas Bakauheni & Ro-Ro',
        keyClients: ['Mall Boemi Kedaton Lampung', 'Palembang Icon Retail Hub', 'Centre Point Medan']
      },
      {
        area: 'Area Kalimantan & Sulawesi',
        shortName: 'Kal-Sul',
        cities: 'Balikpapan, Banjarmasin, Makassar',
        customers: Math.round(3 * mFactor),
        shipments: Math.round(6 * mFactor),
        tonase: Math.round(95 * mFactor),
        armada: 1,
        color: '#06b6d4',
        tag: 'Tol Laut Ekspedisi Kapal',
        keyClients: ['Pentacity E-Walk Balikpapan', 'Duta Mall Banjarmasin', 'Trans Studio Makassar']
      }
    ];
  }, [selectedFleet, selectedMonth]);

  const totalPages = Math.ceil(areaCustomerDistribution.length / itemsPerPage);
  const paginatedAreas = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return areaCustomerDistribution.slice(startIndex, startIndex + itemsPerPage);
  }, [areaCustomerDistribution, currentPage]);

  const totalAccumulatedCustomers = useMemo(() => {
    return areaCustomerDistribution.reduce((acc, item) => acc + item.customers, 0);
  }, [areaCustomerDistribution]);

  const totalAccumulatedShipments = useMemo(() => {
    return areaCustomerDistribution.reduce((acc, item) => acc + item.shipments, 0);
  }, [areaCustomerDistribution]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              AKK Logistics &bull; Supply Chain Management System
            </span>
            <h1 className="text-2xl font-black text-white mt-1.5 tracking-tight">
              Dashboard Distribusi PT Anugrah Kemasan Kreatif
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Pusat Distribusi (AKK Banyuwangi DC) &bull; Pemantauan Pengiriman B2B Karton Box & Packaging ke Seluruh Retail Indonesia
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('schedules')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Jadwalkan Pengiriman</span>
            </button>
            <button
              onClick={() => onNavigate('customer_map')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold border border-emerald-500/40 shadow-sm transition cursor-pointer"
              title="Sinkronkan data toko retail dari sheet Google Sheets DATA FIX"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>Google Sheets (DATA FIX)</span>
            </button>
            <button
              onClick={() => onNavigate('tracking_eval')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Import Excel GPS</span>
            </button>
            <button
              onClick={() => onNavigate('analytics_reports')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold border border-amber-500/40 shadow-xs transition cursor-pointer"
              title="Buka Laporan Analitik Performa Armada & Kru"
            >
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <span>Analitik Performa</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER CONTROL BAR: SETTING BULAN, TAHUN, DAN PILIH ARMADA */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xs backdrop-blur">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5 mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 shrink-0">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Filter Periode &amp; Armada Distribusi</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Pilih rentang bulan, tahun, serta armada spesifik untuk memfilter data metrik dan rute
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSetCurrentMonth}
              className="px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
              title="Pilih Bulan Ini (September 2026)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Bulan Ini (Sep 2026)</span>
            </button>
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
              title="Kembalikan filter ke Semua Periode dan Semua Armada"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Form Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-center">
          {/* 1. Setting Bulan */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Bulan:</span>
            </label>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition cursor-pointer appearance-none pr-9 shadow-inner"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m} className="bg-slate-900 text-white">
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* 2. Setting Tahun */}
          <div className="lg:col-span-3 space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Tahun:</span>
            </label>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500 transition cursor-pointer appearance-none pr-9 shadow-inner"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y} className="bg-slate-900 text-white">
                    Tahun {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* 3. Pilih Armada */}
          <div className="lg:col-span-5 space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pilih Armada:</span>
            </label>
            <div className="relative">
              <select
                value={selectedFleetId}
                onChange={(e) => handleFleetChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 transition cursor-pointer appearance-none pr-9 truncate shadow-inner"
              >
                <option value="all" className="bg-slate-900 text-white font-bold">
                  🚚 Semua Armada ({fleets.length} Unit Truk)
                </option>
                {fleets.map((flt) => {
                  const c = crews.find(cr => cr.id === flt.driverId || cr.currentFleetId === flt.id);
                  return (
                    <option key={flt.id} value={flt.id} className="bg-slate-900 text-white">
                      {flt.initialCode ? `[${flt.initialCode}] ` : ''}{flt.plateNumber} - {flt.vehicleType} {c ? `[${c.name}]` : ''} ({flt.status.toUpperCase()})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Operational Efficiency Section */}
        <div className="mt-6 pt-6 border-t border-slate-800/80">
          <h3 className="text-sm font-bold text-white mb-4">Analisa Efisiensi Operasional</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fleets.map(f => {
              const logs = logisticsStore.getFuelLogs().filter(l => l.fleetId === f.id);
              const totalCost = logs.reduce((acc, l) => acc + l.totalCost, 0);
              const totalDist = logs.reduce((acc, l) => acc + l.distanceKm, 0);
              const costPerKm = totalDist > 0 ? (totalCost / totalDist).toFixed(2) : '0.00';
              
              return (
                <div key={f.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <div className="text-white font-bold">{f.plateNumber}</div>
                    <div className="text-xs text-slate-400">{f.vehicleType}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-400">Rp {costPerKm} / KM</div>
                    <div className="text-[10px] text-slate-500">Biaya Operasional</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter Summary Tags */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-400 font-medium">Filter Aktif:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-300 font-semibold flex items-center gap-1 shadow-xs">
            <Calendar className="w-3 h-3 text-blue-400" />
            <span>Periode: {selectedMonth} {selectedYear}</span>
          </span>
          <span className={`px-2.5 py-0.5 rounded-full border font-semibold flex items-center gap-1 shadow-xs ${
            selectedFleetId === 'all'
              ? 'bg-slate-800/80 border-slate-700 text-slate-300'
              : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
          }`}>
            <Truck className="w-3 h-3 text-emerald-400" />
            <span>
              Armada: {selectedFleet ? `${selectedFleet.plateNumber} (${selectedFleet.vehicleType})` : 'Semua Armada'}
            </span>
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 font-semibold shadow-xs">
            Hasil: {filteredSchedules.length} Pengiriman Terdata
          </span>
        </div>
      </div>

      {/* ARMADA SPOTLIGHT CARD (Tampil ketika user memilih armada spesifik) */}
      {selectedFleet && (
        <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-xl p-5 shadow-lg animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg font-black text-white tracking-wide">
                    {selectedFleet.plateNumber}
                  </span>
                  {selectedFleet.initialCode && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold border border-indigo-500/40">
                      Inisial: {selectedFleet.initialCode}
                    </span>
                  )}
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                    {selectedFleet.status === 'on-duty' ? 'ON-DUTY (AKTIF)' : selectedFleet.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-slate-300">
                  <strong>Inisial Mobil:</strong> <span className="font-mono font-bold text-emerald-400">{selectedFleet.initialCode || '-'}</span> &bull; <strong>Tipe:</strong> {selectedFleet.vehicleType} &bull; <strong>Kapasitas:</strong> {selectedFleet.tonnageCapacity || 15} Ton &bull; <strong>Kubikasi Box:</strong> <span className="font-mono text-cyan-400 font-bold">{selectedFleet.boxCapacityM3 || (selectedFleet.vehicleType.includes('Pick Up') ? 5.5 : selectedFleet.vehicleType.includes('Long') ? 14 : selectedFleet.vehicleType.includes('Engkel') ? 9 : 17.5)} m³</span>
                </div>
                <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                  <span>
                    <User className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                    <strong>Driver:</strong> {selectedCrew ? `${selectedCrew.name} (${selectedCrew.role})` : 'Belum Ditugaskan'}
                  </span>
                  {matchedDevice && (
                    <span className="text-cyan-400">
                      <Radio className="w-3.5 h-3.5 inline mr-1 text-cyan-400" />
                      <strong>Tracksolid GPS:</strong> {matchedDevice.address.substring(0, 45)}...
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onNavigate('spareparts')}
                className="px-3.5 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition border border-amber-500/30 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Sparepart & Rutin</span>
              </button>
              <button
                onClick={() => onNavigate('tracksolid')}
                className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Pantau GPS Tracksolid</span>
              </button>
              <button
                onClick={() => onNavigate('schedules')}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                <span>Riwayat Jadwal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards (Dynamic based on Month, Year, and Fleet Filter) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Deliveries */}
        <div
          onClick={() => onNavigate('schedules')}
          className="relative bg-slate-900 border border-slate-800/80 hover:border-blue-500/50 rounded-2xl p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer group overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-80" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              {selectedFleet ? 'Pengiriman Armada Ini' : 'Pengiriman Aktif'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform duration-200">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mt-2.5 tracking-tight">
            {activeDeliveries.length}
            <span className="text-xs font-normal text-slate-400 ml-2">
              {selectedFleet ? 'Trip Sedang Jalan' : 'Armada di Jalan'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-blue-400 mt-2.5 font-medium">
            <Ship className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{interIslandCount} Rute Luar Pulau (Ferry / Ro-Ro)</span>
          </div>
        </div>

        {/* Fleet On-Duty */}
        <div
          onClick={() => onNavigate('fleets')}
          className="relative bg-slate-900 border border-slate-800/80 hover:border-emerald-500/50 rounded-2xl p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer group overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-80" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              {selectedFleet ? 'Status Unit Terpilih' : 'Armada On-Duty'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform duration-200">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mt-2.5 tracking-tight">
            {selectedFleet 
              ? (selectedFleet.status === 'on-duty' ? 'ON-DUTY' : 'READY')
              : `${onDutyFleets.length} / ${fleets.length}`}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2.5">
            {selectedFleet ? (
              <>
                <span>Kap: <strong className="text-emerald-400 font-bold">{selectedFleet.tonnageCapacity || 15} Ton</strong> &bull; <strong className="text-cyan-400 font-bold">{selectedFleet.boxCapacityM3 || (selectedFleet.vehicleType.includes('Pick Up') ? 5.5 : selectedFleet.vehicleType.includes('Long') ? 14 : selectedFleet.vehicleType.includes('Engkel') ? 9 : 17.5)} m³</strong></span>
                <span>Odo: <strong className="text-white font-bold">{(selectedFleet.odometerKm || 120000).toLocaleString()} km</strong></span>
              </>
            ) : (
              <>
                <span>Ready: <strong className="text-emerald-400 font-bold">{availableFleets.length} Truk</strong></span>
                <span>Utilisasi: <strong className="text-white font-bold">{fleetUtilizationPercent}%</strong></span>
              </>
            )}
          </div>
        </div>

        {/* Retail Stores Covered */}
        <div
          onClick={() => onNavigate('customer_map')}
          className="relative bg-slate-900 border border-slate-800/80 hover:border-indigo-500/50 rounded-2xl p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer group overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-80" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              {selectedFleet ? 'Outlet Tujuan Armada' : 'Jaringan Retail Pelanggan'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform duration-200">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mt-2.5 tracking-tight">
            {servedStoresCount}
            <span className="text-xs font-normal text-slate-400 ml-2">Outlet Terdata</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-indigo-400 mt-2.5 font-medium">
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>Periode {selectedMonth} {selectedYear}</span>
          </div>
        </div>

        {/* On-Time Delivery Success Rate */}
        <div className="relative bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-xs overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-amber-500 opacity-80" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Tingkat Kesuksesan (SLA)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400 mt-2.5 tracking-tight font-mono">
            {realtimeSlaMetrics.percentage}%
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2.5">
            <span>Tepat Waktu ({selectedMonth})</span>
            <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">+0.4% MoM</span>
          </div>
        </div>
      </div>

      {/* PERFORMANCE METRICS CARD: REAL-TIME SLA ACHIEVEMENT GAUGE & TREND TOGGLE */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-4 backdrop-blur">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              {slaViewMode === 'gauge' ? <Gauge className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Performance Metrics &amp; Real-time SLA Gauge</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                  Live Supervisor Monitor
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Visualisasi persentase ketercapaian Service Level Agreement (SLA) &amp; grafik trend harian
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* View Mode Toggle Switch */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setSlaViewMode('gauge')}
                className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  slaViewMode === 'gauge' 
                    ? 'bg-emerald-600 text-white shadow-xs font-bold' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tampilkan Gauge Meter Realtime"
              >
                <Gauge size={13} />
                <span>Gauge Realtime</span>
              </button>
              <button
                onClick={() => setSlaViewMode('trend')}
                className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  slaViewMode === 'trend' 
                    ? 'bg-emerald-600 text-white shadow-xs font-bold' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tampilkan Grafik Area Trend 7 Hari Terakhir"
              >
                <TrendingUp size={13} />
                <span>Trend 7 Hari</span>
              </button>
            </div>

            <button
              onClick={() => onNavigate('crew_history')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Audit SLA Kru</span>
            </button>
            <button
              onClick={() => setIsThresholdModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-500/50 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Atur Ambang Batas (Threshold) Notifikasi Kustom"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Konfigurasi Threshold</span>
            </button>
            <button
              onClick={() => {
                const inTransit = filteredSchedules.find(s => s.status === 'in_transit') || filteredSchedules[0];
                if (inTransit) triggerSlaToleranceAlert(inTransit, true);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Tes Notifikasi SLA</span>
            </button>
          </div>
        </div>

        {/* Active Threshold Status Bar */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Bell className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Status Threshold Notifikasi Admin:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Idle: &gt;{notificationThresholds.idleMinutesThreshold} Mnt
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              SLA Alert: &lt;{notificationThresholds.slaWarningPercentage}%
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30">
              Speed Limit: &gt;{notificationThresholds.maxSpeedKmh} km/h
            </span>
            <button
              onClick={() => setIsThresholdModalOpen(true)}
              className="text-[10px] text-amber-400 hover:underline cursor-pointer ml-1 font-sans font-semibold"
            >
              [ Edit Threshold ]
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Left Column: Toggleable Interactive Chart (Gauge vs 7-Day Area Trend) */}
          <div 
            onClick={() => setSlaViewMode(prev => prev === 'gauge' ? 'trend' : 'gauge')}
            className="md:col-span-5 bg-slate-950/80 border border-slate-800/80 hover:border-emerald-500/50 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all relative group shadow-sm"
            title="Klik untuk beralih antara Gauge Realtime & Trend 7 Hari"
          >
            {/* Smooth Animation Toggle Switch (Top Left) & Quick Switch Overlay Hint (Top Right) */}
            <div className="w-full flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={toggleGaugeAnimation}
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition flex items-center gap-1.5 cursor-pointer z-10 ${
                  enableGaugeAnimation 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30' 
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title={enableGaugeAnimation ? 'Animasi Halus Aktif (Klik untuk matikan jika perangkat terasa lambat)' : 'Animasi Halus Non-Aktif (Mode Hemat Performa)'}
              >
                <Sparkles size={10} className={enableGaugeAnimation ? 'text-amber-300 animate-pulse' : 'text-slate-500'} />
                <span>Animasi: {enableGaugeAnimation ? 'ON' : 'OFF'}</span>
              </button>

              <div className="text-[9px] bg-slate-900/90 text-slate-400 group-hover:text-amber-300 px-2 py-0.5 rounded-full border border-slate-800 group-hover:border-amber-500/40 transition flex items-center gap-1">
                <Repeat size={10} className="animate-spin-slow" />
                <span>Klik ganti grafik</span>
              </div>
            </div>

            {slaViewMode === 'gauge' ? (
              <>
                <SlaGaugeChart 
                  value={realtimeSlaMetrics.percentage} 
                  target={realtimeSlaMetrics.targetSla} 
                  enableAnimation={enableGaugeAnimation}
                  alertThreshold={notificationThresholds.slaWarningPercentage}
                />
                
                <div className="w-full mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Target SLA Minim</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">{realtimeSlaMetrics.targetSla}%</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Status Pengiriman</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {realtimeSlaMetrics.percentage >= realtimeSlaMetrics.targetSla ? 'ON TARGET' : 'AT RISK'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full flex flex-col items-center justify-center py-1">
                <div className="w-full flex items-center justify-between px-1 mb-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1">
                    <TrendingUp size={14} className="text-emerald-400" />
                    <span>Trend SLA 7 Hari Terakhir</span>
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    Target {realtimeSlaMetrics.targetSla}%
                  </span>
                </div>

                <div className="w-full h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={last7DaysSlaTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="slaTrendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="day" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis domain={[80, 100]} stroke="#64748b" fontSize={10} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                        formatter={(val: any) => [`${val}%`, 'Pencapaian SLA']}
                        labelFormatter={(label, items) => {
                          const item = items[0]?.payload;
                          return item ? `${label} (${item.date}) - ${item.deliveries} Resi` : label;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="slaPercent"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#slaTrendGradient)"
                        dot={{ r: 3.5, fill: '#10b981', stroke: '#0f172a', strokeWidth: 1.5 }}
                        activeDot={{ r: 5, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="text-[10px] text-slate-400 text-center mt-1 flex items-center justify-center gap-1.5">
                  <span>Rata-rata 7 Hari:</span>
                  <strong className="text-emerald-400 font-mono text-xs">{avg7DaysSla}%</strong>
                  <span className="text-slate-500">&bull; Klik untuk ke Gauge</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Supervisor KPI Metrics Grid */}
          <div className="md:col-span-7 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Total Evaluated */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Pengiriman</span>
                <span className="text-xl font-mono font-black text-white mt-1 block">
                  {realtimeSlaMetrics.totalEvaluated} <span className="text-xs font-normal text-slate-400">Resi</span>
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">Periode {selectedMonth}</span>
              </div>

              {/* On-Time Count */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-emerald-500/30">
                <span className="text-[10px] text-emerald-400 font-semibold uppercase block">Tepat Waktu (On-Time)</span>
                <span className="text-xl font-mono font-black text-emerald-400 mt-1 block">
                  {realtimeSlaMetrics.onTimeCount} <span className="text-xs font-normal text-slate-400">Pengiriman</span>
                </span>
                <span className="text-[10px] text-emerald-300/80 mt-1 block font-medium">
                  {realtimeSlaMetrics.percentage}% dari Target
                </span>
              </div>

              {/* At Risk Count */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-amber-500/30">
                <span className="text-[10px] text-amber-400 font-semibold uppercase block">Toleransi Berisiko</span>
                <span className="text-xl font-mono font-black text-amber-400 mt-1 block">
                  {realtimeSlaMetrics.atRiskCount} <span className="text-xs font-normal text-slate-400">Armada</span>
                </span>
                <span className="text-[10px] text-amber-300/80 mt-1 block font-medium">
                  Progress &ge; 80% SLA
                </span>
              </div>
            </div>

            {/* SLA Status Bar & Supervisor Insight */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span>Ketercapaian SLA Pengiriman Logistik</span>
                </span>
                <span className="text-emerald-400 font-mono font-bold">
                  {realtimeSlaMetrics.percentage}% / 100%
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 via-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${realtimeSlaMetrics.percentage}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                💡 <strong>Supervisor Insight:</strong> Rata-rata buffer ketepatan waktu kedatangan armada di lokasi retail adalah <strong className="text-emerald-300">+{realtimeSlaMetrics.avgBufferMins} menit</strong> sebelum batas toleransi SLA. Sistem monitoring terus mengevaluasi pergerakan GPS armada secara aktif.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fleet Live Map (Peta Posisi Armada Realtime Tracksolid GPS) */}
      <FleetLiveMap />

      {/* Fleet Performance Summary Widget (Tracksolid Telemetry Aggregation) */}
      <FleetPerformanceSummaryWidget 
        devices={devices} 
        fleets={fleets} 
        onNavigateToTracking={() => onNavigate('tracksolid')} 
      />

      {/* Weekly Idle Report Summary Widget (7-Day Idle Telemetry Audit) */}
      <WeeklyIdleReportWidget 
        devices={devices} 
        fleets={fleets} 
      />

      {/* Analytics Charts Grid (Filtered by Month, Year, and Armada) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly Trend Chart */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Tren Performa Pengiriman: {selectedMonth} {selectedYear}</span>
                {selectedFleet && (
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                    {selectedFleet.plateNumber}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {selectedFleet 
                  ? `Grafik tonase muatan kargo dan ketepatan waktu khusus armada ${selectedFleet.plateNumber}`
                  : 'Jumlah pengiriman sukses vs tertunda serta total volume kargo tonase seluruh armada'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                Tepat Waktu
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                Volume (Ton)
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyPerformanceData}>
                <defs>
                  <linearGradient id="deliveryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="PengirimanTepatWaktu" stroke="#60a5fa" fillOpacity={1} fill="url(#deliveryGrad)" />
                <Area type="monotone" dataKey="VolumeTonase" stroke="#f59e0b" fillOpacity={0.2} fill="#f59e0b" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customer Distribution per Area (Distribusi Pelanggan per Area) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold mb-0.5">
                <Users className="w-3.5 h-3.5" />
                <span>DISTRIBUSI LOGISTIK</span>
              </div>
              <h3 className="text-sm font-bold text-white">
                {selectedFleet ? `Distribusi Pelanggan ${selectedFleet.plateNumber}` : 'Distribusi Pelanggan per Area'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedFleet 
                  ? `Alokasi pelanggan terlayani oleh unit ${selectedFleet.plateNumber}` 
                  : 'Akumulasi pelanggan & jadwal distribusi tim logistik'}
              </p>
            </div>

            {/* Akumulasi Badge */}
            <div className="text-right shrink-0 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Akumulasi</div>
              <div className="text-sm font-black text-amber-400">
                {totalAccumulatedCustomers} <span className="text-[10px] font-normal text-slate-400">Pelanggan</span>
              </div>
            </div>
          </div>

          {/* Quick Summary Pill for Logistics & Customer Accumulation */}
          <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80 text-center">
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Akumulasi Klien</div>
              <div className="text-xs font-black text-white mt-0.5">{totalAccumulatedCustomers} Toko / B2B</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Total Kirim</div>
              <div className="text-xs font-black text-blue-400 mt-0.5">{totalAccumulatedShipments} Ritase</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Cakupan Area</div>
              <div className="text-xs font-black text-emerald-400 mt-0.5">{areaCustomerDistribution.length} Wilayah</div>
            </div>
          </div>

          {/* Area List with Customer Accumulation and Logistics Dispatch Bars */}
          <div className="space-y-3 pt-1">
            {paginatedAreas.map(item => {
              const percent = totalAccumulatedCustomers > 0 
                ? Math.round((item.customers / totalAccumulatedCustomers) * 100)
                : 0;
              const isExpanded = expandedArea === item.area;

              return (
                <div 
                  key={item.area} 
                  onClick={() => setExpandedArea(isExpanded ? null : item.area)}
                  className="p-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-800/50 border border-slate-800/60 transition cursor-pointer space-y-1.5"
                >
                  <div className="flex justify-between items-baseline text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-slate-200 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-white truncate">{item.area}</span>
                    </div>
                    <div className="font-mono text-xs shrink-0 text-right">
                      <span className="font-bold text-amber-400">{item.customers} Pelanggan</span>
                      <span className="text-slate-400 text-[11px] ml-1.5">({item.shipments} Kirim)</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 px-0.5">
                    <span className="truncate">{item.cities}</span>
                    <span className="shrink-0 font-medium text-slate-300">{percent}% dari total</span>
                  </div>

                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.max(5, percent)}%`,
                        backgroundColor: item.color
                      }}
                    />
                  </div>

                  {/* Expandable Key Customers & Logistics Info */}
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-bold uppercase tracking-wider text-slate-400">Pelanggan Utama Terlayani:</span>
                        <span className="text-emerald-400 font-medium">{item.tag}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.keyClients.map((client, idx) => (
                          <span key={client + idx} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] border border-slate-700/60">
                            {client}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 font-mono">
                        <span>Tonase Kargo: {item.tonase} Ton</span>
                        <span>{item.armada} Armada Dikerahkan</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-50"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-2 py-1 rounded text-xs ${
                    currentPage === page 
                      ? 'bg-amber-600 text-white' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={() => onNavigate('customer_map')}
              className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <span>Buka Peta Sebaran Pelanggan</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Portals & Live Shipments (Filtered by Month, Year, and Fleet) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Shipments Table (Left) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Daftar Pengiriman: {selectedMonth} {selectedYear}</span>
                {selectedFleet && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">
                    {selectedFleet.plateNumber}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {filteredSchedules.length > 0
                  ? `Menampilkan ${filteredSchedules.length} pengiriman yang sesuai dengan filter yang dipilih`
                  : 'Tidak ada pengiriman tercatat untuk kombinasi periode dan armada ini'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const inTransit = filteredSchedules.find(s => s.status === 'in_transit') || filteredSchedules[0];
                  if (inTransit) {
                    triggerSlaToleranceAlert(inTransit, true);
                  }
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                title="Picu toast notifikasi SLA real-time secara instan"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Tes Notifikasi SLA</span>
              </button>
              <button
                onClick={() => onNavigate('schedules')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 shrink-0"
              >
                <span>Buka Modul Penjadwalan</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Visualisasi Heatmap Konsentrasi Area Pengiriman */}
          <DeliveryHeatmap />

          {/* Ringkasan Deviasi Durasi SLA per Rute Distribusi */}
          <RouteSlaDeviationSummary schedules={schedules} stores={stores} onNavigate={onNavigate} />

          {/* Banner Peringatan Dini Toleransi SLA Armada */}
          {filteredSchedules.some(s => s.status === 'in_transit' && getScheduleSlaMetric(s).isNearToleranceLimit) && (
            <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-rose-950/30 border border-amber-500/40 rounded-2xl p-4 shadow-lg space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl mt-0.5 animate-pulse shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                        Sistem Peringatan Dini Toleransi SLA (Real-Time Alert Engine)
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                        Mendekati Batas SLA
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Waktu tempuh armada pengiriman aktif telah melewati batas toleransi 80% dari target SLA. Sistem otomatis menembakkan notifikasi peringatan (toast) agar spv_logistik dapat mengantisipasi potensi keterlambatan.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => {
                      const target = filteredSchedules.find(s => s.status === 'in_transit' && getScheduleSlaMetric(s).isNearToleranceLimit) || filteredSchedules[0];
                      if (target) {
                        triggerSlaToleranceAlert(target, true);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    title="Picu toast notification peringatan SLA secara instan"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Picu Toast SLA</span>
                  </button>
                  <button
                    onClick={() => {
                      warnedSlaRef.current.clear();
                      const targets = filteredSchedules.filter(s => s.status === 'in_transit' && getScheduleSlaMetric(s).isNearToleranceLimit);
                      targets.forEach(t => triggerSlaToleranceAlert(t, true));
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition cursor-pointer"
                    title="Kirim ulang peringatan SLA ke semua armada yang berisiko"
                  >
                    <span>Kirim Ulang Semua</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            {filteredSchedules.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3 font-semibold">Resi / Toko Tujuan</th>
                    <th className="p-3 font-semibold">Armada &amp; Driver</th>
                    <th className="p-3 font-semibold">Rute &amp; Transit</th>
                    <th className="p-3 font-semibold">Waktu Tempuh &amp; SLA</th>
                    <th className="p-3 font-semibold">Status Toleransi SLA</th>
                    <th className="p-3 font-semibold text-center">Aksi Notifikasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredSchedules.slice(0, 6).map(sch => {
                    const slaMetric = getScheduleSlaMetric(sch);

                    return (
                      <tr key={sch.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3">
                          <div className="font-mono font-bold text-white text-xs">{sch.trackingNumber}</div>
                          <div className="text-slate-400 text-[11px] truncate max-w-[180px]">{sch.store?.storeName}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-mono font-bold text-slate-200">{sch.fleet?.plateNumber}</div>
                          <div className="text-slate-400 text-[11px]">{sch.crew?.name}</div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            sch.isInterIsland ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'
                          }`}>
                            {sch.isInterIsland ? 'Luar Pulau (Ferry)' : 'Tol Darat (Jawa)'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                            <span className="text-slate-300">{slaMetric.elapsedHours}j / {slaMetric.totalSlaHours}j</span>
                            <span className={`font-bold ${slaMetric.isNearToleranceLimit ? 'text-amber-400' : 'text-slate-400'}`}>
                              {slaMetric.progressPercent}% SLA
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                slaMetric.isNearToleranceLimit
                                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 animate-pulse'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${slaMetric.progressPercent}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            ETA: {new Date(sch.estimatedArrival).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="p-3">
                          {sch.status === 'in_transit' ? (
                            slaMetric.isNearToleranceLimit ? (
                              <span className="px-2 py-1 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1 animate-pulse">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                <span>Mendekati Batas SLA (Sisa {slaMetric.remainingMinutes} mnt)</span>
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-blue-400" />
                                <span>On-Track SLA (Sisa {slaMetric.remainingHours}j)</span>
                              </span>
                            )
                          ) : sch.status === 'delivered' ? (
                            <span className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Selesai (Tepat Waktu)</span>
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              Terjadwal
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => triggerSlaToleranceAlert(sch, true)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:text-amber-300 border border-slate-700 hover:border-amber-500/40 text-slate-300 text-[11px] font-semibold transition cursor-pointer inline-flex items-center gap-1 active:scale-95 shadow-xs"
                            title="Kirim Toast Notifikasi Peringatan SLA Armada Ini"
                          >
                            <Bell className="w-3 h-3 text-amber-400" />
                            <span>Picu Alert</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-10 text-center space-y-3 bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
                <Info className="w-8 h-8 text-slate-500 mx-auto" />
                <div>
                  <p className="text-xs font-semibold text-slate-300">
                    Tidak ada pengiriman pada {selectedMonth} {selectedYear}
                    {selectedFleet ? ` untuk armada ${selectedFleet.plateNumber}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ubah filter bulan/tahun di atas atau pilih &quot;Semua Bulan&quot; untuk melihat seluruh arsip pengiriman.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={handleResetFilters}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-lg transition"
                  >
                    Reset Filter
                  </button>
                  <button
                    onClick={() => onNavigate('schedules')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg transition"
                  >
                    Buat Jadwal Baru
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Launch Cards (Right) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Pantauan GPS Real-Time Tracksolid</h4>
              <p className="text-xs text-slate-400 mt-1">
                Akses langsung ke konsol telematika armada: status kontak ACC, kecepatan live, dan satelit GPS.
              </p>
            </div>
            <button
              onClick={() => onNavigate('tracksolid')}
              className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Buka Monitor Tracksolid</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Evaluasi Jalur GPS (Excel Upload)</h4>
              <p className="text-xs text-slate-400 mt-1">
                Unggah histori log koordinat Excel untuk menghitung idle time, deviasi rute, dan kepatuhan SLA.
              </p>
            </div>
            <button
              onClick={() => onNavigate('tracking_eval')}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Mulai Analisis Excel</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5 shadow-sm space-y-3 bg-gradient-to-b from-slate-900 to-amber-950/20">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Aktivitas Admin Penjualan</h4>
              <p className="text-xs text-slate-400 mt-1">
                Integrasi SO karton box, jadwal piket admin, checklist harian per bulan, dan SLA durasi muat armada di loading bay DC.
              </p>
            </div>
            <button
              onClick={() => onNavigate('sales_dashboard')}
              className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Buka Modul Admin Penjualan</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            <FleetPerformanceInsight />
          </div>
          
          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            <FleetTaxMonitoringPanel />
          </div>
        </div>
      </div>

      {/* Panel Histori Penugasan Override oleh Admin */}
      <div className="bg-slate-900 border border-rose-500/30 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Histori Penugasan Override (Bypass Aturan) oleh Admin</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {overriddenSchedules.length} Kasus
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Catatan audit operasional untuk penugasan yang melewati batas aturan baku (seperti supir lokal ke luar kota atau pasangan blacklist) dengan persetujuan darurat admin.
              </p>
            </div>
          </div>
        </div>

        {overriddenSchedules.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
            Belum ada histori penugasan yang di-override oleh admin. Semua pengiriman mematuhi standar aturan operasional reguler.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">Resi & Tujuan</th>
                  <th className="p-3 font-semibold">Armada</th>
                  <th className="p-3 font-semibold">Driver & Helper</th>
                  <th className="p-3 font-semibold">Admin / Operator</th>
                  <th className="p-3 font-semibold">Waktu / Tanggal</th>
                  <th className="p-3 font-semibold">Alasan / Catatan Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {overriddenSchedules.map((sch) => (
                  <tr key={sch.id} className="hover:bg-slate-800/50 transition">
                    <td className="p-3">
                      <div className="font-mono font-bold text-white">{sch.trackingNumber}</div>
                      <div className="text-[11px] text-slate-400">{sch.store?.storeName || sch.storeId}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-white">{sch.fleet?.plateNumber || sch.fleetId}</div>
                      <div className="text-[11px] text-slate-400">{sch.fleet?.vehicleType || 'Truck Unit'}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-white">{sch.crew?.name || 'Supir Ditugaskan'}</div>
                      <div className="text-[11px] text-slate-400">{sch.crewHelper?.name || 'Tanpa Helper'}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        Super Admin / Dispatcher
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-400">
                      {new Date(sch.departureDate).toLocaleDateString()} {new Date(sch.departureDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3">
                      <div className="text-rose-300 font-medium max-w-xs leading-relaxed">
                        {sch.notes || 'Override Darurat: Bypass aturan larangan luar kota / pasangan terlarang disetujui oleh manajemen.'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL KONFIGURASI AMBANG BATAS NOTIFIKASI KUSTOM */}
      {isThresholdModalOpen && (
        <NotificationThresholdModal
          thresholds={notificationThresholds}
          onSave={handleSaveThresholds}
          onClose={() => setIsThresholdModalOpen(false)}
          onTestIdleAlert={triggerIdleAlertTest}
        />
      )}
    </div>
  );
};
