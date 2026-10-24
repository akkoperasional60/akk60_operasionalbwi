import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter, 
  User, 
  MapPin, 
  Truck, 
  Calendar, 
  Award, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  ChevronDown, 
  Sliders, 
  FileText, 
  Sparkles, 
  ArrowRight,
  RotateCcw,
  FileDown
} from 'lucide-react';
import { Crew, CrewDeliveryHistory, AreaApprovalRequest, AreaDeliveryStat, Fleet } from '../types';
import { logisticsStore } from '../services/store';
import { AreaApprovalModal } from './AreaApprovalModal';
import { CrewReportDownloadModal } from './CrewReportDownloadModal';

export const CrewDeliveryHistoryView: React.FC = () => {
  const [crews, setCrews] = useState<Crew[]>(logisticsStore.getCrews());
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());
  const [history, setHistory] = useState<CrewDeliveryHistory[]>(logisticsStore.getCrewDeliveryHistory());
  const [approvalRequests, setApprovalRequests] = useState<AreaApprovalRequest[]>(logisticsStore.getAreaApprovalRequests());
  const [threshold, setThreshold] = useState<number>(logisticsStore.getAreaDeliveryThreshold());
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  const [selectedCrewId, setSelectedCrewId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // Default to Januari (0)
  const [selectedYear, setSelectedYear] = useState<number>(2026); // Default to 2026
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
  const [selectedDateKey, setSelectedDateKey] = useState<string>('all'); // 'all' or 'YYYY-MM-DD'
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'area_stats' | 'fleet_stats'>('area_stats');

  // Track expanded dates in accordion view
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Interactive Approval Modal State
  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    crewName: string;
    crewId: string;
    areaName: string;
    storeName: string;
    plateNumber: string;
    tripCount: number;
    threshold: number;
    recentTrips: CrewDeliveryHistory[];
    requestId?: string;
  }>({
    isOpen: false,
    crewName: '',
    crewId: '',
    areaName: '',
    storeName: '',
    plateNumber: '',
    tripCount: 0,
    threshold: 3,
    recentTrips: []
  });

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    // Ensure all current active schedules are synced into crew history
    logisticsStore.syncSchedulesToCrewHistory();
    const latestHistory = logisticsStore.getCrewDeliveryHistory();
    setHistory(latestHistory);
    setCrews(logisticsStore.getCrews());

    // Auto-expand all dates by default
    const initExpanded: Record<string, boolean> = {};
    latestHistory.forEach(item => {
      const dKey = item.completionDate.substring(0, 10);
      initExpanded[dKey] = true;
    });
    setExpandedDates(initExpanded);

    return logisticsStore.subscribe(() => {
      setCrews(logisticsStore.getCrews());
      setFleets(logisticsStore.getFleets());
      const updated = logisticsStore.getCrewDeliveryHistory();
      setHistory(updated);
      setApprovalRequests(logisticsStore.getAreaApprovalRequests());
      setThreshold(logisticsStore.getAreaDeliveryThreshold());
    });
  }, []);

  const handleThresholdChange = (val: number) => {
    logisticsStore.setAreaDeliveryThreshold(val);
    setFeedbackMessage(`Batas maksimal pengiriman dalam 1 area diperbarui menjadi: ${val} kali.`);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleManualSyncHistory = () => {
    const syncedCount = logisticsStore.syncSchedulesToCrewHistory();
    setHistory(logisticsStore.getCrewDeliveryHistory());
    setFeedbackMessage(`⚡ Berhasil menyinkronkan ulang data jadwal operasional ke Histori & Otorisasi Kru (${syncedCount} entri diperbarui/ditambahkan)!`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleOpenSimulateApproval = (crewName: string, crewId: string, areaName: string, tripCount: number) => {
    const areaTrips = history.filter(
      h => (h.crewId === crewId || h.crewName === crewName) && h.area.toLowerCase() === areaName.toLowerCase()
    );

    setModalData({
      isOpen: true,
      crewName: crewName,
      crewId: crewId,
      areaName: areaName,
      storeName: areaTrips[0]?.storeName || `Pengiriman Distribusi ${areaName}`,
      plateNumber: areaTrips[0]?.vehiclePlate || 'P 8125 VC',
      tripCount: tripCount,
      threshold,
      recentTrips: areaTrips
    });
  };

  const handleApproveFromModal = (notes: string) => {
    logisticsStore.createAreaApprovalRequest({
      crewId: modalData.crewId,
      crewName: modalData.crewName,
      targetArea: modalData.areaName,
      currentTripsInArea: modalData.tripCount,
      thresholdLimit: threshold,
      storeName: modalData.storeName,
      plateNumber: modalData.plateNumber,
      departureDate: new Date().toISOString(),
      status: 'approved',
      reasonPolicy: `Disetujui dispensasi penugasan wilayah ${modalData.areaName} untuk trip ke-${modalData.tripCount + 1}.`,
      notes
    });

    setModalData(prev => ({ ...prev, isOpen: false }));
    setFeedbackMessage(`Penugasan wilayah untuk ${modalData.crewName} di ${modalData.areaName} berhasil DISETUJUI.`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleDecideRequest = (reqId: string, status: 'approved' | 'rejected') => {
    logisticsStore.decideAreaApproval(reqId, status);
    setFeedbackMessage(`Permohonan otorisasi telah di-${status === 'approved' ? 'SETUJUI' : 'TOLAK'}.`);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const toggleDateExpand = (dKey: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dKey]: !prev[dKey]
    }));
  };

  // Filtered raw history list
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const itemDate = new Date(item.completionDate);
      const matchesCrew = selectedCrewId === 'all' || item.crewId === selectedCrewId;
      const matchesArea = selectedAreaFilter === 'all' || item.island === selectedAreaFilter || item.area.includes(selectedAreaFilter);
      const matchesMonth = selectedMonth === -1 || itemDate.getMonth() === selectedMonth;
      const matchesYear = itemDate.getFullYear() === selectedYear;
      const matchesDateKey = selectedDateKey === 'all' || item.completionDate.substring(0, 10) === selectedDateKey;
      
      const q = searchQuery.toLowerCase();
      const initialCode = item.initialCode || (item.trackingNumber.match(/PO-AKK-\d+-([A-Za-z0-9]+)/)?.[1]) || '';
      
      const matchesSearch = !searchQuery ||
        item.crewName.toLowerCase().includes(q) ||
        item.trackingNumber.toLowerCase().includes(q) ||
        item.storeName.toLowerCase().includes(q) ||
        item.area.toLowerCase().includes(q) ||
        item.vehiclePlate.toLowerCase().includes(q) ||
        initialCode.toLowerCase().includes(q);

      return matchesCrew && matchesArea && matchesMonth && matchesYear && matchesDateKey && matchesSearch;
    });
  }, [history, selectedCrewId, selectedAreaFilter, selectedMonth, selectedYear, selectedDateKey, searchQuery]);

  // Extract unique dates for Date Pills / Selector
  const availableDatesList = useMemo(() => {
    const map: Record<string, { iso: string; formatted: string; count: number }> = {};
    history.forEach(item => {
      const itemDate = new Date(item.completionDate);
      if (selectedMonth !== -1 && itemDate.getMonth() !== selectedMonth) return;
      if (itemDate.getFullYear() !== selectedYear) return;

      const iso = item.completionDate.substring(0, 10);
      if (!map[iso]) {
        const d = new Date(item.completionDate);
        const formatted = d.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
        map[iso] = { iso, formatted, count: 0 };
      }
      map[iso].count += 1;
    });
    return Object.values(map).sort((a, b) => b.iso.localeCompare(a.iso));
  }, [history, selectedMonth, selectedYear]);

  // Group filtered history by Date ISO (YYYY-MM-DD)
  const groupedHistoryByDate = useMemo(() => {
    const groups: Record<string, { iso: string; formattedDate: string; items: CrewDeliveryHistory[] }> = {};

    filteredHistory.forEach(item => {
      const iso = item.completionDate.substring(0, 10);
      if (!groups[iso]) {
        const d = new Date(item.completionDate);
        const formattedDate = d.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        groups[iso] = { iso, formattedDate, items: [] };
      }
      groups[iso].items.push(item);
    });

    return Object.values(groups).sort((a, b) => b.iso.localeCompare(a.iso));
  }, [filteredHistory]);

  // Integrated Real-time Crew Area Stats from History Log
  const crewAreaStatsList = useMemo(() => {
    const map: Record<string, { 
      crewId: string; 
      crewName: string; 
      role: string; 
      totalTrips: number; 
      areas: Record<string, { areaName: string; tripCount: number; isExceeded: boolean }> 
    }> = {};

    filteredHistory.forEach(item => {
      const key = item.crewId || item.crewName;
      if (!map[key]) {
        map[key] = {
          crewId: item.crewId,
          crewName: item.crewName,
          role: 'Driver Utama',
          totalTrips: 0,
          areas: {}
        };
      }
      map[key].totalTrips += 1;
      const areaKey = item.area;
      if (!map[key].areas[areaKey]) {
        map[key].areas[areaKey] = { areaName: areaKey, tripCount: 0, isExceeded: false };
      }
      map[key].areas[areaKey].tripCount += 1;
      map[key].areas[areaKey].isExceeded = map[key].areas[areaKey].tripCount >= threshold;
    });

    return Object.values(map).sort((a, b) => b.totalTrips - a.totalTrips);
  }, [filteredHistory, threshold]);

  // Integrated Real-time Fleet (Inisial Mobil) Area Stats from History Log
  const fleetAreaStatsList = useMemo(() => {
    const map: Record<string, { 
      initialCode: string; 
      plateNumber: string; 
      vehicleType: string; 
      totalTrips: number; 
      areas: Record<string, number> 
    }> = {};

    filteredHistory.forEach(item => {
      const initialCode = item.initialCode || (item.trackingNumber.match(/PO-AKK-\d+-([A-Za-z0-9]+)/)?.[1]) || 'DS3';
      if (!map[initialCode]) {
        map[initialCode] = {
          initialCode,
          plateNumber: item.vehiclePlate,
          vehicleType: item.vehicleType,
          totalTrips: 0,
          areas: {}
        };
      }
      map[initialCode].totalTrips += 1;
      map[initialCode].areas[item.area] = (map[initialCode].areas[item.area] || 0) + 1;
    });

    return Object.values(map).sort((a, b) => b.totalTrips - a.totalTrips);
  }, [filteredHistory]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-black border border-amber-500/30 mb-2">
              <History className="w-3.5 h-3.5" />
              <span>SOP Rotasi Wilayah &amp; Fatigue Risk Management</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Histori Pengiriman Kru &amp; Otorisasi Pengiriman Area Berulang
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Melacak riwayat penugasan supir berdasarkan tanggal dan wilayah. Terintegrasi penuh dengan penugasan operasional spreadsheet &amp; kontrol rotasi stamina kru.
            </p>
          </div>

          {/* Quick Actions & Configurable Threshold Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer border border-emerald-500/30"
              title="Cetak & Unduh Laporan PDF Kinerja Pengiriman Kru Berdasarkan Rentang Tanggal"
            >
              <FileDown className="w-4 h-4 text-emerald-200" />
              <span>Cetak Laporan PDF Kinerja</span>
            </button>

            <button
              onClick={handleManualSyncHistory}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer"
              title="Sinkronkan ulang seluruh jadwal aktif dari sistem ke riwayat pengiriman"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Sinkronkan Ulang Riwayat</span>
            </button>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Batas Rotasi Area:</span>
              </div>
              <div className="flex items-center gap-1">
                {[2, 3, 5].map(num => (
                  <button
                    key={num}
                    onClick={() => handleThresholdChange(num)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                      threshold === num
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {num}x Kirim
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Primary Sub-Tabs Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 pt-5 border-t border-slate-800">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 flex-wrap">
            <button
              onClick={() => setActiveSubTab('area_stats')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'area_stats' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-4 h-4 text-indigo-300" />
              <span>Frekuensi Kru per Area</span>
            </button>

            <button
              onClick={() => setActiveSubTab('fleet_stats')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'fleet_stats' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Truck className="w-4 h-4 text-amber-300" />
              <span>Frekuensi Armada (Inisial Mobil)</span>
            </button>
          </div>

          {/* Search and Period Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200"
            >
              <option value={-1}>Semua Bulan</option>
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={'month-' + i} value={i}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <option key={'year-' + i} value={2024 + i}>{2024 + i}</option>
              ))}
            </select>

            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari supir, resi, inisial mobil, area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={selectedCrewId}
              onChange={(e) => setSelectedCrewId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200 focus:outline-none"
            >
              <option value="all">Semua Pengemudi</option>
              {crews.map(cr => (
                <option key={cr.id} value={cr.id}>{cr.name} ({cr.role})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {feedbackMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-600/50 text-emerald-200 text-xs flex items-center justify-between gap-2 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-emerald-400 hover:text-white font-bold text-xs">
            ✕
          </button>
        </div>
      )}



      {/* Sub-Tab 3: Frekuensi Kru per Area Terintegrasi dengan Log Pengiriman */}
      {activeSubTab === 'area_stats' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm text-xs text-slate-300 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-400" />
              <span>
                Statistik frekuensi pengiriman kru dihitung secara <strong>real-time dari log pengiriman aktif</strong>. Batas rotasi otomatis: <strong className="text-amber-400">{threshold}x pengiriman</strong> di area yang sama.
              </span>
            </div>
            <span className="font-mono text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
              {crewAreaStatsList.length} Kru Terdata
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {crewAreaStatsList.map(item => {
              const areaItems = Object.values(item.areas);

              return (
                <div key={item.crewId || item.crewName} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-black flex items-center justify-center text-xs">
                        {item.crewName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-sm">{item.crewName}</h4>
                        <span className="text-[11px] text-slate-400">{item.role}</span>
                      </div>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-slate-950 text-amber-400 border border-slate-800 font-mono">
                      {item.totalTrips} Total Trip
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block">
                      Frekuensi per Area Kirim:
                    </span>

                    {areaItems.length > 0 ? (
                      areaItems.map(st => (
                        <div
                          key={st.areaName}
                          className={`p-3 rounded-xl border flex items-center justify-between ${
                            st.isExceeded
                              ? 'bg-amber-950/30 border-amber-500/50 text-amber-200'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div>
                            <div className="font-black text-white text-xs">{st.areaName}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {st.tripCount}x pengiriman ({st.isExceeded ? `⚠️ Mencapai Batas (${threshold}x)` : `Batas: ${threshold}x`})
                            </div>
                          </div>

                          <button
                            onClick={() => handleOpenSimulateApproval(item.crewName, item.crewId, st.areaName, st.tripCount)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              st.isExceeded
                                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-xs'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {st.isExceeded ? 'Otorisasi' : 'Detail'}
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-slate-500 text-xs italic bg-slate-950/40 rounded-xl">
                        Belum ada riwayat pengiriman.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Frekuensi Armada (Inisial Mobil) per Area */}
      {activeSubTab === 'fleet_stats' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm text-xs text-slate-300 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>
                Rekapitulasi frekuensi penggunaan armada berdasarkan <strong>Inisial Mobil (DS1, DS3, NS2, NL1, N20, dll.)</strong> langsung dari log pengiriman.
              </span>
            </div>
            <span className="font-mono text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
              {fleetAreaStatsList.length} Armada Aktif
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fleetAreaStatsList.map(fl => {
              const areaEntries = Object.entries(fl.areas).sort((a, b) => b[1] - a[1]);

              return (
                <div key={fl.initialCode} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-black flex items-center justify-center text-sm shadow-xs">
                        {fl.initialCode}
                      </div>
                      <div>
                        <h4 className="font-black text-white text-sm">Armada {fl.initialCode}</h4>
                        <span className="text-[11px] font-mono text-slate-400">{fl.plateNumber} &bull; {fl.vehicleType}</span>
                      </div>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-slate-950 text-emerald-400 border border-slate-800 font-mono">
                      {fl.totalTrips} Total Trip
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block">
                      Sebaran Rute / Area Pengiriman:
                    </span>

                    <div className="space-y-1.5">
                      {areaEntries.map(([areaName, count]) => (
                        <div key={areaName} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                          <div className="font-bold text-white text-xs flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>{areaName}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-md font-mono font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 text-xs">
                            {count} Trip
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reusable Area Approval Pop-Up Modal */}
      <AreaApprovalModal
        isOpen={modalData.isOpen}
        onClose={() => setModalData(prev => ({ ...prev, isOpen: false }))}
        crewName={modalData.crewName}
        crewId={modalData.crewId}
        areaName={modalData.areaName}
        storeName={modalData.storeName}
        plateNumber={modalData.plateNumber}
        tripCount={modalData.tripCount}
        threshold={modalData.threshold}
        recentTrips={modalData.recentTrips}
        onApprove={handleApproveFromModal}
        onRejectAndPickOtherDriver={() => {
          setModalData(prev => ({ ...prev, isOpen: false }));
          setFeedbackMessage(`Pengiriman ke ${modalData.areaName} dialihkan untuk rotasi supir baru.`);
          setTimeout(() => setFeedbackMessage(null), 3500);
        }}
      />
    </div>
  );
};
