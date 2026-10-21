import React, { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, 
  RefreshCw, 
  Database, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Zap, 
  Copy, 
  Check, 
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  History
} from 'lucide-react';
import { dataBridgeService, DataBridgeConfig, DataBridgeLogEntry } from '../services/dataBridgeService';
import { testSupabaseConnection } from '../services/supabaseService';

export const DataBridgeMonitor: React.FC = () => {
  const [config, setConfig] = useState<DataBridgeConfig>(() => dataBridgeService.getConfig());
  const [logs, setLogs] = useState<DataBridgeLogEntry[]>(() => dataBridgeService.getLogs());
  const [isSyncing, setIsSyncing] = useState<boolean>(dataBridgeService.isBusy());
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [showSqlPolicy, setShowSqlPolicy] = useState<boolean>(false);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [lastCheckMessage, setLastCheckMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = dataBridgeService.subscribe(() => {
      setConfig(dataBridgeService.getConfig());
      setLogs(dataBridgeService.getLogs());
      setIsSyncing(dataBridgeService.isBusy());
    });
    return () => unsub();
  }, []);

  const handleTogglePeriodic = () => {
    if (config.isEnabled) {
      dataBridgeService.stopPeriodicSync();
    } else {
      dataBridgeService.startPeriodicSync(config.intervalMinutes || 10);
    }
  };

  const handleIntervalChange = (mins: number) => {
    dataBridgeService.updateConfig({ intervalMinutes: mins });
    if (config.isEnabled) {
      dataBridgeService.startPeriodicSync(mins);
    }
  };

  const handleManualSync = async () => {
    setLastCheckMessage(null);
    const res = await dataBridgeService.syncNow('Manual Dashboard');
    setLastCheckMessage(res.message);
    if (res.rlsWarning) {
      setShowSqlPolicy(true);
    }
  };

  const sqlPolicySnippet = `-- Jalankan di SQL Editor Supabase untuk mengizinkan DataBridge melakukan upsert:
create policy "DataBridge sync stores" on public.stores for all to anon, authenticated using (true) with check (true);
create policy "DataBridge sync fleets" on public.fleets for all to anon, authenticated using (true) with check (true);
create policy "DataBridge sync crews" on public.crews for all to anon, authenticated using (true) with check (true);
create policy "DataBridge sync schedules" on public.schedules for all to anon, authenticated using (true) with check (true);
create policy "DataBridge sync tracking logs" on public.tracking_logs for all to anon, authenticated using (true) with check (true);`;

  const copySqlPolicy = () => {
    navigator.clipboard.writeText(sqlPolicySnippet);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const statusColor = 
    config.lastSyncStatus === 'success' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
    config.lastSyncStatus === 'warning' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
    config.lastSyncStatus === 'error' ? 'text-red-400 bg-red-500/10 border-red-500/30' :
    'text-blue-400 bg-blue-500/10 border-blue-500/30';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold shadow-md">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-tight">
                DataBridge: Google Sheets &harr; Supabase Sync
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColor}`}>
                <span className={`w-2 h-2 rounded-full ${
                  isSyncing ? 'bg-amber-400 animate-ping' :
                  config.lastSyncStatus === 'success' ? 'bg-emerald-400' :
                  config.lastSyncStatus === 'warning' ? 'bg-amber-400' : 'bg-red-400'
                }`} />
                {isSyncing ? 'Sinkronisasi Berjalan...' :
                 config.lastSyncStatus === 'success' ? 'Sinkron & Konsisten' :
                 config.lastSyncStatus === 'warning' ? 'Perlu Izin RLS' :
                 config.lastSyncStatus === 'error' ? 'Kendala Koneksi' : 'Siap'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Layanan otomatis yang secara berkala menarik data dari Google Sheets API dan melakukan upsert ke tabel Supabase.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleTogglePeriodic}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border shadow-xs ${
              config.isEnabled
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {config.isEnabled ? `Otomatis Aktif (${config.intervalMinutes}m)` : 'Otomatis Nonaktif'}
          </button>

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer shadow-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Memproses...' : 'Sinkronkan Sekarang'}
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sumber Data</div>
            <div className="text-xs font-extrabold text-white truncate max-w-[140px]">
              Google Sheets ({config.sheetTitle || 'ALL'})
            </div>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Target Upsert</div>
            <div className="text-xs font-extrabold text-white truncate">
              Supabase PostgreSQL
            </div>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Interval Terjadwal</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {[5, 10, 15, 30].map(mins => (
                <button
                  key={mins}
                  onClick={() => handleIntervalChange(mins)}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                    config.intervalMinutes === mins
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sinkronisasi Terakhir</div>
            <div className="text-xs font-mono font-bold text-slate-300">
              {config.lastSyncTimestamp ? new Date(config.lastSyncTimestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Belum Pernah'}
            </div>
          </div>
        </div>
      </div>

      {/* Sync Message or Notification */}
      {config.lastSyncMessage && (
        <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
          config.lastSyncStatus === 'success' ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' :
          config.lastSyncStatus === 'warning' ? 'bg-amber-950/30 border-amber-800/50 text-amber-300' :
          'bg-red-950/30 border-red-800/50 text-red-300'
        }`}>
          {config.lastSyncStatus === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" /> :
           config.lastSyncStatus === 'warning' ? <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" /> :
           <XCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />}
          <div className="space-y-1">
            <span className="font-semibold">{config.lastSyncMessage}</span>
            {config.lastSyncStatus === 'warning' && (
              <div>
                <button
                  onClick={() => setShowSqlPolicy(!showSqlPolicy)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {showSqlPolicy ? 'Tutup Skrip Kebijakan SQL RLS' : 'Lihat & Salin Skrip Kebijakan SQL RLS Supabase'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SQL Policy Accordion */}
      {showSqlPolicy && (
        <div className="bg-slate-950 border border-amber-800/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <ShieldCheck className="w-4 h-4" />
              <span>Skrip SQL Izin DataBridge (Row-Level Security Supabase)</span>
            </div>
            <button
              onClick={copySqlPolicy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition cursor-pointer"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSql ? 'Tersalin!' : 'Salin SQL'}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Tempelkan skrip ini di menu <strong>SQL Editor</strong> dashboard Supabase lalu klik <strong>Run</strong> agar DataBridge dapat memperbarui tabel tanpa terhalang RLS:
          </p>
          <pre className="p-3 bg-slate-900 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
            {sqlPolicySnippet}
          </pre>
        </div>
      )}

      {/* Logs View Toggle */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white font-semibold transition cursor-pointer"
        >
          <History className="w-3.5 h-3.5" />
          <span>Riwayat Sinkronisasi DataBridge ({logs.length})</span>
          {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {logs.length > 0 && showLogs && (
          <button
            onClick={() => dataBridgeService.clearLogs()}
            className="text-[10px] text-slate-500 hover:text-red-400 transition cursor-pointer"
          >
            Hapus Riwayat
          </button>
        )}
      </div>

      {/* Logs List */}
      {showLogs && (
        <div className="bg-slate-950/80 border border-slate-800/60 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 text-xs">
          {logs.length === 0 ? (
            <div className="text-center py-4 text-slate-500 italic">Belum ada riwayat sinkronisasi.</div>
          ) : (
            logs.map(log => (
              <div 
                key={log.id} 
                className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-lg bg-slate-900/60 border border-slate-800/40 text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    log.status === 'success' ? 'bg-emerald-400' :
                    log.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'
                  }`} />
                  <span className="font-mono text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                  </span>
                  <span className="text-slate-200 font-medium truncate max-w-xs">{log.message}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-500 font-mono">{log.durationMs}ms</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300">
                    {log.triggerSource}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
