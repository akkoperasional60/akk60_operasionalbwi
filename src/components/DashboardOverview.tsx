import React from 'react';
import { Truck, Clock, Sparkles } from 'lucide-react';
import { NavTab } from './Sidebar';

export interface NotificationThresholds {
  idleMinutesThreshold: number;
  slaWarningPercentage: number;
  maxSpeedKmh: number;
  maintenanceKmThreshold: number;
  taxExpirationDaysThreshold: number;
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

interface DashboardOverviewProps {
  onNavigate?: (tab: NavTab) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold">
              <Truck className="w-3.5 h-3.5" />
              <span>Divisi Logistik &amp; Operasional DC</span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Dashboard Operasional
            </h2>
            <p className="text-slate-400 text-xs">
              PT Anugrah Kemasan Kreatif • Monitoring Rute, Armada &amp; Pengiriman
            </p>
          </div>
        </div>
      </div>

      {/* Clean Empty Placeholder State */}
      <div className="min-h-[420px] rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 p-8 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-amber-400 shadow-inner">
          <Clock className="w-8 h-8 opacity-80" />
        </div>
        <div className="max-w-md space-y-2">
          <h3 className="text-base font-bold text-white">
            Dashboard Operasional Dikosongkan Sementara
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Halaman ini telah dikosongkan sesuai arahan operasional dan siap untuk pengisian konfigurasi data serta metrik analitik baru berikutnya.
          </p>
        </div>
        <div className="pt-2 flex items-center gap-2 text-xs text-slate-500">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Menunggu pengisian komponen selanjutnya</span>
        </div>
      </div>
    </div>
  );
};
