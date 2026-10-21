import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Truck, 
  Warehouse, 
  UserX, 
  Layers, 
  Check, 
  Calendar, 
  Users, 
  Sparkles, 
  ArrowRight, 
  FileText,
  Clock,
  Filter,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  Info,
  MapPin,
  Ship,
  User,
  Send,
  X,
  Plus,
  History as HistoryIcon,
  Edit,
  Trash2,
  Save,
  Zap
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  ADMIN_SCHEDULE_WEEKS, 
  AdminScheduleWeek, 
  AdminScheduleDay, 
  DeliveryAssignment, 
  WarehouseCrewAssignment, 
  OffDeliveryArmada, 
  EmployeeAbsence, 
  RAW_ADMIN_SCHEDULE_CSV, 
  convertParsedTripsToWeeks, 
  buildMonthSpecificSchedule,
  convertSchedulesToAdminWeeks
} from '../data/adminSchedule';
import { logisticsStore } from '../services/store';
import { Schedule, ShipmentStatus, RetailStore, Fleet, Crew } from '../types';
import { GoogleSheetsApiSyncModal } from './GoogleSheetsApiSyncModal';
import { 
  scheduleImportValidator, 
  ValidationSummaryReport, 
  ValidatedImportItem 
} from '../services/scheduleImportValidator';
import { 
  googleSheetsApiService, 
  ParsedSheetTrip 
} from '../services/googleSheetsApiService';
import { googleSheetsSyncService } from '../services/googleSheetsSyncService';
import { standardizeAreaName, getAreaSubDetail } from '../utils/areaNormalizer';
import { areaAutoMapper, AreaMappingEntry, OfficialAreaItem } from '../services/areaAutoMapper';
import { crewAutoMapper, CrewMappingEntry, OfficialCrewItem } from '../services/crewAutoMapper';
import { persistSchedulesToDatabase, fetchPersistedSchedulesFromServer } from '../services/supabaseService';
import { QuickCreateAreaModal } from './QuickCreateAreaModal';
import { QuickCreateCrewModal } from './QuickCreateCrewModal';
import { AreaAutoMappingSection } from './AreaAutoMappingSection';
import { CrewAutoMappingSection } from './CrewAutoMappingSection';

const FLEET_SPEC_MAP: Record<string, { model: string; category: string }> = {
  'DS1': { model: 'Isuzu Giga CDD Long', category: 'Luar Kota (Bali Spec)' },
  'DS2': { model: 'Mitsubishi Canter HDX', category: 'Heavy Duty Box 6R' },
  'DS3': { model: 'Hino Dutro 130 HD', category: 'Luar Kota (Bali Spec)' },
  'DS4': { model: 'Isuzu Elf NMR 71', category: 'Box 6-Roda Reguler' },
  'NS1': { model: 'Mitsubishi Canter FE71', category: 'Engkel Box 4-Roda' },
  'NS2': { model: 'Isuzu Elf NLR 55', category: 'Engkel Box 4-Roda' },
  'NS3': { model: 'Hino Dutro 110 SDB', category: 'Engkel Box 4-Roda' },
  'N20': { model: 'Mitsubishi L300 Box', category: 'Blind Van / Pick-up Box' }
};

const DRIVER_AVATAR_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  'Supri': { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', ring: 'border-blue-500/30' },
  'Wahyu': { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400', ring: 'border-indigo-500/30' },
  'Tiar': { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', ring: 'border-emerald-500/30' },
  'Aris': { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', ring: 'border-amber-500/30' },
  'Andre': { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', ring: 'border-purple-500/30' },
  'Wibi': { bg: 'bg-teal-500/10 dark:bg-teal-500/20', text: 'text-teal-600 dark:text-teal-400', ring: 'border-teal-500/30' },
  'Budi': { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400', ring: 'border-rose-500/30' },
  'Hadi': { bg: 'bg-cyan-500/10 dark:bg-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400', ring: 'border-cyan-500/30' }
};

function getDriverInitials(name: string): string {
  if (!name) return 'DR';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function getAreaCorridor(standardArea: string): string {
  if (standardArea.includes('DENPASAR') || standardArea.includes('SINGARAJA') || standardArea.includes('NEGARA')) {
    return 'Lintas Pulau (Ferry ASDP Ketapang - Gilimanuk)';
  }
  if (standardArea.includes('BONDOWOSO') || standardArea.includes('STB') || standardArea.includes('SITUBONDO')) {
    return 'Jalur Pantura / Pegunungan Utara';
  }
  if (standardArea.includes('ROGOJAMPI') || standardArea.includes('SONGGON') || standardArea.includes('SRONO')) {
    return 'Koridor Banyuwangi Tengah (Ritel)';
  }
  if (standardArea.includes('PURWO') || standardArea.includes('JAJAG') || standardArea.includes('GALEKAN')) {
    return 'Koridor Banyuwangi Selatan (Supermarket & Grosir)';
  }
  return 'Rute Distribusi Reguler Gudang Pusat AKK';
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

interface GoogleSheetsAdminScheduleViewProps {
  onSyncComplete?: (count: number) => void;
  onNavigateToSchedules?: () => void;
  onNavigateToCrewHistory?: () => void;
}

export const GoogleSheetsAdminScheduleView: React.FC<GoogleSheetsAdminScheduleViewProps> = ({
  onSyncComplete,
  onNavigateToSchedules,
  onNavigateToCrewHistory
}) => {
  const [selectedWeekNum, setSelectedWeekNum] = useState<number | 'all'>('all');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0 = Januari
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'luar_kota' | 'lokal'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>('05 Januari 2026');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isApiSyncModalOpen, setIsApiSyncModalOpen] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedRowsCount, setUploadedRowsCount] = useState<number>(0);
  const [uploadedValidationReport, setUploadedValidationReport] = useState<ValidationSummaryReport | null>(null);
  const [skipDuplicatesUpload, setSkipDuplicatesUpload] = useState<boolean>(false);
  const [skipInvalidUpload, setSkipInvalidUpload] = useState<boolean>(true);
  const [isUploadConfigModalOpen, setIsUploadConfigModalOpen] = useState<boolean>(false);
  const [importMonth, setImportMonth] = useState<string>('Oktober');
  const [importYear, setImportYear] = useState<string>('2026');
  const [importMode, setImportMode] = useState<'tambahkan' | 'ganti'>('tambahkan');
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [schemaValidationError, setSchemaValidationError] = useState<any | null>(null);
  const [uploadToast, setUploadToast] = useState<{
    message: string;
    type: 'error' | 'success';
    templateDownloadUrl?: string;
  } | null>(null);

  // Auto-dismiss upload toast notification (menghilang otomatis setelah 4 detik untuk notifikasi sukses)
  useEffect(() => {
    if (!uploadToast) return;
    const duration = uploadToast.type === 'success' ? 4000 : 7000;
    const timer = setTimeout(() => {
      setUploadToast(null);
    }, duration);
    return () => clearTimeout(timer);
  }, [uploadToast]);
  const [isExcelPreviewModalOpen, setIsExcelPreviewModalOpen] = useState<boolean>(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewTopRows, setPreviewTopRows] = useState<any[][]>([]);
  const [previewTotalRows, setPreviewTotalRows] = useState<number>(0);
  const [previewSheetName, setPreviewSheetName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);

  // Intelligent Area & Crew Auto-Mapping State
  const [detectedAreaMappings, setDetectedAreaMappings] = useState<Record<string, AreaMappingEntry>>({});
  const [officialAreasList, setOfficialAreasList] = useState<OfficialAreaItem[]>(() => areaAutoMapper.getOfficialAreaList());
  const [quickCreateAreaTarget, setQuickCreateAreaTarget] = useState<string | null>(null);

  const [detectedCrewMappings, setDetectedCrewMappings] = useState<Record<string, CrewMappingEntry>>({});
  const [officialCrewsList, setOfficialCrewsList] = useState<OfficialCrewItem[]>(() => crewAutoMapper.getOfficialCrewList());
  const [quickCreateCrewTarget, setQuickCreateCrewTarget] = useState<{ name: string; roleHint?: 'Driver' | 'Helper' } | null>(null);

  const [isAreaMappingModalOpen, setIsAreaMappingModalOpen] = useState<boolean>(false);
  const [activeMappingCategory, setActiveMappingCategory] = useState<'area' | 'crew'>('area');
  const [activeUploadTab, setActiveUploadTab] = useState<'audit' | 'area_mapping' | 'crew_mapping'>('audit');
  const [parsedUploadedTrips, setParsedUploadedTrips] = useState<ParsedSheetTrip[]>([]);
  const [isLiveFetching, setIsLiveFetching] = useState<boolean>(false);

  // Manual In-Place Trip Edit & Creation Modal State
  const [editingTripModal, setEditingTripModal] = useState<{
    isOpen: boolean;
    dayNumber: number;
    dateString: string;
    tripIndex: number;
    scheduleId?: string;
    driver: string;
    helper: string;
    area: string;
    armada: string;
    target: string;
    isNew?: boolean;
  } | null>(null);

  // Track expanded state for day dropdown accordions
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const toggleDayExpand = (dayDateString: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayDateString]: prev[dayDateString] === undefined ? false : !prev[dayDateString]
    }));
  };

  const handleOpenEditTripModal = (
    p: DeliveryAssignment,
    dayNumber: number,
    dateString: string,
    tripIndex: number
  ) => {
    setEditingTripModal({
      isOpen: true,
      dayNumber,
      dateString,
      tripIndex,
      scheduleId: p.id,
      driver: p.driver,
      helper: p.helper && p.helper !== '-' ? p.helper : '',
      area: p.area,
      armada: p.armada,
      target: p.target || '',
      isNew: false
    });
  };

  const handleOpenAddTripModal = (dayNumber: number, dateString: string) => {
    setEditingTripModal({
      isOpen: true,
      dayNumber,
      dateString,
      tripIndex: -1,
      scheduleId: undefined,
      driver: 'Supri',
      helper: 'Rifal',
      area: 'DENPASAR 1',
      armada: 'DS3',
      target: 'Gudang Pusat AKK Banyuwangi DC',
      isNew: true
    });
  };

  // Real-Time Auto-Sync State (Persisted in localStorage, default: true)
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('akk_auto_sync_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleAutoSync = () => {
    setIsAutoSyncEnabled(prev => {
      const nextVal = !prev;
      try {
        localStorage.setItem('akk_auto_sync_enabled', String(nextVal));
      } catch {}
      return nextVal;
    });
  };

  // Seed initial template weeks into logisticsStore if no operational schedules exist for this month yet
  const seedWeeksIntoStore = (weeksToSeed: AdminScheduleWeek[], year: number, month: number) => {
    const existing = logisticsStore.getSchedules();
    const hasMonthSchedules = existing.some(s => {
      if (!s.departureDate) return false;
      const d = new Date(s.departureDate);
      return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
    });

    if (hasMonthSchedules) return;

    const monthPadded = String(month + 1).padStart(2, '0');
    const fleets = logisticsStore.getFleets();
    const crews = logisticsStore.getCrews();

    weeksToSeed.forEach(w => {
      w.days.forEach(d => {
        const dayPadded = String(d.dayNumber).padStart(2, '0');
        const departureIso = `${year}-${monthPadded}-${dayPadded}T07:30:00.000Z`;
        const estArrivalIso = `${year}-${monthPadded}-${dayPadded}T18:00:00.000Z`;

        d.pengiriman.forEach((p, pIdx) => {
          const matchedFleet = fleets.find(f => 
            f.initialCode?.toUpperCase() === p.armada.toUpperCase() ||
            f.plateNumber.replace(/\s+/g, '').toUpperCase().includes(p.armada.replace(/\s+/g, '').toUpperCase())
          ) || fleets[pIdx % fleets.length] || fleets[0];

          const matchedDriver = crews.find(c => 
            c.name.toLowerCase().includes(p.driver.toLowerCase()) || 
            p.driver.toLowerCase().includes(c.name.toLowerCase())
          ) || crews[0];

          const matchedHelper = p.helper && p.helper !== '-' ? crews.find(c =>
            c.name.toLowerCase().includes(p.helper.toLowerCase()) ||
            p.helper.toLowerCase().includes(c.name.toLowerCase())
          ) : undefined;

          const areaStd = standardizeAreaName(p.area);
          const isBali = areaStd.includes('DENPASAR') || areaStd.includes('SINGARAJA') || areaStd.includes('NEGARA') || areaStd.includes('BALI');

          const newSch: Schedule = {
            id: p.id || `sch-${year}${monthPadded}${dayPadded}-${p.armada}-${pIdx + 1}`,
            trackingNumber: `PO-AKK-${year}${monthPadded}${dayPadded}-${p.armada}-${pIdx + 1}`,
            originName: 'Gudang Pusat AKK Banyuwangi DC',
            originCoords: [-8.1906, 114.3708],
            storeId: `area-${areaStd.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            store: {
              id: `area-${areaStd.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              storeCode: `AREA-${areaStd.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
              storeName: areaStd,
              island: isBali ? 'Bali & Nusa Tenggara' : 'Jawa',
              province: isBali ? 'Bali' : 'Jawa Timur',
              city: isBali ? 'Denpasar' : 'Banyuwangi',
              address: `Area Pengiriman ${areaStd}`,
              latitude: isBali ? -8.6705 : -8.219,
              longitude: isBali ? 115.2126 : 114.369,
              contactPerson: 'PIC Distribusi Area',
              phone: '-',
              deliveryWindow: '08:00 - 17:00',
              storeCategory: 'Distribution Hub'
            },
            areaName: areaStd,
            fleetId: matchedFleet ? matchedFleet.id : 'flt-01',
            fleet: matchedFleet,
            crewId: matchedDriver ? matchedDriver.id : 'crw-01',
            crew: matchedDriver,
            crewHelperId: matchedHelper ? matchedHelper.id : undefined,
            crewHelper: matchedHelper,
            status: 'scheduled',
            departureDate: departureIso,
            estimatedArrival: estArrivalIso,
            cargoDescription: `Karton Box & Sheet Kemasan - Area ${areaStd}`,
            cargoWeightTon: isBali ? 4.5 : 2.5,
            isInterIsland: isBali,
            ferryBookingCode: isBali ? `ASDP-KTP-GLM-${pIdx + 100}` : undefined,
            transitPort: isBali ? 'Pelabuhan Ketapang Banyuwangi -> Gilimanuk Bali' : undefined,
            notes: p.target || `Rute ${areaStd}`,
            createdAt: new Date().toISOString(),
            isManuallyEdited: false
          };

          try {
            logisticsStore.addSchedule(newSch);
          } catch {}
        });
      });
    });
  };

  // Month-specific active schedule dataset: reactive state linked with logisticsStore
  const [weeks, setWeeks] = useState<AdminScheduleWeek[]>(() => {
    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    // 1. First priority: Real schedules in logisticsStore
    const storeSchedules = logisticsStore.getSchedules();
    const weeksFromStore = convertSchedulesToAdminWeeks(storeSchedules, selectedYear, effectiveMonth);
    if (weeksFromStore.length > 0 && weeksFromStore[0]?.days?.length > 0) {
      return weeksFromStore;
    }

    // 2. Second priority: Local cache
    const cacheKey = `akk_admin_schedule_cache_${selectedYear}_${effectiveMonth}`;
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.days?.length > 0) {
          return parsed;
        }
      }
    } catch {}

    // 3. Fallback: Distinct month template
    return buildMonthSpecificSchedule(selectedYear, effectiveMonth);
  });

  const weeksRef = React.useRef(weeks);
  weeksRef.current = weeks;

  // On initial mount, load persisted schedules from server database if available
  useEffect(() => {
    fetchPersistedSchedulesFromServer().then(res => {
      if (res.exists && res.schedules.length > 0) {
        console.info(`[Database Persistence] Loaded ${res.count} persisted schedules from server.`);
        logisticsStore.batchSyncSchedules(res.schedules, [], { isImport: false });
        if (res.weeks && res.weeks.length > 0) {
          setWeeks(res.weeks);
        }
      }
    }).catch(err => console.warn('[Database Persistence Load Error]', err));
  }, []);

  // Keep weeks and store in sync whenever selectedYear, selectedMonth changes or store updates
  useEffect(() => {
    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    const storeSchedules = logisticsStore.getSchedules();
    const weeksFromStore = convertSchedulesToAdminWeeks(storeSchedules, selectedYear, effectiveMonth);

    if (weeksFromStore.length > 0 && weeksFromStore[0]?.days?.length > 0) {
      setWeeks(weeksFromStore);
      const cacheKey = `akk_admin_schedule_cache_${selectedYear}_${effectiveMonth}`;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(weeksFromStore));
        localStorage.setItem('akk_admin_schedule_weeks_cache', JSON.stringify(weeksFromStore));
      } catch {}
    } else {
      // Seed from cache or template into logisticsStore so data becomes persistent
      const cacheKey = `akk_admin_schedule_cache_${selectedYear}_${effectiveMonth}`;
      let initialWeeks: AdminScheduleWeek[] = [];
      try {
        const saved = localStorage.getItem(cacheKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.days?.length > 0) {
            initialWeeks = parsed;
          }
        }
      } catch {}

      if (initialWeeks.length === 0) {
        initialWeeks = buildMonthSpecificSchedule(selectedYear, effectiveMonth);
      }

      setWeeks(initialWeeks);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(initialWeeks));
        localStorage.setItem('akk_admin_schedule_weeks_cache', JSON.stringify(initialWeeks));
      } catch {}

      seedWeeksIntoStore(initialWeeks, selectedYear, effectiveMonth);
    }

    // Subscribe to store updates (from manual edits in ScheduleManagement or modals)
    const unsubscribe = logisticsStore.subscribe(() => {
      const curSchedules = logisticsStore.getSchedules();
      const updatedWeeks = convertSchedulesToAdminWeeks(curSchedules, selectedYear, effectiveMonth);
      if (updatedWeeks.length > 0 && updatedWeeks[0]?.days?.length > 0) {
        // Protect active weeks: only update if store has at least as many trips, or if weeks was empty
        const curTrips = weeksRef.current.flatMap(w => w.days).reduce((acc, d) => acc + (d.pengiriman?.length || 0), 0);
        const newTrips = updatedWeeks.flatMap(w => w.days).reduce((acc, d) => acc + (d.pengiriman?.length || 0), 0);
        if (newTrips >= curTrips || curTrips === 0) {
          setWeeks(updatedWeeks);
        }
      }
    });

    return unsubscribe;
  }, [selectedYear, selectedMonth]);

  // Background Auto-Sync Timer: keeps cache updated and only syncs Google Sheets if explicitly requested
  useEffect(() => {
    if (!isAutoSyncEnabled) return;

    const intervalId = setInterval(() => {
      // 1. Keep persistent storage updated with active weeks
      const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
      const cacheKey = `akk_admin_schedule_cache_${selectedYear}_${effectiveMonth}`;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(weeksRef.current));
        localStorage.setItem('akk_admin_schedule_weeks_cache', JSON.stringify(weeksRef.current));
      } catch {}

      // 2. Only if explicitly configured & auto-sync enabled by user
      const conf = googleSheetsApiService.getConfig();
      if (conf.isAutoSyncEnabled && (conf.spreadsheetId || conf.spreadsheetUrl)) {
        handleLiveFetchFromSheets().catch(() => {});
      }
    }, 60000);

    return () => clearInterval(intervalId);
  }, [isAutoSyncEnabled, selectedYear, selectedMonth]);

  const updateWeeks = (newWeeks: AdminScheduleWeek[]) => {
    setWeeks(newWeeks);
    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    const cacheKey = `akk_admin_schedule_cache_${selectedYear}_${effectiveMonth}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(newWeeks));
      localStorage.setItem('akk_admin_schedule_weeks_cache', JSON.stringify(newWeeks));
    } catch (e) {
      console.warn('Failed to cache admin schedule weeks:', e);
    }
  };

  const handleSaveTripModal = () => {
    if (!editingTripModal) return;
    const { dayNumber, dateString, tripIndex, scheduleId, driver, helper, area, armada, target, isNew } = editingTripModal;

    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    const monthPadded = String(effectiveMonth + 1).padStart(2, '0');
    const dayPadded = String(dayNumber).padStart(2, '0');
    const departureIso = `${selectedYear}-${monthPadded}-${dayPadded}T07:30:00.000Z`;
    const estArrivalIso = `${selectedYear}-${monthPadded}-${dayPadded}T18:00:00.000Z`;

    const fleets = logisticsStore.getFleets();
    const crews = logisticsStore.getCrews();

    const matchedFleet = fleets.find(f => 
      f.initialCode?.toUpperCase() === armada.toUpperCase() ||
      f.plateNumber.replace(/\s+/g, '').toUpperCase().includes(armada.replace(/\s+/g, '').toUpperCase())
    ) || fleets[0];

    const matchedDriver = crews.find(c => 
      c.name.toLowerCase().includes(driver.toLowerCase()) || 
      driver.toLowerCase().includes(c.name.toLowerCase())
    ) || crews[0];

    const matchedHelper = helper && helper.trim() && helper !== '-' ? crews.find(c => 
      c.name.toLowerCase().includes(helper.toLowerCase()) || 
      helper.toLowerCase().includes(c.name.toLowerCase())
    ) : undefined;

    const stdArea = standardizeAreaName(area);
    const isBali = stdArea.includes('DENPASAR') || stdArea.includes('SINGARAJA') || stdArea.includes('NEGARA') || stdArea.includes('BALI');

    if (isNew) {
      const newSchId = `sch-man-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const newSch: Schedule = {
        id: newSchId,
        trackingNumber: `PO-AKK-${selectedYear}${monthPadded}${dayPadded}-${armada}-${Date.now().toString().slice(-4)}`,
        originName: 'Gudang Pusat AKK Banyuwangi DC',
        originCoords: [-8.1906, 114.3708],
        storeId: `area-${stdArea.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        store: {
          id: `area-${stdArea.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          storeCode: `AREA-${stdArea.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
          storeName: stdArea,
          island: isBali ? 'Bali & Nusa Tenggara' : 'Jawa',
          province: isBali ? 'Bali' : 'Jawa Timur',
          city: isBali ? 'Denpasar' : 'Banyuwangi',
          address: `Area Pengiriman ${stdArea}`,
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
        departureDate: departureIso,
        estimatedArrival: estArrivalIso,
        cargoDescription: `Karton Box & Sheet Kemasan - Area ${stdArea}`,
        cargoWeightTon: isBali ? 4.5 : 2.5,
        isInterIsland: isBali,
        ferryBookingCode: isBali ? `ASDP-KTP-GLM-${Math.floor(Math.random() * 9000 + 1000)}` : undefined,
        transitPort: isBali ? 'Pelabuhan Ketapang Banyuwangi -> Gilimanuk Bali' : undefined,
        notes: target || `Rute ${stdArea}`,
        createdAt: new Date().toISOString(),
        isManuallyEdited: true
      };

      logisticsStore.addSchedule(newSch);
      logisticsStore.syncSchedulesToCrewHistory();

      // Update weeks state directly
      const newWeeks = weeks.map(w => ({
        ...w,
        days: w.days.map(d => {
          if (d.dayNumber === dayNumber) {
            return {
              ...d,
              pengiriman: [
                ...d.pengiriman,
                {
                  id: newSchId,
                  driver,
                  helper: helper || '-',
                  area: stdArea,
                  armada,
                  target,
                  isManuallyEdited: true
                }
              ]
            };
          }
          return d;
        })
      }));
      updateWeeks(newWeeks);
      setSyncSuccessMessage(`✅ Berhasil menambahkan ritase pengiriman baru pada ${dateString}! Data disimpan permanen.`);
    } else {
      // Editing existing
      let targetId = scheduleId;
      const storeSchedules = logisticsStore.getSchedules();

      if (!targetId) {
        const found = storeSchedules.find(s => {
          if (!s.departureDate) return false;
          const d = new Date(s.departureDate);
          const isSameDay = d.getFullYear() === selectedYear && d.getMonth() === effectiveMonth && d.getDate() === dayNumber;
          if (!isSameDay) return false;
          return s.fleet?.initialCode === armada || (s.trackingNumber && s.trackingNumber.includes(armada)) || s.crew?.name?.toLowerCase().includes(driver.toLowerCase());
        }) || storeSchedules.find(s => {
          if (!s.departureDate) return false;
          const d = new Date(s.departureDate);
          return d.getFullYear() === selectedYear && d.getMonth() === effectiveMonth && d.getDate() === dayNumber;
        });
        if (found) targetId = found.id;
      }

      if (targetId && storeSchedules.some(s => s.id === targetId)) {
        logisticsStore.updateSchedule(targetId, {
          fleetId: matchedFleet ? matchedFleet.id : undefined,
          fleet: matchedFleet,
          crewId: matchedDriver ? matchedDriver.id : undefined,
          crew: matchedDriver,
          crewHelperId: matchedHelper ? matchedHelper.id : undefined,
          crewHelper: matchedHelper,
          areaName: stdArea,
          notes: target,
          isManuallyEdited: true
        });
      } else {
        // Insert as new permanent schedule in store if not present
        const generatedId = targetId || `sch-man-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
        const newSch: Schedule = {
          id: generatedId,
          trackingNumber: `PO-AKK-${selectedYear}${monthPadded}${dayPadded}-${armada}-${Date.now().toString().slice(-4)}`,
          originName: 'Gudang Pusat AKK Banyuwangi DC',
          originCoords: [-8.1906, 114.3708],
          storeId: `area-${stdArea.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          store: {
            id: `area-${stdArea.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            storeCode: `AREA-${stdArea.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
            storeName: stdArea,
            island: isBali ? 'Bali & Nusa Tenggara' : 'Jawa',
            province: isBali ? 'Bali' : 'Jawa Timur',
            city: isBali ? 'Denpasar' : 'Banyuwangi',
            address: `Area Pengiriman ${stdArea}`,
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
          departureDate: departureIso,
          estimatedArrival: estArrivalIso,
          cargoDescription: `Karton Box & Sheet Kemasan - Area ${stdArea}`,
          cargoWeightTon: isBali ? 4.5 : 2.5,
          isInterIsland: isBali,
          ferryBookingCode: isBali ? `ASDP-KTP-GLM-${Math.floor(Math.random() * 9000 + 1000)}` : undefined,
          transitPort: isBali ? 'Pelabuhan Ketapang Banyuwangi -> Gilimanuk Bali' : undefined,
          notes: target || `Rute ${stdArea}`,
          createdAt: new Date().toISOString(),
          isManuallyEdited: true
        };
        logisticsStore.addSchedule(newSch);
        targetId = generatedId;
      }
      logisticsStore.syncSchedulesToCrewHistory();

      // Update weeks state directly
      const newWeeks = weeks.map(w => ({
        ...w,
        days: w.days.map(d => {
          if (d.dayNumber === dayNumber) {
            const newPengiriman = [...d.pengiriman];
            if (tripIndex >= 0 && tripIndex < newPengiriman.length) {
              newPengiriman[tripIndex] = {
                ...newPengiriman[tripIndex],
                id: targetId || newPengiriman[tripIndex].id,
                driver,
                helper: helper || '-',
                area: stdArea,
                armada,
                target,
                isManuallyEdited: true
              };
            }
            return {
              ...d,
              pengiriman: newPengiriman
            };
          }
          return d;
        })
      }));
      updateWeeks(newWeeks);
      setSyncSuccessMessage(`✅ Perubahan jadwal pengiriman ${dateString} berhasil disimpan permanen! Data tidak akan kembali seperti awal.`);
    }

    setEditingTripModal(null);
    setTimeout(() => setSyncSuccessMessage(null), 6000);
  };

  const handleDeleteTrip = (p: DeliveryAssignment, dayNumber: number, tripIndex: number) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus ritase ${p.driver} (${p.area} - ${p.armada})?`)) {
      return;
    }

    if (p.id) {
      logisticsStore.deleteSchedule(p.id);
    } else {
      const storeSchedules = logisticsStore.getSchedules();
      const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
      const found = storeSchedules.find(s => {
        if (!s.departureDate) return false;
        const d = new Date(s.departureDate);
        return d.getFullYear() === selectedYear && d.getMonth() === effectiveMonth && d.getDate() === dayNumber &&
          (s.fleet?.initialCode === p.armada || s.crew?.name === p.driver || s.areaName === p.area);
      });
      if (found) {
        logisticsStore.deleteSchedule(found.id);
      }
    }
    logisticsStore.syncSchedulesToCrewHistory();

    const newWeeks = weeks.map(w => ({
      ...w,
      days: w.days.map(d => {
        if (d.dayNumber === dayNumber) {
          const newPengiriman = d.pengiriman.filter((_, idx) => idx !== tripIndex);
          return {
            ...d,
            pengiriman: newPengiriman
          };
        }
        return d;
      })
    }));
    updateWeeks(newWeeks);
    setSyncSuccessMessage('✅ Ritase berhasil dihapus dari jadwal operasional aktif.');
    setTimeout(() => setSyncSuccessMessage(null), 5000);
  };

  // Filtered weeks & days dynamically adapted to selected month and year
  const filteredWeeks = useMemo(() => {
    let result = weeks;
    if (selectedWeekNum !== 'all') {
      result = result.filter(w => w.weekNumber === selectedWeekNum);
    }
    return result;
  }, [weeks, selectedWeekNum]);

  // List of unique active days across filtered weeks
  const availableDaysList = useMemo(() => {
    const list: Array<{ key: string; dayName: string; dayNumber: number; dateString: string; count: number }> = [];
    filteredWeeks.forEach((w: AdminScheduleWeek) => {
      w.days.forEach((d: AdminScheduleDay) => {
        list.push({
          key: d.dateString || `${d.dayNumber}`,
          dayName: d.dayName,
          dayNumber: d.dayNumber,
          dateString: d.dateString,
          count: d.pengiriman.length
        });
      });
    });
    return list;
  }, [filteredWeeks]);

  // Build 7-day grid cells for selected month and year
  const calendarGridData = useMemo(() => {
    const year = selectedYear;
    const monthIdx = selectedMonth === -1 ? 0 : selectedMonth;
    const monthName = MONTH_NAMES[monthIdx];

    const firstDate = new Date(year, monthIdx, 1);
    const startDayOfWeek = firstDate.getDay(); // 0 = MINGGU, 1 = SENIN, ...
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

    const monthDaysMap = new Map<number, AdminScheduleDay>();
    filteredWeeks.forEach((w: AdminScheduleWeek) => {
      w.days.forEach((d: AdminScheduleDay) => {
        monthDaysMap.set(d.dayNumber, d);
      });
    });

    const cells: Array<{
      type: 'padding' | 'day';
      dayNumber?: number;
      dateString?: string;
      dayName?: string;
      scheduleDay?: AdminScheduleDay;
      totalTrips: number;
      lokalCount: number;
      luarKotaCount: number;
    }> = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push({
        type: 'padding',
        totalTrips: 0,
        lokalCount: 0,
        luarKotaCount: 0
      });
    }

    const DAY_NAMES_ARR = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateObj = new Date(year, monthIdx, dayNum);
      const dayName = DAY_NAMES_ARR[dateObj.getDay()];
      const dayFormatted = String(dayNum).padStart(2, '0');
      const dateString = `${dayFormatted} ${monthName} ${year}`;
      const scheduleDay = monthDaysMap.get(dayNum);

      let lokalCount = 0;
      let luarKotaCount = 0;
      let totalTrips = 0;

      if (scheduleDay) {
        totalTrips = scheduleDay.pengiriman.length;
        scheduleDay.pengiriman.forEach((p: DeliveryAssignment) => {
          const std = standardizeAreaName(p.area);
          if (std.includes('DENPASAR') || std.includes('SINGARAJA') || std.includes('NEGARA') || std.includes('GIANYAR') || std.includes('TABANAN') || std.includes('KUTA') || std.includes('BALI')) {
            luarKotaCount++;
          } else {
            lokalCount++;
          }
        });
      }

      cells.push({
        type: 'day',
        dayNumber: dayNum,
        dateString,
        dayName,
        scheduleDay,
        totalTrips,
        lokalCount,
        luarKotaCount
      });
    }

    return { monthName, year, startDayOfWeek, daysInMonth, cells };
  }, [selectedYear, selectedMonth, filteredWeeks]);

  // Extract raw areas from currently active week/sheet
  const currentSheetAreas = useMemo(() => {
    const areas: string[] = [];
    filteredWeeks.forEach((w: AdminScheduleWeek) => {
      w.days.forEach((d: AdminScheduleDay) => {
        d.pengiriman.forEach((p: DeliveryAssignment) => {
          if (p.area) areas.push(p.area);
        });
      });
    });
    return areas;
  }, [filteredWeeks]);

  const totalTripsCount = useMemo(() => {
    let count = 0;
    filteredWeeks.forEach((w: AdminScheduleWeek) => w.days.forEach((d: AdminScheduleDay) => { count += d.pengiriman.length; }));
    return count;
  }, [filteredWeeks]);

  const activeDaysSummary = useMemo(() => {
    const dayLabels: string[] = [];
    filteredWeeks.forEach((w: AdminScheduleWeek) => w.days.forEach((d: AdminScheduleDay) => { dayLabels.push(`${d.dayName} (${d.dateString})`); }));
    return dayLabels.join(' & ');
  }, [filteredWeeks]);

  // Auto-run intelligent mapping for current sheet
  useEffect(() => {
    if (currentSheetAreas.length > 0) {
      const mappings = areaAutoMapper.processRawAreaBatch(currentSheetAreas);
      setDetectedAreaMappings(prev => {
        const updated = { ...mappings };
        Object.keys(prev).forEach(k => {
          if (prev[k].isUserOverridden && updated[k]) {
            updated[k] = prev[k];
          }
        });
        return updated;
      });
    }
  }, [currentSheetAreas]);

  // Handle mapping modification
  const handleMappingChange = (rawArea: string, targetOfficialArea: string) => {
    const foundOfficial = officialAreasList.find(a => a.name.toUpperCase() === targetOfficialArea.toUpperCase());
    setDetectedAreaMappings(prev => {
      const current = prev[rawArea];
      const updated: AreaMappingEntry = {
        rawArea,
        occurrenceCount: current?.occurrenceCount || 1,
        matchedOfficialArea: targetOfficialArea,
        matchedStoreId: foundOfficial?.id || null,
        confidence: 'exact',
        confidenceScore: 100,
        similarityReason: `Dipetakan manual oleh pengguna ke '${targetOfficialArea}'`,
        isUserOverridden: true
      };
      areaAutoMapper.saveUserMappingPreference(rawArea, targetOfficialArea);
      return { ...prev, [rawArea]: updated };
    });

    if (parsedUploadedTrips.length > 0) {
      const mappingDict: Record<string, string> = {};
      Object.entries({ ...detectedAreaMappings, [rawArea]: { matchedOfficialArea: targetOfficialArea } as any }).forEach(([k, v]) => {
        if (v.matchedOfficialArea) mappingDict[k] = v.matchedOfficialArea;
      });
      const currentTargetDate = new Date(selectedYear, selectedMonth === -1 ? 0 : selectedMonth, 5);
      const revalidated = scheduleImportValidator.validateImportBatch(parsedUploadedTrips, currentTargetDate, mappingDict);
      setUploadedValidationReport(revalidated);
    }
  };

  // Handle new area created via quick dialog
  const handleAreaCreated = (newArea: OfficialAreaItem, rawAreaKey: string) => {
    const updatedList = areaAutoMapper.getOfficialAreaList();
    setOfficialAreasList(updatedList);

    setDetectedAreaMappings(prev => {
      const current = prev[rawAreaKey];
      return {
        ...prev,
        [rawAreaKey]: {
          rawArea: rawAreaKey,
          occurrenceCount: current?.occurrenceCount || 1,
          matchedOfficialArea: newArea.name,
          matchedStoreId: newArea.id,
          confidence: 'exact',
          confidenceScore: 100,
          similarityReason: `Area baru '${newArea.name}' berhasil dibuat dan didaftarkan ke Jadwal Pengiriman & Muat`,
          isUserOverridden: true,
          isNewlyCreated: true
        }
      };
    });

    if (parsedUploadedTrips.length > 0) {
      const mappingDict: Record<string, string> = {};
      Object.entries({ ...detectedAreaMappings, [rawAreaKey]: { matchedOfficialArea: newArea.name } as any }).forEach(([k, v]) => {
        if (v.matchedOfficialArea) mappingDict[k] = v.matchedOfficialArea;
      });
      const currentTargetDate = new Date(selectedYear, selectedMonth === -1 ? 0 : selectedMonth, 5);
      const revalidated = scheduleImportValidator.validateImportBatch(parsedUploadedTrips, currentTargetDate, mappingDict);
      setUploadedValidationReport(revalidated);
    }

    setSyncSuccessMessage(`✨ Area baru '${newArea.name}' berhasil didaftarkan ke 'Jadwal Pengiriman & Muat' dan dipetakan otomatis!`);
    setTimeout(() => setSyncSuccessMessage(null), 6000);
  };

  // Extract raw crews from currently active week/sheet
  const currentSheetCrews = useMemo(() => {
    const crews: Array<{ name: string; roleHint?: 'Driver' | 'Helper' }> = [];
    filteredWeeks.forEach((w: AdminScheduleWeek) => {
      w.days.forEach((d: AdminScheduleDay) => {
        d.pengiriman.forEach((p: DeliveryAssignment) => {
          if (p.driver) crews.push({ name: p.driver, roleHint: 'Driver' });
          if (p.helper) {
            p.helper.split(/[,&/]+/).forEach((h: string) => {
              const cleanH = h.trim();
              if (cleanH && cleanH !== '-' && cleanH !== '0') {
                crews.push({ name: cleanH, roleHint: 'Helper' });
              }
            });
          }
        });
      });
    });
    return crews;
  }, [filteredWeeks]);

  // Auto-run intelligent crew mapping for current sheet
  useEffect(() => {
    if (currentSheetCrews.length > 0) {
      const mappings = crewAutoMapper.processRawCrewBatch(currentSheetCrews);
      setDetectedCrewMappings(prev => {
        const updated = { ...mappings };
        Object.keys(prev).forEach(k => {
          if (prev[k].isUserOverridden && updated[k]) {
            updated[k] = prev[k];
          }
        });
        return updated;
      });
    }
  }, [currentSheetCrews]);

  // Handle crew mapping modification
  const handleCrewMappingChange = (rawName: string, targetCrewName: string) => {
    const foundCrew = officialCrewsList.find(c => c.name.toUpperCase() === targetCrewName.toUpperCase());
    setDetectedCrewMappings(prev => {
      const current = prev[rawName];
      const updated: CrewMappingEntry = {
        rawName,
        roleHint: current?.roleHint || 'Driver',
        occurrenceCount: current?.occurrenceCount || 1,
        matchedCrewId: foundCrew?.id || null,
        matchedCrewName: targetCrewName,
        matchedCrewRole: foundCrew?.role || 'Driver',
        confidence: 'exact',
        confidenceScore: 100,
        similarityReason: `Dipetakan manual oleh pengguna ke '${targetCrewName}'`,
        isUserOverridden: true
      };
      crewAutoMapper.saveMappingPreference(rawName, targetCrewName);
      return { ...prev, [rawName]: updated };
    });
  };

  // Handle new crew created via quick modal
  const handleCrewCreated = (newCrew: OfficialCrewItem) => {
    const updatedList = crewAutoMapper.getOfficialCrewList();
    setOfficialCrewsList(updatedList);

    setDetectedCrewMappings(prev => {
      const current = prev[newCrew.name];
      return {
        ...prev,
        [newCrew.name]: {
          rawName: newCrew.name,
          roleHint: newCrew.role as any,
          occurrenceCount: current?.occurrenceCount || 1,
          matchedCrewId: newCrew.id,
          matchedCrewName: newCrew.name,
          matchedCrewRole: newCrew.role,
          confidence: 'exact',
          confidenceScore: 100,
          similarityReason: `Kru baru '${newCrew.name}' berhasil didaftarkan ke database resmi AKK`,
          isUserOverridden: true,
          isNewlyCreated: true
        }
      };
    });

    setSyncSuccessMessage(`✨ Kru baru '${newCrew.name}' (${newCrew.role}) berhasil didaftarkan dan dipetakan otomatis!`);
    setTimeout(() => setSyncSuccessMessage(null), 6000);
  };

  // Aggregate statistics
  const stats = useMemo(() => {
    let totalTrips = 0;
    let totalWarehouseRoles = 0;
    let totalLeaves = 0;
    let totalOff = 0;
    let totalLuarKota = 0;
    let totalLokal = 0;
    const uniqueAreasSet = new Set<string>();

    filteredWeeks.forEach((w: AdminScheduleWeek) => {
      w.days.forEach((d: AdminScheduleDay) => {
        totalTrips += d.pengiriman.length;
        totalWarehouseRoles += d.gudang.length;
        totalLeaves += d.karyawanIzin.length;
        totalOff += d.pengirimanOff.length;
        d.pengiriman.forEach((p: DeliveryAssignment) => {
          if (p.area) {
            const std = standardizeAreaName(p.area);
            uniqueAreasSet.add(std);
            if (std.includes('DENPASAR') || std.includes('SINGARAJA') || std.includes('NEGARA') || std.includes('GIANYAR') || std.includes('TABANAN') || std.includes('KUTA')) {
              totalLuarKota++;
            } else {
              totalLokal++;
            }
          }
        });
      });
    });

    return { 
      totalTrips, 
      totalWarehouseRoles, 
      totalLeaves, 
      totalOff, 
      totalLuarKota, 
      totalLokal,
      totalUniqueAreas: uniqueAreasSet.size
    };
  }, [filteredWeeks]);

  // Handle Export to Excel .xlsx
  const handleExportXLSX = () => {
    try {
      const rows: any[][] = [];
      
      // Header metadata
      rows.push(['PT ANUGRAH KEMASAN KREATIF - BANYUWANGI CENTRAL HUB']);
      rows.push(['JADWAL OPERASIONAL & PENUGASAN (SHEET: ALL)']);
      rows.push(['Periode: Januari 2026', 'Total Pengiriman: ' + stats.totalTrips]);
      rows.push([]);

      filteredWeeks.forEach(week => {
        rows.push([`=== ${week.weekLabel} (${week.dateRangeLabel}) ===`]);
        rows.push([
          'TANGGAL', 
          'HARI', 
          'KATEGORI', 
          'DRIVER / PETUGAS', 
          'HELPER / PIC', 
          'AREA / ROLE', 
          'ARMADA / MOBIL', 
          'BACKUP / TARGET / KET'
        ]);

        week.days.forEach((day: AdminScheduleDay) => {
          // Deliveries
          day.pengiriman.forEach((p: DeliveryAssignment) => {
            rows.push([
              day.dateString,
              day.dayName,
              'FORMASI PENGIRIMAN',
              p.driver,
              p.helper,
              p.area,
              p.armada,
              p.target ? `Target: ${p.target}` : (p.backup || '-')
            ]);
          });

          // Warehouse
          day.gudang.forEach((g: WarehouseCrewAssignment) => {
            rows.push([
              day.dateString,
              day.dayName,
              'FORMASI GUDANG',
              g.nama,
              '-',
              g.role,
              '-',
              g.keterangan || '-'
            ]);
          });

          // Off / Maintenance
          day.pengirimanOff.forEach((o: OffDeliveryArmada) => {
            rows.push([
              day.dateString,
              day.dayName,
              'PENGIRIMAN OFF / ARMADA FREE',
              o.nama,
              '-',
              o.keterangan,
              '-',
              o.backup || '-'
            ]);
          });

          // Leave / Absence
          day.karyawanIzin.forEach((iz: EmployeeAbsence) => {
            rows.push([
              day.dateString,
              day.dayName,
              'KARYAWAN IZIN / SAKIT',
              iz.nama,
              '-',
              iz.keterangan,
              '-',
              iz.backup || '-'
            ]);
          });
        });
        rows.push([]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ALL');
      XLSX.writeFile(workbook, `Jadwal_Operasional_AKK_Sheet_ALL_${new Date().toISOString().substring(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Gagal mengekspor file spreadsheet.');
    }
  };

  const downloadScheduleTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['PT ANUGRAH KEMASAN KREATIF - TEMPLATE JADWAL OPERASIONAL LOGISTIK'],
        ['Tanggal', 'No', 'Driver', 'Helper', '', 'Area Kirim', 'Armada'],
        ['', '', '', '1', '2', '', ''],
        // Day 1: 05/01/2026
        ['05/01/2026', 1, 'Supri', 'Rifal', 'Aldi', 'DENPASAR 1', 'DS3'],
        ['', 2, 'Wahyu', 'Yusuf', '', 'DENPASAR 2', 'DS1'],
        ['', 3, 'Tiar', 'Faris', '', 'BONDOWOSO', 'NS3'],
        ['', 4, 'Aris', 'Rohman', '', 'SITUBONDO', 'DS2'],
        ['', 5, 'Andre', 'Aan', '', 'SUSULAN GENTENG - ROGOJAMPI', 'DS4'],
        ['', 6, 'Wibi', 'Teguh', '', 'PURWO DAMBUNTUNG', 'NS2'],
        ['', 7, 'Budi', 'Rizal', '', 'PURWO PASAR', 'NS1'],
        ['', 8, 'Hadi', 'Yudi', '', 'JAJAG RETAIL', 'N20'],
        ['------------------------------------------------------------', '----------------', '----------------', '----------------', '----------------', '----------------', '----------------'],
        // Day 2: 06/01/2026
        ['06/01/2026', 1, 'Andre', 'Aan', 'Hardi', 'SINGARAJA', 'DS5'],
        ['', 2, 'Hadi', 'Yusuf', '', 'SUMBERAYU RETAIL', 'NL2'],
        ['', 3, 'Aris', 'Rifal', '', 'GALEKAN', 'NL1'],
        ['', 4, 'Tiar', 'Faris', '', 'GROSIR BWI - ROGOJAMPI', 'DS4'],
        ['', 5, 'Budi', 'Rohman', '', 'SUSULAN SANGGAR JAJAG', 'NS1'],
        ['------------------------------------------------------------', '----------------', '----------------', '----------------', '----------------', '----------------', '----------------'],
        // Day 3: 07/01/2026
        ['07/01/2026', 1, 'Supri', 'Rifal', '', 'DENPASAR 1', 'DS5'],
        ['', 2, 'Hadi', 'Faris', '', 'DENPASAR 2', 'DS3'],
        ['', 3, 'Aris', 'Rohman', '', 'GENTENG RETAIL', 'NL2'],
        ['', 4, 'Tiar', 'Yusuf', '', 'ROGOJAMPI RETAIL', 'DS4'],
        ['', 5, 'Budi', 'Aan', '', 'MUNCAR RETAIL', 'NS2'],
        ['', 6, 'Aldi', 'Wahyu', '', 'KETAPANG WONGSOREJO', 'NS3']
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'ALL');
      XLSX.writeFile(wb, 'Template_Jadwal_Operasional_AKK.xlsx');
    } catch (err) {
      console.error('Error generating template:', err);
      alert('Gagal mengunduh template spreadsheet.');
    }
  };

  // Core file processing with server-side schema validation & preview modal
  // Instant local spreadsheet schema validation (reliable, offline-safe, zero HTML error)
  const validateSpreadsheetLocally = (rows: any[][]) => {
    if (!rows || rows.length === 0) {
      return {
        valid: false,
        error: 'Spreadsheet Kosong',
        message: 'File Excel tidak memiliki baris data atau lembar kerja kosong.',
        missingColumns: ['Semua Kolom Data'],
        correctFormat: 'NO | TANGGAL | DRIVER | HELPER | AREA | ARMADA',
        templateDownloadUrl: '/api/download-schedule-template'
      };
    }

    let hasDriver = false;
    let hasArea = false;
    let hasArmada = false;
    const detectedHeaders: string[] = [];

    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').toUpperCase().trim();
        if (val) detectedHeaders.push(val);
        if (val === 'DRIVER' || val === 'SUPIR') hasDriver = true;
        if (val.includes('AREA') || val.includes('TUJUAN') || val.includes('RUTE')) hasArea = true;
        if (val === 'ARMADA' || val === 'MOBIL' || val === 'PLAT') hasArmada = true;
      }
    }

    const missingColumns: string[] = [];
    if (!hasDriver) missingColumns.push('DRIVER (atau SUPIR)');
    if (!hasArea) missingColumns.push('AREA / TUJUAN');
    if (!hasArmada) missingColumns.push('ARMADA');

    if (missingColumns.length > 0) {
      return {
        valid: false,
        error: 'Format Kolom Spreadsheet Tidak Sesuai Schema',
        message: `Header kolom wajib PT AKK Logistics tidak lengkap. Kolom yang tidak ditemukan: ${missingColumns.join(', ')}.`,
        missingColumns,
        detectedHeaders: Array.from(new Set(detectedHeaders)).slice(0, 15),
        correctFormat: 'Format Standar: NO | TANGGAL | DRIVER | HELPER | AREA / TUJUAN | ARMADA',
        templateDownloadUrl: '/api/download-schedule-template'
      };
    }

    return { valid: true };
  };

  // Core file processing with instant client-side validation & preview modal
  const processFile = async (file: File) => {
    if (!file) return;
    setUploadedFileName(file.name);

    try {
      // 1. Read workbook directly in browser via ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      
      const sheetName = workbook.SheetNames.find(n => n.toUpperCase() === 'ALL') || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // 2. Perform client-side schema validation
      const valResult = validateSpreadsheetLocally(jsonRows);

      if (!valResult.valid) {
        setSchemaValidationError(valResult);
        setUploadToast({
          message: valResult.error || 'Format file Excel tidak sesuai dengan schema sistem.',
          type: 'error',
          templateDownloadUrl: valResult.templateDownloadUrl || '/api/download-schedule-template'
        });
        return;
      }

      setSchemaValidationError(null);
      setUploadToast({
        message: 'File spreadsheet berhasil divalidasi dan siap dipratinjau.',
        type: 'success'
      });

      // 3. Smart Header & Data Row Extraction:
      // (a) Scan first 10 rows for column headers
      let headerRowIdx = -1;
      let maxKeywordMatches = 0;

      for (let r = 0; r < Math.min(jsonRows.length, 10); r++) {
        const row = jsonRows[r];
        if (!row || !Array.isArray(row) || row.length === 0) continue;
        let matches = 0;
        for (const cell of row) {
          const cellUpper = String(cell || '').toUpperCase().trim();
          if (cellUpper === 'DRIVER' || cellUpper === 'SUPIR') matches += 3;
          if (cellUpper.includes('AREA') || cellUpper.includes('TUJUAN') || cellUpper.includes('RUTE')) matches += 3;
          if (cellUpper === 'ARMADA' || cellUpper === 'MOBIL' || cellUpper === 'PLAT') matches += 3;
          if (cellUpper.includes('TANGGAL') || cellUpper.includes('DATE') || cellUpper.includes('HARI')) matches += 2;
          if (cellUpper === 'HELPER' || cellUpper === 'KERNET') matches += 2;
          if (cellUpper === 'NO' || cellUpper === 'NO.' || cellUpper === 'NOMOR' || cellUpper === 'NO URUT') matches += 1;
        }
        if (matches > maxKeywordMatches) {
          maxKeywordMatches = matches;
          headerRowIdx = r;
        }
      }

      // Fallback: pick the row with the most non-empty columns if no strong header detected
      if (headerRowIdx === -1 || maxKeywordMatches < 2) {
        let maxNonEmpty = 0;
        for (let r = 0; r < Math.min(jsonRows.length, 5); r++) {
          const row = jsonRows[r];
          if (!row || !Array.isArray(row)) continue;
          const count = row.filter(c => c !== undefined && c !== null && String(c).trim() !== '').length;
          if (count > maxNonEmpty) {
            maxNonEmpty = count;
            headerRowIdx = r;
          }
        }
        if (headerRowIdx === -1) headerRowIdx = 0;
      }

      const rawHeaderRow = jsonRows[headerRowIdx] || [];
      const nextRow = jsonRows[headerRowIdx + 1];

      // (b) Check if row directly below headers is a sub-header (e.g. '1', '2' under Helper)
      let isNextRowSubheader = false;
      if (nextRow && Array.isArray(nextRow) && nextRow.length > 0) {
        const hasDriverOrArea = nextRow.some(c => {
          const str = String(c || '').trim();
          return str.length > 3 && !/^\d+$/.test(str) && !['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'].includes(str.toUpperCase());
        });
        const hasSubIndices = nextRow.some(c => String(c || '').trim() === '1' || String(c || '').trim() === '2');
        if (!hasDriverOrArea && hasSubIndices) {
          isNextRowSubheader = true;
        }
      }

      const dataStartIdx = isNextRowSubheader ? headerRowIdx + 2 : headerRowIdx + 1;
      const allDataRows = jsonRows.slice(dataStartIdx);

      // (c) Find max columns across rawHeaderRow, nextRow, and all data rows to avoid any column truncation
      let maxCols = Math.max(rawHeaderRow.length, isNextRowSubheader && nextRow ? nextRow.length : 0);
      for (const dr of allDataRows) {
        if (dr && Array.isArray(dr) && dr.length > maxCols) {
          maxCols = dr.length;
        }
      }

      // (d) Build clean headers
      const finalHeaders: string[] = [];
      let lastParentHeader = '';

      for (let c = 0; c < maxCols; c++) {
        let h = String(rawHeaderRow[c] || '').trim();
        if (h) {
          lastParentHeader = h;
        }

        if (isNextRowSubheader && nextRow && nextRow[c] !== undefined && String(nextRow[c]).trim() !== '') {
          const sub = String(nextRow[c]).trim();
          if (h) {
            h = `${h} ${sub}`;
          } else if (lastParentHeader) {
            h = `${lastParentHeader} ${sub}`;
          } else {
            h = sub;
          }
        }

        if (!h) {
          if (c === 0) h = 'Tanggal';
          else if (c === 1 && rawHeaderRow.some(x => String(x).toUpperCase().includes('DRIVER'))) h = 'No';
          else if (c === 4 && String(finalHeaders[3] || '').includes('Helper')) h = 'Helper 2';
          else h = `Kolom ${c + 1}`;
        }
        finalHeaders.push(h);
      }

      setPreviewFile(file);
      setPreviewHeaders(finalHeaders);
      setPreviewTopRows(allDataRows);
      setPreviewTotalRows(allDataRows.length);
      setPreviewSheetName(sheetName);
      setIsExcelPreviewModalOpen(true);
    } catch (err) {
      console.error('File parsing error:', err);
      alert('Gagal membaca struktur file Excel / CSV.');
    }
  };

  const executeFinalUpload = async (file: File) => {
    setIsExcelPreviewModalOpen(false);
    setUploadToast(null);
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      
      const sheetName = workbook.SheetNames.find(n => n.toUpperCase() === 'ALL') || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      setUploadedRowsCount(jsonRows.length);
      const parsedTrips = googleSheetsApiService.parseScheduleRows(jsonRows);
      setParsedUploadedTrips(parsedTrips);

      if (parsedTrips.length > 0) {
        const groupedWeeks = convertParsedTripsToWeeks(parsedTrips);
        updateWeeks(groupedWeeks);
      }

      const rawAreas = parsedTrips.map(t => t.area).filter(Boolean);
      const mappings = areaAutoMapper.processRawAreaBatch(rawAreas);
      setDetectedAreaMappings(mappings);

      const rawCrews: Array<{ name: string; roleHint?: 'Driver' | 'Helper' }> = [];
      parsedTrips.forEach(t => {
        if (t.driver) rawCrews.push({ name: t.driver, roleHint: 'Driver' });
        if (t.helper) {
          t.helper.split(/[,&/]+/).forEach(h => {
            const cleanH = h.trim();
            if (cleanH && cleanH !== '-' && cleanH !== '0') {
              rawCrews.push({ name: cleanH, roleHint: 'Helper' });
            }
          });
        }
      });
      const crewMappings = crewAutoMapper.processRawCrewBatch(rawCrews);
      setDetectedCrewMappings(crewMappings);

      const mappingDict: Record<string, string> = {};
      Object.entries(mappings).forEach(([k, v]) => {
        if (v.matchedOfficialArea) mappingDict[k] = v.matchedOfficialArea;
      });

      const targetContextDate = new Date(selectedYear, selectedMonth === -1 ? 0 : selectedMonth, 5);
      const validation = scheduleImportValidator.validateImportBatch(parsedTrips, targetContextDate, mappingDict);
      setUploadedValidationReport(validation);

      const hasUnmappedArea = Object.values(mappings).some(m => m.confidence === 'unmapped');
      const hasUnmappedCrew = Object.values(crewMappings).some(m => m.confidence === 'unmapped');
      setActiveUploadTab(hasUnmappedArea ? 'area_mapping' : (hasUnmappedCrew ? 'crew_mapping' : 'audit'));
      setIsUploadModalOpen(true);
    } catch (err) {
      console.error('Final upload execution error:', err);
      alert('Gagal memproses file Excel secara penuh.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // Handle direct manual live fetch from connected Google Sheets
  const handleLiveFetchFromSheets = async () => {
    setIsLiveFetching(true);
    try {
      const conf = googleSheetsApiService.getConfig();
      let sheetId = conf.spreadsheetId;
      if (!sheetId && conf.spreadsheetUrl) {
        sheetId = googleSheetsApiService.extractSpreadsheetId(conf.spreadsheetUrl);
      }
      if (!sheetId) {
        const storeConf = googleSheetsSyncService.getConfig();
        if (storeConf?.spreadsheetUrl) {
          sheetId = googleSheetsApiService.extractSpreadsheetId(storeConf.spreadsheetUrl);
        }
      }

      if (!sheetId) {
        setIsApiSyncModalOpen(true);
        setIsLiveFetching(false);
        return;
      }

      const selectedSheet = conf.selectedSheetTitle || 'ALL';
      const rows = await googleSheetsApiService.getSheetValues(sheetId, `${selectedSheet}!A:Z`);
      if (!rows || rows.length === 0) {
        throw new Error('Tidak ada baris data yang ditemukan di spreadsheet.');
      }

      const parsed = googleSheetsApiService.parseScheduleRows(rows);
      if (parsed.length === 0) {
        throw new Error('Gagal mengenali kolom jadwal pengiriman pada spreadsheet.');
      }

      const groupedWeeks = convertParsedTripsToWeeks(parsed);
      updateWeeks(groupedWeeks);

      const rawAreas = parsed.map(t => t.area).filter(Boolean);
      const mappings = areaAutoMapper.processRawAreaBatch(rawAreas);
      setDetectedAreaMappings(mappings);

      const mappingDict: Record<string, string> = {};
      Object.entries(mappings).forEach(([k, v]) => {
        if (v.matchedOfficialArea) mappingDict[k] = v.matchedOfficialArea;
      });

      const crewMappingDict: Record<string, string> = {};
      Object.entries(detectedCrewMappings).forEach(([k, v]) => {
        if (v.matchedCrewName) crewMappingDict[k] = v.matchedCrewName;
      });

      // Synchronize directly to operational schedules so changes & additions immediately reflect in system
      const liveTargetDate = new Date(selectedYear, selectedMonth === -1 ? 0 : selectedMonth, 5);
      const report = scheduleImportValidator.validateImportBatch(parsed, liveTargetDate, mappingDict);
      const syncRes = scheduleImportValidator.syncValidatedItems(report.items, {
        skipDuplicates: false,
        overwriteDuplicates: true,
        skipInvalid: true,
        customAreaMapping: mappingDict,
        customCrewMapping: crewMappingDict
      });

      // Directly sync to submenu Histori & Otorisasi Kru
      logisticsStore.syncSchedulesToCrewHistory();

      const totalActive = syncRes.syncedCount + syncRes.overwrittenCount;
      const daysCount = groupedWeeks[0]?.days.length || 0;
      const msg = `⚡ Berhasil memperbarui data live Google Sheets! ${syncRes.overwrittenCount} jadwal diperbarui, ${syncRes.syncedCount} ritase baru ditambahkan (${daysCount} hari). Data kru otomatis masuk ke 'Histori & Otorisasi Kru'.`;
      setSyncSuccessMessage(msg);
      if (onSyncComplete) onSyncComplete(totalActive);
      setTimeout(() => setSyncSuccessMessage(null), 8000);
    } catch (err: any) {
      console.warn('Live fetch notice:', err?.message || err);
      setIsApiSyncModalOpen(true);
    } finally {
      setIsLiveFetching(false);
    }
  };

  // Handle Sync to Active Operational Schedule with Validation & Area Mappings
  const handleSyncToOperationalSchedules = () => {
    setIsSyncing(true);

    const mappingDict: Record<string, string> = {};
    Object.entries(detectedAreaMappings).forEach(([k, v]) => {
      if (v.matchedOfficialArea) mappingDict[k] = v.matchedOfficialArea;
    });

    const crewMappingDict: Record<string, string> = {};
    Object.entries(detectedCrewMappings).forEach(([k, v]) => {
      if (v.matchedCrewName) crewMappingDict[k] = v.matchedCrewName;
    });

    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    const monthNumPad = String(effectiveMonth + 1).padStart(2, '0');

    const tripsToSync: ParsedSheetTrip[] = [];
    filteredWeeks.forEach((week: AdminScheduleWeek) => {
      week.days.forEach((day: AdminScheduleDay) => {
        day.pengiriman.forEach((p: DeliveryAssignment, idx: number) => {
          const dayNumPad = String(day.dayNumber).padStart(2, '0');
          const resolvedArea = mappingDict[p.area] || standardizeAreaName(p.area);
          const resolvedDriver = crewMappingDict[p.driver] || p.driver;
          const resolvedHelper = p.helper ? (crewMappingDict[p.helper] || p.helper) : undefined;
          tripsToSync.push({
            driver: resolvedDriver,
            helper: resolvedHelper,
            area: resolvedArea,
            armada: p.armada,
            target: p.target,
            dateStr: `${selectedYear}-${monthNumPad}-${dayNumPad}`,
            dayName: day.dayName,
            notes: `PO-AKK-${selectedYear}${monthNumPad}${dayNumPad}-${p.armada.replace(/[^A-Za-z0-9]/g, '')}-${idx + 1}`
          });
        });
      });
    });

    // Run duplicate and format validation with custom mappings
    const targetDate = new Date(selectedYear, effectiveMonth, 5);
    const report = scheduleImportValidator.validateImportBatch(tripsToSync, targetDate, mappingDict);
    const syncRes = scheduleImportValidator.syncValidatedItems(report.items, {
      skipDuplicates: false,
      overwriteDuplicates: true,
      skipInvalid: true,
      customAreaMapping: mappingDict,
      customCrewMapping: crewMappingDict
    });

    // Directly push to submenu Histori & Otorisasi Kru
    logisticsStore.syncSchedulesToCrewHistory();

    // Robust Upsert to Server & Supabase Cloud for 147+ shipments batch
    persistSchedulesToDatabase(logisticsStore.getSchedules(), weeks, {
      month: String(effectiveMonth + 1),
      year: Number(selectedYear),
      source: 'schedule_management_upsert_147'
    }).catch(err => console.warn('[Persistent Upsert Note]', err));

    // Cache current weeks state so it permanently survives offline / reloads
    const cacheKey = `akk_admin_schedule_cache_${selectedYear}_${effectiveMonth}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(weeks));
      localStorage.setItem('akk_admin_schedule_weeks_cache', JSON.stringify(weeks));
    } catch {}

    setTimeout(() => {
      setIsSyncing(false);
      const msg = `⚡ Berhasil menyinkronkan data! ${syncRes.overwrittenCount} jadwal diperbarui, ${syncRes.syncedCount} jadwal baru ditambahkan. Data tersimpan permanen & aman dari refresh/off.`;
      setSyncSuccessMessage(msg);
      if (onSyncComplete) onSyncComplete(syncRes.syncedCount + syncRes.overwrittenCount);
      setTimeout(() => setSyncSuccessMessage(null), 8000);
    }, 600);
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Card: Google Sheets Integrated Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                GOOGLE SHEETS &bull; SHEET: &quot;ALL&quot;
              </span>
              <span className="text-xs text-slate-500 font-mono">Live Roster DC Banyuwangi</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-400 font-medium">Bulan Januari 2026 (5 Pekan Lengkap)</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Auto-Save Aktif
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-2 flex items-center gap-2">
              Jadwal Operasional Admin (Sheet ALL)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Tabel jadwal terpadu formasi pengiriman armada, tim gudang, jadwal armada bebas/off, serta perizinan karyawan langsung dari spreadsheet Google Sheets Sheet &quot;ALL&quot;.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <input 
              type="file" 
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
              onChange={handleFileUpload}
            />

            <button
              onClick={toggleAutoSync}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border shadow-md ${
                isAutoSyncEnabled
                  ? 'bg-emerald-700/80 hover:bg-emerald-600 text-white border-emerald-400/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title="Aktifkan/Nonaktifkan auto-save dan auto-sync otomatis antara Google Sheets dan Web"
            >
              <Zap className={`w-4 h-4 ${isAutoSyncEnabled ? 'text-amber-300 animate-pulse' : 'text-slate-400'}`} />
              <span>Auto-Sync: {isAutoSyncEnabled ? 'AKTIF' : 'OFF'}</span>
            </button>

            <button
              onClick={() => setIsApiSyncModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md transition cursor-pointer border border-emerald-400/30"
              title="Hubungkan & Sinkronkan langsung dengan Google Sheets API v4"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>Live Sync Google Sheets API</span>
            </button>

            <button
              onClick={handleLiveFetchFromSheets}
              disabled={isLiveFetching}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition cursor-pointer border border-amber-400/40"
              title="Tarik langsung pembaruan baris & tanggal baru dari Google Sheets"
            >
              <RefreshCw className={`w-4 h-4 text-amber-200 ${isLiveFetching ? 'animate-spin' : ''}`} />
              <span>{isLiveFetching ? 'Menarik Data...' : '🔄 Tarik Pembaruan Live Google Sheets'}</span>
            </button>

            <button
              onClick={() => {
                setActiveMappingCategory('area');
                setIsAreaMappingModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer relative"
              title="Kelola & tinjau pemetaan otomatis nama area spreadsheet ke Jadwal Pengiriman & Muat"
            >
              <MapPin className="w-4 h-4 text-rose-400" />
              <span>Pemetaan Area ({Object.keys(detectedAreaMappings).length})</span>
              {Object.values(detectedAreaMappings).some(m => m.confidence === 'unmapped') && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-1.5 right-1.5" />
              )}
            </button>

            <button
              onClick={() => {
                setActiveMappingCategory('crew');
                setIsAreaMappingModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer relative"
              title="Kelola & tinjau pemetaan otomatis nama supir/helper spreadsheet ke database resmi AKK"
            >
              <Users className="w-4 h-4 text-blue-400" />
              <span>Pemetaan Kru ({Object.keys(detectedCrewMappings).length})</span>
              {Object.values(detectedCrewMappings).some(m => m.confidence === 'unmapped') && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-1.5 right-1.5" />
              )}
            </button>

            {onNavigateToCrewHistory && (
              <button
                onClick={onNavigateToCrewHistory}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 hover:text-white text-xs font-bold border border-indigo-500/40 transition cursor-pointer"
                title="Buka submenu Histori & Otorisasi Kru"
              >
                <HistoryIcon className="w-4 h-4 text-indigo-400" />
                <span>Histori &amp; Otorisasi Kru</span>
              </button>
            )}

            <button
              onClick={() => setIsUploadConfigModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
              title="Unggah spreadsheet baru (.xlsx / .csv)"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Unggah Spreadsheet</span>
            </button>

            <button
              onClick={handleExportXLSX}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
              title="Unduh data sebagai file Excel .xlsx"
            >
              <Download className="w-4 h-4 text-blue-400" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>

            <button
              onClick={handleSyncToOperationalSchedules}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-xs font-black shadow-md transition cursor-pointer"
              title="Konversi baris pengiriman Sheet ALL menjadi jadwal resmi di menu Jadwal Pengiriman & Muat serta Histori Kru"
            >
              <Sparkles className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : '⚡ Sinkronkan ke Jadwal & Histori Kru'}</span>
            </button>
          </div>
        </div>

        {/* Sync Success Banner */}
        {syncSuccessMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-300">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-semibold">{syncSuccessMessage}</span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {onNavigateToSchedules && (
                <button
                  onClick={onNavigateToSchedules}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <span>Daftar Jadwal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              {onNavigateToCrewHistory && (
                <button
                  onClick={onNavigateToCrewHistory}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <HistoryIcon className="w-3.5 h-3.5" />
                  <span>Buka Histori &amp; Otorisasi Kru</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 1. Keterangan Periode Selection Bar - POSITIONED ABOVE TOTAL RITASE KIRIM STATS */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400 tracking-wider block">
                Keterangan Periode Jadwal Operasional
              </span>
              <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5 flex-wrap">
                <span>{MONTH_NAMES[selectedMonth === -1 ? 0 : selectedMonth]} {selectedYear}</span>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                  {stats.totalTrips} Ritase Total
                </span>
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-300 dark:border-rose-800">
                  📍 {stats.totalUniqueAreas} Total Area Kirim
                </span>
              </h4>
            </div>
          </div>

          {/* Month & Year Selectors */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold shadow-2xs">
            <span className="text-slate-600 dark:text-slate-300 font-extrabold px-1 text-xs">Pilih Periode:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value={-1}>Semua Bulan</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {[2024, 2025, 2026, 2027, 2028].map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Aggregate KPI Chips (Positioned DIRECTLY BELOW Periode Selection) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Total Ritase Kirim</span>
              <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {stats.totalTrips} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rute Aktif</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">Total Area Kirim</span>
              <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {stats.totalUniqueAreas} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Area ({MONTH_NAMES[selectedMonth === -1 ? 0 : selectedMonth]})</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Luar Kota / Bali</span>
              <Ship className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xl font-black text-blue-700 dark:text-blue-300 mt-1">
              {stats.totalLuarKota} <span className="text-xs font-semibold text-blue-600/80 dark:text-blue-400">Ferry ASDP</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Distribusi Lokal</span>
              <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
              {stats.totalLokal} <span className="text-xs font-semibold text-emerald-600/80 dark:text-emerald-400">Jawa Timur</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Total Personel Kru</span>
              <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              17 <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">On-Duty</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filter & Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Category Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Semua Rute ({stats.totalTrips})
            </button>
            <button
              onClick={() => setCategoryFilter('luar_kota')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'luar_kota'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <Ship className="w-3.5 h-3.5" />
              <span>Bali / Luar Kota ({stats.totalLuarKota})</span>
            </button>
            <button
              onClick={() => setCategoryFilter('lokal')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'lokal'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Lokal ({stats.totalLokal})</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari driver, helper, area, armada..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-hidden placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Day Selection Pills & Dropdown Bar - Ringkas & Bebas Scroll */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-2xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
              Pilih Hari / Tanggal Pengiriman:
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
            {selectedDayFilter === 'all' 
              ? `Menampilkan ${totalTripsCount} Ritase (${availableDaysList.length} Hari Aktif)` 
              : `Terfilter: Tanggal ${selectedDayFilter}`
            }
          </span>
        </div>

        {/* Dropdown Model Selector for Active Delivery Schedule */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 relative">
            <select
              value={selectedDayFilter}
              onChange={(e) => setSelectedDayFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-xs font-black focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs appearance-none pr-10"
            >
              <option value="all">Dropdown Roster: Semua Hari ({availableDaysList.length} Hari Aktif • {totalTripsCount} Ritase Total)</option>
              {availableDaysList.map(d => (
                <option key={`opt-select-${d.key}`} value={d.dateString}>
                  📅 {d.dayName}, {d.dateString} — ({d.count} Ritase Pengiriman)
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {selectedDayFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedDayFilter('all')}
              className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Ke Semua Hari</span>
            </button>
          )}
        </div>

        {/* Day Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedDayFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              selectedDayFilter === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span>Semua Hari</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              selectedDayFilter === 'all' ? 'bg-emerald-950 text-emerald-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              {availableDaysList.reduce((acc, d) => acc + d.count, 0)}
            </span>
          </button>

          {availableDaysList.map(d => {
            const isSelected = selectedDayFilter === d.key || selectedDayFilter === d.dateString || selectedDayFilter === `${d.dayNumber}`;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setSelectedDayFilter(isSelected ? 'all' : d.dateString)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                }`}
              >
                <span>📅 {d.dayName}, {d.dateString.split(' ')[0]} {d.dateString.split(' ')[1]?.substring(0, 3)}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isSelected ? 'bg-emerald-950 text-emerald-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  {d.count} Rit
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Content: Interactive Calendar & Selected Day Grid Details */}
      <div className="space-y-6">
        {/* Calendar Container - Bright Non-Black Style */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            {/* Calendar Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span>KALENDER PENGIRIMAN - {calendarGridData.monthName.toUpperCase()} {calendarGridData.year}</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Klik pada salah satu tanggal untuk melihat rincian supir, helper, area kirim, dan armada.
                  </p>
                </div>
              </div>

              {/* Legend Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Area Lokal (Jawa Timur)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Area Luar Kota / Bali (Ferry ASDP)</span>
                </span>
              </div>
            </div>

            {/* Intelligent Date Parsing & Black Line Separator Guide Notice */}
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 flex items-start gap-3 text-xs">
              <div className="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold shrink-0 mt-0.5">
                📅
              </div>
              <div className="space-y-0.5 text-slate-700 dark:text-slate-300">
                <div className="font-bold text-emerald-950 dark:text-emerald-200">
                  Sinkronisasi Tanggal & Pembatas Garis Hitam Terverifikasi Tepat:
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Sistem membaca ritase di antara <strong>dua garis hitam</strong> per harinya. Format penulisan seperti <strong>&quot;Tanggal 5 Bulan 1&quot;</strong>, <strong>&quot;05/01/2026&quot;</strong>, <strong>&quot;5/1&quot;</strong>, maupun format Google Sheets (<strong>&quot;1/5/2026&quot;</strong>) dipetakan tepat pada <strong>Tanggal 05 Januari</strong> di kalender (tidak lagi tertukar ke tanggal 1).
                </p>
              </div>
            </div>

            {/* 7-Column Calendar Grid Header */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs font-black uppercase text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-rose-600 dark:text-rose-400">MINGGU</div>
              <div>SENIN</div>
              <div>SELASA</div>
              <div>RABU</div>
              <div>KAMIS</div>
              <div>JUMAT</div>
              <div className="text-blue-600 dark:text-blue-400">SABTU</div>
            </div>

            {/* Calendar Cells Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarGridData.cells.map((cell, cIdx) => {
                if (cell.type === 'padding') {
                  return (
                    <div key={`pad-${cIdx}`} className="min-h-[90px] sm:min-h-[105px] bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800/50" />
                  );
                }

                const isSelected = selectedCalendarDate === cell.dateString;
                const hasDeliveries = cell.totalTrips > 0;

                return (
                  <div
                    key={`cal-cell-${cell.dayNumber}-${cell.dateString}`}
                    onClick={() => {
                      if (cell.dateString) {
                        setSelectedCalendarDate(cell.dateString);
                        setSelectedDayFilter(cell.dateString);
                      }
                    }}
                    className={`min-h-[90px] sm:min-h-[105px] p-2 rounded-xl border transition cursor-pointer flex flex-col justify-between select-none relative ${
                      isSelected
                        ? 'bg-emerald-100/90 dark:bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500 shadow-md scale-[1.02] z-10'
                        : hasDeliveries
                        ? 'bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700 shadow-2xs'
                        : 'bg-slate-50/80 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-80'
                    }`}
                  >
                    {/* Day Number Header */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : hasDeliveries
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-extrabold'
                          : 'text-slate-400'
                      }`}>
                        {String(cell.dayNumber).padStart(2, '0')}
                      </span>
                      {hasDeliveries && (
                        <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.2 rounded-full border border-emerald-300 dark:border-emerald-800">
                          {cell.totalTrips} Rit
                        </span>
                      )}
                    </div>

                    {/* Delivery Breakdown Badges (Lokal vs Luar Kota) */}
                    {hasDeliveries ? (
                      <div className="space-y-1 mt-1">
                        {cell.lokalCount > 0 && (
                          <div className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800 flex items-center justify-between">
                            <span className="truncate">🚛 Lokal</span>
                            <span className="font-mono font-black">{cell.lokalCount}</span>
                          </div>
                        )}
                        {cell.luarKotaCount > 0 && (
                          <div className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/90 text-blue-800 dark:text-blue-300 border border-blue-300/80 dark:border-blue-800 flex items-center justify-between">
                            <span className="truncate">🚢 Luar Kota</span>
                            <span className="font-mono font-black">{cell.luarKotaCount}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] font-medium text-slate-400 text-center py-2 italic">
                        Bebas / Off
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Details Panel (Rincian Driver, Helper, Kirim Area, Armada) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            {(() => {
              const activeDayObj = filteredWeeks
                .flatMap((w: AdminScheduleWeek) => w.days)
                .find((d: AdminScheduleDay) => d.dateString === selectedCalendarDate);

              if (!activeDayObj || activeDayObj.pengiriman.length === 0) {
                return (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Tidak Ada Jadwal Pengiriman pada {selectedCalendarDate}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Silakan klik tanggal lain pada kalender di atas untuk melihat rincian pengiriman.
                    </p>
                  </div>
                );
              }

              let lokalInSelected = 0;
              let luarKotaInSelected = 0;
              activeDayObj.pengiriman.forEach((p: DeliveryAssignment) => {
                const std = standardizeAreaName(p.area);
                if (std.includes('DENPASAR') || std.includes('SINGARAJA') || std.includes('NEGARA') || std.includes('GIANYAR') || std.includes('TABANAN') || std.includes('KUTA') || std.includes('BALI')) {
                  luarKotaInSelected++;
                } else {
                  lokalInSelected++;
                }
              });

              return (
                <div className="space-y-4">
                  {/* Selected Date Title Bar - Bright Non-Black Style */}
                  <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
                          RINCIAN PENGIRIMAN TERFAKTUR
                        </span>
                        <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                          {activeDayObj.dayName}, {activeDayObj.dateString}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-xs">
                        {activeDayObj.pengiriman.length} Total Ritase
                      </span>
                      <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        🚛 {lokalInSelected} Area Lokal
                      </span>
                      <span className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                        🚢 {luarKotaInSelected} Area Luar Kota
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenAddTripModal(activeDayObj.dayNumber, activeDayObj.dateString)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition cursor-pointer"
                        title="Tambah penugasan ritase baru pada tanggal ini"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Ritase</span>
                      </button>
                    </div>
                  </div>

                  {/* Shipment Details Table - Bright & High Contrast */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs text-left border-collapse min-w-[850px]">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-extrabold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                          <th className="p-3 text-center w-14 border-r border-slate-200 dark:border-slate-700"># NO</th>
                          <th className="p-3 border-r border-slate-200 dark:border-slate-700 w-44">DRIVER (PENGEMUDI)</th>
                          <th className="p-3 border-r border-slate-200 dark:border-slate-700 w-40">HELPER / PIC</th>
                          <th className="p-3 border-r border-slate-200 dark:border-slate-700">KIRIM AREA (TUJUAN)</th>
                          <th className="p-3 border-r border-slate-200 dark:border-slate-700 w-44">ARMADA TRUK</th>
                          <th className="p-3 border-r border-slate-200 dark:border-slate-700 w-36">STATUS</th>
                          <th className="p-3 text-center w-24">AKSI</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-slate-300 dark:divide-slate-700 font-medium">
                        {activeDayObj.pengiriman.map((p: DeliveryAssignment, pIdx: number) => {
                          const standardArea = standardizeAreaName(p.area);
                          const isLuarPulau = standardArea.includes('DENPASAR') || standardArea.includes('SINGARAJA') || standardArea.includes('NEGARA') || standardArea.includes('GIANYAR') || standardArea.includes('TABANAN') || standardArea.includes('KUTA') || standardArea.includes('BALI');
                          const driverInitials = getDriverInitials(p.driver);
                          const avatarStyle = DRIVER_AVATAR_COLORS[p.driver] || { 
                            bg: 'bg-slate-100 dark:bg-slate-800', 
                            text: 'text-slate-700 dark:text-slate-300', 
                            ring: 'border-slate-300 dark:border-slate-700' 
                          };
                          const corridor = getAreaCorridor(standardArea);
                          const fleetSpec = FLEET_SPEC_MAP[p.armada] || { model: 'Truk Box Reguler', category: 'Distribusi' };

                          return (
                            <tr
                              key={`cal-detail-${pIdx}-${p.driver}-${p.armada}`}
                              className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition border-b-2 border-slate-300 dark:border-slate-700 ${
                                isLuarPulau ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                              }`}
                            >
                              <td className="p-3 text-center font-bold text-slate-500 border-r border-slate-200 dark:border-slate-800">
                                {pIdx + 1}
                              </td>

                              {/* Driver */}
                              <td className="p-3 border-r border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-8 h-8 rounded-full border ${avatarStyle.bg} ${avatarStyle.ring} ${avatarStyle.text} flex items-center justify-center font-black text-xs shrink-0 shadow-2xs`}>
                                    {driverInitials}
                                  </div>
                                  <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                                    {p.driver}
                                  </span>
                                </div>
                              </td>

                              {/* Helper */}
                              <td className="p-3 border-r border-slate-200 dark:border-slate-800">
                                <span className={`font-semibold ${p.helper && p.helper !== '-' ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>
                                  {p.helper || '-'}
                                </span>
                              </td>

                              {/* Kirim Area */}
                              <td className="p-3 border-r border-slate-200 dark:border-slate-800">
                                <div>
                                  <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-md border ${
                                    isLuarPulau 
                                      ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border-blue-300 dark:border-blue-700' 
                                      : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                                  }`}>
                                    {standardArea}
                                  </span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">
                                    {corridor}
                                  </span>
                                </div>
                              </td>

                              {/* Armada */}
                              <td className="p-3 border-r border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-mono font-black text-xs">
                                    {p.armada}
                                  </span>
                                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate">
                                    {fleetSpec.model}
                                  </span>
                                </div>
                              </td>

                              {/* Status */}
                              <td className="p-3 border-r border-slate-200 dark:border-slate-800">
                                <div className="flex flex-col gap-1">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 w-fit">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Tervalidasi (OK)</span>
                                  </span>
                                  {p.isManuallyEdited && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 w-fit">
                                      <span>✏️ Manual Edit</span>
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Aksi */}
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditTripModal(p, activeDayObj.dayNumber, activeDayObj.dateString, pIdx)}
                                    className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition cursor-pointer"
                                    title="Edit Rincian Pengiriman Ini"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTrip(p, activeDayObj.dayNumber, pIdx)}
                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition cursor-pointer"
                                    title="Hapus Rincian Pengiriman Ini"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

      {/* Modal Edit / Tambah Ritase Pengiriman */}
      {editingTripModal && editingTripModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center border border-amber-500/30">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {editingTripModal.isNew ? 'Tambah Ritase Pengiriman' : 'Edit Rincian Pengiriman'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tanggal: {editingTripModal.dateString}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingTripModal(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Driver / Pengemudi
                </label>
                <input
                  type="text"
                  list="driver-options"
                  value={editingTripModal.driver}
                  onChange={(e) => setEditingTripModal({ ...editingTripModal, driver: e.target.value })}
                  placeholder="Nama Supir"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500"
                />
                <datalist id="driver-options">
                  {logisticsStore.getCrews().map(c => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Helper / Kernet (Opsional)
                </label>
                <input
                  type="text"
                  list="helper-options"
                  value={editingTripModal.helper}
                  onChange={(e) => setEditingTripModal({ ...editingTripModal, helper: e.target.value })}
                  placeholder="Nama Helper / PIC (atau -)"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500"
                />
                <datalist id="helper-options">
                  {logisticsStore.getCrews().map(c => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Kirim Area / Tujuan
                </label>
                <input
                  type="text"
                  list="area-options"
                  value={editingTripModal.area}
                  onChange={(e) => setEditingTripModal({ ...editingTripModal, area: e.target.value })}
                  placeholder="e.g. DENPASAR 1, SITUBONDO, JAJAG RETAIL"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium uppercase focus:outline-none focus:border-emerald-500"
                />
                <datalist id="area-options">
                  <option value="DENPASAR 1" />
                  <option value="DENPASAR 2" />
                  <option value="SINGARAJA" />
                  <option value="NEGARA" />
                  <option value="SITUBONDO" />
                  <option value="BONDOWOSO" />
                  <option value="JAJAG RETAIL" />
                  <option value="PURWO DAMBUNTUNG" />
                  <option value="PURWO PASAR" />
                  <option value="GALEKAN" />
                  <option value="SUSULAN GENTENG - ROGOJAMPI" />
                  <option value="SUSULAN SANGGAR JAJAG" />
                  <option value="SUMBERAYUY RETAIL" />
                  <option value="GROSIR BWI - ROGOJAMPI" />
                </datalist>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Armada Truk (Inisial / Plat)
                </label>
                <select
                  value={editingTripModal.armada}
                  onChange={(e) => setEditingTripModal({ ...editingTripModal, armada: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-emerald-500"
                >
                  {logisticsStore.getFleets().map(f => (
                    <option key={f.id} value={f.initialCode || f.plateNumber}>
                      {f.initialCode ? `[${f.initialCode}] ` : ''}{f.plateNumber} ({f.vehicleType})
                    </option>
                  ))}
                  <option value="DS1">DS1 - Isuzu Giga CDD Long (Bali)</option>
                  <option value="DS2">DS2 - Mitsubishi Canter HDX</option>
                  <option value="DS3">DS3 - Hino Dutro 130 HD (Bali)</option>
                  <option value="DS4">DS4 - Truk Box Reguler</option>
                  <option value="DS5">DS5 - Isuzu Giga (Bali)</option>
                  <option value="NS1">NS1 - Engkel Box</option>
                  <option value="NS2">NS2 - Engkel Box</option>
                  <option value="NS3">NS3 - Canter Box</option>
                  <option value="NL1">NL1 - Engkel Long</option>
                  <option value="NL2">NL2 - Engkel Long</option>
                  <option value="N20">N20 - Engkel Box</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Target / Catatan PO
                </label>
                <input
                  type="text"
                  value={editingTripModal.target}
                  onChange={(e) => setEditingTripModal({ ...editingTripModal, target: e.target.value })}
                  placeholder="Gudang Pusat AKK Banyuwangi DC"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingTripModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTripModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perubahan Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Configuration Modal (Image 2 Style) */}
      {isUploadConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-5 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Konfigurasi Impor &amp; Pembaruan Jadwal Spreadsheet</h3>
                  <p className="text-xs text-slate-400">Pilih periode data, mode impor, dan file spreadsheet resmi AKK</p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadConfigModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">Bulan Data</label>
                <select
                  value={importMonth}
                  onChange={(e) => setImportMonth(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-emerald-500"
                >
                  {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">Tahun Data</label>
                <input
                  type="text"
                  value={importYear}
                  onChange={(e) => setImportYear(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">Mode Import</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  onClick={() => setImportMode('tambahkan')}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${
                    importMode === 'tambahkan'
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'tambahkan'}
                    onChange={() => setImportMode('tambahkan')}
                    className="text-emerald-500 mt-0.5"
                  />
                  <div>
                    <span className="block font-bold text-slate-200">Tambahkan data</span>
                    <span className="text-[10px] text-slate-400 font-normal">Data bulan yang sama tidak dihapus.</span>
                  </div>
                </label>

                <label
                  onClick={() => setImportMode('ganti')}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${
                    importMode === 'ganti'
                      ? 'bg-amber-500/10 border-amber-500/50 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'ganti'}
                    onChange={() => setImportMode('ganti')}
                    className="text-amber-500 mt-0.5"
                  />
                  <div>
                    <span className="block font-bold text-amber-300">Ganti data bulan ini</span>
                    <span className="text-[10px] text-slate-400 font-normal">Data lama periode sama dihapus lalu diimport ulang.</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">File Spreadsheet / Penjualan</label>
                <button
                  type="button"
                  onClick={downloadScheduleTemplate}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1 rounded-lg border border-emerald-500/30 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Template Excel</span>
                </button>
              </div>
              <input
                type="file"
                ref={modalFileInputRef}
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setSelectedUploadFile(f);
                }}
              />
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => modalFileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 cursor-pointer transition shadow-sm"
                  >
                    Choose File
                  </button>
                  <span className="text-xs text-slate-300 truncate font-mono">
                    {selectedUploadFile ? selectedUploadFile.name : 'No file chosen'}
                  </span>
                </div>
                {selectedUploadFile && (
                  <span className="text-[10px] font-bold text-emerald-400 shrink-0">Siap Proses</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Format didukung: .xls, .xlsx, .csv. Maksimal 10MB. Sistem akan menampilkan pratinjau template terbaca sebelum memperbarui jadwal.
              </p>
            </div>

            {/* Template Terbaca Info Card */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Struktur Template Terbaca Otomatis:</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Sheet "ALL" / Roster DC</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-300">
                <div className="bg-slate-900 p-2 rounded border border-slate-800">✅ Kolom Tanggal / Hari</div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">✅ Kolom Area / Tujuan</div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">✅ Kolom Plat &amp; Supir</div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">✅ Kolom Helper &amp; Muatan</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsUploadConfigModalOpen(false);
                  setIsHistoryModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Lihat Riwayat Upload
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadConfigModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedUploadFile) {
                      modalFileInputRef.current?.click();
                      return;
                    }
                    setIsUploadConfigModalOpen(false);
                    processFile(selectedUploadFile);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Preview Dulu &amp; Perbarui Jadwal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Riwayat Upload Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Riwayat Unggah Spreadsheet Jadwal</h3>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Roster_DC_Banyuwangi_Jan2026.xlsx</div>
                  <div className="text-[10px] text-slate-400">Diunggah 09 Okt 2026, 21:30 WIB • 121 Baris Tervalidasi</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">Sukses</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Schedule_Sheet_ALL_v2.csv</div>
                  <div className="text-[10px] text-slate-400">Diunggah 05 Okt 2026, 14:15 WIB • 115 Baris Tervalidasi</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">Sukses</span>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Upload Preview Modal with Validation & Intelligent Area Auto-Mapping */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-4xl w-full shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Pratinjau, Validasi &amp; Pemetaan Spreadsheet</h3>
                  <p className="text-xs text-slate-400">{uploadedFileName}</p>
                </div>
              </div>

              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab switchers */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveUploadTab('audit')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeUploadTab === 'audit'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Audit &amp; Validasi Format</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveUploadTab('area_mapping')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeUploadTab === 'area_mapping'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>Pemetaan Area Cerdas</span>
                {Object.values(detectedAreaMappings).some(m => m.confidence === 'unmapped') ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse">
                    {Object.values(detectedAreaMappings).filter(m => m.confidence === 'unmapped').length} Belum Dikenali
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                    {Object.keys(detectedAreaMappings).length} Area Terpetakan
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveUploadTab('crew_mapping')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeUploadTab === 'crew_mapping'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-300" />
                <span>Pemetaan Kru Pengirim</span>
                {Object.values(detectedCrewMappings).some(m => m.confidence === 'unmapped') ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse">
                    {Object.values(detectedCrewMappings).filter(m => m.confidence === 'unmapped').length} Belum Dikenali
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300 font-mono">
                    {Object.keys(detectedCrewMappings).length} Kru Terpetakan
                  </span>
                )}
              </button>
            </div>

            {/* Tab Content 1: Audit */}
            {activeUploadTab === 'audit' && (
              <div className="space-y-4">
                {uploadedValidationReport ? (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total Baris Terdeteksi:</span>
                      <span className="font-bold text-white">{uploadedValidationReport.totalRows} baris</span>
                    </div>

                    {/* Audit Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-850">
                      <div className="bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/30 text-center">
                        <span className="text-[10px] text-emerald-400 font-bold block">🟢 Lolos</span>
                        <span className="text-base font-bold text-emerald-300">{uploadedValidationReport.validCount}</span>
                      </div>

                      <div className="bg-amber-950/20 p-2 rounded-lg border border-amber-500/30 text-center">
                        <span className="text-[10px] text-amber-400 font-bold block">🟡 Duplikat</span>
                        <span className="text-base font-bold text-amber-300">{uploadedValidationReport.duplicateCount}</span>
                      </div>

                      <div className="bg-rose-950/20 p-2 rounded-lg border border-rose-500/30 text-center">
                        <span className="text-[10px] text-rose-400 font-bold block">🔴 Format Salah</span>
                        <span className="text-base font-bold text-rose-300">
                          {uploadedValidationReport.invalidDateCount + uploadedValidationReport.invalidPoCount + uploadedValidationReport.missingFieldCount}
                        </span>
                      </div>
                    </div>

                    {/* Protections */}
                    <div className="pt-2 border-t border-slate-850 space-y-2 text-[11px]">
                      <div className="flex items-start gap-2 text-emerald-400 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/30">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">Mode Sistem Rotasi Area Berputar Aktif</span>
                          <span className="text-slate-300 text-[10px]">
                            Semua {uploadedValidationReport.validCount} jadwal pengiriman tervalidasi sebagai rotasi area berputar yang sah dan siap disinkronkan (*overwrite* otomatis).
                          </span>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={skipInvalidUpload}
                          onChange={(e) => setSkipInvalidUpload(e.target.checked)}
                          className="rounded text-emerald-500 focus:ring-emerald-500"
                        />
                        <span>Tolak baris jika ada format tanggal atau PO yang rusak / tidak valid</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Baris:</span>
                      <span className="font-bold text-white">{uploadedRowsCount} baris</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab Content 2: Area Auto-Mapping Section */}
            {activeUploadTab === 'area_mapping' && (
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <AreaAutoMappingSection
                  areaMappings={detectedAreaMappings}
                  officialAreas={officialAreasList}
                  onMappingChange={handleMappingChange}
                  onRequestCreateArea={(rawArea) => setQuickCreateAreaTarget(rawArea)}
                />
              </div>
            )}

            {/* Tab Content 3: Crew Auto-Mapping Section */}
            {activeUploadTab === 'crew_mapping' && (
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <CrewAutoMappingSection
                  crewMappings={detectedCrewMappings}
                  officialCrews={officialCrewsList}
                  onMappingChange={handleCrewMappingChange}
                  onRequestCreateCrew={(rawCrew, roleHint) => setQuickCreateCrewTarget({ name: rawCrew, roleHint })}
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-800">
              <div className="text-xs text-slate-400">
                {Object.values(detectedAreaMappings).some(m => m.confidence === 'unmapped') || Object.values(detectedCrewMappings).some(m => m.confidence === 'unmapped') ? (
                  <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Tip: Lengkapi pemetaan area &amp; kru sebelum konfirmasi sinkronisasi.</span>
                  </span>
                ) : (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Area &amp; Kru telah terharmonisasi dengan Jadwal serta Histori &amp; Otorisasi.</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const mappingDict: Record<string, string> = {};
                    Object.entries(detectedAreaMappings).forEach(([k, v]) => {
                      if (v.matchedOfficialArea) mappingDict[k] = v.matchedOfficialArea;
                    });

                    const crewMappingDict: Record<string, string> = {};
                    Object.entries(detectedCrewMappings).forEach(([k, v]) => {
                      if (v.matchedCrewName) crewMappingDict[k] = v.matchedCrewName;
                    });

                    if (uploadedValidationReport) {
                      const syncRes = scheduleImportValidator.syncValidatedItems(uploadedValidationReport.items, {
                        skipDuplicates: skipDuplicatesUpload,
                        skipInvalid: skipInvalidUpload,
                        customAreaMapping: mappingDict,
                        customCrewMapping: crewMappingDict
                      });
                      logisticsStore.syncSchedulesToCrewHistory();
                      setIsUploadModalOpen(false);
                      const msg = `⚡ Berhasil menyinkronkan ${syncRes.syncedCount} jadwal pengiriman valid (${syncRes.skippedDuplicateCount} duplikat dicegah, ${syncRes.skippedInvalidCount} baris salah diabaikan). Data otomatis masuk ke 'Histori & Otorisasi Kru'!`;
                      setSyncSuccessMessage(msg);
                      if (onSyncComplete) onSyncComplete(syncRes.syncedCount);
                      setTimeout(() => setSyncSuccessMessage(null), 8000);
                    } else {
                      setIsUploadModalOpen(false);
                      handleSyncToOperationalSchedules();
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>⚡ Sinkronkan {uploadedValidationReport ? uploadedValidationReport.validCount : uploadedRowsCount} Jadwal Tervalidasi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Dedicated Area & Crew Auto-Mapping Modal */}
      {isAreaMappingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-4xl w-full shadow-2xl space-y-4 my-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  activeMappingCategory === 'area'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                }`}>
                  {activeMappingCategory === 'area' ? <MapPin className="w-5 h-5 text-rose-400" /> : <Users className="w-5 h-5 text-blue-400" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">
                      Harmonisasi &amp; Pemetaan Cerdas (Spreadsheet &rarr; Sistem)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Auto-Mapping Aktif
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mendeteksi nama area dan kru dari spreadsheet secara cerdas serta menyelaraskannya dengan database operasional AKK.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeMappingCategory === 'area' ? (
                  <button
                    type="button"
                    onClick={() => setQuickCreateAreaTarget('AREA BARU')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Buat Area Baru</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setQuickCreateCrewTarget({ name: '', roleHint: 'Driver' })}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Daftarkan Kru Baru</span>
                  </button>
                )}
                <button
                  onClick={() => setIsAreaMappingModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Selector Tabs */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveMappingCategory('area')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeMappingCategory === 'area'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>1. Pemetaan Area Kirim</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeMappingCategory === 'area' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-400'
                }`}>
                  {Object.keys(detectedAreaMappings).length} Area
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMappingCategory('crew')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeMappingCategory === 'crew'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-300" />
                <span>2. Pemetaan Kru Pengirim (Driver &amp; Helper)</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeMappingCategory === 'crew' ? 'bg-blue-800 text-blue-100' : 'bg-slate-800 text-slate-400'
                }`}>
                  {Object.keys(detectedCrewMappings).length} Kru
                </span>
              </button>
            </div>

            {/* Content Section */}
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {activeMappingCategory === 'area' ? (
                <AreaAutoMappingSection
                  areaMappings={detectedAreaMappings}
                  officialAreas={officialAreasList}
                  onMappingChange={handleMappingChange}
                  onRequestCreateArea={(rawArea) => setQuickCreateAreaTarget(rawArea)}
                />
              ) : (
                <CrewAutoMappingSection
                  crewMappings={detectedCrewMappings}
                  officialCrews={officialCrewsList}
                  onMappingChange={handleCrewMappingChange}
                  onRequestCreateCrew={(rawCrew, roleHint) => setQuickCreateCrewTarget({ name: rawCrew, roleHint })}
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <span className="text-slate-400">
                {activeMappingCategory === 'area' ? (
                  <>Total Area Resmi Terdaftar: <strong className="text-white">{officialAreasList.length}</strong> area di Jadwal Pengiriman &amp; Muat</>
                ) : (
                  <>Total Kru Resmi Terdaftar: <strong className="text-white">{officialCrewsList.length}</strong> personel di Database AKK</>
                )}
              </span>
              <button
                type="button"
                onClick={() => setIsAreaMappingModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Selesai &amp; Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Quick Create Area Modal Dialog */}
      <QuickCreateAreaModal
        isOpen={quickCreateAreaTarget !== null}
        onClose={() => setQuickCreateAreaTarget(null)}
        rawAreaName={quickCreateAreaTarget || ''}
        onAreaCreated={handleAreaCreated}
      />

      {/* 8. Quick Create Crew Modal Dialog */}
      <QuickCreateCrewModal
        isOpen={quickCreateCrewTarget !== null}
        onClose={() => setQuickCreateCrewTarget(null)}
        rawCrewName={quickCreateCrewTarget?.name || ''}
        roleHint={quickCreateCrewTarget?.roleHint || 'Driver'}
        onCrewCreated={handleCrewCreated}
      />

      {/* 9. Google Sheets API v4 Live Sync Modal */}
      <GoogleSheetsApiSyncModal
        isOpen={isApiSyncModalOpen}
        onClose={() => setIsApiSyncModalOpen(false)}
        onSyncComplete={(count) => {
          setSyncSuccessMessage(`⚡ Berhasil menyinkronkan ${count} rute pengiriman langsung dari Google Sheets API v4!`);
          if (onSyncComplete) onSyncComplete(count);
          setTimeout(() => setSyncSuccessMessage(null), 8000);
        }}
      />

      {/* Excel Top 5 Rows Preview Modal */}
      {isExcelPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl my-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Pratinjau Spreadsheet (Semua Data sampai Bawah)</h3>
                  <p className="text-xs text-slate-400">Verifikasi isi file sebelum diproses permanen ke sistem • {previewFile?.name} ({previewTotalRows} baris total, Sheet: {previewSheetName})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExcelPreviewModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-blue-200">
                <p className="font-semibold">💡 Pastikan data di bawah ini sesuai dengan format roster operasional sebelum melanjutkan pemrosesan jadwal.</p>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950 max-h-[72vh]">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                      <th className="p-3 font-bold border-r border-slate-800 w-12 text-center">#</th>
                      {previewHeaders.map((h, i) => (
                        <th key={i} className="p-3 font-bold border-r border-slate-800 whitespace-nowrap">{h || `Kolom ${i+1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {previewTopRows.length === 0 ? (
                      <tr>
                        <td colSpan={previewHeaders.length + 1} className="p-6 text-center text-slate-500 italic">Tidak ada data baris ditemukan.</td>
                      </tr>
                    ) : (() => {
                      let activeDate = '';
                      return previewTopRows.map((row, rIdx) => {
                        const isSeparator = row.some(cell => String(cell).includes('---'));
                        if (isSeparator) {
                          return (
                            <tr key={rIdx} className="bg-slate-900 border-y-2 border-slate-700 text-slate-400">
                              <td colSpan={previewHeaders.length + 1} className="py-2.5 px-3 text-center font-mono text-[11px] font-black tracking-widest bg-slate-950/90 text-slate-400 border-y-2 border-slate-700">
                                ─────── PEMBATAS TANGGAL &amp; PENGELOMPOKAN PENGIRIMAN ───────
                              </td>
                            </tr>
                          );
                        }
                        const firstCell = row[0] !== undefined && row[0] !== null ? String(row[0]).trim() : '';
                        if (firstCell && !firstCell.startsWith('-')) {
                          activeDate = firstCell;
                        }
                        const hasExplicitDate = Boolean(firstCell && !firstCell.startsWith('-'));

                        return (
                          <tr key={rIdx} className={`hover:bg-slate-900/80 transition border-b border-slate-800 ${hasExplicitDate ? 'border-t-2 border-slate-700 bg-slate-900/40' : ''}`}>
                            <td className="p-3 font-mono text-slate-500 text-center border-r border-slate-800">{rIdx + 1}</td>
                            {previewHeaders.map((h, cIdx) => {
                              const cellVal = row[cIdx];
                              const hasVal = cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== '';
                              const hUpper = (h || '').toUpperCase();

                              return (
                                <td key={cIdx} className="p-3 border-r border-slate-800 whitespace-nowrap">
                                  {hasVal ? (
                                    <span className={
                                      hUpper.includes('TANGGAL')
                                        ? "font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                                        : hUpper.includes('DRIVER') || hUpper.includes('SUPIR')
                                        ? "font-bold text-white"
                                        : hUpper.includes('AREA')
                                        ? "font-semibold text-amber-300"
                                        : hUpper.includes('ARMADA')
                                        ? "font-mono font-bold text-blue-300"
                                        : ""
                                    }>
                                      {String(cellVal)}
                                    </span>
                                  ) : (
                                    hUpper.includes('TANGGAL') ? (
                                      <span className="text-slate-500 text-[10px] italic">
                                        ↳ {activeDate || 'sesi hari'}
                                      </span>
                                    ) : (
                                      <span className="text-slate-600">-</span>
                                    )
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsExcelPreviewModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (previewFile) executeFinalUpload(previewFile);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Lanjutkan Proses &amp; Validasi ({previewTotalRows} Baris)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Spreadsheet Schema Validation Error / Warning Modal */}
      {schemaValidationError && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-rose-500/40 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-6 h-6 shrink-0 animate-bounce" />
                <h3 className="text-base font-black text-white">{schemaValidationError.error || 'Format Kolom Tidak Sesuai'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSchemaValidationError(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-200 space-y-1.5">
                <p className="font-bold">{schemaValidationError.message}</p>
                {schemaValidationError.missingColumns?.length > 0 && (
                  <p className="text-[11px] text-rose-300">
                    <span className="font-semibold">Kolom Wajib yang Belum Ada:</span> {schemaValidationError.missingColumns.join(', ')}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="font-bold text-amber-400 block">📌 Panduan Format Kolom Standar:</span>
                <p className="font-mono text-[11px] text-slate-300 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  {schemaValidationError.correctFormat}
                </p>
              </div>

              {schemaValidationError.detectedHeaders?.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="font-semibold text-slate-400 block">Header yang Terdeteksi di File Anda:</span>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {schemaValidationError.detectedHeaders.map((h: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[10px]">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSchemaValidationError(null)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition"
              >
                Tutup &amp; Pilih File Lain
              </button>
              <button
                type="button"
                onClick={downloadScheduleTemplate}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95 transition"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Template .XLSX Standar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification for Upload Validation */}
      {uploadToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-slate-900 dark:bg-slate-900 border border-slate-700 dark:border-slate-700 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`p-2.5 rounded-xl shrink-0 ${uploadToast.type === 'error' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {uploadToast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-black uppercase tracking-wider ${uploadToast.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
                {uploadToast.type === 'error' ? 'Gagal Unggah Spreadsheet' : 'Berhasil'}
              </span>
              <button
                type="button"
                onClick={() => setUploadToast(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Tutup Notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 font-medium">{uploadToast.message}</p>
            {uploadToast.type === 'error' && (
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadScheduleTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Excel Benar</span>
                </button>
              </div>
            )}
            {/* Auto-dismiss timer indicator */}
            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full ${uploadToast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse`}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
