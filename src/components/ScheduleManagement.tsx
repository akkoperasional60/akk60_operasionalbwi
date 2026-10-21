import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, Truck, Store, User, Users, Ship, Clock, CheckCircle2, AlertTriangle, FileText, Search, ChevronRight, ChevronDown, ChevronUp, CalendarDays, X, LayoutList, MapPin, Printer, ShieldAlert, Edit, Trash2, Sparkles, CalendarCheck, Repeat, Layers, Move, FileSpreadsheet, History, RefreshCw, Zap, Download, Loader2, Compass, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Schedule, RetailStore, Fleet, Crew, ShipmentStatus, CrewDeliveryHistory } from '../types';
import { logisticsStore } from '../services/store';
import { ScheduleInitializerService } from '../services/scheduleInitializer';
import { CENTRAL_WAREHOUSE } from '../data/mockData';
import { AreaApprovalModal } from './AreaApprovalModal';
import { CrewSimulationModal } from './CrewSimulationModal';
import { CrewPoolManagementModal } from './CrewPoolManagementModal';
import { OptimalRoutePlanningModal } from './OptimalRoutePlanningModal';
import { OutboundGapMonitoringPanel } from './OutboundGapMonitoringPanel';
import { NextDayReadinessPanel } from './NextDayReadinessPanel';
import { SmartFillModal } from './SmartFillModal';
import { SmartFillResult } from '../services/scheduleInitializer';
import { WeeklyRoutePlanner } from './WeeklyRoutePlanner';
import { AreaRepetitionWarningModal } from './AreaRepetitionWarningModal';
import { checkConsecutiveWeekConflict, AreaRepetitionConflict } from '../services/areaRotationValidator';
import { scheduleImportValidator } from '../services/scheduleImportValidator';
import { GoogleSheetsAdminScheduleView } from './GoogleSheetsAdminScheduleView';
import { ScheduleRouteMap } from './ScheduleRouteMap';
import { downloadScheduleManifestPdf } from '../utils/suratJalanPdfGenerator';
import { useToast } from '../context/ToastContext';

interface ScheduleManagementProps {
  preselectedStore?: RetailStore | null;
  onClearPreselectedStore?: () => void;
  onNavigateToCrewHistory?: () => void;
}

const AREA_MAP: Record<string, string> = {
  'GROSIR1': 'GROSIR 1',
  'RITEL_ROGOJAMPI': 'RITEL ROGOJAMPI',
  'RITEL_SONGGON': 'RITEL SONGGON',
  'SUSULAN_ROGOJAMPI_MUNCAR': 'SUSULAN ROGOJAMPI-MUNCAR',
  'JAJAG_RETAIL': 'JAJAG RETAIL',
  'DENPASAR2': 'DENPASAR 2',
  'SUSULAN_SANGGAR_JAJAG': 'SUSULAN SANGGAR-JAJAG',
  'DENPASAR1': 'DENPASAR 1',
  'BWI_KOTA_SELATAN': 'BWI KOTA SELATAN',
  'KETAPANG_WONGSOREJO': 'KETAPANG - WONGSOREJO',
  'RITEL_SRONO': 'RITEL SRONO',
  'GALEKAN': 'GALEKAN',
  'JEMBER_BARAT': 'JEMBER BARAT',
  'RITEL_KALIBARU': 'RITEL KALIBARU',
  'PURWO_DAMBUNTUNG': 'PURWO DAMBUNTUNG',
  'PURWO_PASAR': 'PURWO PASAR',
  'SUMBERAYU_RETAIL': 'SUMBERAYU RETAIL',
  'SSLN_SINGARAJA': 'SSLN SINGARAJA',
  'SEMPU_KALISTAIL': 'SEMPU KALISTAIL',
  'JEMBER_KOTA': 'JEMBER KOTA',
  'BONDOWOSO': 'BONDOWOSO',
  'SSLN_STB_BDWS': 'SSLN STB BDWS',
  'RITEL_SANGGAR': 'RITEL SANGGAR',
  'NEGARA': 'NEGARA',
  'JEMBER_SELATAN': 'JEMBER SELATAN'
};

export const ScheduleManagement: React.FC<ScheduleManagementProps> = ({
  preselectedStore,
  onClearPreselectedStore,
  onNavigateToCrewHistory
}) => {
  const [schedules, setSchedules] = useState<Schedule[]>(logisticsStore.getSchedules());
  const [stores, setStores] = useState<RetailStore[]>(logisticsStore.getStores());
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());
  const [crews, setCrews] = useState<Crew[]>(logisticsStore.getCrews());

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('Semua Bulan');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedFleetId, setSelectedFleetId] = useState<string>('all');
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);
  const [selectedManifest, setSelectedManifest] = useState<Schedule | null>(null);
  const [isCrewSimulationOpen, setIsCrewSimulationOpen] = useState(false);
  const [isCrewPoolOpen, setIsCrewPoolOpen] = useState(false);
  const [isRouteOptimizerOpen, setIsRouteOptimizerOpen] = useState(false);
  const [isSmartFillOpen, setIsSmartFillOpen] = useState(false);
  const [autoInitMessage, setAutoInitMessage] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'schedules_list' | 'weekly_planner' | 'schedule_route_map' | 'google_sheets_all'>('schedules_list');
  const [selectedRouteScheduleId, setSelectedRouteScheduleId] = useState<string | null>(null);

  const handleViewRouteOnMap = (sch: Schedule) => {
    setSelectedRouteScheduleId(sch.id);
    setActiveMainTab('schedule_route_map');
  };
  const [consecutiveConflict, setConsecutiveConflict] = useState<AreaRepetitionConflict | null>(null);
  const { addNotification } = useToast();
  const [isExportingManifestPdf, setIsExportingManifestPdf] = useState(false);

  const handleDownloadManifestPdf = async () => {
    if (!selectedManifest) return;
    setIsExportingManifestPdf(true);
    try {
      const success = await downloadScheduleManifestPdf(selectedManifest);
      if (success) {
        addNotification(
          'delivery',
          'PDF Surat Jalan Berhasil Diunduh',
          `Berkas Surat Jalan Keluar untuk area ${selectedManifest.areaName || selectedManifest.store?.storeName || 'Tujuan'} berhasil diunduh.`
        );
      } else {
        throw new Error('Gagal menghasilkan file PDF');
      }
    } catch (err) {
      console.error('PDF export error:', err);
      addNotification(
        'sla_warning',
        'Gagal Cetak PDF',
        'Terjadi kendala saat memproses berkas PDF. Silakan coba kembali.'
      );
    } finally {
      setIsExportingManifestPdf(false);
    }
  };

  // States for Date Navigation & Grouping (Mencegah scroll ngelos ke bawah)
  const [selectedSpecificDate, setSelectedSpecificDate] = useState<string>('all');
  const [viewGroupingMode, setViewGroupingMode] = useState<'grouped_by_date' | 'flat_table'>('grouped_by_date');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const toggleDateExpansion = (dateKey: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateKey]: prev[dateKey] !== undefined ? !prev[dateKey] : false
    }));
  };

  const isDateExpanded = (dateKey: string) => {
    return expandedDates[dateKey] !== false; // default open
  };

  const handleExpandAllDates = (keys: string[]) => {
    const newState: Record<string, boolean> = {};
    keys.forEach(k => { newState[k] = true; });
    setExpandedDates(newState);
  };

  const handleCollapseAllDates = (keys: string[]) => {
    const newState: Record<string, boolean> = {};
    keys.forEach(k => { newState[k] = false; });
    setExpandedDates(newState);
  };

  // Helper to extract day of week from schedule
  const getScheduleDayName = (sch: Schedule): string => {
    if (sch.trackingNumber.includes('-SEN-') || sch.notes?.includes('Senin')) return 'Senin';
    if (sch.trackingNumber.includes('-SEL-') || sch.notes?.includes('Selasa')) return 'Selasa';
    if (sch.trackingNumber.includes('-RAB-') || sch.notes?.includes('Rabu')) return 'Rabu';
    if (sch.trackingNumber.includes('-KAM-') || sch.notes?.includes('Kamis')) return 'Kamis';
    if (sch.trackingNumber.includes('-JUM-') || sch.notes?.includes('Jumat')) return 'Jumat';
    if (sch.trackingNumber.includes('-SAB-') || sch.notes?.includes('Sabtu')) return 'Sabtu';

    if (sch.departureDate) {
      const d = new Date(sch.departureDate);
      if (!isNaN(d.getTime())) {
        const dayIdx = d.getDay();
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return days[dayIdx] || 'Lainnya';
      }
    }
    return 'Lainnya';
  };

  // Auto-initialize recurring weekly schedules on component mount if not yet present
  useEffect(() => {
    if (!ScheduleInitializerService.isWeeklyScheduleInitialized()) {
      const result = ScheduleInitializerService.initializeWeeklySchedules({ weekOffset: 0 });
      if (result.addedCount > 0) {
        setAutoInitMessage(`Sistem otomatis menginisialisasi ${result.addedCount} rute pengiriman rutin (${result.outboundCount} Prioritas Luar Kota & ${result.localCount} Lokal) dengan proteksi jeda istirahat 24 jam.`);
        setTimeout(() => setAutoInitMessage(null), 6000);
      }
    }
  }, []);

  const handleRunWeeklyAutoInit = (weekOffset: number = 0) => {
    const result = ScheduleInitializerService.initializeWeeklySchedules({ weekOffset });
    setSchedules(logisticsStore.getSchedules());
    setStores(logisticsStore.getStores());
    setCrews(logisticsStore.getCrews());
    setFleets(logisticsStore.getFleets());
    setAutoInitMessage(`Berhasil menginisialisasi ${result.addedCount} rute cerdas (${result.outboundCount} Luar Kota prioritas utama + ${result.localCount} Lokal diseimbangkan). Jeda istirahat supir minimum 24 jam terverifikasi aman!`);
    setTimeout(() => setAutoInitMessage(null), 6000);
  };

  const handleRebalanceGaps = () => {
    const result = ScheduleInitializerService.rebalanceExistingSchedulesWithGapRule();
    setSchedules(logisticsStore.getSchedules());
    if (result.violationsResolved > 0) {
      setAutoInitMessage(`⚡ Berhasil menyeimbangkan jadwal! ${result.violationsResolved} supir yang berpotensi melanggar jeda 24 jam telah dialihkan ke kru cadangan.`);
    } else {
      setAutoInitMessage(`✅ Semua supir yang bertugas di rute luar kota sudah memenuhi standar jeda istirahat 24 jam.`);
    }
    setTimeout(() => setAutoInitMessage(null), 5000);
  };

  const handleSmartFillSuccess = (result: SmartFillResult) => {
    setSchedules(logisticsStore.getSchedules());
    setStores(logisticsStore.getStores());
    setCrews(logisticsStore.getCrews());
    setFleets(logisticsStore.getFleets());

    if (result.isFullyCompliant) {
      setAutoInitMessage(`⚡ Smart Fill Berhasil: ${result.addedCount} rute baru (${result.outboundCount} Luar Kota + ${result.localCount} Lokal) telah diisi secara otomatis dengan 100% kepatuhan jeda 24 jam.`);
    } else {
      setAutoInitMessage(`⚡ Smart Fill selesai (${result.addedCount} rute). Terdapat ${result.conflicts.length} jadwal yang memerlukan penyesuaian jeda.`);
    }
    setTimeout(() => setAutoInitMessage(null), 7000);
  };

  const handleManualSyncAll = () => {
    // 1. Sync from admin schedule weeks cache if available
    let cachedWeeks: any[] | null = null;
    try {
      const saved2026 = localStorage.getItem('akk_admin_schedule_cache_2026_0');
      if (saved2026) cachedWeeks = JSON.parse(saved2026);
      if (!cachedWeeks) {
        const savedAll = localStorage.getItem('akk_admin_schedule_weeks_cache');
        if (savedAll) cachedWeeks = JSON.parse(savedAll);
      }
    } catch {}

    let syncedCount = 0;
    if (Array.isArray(cachedWeeks) && cachedWeeks.length > 0 && cachedWeeks[0]?.days?.length > 0) {
      const curFleets = logisticsStore.getFleets();
      const curCrews = logisticsStore.getCrews();

      cachedWeeks.forEach((week: any, weekIdx: number) => {
        (week.days || []).forEach((day: any) => {
          let dayNum = day.dayNumber || 5;
          let dayPadded = String(dayNum).padStart(2, '0');
          let depIso = `2026-01-${dayPadded}T07:30:00.000Z`;
          let arrIso = `2026-01-${dayPadded}T18:00:00.000Z`;

          if (day.dateString) {
            const parsed = scheduleImportValidator.parseDate(day.dateString, new Date(2026, 0, dayNum));
            if (parsed.date) {
              const dStr = parsed.date.toISOString().substring(0, 10);
              depIso = `${dStr}T07:30:00.000Z`;
              arrIso = `${dStr}T18:00:00.000Z`;
            }
          }

          (day.pengiriman || []).forEach((p: any, idx: number) => {
            const stdArea = p.area || 'Area Kirim';
            const isBali = stdArea.toUpperCase().includes('DENPASAR') || stdArea.toUpperCase().includes('SINGARAJA') || stdArea.toUpperCase().includes('NEGARA') || stdArea.toUpperCase().includes('BALI');
            const cleanArmada = (p.armada || 'FLT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'FLT';
            const datePart = depIso.substring(0, 10).replace(/-/g, '');
            const targetTracking = `PO-AKK-${datePart}-${cleanArmada}-${idx + 1}`;
            const targetId = p.id || `sch-${datePart}-${cleanArmada}-${idx + 1}`;

            const matchedFleet = curFleets.find(f => 
              f.initialCode?.toUpperCase() === p.armada?.toUpperCase() ||
              f.plateNumber.replace(/\s+/g, '').toUpperCase().includes((p.armada || '').replace(/\s+/g, '').toUpperCase())
            ) || curFleets[idx % curFleets.length] || curFleets[0];

            const matchedDriver = curCrews.find(c => 
              c.name.toLowerCase().includes((p.driver || '').toLowerCase()) || 
              (p.driver || '').toLowerCase().includes(c.name.toLowerCase())
            ) || curCrews[0];

            const matchedHelper = p.helper && p.helper !== '-' ? curCrews.find(c =>
              c.name.toLowerCase().includes((p.helper || '').toLowerCase()) ||
              (p.helper || '').toLowerCase().includes(c.name.toLowerCase())
            ) : undefined;

            const existingList = logisticsStore.getSchedules();
            const existingIdx = existingList.findIndex(s => s.id === targetId || s.trackingNumber === targetTracking || (p.id && s.id === p.id));

            const newSch: Schedule = {
              id: targetId,
              trackingNumber: targetTracking,
              originName: 'Gudang Pusat Banyuwangi DC',
              originCoords: [-8.1906, 114.3708],
              storeId: `area-${stdArea.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              store: {
                id: `area-${stdArea.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                storeCode: `AREA-${stdArea.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
                storeName: stdArea,
                island: isBali ? 'Bali & Nusa Tenggara' : 'Jawa',
                province: isBali ? 'Bali' : 'Jawa Timur',
                city: isBali ? 'Denpasar' : 'Banyuwangi',
                address: `Area Distribusi ${stdArea}`,
                latitude: isBali ? -8.6705 : -8.219,
                longitude: isBali ? 115.2126 : 114.369,
                contactPerson: 'PIC Distribusi Area',
                phone: '-',
                deliveryWindow: '08:00 - 17:00',
                storeCategory: 'Distribution Hub'
              },
              areaName: stdArea,
              fleetId: matchedFleet ? matchedFleet.id : 'flt-01',
              fleet: matchedFleet,
              crewId: matchedDriver ? matchedDriver.id : 'crw-01',
              crew: matchedDriver,
              crewHelperId: matchedHelper ? matchedHelper.id : undefined,
              crewHelper: matchedHelper,
              status: 'scheduled',
              departureDate: depIso,
              estimatedArrival: arrIso,
              cargoDescription: `Karton Box & Sheet Kemasan - ${stdArea}`,
              cargoWeightTon: isBali ? 4.5 : 2.5,
              isInterIsland: isBali,
              ferryBookingCode: isBali ? `ASDP-KTP-GLM-${idx + 100}` : undefined,
              transitPort: isBali ? 'Pelabuhan Ketapang Banyuwangi -> Gilimanuk Bali' : undefined,
              notes: p.target || `Rute Distribusi ${stdArea}`,
              createdAt: new Date().toISOString(),
              isManuallyEdited: !!p.isManuallyEdited
            };

            if (existingIdx !== -1) {
              logisticsStore.updateSchedule(existingList[existingIdx].id, newSch);
            } else {
              logisticsStore.addSchedule(newSch);
            }
            syncedCount++;
          });
        });
      });
    }

    logisticsStore.syncSchedulesToCrewHistory();
    setSchedules(logisticsStore.getSchedules());
    setAutoInitMessage(`⚡ Sinkronisasi manual selesai! Semua jadwal operasional (${logisticsStore.getSchedules().length} ritase), kalender mingguan, dan histori kru tersinkronkan penuh tanpa ada data yang terlewat.`);
    setTimeout(() => setAutoInitMessage(null), 7000);
  };

  // Area Approval Pop-up State
  const [areaApprovalModalData, setAreaApprovalModalData] = useState<{
    isOpen: boolean;
    crewName: string;
    crewId: string;
    areaName: string;
    storeName: string;
    plateNumber: string;
    tripCount: number;
    threshold: number;
    recentTrips: CrewDeliveryHistory[];
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

  // Form state
  const [newSchedule, setNewSchedule] = useState({
    trackingNumber: 'TRK-' + new Date().toISOString().substring(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100),
    storeId: '',
    fleetId: '',
    crewId: '',
    crewHelperId: '',
    crewHelper2Id: '',
    status: 'scheduled' as ShipmentStatus,
    departureDate: new Date().toISOString().substring(0, 16),
    estimatedArrival: new Date(Date.now() + 24 * 3600000).toISOString().substring(0, 16),
    cargoDescription: 'FMCG & Consumer Goods Assorted Pallets',
    cargoWeightTon: 15.0,
    isInterIsland: false,
    ferryBookingCode: '',
    transitPort: '',
    notes: ''
  });

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setSchedules(logisticsStore.getSchedules());
      setStores(logisticsStore.getStores());
      setFleets(logisticsStore.getFleets());
      setCrews(logisticsStore.getCrews());
    });
  }, []);

  // Handle preselected store from CustomerMapping tab
  useEffect(() => {
    if (preselectedStore) {
      handleOpenCreateWithStore(preselectedStore);
      if (onClearPreselectedStore) onClearPreselectedStore();
    }
  }, [preselectedStore]);

  const handleOpenCreateWithStore = (store: RetailStore) => {
    const isOuter = store.island !== 'Jawa';
    let defaultTransit = '';
    let defaultBooking = '';

    if (store.island === 'Sumatera') {
      defaultTransit = 'Pelabuhan Merak (Dermaga Eksekutif) -> Pelabuhan Bakauheni';
      defaultBooking = 'ASDP-MRK-BKU-' + Math.floor(Math.random() * 90000 + 10000);
    } else if (store.island === 'Bali & Nusa Tenggara') {
      defaultTransit = 'Pelabuhan Ketapang Banyuwangi -> Pelabuhan Gilimanuk Bali';
      defaultBooking = 'ASDP-KTP-GLM-' + Math.floor(Math.random() * 90000 + 10000);
    } else if (store.island === 'Kalimantan' || store.island === 'Sulawesi') {
      defaultTransit = 'Pelabuhan Tanjung Perak Surabaya -> Pelabuhan Tujuan (Kapal Ro-Ro)';
      defaultBooking = 'KM-DHARMA-RORO-' + Math.floor(Math.random() * 90000 + 10000);
    }

    // Auto-suggest suitable available fleet
    const suitableFleet = fleets.find(f => f.status === 'available') || fleets[0];
    const suitableCrew = crews.find(c => c.status === 'available' && c.role === 'Driver Utama') || crews[0];

    setNewSchedule({
      trackingNumber: 'TRK-' + new Date().toISOString().substring(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100),
      storeId: store.id,
      fleetId: suitableFleet ? suitableFleet.id : '',
      crewId: suitableCrew ? suitableCrew.id : '',
      crewHelperId: '',
      crewHelper2Id: '',
      status: 'scheduled',
      departureDate: new Date().toISOString().substring(0, 16),
      estimatedArrival: new Date(Date.now() + (isOuter ? 48 : 16) * 3600000).toISOString().substring(0, 16),
      cargoDescription: 'FMCG & Consumer Goods Assorted Pallets',
      cargoWeightTon: 15.0,
      isInterIsland: isOuter,
      ferryBookingCode: defaultBooking,
      transitPort: defaultTransit,
      notes: isOuter ? 'Prioritas konfirmasi slot kapal penyeberangan logistik.' : 'Jalur tol Trans-Jawa reguler.'
    });
    setIsAddScheduleOpen(true);
  };

  const handleApplyOptimalRoute = (recommended: {
    storeId: string;
    driverId: string;
    helperId?: string;
    fleetId: string;
    cargoWeightTon: number;
    notes: string;
  }) => {
    const targetStore = stores.find(s => s.id === recommended.storeId) || stores[0];
    const isOuter = targetStore ? targetStore.island !== 'Jawa' : false;
    let defaultTransit = '';
    let defaultBooking = '';

    if (targetStore?.island === 'Sumatera') {
      defaultTransit = 'Pelabuhan Merak (Dermaga Eksekutif) -> Pelabuhan Bakauheni';
      defaultBooking = 'ASDP-MRK-BKU-' + Math.floor(Math.random() * 90000 + 10000);
    } else if (targetStore?.island === 'Bali & Nusa Tenggara') {
      defaultTransit = 'Pelabuhan Ketapang Banyuwangi -> Pelabuhan Gilimanuk Bali';
      defaultBooking = 'ASDP-KTP-GLM-' + Math.floor(Math.random() * 90000 + 10000);
    } else if (targetStore?.island === 'Kalimantan' || targetStore?.island === 'Sulawesi') {
      defaultTransit = 'Pelabuhan Tanjung Perak Surabaya -> Pelabuhan Tujuan (Kapal Ro-Ro)';
      defaultBooking = 'KM-DHARMA-RORO-' + Math.floor(Math.random() * 90000 + 10000);
    }

    setNewSchedule({
      trackingNumber: 'TRK-' + new Date().toISOString().substring(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100),
      storeId: recommended.storeId,
      fleetId: recommended.fleetId,
      crewId: recommended.driverId,
      crewHelperId: recommended.helperId || '',
      crewHelper2Id: '',
      status: 'scheduled' as ShipmentStatus,
      departureDate: new Date().toISOString().substring(0, 16),
      estimatedArrival: new Date(Date.now() + (isOuter ? 48 : 16) * 3600000).toISOString().substring(0, 16),
      cargoDescription: 'FMCG & Consumer Goods Assorted Pallets',
      cargoWeightTon: recommended.cargoWeightTon,
      isInterIsland: isOuter,
      ferryBookingCode: defaultBooking,
      transitPort: defaultTransit,
      notes: recommended.notes
    });

    setIsAddScheduleOpen(true);
  };

  const handleStoreChange = (storeId: string) => {
    const selectedStore = stores.find(s => s.id === storeId);
    if (!selectedStore) return;

    const isOuter = selectedStore.island !== 'Jawa';
    let defaultTransit = '';
    let defaultBooking = '';

    if (selectedStore.island === 'Sumatera') {
      defaultTransit = 'Pelabuhan Merak (Dermaga Eksekutif) -> Pelabuhan Bakauheni';
      defaultBooking = 'ASDP-MRK-BKU-' + Math.floor(Math.random() * 90000 + 10000);
    } else if (selectedStore.island === 'Bali & Nusa Tenggara') {
      defaultTransit = 'Pelabuhan Ketapang Banyuwangi -> Pelabuhan Gilimanuk Bali';
      defaultBooking = 'ASDP-KTP-GLM-' + Math.floor(Math.random() * 90000 + 10000);
    } else if (selectedStore.island === 'Kalimantan' || selectedStore.island === 'Sulawesi') {
      defaultTransit = 'Pelabuhan Tanjung Perak Surabaya -> Pelabuhan Tujuan (Kapal Ro-Ro)';
      defaultBooking = 'KM-DHARMA-RORO-' + Math.floor(Math.random() * 90000 + 10000);
    }

    setNewSchedule(prev => ({
      ...prev,
      storeId,
      isInterIsland: isOuter,
      transitPort: defaultTransit,
      ferryBookingCode: defaultBooking
    }));
  };

  const selectedStoreObj = stores.find(s => s.id === newSchedule.storeId);
  const selectedCrewObj = crews.find(c => c.id === newSchedule.crewId);
  const selectedFleetObj = fleets.find(f => f.id === newSchedule.fleetId);
  const currentAreaName = selectedStoreObj ? `${selectedStoreObj.island} (${selectedStoreObj.city})` : '';
  const areaCheck = (selectedCrewObj && currentAreaName)
    ? logisticsStore.checkCrewAreaThreshold(selectedCrewObj.id, currentAreaName)
    : null;

  const sendWhatsAppNotification = async (crew: Crew, message: string) => {
    try {
      await fetch('/api/notify-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: crew.phone, message }),
      });
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
    }
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.storeId || !newSchedule.fleetId || !newSchedule.crewId) {
      alert('Harap pilih Toko Tujuan, Armada Truk, dan Kru Supir.');
      return;
    }

    // New validation check
    const conflict = checkConsecutiveWeekConflict(
        newSchedule.departureDate,
        selectedStoreObj?.storeName || '',
        newSchedule.crewId,
        'driverId',
        schedules,
        crews
    );
    
    if (conflict) {
        setConsecutiveConflict(conflict);
        return;
    }

    // Intercept with area threshold approval if required and not yet approved
    if (areaCheck && areaCheck.requiresApproval && !areaCheck.isApproved) {
      setAreaApprovalModalData({
        isOpen: true,
        crewName: selectedCrewObj!.name,
        crewId: selectedCrewObj!.id,
        areaName: currentAreaName,
        storeName: selectedStoreObj!.storeName,
        plateNumber: selectedFleetObj?.plateNumber || '-',
        tripCount: areaCheck.tripCount,
        threshold: areaCheck.threshold,
        recentTrips: areaCheck.recentTrips
      });
      return;
    }

    const scheduleData = {
      ...newSchedule,
      originName: CENTRAL_WAREHOUSE.name,
      originCoords: CENTRAL_WAREHOUSE.coordinates,
      departureDate: new Date(newSchedule.departureDate).toISOString(),
      estimatedArrival: new Date(newSchedule.estimatedArrival).toISOString(),
      areaApprovalStatus: (areaCheck?.requiresApproval ? 'approved' : 'not_required') as 'approved' | 'not_required',
      areaTripCount: (areaCheck?.tripCount || 0) + 1,
      isManuallyEdited: true
    };

    if ((newSchedule as any).id) {
      logisticsStore.updateSchedule((newSchedule as any).id, scheduleData);
    } else {
      logisticsStore.addSchedule(scheduleData);
      
      // Notify crew
      const crew = crews.find(c => c.id === scheduleData.crewId);
      const helper1 = crews.find(c => c.id === scheduleData.crewHelperId);
      const helper2 = crews.find(c => c.id === scheduleData.crewHelper2Id);
      const msg = `Halo, Anda ditugaskan untuk pengiriman baru ke ${selectedStoreObj?.storeName}. Armada: ${selectedFleetObj?.plateNumber}. Berangkat: ${new Date(scheduleData.departureDate).toLocaleString()}`;
      
      if (crew) sendWhatsAppNotification(crew, msg);
      if (helper1) sendWhatsAppNotification(helper1, msg);
      if (helper2) sendWhatsAppNotification(helper2, msg);
    }

    setIsAddScheduleOpen(false);
  };

  const handleApproveAreaAndSaveSchedule = (notes: string) => {
    if (!selectedStoreObj || !selectedCrewObj) return;

    logisticsStore.createAreaApprovalRequest({
      crewId: selectedCrewObj.id,
      crewName: selectedCrewObj.name,
      targetArea: currentAreaName,
      currentTripsInArea: areaCheck?.tripCount || 0,
      thresholdLimit: areaCheck?.threshold || 3,
      storeName: selectedStoreObj.storeName,
      plateNumber: selectedFleetObj?.plateNumber || '-',
      departureDate: new Date(newSchedule.departureDate).toISOString(),
      status: 'approved',
      reasonPolicy: `Otorisasi khusus penugasan pengiriman ke-${(areaCheck?.tripCount || 0) + 1} di area ${currentAreaName}.`,
      notes
    });

    logisticsStore.addSchedule({
      ...newSchedule,
      originName: CENTRAL_WAREHOUSE.name,
      originCoords: CENTRAL_WAREHOUSE.coordinates,
      departureDate: new Date(newSchedule.departureDate).toISOString(),
      estimatedArrival: new Date(newSchedule.estimatedArrival).toISOString(),
      areaApprovalStatus: 'approved',
      areaTripCount: (areaCheck?.tripCount || 0) + 1,
      isManuallyEdited: true
    });

    // Notify crew
    const crew = crews.find(c => c.id === newSchedule.crewId);
    const helper1 = crews.find(c => c.id === newSchedule.crewHelperId);
    const helper2 = crews.find(c => c.id === newSchedule.crewHelper2Id);
    const msg = `Halo, Anda ditugaskan untuk pengiriman baru ke ${selectedStoreObj?.storeName}. Armada: ${selectedFleetObj?.plateNumber}. Berangkat: ${new Date(newSchedule.departureDate).toLocaleString()}`;
    
    if (crew) sendWhatsAppNotification(crew, msg);
    if (helper1) sendWhatsAppNotification(helper1, msg);
    if (helper2) sendWhatsAppNotification(helper2, msg);

    setAreaApprovalModalData(prev => ({ ...prev, isOpen: false }));
    setIsAddScheduleOpen(false);
  };

  const handleRejectAndPickOtherDriver = () => {
    const alternativeDriver = crews.find(c => c.id !== newSchedule.crewId && c.status === 'available');
    if (alternativeDriver) {
      setNewSchedule(prev => ({ ...prev, crewId: alternativeDriver.id }));
    }
    setAreaApprovalModalData(prev => ({ ...prev, isOpen: false }));
  };

const MONTH_NAMES = [
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

const YEAR_LIST = ['Semua Tahun', '2024', '2025', '2026', '2027'];

  const handleUpdateStatus = (scheduleId: string, newStatus: ShipmentStatus) => {
    logisticsStore.updateScheduleStatus(scheduleId, newStatus);
  };

  // Helper to extract detailed date information from schedule
  const getScheduleDateDetails = (sch: Schedule) => {
    const dateStr = sch.departureDate || sch.createdAt;
    let d = dateStr ? new Date(dateStr) : new Date(2026, 0, 5);
    if (isNaN(d.getTime())) d = new Date(2026, 0, 5);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateKey = `${yyyy}-${mm}-${dd}`;

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = days[d.getDay()] || getScheduleDayName(sch);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const formattedDate = `${dd} ${months[d.getMonth()]} ${yyyy}`;
    const shortDate = `${dd} ${months[d.getMonth()].substring(0, 3)}`;

    const depTime = sch.departureDate 
      ? new Date(sch.departureDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : '07:30';
    const arrTime = sch.estimatedArrival
      ? new Date(sch.estimatedArrival).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : '17:00';

    return {
      dateKey,
      dayName,
      formattedDate,
      shortDate,
      depTime: `${depTime} WIB`,
      arrTime: `${arrTime} WIB`,
      rawDate: d
    };
  };

  // Unique list of dates present across all schedules with counts
  const distinctDateList = useMemo(() => {
    const map = new Map<string, {
      dateKey: string;
      dayName: string;
      formattedDate: string;
      shortDate: string;
      totalTrips: number;
      lokalCount: number;
      luarKotaCount: number;
      rawDate: Date;
    }>();

    schedules.forEach(sch => {
      const details = getScheduleDateDetails(sch);
      const isLuar = sch.isInterIsland || 
        (sch.areaName || '').toUpperCase().includes('BALI') || 
        (sch.areaName || '').toUpperCase().includes('DENPASAR') || 
        (sch.areaName || '').toUpperCase().includes('SINGARAJA') || 
        (sch.areaName || '').toUpperCase().includes('NEGARA');

      const existing = map.get(details.dateKey);
      if (existing) {
        existing.totalTrips++;
        if (isLuar) existing.luarKotaCount++;
        else existing.lokalCount++;
      } else {
        map.set(details.dateKey, {
          dateKey: details.dateKey,
          dayName: details.dayName,
          formattedDate: details.formattedDate,
          shortDate: details.shortDate,
          totalTrips: 1,
          lokalCount: isLuar ? 0 : 1,
          luarKotaCount: isLuar ? 1 : 0,
          rawDate: details.rawDate
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  }, [schedules]);

  const filteredSchedules = schedules.filter(sch => {
    const matchesStatus = statusFilter === 'all' || sch.status === statusFilter;
    const matchesQuery =
      sch.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sch.areaName && sch.areaName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      sch.store?.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sch.fleet?.plateNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sch.fleet?.initialCode && sch.fleet.initialCode.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Fleet filter
    const matchesFleet = selectedFleetId === 'all' || sch.fleetId === selectedFleetId;

    // Day filter
    let matchesDay = true;
    if (selectedDayFilter !== 'all') {
      const schDay = getScheduleDayName(sch);
      matchesDay = schDay === selectedDayFilter;
    }

    // Specific Date filter
    if (selectedSpecificDate !== 'all') {
      const details = getScheduleDateDetails(sch);
      if (details.dateKey !== selectedSpecificDate) {
        return false;
      }
    }

    // Month & Year Date filter
    let matchesDate = true;
    const dateStr = sch.departureDate || sch.createdAt;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        if (selectedYear !== 'Semua Tahun' && d.getFullYear().toString() !== selectedYear) {
          matchesDate = false;
        }
        if (selectedMonth !== 'Semua Bulan') {
          const monthIdx = MONTH_NAMES.indexOf(selectedMonth) - 1;
          if (monthIdx >= 0 && d.getMonth() !== monthIdx) {
            matchesDate = false;
          }
        }
      }
    }

    return matchesStatus && matchesQuery && matchesFleet && matchesDay && matchesDate;
  });

  // Chronologically sorted filtered schedules
  const sortedFilteredSchedules = useMemo(() => {
    return [...filteredSchedules].sort((a, b) => {
      const ta = new Date(a.departureDate || a.createdAt || 0).getTime();
      const tb = new Date(b.departureDate || b.createdAt || 0).getTime();
      return ta - tb;
    });
  }, [filteredSchedules]);

  // Grouped schedules by date for clean accordion cards
  const groupedSchedulesByDate = useMemo(() => {
    const groups: {
      dateKey: string;
      dayName: string;
      formattedDate: string;
      shortDate: string;
      trips: Schedule[];
      lokalCount: number;
      luarKotaCount: number;
    }[] = [];

    const map = new Map<string, typeof groups[0]>();

    sortedFilteredSchedules.forEach(sch => {
      const details = getScheduleDateDetails(sch);
      const isLuar = sch.isInterIsland || 
        (sch.areaName || '').toUpperCase().includes('BALI') || 
        (sch.areaName || '').toUpperCase().includes('DENPASAR') || 
        (sch.areaName || '').toUpperCase().includes('SINGARAJA') || 
        (sch.areaName || '').toUpperCase().includes('NEGARA');

      let grp = map.get(details.dateKey);
      if (!grp) {
        grp = {
          dateKey: details.dateKey,
          dayName: details.dayName,
          formattedDate: details.formattedDate,
          shortDate: details.shortDate,
          trips: [],
          lokalCount: 0,
          luarKotaCount: 0
        };
        map.set(details.dateKey, grp);
        groups.push(grp);
      }
      grp.trips.push(sch);
      if (isLuar) grp.luarKotaCount++;
      else grp.lokalCount++;
    });

    return groups.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [sortedFilteredSchedules]);

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Auto-Initialization Success Banner */}
      {autoInitMessage && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl flex items-center justify-between gap-3 font-medium text-xs no-print shadow-lg animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{autoInitMessage}</span>
          </div>
          <button
            onClick={() => setAutoInitMessage(null)}
            className="text-emerald-400 hover:text-white text-xs underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm no-print">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold mb-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>Dispatcher & Route Planner Hub</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Manajemen Jadwal Pengiriman & Penugasan Armada
            </h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Penjadwalan otomatis rute tetap mingguan (Senin s/d Sabtu) dari Gudang Pusat Banyuwangi DC, optimalisasi kru dan armada, serta tiket kapal penyeberangan.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center flex-wrap">
            <button
              onClick={() => setActiveMainTab('google_sheets_all')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold shadow-md transition cursor-pointer ${
                activeMainTab === 'google_sheets_all'
                  ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 font-black'
                  : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
              }`}
              title="Buka Spreadsheet Google Sheets Sheet ALL"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Google Sheets (ALL)</span>
            </button>

            {onNavigateToCrewHistory && (
              <button
                onClick={onNavigateToCrewHistory}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 hover:text-white text-xs font-bold border border-indigo-500/40 shadow-sm transition cursor-pointer"
                title="Buka submenu Histori Pengiriman & Otorisasi Kru"
              >
                <History className="w-4 h-4 text-indigo-400" />
                <span>Histori &amp; Otorisasi Kru</span>
              </button>
            )}

            <button
              onClick={handleManualSyncAll}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
              title="Sinkronkan semua data operasional secara manual dengan Sheet ALL dan Histori Kru"
            >
              <RefreshCw className="w-4 h-4 text-emerald-200" />
              <span>⚡ Sinkronkan Manual Data</span>
            </button>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 shadow-2xs">
              <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Auto-Save Aktif</span>
            </span>

            <button
              onClick={() => setIsSmartFillOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
              title="Otomatisasi jadwal mingguan"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>Smart Fill</span>
            </button>

            <button
              onClick={() => setIsRouteOptimizerOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
            >
              <Move className="w-4 h-4 text-indigo-200" />
              <span>Planner Rute</span>
            </button>

            <button
              onClick={() => {
                if (stores.length > 0) handleOpenCreateWithStore(stores[0]);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Jadwal Baru</span>
            </button>
          </div>
        </div>

        {/* Primary View Switcher: Daftar Jadwal & Matriks vs Planner Rute Mingguan (Drag & Drop) vs Google Sheets (ALL) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 flex-wrap">
            <button
              onClick={() => setActiveMainTab('schedules_list')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeMainTab === 'schedules_list'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Daftar & Matriks Jadwal Terdaftar</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeMainTab === 'schedules_list' ? 'bg-blue-800 text-blue-100' : 'bg-slate-800 text-slate-400'
              }`}>
                {schedules.length}
              </span>
            </button>

            <button
              onClick={() => setActiveMainTab('weekly_planner')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeMainTab === 'weekly_planner'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md ring-2 ring-purple-400/40'
                  : 'text-purple-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Move className="w-4 h-4 text-purple-300" />
              <span>Planner Rute Mingguan (Drag & Drop)</span>
              <span className="bg-purple-500/20 text-purple-200 border border-purple-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                Simulasi 4 Pekan
              </span>
            </button>

            <button
              onClick={() => setActiveMainTab('schedule_route_map')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeMainTab === 'schedule_route_map'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md ring-2 ring-cyan-400/40'
                  : 'text-cyan-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Peta Rute Jadwal (Leaflet)</span>
              <span className="bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                Interactive GIS
              </span>
            </button>

            <button
              onClick={() => setActiveMainTab('google_sheets_all')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeMainTab === 'google_sheets_all'
                  ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/40'
                  : 'text-emerald-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Google Sheets (ALL)</span>
              <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                Sheet ALL (5 Pekan)
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            {activeMainTab === 'weekly_planner' ? (
              <span className="text-purple-300 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Geser kartu jadwal untuk rotasi tugas Kru atau Truk</span>
              </span>
            ) : activeMainTab === 'schedule_route_map' ? (
              <span className="text-cyan-300 font-medium flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>Visualisasi Jalur GIS Leaflet: Gudang Pusat DC Banyuwangi &rarr; Toko Retail</span>
              </span>
            ) : activeMainTab === 'google_sheets_all' ? (
              <span className="text-emerald-300 font-medium flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live Roster Sheet ALL Januari 2026 & Sinkronisasi Langsung</span>
              </span>
            ) : (
              <span>Pengiriman aktif dari DC Banyuwangi</span>
            )}
          </div>
        </div>

        {/* Filter Bar: Status & Search (Only shown in schedules_list mode) */}
        {activeMainTab === 'schedules_list' && (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto max-w-full">
            {['all', 'in_transit', 'scheduled', 'delivered', 'delayed'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition cursor-pointer whitespace-nowrap ${
                  statusFilter === st ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st === 'all' && 'Semua Status'}
                {st === 'in_transit' && 'Dalam Perjalanan'}
                {st === 'scheduled' && 'Terjadwal'}
                {st === 'delivered' && 'Selesai'}
                {st === 'delayed' && 'Tertunda'}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari no resi, toko, atau plat truk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Day-of-Week Filter Row (Senin - Sabtu) */}
        <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto">
            <span className="text-slate-400 text-[11px] font-bold px-2 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-400" />
              <span>Filter Hari:</span>
            </span>
            <button
              onClick={() => setSelectedDayFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                selectedDayFilter === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua Hari ({schedules.length})
            </button>
            {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map(d => {
              const count = schedules.filter(s => getScheduleDayName(s) === d).length;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDayFilter(d)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    selectedDayFilter === d ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{d}</span>
                  <span className={`text-[10px] px-1 rounded-full ${selectedDayFilter === d ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-800 text-slate-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>Pola Rutin: <strong className="text-emerald-400 font-mono">36 Rute / Minggu</strong></span>
          </div>
        </div>

        {/* Secondary Filter Row: Bulan, Tahun, Pilih Armada */}
        <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Bulan */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px] font-medium">Bulan:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {MONTH_NAMES.map(m => (
                  <option key={m} value={m} className="bg-slate-900 text-white">
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Tahun */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px] font-medium">Tahun:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {YEAR_LIST.map(y => (
                  <option key={y} value={y} className="bg-slate-900 text-white">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Pilih Armada */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px] font-medium">Armada:</span>
              <select
                value={selectedFleetId}
                onChange={(e) => setSelectedFleetId(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[220px] truncate"
              >
                <option value="all" className="bg-slate-900 text-white">
                  Semua Armada ({fleets.length} Truk)
                </option>
                {fleets.map(f => (
                  <option key={f.id} value={f.id} className="bg-slate-900 text-white">
                    {f.initialCode ? `[${f.initialCode}] ` : ''}{f.plateNumber} - {f.vehicleType}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Tombol Ekspor CSV */}
            <button
              onClick={() => {
                const csvContent = "data:text/csv;charset=utf-8," + 
                  ["Area Kirim,Armada,Supir,Status,Keberangkatan"].concat(
                    filteredSchedules.map(s => `"${s.areaName || s.store?.storeName || AREA_MAP[s.storeId] || 'Area'}","${s.fleet?.plateNumber}","${s.crew?.name}","${s.status}","${new Date(s.departureDate).toLocaleString()}"`)
                  ).join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `jadwal_pengiriman_${new Date().toISOString().slice(0, 10)}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-900/30 hover:bg-emerald-800/40 text-emerald-400 border border-emerald-800 text-xs font-semibold transition"
            >
              <FileText className="w-3.5 h-3.5" />
              Ekspor CSV
            </button>
          </div>

          <div className="flex items-center gap-2">
            {(selectedMonth !== 'Semua Bulan' || selectedYear !== 'Semua Tahun' || selectedFleetId !== 'all') && (
              <button
                onClick={() => {
                  setSelectedMonth('Semua Bulan');
                  setSelectedYear('Semua Tahun');
                  setSelectedFleetId('all');
                }}
                className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
              >
                Reset Filter
              </button>
            )}
            <span className="text-[11px] text-slate-400">
              Ditemukan: <strong className="text-white">{filteredSchedules.length}</strong> jadwal
            </span>
          </div>
        </div>
        </>
      )}
      </div>

      {/* RENDER VIEW: Weekly Route Planner (Drag & Drop) */}
      {activeMainTab === 'weekly_planner' && (
        <WeeklyRoutePlanner
          crews={crews}
          fleets={fleets}
          stores={stores}
        />
      )}

      {/* RENDER VIEW: Schedules List & Operational Panels */}
      {activeMainTab === 'schedules_list' && (
        <>
          {/* Panel Status Kesiapan Operasional Hari Berikutnya (Next Day Readiness) */}
          <NextDayReadinessPanel
            schedules={schedules}
            crews={crews}
            fleets={fleets}
            onSchedulesUpdated={() => {
              setSchedules(logisticsStore.getSchedules());
              setCrews(logisticsStore.getCrews());
            }}
            onOpenSimulation={() => setIsCrewSimulationOpen(true)}
            onSelectSchedule={(s) => setSelectedManifest(s)}
          />

          {/* Panel Eksklusif Monitoring Kiriman Luar Kota & Audit Jeda 24 Jam */}
          <OutboundGapMonitoringPanel
            schedules={schedules}
            crews={crews}
            fleets={fleets}
            onOpenSimulation={() => setIsCrewSimulationOpen(true)}
            onSelectSchedule={(s) => setSelectedManifest(s)}
          />

      {/* 4. Panel Navigasi & Rincian Tanggal Pengiriman Area (Bebas Scroll / Tidak Ngelos ke Bawah) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold shadow-xs">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">
                  Navigasi Tanggal Area Kirim
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-950 text-blue-300 border border-blue-800">
                  Bebas Scroll Panjang
                </span>
              </div>
              <h3 className="text-base font-black text-white mt-0.5">
                Rincian Jadwal Berdasarkan Tanggal Pengiriman
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Grouped vs Flat */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewGroupingMode('grouped_by_date')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  viewGroupingMode === 'grouped_by_date'
                    ? 'bg-blue-600 text-white shadow font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Kelompokkan baris pengiriman per tanggal kalender"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Per Tanggal (Rapi)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewGroupingMode('flat_table')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  viewGroupingMode === 'flat_table'
                    ? 'bg-blue-600 text-white shadow font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Tampilkan semua baris jadwal dalam satu tabel datar"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Tabel Utuh</span>
              </button>
            </div>

            {viewGroupingMode === 'grouped_by_date' && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => handleExpandAllDates(distinctDateList.map(d => d.dateKey))}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold transition cursor-pointer"
                >
                  Buka Semua
                </button>
                <button
                  type="button"
                  onClick={() => handleCollapseAllDates(distinctDateList.map(d => d.dateKey))}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold transition cursor-pointer"
                >
                  Tutup Semua
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dropdown Selector Tanggal & Fast Navigation */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 relative">
            <select
              value={selectedSpecificDate}
              onChange={(e) => setSelectedSpecificDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer appearance-none pr-10 shadow-xs"
            >
              <option value="all">
                Semua Tanggal Pengiriman ({distinctDateList.length} Hari Aktif • {schedules.length} Total Ritase)
              </option>
              {distinctDateList.map(d => (
                <option key={d.dateKey} value={d.dateKey}>
                  📅 {d.dayName}, {d.formattedDate} — ({d.totalTrips} Ritase • {d.lokalCount} Lokal, {d.luarKotaCount} Luar Kota)
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {selectedSpecificDate !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedSpecificDate('all')}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap border border-slate-700"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Ke Semua Hari</span>
            </button>
          )}
        </div>

        {/* Horizontal Quick Date Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedSpecificDate('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              selectedSpecificDate === 'all'
                ? 'bg-blue-600 text-white shadow-xs font-black'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>Semua Tanggal</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              selectedSpecificDate === 'all' ? 'bg-blue-900 text-blue-100' : 'bg-slate-800 text-slate-400'
            }`}>
              {schedules.length}
            </span>
          </button>

          {distinctDateList.map(d => {
            const isSelected = selectedSpecificDate === d.dateKey;
            return (
              <button
                key={`pill-${d.dateKey}`}
                type="button"
                onClick={() => setSelectedSpecificDate(isSelected ? 'all' : d.dateKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs font-black ring-2 ring-blue-400/50'
                    : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>📅 {d.dayName.substring(0, 3)}, {d.shortDate}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isSelected ? 'bg-blue-900 text-blue-100' : 'bg-slate-800 text-slate-400'
                }`}>
                  {d.totalTrips}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Date Summary Notice */}
        {selectedSpecificDate !== 'all' && (() => {
          const activeDateObj = distinctDateList.find(d => d.dateKey === selectedSpecificDate);
          if (!activeDateObj) return null;
          return (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  Menampilkan rincian tanggal pengiriman <strong>{activeDateObj.dayName}, {activeDateObj.formattedDate}</strong> ({filteredSchedules.length} ritase pengiriman). Halaman dibatasi pada hari ini agar tidak perlu scroll ke bawah.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSpecificDate('all')}
                className="underline hover:text-white text-xs whitespace-nowrap font-bold cursor-pointer"
              >
                Tampilkan Semua Hari
              </button>
            </div>
          );
        })()}
      </div>

      {/* Render Table or Grouped Cards */}
      {viewGroupingMode === 'grouped_by_date' ? (
        <div className="space-y-5 no-print">
          {groupedSchedulesByDate.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <Calendar className="w-8 h-8 text-slate-500 mx-auto" />
              <h4 className="text-sm font-bold text-white">Tidak Ada Jadwal Pengiriman yang Cocok</h4>
              <p className="text-xs text-slate-400">Silakan ubah filter tanggal, status, atau kata kunci pencarian.</p>
            </div>
          ) : (
            groupedSchedulesByDate.map((group) => {
              const isOpen = isDateExpanded(group.dateKey);

              return (
                <div
                  key={`group-card-${group.dateKey}`}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm transition hover:border-slate-700"
                >
                  {/* Card Date Header */}
                  <div
                    onClick={() => toggleDateExpansion(group.dateKey)}
                    className="p-4 bg-slate-950/80 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/50 transition select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                        {group.dayName.substring(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-white">
                            📅 {group.dayName}, {group.formattedDate}
                          </h4>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white shadow-2xs">
                            {group.trips.length} Ritase Pengiriman
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>Distribusi: <strong>{group.lokalCount} Lokal</strong></span>
                          <span>•</span>
                          <span><strong>{group.luarKotaCount} Luar Kota (Bali)</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-xs text-slate-400 font-semibold">
                        {isOpen ? 'Tutup Rincian' : 'Buka Rincian'}
                      </span>
                      <div className="p-1 rounded-lg bg-slate-800 text-slate-300">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Card Body: Deliveries for this specific date */}
                  {isOpen && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="p-4 text-center w-12 font-semibold">#</th>
                            <th className="p-4 font-semibold">Area Kirim (Tujuan)</th>
                            <th className="p-4 font-semibold">Rincian Tanggal & Jam</th>
                            <th className="p-4 font-semibold">Armada Truk</th>
                            <th className="p-4 font-semibold">Supir & Helper</th>
                            <th className="p-4 font-semibold">Status</th>
                            <th className="p-4 font-semibold text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          {group.trips.map((sch, idx) => {
                            const isOuter = sch.isInterIsland;
                            const dateDetails = getScheduleDateDetails(sch);

                            return (
                              <tr key={sch.id} className="hover:bg-slate-800/40 transition">
                                <td className="p-4 text-center font-bold text-slate-500 w-12 border-r border-slate-800/60">
                                  {idx + 1}
                                </td>

                                <td className="p-4">
                                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                      {dateDetails.dayName}
                                    </span>
                                    {sch.notes?.includes('Susulan') ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        Susulan
                                      </span>
                                    ) : sch.notes?.includes('Grosir') ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                        Grosir
                                      </span>
                                    ) : isOuter ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                        🚢 Luar Kota (Bali)
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                        🚛 Lokal Jatim
                                      </span>
                                    )}
                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                      {sch.trackingNumber}
                                    </span>
                                  </div>
                                  <div className="font-extrabold text-white text-sm">
                                    {sch.areaName || sch.store?.storeName || AREA_MAP[sch.storeId] || 'Area Pengiriman'}
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3 text-slate-500" />
                                    <span>{sch.store?.city || 'Banyuwangi DC'}, {sch.store?.island || 'Jawa Timur'}</span>
                                  </div>
                                </td>

                                {/* Kolom Rincian Tanggal & Jam Berangkat / Tiba */}
                                <td className="p-4">
                                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 space-y-1 w-fit min-w-[155px]">
                                    <div className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                                      <Calendar className="w-3 h-3 text-amber-400" />
                                      <span>{dateDetails.formattedDate}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-300 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-emerald-400" />
                                      <span>ETD: <strong>{dateDetails.depTime}</strong></span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-blue-400" />
                                      <span>ETA: <strong>{dateDetails.arrTime}</strong></span>
                                    </div>
                                  </div>
                                </td>

                                {/* Kolom Armada Truk */}
                                <td className="p-4">
                                  <div className="flex items-center gap-1.5">
                                    <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                    {sch.fleet?.initialCode && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                        {sch.fleet.initialCode}
                                      </span>
                                    )}
                                    <span className="font-mono font-bold text-white text-xs">{sch.fleet?.plateNumber || '-'}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    {sch.fleet?.vehicleType || 'Engkel STD'} {sch.fleet?.brand ? `• ${sch.fleet.brand}` : ''}
                                  </div>
                                </td>

                                {/* Kolom Supir & Helper */}
                                <td className="p-4">
                                  <div className="flex flex-col gap-1 text-[11px] text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                      <User className="w-3 h-3 text-emerald-400 shrink-0" />
                                      <span>Supir: <strong className="text-slate-100">{sch.crew?.name || '-'}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <User className="w-3 h-3 text-blue-400 shrink-0" />
                                      <span>Helper 1: <strong className="text-slate-300">{sch.crewHelper?.name || '-'}</strong></span>
                                    </div>
                                    {sch.crewHelper2 && (
                                      <div className="flex items-center gap-1.5">
                                        <User className="w-3 h-3 text-purple-400 shrink-0" />
                                        <span>Helper 2: <strong className="text-slate-300">{sch.crewHelper2.name}</strong></span>
                                      </div>
                                    )}
                                  </div>
                                  {sch.areaApprovalStatus === 'approved' && (
                                    <div className="mt-1">
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                        <ShieldAlert className="w-2.5 h-2.5" />
                                        <span>Otorisasi Khusus Disetujui</span>
                                      </span>
                                    </div>
                                  )}
                                </td>

                                {/* Status */}
                                <td className="p-4">
                                  <select
                                    value={sch.status}
                                    onChange={(e) => handleUpdateStatus(sch.id, e.target.value as ShipmentStatus)}
                                    className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer border ${
                                      sch.status === 'in_transit'
                                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                                        : sch.status === 'scheduled'
                                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                        : sch.status === 'delivered'
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                        : 'bg-red-500/20 text-red-400 border-red-500/40'
                                    }`}
                                  >
                                    <option value="scheduled">Terjadwal</option>
                                    <option value="in_transit">Dalam Perjalanan</option>
                                    <option value="delivered">Terkirim (Selesai)</option>
                                    <option value="delayed">Tertunda (Delayed)</option>
                                  </select>
                                </td>

                                {/* Aksi */}
                                <td className="p-4 text-right flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      const targetCrewId = prompt('Masukkan ID Kru Target:');
                                      const reason = prompt('Alasan Swap Shift:');
                                      if (targetCrewId && reason) {
                                        logisticsStore.submitSwapShiftRequest({
                                          requesterCrewId: sch.crewId,
                                          targetCrewId,
                                          scheduleId: sch.id,
                                          reason
                                        });
                                        alert('Permintaan Swap Shift telah dikirim ke HR Admin.');
                                      }
                                    }}
                                    className="inline-flex items-center p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition"
                                    title="Ajukan Swap Shift"
                                  >
                                    <Layers className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setNewSchedule({
                                        trackingNumber: sch.trackingNumber,
                                        storeId: sch.storeId,
                                        fleetId: sch.fleetId,
                                        crewId: sch.crewId,
                                        crewHelperId: sch.crewHelperId || '',
                                        crewHelper2Id: sch.crewHelper2Id || '',
                                        status: sch.status,
                                        departureDate: sch.departureDate ? sch.departureDate.substring(0, 16) : new Date().toISOString().substring(0, 16),
                                        estimatedArrival: sch.estimatedArrival ? sch.estimatedArrival.substring(0, 16) : new Date().toISOString().substring(0, 16),
                                        cargoDescription: sch.cargoDescription || 'FMCG Assorted',
                                        cargoWeightTon: sch.cargoWeightTon || 15,
                                        isInterIsland: !!sch.isInterIsland,
                                        ferryBookingCode: sch.ferryBookingCode || '',
                                        transitPort: sch.transitPort || '',
                                        notes: sch.notes || '',
                                        ...((sch as any).id ? { id: (sch as any).id } : {})
                                      });
                                      setIsAddScheduleOpen(true);
                                    }}
                                    className="inline-flex items-center p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition"
                                    title="Edit Jadwal"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) {
                                        logisticsStore.deleteSchedule(sch.id);
                                      }
                                    }}
                                    className="inline-flex items-center p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/40 text-red-400 border border-slate-700 transition"
                                    title="Hapus Jadwal"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleViewRouteOnMap(sch)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-medium border border-cyan-500/40 transition cursor-pointer"
                                    title="Lihat Rute di Peta Interaktif Leaflet"
                                  >
                                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Peta Rute</span>
                                  </button>
                                  <button
                                    onClick={() => setSelectedManifest(sch)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
                                    title="Lihat Surat Jalan"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Surat Jalan</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Flat Table View */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm no-print">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-4 text-center w-12 font-semibold">#</th>
                  <th className="p-4 font-semibold">Area Kirim (Tujuan)</th>
                  <th className="p-4 font-semibold">Rincian Tanggal & Jam</th>
                  <th className="p-4 font-semibold">Armada Truk</th>
                  <th className="p-4 font-semibold">Supir & Helper</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {sortedFilteredSchedules.map((sch, idx) => {
                  const isOuter = sch.isInterIsland;
                  const dateDetails = getScheduleDateDetails(sch);

                  return (
                    <tr key={sch.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 text-center font-bold text-slate-500 w-12 border-r border-slate-800/60">
                        {idx + 1}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {dateDetails.dayName}
                          </span>
                          {sch.notes?.includes('Susulan') ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Susulan
                            </span>
                          ) : sch.notes?.includes('Grosir') ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Grosir
                            </span>
                          ) : isOuter ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              🚢 Luar Kota (Bali)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              🚛 Lokal Jatim
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                            {sch.trackingNumber}
                          </span>
                        </div>
                        <div className="font-extrabold text-white text-sm">
                          {sch.areaName || sch.store?.storeName || AREA_MAP[sch.storeId] || 'Area Pengiriman'}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>{sch.store?.city || 'Banyuwangi DC'}, {sch.store?.island || 'Jawa Timur'}</span>
                        </div>
                      </td>

                      {/* Kolom Rincian Tanggal & Jam Berangkat / Tiba */}
                      <td className="p-4">
                        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 space-y-1 w-fit min-w-[155px]">
                          <div className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-amber-400" />
                            <span>{dateDetails.formattedDate}</span>
                          </div>
                          <div className="text-[10px] text-slate-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-400" />
                            <span>ETD: <strong>{dateDetails.depTime}</strong></span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-400" />
                            <span>ETA: <strong>{dateDetails.arrTime}</strong></span>
                          </div>
                        </div>
                      </td>

                      {/* Kolom Armada Truk */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          {sch.fleet?.initialCode && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {sch.fleet.initialCode}
                            </span>
                          )}
                          <span className="font-mono font-bold text-white text-xs">{sch.fleet?.plateNumber || '-'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {sch.fleet?.vehicleType || 'Engkel STD'} {sch.fleet?.brand ? `• ${sch.fleet.brand}` : ''}
                        </div>
                      </td>

                      {/* Kolom Supir & Helper */}
                      <td className="p-4">
                        <div className="flex flex-col gap-1 text-[11px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>Supir: <strong className="text-slate-100">{sch.crew?.name || '-'}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-blue-400 shrink-0" />
                            <span>Helper 1: <strong className="text-slate-300">{sch.crewHelper?.name || '-'}</strong></span>
                          </div>
                          {sch.crewHelper2 && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-3 h-3 text-purple-400 shrink-0" />
                              <span>Helper 2: <strong className="text-slate-300">{sch.crewHelper2.name}</strong></span>
                            </div>
                          )}
                        </div>
                        {sch.areaApprovalStatus === 'approved' && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <ShieldAlert className="w-2.5 h-2.5" />
                              <span>Otorisasi Khusus Disetujui</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <select
                          value={sch.status}
                          onChange={(e) => handleUpdateStatus(sch.id, e.target.value as ShipmentStatus)}
                          className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer border ${
                            sch.status === 'in_transit'
                              ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                              : sch.status === 'scheduled'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : sch.status === 'delivered'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : 'bg-red-500/20 text-red-400 border-red-500/40'
                          }`}
                        >
                          <option value="scheduled">Terjadwal</option>
                          <option value="in_transit">Dalam Perjalanan</option>
                          <option value="delivered">Terkirim (Selesai)</option>
                          <option value="delayed">Tertunda (Delayed)</option>
                        </select>
                      </td>

                      {/* Aksi */}
                      <td className="p-4 text-right flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            const targetCrewId = prompt('Masukkan ID Kru Target:');
                            const reason = prompt('Alasan Swap Shift:');
                            if (targetCrewId && reason) {
                              logisticsStore.submitSwapShiftRequest({
                                requesterCrewId: sch.crewId,
                                targetCrewId,
                                scheduleId: sch.id,
                                reason
                              });
                              alert('Permintaan Swap Shift telah dikirim ke HR Admin.');
                            }
                          }}
                          className="inline-flex items-center p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition"
                          title="Ajukan Swap Shift"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setNewSchedule({
                              trackingNumber: sch.trackingNumber,
                              storeId: sch.storeId,
                              fleetId: sch.fleetId,
                              crewId: sch.crewId,
                              crewHelperId: sch.crewHelperId || '',
                              crewHelper2Id: sch.crewHelper2Id || '',
                              status: sch.status,
                              departureDate: sch.departureDate ? sch.departureDate.substring(0, 16) : new Date().toISOString().substring(0, 16),
                              estimatedArrival: sch.estimatedArrival ? sch.estimatedArrival.substring(0, 16) : new Date().toISOString().substring(0, 16),
                              cargoDescription: sch.cargoDescription || 'FMCG Assorted',
                              cargoWeightTon: sch.cargoWeightTon || 15,
                              isInterIsland: !!sch.isInterIsland,
                              ferryBookingCode: sch.ferryBookingCode || '',
                              transitPort: sch.transitPort || '',
                              notes: sch.notes || '',
                              ...((sch as any).id ? { id: (sch as any).id } : {})
                            });
                            setIsAddScheduleOpen(true);
                          }}
                          className="inline-flex items-center p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition"
                          title="Edit Jadwal"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) {
                              logisticsStore.deleteSchedule(sch.id);
                            }
                          }}
                          className="inline-flex items-center p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/40 text-red-400 border border-slate-700 transition"
                          title="Hapus Jadwal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleViewRouteOnMap(sch)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-medium border border-cyan-500/40 transition cursor-pointer"
                          title="Lihat Rute di Peta Interaktif Leaflet"
                        >
                          <Compass className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Peta Rute</span>
                        </button>
                        <button
                          onClick={() => setSelectedManifest(sch)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
                          title="Lihat Surat Jalan"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Surat Jalan</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}

      {activeMainTab === 'weekly_planner' && (
        <WeeklyRoutePlanner 
          crews={crews} 
          fleets={fleets} 
          stores={stores} 
        />
      )}

      {activeMainTab === 'schedule_route_map' && (
        <ScheduleRouteMap
          schedules={schedules}
          stores={stores}
          fleets={fleets}
          crews={crews}
          selectedScheduleId={selectedRouteScheduleId}
          onSelectSchedule={(sch) => setSelectedRouteScheduleId(sch.id)}
          onOpenManifest={(sch) => setSelectedManifest(sch)}
          onBackToSchedules={() => setActiveMainTab('schedules_list')}
        />
      )}

      {activeMainTab === 'google_sheets_all' && (
        <GoogleSheetsAdminScheduleView
          onSyncComplete={(count) => {
            setSchedules(logisticsStore.getSchedules());
            setAutoInitMessage(`⚡ Berhasil menyinkronkan ${count} rute pengiriman dari Google Sheets (Sheet ALL) ke Jadwal Operasional Aktif!`);
          }}
          onNavigateToSchedules={() => setActiveMainTab('schedules_list')}
          onNavigateToCrewHistory={onNavigateToCrewHistory}
        />
      )}


      {/* Create Schedule Modal */}
      <AnimatePresence>
        {isAddScheduleOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  Buat Surat Perintah Jalan & Jadwal Pengiriman Baru
                </h3>
                <button
                  onClick={() => setIsAddScheduleOpen(false)}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  &times;
                </button>
              </div>

            <form onSubmit={handleCreateSchedule} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Area Kirim</label>
                  <select
                    required
                    value={newSchedule.storeId}
                    onChange={(e) => setNewSchedule({ ...newSchedule, storeId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-semibold"
                  >
                    <option value="">-- Pilih Area --</option>
                    <option value="GROSIR1">GROSIR 1</option>
                    <option value="RITEL_ROGOJAMPI">RITEL ROGOJAMPI</option>
                    <option value="RITEL_SONGGON">RITEL SONGGON</option>
                    <option value="SUSULAN_ROGOJAMPI_MUNCAR">SUSULAN ROGOJAMPI-MUNCAR</option>
                    <option value="JAJAG_RETAIL">JAJAG RETAIL</option>
                    <option value="DENPASAR2">DENPASAR 2</option>
                    <option value="SUSULAN_SANGGAR_JAJAG">SUSULAN SANGGAR-JAJAG</option>
                    <option value="DENPASAR1">DENPASAR 1</option>
                    <option value="BWI_KOTA_SELATAN">BWI KOTA SELATAN</option>
                    <option value="KETAPANG_WONGSOREJO">KETAPANG - WONGSOREJO</option>
                    <option value="RITEL_SRONO">RITEL SRONO</option>
                    <option value="GALEKAN">GALEKAN</option>
                    <option value="JEMBER_BARAT">JEMBER BARAT</option>
                    <option value="RITEL_KALIBARU">RITEL KALIBARU</option>
                    <option value="PURWO_DAMBUNTUNG">PURWO DAMBUNTUNG</option>
                    <option value="PURWO_PASAR">PURWO PASAR</option>
                    <option value="SUMBERAYU_RETAIL">SUMBERAYU RETAIL</option>
                    <option value="SSLN_SINGARAJA">SSLN SINGARAJA</option>
                    <option value="SEMPU_KALISTAIL">SEMPU KALISTAIL</option>
                    <option value="JEMBER_KOTA">JEMBER KOTA</option>
                    <option value="BONDOWOSO">BONDOWOSO</option>
                    <option value="SSLN_STB_BDWS">SSLN STB BDWS</option>
                    <option value="RITEL_SANGGAR">RITEL SANGGAR</option>
                    <option value="NEGARA">NEGARA</option>
                    <option value="JEMBER_SELATAN">JEMBER SELATAN</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Alokasi Armada Truk *</label>
                  <select
                    required
                    value={newSchedule.fleetId}
                    onChange={(e) => setNewSchedule({ ...newSchedule, fleetId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-semibold"
                  >
                    <option value="">-- Pilih Truk Armada --</option>
                    {fleets.map(fl => {
                      const boxVol = fl.boxCapacityM3 || (fl.vehicleType.includes('Pick Up') ? 5.5 : fl.vehicleType.includes('Long') ? 14 : fl.vehicleType.includes('Engkel') ? 9 : 17.5);
                      return (
                        <option key={fl.id} value={fl.id}>
                          {fl.initialCode ? `[${fl.initialCode}] ` : ''}{fl.plateNumber} - {fl.vehicleType} ({boxVol} m³) [{fl.status}]
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Kru Supir Utama *</label>
                  <select
                    required
                    value={newSchedule.crewId}
                    onChange={(e) => setNewSchedule({ ...newSchedule, crewId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-semibold"
                  >
                    <option value="">-- Pilih Supir Utama --</option>
                    {crews.map(cr => (
                      <option key={cr.id} value={cr.id}>
                        {cr.name} ({cr.licenseType}) [{cr.status}]
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Kru Helper 1 / Kernet (Opsional)</label>
                  <select
                    value={newSchedule.crewHelperId || ''}
                    onChange={(e) => setNewSchedule({ ...newSchedule, crewHelperId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="">-- Pilih Helper 1 --</option>
                    {crews.filter(c => c.id !== newSchedule.crewId && c.id !== newSchedule.crewHelper2Id).map(cr => (
                      <option key={cr.id} value={cr.id}>
                        {cr.name} [{cr.status}]
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Kru Helper 2 / Kernet Tambahan (Opsional)</label>
                  <select
                    value={newSchedule.crewHelper2Id || ''}
                    onChange={(e) => setNewSchedule({ ...newSchedule, crewHelper2Id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="">-- Pilih Helper 2 (Tambahan) --</option>
                    {crews.filter(c => c.id !== newSchedule.crewId && c.id !== newSchedule.crewHelperId).map(cr => (
                      <option key={cr.id} value={cr.id}>
                        {cr.name} [{cr.status}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Area frequency & approval alert preview */}
              {areaCheck && areaCheck.requiresApproval && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Batas Pengiriman Wilayah Tercapai ({areaCheck.tripCount}x Kirim)</div>
                    <div className="text-[11px] text-slate-300 mt-0.5">
                      Supir <strong className="text-white">{selectedCrewObj?.name}</strong> telah mengirim {areaCheck.tripCount} kali ke wilayah <strong className="text-white">{currentAreaName}</strong>.
                      {areaCheck.isApproved ? (
                        <span className="text-emerald-400 font-semibold block mt-0.5">✓ Otorisasi dispensasi rotasi wilayah telah disetujui.</span>
                      ) : (
                        <span className="text-amber-400 font-semibold block mt-0.5">Pop-up persetujuan otorisasi khusus akan otomatis muncul saat Anda mengklik "Rilis Jadwal".</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Inter-island logistics configuration */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-white">
                    <input
                      type="checkbox"
                      checked={newSchedule.isInterIsland}
                      onChange={(e) => setNewSchedule({ ...newSchedule, isInterIsland: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-blue-500"
                    />
                    <Ship className="w-4 h-4 text-emerald-400" />
                    Penjadwalan Kapal Penyeberangan / Ro-Ro (Luar Pulau)
                  </label>
                </div>
              </div>

              {/* Preset Tanggal Kirim: Hari Ini vs Jadwal H+1 (Besok) */}
              <div className="flex items-center justify-between pb-1">
                <span className="text-[11px] font-bold text-slate-400">Pilihan Waktu Kirim:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const arr = new Date(now.getTime() + 4 * 3600000);
                      setNewSchedule({
                        ...newSchedule,
                        departureDate: now.toISOString().substring(0, 16),
                        estimatedArrival: arr.toISOString().substring(0, 16)
                      });
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      tomorrow.setHours(7, 30, 0, 0);
                      const arr = new Date(tomorrow.getTime() + 8 * 3600000);
                      setNewSchedule({
                        ...newSchedule,
                        departureDate: tomorrow.toISOString().substring(0, 16),
                        estimatedArrival: arr.toISOString().substring(0, 16)
                      });
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 cursor-pointer flex items-center gap-1"
                  >
                    <span>📅 Jadwal H+1 (Besok)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 text-xs">Estimasi Berangkat dari DC</label>
                  <input
                    type="datetime-local"
                    required
                    value={newSchedule.departureDate}
                    onChange={(e) => setNewSchedule({ ...newSchedule, departureDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 text-xs">Estimasi Tiba di Toko</label>
                  <input
                    type="datetime-local"
                    required
                    value={newSchedule.estimatedArrival}
                    onChange={(e) => setNewSchedule({ ...newSchedule, estimatedArrival: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-semibold text-amber-400 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Kendala</label>
                <textarea
                  placeholder="Masukkan kendala pengiriman jika ada..."
                  value={newSchedule.notes || ''}
                  onChange={(e) => setNewSchedule({ ...newSchedule, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddScheduleOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow"
                >
                  Simpan & Rilis Penugasan
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Manifest / Surat Jalan Preview Modal */}
      <AnimatePresence>
        {selectedManifest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white text-slate-900 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-sm">SURAT JALAN & MANIFEST PENGIRIMAN B2B</span>
                </div>
                <button
                  onClick={() => setSelectedManifest(null)}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  &times;
                </button>
              </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Header Company */}
              <div className="border-b border-slate-300 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-black text-slate-900 uppercase">PT. ANUGRAH KEMASAN KREATIF</h2>
                  <p className="text-slate-600 text-[11px] mt-0.5">{CENTRAL_WAREHOUSE.name}</p>
                  <p className="text-slate-500 text-[10px]">{CENTRAL_WAREHOUSE.address}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-blue-800">{selectedManifest.trackingNumber}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Tanggal: {new Date(selectedManifest.createdAt).toLocaleDateString('id-ID')}</div>
                </div>
              </div>

              {/* Destination & Fleet Matrix */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-500">AREA KIRIM:</span>
                  <div className="font-bold text-slate-900 text-sm mt-1">{selectedManifest.areaName || selectedManifest.store?.storeName || AREA_MAP[selectedManifest.storeId] || '-'}</div>
                  <div className="text-slate-600 mt-0.5">{selectedManifest.store?.address}</div>
                  <div className="text-blue-700 font-bold mt-1">Wilayah: Banyuwangi</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-500">ARMADA, DRIVER &amp; HELPER (KERNET):</span>
                  <div className="font-bold text-slate-900 text-sm mt-1 font-mono">{selectedManifest.fleet?.plateNumber}</div>
                  <div className="text-slate-600 mt-0.5">Tipe: {selectedManifest.fleet?.vehicleType}</div>
                  <div className="text-slate-600 mt-0.5">Driver: <strong>{crews.find(c => c.id === selectedManifest.crewId || c.id === selectedManifest.crew?.id)?.name || selectedManifest.crew?.name}</strong> ({selectedManifest.crew?.licenseType})</div>
                  <div className="text-slate-600 mt-0.5">Helper 1: <strong>{crews.find(c => c.id === selectedManifest.crewHelperId || c.id === selectedManifest.crewHelper?.id)?.name || selectedManifest.crewHelper?.name || '-'}</strong></div>
                  {selectedManifest.crewHelper2 && (
                    <div className="text-slate-600 mt-0.5">Helper 2: <strong>{crews.find(c => c.id === selectedManifest.crewHelper2Id || c.id === selectedManifest.crewHelper2?.id)?.name || selectedManifest.crewHelper2.name}</strong></div>
                  )}
                  <div className="text-slate-600 mt-0.5">Telp Driver: {crews.find(c => c.id === selectedManifest.crewId || c.id === selectedManifest.crew?.id)?.phone || selectedManifest.crew?.phone}</div>
                </div>
              </div>

              {/* Inter-island logistics info */}
              {selectedManifest.isInterIsland && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <Ship className="w-3.5 h-3.5" />
                    <span>LOGISTIK PENYEBERANGAN KAPAL FERRY / RO-RO</span>
                  </div>
                  <div className="mt-1 text-[11px]">
                    Pelabuhan: <strong>{selectedManifest.transitPort || '-'}</strong>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <table className="w-full text-left border border-slate-300">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-300">
                  <tr>
                    <th className="p-2">No</th>
                    <th className="p-2">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-2 font-mono">01</td>
                    <td className="p-2 font-medium">Pengiriman ke Area {selectedManifest.areaName || selectedManifest.store?.storeName || AREA_MAP[selectedManifest.storeId] || 'Tujuan'}</td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures 4 Kolom: SPV Logistik, Super Admin, Security, Driver / Helper */}
              <div className="grid grid-cols-4 gap-2 pt-4 text-center text-[10px] text-slate-600 border-t border-slate-200">
                <div>
                  <div className="font-semibold text-slate-800">Disiapkan Oleh:</div>
                  <div className="h-10 border-b border-slate-300 mt-1 flex items-center justify-center">
                    <span className="text-[9px] text-blue-700 italic">✓ Disiapkan</span>
                  </div>
                  <div className="font-bold text-slate-900 mt-1">{logisticsStore.getLogisticsCoordinator()}</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Mengetahui:</div>
                  <div className="h-10 border-b border-slate-300 mt-1 flex items-center justify-center">
                    <span className="text-[9px] text-indigo-700 italic">✓ Diketahui</span>
                  </div>
                  <div className="font-bold text-slate-900 mt-1">{logisticsStore.getSuperAdminOrManager().name}</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Security:</div>
                  <div className="h-10 border-b border-slate-300 mt-1 flex items-center justify-center">
                    <span className="text-[9px] text-emerald-700 italic">✓ Gate Pass OK</span>
                  </div>
                  <div className="font-bold text-slate-900 mt-1">{logisticsStore.getUsers().find(u => u.fullName.toLowerCase().includes('security') || u.department?.toLowerCase().includes('security') || u.role === ('security' as any))?.fullName || 'Pos Gerbang DC (Slamet Riyadi)'}</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Dibawa Oleh:</div>
                  <div className="h-10 border-b border-slate-300 mt-1 flex items-center justify-center">
                    <span className="text-[9px] text-amber-700 italic">✓ Diserahkan</span>
                  </div>
                  <div className="font-bold text-slate-900 mt-1 leading-tight">
                    {crews.find(c => c.id === selectedManifest.crewId || c.id === selectedManifest.crew?.id)?.name || selectedManifest.crew?.name || 'Driver'} 
                    {selectedManifest.crewHelper ? ` / ${crews.find(c => c.id === selectedManifest.crewHelperId || c.id === selectedManifest.crewHelper?.id)?.name || selectedManifest.crewHelper.name}` : ''}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-100 p-4 border-t border-slate-300 flex flex-wrap justify-end items-center gap-2">
              <button
                onClick={() => setSelectedManifest(null)}
                className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  const target = selectedManifest;
                  setSelectedManifest(null);
                  if (target) handleViewRouteOnMap(target);
                }}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow"
                title="Buka dan Sorot Rute Jadwal Ini di Peta Interaktif Leaflet"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Lihat Rute di Peta</span>
              </button>
              <button
                onClick={handleDownloadManifestPdf}
                disabled={isExportingManifestPdf}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer active:scale-95"
                title="Unduh berkas PDF resmi Surat Jalan Keluar & Manifest Siap Cetak"
              >
                {isExportingManifestPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh PDF Resmi</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  try {
                    if (window.self !== window.top) {
                      handleDownloadManifestPdf();
                    } else {
                      window.print();
                    }
                  } catch {
                    handleDownloadManifestPdf();
                  }
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow transition cursor-pointer active:scale-95"
                title="Cetak langsung menggunakan printer atau cetak ke PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Dokumen Surat Jalan</span>
              </button>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Area Trip Limit Approval Modal */}
      <AreaApprovalModal
        isOpen={areaApprovalModalData.isOpen}
        onClose={() => setAreaApprovalModalData(prev => ({ ...prev, isOpen: false }))}
        crewName={areaApprovalModalData.crewName}
        crewId={areaApprovalModalData.crewId}
        areaName={areaApprovalModalData.areaName}
        storeName={areaApprovalModalData.storeName}
        plateNumber={areaApprovalModalData.plateNumber}
        tripCount={areaApprovalModalData.tripCount}
        threshold={areaApprovalModalData.threshold}
        recentTrips={areaApprovalModalData.recentTrips}
        onApprove={handleApproveAreaAndSaveSchedule}
        onRejectAndPickOtherDriver={handleRejectAndPickOtherDriver}
      />

      <AreaRepetitionWarningModal
        isOpen={!!consecutiveConflict}
        conflict={consecutiveConflict}
        onProceedUrgent={() => {
             setConsecutiveConflict(null);
             // Call logic to save schedule directly
        }}
        onSelectAlternative={(crewId) => {
             setNewSchedule(prev => ({ ...prev, crewId }));
             setConsecutiveConflict(null);
        }}
        onCancel={() => setConsecutiveConflict(null)}
      />

      {/* Crew & Driver Simulation Modal */}
      <CrewSimulationModal
        isOpen={isCrewSimulationOpen}
        onClose={() => setIsCrewSimulationOpen(false)}
        crews={crews}
        fleets={fleets}
        stores={stores}
      />

      {/* Crew Pool Management Modal */}
      <CrewPoolManagementModal
        isOpen={isCrewPoolOpen}
        onClose={() => setIsCrewPoolOpen(false)}
        crews={crews}
        onRefresh={() => setCrews(logisticsStore.getCrews())}
      />

      {/* Optimal Route Planning Modal */}
      <OptimalRoutePlanningModal
        isOpen={isRouteOptimizerOpen}
        onClose={() => setIsRouteOptimizerOpen(false)}
        crews={crews}
        fleets={fleets}
        stores={stores}
        onApplyRecommendation={handleApplyOptimalRoute}
      />

      {/* Smart Fill Mingguan Modal */}
      <SmartFillModal
        isOpen={isSmartFillOpen}
        onClose={() => setIsSmartFillOpen(false)}
        onSuccess={handleSmartFillSuccess}
      />
    </div>
  );
};
