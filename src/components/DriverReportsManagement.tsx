import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Search,
  Filter,
  Download,
  ExternalLink,
  Eye,
  Check,
  Clock,
  Truck,
  User,
  ShieldCheck,
  RefreshCw,
  Camera,
  MessageSquare,
  X,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  Printer,
  Calendar,
  Lock,
  Send,
  Sparkles,
  HelpCircle,
  FileText,
  AlertOctagon,
  ArrowRight
} from 'lucide-react';
import { driverReportService, DriverHelperReport } from '../services/driverReportService';
import { useToast } from '../context/ToastContext';
import { logisticsStore } from '../services/store';
import { FleetChecklistReportView } from './FleetChecklistReportView';

export type DateFilterMode = 'single_date' | 'this_week' | 'this_month' | 'all';

export const DriverReportsManagement: React.FC = () => {
  const { addNotification } = useToast();
  const currentUser = logisticsStore.getCurrentUser();

  // Role authorization: Status & Solutions can only be accessed/managed by SPV Logistik and Super Admin
  const isAuthorizedSpvOrAdmin = useMemo(() => {
    const r = (currentUser?.role || '').toLowerCase();
    const name = (currentUser?.fullName || '').toLowerCase();
    return (
      r === 'super_admin' ||
      r === 'spv_logistik' ||
      r === 'admin' ||
      name.includes('spv') ||
      name.includes('supervisor') ||
      name.includes('bayu') ||
      name.includes('bahri')
    );
  }, [currentUser]);

  // Sub-menu switcher: Laporan Kendala Lapangan vs Laporan Checklist Armada
  const [activeSubMenu, setActiveSubMenu] = useState<'operasional' | 'checklist_armada'>('operasional');

  const [reports, setReports] = useState<DriverHelperReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'kendala_jalan' | 'akhir_kiriman' | 'update_lokasi'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'follow_up' | 'resolved'>('all');
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<DriverHelperReport | null>(null);

  // Calendar Date Filter State: Pertanggal, Minggu Ini, Bulan Ini, atau Semua
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('single_date');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Rentang Minggu Ini (Senin s/d Minggu kalender berjalan)
  const currentWeekRange = useMemo(() => {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // 0 = Senin, 6 = Minggu
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startIso = monday.toISOString().slice(0, 10);
    const endIso = sunday.toISOString().slice(0, 10);
    const startStr = monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const endStr = sunday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

    return {
      startIso,
      endIso,
      label: `${startStr} - ${endStr}`
    };
  }, []);

  // Rentang Bulan Ini (Awal s/d Akhir bulan kalender berjalan)
  const currentMonthRange = useMemo(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const startIso = firstDay.toISOString().slice(0, 10);
    const endIso = lastDay.toISOString().slice(0, 10);
    const monthName = today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    return {
      startIso,
      endIso,
      monthName
    };
  }, []);

  // SPV Solution Modal State
  const [solutionModalReport, setSolutionModalReport] = useState<DriverHelperReport | null>(null);
  const [solutionText, setSolutionText] = useState<string>('');
  const [solutionStatus, setSolutionStatus] = useState<'follow_up' | 'verified' | 'resolved'>('follow_up');

  const loadReports = () => {
    setReports(driverReportService.getReports());
  };

  useEffect(() => {
    loadReports();

    const handleReportUpdate = () => {
      loadReports();
    };

    window.addEventListener('driver-report-updated', handleReportUpdate);
    return () => {
      window.removeEventListener('driver-report-updated', handleReportUpdate);
    };
  }, []);

  // Map of reports count per calendar date
  const reportsByDateMap = useMemo(() => {
    const map = new Map<string, { total: number; kendala: number }>();
    reports.forEach(r => {
      const d = r.date || (r.timestamp ? r.timestamp.slice(0, 10) : '');
      if (d) {
        const curr = map.get(d) || { total: 0, kendala: 0 };
        curr.total += 1;
        if (r.category === 'kendala_jalan') curr.kendala += 1;
        map.set(d, curr);
      }
    });
    return map;
  }, [reports]);

  // Statistik Cepat Berdasarkan Rentang Waktu
  const timeRangeStats = useMemo(() => {
    let weekTotal = 0;
    let weekKendala = 0;
    let monthTotal = 0;
    let monthKendala = 0;

    reports.forEach(r => {
      const d = r.date || (r.timestamp ? r.timestamp.slice(0, 10) : '');
      if (d) {
        if (d >= currentWeekRange.startIso && d <= currentWeekRange.endIso) {
          weekTotal++;
          if (r.category === 'kendala_jalan') weekKendala++;
        }
        if (d >= currentMonthRange.startIso && d <= currentMonthRange.endIso) {
          monthTotal++;
          if (r.category === 'kendala_jalan') monthKendala++;
        }
      }
    });

    return {
      weekTotal,
      weekKendala,
      monthTotal,
      monthKendala
    };
  }, [reports, currentWeekRange, currentMonthRange]);

  // Calendar Day Pills (7 days: from 5 days ago to tomorrow)
  const calendarDays = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = -5; i <= 1; i++) {
      const target = new Date(today);
      target.setDate(today.getDate() + i);
      const iso = target.toISOString().slice(0, 10);
      const dayName = target.toLocaleDateString('id-ID', { weekday: 'short' });
      const dayNum = target.getDate();
      const monthName = target.toLocaleDateString('id-ID', { month: 'short' });
      const stats = reportsByDateMap.get(iso) || { total: 0, kendala: 0 };
      days.push({
        iso,
        dayName,
        dayNum,
        monthName,
        isToday: i === 0,
        totalReports: stats.total,
        kendalaCount: stats.kendala
      });
    }
    return days;
  }, [reportsByDateMap]);

  // Filtered reports berdasarkan DateFilterMode
  const filteredReports = reports.filter((rep) => {
    const rDate = rep.date || (rep.timestamp ? rep.timestamp.slice(0, 10) : '');

    if (dateFilterMode === 'single_date') {
      if (selectedCalendarDate && rDate !== selectedCalendarDate) return false;
    } else if (dateFilterMode === 'this_week') {
      if (!rDate || rDate < currentWeekRange.startIso || rDate > currentWeekRange.endIso) return false;
    } else if (dateFilterMode === 'this_month') {
      if (!rDate || rDate < currentMonthRange.startIso || rDate > currentMonthRange.endIso) return false;
    }
    // if 'all', tidak menyaring berdasarkan tanggal

    if (categoryFilter !== 'all' && rep.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && rep.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDriver = rep.driverName.toLowerCase().includes(q);
      const matchPlate = rep.plateNumber.toLowerCase().includes(q);
      const matchArea = rep.areaName.toLowerCase().includes(q);
      const matchNotes = rep.notes.toLowerCase().includes(q);
      const matchSolution = rep.solution ? rep.solution.toLowerCase().includes(q) : false;
      const matchHelper = rep.helperName ? rep.helperName.toLowerCase().includes(q) : false;
      return matchDriver || matchPlate || matchArea || matchNotes || matchSolution || matchHelper;
    }
    return true;
  });

  // KPI Statistics (keseluruhan & filtered scope)
  const totalCount = reports.length;
  const kendalaCount = reports.filter((r) => r.category === 'kendala_jalan').length;
  const akhirCount = reports.filter((r) => r.category === 'akhir_kiriman').length;
  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  const inScopeTotal = filteredReports.length;
  const inScopeKendala = filteredReports.filter((r) => r.category === 'kendala_jalan').length;
  const inScopeAkhir = filteredReports.filter((r) => r.category === 'akhir_kiriman').length;
  const inScopePending = filteredReports.filter((r) => r.status === 'pending').length;

  const handleVerify = (id: string) => {
    if (!isAuthorizedSpvOrAdmin) {
      addNotification('sla_warning', 'Akses Dibatasi', 'Hanya SPV Logistik dan Super Admin yang memiliki hak verifikasi status laporan.');
      return;
    }
    const verifierRole = currentUser.fullName ? `${currentUser.fullName} (SPV Logistik DC)` : 'SPV Logistik DC';
    driverReportService.updateReportStatus(id, 'verified', verifierRole);
    loadReports();
    addNotification('schedule', 'Laporan Diverifikasi', 'Laporan kiriman supir berhasil diverifikasi dan disetujui.');
  };

  const handleOpenSolutionModal = (report: DriverHelperReport) => {
    if (!isAuthorizedSpvOrAdmin) {
      addNotification('sla_warning', 'Akses Terbatas', 'Hanya SPV Logistik dan Super Admin yang berwenang memberikan arahan dan solusi resmi.');
      return;
    }
    setSolutionModalReport(report);
    setSolutionText(report.solution || '');
    setSolutionStatus((report.status as any) || 'follow_up');
  };

  const handleSaveSolution = () => {
    if (!solutionModalReport) return;
    if (!solutionText.trim()) {
      addNotification('sla_warning', 'Keterangan Kosong', 'Harap isi keterangan solusi atau arahan penanganan untuk kru supir.');
      return;
    }

    const spvName = currentUser.fullName ? `${currentUser.fullName} (${currentUser.role === 'super_admin' ? 'Super Admin' : 'SPV Logistik'})` : 'SPV Logistik DC PT AKK';
    driverReportService.updateReportSolution(
      solutionModalReport.id,
      solutionText.trim(),
      spvName,
      solutionStatus
    );

    loadReports();
    addNotification(
      'schedule',
      'Solusi SPV Berhasil Dikirim',
      `Arahan telah tersambung langsung ke Portal Driver (${solutionModalReport.driverName}) dan siap dijalankan.`
    );
    setSolutionModalReport(null);
  };

  const handleExportCsv = () => {
    if (filteredReports.length === 0) return;

    const headers = ['ID Laporan', 'Tanggal', 'Waktu', 'Kategori', 'Nama Supir', 'Helper', 'Plat Nomor', 'Area Kirim', 'Keterangan Kendala', 'Solusi SPV Logistik', 'Diberikan Oleh', 'Status', 'Verifikasi Oleh'];
    const rows = filteredReports.map((r) => [
      r.id,
      r.date || new Date(r.timestamp).toISOString().slice(0, 10),
      new Date(r.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      r.category === 'kendala_jalan' ? 'Kendala Jalan' : r.category === 'akhir_kiriman' ? 'Akhir Kiriman' : 'Update Lokasi',
      `"${r.driverName}"`,
      `"${r.helperName || '-'}"`,
      r.plateNumber,
      `"${r.areaName}"`,
      `"${r.notes.replace(/"/g, '""')}"`,
      `"${(r.solution || '-').replace(/"/g, '""')}"`,
      `"${r.solutionBy || '-'}"`,
      r.status === 'verified' ? 'Terverifikasi' : r.status === 'resolved' ? 'Selesai (Diberi Solusi)' : r.status === 'follow_up' ? 'Proses Tindak Lanjut' : 'Pending',
      `"${r.verifiedBy || '-'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Kendala_Kiriman_Kru_${selectedCalendarDate || 'Semua'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addNotification('schedule', 'Export Selesai', 'Data laporan kiriman berhasil diekspor ke file CSV.');
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* 🌟 SUB-MENU SELECTOR: Laporan & Kendala Lapangan vs Laporan Checklist Armada */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubMenu('operasional')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs ${
              activeSubMenu === 'operasional'
                ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-600/30 ring-1 ring-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Laporan &amp; Kendala Lapangan</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeSubMenu === 'operasional' ? 'bg-white/20 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}>
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveSubMenu('checklist_armada')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs ${
              activeSubMenu === 'checklist_armada'
                ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Laporan Checklist Armada</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase font-mono font-bold">
              Sub-Menu Baru
            </span>
          </button>
        </div>

        {/* Security Role Access Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
          {isAuthorizedSpvOrAdmin ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Otorisasi SPV Logistik / Super Admin Aktif</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Mode Lihat (Akses Status Khusus SPV/Admin)</span>
            </div>
          )}
        </div>
      </div>

      {/* RENDER VIEW BERDASARKAN SUB-MENU AKTIF */}
      {activeSubMenu === 'checklist_armada' ? (
        <FleetChecklistReportView onBackToOperationalReports={() => setActiveSubMenu('operasional')} />
      ) : (
        <>
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black text-white tracking-tight">
                    Laporan &amp; Kendala Kiriman Kru
                  </h1>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                    Tersambung ke Portal Driver
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rincian kalender pertanggal, pemantauan kendala jalan, dan penyampaian solusi langsung dari SPV Logistik ke ponsel kru pengiriman
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadReports}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700 shadow-xs"
                title="Muat Ulang Data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={handleExportCsv}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95"
                title="Unduh laporan dalam format CSV / Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Ekspor Excel</span>
              </button>
            </div>
          </div>

          {/* 📅 RINCIAN KALENDER: Navigasi Pertanggal & Filter Cepat Rentang Waktu (Minggu Ini & Bulan Ini) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white">Kalender Laporan &amp; Filter Waktu:</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                      {dateFilterMode === 'single_date' && `Pertanggal: ${selectedCalendarDate}`}
                      {dateFilterMode === 'this_week' && `Minggu Ini: ${currentWeekRange.label}`}
                      {dateFilterMode === 'this_month' && `Bulan Ini: ${currentMonthRange.monthName}`}
                      {dateFilterMode === 'all' && 'Semua Tanggal'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Gunakan filter cepat 'Minggu Ini' atau 'Bulan Ini' untuk memfokuskan kendala operasional kru
                  </span>
                </div>
              </div>

              {/* Group Tombol Filter Cepat */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* 1. Pertanggal */}
                <button
                  type="button"
                  onClick={() => setDateFilterMode('single_date')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    dateFilterMode === 'single_date'
                      ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-600/30 ring-1 ring-blue-400'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                  }`}
                  title="Tampilkan laporan pada tanggal spesifik"
                >
                  <span>Pertanggal</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                    dateFilterMode === 'single_date' ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-300'
                  }`}>
                    {selectedCalendarDate}
                  </span>
                </button>

                {/* 2. Filter Cepat: Minggu Ini */}
                <button
                  type="button"
                  onClick={() => setDateFilterMode('this_week')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    dateFilterMode === 'this_week'
                      ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-600/30 ring-1 ring-blue-400'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                  }`}
                  title={`Fokus ke rentang operasional Minggu Ini (${currentWeekRange.label})`}
                >
                  <Clock className="w-3.5 h-3.5 text-blue-300" />
                  <span>Minggu Ini</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    dateFilterMode === 'this_week'
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                  }`}>
                    {timeRangeStats.weekTotal}
                  </span>
                  {timeRangeStats.weekKendala > 0 && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                      {timeRangeStats.weekKendala} ⚠️
                    </span>
                  )}
                </button>

                {/* 3. Filter Cepat: Bulan Ini */}
                <button
                  type="button"
                  onClick={() => setDateFilterMode('this_month')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    dateFilterMode === 'this_month'
                      ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/30 ring-1 ring-emerald-400'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                  }`}
                  title={`Fokus ke seluruh kendala & laporan Bulan Ini (${currentMonthRange.monthName})`}
                >
                  <Calendar className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Bulan Ini</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    dateFilterMode === 'this_month'
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {timeRangeStats.monthTotal}
                  </span>
                  {timeRangeStats.monthKendala > 0 && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                      {timeRangeStats.monthKendala} ⚠️
                    </span>
                  )}
                </button>

                {/* 4. Semua Tanggal */}
                <button
                  type="button"
                  onClick={() => setDateFilterMode('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs ${
                    dateFilterMode === 'all'
                      ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-600/30 ring-1 ring-blue-400'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  Semua ({totalCount})
                </button>

                {/* 5. Custom Date Input */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-slate-200">
                  <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">Pilih Tgl:</span>
                  <input
                    type="date"
                    value={selectedCalendarDate}
                    onChange={(e) => {
                      setSelectedCalendarDate(e.target.value);
                      setDateFilterMode('single_date');
                    }}
                    className="bg-transparent text-slate-200 text-xs focus:outline-none font-mono cursor-pointer"
                    title="Pilih tanggal tertentu dari kalender"
                  />
                </div>
              </div>
            </div>

            {/* Horizontal Day Selector Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                const isSelected = dateFilterMode === 'single_date' && selectedCalendarDate === day.iso;
                const isInCurrentWeek = day.iso >= currentWeekRange.startIso && day.iso <= currentWeekRange.endIso;
                return (
                  <button
                    key={day.iso}
                    onClick={() => {
                      setSelectedCalendarDate(day.iso);
                      setDateFilterMode('single_date');
                    }}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-between relative ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                        : dateFilterMode === 'this_week' && isInCurrentWeek
                        ? 'bg-blue-950/40 border-blue-500/50 text-blue-200 hover:border-blue-400'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      {day.dayName} {day.isToday && <span className="text-amber-400 font-black">(Hari Ini)</span>}
                    </span>
                    <span className={`text-base font-black font-mono my-0.5 ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                      {day.dayNum} {day.monthName}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] font-mono font-bold mt-0.5">
                      <span className="text-slate-400">{day.totalReports} Lap</span>
                      {day.kendalaCount > 0 && (
                        <span className="px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          {day.kendalaCount} ⚠️
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Context Active Filter Bar */}
            <div className="bg-slate-950/60 px-3.5 py-2.5 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>
                  {dateFilterMode === 'single_date' && (
                    <>Menampilkan laporan per tanggal <strong>{selectedCalendarDate}</strong></>
                  )}
                  {dateFilterMode === 'this_week' && (
                    <>Memfokuskan kendala operasional <strong>Minggu Ini ({currentWeekRange.label})</strong></>
                  )}
                  {dateFilterMode === 'this_month' && (
                    <>Memfokuskan kendala operasional <strong>Bulan Ini ({currentMonthRange.monthName})</strong></>
                  )}
                  {dateFilterMode === 'all' && (
                    <>Menampilkan seluruh histori laporan operasional (Semua Tanggal)</>
                  )}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-emerald-400 font-bold font-mono">
                  {inScopeTotal} laporan aktif
                </span>
                {inScopeKendala > 0 && (
                  <span className="text-rose-400 font-bold font-mono">
                    ({inScopeKendala} kendala jalan)
                  </span>
                )}
              </div>

              {dateFilterMode !== 'all' && (
                <button
                  type="button"
                  onClick={() => setDateFilterMode('all')}
                  className="text-amber-400 hover:text-amber-300 text-[11px] font-semibold underline cursor-pointer self-start sm:self-auto"
                >
                  Tampilkan Semua Tanggal
                </button>
              )}
            </div>
          </div>

          {/* KPI Stats Cards (Responsif Terhadap Filter Waktu) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Total Laporan Masuk</span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white mt-2 font-mono flex items-baseline gap-2">
                <span>{inScopeTotal}</span>
                {dateFilterMode !== 'all' && (
                  <span className="text-xs text-slate-500 font-medium font-sans">/ {totalCount} total</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {dateFilterMode === 'all'
                  ? 'Total riwayat keseluruhan'
                  : dateFilterMode === 'this_week'
                  ? 'Periode Minggu Ini'
                  : dateFilterMode === 'this_month'
                  ? 'Periode Bulan Ini'
                  : `Tanggal ${selectedCalendarDate}`}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-300">Kendala di Jalan</span>
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-rose-400 mt-2 font-mono flex items-baseline gap-2">
                <span>{inScopeKendala}</span>
                {dateFilterMode !== 'all' && (
                  <span className="text-xs text-slate-500 font-medium font-sans">/ {kendalaCount} total</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Macet, perbaikan jalan &amp; rute</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300">Akhir Kiriman (POD)</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-400 mt-2 font-mono flex items-baseline gap-2">
                <span>{inScopeAkhir}</span>
                {dateFilterMode !== 'all' && (
                  <span className="text-xs text-slate-500 font-medium font-sans">/ {akhirCount} total</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Selesai serah terima outlet</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300">Menunggu Solusi / Cek</span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-400 mt-2 font-mono flex items-baseline gap-2">
                <span>{inScopePending}</span>
                {dateFilterMode !== 'all' && (
                  <span className="text-xs text-slate-500 font-medium font-sans">/ {pendingCount} total</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Khusus SPV Logistik DC</div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari supir, helper, plat mobil, area, atau arahan solusi SPV..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">Semua Kategori Laporan</option>
                <option value="kendala_jalan">⚠️ Kendala di Jalan</option>
                <option value="akhir_kiriman">📦 Akhir Kiriman (POD)</option>
                <option value="update_lokasi">📍 Update Titik GMaps</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="pending">⏳ Menunggu Solusi SPV</option>
                <option value="follow_up">⚠️ Diproses / Diberi Arahan</option>
                <option value="verified">✓ Terverifikasi Selesai</option>
              </select>
            </div>
          </div>

          {/* Reports Table / Card List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {filteredReports.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-white">
                  {dateFilterMode !== 'all'
                    ? `Tidak Ada Laporan Pada Periode ${
                        dateFilterMode === 'this_week'
                          ? 'Minggu Ini'
                          : dateFilterMode === 'this_month'
                          ? 'Bulan Ini'
                          : `Tanggal ${selectedCalendarDate}`
                      }`
                    : 'Tidak Ada Laporan Ditemukan'}
                </div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {dateFilterMode !== 'all'
                    ? `Tidak ada laporan atau kendala yang tercatat pada ${
                        dateFilterMode === 'this_week'
                          ? `rentang Minggu Ini (${currentWeekRange.label})`
                          : dateFilterMode === 'this_month'
                          ? `Bulan Ini (${currentMonthRange.monthName})`
                          : `tanggal ${selectedCalendarDate}`
                      }. Silakan pilih filter rentang lain atau klik "Tampilkan Semua Tanggal".`
                    : 'Tidak ada laporan yang sesuai dengan filter pencarian Anda saat ini.'}
                </p>
                {dateFilterMode !== 'all' && (
                  <button
                    onClick={() => setDateFilterMode('all')}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow hover:bg-amber-400 transition cursor-pointer"
                  >
                    Tampilkan Semua Tanggal
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3.5 pl-4">Waktu &amp; ID</th>
                      <th className="p-3.5">Kru Supir &amp; Armada</th>
                      <th className="p-3.5">Jenis Laporan</th>
                      <th className="p-3.5">Nama Area Kirim</th>
                      <th className="p-3.5">Foto Bukti</th>
                      <th className="p-3.5">Keterangan Kendala Kru</th>
                      <th className="p-3.5 min-w-[240px]">Solusi SPV Logistik / Super Admin</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 pr-4 text-center">Tindakan SPV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-slate-300">
                    {filteredReports.map((item) => {
                      return (
                        <tr key={item.id} className="hover:bg-slate-850/60 transition">
                          
                          {/* 1. Waktu & ID */}
                          <td className="p-3.5 pl-4 align-top">
                            <div className="font-mono font-bold text-amber-400 text-[11px]">{item.id}</div>
                            <div className="text-[10px] text-slate-300 font-semibold mt-0.5">
                              {new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </div>
                            <div className="text-[9px] text-slate-500">
                              {item.date || new Date(item.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </div>
                          </td>

                          {/* 2. Kru Supir & Armada */}
                          <td className="p-3.5 align-top">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span>{item.driverName}</span>
                            </div>
                            {item.helperName && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Helper: <strong>{item.helperName}</strong>
                              </div>
                            )}
                            <div className="mt-1 flex items-center gap-1">
                              <Truck className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="font-mono font-bold text-amber-300 text-[11px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                {item.plateNumber}
                              </span>
                            </div>
                          </td>

                          {/* 3. Jenis Laporan */}
                          <td className="p-3.5 align-top">
                            {item.category === 'kendala_jalan' && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                <AlertTriangle className="w-3 h-3 text-rose-400" />
                                <span>Kendala Jalan</span>
                              </span>
                            )}
                            {item.category === 'akhir_kiriman' && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Akhir Kiriman</span>
                              </span>
                            )}
                            {item.category === 'update_lokasi' && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                <Navigation className="w-3 h-3 text-blue-400" />
                                <span>Update Lokasi</span>
                              </span>
                            )}
                          </td>

                          {/* 4. Area Kirim */}
                          <td className="p-3.5 align-top">
                            <div className="font-bold text-white text-xs max-w-[150px] truncate" title={item.areaName}>
                              {item.areaName}
                            </div>
                            <span className="text-[9px] text-slate-500">Area Terjadwal</span>
                          </td>

                          {/* 5. Foto Bukti */}
                          <td className="p-3.5 align-top">
                            {item.photoUrl ? (
                              <div className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shrink-0">
                                <img
                                  src={item.photoUrl}
                                  alt="Bukti Kiriman"
                                  className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition"
                                  onClick={() => setSelectedPhotoModal(item)}
                                />
                                <button
                                  onClick={() => setSelectedPhotoModal(item)}
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white"
                                  title="Perbesar foto"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="w-14 h-14 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-slate-600 text-[10px]">
                                Tanpa Foto
                              </div>
                            )}
                          </td>

                          {/* 6. Keterangan Kendala Kru */}
                          <td className="p-3.5 align-top max-w-[200px]">
                            <p className="text-slate-300 text-xs leading-relaxed line-clamp-3" title={item.notes}>
                              {item.notes}
                            </p>
                          </td>

                          {/* 7. Solusi & Arahan SPV Logistik / Super Admin (Tersambung ke Portal Driver) */}
                          <td className="p-3.5 align-top max-w-[280px]">
                            {item.solution ? (
                              <div className="bg-slate-950 p-2.5 rounded-xl border border-amber-500/30 space-y-1.5 shadow-inner">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-bold text-amber-400 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-amber-400" />
                                    <span>Arahan SPV:</span>
                                  </span>
                                  {item.driverAcknowledged ? (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                      ✓ Driver Dijalankan
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                                      Tersambung di HP Driver
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-200 text-xs leading-tight font-medium">
                                  "{item.solution}"
                                </p>
                                <div className="text-[9px] text-slate-400 border-t border-slate-800/80 pt-1 flex items-center justify-between">
                                  <span>Oleh: {item.solutionBy}</span>
                                  {item.solutionAt && (
                                    <span>{new Date(item.solutionAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-slate-950/60 p-2 rounded-xl border border-dashed border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
                                <span>Belum ada solusi SPV</span>
                                {isAuthorizedSpvOrAdmin && (
                                  <button
                                    onClick={() => handleOpenSolutionModal(item)}
                                    className="text-[10px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                                  >
                                    Beri Arahan &rarr;
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* 8. Status */}
                          <td className="p-3.5 align-top">
                            {item.status === 'verified' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <Check className="w-3 h-3" />
                                  <span>Terverifikasi</span>
                                </span>
                                {item.verifiedBy && (
                                  <div className="text-[9px] text-slate-500 mt-0.5" title={item.verifiedBy}>
                                    Oleh: {item.verifiedBy}
                                  </div>
                                )}
                              </div>
                            ) : item.status === 'resolved' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Solusi Diberikan</span>
                              </span>
                            ) : item.status === 'follow_up' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Tindak Lanjut</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                                <Clock className="w-3 h-3" />
                                <span>Menunggu SPV</span>
                              </span>
                            )}
                          </td>

                          {/* 9. Tindakan SPV & Super Admin (Khusus Otorisasi) */}
                          <td className="p-3.5 pr-4 align-top text-center">
                            {isAuthorizedSpvOrAdmin ? (
                              <div className="flex flex-col gap-1.5 items-center justify-center">
                                <button
                                  onClick={() => handleOpenSolutionModal(item)}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] flex items-center gap-1 shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap"
                                  title="Berikan atau edit solusi yang tersambung ke HP supir"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>{item.solution ? 'Edit Solusi SPV' : 'Beri Solusi & Arahan'}</span>
                                </button>

                                {item.status !== 'verified' && (
                                  <button
                                    onClick={() => handleVerify(item.id)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white font-bold text-[10px] flex items-center gap-1 transition active:scale-95 cursor-pointer border border-slate-700 hover:border-emerald-500"
                                    title="Tandai verifikasi sah"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Verifikasi Sah</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
                                <Lock className="w-3 h-3" />
                                <span>Khusus SPV</span>
                              </div>
                            )}
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* 🛠️ MODAL SOLUSI & ARAHAN SPV LOGISTIK / SUPER ADMIN */}
      {solutionModalReport && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Solusi &amp; Arahan Tindakan SPV Logistik
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Arahan ini langsung tersambung secara real-time ke aplikasi ponsel driver penginput kendala
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSolutionModalReport(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
              
              {/* Target Driver Info */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-400" />
                    <span>{solutionModalReport.driverName} ({solutionModalReport.plateNumber})</span>
                  </span>
                  <span className="text-[10px] font-mono text-amber-400">
                    Area: {solutionModalReport.areaName}
                  </span>
                </div>
                <div className="text-[11px] text-rose-300 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                  <strong>Kendala yang Dilaporkan:</strong> {solutionModalReport.notes}
                </div>
              </div>

              {/* Preset Quick Solution Chips */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Pilih Template Arahan Cepat SPV:</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Gunakan jalur lingkar bypass barat untuk menghindari titik macet pasar.',
                    'Tepi jalan aman, bantuan mekanik & armada pengganti sedang meluncur.',
                    'PIC Toko sudah kami infokan kendala jalan, keterlambatan 20-30 menit telah dimaklumi.',
                    'Segera merapat ke bengkel rekanan AKK terdekat di area tersebut untuk pengecekan darurat.'
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSolutionText(preset)}
                      className="text-left p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-[10px] text-slate-300 hover:text-amber-300 transition cursor-pointer leading-tight"
                    >
                      &bull; {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Solution Textarea */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-white block">
                  Keterangan Solusi &amp; Arahan SPV untuk Supir (Wajib Diisi):
                </label>
                <textarea
                  rows={4}
                  value={solutionText}
                  onChange={(e) => setSolutionText(e.target.value)}
                  placeholder="Ketik instruksi langkah kerja yang harus dilakukan supir/helper di lapangan saat ini..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              {/* Status Update Options */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Pembaruan Status Laporan:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="solStatus"
                      checked={solutionStatus === 'follow_up'}
                      onChange={() => setSolutionStatus('follow_up')}
                      className="text-amber-500"
                    />
                    <span className="text-amber-300 font-bold">Diproses / Diberi Arahan</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="solStatus"
                      checked={solutionStatus === 'verified'}
                      onChange={() => setSolutionStatus('verified')}
                      className="text-emerald-500"
                    />
                    <span className="text-emerald-300 font-bold">Terverifikasi / Selesai</span>
                  </label>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-200">
                <strong>Catatan Integrasi:</strong> Setelah disimpan, supir <strong>{solutionModalReport.driverName}</strong> akan melihat banner arahan ini di Portal Driver HP miliknya dan dapat langsung menekan tombol konfirmasi kerja.
              </div>

            </div>

            <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSolutionModalReport(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveSolution}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim Solusi ke Portal Driver</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal Zoom Foto Bukti */}
      {selectedPhotoModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Foto Bukti Laporan: {selectedPhotoModal.areaName}</span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  Supir: {selectedPhotoModal.driverName} [{selectedPhotoModal.plateNumber}] · {new Date(selectedPhotoModal.timestamp).toLocaleString('id-ID')}
                </p>
              </div>
              <button
                onClick={() => setSelectedPhotoModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto flex flex-col items-center justify-center bg-black/40">
              {selectedPhotoModal.photoUrl ? (
                <img
                  src={selectedPhotoModal.photoUrl}
                  alt="Bukti Laporan Penuh"
                  className="max-h-[60vh] w-auto max-w-full rounded-xl object-contain border border-slate-800 shadow-2xl"
                />
              ) : (
                <div className="p-12 text-slate-500 text-xs">Foto tidak tersedia</div>
              )}

              <div className="w-full mt-4 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400">Keterangan Kru:</span>
                  {selectedPhotoModal.gmapsUrl && (
                    <a
                      href={selectedPhotoModal.gmapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Buka Google Maps</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <p className="text-slate-200 leading-relaxed text-xs">
                  {selectedPhotoModal.notes}
                </p>

                {selectedPhotoModal.solution && (
                  <div className="mt-2 pt-2 border-t border-slate-800 text-amber-300">
                    <span className="font-bold">Arahan SPV Logistik:</span>
                    <p className="italic">"{selectedPhotoModal.solution}"</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">
                PT Anugrah Kemasan Kreatif · Logistik DC
              </span>
              <button
                onClick={() => setSelectedPhotoModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
