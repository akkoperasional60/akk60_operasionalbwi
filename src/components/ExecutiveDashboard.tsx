import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, LayoutDashboard, Truck, ShoppingBag, TrendingUp, Clock, CheckCircle2, AlertTriangle, ArrowUpRight, FileText, Users, BarChart3, Layers, Calendar, MapPin, RotateCw, Ship, Radio, ChevronDown, ChevronRight, Filter, Check, Activity, Package, Timer, Award, ArrowRight, ExternalLink, Briefcase, Maximize2, X, Search, Download } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { logisticsStore } from '../services/store';
import { Schedule, Fleet, RetailStore, Crew, SalesOrder, AdminActivity, LoadingDurationRecord } from '../types';
import { NavTab } from './Sidebar';
import { DriverLoadBalancing } from './DriverLoadBalancing';
import { SlaGaugeWidget } from './SlaGaugeWidget';

interface ExecutiveDashboardProps {
  onNavigate: (tab: NavTab) => void;
}

// 8-week synchronized operational dispatches vs sales orders
const SYNC_WEEKLY_TREND = [
  { week: '20 Jul', salesOrders: 50, dispatches: 38, tonase: 112 },
  { week: '27 Jul', salesOrders: 52, dispatches: 41, tonase: 124 },
  { week: '3 Agu', salesOrders: 43, dispatches: 36, tonase: 98 },
  { week: '10 Agu', salesOrders: 51, dispatches: 42, tonase: 130 },
  { week: '17 Agu', salesOrders: 48, dispatches: 40, tonase: 118 },
  { week: '24 Agu', salesOrders: 45, dispatches: 39, tonase: 115 },
  { week: '31 Agu', salesOrders: 49, dispatches: 43, tonase: 132 },
  { week: '7 Sep', salesOrders: 54, dispatches: 46, tonase: 140 }
];

// Product distribution
const PRODUCT_COMPOSITION = [
  { name: 'Karton Box Corrugated (A1)', value: 45, color: '#3b82f6', koli: '6.680 Koli' },
  { name: 'Die-Cut Box E-Commerce', value: 23, color: '#0ea5e9', koli: '3.415 Koli' },
  { name: 'Heavy Duty Box Industri', value: 18, color: '#f59e0b', koli: '2.670 Koli' },
  { name: 'Sheet Corrugated Board', value: 14, color: '#10b981', koli: '2.085 Koli' }
];

// Department SLA compliance comparison
const SLA_COMPARISON_DATA = [
  { week: '20 Jul', logistikSla: 94, salesSla: 80 },
  { week: '27 Jul', logistikSla: 95, salesSla: 82 },
  { week: '3 Agu', logistikSla: 93, salesSla: 81 },
  { week: '10 Agu', logistikSla: 96, salesSla: 83 },
  { week: '17 Agu', logistikSla: 95, salesSla: 82 },
  { week: '24 Agu', logistikSla: 97, salesSla: 84 },
  { week: '31 Agu', logistikSla: 96, salesSla: 84 },
  { week: '7 Sep', logistikSla: 98, salesSla: 85 }
];

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ onNavigate }) => {
  const [schedules, setSchedules] = useState<Schedule[]>(logisticsStore.getSchedules());
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());
  const [stores, setStores] = useState<RetailStore[]>(logisticsStore.getStores());
  const [crews, setCrews] = useState<Crew[]>(logisticsStore.getCrews());
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>(logisticsStore.getSalesOrders());
  const [adminActivities, setAdminActivities] = useState<AdminActivity[]>(logisticsStore.getAdminActivities());
  const [loadingRecords, setLoadingRecords] = useState<LoadingDurationRecord[]>(logisticsStore.getLoadingRecords());

  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'ops' | 'sales'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'ytd'>('month');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [widgetsConfig, setWidgetsConfig] = useState<{
    driverLoadBalancing: boolean;
    quickActionAdmin: boolean;
    emergencyMap: boolean;
    kpiRibbon: boolean;
    chartsSection: boolean;
    pillarsSection: boolean;
    pipelineTable: boolean;
    customerDistribution: boolean;
    recentActivities: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem('akk_exec_widgets_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          driverLoadBalancing: parsed.driverLoadBalancing ?? true,
          quickActionAdmin: parsed.quickActionAdmin ?? true,
          emergencyMap: parsed.emergencyMap ?? true,
          kpiRibbon: parsed.kpiRibbon ?? true,
          chartsSection: parsed.chartsSection ?? true,
          pillarsSection: parsed.pillarsSection ?? true,
          pipelineTable: parsed.pipelineTable ?? true,
          customerDistribution: parsed.customerDistribution ?? true,
          recentActivities: parsed.recentActivities ?? true,
        };
      }
    } catch (e) {}
    return {
      driverLoadBalancing: true,
      quickActionAdmin: true,
      emergencyMap: true,
      kpiRibbon: true,
      chartsSection: true,
      pillarsSection: true,
      pipelineTable: true,
      customerDistribution: true,
      recentActivities: true
    };
  });

  const allWidgetsDisabled = !widgetsConfig.driverLoadBalancing &&
    !widgetsConfig.quickActionAdmin &&
    !widgetsConfig.emergencyMap &&
    !widgetsConfig.kpiRibbon &&
    !widgetsConfig.chartsSection &&
    !widgetsConfig.pillarsSection &&
    !widgetsConfig.pipelineTable;

  useEffect(() => {
    try {
      localStorage.setItem('akk_exec_widgets_v1', JSON.stringify(widgetsConfig));
    } catch (e) {}
  }, [widgetsConfig]);

  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedItem, setInspectedItem] = useState<{
    type: 'pengiriman' | 'kru' | 'pelanggan' | 'pesanan';
    item: any;
  } | null>(null);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();

    const matchedSchedules = schedules
      .filter(s => s.trackingNumber.toLowerCase().includes(q) || s.cargoDescription.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
      .map(s => ({ id: s.id, category: 'Pengiriman', title: s.trackingNumber, subtitle: s.cargoDescription, raw: s, type: 'pengiriman' as const }));

    const matchedCrews = crews
      .filter(c => c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      .map(c => ({ id: c.id, category: 'Kru', title: c.name, subtitle: `${c.role} • SIM ${c.licenseType}`, raw: c, type: 'kru' as const }));

    const matchedStores = stores
      .filter(st => st.storeName.toLowerCase().includes(q) || st.storeCode.toLowerCase().includes(q) || st.city.toLowerCase().includes(q))
      .map(st => ({ id: st.id, category: 'Pelanggan', title: st.storeName, subtitle: `${st.storeCode} • ${st.city}, ${st.province}`, raw: st, type: 'pelanggan' as const }));

    const matchedOrders = salesOrders
      .filter(o => o.poNumber.toLowerCase().includes(q) || o.clientName.toLowerCase().includes(q) || o.productType.toLowerCase().includes(q))
      .map(o => ({ id: o.id, category: 'Pesanan', title: o.poNumber, subtitle: `${o.clientName} • ${o.productType}`, raw: o, type: 'pesanan' as const }));

    return [...matchedSchedules, ...matchedCrews, ...matchedStores, ...matchedOrders].slice(0, 10);
  }, [searchQuery, schedules, crews, stores, salesOrders]);

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setSchedules(logisticsStore.getSchedules());
      setFleets(logisticsStore.getFleets());
      setStores(logisticsStore.getStores());
      setCrews(logisticsStore.getCrews());
      setSalesOrders(logisticsStore.getSalesOrders());
      setAdminActivities(logisticsStore.getAdminActivities());
      setLoadingRecords(logisticsStore.getLoadingRecords());
    });
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Operational metrics
  const activeFleetsCount = useMemo(() => fleets.filter(f => f.status === 'on-duty').length, [fleets]);
  const inTransitCount = useMemo(() => schedules.filter(s => s.status === 'in_transit').length, [schedules]);
  const scheduledCount = useMemo(() => schedules.filter(s => s.status === 'scheduled').length, [schedules]);
  const deliveredCount = useMemo(() => schedules.filter(s => s.status === 'delivered').length, [schedules]);
  const totalFleetCount = fleets.length || 6;
  const fleetUtilizationRate = Math.round((activeFleetsCount / totalFleetCount) * 100);

  // Sales metrics
  const totalOrders = salesOrders.length || 120;
  const readyToLoadOrders = useMemo(() => salesOrders.filter(o => o.orderStatus === 'Siap Muat').length, [salesOrders]);
  const inProductionOrders = useMemo(() => salesOrders.filter(o => o.orderStatus === 'SPK Produksi').length, [salesOrders]);
  const deliveredSalesOrders = useMemo(() => salesOrders.filter(o => o.orderStatus === 'Terkirim').length, [salesOrders]);
  const activeAdminsCount = 3; // Dewi Kartika, Rina Setyowati, Budi Santoso
  const avgLoadingDuration = 34.9;
  const salesSlaRate = 84.8;

  // Integrated sync pipeline: Recent orders matching active distribution
  const orderLogisticsPipeline = useMemo(() => {
    return salesOrders.slice(0, 5).map((order, idx) => {
      const assignedFleet = fleets[idx % fleets.length];
      const assignedCrew = crews[idx % crews.length];
      const matchSchedule = schedules[idx % schedules.length];

      return {
        id: order.id,
        poNumber: order.poNumber,
        clientName: order.clientName,
        productType: order.productType,
        quantityPcs: order.quantityPcs,
        orderStatus: order.orderStatus,
        adminPic: order.adminPic,
        deliveryDestination: order.deliveryDestination,
        assignedFleetPlate: assignedFleet ? assignedFleet.plateNumber : 'DK-8192-AK',
        assignedFleetType: assignedFleet ? assignedFleet.vehicleType : 'Fuso Fighter 220PS',
        driverName: assignedCrew ? assignedCrew.name : 'Sugeng Riyadi',
        logisticsStatus: matchSchedule ? matchSchedule.status : (idx === 0 ? 'in_transit' : 'scheduled'),
        ferryStatus: idx % 2 === 0 ? 'Ketapang - Gilimanuk (Boarded)' : 'Rute Darat Jawa Timur'
      };
    });
  }, [salesOrders, fleets, crews, schedules]);

  const exportDashboardSnapshotCsv = () => {
    const csvRows = [
      ['"KATEGORI METRIK"', '"NILAI / STATUS"', '"KETERANGAN"'],
      ['"Nama Hub"', '"Banyuwangi Central Hub"', '"PT Anugerah Kemasan Kreatif"'],
      ['"Tanggal Ekspor"', `"${new Date().toLocaleString('id-ID')}"`, '"Snapshot Kinerja Mingguan Eksekutif"'],
      ['"Jadwal Aktif Hari Ini"', `"${schedules.filter(s => s.status === 'in_transit' || s.status === 'scheduled').length}"`, '"Pengiriman aktif dan terjadwal"'],
      ['"Armada Beroperasi"', `"${activeFleetsCount}"`, '"Armada aktif lintas rute"'],
      ['"Total Pelanggan Toko"', `"${stores.length}"`, '"Destinasi retail aktif"'],
      ['"Total Pesanan Penjualan"', `"${salesOrders.length}"`, '"PO Kemasan tercatat"'],
      ['"Rata-rata Kepatuhan SLA Logistik"', '"96.5%"', '"Target minimum 95%"'],
      ['"Rata-rata Kepatuhan SLA Sales"', '"82.4%"', '"Pemenuhan pesanan tepat waktu"']
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `snapshot_kinerja_eksekutif_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {widgetsConfig.driverLoadBalancing && <DriverLoadBalancing />}
      {/* ============================================================ */}
      {/* 1. TOP EXECUTIVE HEADER                                      */}
      {/* ============================================================ */}
      <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Sparkles className="w-3 h-3 text-amber-400" />
                DASHBOARD EKSEKUTIF UTAMA
              </span>
              <span className="text-slate-500 text-xs">&bull;</span>
              <span className="text-xs font-semibold text-slate-400">
                PT Anugrah Kemasan Kreatif &bull; Banyuwangi Central Hub
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1.5 flex items-center gap-2.5">
              <span>Dashboard Rangkuman Operasional & Penjualan</span>
            </h1>

            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed">
              Konsolidasi data kinerja real-time dari seluruh divisi logistik armada distribusi antar-pulau
              dan pemenuhan pesanan administrasi penjualan kemasan karton box.
            </p>

            {/* Search Bar Feature */}
            <div className="relative mt-4 max-w-xl">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari pengiriman (No. Tracking), kru (nama), pelanggan (toko), atau PO..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 hover:bg-slate-950/90 focus:bg-slate-950 text-slate-100 text-xs rounded-xl pl-9 pr-8 py-2.5 border border-slate-800 focus:border-amber-500/80 focus:outline-hidden transition placeholder:text-slate-500 font-medium"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search className="w-4 h-4 text-slate-500" />
                </span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Autocomplete dropdown list */}
              {searchQuery && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                  {searchResults.length > 0 ? (
                    searchResults.map((res) => {
                      let icon = <FileText className="w-4 h-4 text-slate-400" />;
                      let catColor = 'bg-slate-800 text-slate-300';
                      if (res.type === 'pengiriman') {
                        icon = <Truck className="w-4 h-4 text-blue-400" />;
                        catColor = 'bg-blue-500/10 text-blue-300 border-blue-500/20';
                      } else if (res.type === 'kru') {
                        icon = <Users className="w-4 h-4 text-amber-400" />;
                        catColor = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
                      } else if (res.type === 'pelanggan') {
                        icon = <ShoppingBag className="w-4 h-4 text-emerald-400" />;
                        catColor = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                      } else if (res.type === 'pesanan') {
                        icon = <Package className="w-4 h-4 text-rose-400" />;
                        catColor = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
                      }

                      return (
                        <div
                          key={`${res.type}-${res.id}`}
                          onClick={() => {
                            setInspectedItem({ type: res.type, item: res.raw });
                            setSearchQuery('');
                          }}
                          className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-800/80 cursor-pointer transition select-none group"
                        >
                          <div className="p-1.5 rounded-lg bg-slate-950 group-hover:bg-slate-900 border border-slate-800/60">
                            {icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-100 truncate">{res.title}</span>
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded border ${catColor}`}>
                                {res.category}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{res.subtitle}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-[11px] text-slate-500">
                      Tidak ditemukan hasil pencarian untuk &quot;<span className="text-slate-400 font-bold">{searchQuery}</span>&quot;
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Daily Summary Statistics */}
          <div className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800 self-start">
            <div className="flex flex-col items-center px-3 border-r border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Jadwal Aktif Hari Ini</span>
              <span className="text-xl font-black text-white">{schedules.filter(s => s.status === 'in_transit' || s.status === 'scheduled').length}</span>
            </div>
            <div className="flex flex-col items-center px-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">Armada Beroperasi</span>
              <span className="text-xl font-black text-blue-400">{activeFleetsCount}</span>
            </div>
          </div>

          {/* Quick Filter & Deep-Dive Actions */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            {/* View Mode Pill Switcher */}
            <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setActiveFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  activeFilterTab === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setActiveFilterTab('ops')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeFilterTab === 'ops'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-blue-300'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Operasional</span>
              </button>
              <button
                onClick={() => setActiveFilterTab('sales')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeFilterTab === 'sales'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-emerald-300'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Penjualan</span>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
              title="Perbarui Sinkronisasi Data"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            {/* Atur Widget Button */}
            <button
              onClick={() => setIsWidgetModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer text-xs font-semibold"
              title="Atur Widget Dashboard"
            >
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Atur Widget</span>
            </button>

            {/* Ekspor Data Dashboard Button */}
            <button
              onClick={exportDashboardSnapshotCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer text-xs font-black shadow-md"
              title="Unduh snapshot data kinerja saat ini dalam format CSV / Excel"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor Data Dashboard</span>
            </button>
          </div>
        </div>

        {/* Quick Jump Buttons to Dedicated Dashboards */}
        <div className="mt-4 pt-4 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sistem Terintegrasi: GPS Tracksolid &bull; ERP Sales Order &bull; Logistik Antar-Pulau</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigate('operational_dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 font-bold transition cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Buka Dashboard Operasional</span>
              <ArrowRight className="w-3 h-3" />
            </button>

            <button
              onClick={() => onNavigate('sales_dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 font-bold transition cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Buka Dashboard Penjualan</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {allWidgetsDisabled && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-8 text-center space-y-4 shadow-xl my-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Semua Widget Sedang Disembunyikan</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Anda telah menyembunyikan semua panel widget di dashboard ini melalui menu pengaturan widget. Klik tombol di bawah untuk menampilkan kembali semuanya.
            </p>
          </div>
          <button
            onClick={() => setWidgetsConfig({
              driverLoadBalancing: true,
              quickActionAdmin: true,
              emergencyMap: true,
              kpiRibbon: true,
              chartsSection: true,
              pillarsSection: true,
              pipelineTable: true,
              customerDistribution: true,
              recentActivities: true
            })}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition cursor-pointer shadow"
          >
            Tampilkan Kembali Semua Widget
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* QUICK ACTIONS INTEGRATION                                    */}
      {/* ============================================================ */}
      {widgetsConfig.quickActionAdmin && (
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-tight">Pusat Tindakan Cepat (Quick Action Admin)</h2>
              <p className="text-[10px] text-slate-500 font-semibold">Tindakan operasional & pengiriman darurat bypass langsung ke sistem</p>
            </div>
          </div>
          <span className="text-[10px] bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-slate-400 font-mono">Bypass Mode Aktif</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Action 1: Pengiriman Darurat */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-rose-500/20 hover:border-rose-500/40 transition space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-rose-400">Pengiriman Darurat (Emergency Dispatch)</h4>
                  <p className="text-[9px] text-slate-500">Kirim armada dengan rute prioritas antar-pulau</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Secara otomatis mencatatkan jadwal pengiriman instan prioritas tinggi, melompati antrean dermaga penyeberangan Ketapang.
              </p>
            </div>
            
            <button
              onClick={() => {
                const trackingNumber = `TRK-EMG-${Math.floor(1000 + Math.random() * 9000)}`;
                const randomStore = stores[Math.floor(Math.random() * stores.length)] || { id: 'ST-001', storeName: 'Hub Denpasar Bali' };
                const availableFleet = fleets.find(f => f.status === 'available') || fleets[0];
                const availableCrew = crews.find(c => c.status === 'available') || crews[0];

                const emgSchedule = {
                  trackingNumber,
                  originName: 'Banyuwangi Central Hub',
                  originCoords: [-8.21, 114.36] as [number, number],
                  storeId: randomStore.id,
                  fleetId: availableFleet ? availableFleet.id : 'FL-001',
                  crewId: availableCrew ? availableCrew.id : 'CR-001',
                  status: 'in_transit' as const,
                  departureDate: new Date().toISOString(),
                  estimatedArrival: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
                  cargoDescription: 'BAHAN BAKU KARTON KORUGASI (URGENT REPLACEMENT)',
                  cargoWeightTon: 4.5,
                  isInterIsland: true,
                  ferryBookingCode: 'FERRY-EMG-BALI92',
                  notes: 'DISPATCH DARURAT - MEMOTONG ANTRIAN PELABUHAN',
                  areaApprovalStatus: 'approved' as const
                };

                logisticsStore.addSchedule(emgSchedule);
                
                logisticsStore.emitNotification(
                  'schedule',
                  '🚨 EMERGENCY DISPATCH AKTIF!',
                  `Armada ${trackingNumber} diberangkatkan segera ke ${randomStore.storeName} untuk pengiriman darurat kemasan pengganti.`,
                  true
                );
              }}
              className="w-full py-2 px-3 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-black transition text-center cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 shadow"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Kirim Armada Darurat Sekarang</span>
            </button>
          </div>

          {/* Action 2: Catat Konsumsi BBM Cepat */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-blue-500/20 hover:border-blue-500/40 transition space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-blue-400">Isi BBM Cepat (Quick Fuel Log)</h4>
                  <p className="text-[9px] text-slate-500">Input pengisian solar untuk efisiensi armada</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <select
                  id="quick-fuel-fleet"
                  className="text-[10px] p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200"
                >
                  {fleets.slice(0, 4).map(f => (
                    <option key={f.id} value={f.id}>{f.plateNumber} ({f.vehicleType.slice(0, 10)})</option>
                  ))}
                </select>
                <input
                  id="quick-fuel-liters"
                  type="number"
                  placeholder="Jumlah Liter"
                  className="text-[10px] p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-600"
                />
              </div>
            </div>

            <button
              onClick={() => {
                const fleetSelect = document.getElementById('quick-fuel-fleet') as HTMLSelectElement;
                const litersInput = document.getElementById('quick-fuel-liters') as HTMLInputElement;
                
                if (!litersInput || !litersInput.value) {
                  alert('Harap isi jumlah liter!');
                  return;
                }

                const fleetId = fleetSelect?.value || 'FL-001';
                const liters = parseFloat(litersInput.value) || 50;
                const targetFleet = fleets.find(f => f.id === fleetId);

                logisticsStore.logActivity(
                  'Isi BBM',
                  targetFleet ? targetFleet.plateNumber : 'DK-8192-AK',
                  `Pengisian solar cepat sebanyak ${liters} Liter.`
                );

                litersInput.value = '';

                logisticsStore.emitNotification(
                  'delivery',
                  '⛽ Pengisian BBM Cepat Tercatat',
                  `BBM armada ${targetFleet ? targetFleet.plateNumber : 'DK-8192-AK'} diisi ulang sebanyak ${liters} Liter.`,
                  false
                );
              }}
              className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition text-center cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>Catat Solar & Update</span>
            </button>
          </div>

          {/* Action 3: Broadcaster Memo */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-emerald-500/20 hover:border-emerald-500/40 transition space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-emerald-400">Papan Pengumuman Admin (Broadcaster)</h4>
                  <p className="text-[9px] text-slate-500">Kirim instruksi langsung ke laci notifikasi admin</p>
                </div>
              </div>

              <input
                id="quick-announcement-text"
                type="text"
                placeholder="Ketik memo atau instruksi darurat..."
                className="w-full text-[10px] p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-600 mt-1"
              />
            </div>

            <button
              onClick={() => {
                const textInput = document.getElementById('quick-announcement-text') as HTMLInputElement;
                if (!textInput || !textInput.value) {
                  alert('Harap ketik memo terlebih dahulu!');
                  return;
                }

                const memo = textInput.value;
                textInput.value = '';

                logisticsStore.emitNotification(
                  'schedule',
                  '📢 Instruksi Admin Baru',
                  `Memo: "${memo}"`,
                  true
                );
              }}
              className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition text-center cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>Siarkan Instruksi Cepat</span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ============================================================ */}
      {/* INTERACTIVE EMERGENCY SHIPMENT GPS MAP (TRACKSOLID)          */}
      {/* ============================================================ */}
      {widgetsConfig.emergencyMap && (
        <EmergencyMapSnippet 
          schedules={schedules} 
          stores={stores} 
          fleets={fleets} 
          crews={crews} 
        />
      )}

      {/* ============================================================ */}
      {/* 2. CONSOLIDATED 8-KPI METRIC RIBBON                          */}
      {/* ============================================================ */}
      {widgetsConfig.kpiRibbon && (
        <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-300">
              Ringkasan Indikator Kunci (KPI Konsolidasi)
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Periode: September 2026 (Bulan Berjalan)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-5">
          <div className="lg:col-span-1">
            <SlaGaugeWidget onTimePercentage={96} previousPercentage={94.5} />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Card 1: Armada Beroperasi (Operasional) */}
          <div className="bg-slate-900 border border-blue-500/30 rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-blue-500/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-blue-400">
                ARMADA AKTIF
              </span>
              <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Truck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black text-white">{activeFleetsCount} <span className="text-xs font-normal text-slate-400">/ {totalFleetCount}</span></div>
              <div className="text-[10px] text-blue-300/80 font-medium mt-0.5">{fleetUtilizationRate}% Utilitas Armada</div>
            </div>
          </div>

          {/* Card 2: Pengiriman In-Transit (Operasional) */}
          <div className="bg-slate-900 border border-blue-500/30 rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-blue-500/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-blue-400">
                IN-TRANSIT
              </span>
              <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black text-white">{inTransitCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{scheduledCount} terjadwal siap muat</div>
            </div>
          </div>

          {/* Card 3: Tonase & Koli (Operasional) */}
          <div className="bg-slate-900 border border-blue-500/30 rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-blue-500/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-blue-400">
                VOLUME TERKIRIM
              </span>
              <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Package className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black text-white">14.8k</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Koli Box &bull; 42.5 Ton</div>
            </div>
          </div>

          {/* Card 4: On-Time Logistics SLA (Operasional) */}
          <div className="bg-slate-900 border border-blue-500/30 rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-blue-500/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-blue-400">
                LOGISTICS SLA
              </span>
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black text-emerald-400">96.2%</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Tepat Waktu Antar-Pulau</div>
            </div>
          </div>

          {/* Card 5: Admin On Duty (Penjualan) */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-amber-500/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">
                ADMIN ON-DUTY
              </span>
              <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black text-white">{activeAdminsCount}</div>
              <div className="text-[10px] text-amber-300/80 mt-0.5">Dewi, Rina & Budi</div>
            </div>
          </div>

          {/* Card 6: Total PO / Tugas (Penjualan) */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-amber-500/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">
                TOTAL TUGAS PO
              </span>
              <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black text-white">{totalOrders}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{readyToLoadOrders} order siap muat</div>
            </div>
          </div>

          {/* Card 7: Rata-rata Durasi Muat (Penjualan) */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-amber-500/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">
                DURASI MUAT
              </span>
              <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Timer className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black text-white">{avgLoadingDuration} <span className="text-xs font-normal text-slate-400">mnt</span></div>
              <div className="text-[10px] text-slate-400 mt-0.5">Target &lt; 40 mnt / truk</div>
            </div>
          </div>

          {/* Card 8: Sales SLA Compliance (Penjualan) */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-amber-500/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">
                SALES SLA
              </span>
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Award className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black text-emerald-400">{salesSlaRate}%</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Kepatuhan SLA Admin</div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ============================================================ */}
      {/* 3. CHARTS: SINKRONISASI PENJUALAN VS LOGISTIK               */}
      {/* ============================================================ */}
      {widgetsConfig.chartsSection && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Main Chart: Sinkronisasi Permintaan Order Penjualan vs Ritase Pengiriman (8 Minggu) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <span>Sinkronisasi Volume Penjualan vs Ritase Logistik</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Perbandingan tren mingguan antara pesanan sales tercatat dan keberangkatan armada logistik
                </p>
              </div>

              {/* Legends */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
                  <span className="text-slate-300 font-medium">Order Penjualan</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
                  <span className="text-slate-300 font-medium">Ritase Truk Berangkat</span>
                </div>
              </div>
            </div>

            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={SYNC_WEEKLY_TREND} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="execSalesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="execDispatchGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="week" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#f8fafc'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="salesOrders"
                    name="Pesanan Penjualan"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fill="url(#execSalesGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="dispatches"
                    name="Pengiriman Logistik"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#execDispatchGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Rata-rata lead time dari PO Sales ke Pengiriman Logistik: <strong>1.4 hari kerja</strong></span>
            <span className="text-emerald-400 font-semibold">&bull; Selisih backlog aman (&lt; 6 order)</span>
          </div>
        </div>

        {/* Donut Chart: Komposisi Jenis Produk Kemasan B2B */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-400" />
              <span>Komposisi Produk Terdistribusi</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Berdasarkan volume koli pesanan</p>

            <div className="h-48 mt-2 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={PRODUCT_COMPOSITION}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {PRODUCT_COMPOSITION.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#f8fafc'
                    }}
                    formatter={(val: any) => [`${val}%`, 'Porsi']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Custom List */}
            <div className="space-y-2 mt-2">
              {PRODUCT_COMPOSITION.map(item => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-300 truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-white">{item.value}%</span>
                    <span className="text-[10px] text-slate-400">({item.koli})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ============================================================ */}
      {/* 4. TWO-PILLAR PANELS: OPERASIONAL VS PENJUALAN             */}
      {/* ============================================================ */}
      {widgetsConfig.pillarsSection && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* PILAR A: RANGKUMAN OPERASIONAL LOGISTIK & DISTRIBUSI */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Rangkuman Operasional Logistik</h3>
                  <p className="text-xs text-slate-400">Armada, Rute Penyeberangan & Hub Banyuwangi</p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('operational_dashboard')}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition cursor-pointer"
              >
                <span>Detail</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Status Cards */}
            <div className="grid grid-cols-3 gap-2.5 my-3.5">
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Armada On-Duty</div>
                <div className="text-base font-black text-white mt-1">{activeFleetsCount} Unit</div>
                <div className="text-[9px] text-emerald-400 mt-0.5">GPS Signal Aktif</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Selat Bali</div>
                <div className="text-base font-black text-blue-400 mt-1">Ketapang</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Tiket Ferizy Siap</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Kapasitas Hub</div>
                <div className="text-base font-black text-amber-400 mt-1">78%</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Gudang Banyuwangi</div>
              </div>
            </div>

            {/* Active Fleet Highlights */}
            <div className="space-y-2 mt-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Status Perjalanan Armada Terkini:
              </div>

              {fleets.slice(0, 3).map((fleet, i) => (
                <div
                  key={fleet.id}
                  className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/70 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full ${fleet.status === 'on-duty' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate flex items-center gap-1.5">
                        <span>{fleet.plateNumber}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({fleet.vehicleType})</span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-blue-400" />
                          {i === 0 ? 'Lintas Selat Bali (Gilimanuk)' : i === 1 ? 'Surabaya DC - Waru' : 'Denpasar Barat Hub'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    fleet.status === 'on-duty'
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {fleet.status === 'on-duty' ? 'Sedang Jalan' : 'Standby Hub'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Action */}
          <div className="mt-4 pt-3 border-t border-slate-800/70 flex items-center justify-between text-xs flex-wrap gap-2">
            <button
              onClick={() => onNavigate('schedules')}
              className="text-slate-400 hover:text-white transition cursor-pointer flex items-center gap-1"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Kelola Jadwal</span>
            </button>
            <button
              onClick={() => onNavigate('analytics_reports')}
              className="text-amber-400 hover:text-amber-300 font-bold transition cursor-pointer flex items-center gap-1"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analitik Armada &amp; Kru</span>
            </button>
            <button
              onClick={() => onNavigate('tracksolid')}
              className="text-cyan-400 hover:text-cyan-300 font-bold transition cursor-pointer flex items-center gap-1"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live GPS Tracksolid</span>
            </button>
          </div>
        </div>

        {/* PILAR B: RANGKUMAN OPERASIONAL PENJUALAN & ADMIN */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Rangkuman Admin Penjualan</h3>
                  <p className="text-xs text-slate-400">Aktivitas Tim, Durasi Muat & Pemenuhan PO</p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('sales_dashboard')}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer"
              >
                <span>Detail</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Status Cards */}
            <div className="grid grid-cols-3 gap-2.5 my-3.5">
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Admin On Duty</div>
                <div className="text-base font-black text-white mt-1">3 Orang</div>
                <div className="text-[9px] text-emerald-400 mt-0.5">Shift Pagi/Siang</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Rata2 Muat</div>
                <div className="text-base font-black text-amber-400 mt-1">34.9 mnt</div>
                <div className="text-[9px] text-slate-400 mt-0.5">SLA: &lt; 40 mnt</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-bold">SLA Admin</div>
                <div className="text-base font-black text-emerald-400 mt-1">84.8%</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Kepatuhan Target</div>
              </div>
            </div>

            {/* Recent Orders Highlights */}
            <div className="space-y-2 mt-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Pesanan B2B Dalam Proses Siap Muat:
              </div>

              {salesOrders.slice(0, 3).map(order => (
                <div
                  key={order.id}
                  className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/70 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate flex items-center gap-1.5">
                      <span>{order.clientName}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-amber-400">{order.poNumber}</span>
                      <span>&bull;</span>
                      <span>{order.quantityPcs.toLocaleString('id-ID')} pcs</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    order.orderStatus === 'Siap Muat'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : order.orderStatus === 'Terkirim'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  }`}>
                    {order.orderStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Action */}
          <div className="mt-4 pt-3 border-t border-slate-800/70 flex items-center justify-between text-xs">
            <button
              onClick={() => onNavigate('sales_activities')}
              className="text-slate-400 hover:text-white transition cursor-pointer flex items-center gap-1"
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Aktivitas Harian Admin</span>
            </button>
            <button
              onClick={() => onNavigate('sales_loading_duration')}
              className="text-amber-400 hover:text-amber-300 font-bold transition cursor-pointer flex items-center gap-1"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>Pantau Durasi Muat</span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ============================================================ */}
      {/* 5. CROSS-DEPARTMENT PIPELINE (SALES ORDER x LOGISTICS SYNC)   */}
      {/* ============================================================ */}
      {widgetsConfig.pipelineTable && (
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800/80">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Sinkronisasi Lintas Divisi: Order Penjualan &rarr; Armada Distribusi</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Pelacakan terpadu dari nomor PO penjualan, PIC admin, penugasan armada truk, hingga status kapal penyeberangan
            </p>
          </div>

          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 self-start sm:self-auto">
            Live Synchronization OK
          </span>
        </div>

        {/* Table / List View */}
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400 font-semibold text-[11px]">
                <th className="py-2.5 px-3">No. PO & Klien B2B</th>
                <th className="py-2.5 px-3">Produk & Qty</th>
                <th className="py-2.5 px-3">PIC Admin Penjualan</th>
                <th className="py-2.5 px-3">Status PO</th>
                <th className="py-2.5 px-3">Armada & Supir</th>
                <th className="py-2.5 px-3">Status Distribusi</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {orderLogisticsPipeline.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/40 transition">
                  {/* PO & Client */}
                  <td className="py-3 px-3">
                    <div className="font-bold text-white truncate max-w-[180px]">{row.clientName}</div>
                    <div className="text-[10px] font-mono text-amber-400 mt-0.5">{row.poNumber}</div>
                  </td>

                  {/* Product & Qty */}
                  <td className="py-3 px-3">
                    <div className="text-slate-200 truncate max-w-[160px]">{row.productType}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{row.quantityPcs.toLocaleString('id-ID')} pcs</div>
                  </td>

                  {/* PIC Admin */}
                  <td className="py-3 px-3">
                    <div className="text-slate-300 font-medium">{row.adminPic}</div>
                    <div className="text-[10px] text-slate-500">Div. Penjualan</div>
                  </td>

                  {/* Status PO */}
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                      row.orderStatus === 'Siap Muat'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : row.orderStatus === 'Terkirim'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                    }`}>
                      {row.orderStatus}
                    </span>
                  </td>

                  {/* Armada & Supir */}
                  <td className="py-3 px-3">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Truck className="w-3 h-3 text-blue-400" />
                      <span>{row.assignedFleetPlate}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Supir: {row.driverName}</div>
                  </td>

                  {/* Status Distribusi */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${row.logisticsStatus === 'in_transit' ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`} />
                      <span className="font-semibold text-slate-200 uppercase text-[10px]">
                        {row.logisticsStatus === 'in_transit' ? 'Dalam Perjalanan' : 'Siap Berangkat'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Ship className="w-2.5 h-2.5 text-cyan-400" />
                      <span>{row.ferryStatus}</span>
                    </div>
                  </td>

                  {/* Action */}
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => onNavigate('schedules')}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                      title="Lihat Detail Penugasan Distribusi"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* 2. SEARCH INSPECTOR DIALOG MODAL */}
      {inspectedItem && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in-50 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  inspectedItem.type === 'pengiriman' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                  inspectedItem.type === 'kru' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                  inspectedItem.type === 'pelanggan' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                  'bg-rose-500/10 text-rose-300 border-rose-500/20'
                }`}>
                  Detail {inspectedItem.type}
                </span>
              </div>
              <button
                onClick={() => setInspectedItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {inspectedItem.type === 'pengiriman' && (() => {
                const s = inspectedItem.item as Schedule;
                const fleet = fleets.find(f => f.id === s.fleetId);
                const crew = crews.find(c => c.id === s.crewId);
                const store = stores.find(st => st.id === s.storeId);
                
                return (
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between items-start border-b border-slate-800/60 pb-3">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">No. Tracking</div>
                        <div className="text-sm font-black text-white mt-0.5">{s.trackingNumber}</div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                        s.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                        s.status === 'in_transit' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                        s.status === 'delayed' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' :
                        'bg-amber-500/10 text-amber-300 border-amber-500/20'
                      }`}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Rute Keberangkatan</div>
                        <div className="text-slate-200 font-semibold mt-0.5">{s.originName}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Toko Penerima</div>
                        <div className="text-slate-200 font-semibold mt-0.5">{store ? store.storeName : 'Mitra Retail'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Waktu Berangkat</div>
                        <div className="text-slate-200 mt-0.5">{new Date(s.departureDate).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Estimasi Tiba</div>
                        <div className="text-slate-200 mt-0.5">{new Date(s.estimatedArrival).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                      </div>
                    </div>

                    <div className="border-t border-slate-800/60 pt-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Deskripsi Muatan:</span>
                        <span className="text-slate-200 font-semibold">{s.cargoDescription}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Berat Muatan:</span>
                        <span className="text-slate-200 font-semibold">{s.cargoWeightTon} Ton</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Lintas Selat:</span>
                        <span className="text-slate-200 font-semibold">{s.isInterIsland ? 'Ketapang - Gilimanuk (Ferry)' : 'Darat Jawa Timur'}</span>
                      </div>
                      {s.ferryBookingCode && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">Tiket Ferry:</span>
                          <span className="text-amber-300 font-mono font-bold">{s.ferryBookingCode}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-800/60 pt-3 grid grid-cols-2 gap-3">
                      <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800">
                        <div className="text-[9px] text-slate-500 font-bold">Armada Penjemput</div>
                        <div className="text-blue-400 font-bold mt-1 text-xs">{fleet ? fleet.plateNumber : 'N/A'}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{fleet ? fleet.vehicleType : 'N/A'}</div>
                      </div>
                      <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800">
                        <div className="text-[9px] text-slate-500 font-bold">Kru Driver</div>
                        <div className="text-amber-400 font-bold mt-1 text-xs">{crew ? crew.name : 'N/A'}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{crew ? crew.role : 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {inspectedItem.type === 'kru' && (() => {
                const c = inspectedItem.item as Crew;
                const fleet = fleets.find(f => f.id === c.currentFleetId);
                
                return (
                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-center gap-3 border-b border-slate-800/60 pb-3">
                      <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-400">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">{c.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{c.role}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Nomor Telepon</div>
                        <div className="text-slate-200 font-semibold mt-0.5">{c.phone}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Lisensi Driver (SIM)</div>
                        <div className="text-slate-200 font-semibold mt-0.5">{c.licenseType} ({c.licenseNumber})</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1">
                      <div className="p-2 bg-slate-950/40 border border-slate-800 rounded-lg text-center">
                        <div className="text-[8px] text-slate-500 font-bold">Total Ritase</div>
                        <div className="text-white font-bold text-sm mt-0.5">{c.tripsCompleted}</div>
                      </div>
                      <div className="p-2 bg-slate-950/40 border border-slate-800 rounded-lg text-center">
                        <div className="text-[8px] text-slate-500 font-bold">Rating Layanan</div>
                        <div className="text-amber-400 font-bold text-sm mt-0.5">★ {c.rating.toFixed(1)}</div>
                      </div>
                      <div className="p-2 bg-slate-950/40 border border-slate-800 rounded-lg text-center">
                        <div className="text-[8px] text-slate-500 font-bold">Status Kru</div>
                        <span className={`inline-block text-[8px] font-black uppercase mt-1 px-1.5 py-0.2 rounded border ${
                          c.status === 'available' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                          c.status === 'on-duty' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                          'bg-slate-500/10 text-slate-300 border-slate-500/20'
                        }`}>
                          {c.status}
                        </span>
                      </div>
                    </div>

                    {fleet && (
                      <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1">
                        <div className="text-[9px] text-slate-500 font-bold">Kendaraan Terkait Saat Ini</div>
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="font-bold text-blue-400">{fleet.plateNumber}</span>
                          <span className="text-slate-300">{fleet.vehicleType}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {inspectedItem.type === 'pelanggan' && (() => {
                const st = inspectedItem.item as RetailStore;
                
                return (
                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-center gap-3 border-b border-slate-800/60 pb-3">
                      <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-400">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">{st.storeName}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{st.storeCode} &bull; {st.storeCategory}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Kontak Person</div>
                        <div className="text-slate-200 mt-0.5">{st.contactPerson} &bull; {st.phone}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Jadwal Pengiriman Pilihan (SLA)</div>
                        <div className="text-slate-200 mt-0.5">{st.deliveryWindow}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Wilayah & Kepulauan</div>
                        <div className="text-slate-200 mt-0.5">{st.island} &bull; Provinsi {st.province} &bull; {st.city}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Alamat Pengiriman Lengkap</div>
                        <div className="text-slate-300 mt-1 leading-relaxed bg-slate-950/30 p-2.5 rounded-lg border border-slate-800">{st.address}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {inspectedItem.type === 'pesanan' && (() => {
                const o = inspectedItem.item as SalesOrder;
                
                return (
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between items-start border-b border-slate-800/60 pb-3">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Nomor PO Penjualan</div>
                        <div className="text-sm font-black text-white mt-0.5">{o.poNumber}</div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                        o.orderStatus === 'Terkirim' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                        o.orderStatus === 'Siap Muat' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                        o.orderStatus === 'SPK Produksi' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                        'bg-slate-500/10 text-slate-300 border-slate-500/20'
                      }`}>
                        {o.orderStatus}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Nama Pelanggan:</span>
                        <span className="text-slate-200 font-semibold">{o.clientName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Kategori Produk:</span>
                        <span className="text-slate-200 font-semibold">{o.productType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Jumlah Pesanan:</span>
                        <span className="text-slate-200 font-bold">{o.quantityPcs.toLocaleString('id-ID')} Pcs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Destinasi Pengiriman:</span>
                        <span className="text-slate-200 font-semibold">{o.deliveryDestination}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-800/50">
                        <span className="text-slate-500 font-medium">PIC Sales Admin:</span>
                        <span className="text-amber-400 font-semibold">{o.adminPic}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950/40 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                onClick={() => setInspectedItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold transition text-xs cursor-pointer"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WIDGET CUSTOMIZATION MODAL */}
      {isWidgetModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Atur Widget Dashboard Eksekutif</h3>
              </div>
              <button
                onClick={() => setIsWidgetModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-slate-400 leading-relaxed">
                Pilih widget operasional dan penjualan mana saja yang ingin Anda tampilkan di Dashboard Eksekutif untuk kenyamanan pemantauan tim manajemen.
              </p>

              <div className="space-y-2.5">
                {[
                  { key: 'driverLoadBalancing', label: 'Load Balancing Driver (Distribusi Muatan per Bulan)', desc: 'Visualisasi beban tugas sopir antar-pulau' },
                  { key: 'quickActionAdmin', label: 'Pusat Tindakan Cepat (Quick Action Admin)', desc: 'Bypass darurat pengiriman, isi BBM, & broadaster memo' },
                  { key: 'emergencyMap', label: 'Peta Interaktif GPS & Emergency Shipment', desc: 'Radar Tracksolid GPS real-time penyeberangan Selat Bali' },
                  { key: 'kpiRibbon', label: 'Ringkasan Indikator Kunci (8 KPI Ribbon)', desc: 'Metrik konsolidasi armada, in-transit, tonase, dan SLA' },
                  { key: 'chartsSection', label: 'Grafik Trend & Komposisi Produk', desc: 'Sinkronisasi 8 minggu order vs dispatches & proporsi koli' },
                  { key: 'pillarsSection', label: 'Dua Pilar Rangkuman (Logistik vs Penjualan)', desc: 'Panel perbandingan operasional logistik dan administrasi B2B' },
                  { key: 'pipelineTable', label: 'Tabel Sinkronisasi Lintas Divisi', desc: 'Tabel detail PO penjualan terhubung dengan armada & ferizy' },
                ].map(item => (
                  <label
                    key={item.key}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={(widgetsConfig as any)[item.key]}
                      onChange={(e) => setWidgetsConfig({ ...widgetsConfig, [item.key]: e.target.checked })}
                      className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500/20 bg-slate-900 cursor-pointer w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-100">{item.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
              <button
                onClick={() => {
                  setWidgetsConfig({
                    driverLoadBalancing: true,
                    quickActionAdmin: true,
                    emergencyMap: true,
                    kpiRibbon: true,
                    chartsSection: true,
                    pillarsSection: true,
                    pipelineTable: true,
                    customerDistribution: true,
                    recentActivities: true
                  });
                }}
                className="text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer"
              >
                Reset Default Semua
              </button>

              <button
                onClick={() => setIsWidgetModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition cursor-pointer shadow"
              >
                Simpan & Terapkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// EMERGENCY GPS TELETRAFFIC MAP SNIPPET (TRACKSOLID)
// ============================================================
interface EmergencyMapProps {
  schedules: any[];
  stores: any[];
  fleets: any[];
  crews: any[];
}

const EmergencyMapSnippet: React.FC<EmergencyMapProps> = ({ schedules, stores, fleets, crews }) => {
  const [statusFilter, setStatusFilter] = useState<'All' | 'Emergency' | 'Delay' | 'On Track'>('All');
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePopupId, setActivePopupId] = useState<string | null>(null);

  // Filter and classify active or pending shipments for the live map
  const classifiedShipments = useMemo(() => {
    return schedules
      .filter(s => s.status === 'in_transit' || s.status === 'delayed' || s.status === 'scheduled')
      .map(s => {
        let category: 'Emergency' | 'Delay' | 'On Track' = 'On Track';
        if (s.isInterIsland || s.trackingNumber.includes('EMG') || s.cargoDescription?.toLowerCase().includes('urgent') || s.notes?.toLowerCase().includes('emergency') || s.notes?.toLowerCase().includes('darurat')) {
          category = 'Emergency';
        } else if (s.status === 'delayed' || s.notes?.toLowerCase().includes('delay') || s.notes?.toLowerCase().includes('lambat')) {
          category = 'Delay';
        }
        return { ...s, category };
      });
  }, [schedules]);

  const filteredShipments = useMemo(() => {
    if (statusFilter === 'All') return classifiedShipments;
    return classifiedShipments.filter(s => s.category === statusFilter);
  }, [classifiedShipments, statusFilter]);

  const [selectedShipmentId, setSelectedShipmentId] = useState<string>('');
  const [isPinging, setIsPinging] = useState(false);
  const [satelliteCount, setSatelliteCount] = useState(14);
  const [signalStrength, setSignalStrength] = useState(94);
  const [lastPingTime, setLastPingTime] = useState<string>('Baru saja');

  // Sync selected shipment when filter changes
  useEffect(() => {
    if (filteredShipments.length > 0) {
      const exists = filteredShipments.some(s => s.id === selectedShipmentId);
      if (!exists) {
        setSelectedShipmentId(filteredShipments[0].id);
      }
    } else {
      setSelectedShipmentId('');
    }
  }, [filteredShipments, selectedShipmentId]);

  const selectedShipment = useMemo(() => {
    return filteredShipments.find(s => s.id === selectedShipmentId) || filteredShipments[0];
  }, [filteredShipments, selectedShipmentId]);

  const handlePingSatellite = () => {
    setIsPinging(true);
    
    // Play sweet sonar radar chime
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime); // High C6
        osc.frequency.exponentialRampToValueAtTime(131.81, ctx.currentTime + 0.8); // Drop low
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
        osc.start();
        osc.stop(ctx.currentTime + 1.0);
      }
    } catch {}

    setTimeout(() => {
      setIsPinging(false);
      setSatelliteCount(Math.floor(12 + Math.random() * 5));
      setSignalStrength(Math.floor(88 + Math.random() * 11));
      setLastPingTime(new Date().toLocaleTimeString('id-ID'));
    }, 1200);
  };

  // Get details for selected shipment
  const targetStore = useMemo(() => {
    if (!selectedShipment) return null;
    return stores.find(s => s.id === selectedShipment.storeId);
  }, [selectedShipment, stores]);

  const targetFleet = useMemo(() => {
    if (!selectedShipment) return null;
    return fleets.find(f => f.id === selectedShipment.fleetId);
  }, [selectedShipment, fleets]);

  const targetCrew = useMemo(() => {
    if (!selectedShipment) return null;
    return crews.find(c => c.id === selectedShipment.crewId);
  }, [selectedShipment, crews]);

  // Determine dynamic location simulation on map based on estimated arrival
  const progressPercent = useMemo(() => {
    if (!selectedShipment) return 40; // placeholder center
    const hash = selectedShipment.trackingNumber.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    return 30 + (hash % 45); // Generates stable 30% to 75% coordinate along route path
  }, [selectedShipment]);

  // Status-colored UI specifications
  const statusColor = useMemo(() => {
    if (!selectedShipment) {
      return { 
        primary: '#f43f5e', 
        light: 'rgba(244,63,94,0.15)', 
        medium: 'rgba(244,63,94,0.25)', 
        text: 'text-rose-400',
        badge: 'bg-rose-500/10 text-rose-300 border-rose-500/20'
      };
    }
    if (selectedShipment.category === 'Emergency') {
      return { 
        primary: '#f43f5e', 
        light: 'rgba(244,63,94,0.15)', 
        medium: 'rgba(244,63,94,0.25)', 
        text: 'text-rose-400',
        badge: 'bg-rose-500/10 text-rose-300 border-rose-500/20'
      };
    } else if (selectedShipment.category === 'Delay') {
      return { 
        primary: '#f59e0b', 
        light: 'rgba(245,158,11,0.15)', 
        medium: 'rgba(245,158,11,0.25)', 
        text: 'text-amber-400',
        badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20'
      };
    } else {
      return { 
        primary: '#10b981', 
        light: 'rgba(16,185,129,0.15)', 
        medium: 'rgba(16,185,129,0.25)', 
        text: 'text-emerald-400',
        badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
      };
    }
  }, [selectedShipment]);

  return (
    <>
      <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-rose-500 animate-pulse" />
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider">Telemetri Satelit GPS (Tracksolid Live Map)</h3>
            <p className="text-[10px] text-slate-500 font-semibold">Pemantauan rute laut & jalur darat armada darurat PT AKK</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            Online
          </span>
          <button
            onClick={handlePingSatellite}
            disabled={isPinging}
            className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-tight transition flex items-center gap-1 cursor-pointer select-none ${
              isPinging 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                : 'bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700'
            }`}
          >
            <RotateCw className={`w-3 h-3 ${isPinging ? 'animate-spin' : ''}`} />
            <span>{isPinging ? 'Pinging...' : 'Ping Satelit GPS'}</span>
          </button>
          <button
            onClick={() => setIsExpanded(true)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-black tracking-tight bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1 cursor-pointer select-none"
            title="Buka Peta Mode Layar Penuh"
          >
            <Maximize2 className="w-3 h-3 text-slate-400" />
            <span>Expand</span>
          </button>
        </div>
      </div>

      {/* Dynamic Status Filters */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800/60">
        {(['All', 'Emergency', 'Delay', 'On Track'] as const).map((filter) => {
          const count = filter === 'All' 
            ? classifiedShipments.length 
            : classifiedShipments.filter(s => s.category === filter).length;
          const isActive = statusFilter === filter;
          
          let activeStyles = "bg-slate-800 text-white border-slate-700 shadow-sm";
          let badgeColor = "bg-slate-900 text-slate-400";
          
          if (isActive) {
            if (filter === 'Emergency') {
              activeStyles = "bg-rose-500/15 text-rose-400 border-rose-500/35 shadow-xs";
              badgeColor = "bg-rose-500/20 text-rose-300";
            } else if (filter === 'Delay') {
              activeStyles = "bg-amber-500/15 text-amber-400 border-amber-500/35 shadow-xs";
              badgeColor = "bg-amber-500/20 text-amber-300";
            } else if (filter === 'On Track') {
              activeStyles = "bg-emerald-500/15 text-emerald-400 border-emerald-500/35 shadow-xs";
              badgeColor = "bg-emerald-500/20 text-emerald-300";
            } else {
              activeStyles = "bg-blue-500/15 text-blue-400 border-blue-500/35 shadow-xs";
              badgeColor = "bg-blue-500/20 text-blue-300";
            }
          }
          
          return (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition flex items-center gap-2 cursor-pointer border select-none ${
                isActive 
                  ? activeStyles 
                  : "bg-transparent text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              <span>{filter === 'All' ? 'Semua Armada' : filter}</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono ${badgeColor}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side: Active Shipments Monitor & Telemetry Panel (Cols 4) */}
        <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Daftar Armada Terpantau ({filteredShipments.length}):
            </div>

            {filteredShipments.length === 0 ? (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60 text-center space-y-2.5 py-6">
                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                  Tidak ada armada dalam kategori ini ({statusFilter}) yang sedang terpantau saat ini.
                </p>
                {statusFilter === 'Emergency' && (
                  <button
                    onClick={() => {
                      // Quick trigger simulated dispatch via store
                      const trackingNumber = `TRK-EMG-${Math.floor(1000 + Math.random() * 9000)}`;
                      const randStore = stores[Math.floor(Math.random() * stores.length)] || { id: 'ST-001', storeName: 'Denpasar Hub' };
                      const fleet = fleets.find(f => f.status === 'available') || fleets[0];
                      const crew = crews.find(c => c.status === 'available') || crews[0];
                      
                      logisticsStore.addSchedule({
                        trackingNumber,
                        originName: 'Banyuwangi Central Hub',
                        originCoords: [-8.21, 114.36],
                        storeId: randStore.id,
                        fleetId: fleet ? fleet.id : 'FL-001',
                        crewId: crew ? crew.id : 'CR-001',
                        status: 'in_transit',
                        departureDate: new Date().toISOString(),
                        estimatedArrival: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
                        cargoDescription: 'URGENT REPLACEMENT PACKAGING (BALI TRADING)',
                        cargoWeightTon: 3.8,
                        isInterIsland: true,
                        ferryBookingCode: 'FERRY-AUTO-92A',
                        notes: 'BYPASS EMERGENCY VIA EXECUTIVE QUICK-MAP',
                        areaApprovalStatus: 'approved'
                      });

                      logisticsStore.emitNotification(
                        'schedule',
                        '🚨 PENGIRIMAN DARURAT DIKIRIM',
                        `Armada ${trackingNumber} segera transit ke ${randStore.storeName} untuk kemasan karton box.`,
                        true
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 text-[10px] font-black cursor-pointer shadow transition"
                  >
                    ＋ Minta Pengiriman Darurat
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                {filteredShipments.map((s) => {
                  const isSelected = s.id === selectedShipmentId;
                  const store = stores.find(st => st.id === s.storeId);
                  
                  let indicatorBg = 'bg-emerald-400';
                  if (s.category === 'Emergency') indicatorBg = 'bg-rose-400 animate-pulse';
                  else if (s.category === 'Delay') indicatorBg = 'bg-amber-400 animate-pulse';

                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedShipmentId(s.id);
                        setActivePopupId(s.id);
                      }}
                      className={`p-2.5 rounded-xl border text-[10px] cursor-pointer transition flex items-center justify-between ${
                        isSelected 
                          ? 'bg-slate-800/80 border-slate-700 text-slate-200' 
                          : 'bg-slate-950 border-slate-800/80 hover:border-slate-700 text-slate-300'
                      }`}
                      style={isSelected ? { borderColor: statusColor.primary, color: statusColor.primary } : {}}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${indicatorBg}`} />
                          <span className="truncate">{s.trackingNumber}</span>
                        </div>
                        <div className="text-[9px] text-slate-500 truncate mt-0.5">
                          Tujuan: {store ? store.storeName : 'Supermarket'}
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 shrink-0 font-mono">
                        {s.cargoWeightTon} Ton
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Telemetry Stats Details (Selected Shipment) */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-2.5">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1.5 flex items-center justify-between">
              <span>Spesifikasi Telematika Satelit:</span>
              {selectedShipment && (
                <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded border font-sans ${statusColor.badge}`}>
                  {selectedShipment.category}
                </span>
              )}
            </div>

            {selectedShipment ? (
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800/50">
                  <span className="text-[8px] text-slate-500 block">KENDARAAN / PLAT</span>
                  <span className="font-bold text-slate-200">{targetFleet ? targetFleet.plateNumber : 'DK-8192-AK'}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800/50">
                  <span className="text-[8px] text-slate-500 block">KECEPATAN GPS</span>
                  <span className="font-bold" style={{ color: statusColor.primary }}>{isPinging ? '--' : `${Math.floor(52 + (progressPercent % 18))} Km/h`}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800/50">
                  <span className="text-[8px] text-slate-500 block">SATELLITE LINK</span>
                  <span className="font-bold text-slate-200">{isPinging ? 'Re-sync...' : `${satelliteCount} Sats`}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800/50">
                  <span className="text-[8px] text-slate-500 block">GPS SIGNAL</span>
                  <span className="font-bold text-emerald-400">{signalStrength}% Excellent</span>
                </div>
                <div className="col-span-2 bg-slate-900 p-2 rounded-lg border border-slate-800/50 text-[9px] leading-relaxed">
                  <div className="text-slate-500 uppercase text-[8px]">Supir & Muatan:</div>
                  <div className="font-semibold text-slate-300">
                    {targetCrew ? targetCrew.name : 'Supir Utama'} &bull; {selectedShipment.cargoDescription}
                  </div>
                  <div className="text-slate-500 mt-1 uppercase text-[8px]">Update Terakhir:</div>
                  <div className="font-mono text-slate-400">{lastPingTime}</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-[10px] text-slate-600 font-semibold">
                Silakan pilih armada terpantau di atas untuk melihat spesifikasi koordinat telematika.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: High-Fidelity SVG Map Grid of East Java & Bali Straits (Cols 8) */}
        <div 
          onClick={() => setActivePopupId(null)}
          className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl relative overflow-hidden h-[280px] lg:h-full min-h-[250px] flex items-center justify-center cursor-default"
        >
          {/* Radar Scanner Grid Line overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#111827_0%,#020617_100%)] opacity-95"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.15)_1px,transparent_1px)] bg-[size:16px_16px]"></div>
          
          {/* SVG Map Path drawing Banyuwangi to Denpasar */}
          <svg className="absolute inset-0 w-full h-full p-4 select-none z-10" viewBox="0 0 450 250" preserveAspectRatio="none">
            {/* Java Mainland land representation (Subtle outline) */}
            <path d="M 0 60 Q 50 70 80 120 T 110 180 L 110 250 L 0 250 Z" fill="rgba(30,41,59,0.2)" stroke="rgba(71,85,105,0.25)" strokeWidth="1" />
            
            {/* Bali Mainland land representation (Subtle outline) */}
            <path d="M 180 120 Q 230 110 320 130 T 450 170 L 450 250 L 180 250 Z" fill="rgba(30,41,59,0.2)" stroke="rgba(71,85,105,0.25)" strokeWidth="1" />

            {/* Ocean Strait Labels */}
            <text x="145" y="210" fill="rgba(148,163,184,0.15)" fontSize="9" className="font-mono" textAnchor="middle">SELAT BALI</text>
            <text x="50" y="210" fill="rgba(148,163,184,0.1)" fontSize="9" className="font-mono">JAWA TIMUR</text>
            <text x="350" y="210" fill="rgba(148,163,184,0.1)" fontSize="9" className="font-mono">PULAU BALI</text>

            {/* Dotted Route path (Banyuwangi Central Hub -> Ketapang -> Gilimanuk -> Denpasar) */}
            <path 
              id="emergency-strait-route"
              d="M 80 150 Q 120 140 135 140 T 175 140 Q 240 145 320 160" 
              fill="none" 
              stroke="rgba(244,63,94,0.15)" 
              strokeWidth="2.5" 
              strokeDasharray="4,4"
            />

            {/* Animated pulse routing line representing shipment moving */}
            {selectedShipment && (
              <path 
                d="M 80 150 Q 120 140 135 140 T 175 140 Q 240 145 320 160" 
                fill="none" 
                stroke={statusColor.primary} 
                strokeWidth="2.5" 
                strokeDasharray="120"
                strokeDashoffset={120 - (1.2 * progressPercent)}
                className="transition-all duration-1000 ease-in-out opacity-80"
              />
            )}

            {/* Landmark Nodes */}
            {/* Node 1: Banyuwangi Hub */}
            <circle cx="80" cy="150" r="5" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
            <circle cx="80" cy="150" r="2" fill="#94a3b8" />
            <text x="80" y="138" fill="#94a3b8" fontSize="8" className="font-black" textAnchor="middle">BANYUWANGI HUB</text>

            {/* Node 2: Pelabuhan Ketapang */}
            <circle cx="125" cy="140" r="4.5" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
            <circle cx="125" cy="140" r="2" fill="#06b6d4" />
            <text x="125" y="128" fill="#06b6d4" fontSize="7.5" className="font-semibold" textAnchor="middle">PEL. KETAPANG</text>

            {/* Node 3: Pelabuhan Gilimanuk */}
            <circle cx="175" cy="140" r="4.5" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
            <circle cx="175" cy="140" r="2" fill="#06b6d4" />
            <text x="175" y="128" fill="#06b6d4" fontSize="7.5" className="font-semibold" textAnchor="middle">PEL. GILIMANUK</text>

            {/* Node 4: Bali Destination */}
            <circle cx="320" cy="160" r="5.5" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
            <circle cx="320" cy="160" r="2.5" fill="#eab308" />
            <text x="320" y="148" fill="#eab308" fontSize="8" className="font-black" textAnchor="middle">
              {targetStore ? targetStore.storeName.toUpperCase().slice(0, 16) : 'TARGET STORE'}
            </text>

            {/* ALL ACTIVE/FILTERED VEHICLE MARKERS */}
            {filteredShipments.map((s) => {
              const isSelected = s.id === selectedShipmentId;
              const sHash = s.trackingNumber.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
              const sProgress = 30 + (sHash % 45);
              const x = 80 + (sProgress / 100) * (320 - 80);
              const y = 150 + Math.sin((sProgress / 100) * Math.PI) * -12 + (sProgress / 100) * (160 - 150);
              
              let pColor = '#10b981'; // On Track (emerald)
              let pLight = 'rgba(16,185,129,0.15)';
              let pMedium = 'rgba(16,185,129,0.25)';
              if (s.category === 'Emergency') {
                pColor = '#f43f5e'; // Emergency (rose)
                pLight = 'rgba(244,63,94,0.15)';
                pMedium = 'rgba(244,63,94,0.25)';
              } else if (s.category === 'Delay') {
                pColor = '#f59e0b'; // Delay (amber)
                pLight = 'rgba(245,158,11,0.15)';
                pMedium = 'rgba(245,158,11,0.25)';
              }

              const fleet = fleets.find(f => f.id === s.fleetId);

              return (
                <g 
                  key={s.id} 
                  className="cursor-pointer group select-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedShipmentId(s.id);
                    setActivePopupId(s.id);
                  }}
                >
                  {/* Pulsing rings only if selected or hovered */}
                  <circle cx={x} cy={y} r={isSelected ? "14" : "10"} fill={pLight} className={isSelected ? "animate-ping" : "group-hover:scale-110 transition"} />
                  <circle cx={x} cy={y} r={isSelected ? "8" : "5"} fill={pMedium} />
                  
                  {/* Marker Core */}
                  <circle cx={x} cy={y} r="4" fill={pColor} stroke="#fff" strokeWidth="1" />
                  
                  {/* Plate label overlay */}
                  <rect x={x - 28} y={y - 19} width="56" height="11" rx="2" fill="#1e1b4b" stroke={pColor} strokeWidth={isSelected ? "1" : "0.6"} />
                  <text x={x} y={y - 11} fill={pColor} fontSize="6.5" fontWeight="bold" textAnchor="middle">
                    {fleet ? fleet.plateNumber : 'DK-8192-AK'}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* HTML Interactive Popup Overlay */}
          {activePopupId && (() => {
            const popupShip = filteredShipments.find(s => s.id === activePopupId);
            if (!popupShip) return null;
            
            const sHash = popupShip.trackingNumber.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
            const sProgress = 30 + (sHash % 45);
            const x = 80 + (sProgress / 100) * (320 - 80);
            const y = 150 + Math.sin((sProgress / 100) * Math.PI) * -12 + (sProgress / 100) * (160 - 150);
            
            const popupLeft = `${(x / 450) * 100}%`;
            const popupTop = `${(y / 250) * 100}%`;
            
            const fleet = fleets.find(f => f.id === popupShip.fleetId);
            const crew = crews.find(c => c.id === popupShip.crewId);
            const speed = Math.floor(52 + (sProgress % 18));
            
            let pColor = '#10b981';
            let badge = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
            if (popupShip.category === 'Emergency') {
              pColor = '#f43f5e';
              badge = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
            } else if (popupShip.category === 'Delay') {
              pColor = '#f59e0b';
              badge = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
            }

            return (
              <div 
                className="absolute z-30 bg-slate-900/98 border border-slate-700/80 rounded-xl p-3 shadow-2xl w-48 text-[10px] space-y-1.5 transition-all pointer-events-auto"
                style={{
                  left: popupLeft,
                  top: popupTop,
                  transform: 'translate(-50%, -115%)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 gap-2">
                  <span className="font-bold text-slate-100" style={{ color: pColor }}>
                    {fleet ? fleet.plateNumber : 'DK-8192-AK'}
                  </span>
                  <button 
                    onClick={() => setActivePopupId(null)}
                    className="text-slate-500 hover:text-slate-300 cursor-pointer p-0.5 rounded hover:bg-slate-800 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                
                <div className="space-y-1 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pengemudi:</span>
                    <span className="font-semibold text-slate-200">{crew ? crew.name : 'Supir Utama'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kecepatan:</span>
                    <span className="font-bold text-slate-200">{speed} Km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Muatan:</span>
                    <span className="text-slate-300 font-semibold truncate max-w-[100px]" title={popupShip.cargoDescription}>
                      {popupShip.cargoDescription || 'Logistik Karton'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800/50">
                    <span className="text-slate-500">Kategori:</span>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded border font-sans ${badge}`}>
                      {popupShip.category}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Map Compass Rose & Grid coordinates overlay */}
          <div className="absolute bottom-3 left-3 text-[9px] font-mono text-slate-600 space-y-0.5 z-20 bg-slate-950/80 p-1.5 rounded border border-slate-900">
            <div>GPS LAT: -8.212871&deg; S</div>
            <div>GPS LON: 114.364402&deg; E</div>
            <div>ALTITUDE: 14m Standby</div>
          </div>

          <div className="absolute bottom-3 right-3 text-[9px] font-mono text-slate-500 z-20 flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded border border-slate-900">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            <span>POLAR GRID L-2</span>
          </div>

          {/* Simulated Satellite uplink scanning line sweep */}
          <div className={`absolute left-0 right-0 h-[1.5px] bg-rose-500/15 shadow-[0_0_8px_#f43f5e] z-10 pointer-events-none ${isPinging ? 'animate-bounce' : 'top-1/3'}`}></div>
        </div>
      </div>
    </div>

      {/* FULLSCREEN MODAL OVERLAY */}
      {isExpanded && (
        <div className="fixed inset-0 bg-slate-950/98 z-[100] flex flex-col p-6 md:p-8 overflow-y-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-rose-500 animate-pulse" />
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Telemetri Satelit GPS - Mode Layar Penuh</h3>
                <p className="text-[10px] text-slate-500 font-semibold">Resolusi peta telemeter penuh Selat Bali PT AKK</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handlePingSatellite}
                disabled={isPinging}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-tight transition flex items-center gap-1.5 cursor-pointer select-none ${
                  isPinging 
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                    : 'bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700'
                }`}
              >
                <RotateCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
                <span>{isPinging ? 'Pinging...' : 'Ping Satelit GPS'}</span>
              </button>
              
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer flex items-center justify-center"
                title="Tutup Mode Layar Penuh"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dynamic Status Filters in Fullscreen */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800/60">
            {(['All', 'Emergency', 'Delay', 'On Track'] as const).map((filter) => {
              const count = filter === 'All' 
                ? classifiedShipments.length 
                : classifiedShipments.filter(s => s.category === filter).length;
              const isActive = statusFilter === filter;
              
              let activeStyles = "bg-slate-800 text-white border-slate-700 shadow-sm";
              let badgeColor = "bg-slate-900 text-slate-400";
              
              if (isActive) {
                if (filter === 'Emergency') {
                  activeStyles = "bg-rose-500/15 text-rose-400 border-rose-500/35 shadow-xs";
                  badgeColor = "bg-rose-500/20 text-rose-300";
                } else if (filter === 'Delay') {
                  activeStyles = "bg-amber-500/15 text-amber-400 border-amber-500/35 shadow-xs";
                  badgeColor = "bg-amber-500/20 text-amber-300";
                } else if (filter === 'On Track') {
                  activeStyles = "bg-emerald-500/15 text-emerald-400 border-emerald-500/35 shadow-xs";
                  badgeColor = "bg-emerald-500/20 text-emerald-300";
                } else {
                  activeStyles = "bg-blue-500/15 text-blue-400 border-blue-500/35 shadow-xs";
                  badgeColor = "bg-blue-500/20 text-blue-300";
                }
              }
              
              return (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition flex items-center gap-2 cursor-pointer border select-none ${
                    isActive 
                      ? activeStyles 
                      : "bg-transparent text-slate-400 border-transparent hover:text-slate-200"
                  }`}
                >
                  <span>{filter === 'All' ? 'Semua Armada' : filter}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono ${badgeColor}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            {/* Left Side (Telemetry details) */}
            <div className="lg:col-span-4 space-y-4 overflow-y-auto pr-1">
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Daftar Armada Terpantau ({filteredShipments.length}):
                </div>

                {filteredShipments.length === 0 ? (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60 text-center py-6 text-[10px] text-slate-400">
                    Tidak ada armada dalam kategori ini ({statusFilter}) yang sedang terpantau saat ini.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                    {filteredShipments.map((s) => {
                      const isSelected = s.id === selectedShipmentId;
                      const store = stores.find(st => st.id === s.storeId);
                      
                      let indicatorBg = 'bg-emerald-400';
                      if (s.category === 'Emergency') indicatorBg = 'bg-rose-400 animate-pulse';
                      else if (s.category === 'Delay') indicatorBg = 'bg-amber-400 animate-pulse';

                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            setSelectedShipmentId(s.id);
                            setActivePopupId(s.id);
                          }}
                          className={`p-3 rounded-xl border text-[10px] cursor-pointer transition flex items-center justify-between ${
                            isSelected 
                              ? 'bg-slate-800/80 border-slate-700 text-slate-200' 
                              : 'bg-slate-950 border-slate-800/80 hover:border-slate-700 text-slate-300'
                          }`}
                          style={isSelected ? { borderColor: statusColor.primary, color: statusColor.primary } : {}}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="font-bold flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${indicatorBg}`} />
                              <span className="truncate">{s.trackingNumber}</span>
                            </div>
                            <div className="text-[9px] text-slate-500 truncate mt-1">
                              Tujuan: {store ? store.storeName : 'Supermarket'}
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 shrink-0 font-mono">
                            {s.cargoWeightTon} Ton
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Telemetry Panel */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span>Spesifikasi Telematika Satelit:</span>
                  {selectedShipment && (
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded border ${statusColor.badge}`}>
                      {selectedShipment.category}
                    </span>
                  )}
                </div>

                {selectedShipment ? (
                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[8px] text-slate-500 block">KENDARAAN / PLAT</span>
                      <span className="font-bold text-slate-200">{targetFleet ? targetFleet.plateNumber : 'DK-8192-AK'}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[8px] text-slate-500 block">KECEPATAN GPS</span>
                      <span className="font-bold" style={{ color: statusColor.primary }}>{isPinging ? '--' : `${Math.floor(52 + (progressPercent % 18))} Km/h`}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[8px] text-slate-500 block">SATELLITE LINK</span>
                      <span className="font-bold text-slate-200">{isPinging ? 'Re-sync...' : `${satelliteCount} Sats`}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[8px] text-slate-500 block">GPS SIGNAL</span>
                      <span className="font-bold text-emerald-400">{signalStrength}% Excellent</span>
                    </div>
                    <div className="col-span-2 bg-slate-900 p-3 rounded-lg border border-slate-800 text-[10px] leading-relaxed">
                      <div className="text-slate-500 uppercase text-[8px]">Supir & Muatan:</div>
                      <div className="font-semibold text-slate-300">
                        {targetCrew ? targetCrew.name : 'Supir Utama'} &bull; {selectedShipment.cargoDescription}
                      </div>
                      <div className="text-slate-500 mt-2 uppercase text-[8px]">Update Terakhir:</div>
                      <div className="font-mono text-slate-400">{lastPingTime}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-[10px] text-slate-600 font-semibold">
                    Silakan pilih armada terpantau di atas untuk melihat spesifikasi koordinat telematika.
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Map Canvas (Fullscreen height is maximized) */}
            <div 
              onClick={() => setActivePopupId(null)}
              className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl relative overflow-hidden min-h-[350px] lg:h-full flex items-center justify-center cursor-default"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#111827_0%,#020617_100%)] opacity-95"></div>
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.15)_1px,transparent_1px)] bg-[size:16px_16px]"></div>
              
              <svg className="absolute inset-0 w-full h-full p-6 select-none z-10" viewBox="0 0 450 250" preserveAspectRatio="none">
                <path d="M 0 60 Q 50 70 80 120 T 110 180 L 110 250 L 0 250 Z" fill="rgba(30,41,59,0.2)" stroke="rgba(71,85,105,0.25)" strokeWidth="1" />
                <path d="M 180 120 Q 230 110 320 130 T 450 170 L 450 250 L 180 250 Z" fill="rgba(30,41,59,0.2)" stroke="rgba(71,85,105,0.25)" strokeWidth="1" />
                <text x="145" y="210" fill="rgba(148,163,184,0.15)" fontSize="9" className="font-mono" textAnchor="middle">SELAT BALI</text>
                <text x="50" y="210" fill="rgba(148,163,184,0.1)" fontSize="9" className="font-mono">JAWA TIMUR</text>
                <text x="350" y="210" fill="rgba(148,163,184,0.1)" fontSize="9" className="font-mono">PULAU BALI</text>

                <path d="M 80 150 Q 120 140 135 140 T 175 140 Q 240 145 320 160" fill="none" stroke="rgba(244,63,94,0.15)" strokeWidth="2.5" strokeDasharray="4,4" />

                {selectedShipment && (
                  <path 
                    d="M 80 150 Q 120 140 135 140 T 175 140 Q 240 145 320 160" 
                    fill="none" 
                    stroke={statusColor.primary} 
                    strokeWidth="2.5" 
                    strokeDasharray="120"
                    strokeDashoffset={120 - (1.2 * progressPercent)}
                    className="transition-all duration-1000 ease-in-out opacity-80"
                  />
                )}

                <circle cx="80" cy="150" r="5" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <circle cx="80" cy="150" r="2" fill="#94a3b8" />
                <text x="80" y="138" fill="#94a3b8" fontSize="8" className="font-black" textAnchor="middle">BANYUWANGI HUB</text>

                <circle cx="125" cy="140" r="4.5" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <circle cx="125" cy="140" r="2" fill="#06b6d4" />
                <text x="125" y="128" fill="#06b6d4" fontSize="7.5" className="font-semibold" textAnchor="middle">PEL. KETAPANG</text>

                <circle cx="175" cy="140" r="4.5" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <circle cx="175" cy="140" r="2" fill="#06b6d4" />
                <text x="175" y="128" fill="#06b6d4" fontSize="7.5" className="font-semibold" textAnchor="middle">PEL. GILIMANUK</text>

                <circle cx="320" cy="160" r="5.5" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <circle cx="320" cy="160" r="2.5" fill="#eab308" />
                <text x="320" y="148" fill="#eab308" fontSize="8" className="font-black" textAnchor="middle">
                  {targetStore ? targetStore.storeName.toUpperCase().slice(0, 16) : 'TARGET STORE'}
                </text>

                {/* ALL ACTIVE/FILTERED VEHICLE MARKERS */}
                {filteredShipments.map((s) => {
                  const isSelected = s.id === selectedShipmentId;
                  const sHash = s.trackingNumber.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                  const sProgress = 30 + (sHash % 45);
                  const x = 80 + (sProgress / 100) * (320 - 80);
                  const y = 150 + Math.sin((sProgress / 100) * Math.PI) * -12 + (sProgress / 100) * (160 - 150);
                  
                  let pColor = '#10b981'; // On Track (emerald)
                  let pLight = 'rgba(16,185,129,0.15)';
                  let pMedium = 'rgba(16,185,129,0.25)';
                  if (s.category === 'Emergency') {
                    pColor = '#f43f5e'; // Emergency (rose)
                    pLight = 'rgba(244,63,94,0.15)';
                    pMedium = 'rgba(244,63,94,0.25)';
                  } else if (s.category === 'Delay') {
                    pColor = '#f59e0b'; // Delay (amber)
                    pLight = 'rgba(245,158,11,0.15)';
                    pMedium = 'rgba(245,158,11,0.25)';
                  }

                  const fleet = fleets.find(f => f.id === s.fleetId);

                  return (
                    <g 
                      key={s.id} 
                      className="cursor-pointer group select-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedShipmentId(s.id);
                        setActivePopupId(s.id);
                      }}
                    >
                      {/* Pulsing rings only if selected or hovered */}
                      <circle cx={x} cy={y} r={isSelected ? "16" : "11"} fill={pLight} className={isSelected ? "animate-ping" : "group-hover:scale-110 transition"} />
                      <circle cx={x} cy={y} r={isSelected ? "9" : "6"} fill={pMedium} />
                      
                      {/* Marker Core */}
                      <circle cx={x} cy={y} r="4.5" fill={pColor} stroke="#fff" strokeWidth="1" />
                      
                      {/* Plate label overlay */}
                      <rect x={x - 30} y={y - 21} width="60" height="12" rx="2" fill="#1e1b4b" stroke={pColor} strokeWidth={isSelected ? "1" : "0.6"} />
                      <text x={x} y={y - 12} fill={pColor} fontSize="7.5" fontWeight="bold" textAnchor="middle">
                        {fleet ? fleet.plateNumber : 'DK-8192-AK'}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* HTML Interactive Popup Overlay */}
              {activePopupId && (() => {
                const popupShip = filteredShipments.find(s => s.id === activePopupId);
                if (!popupShip) return null;
                
                const sHash = popupShip.trackingNumber.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                const sProgress = 30 + (sHash % 45);
                const x = 80 + (sProgress / 100) * (320 - 80);
                const y = 150 + Math.sin((sProgress / 100) * Math.PI) * -12 + (sProgress / 100) * (160 - 150);
                
                const popupLeft = `${(x / 450) * 100}%`;
                const popupTop = `${(y / 250) * 100}%`;
                
                const fleet = fleets.find(f => f.id === popupShip.fleetId);
                const crew = crews.find(c => c.id === popupShip.crewId);
                const speed = Math.floor(52 + (sProgress % 18));
                
                let pColor = '#10b981';
                let badge = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                if (popupShip.category === 'Emergency') {
                  pColor = '#f43f5e';
                  badge = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
                } else if (popupShip.category === 'Delay') {
                  pColor = '#f59e0b';
                  badge = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
                }

                return (
                  <div 
                    className="absolute z-30 bg-slate-900/98 border border-slate-700/80 rounded-xl p-3.5 shadow-2xl w-52 text-[10.5px] space-y-2 transition-all pointer-events-auto animate-in fade-in-50 zoom-in-95 duration-100"
                    style={{
                      left: popupLeft,
                      top: popupTop,
                      transform: 'translate(-50%, -115%)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 gap-2">
                      <span className="font-bold text-slate-100 text-[11px]" style={{ color: pColor }}>
                        {fleet ? fleet.plateNumber : 'DK-8192-AK'}
                      </span>
                      <button 
                        onClick={() => setActivePopupId(null)}
                        className="text-slate-500 hover:text-slate-300 cursor-pointer p-0.5 rounded hover:bg-slate-800 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div className="space-y-1.5 text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Pengemudi:</span>
                        <span className="font-semibold text-slate-200">{crew ? crew.name : 'Supir Utama'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Kecepatan:</span>
                        <span className="font-bold text-slate-200">{speed} Km/h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Muatan:</span>
                        <span className="text-slate-300 font-semibold truncate max-w-[110px]" title={popupShip.cargoDescription}>
                          {popupShip.cargoDescription || 'Logistik Karton'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-slate-800/50">
                        <span className="text-slate-500">Kategori:</span>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border font-sans ${badge}`}>
                          {popupShip.category}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="absolute bottom-4 left-4 text-[10px] font-mono text-slate-500 space-y-0.5 z-20 bg-slate-950/85 p-2 rounded border border-slate-800">
                <div>GPS LAT: -8.212871&deg; S</div>
                <div>GPS LON: 114.364402&deg; E</div>
                <div>ALTITUDE: 14m Standby</div>
                <div>PROJECTION: MERCATOR 450x250</div>
              </div>

              <div className="absolute bottom-4 right-4 text-[10px] font-mono text-slate-400 z-20 flex items-center gap-1.5 bg-slate-950/85 p-2 rounded border border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span>POLAR GRID L-2 FULL RES</span>
              </div>

              <div className={`absolute left-0 right-0 h-[2px] bg-rose-500/20 shadow-[0_0_12px_#f43f5e] z-10 pointer-events-none ${isPinging ? 'animate-bounce' : 'top-1/2'}`}></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
