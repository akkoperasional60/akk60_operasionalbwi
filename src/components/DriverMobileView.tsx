import React, { useState, useEffect, useMemo } from 'react';
import { AkkLogo } from './AkkLogo';
import {
  Truck,
  MapPin,
  Navigation,
  Phone,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  Box,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  User,
  Check,
  X,
  FileText,
  Camera,
  CameraOff,
  Calendar,
  Compass,
  ArrowRight,
  Radio,
  Sliders,
  Send,
  Building2,
  AlertCircle,
  Eye,
  Download,
  Sparkles,
  Wifi,
  WifiOff,
  UploadCloud,
  Database,
  Gauge,
  Fuel,
  Printer,
  QrCode,
  Lock,
  Share2,
  ClipboardCheck,
  PlusCircle,
  Plus,
  Fingerprint,
  KeyRound,
  Smartphone,
  Trash2,
  ArrowRightLeft,
  UserX,
  LogIn,
  UserPlus,
  Mail,
  EyeOff,
  Moon
} from 'lucide-react';
import {
  Schedule,
  ShipmentStatus,
  Crew,
  Fleet,
  RetailStore,
  DriverVehicleChecklist,
  OutboundWaybill,
  ChecklistItemCategory,
  DriverShiftCheckin,
  UserRole,
  UserProfile
} from '../types';
import { logisticsStore } from '../services/store';
import { driverReportService, DriverHelperReport } from '../services/driverReportService';
import { driverOfflineSyncService, OfflineTaskAction, DriverSyncState } from '../services/driverOfflineSyncService';
import { driverChecklistService } from '../services/driverChecklistService';
import { driverWaybillService } from '../services/driverWaybillService';
import { driverShiftService } from '../services/driverShiftService';
import { getSupabaseClient } from '../services/supabaseService';
import { useToast } from '../context/ToastContext';
import { getDriverPortalDepartureLabel, getAreaScheduleTiming } from '../utils/areaScheduleRules';
import { attendanceService } from '../services/attendanceService';
import { DriverPodCameraModal } from './DriverPodCameraModal';
import { DriverSuratJalanModal } from './DriverSuratJalanModal';
import { DriverVehicleChecklistModal } from './DriverVehicleChecklistModal';
import { DriverCheckinModal } from './DriverCheckinModal';
import { AndroidApkDownloadModal } from './AndroidApkDownloadModal';
import { DriverGmapsShareModal } from './DriverGmapsShareModal';

interface DriverMobileViewProps {
  onBackToPortal?: () => void;
  initialDriverId?: string;
  currentUser?: UserProfile;
}

export type DriverPortalTab = 'deliveries' | 'checklist' | 'surat_jalan' | 'history' | 'profile';

export const DriverMobileView: React.FC<DriverMobileViewProps> = ({
  onBackToPortal,
  initialDriverId,
  currentUser: propUser
}) => {
  const { addNotification } = useToast();

  // Active User Profile synchronization - Single Source of Truth
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => propUser || logisticsStore.getCurrentUser());

  // Real-time Display Name & Avatar matching the account name
  const portalDisplayName = useMemo(() => {
    return currentUser?.fullName || logisticsStore.getPortalDisplayName();
  }, [currentUser]);

  const portalInitials = useMemo(() => {
    const name = portalDisplayName.trim();
    if (!name) return 'DR';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }, [portalDisplayName]);

  // State
  const [crews, setCrews] = useState<Crew[]>(logisticsStore.getCrews());
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());

  // Supir yang tersinkronisasi otomatis dengan akun login
  const syncedCrew = useMemo(() => {
    return logisticsStore.getActiveDriverCrew();
  }, [currentUser, crews]);

  const [loggedInDriver, setLoggedInDriver] = useState<Crew | null>(() => {
    return syncedCrew || null;
  });

  const [isDriverLoggedIn, setIsDriverLoggedIn] = useState<boolean>(() => {
    const user = propUser || logisticsStore.getCurrentUser();
    return !!user && user.id !== 'guest';
  });

  const [selectedDriverId, setSelectedDriverId] = useState<string>(() => {
    if (initialDriverId) return initialDriverId;
    if (syncedCrew) return syncedCrew.id;
    return crews[0]?.id || '';
  });

  // Sinkronisasi otomatis saat user prop berganti atau login/switch akun terjadi
  useEffect(() => {
    const active = propUser || logisticsStore.getCurrentUser();
    setCurrentUser(active);
    const matched = logisticsStore.getActiveDriverCrew();
    if (matched) {
      setLoggedInDriver(matched);
      setSelectedDriverId(matched.id);
      setIsDriverLoggedIn(true);
    }
  }, [propUser]);

  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Register Form
  const [registerData, setRegisterData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'driver' as UserRole,
    department: 'Gudang Distribusi Packaging Banyuwangi',
    password: '',
    confirmPassword: ''
  });

  const handleDriverLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const user = logisticsStore.loginUser(loginEmail, loginPassword);
    if (!user) {
      const foundCrew = crews.find(c => c.name.toLowerCase().includes(loginEmail.toLowerCase()) || c.phone.includes(loginEmail));
      if (foundCrew) {
        setLoggedInDriver(foundCrew);
        setSelectedDriverId(foundCrew.id);
        setIsDriverLoggedIn(true);
        try {
          localStorage.setItem('akk_driver_auth_session', JSON.stringify(foundCrew));
        } catch {}
        setSuccessMsg(`Berhasil masuk sebagai ${foundCrew.name}`);
        setTimeout(() => {
          addNotification('delivery', 'Login Berhasil', `Selamat datang di Portal Driver Mobile, ${foundCrew.name}!`);
        }, 300);
        return;
      }
      setErrorMsg('Username/Email atau Password salah. Silakan periksa kembali.');
      return;
    }

    const crewMatch = crews.find(c => c.name.toLowerCase() === user.fullName.toLowerCase()) || crews[0];
    setLoggedInDriver(crewMatch);
    setSelectedDriverId(crewMatch ? crewMatch.id : (crews[0]?.id || ''));
    setIsDriverLoggedIn(true);
    try {
      localStorage.setItem('akk_driver_auth_session', JSON.stringify(crewMatch || crews[0]));
    } catch {}
    setSuccessMsg(`Berhasil masuk sebagai ${user.fullName}`);
    setTimeout(() => {
      addNotification('delivery', 'Login Berhasil', `Selamat datang di Portal AKK, ${user.fullName}!`);
    }, 300);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (registerData.password && registerData.password !== registerData.confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok.');
      return;
    }
    const newUser = logisticsStore.registerUser({
      fullName: registerData.fullName,
      email: registerData.email,
      phone: registerData.phone,
      role: registerData.role,
      department: registerData.department,
      notes: 'Pendaftaran mandiri melalui portal AKK - Menunggu verifikasi'
    });
    setSuccessMsg(`Pendaftaran berhasil! Akun "${newUser.fullName}" terdaftar dan menunggu persetujuan Super Admin.`);
    setTimeout(() => {
      setAuthTab('login');
      setSuccessMsg('Pendaftaran berhasil! Silakan masuk setelah akun disetujui.');
    }, 1200);
  };

  const handleDriverLogout = () => {
    setIsDriverLoggedIn(false);
    setLoggedInDriver(null);
    try {
      localStorage.removeItem('akk_driver_auth_session');
    } catch {}
    addNotification('delivery', 'Keluar Akun', 'Anda telah keluar dari Portal Driver.');
  };

  const [deliveries, setDeliveries] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSupabaseLive, setIsSupabaseLive] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'scheduled' | 'delivered'>('active');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bottomNav, setBottomNav] = useState<DriverPortalTab>('deliveries');

  // Camera hardware & permission detection state using enumerateDevices
  const [cameraSupportStatus, setCameraSupportStatus] = useState<'checking' | 'supported' | 'unsupported' | 'blocked'>('checking');

  useEffect(() => {
    const checkCameraSupport = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        setCameraSupportStatus('unsupported');
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        if (videoInputs.length === 0) {
          setCameraSupportStatus('blocked');
        } else {
          setCameraSupportStatus('supported');
        }
      } catch (err) {
        console.warn('[DriverMobileView] enumerateDevices error:', err);
        setCameraSupportStatus('blocked');
      }
    };
    checkCameraSupport();
  }, []);

  // 🚗 Checklist Kendaraan & 📑 Surat Jalan Keluar Integration States
  const [checklists, setChecklists] = useState<DriverVehicleChecklist[]>(() =>
    driverChecklistService.getChecklists()
  );
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState<boolean>(false);
  const [activeChecklistToEdit, setActiveChecklistToEdit] = useState<DriverVehicleChecklist | null>(null);

  const [isWaybillModalOpen, setIsWaybillModalOpen] = useState<boolean>(false);
  const [activeWaybillToView, setActiveWaybillToView] = useState<OutboundWaybill | null>(null);

  const [waybillStatusFilter, setWaybillStatusFilter] = useState<'all' | 'gate_out' | 'in_transit' | 'delivered'>('all');
  const [checklistTabCategory, setChecklistTabCategory] = useState<ChecklistItemCategory | 'all'>('all');

  // 🕒 Driver Check-in Shift Management (Biometric & PIN Verification)
  const [activeShift, setActiveShift] = useState<DriverShiftCheckin | null>(() =>
    driverShiftService.getActiveShift(selectedDriverId)
  );
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [checkoutOdometer, setCheckoutOdometer] = useState<number>(0);
  const [checkoutNotes, setCheckoutNotes] = useState<string>('');
  const [isApkModalOpen, setIsApkModalOpen] = useState<boolean>(false);
  const [isGmapsShareModalOpen, setIsGmapsShareModalOpen] = useState<boolean>(false);

  // Sync active shift on driver change or shift event
  useEffect(() => {
    if (selectedDriverId) {
      setActiveShift(driverShiftService.getActiveShift(selectedDriverId));
    }

    const onShiftUpdated = (e: any) => {
      const updated = e.detail as DriverShiftCheckin;
      if (updated && updated.driverId === selectedDriverId) {
        setActiveShift(updated.status !== 'checked_out' ? updated : null);
      }
    };

    window.addEventListener('driver-shift-updated', onShiftUpdated);
    return () => {
      window.removeEventListener('driver-shift-updated', onShiftUpdated);
    };
  }, [selectedDriverId]);

  // Load checklists when selected driver changes
  useEffect(() => {
    if (selectedDriverId) {
      const list = driverChecklistService.getChecklists(selectedDriverId);
      setChecklists(list);
    }
  }, [selectedDriverId]);

  // 📢 Arahan & Solusi Kendala dari SPV Logistik / Super Admin
  const [driverKendalaReports, setDriverKendalaReports] = useState<DriverHelperReport[]>([]);

  const loadDriverKendalaReports = () => {
    try {
      const all = driverReportService.getReports();
      const current = crews.find(c => c.id === selectedDriverId);
      const filtered = all.filter(r => 
        r.driverId === selectedDriverId || 
        (current && r.driverName.toLowerCase().includes(current.name.toLowerCase()))
      );
      setDriverKendalaReports(filtered);
    } catch {}
  };

  useEffect(() => {
    loadDriverKendalaReports();
    const handleUpdate = () => loadDriverKendalaReports();
    window.addEventListener('driver-report-updated', handleUpdate);
    return () => window.removeEventListener('driver-report-updated', handleUpdate);
  }, [selectedDriverId, crews]);

  const activeDriverSolutions = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return driverKendalaReports.filter(r => {
      if (!r.solution || r.solution.trim().length === 0) return false;
      const reportDate = r.date || new Date(r.timestamp).toISOString().slice(0, 10);
      return reportDate === todayStr;
    });
  }, [driverKendalaReports]);

  // 📶 Offline State Synchronization Management (IndexedDB & LocalStorage)
  const [syncState, setSyncState] = useState<DriverSyncState>(driverOfflineSyncService.getSyncState());
  const [isQueueModalOpen, setIsQueueModalOpen] = useState<boolean>(false);

  // Subscribe to driver offline sync changes and online reconnection events
  useEffect(() => {
    const unsub = driverOfflineSyncService.subscribe(setSyncState);

    const onSynced = (e: any) => {
      const detail = e.detail;
      if (detail && detail.syncedCount > 0) {
        addNotification(
          'delivery',
          'Sinkronisasi Offline Selesai',
          `${detail.syncedCount} pembaruan tugas berhasil disinkronkan ke server pusat!`
        );
        loadDeliveries(true);
      }
    };

    window.addEventListener('driver-offline-synced', onSynced);

    return () => {
      unsub();
      window.removeEventListener('driver-offline-synced', onSynced);
    };
  }, [addNotification]);

  // Delay reporting modal state
  const [delayModal, setDelayModal] = useState<{
    isOpen: boolean;
    delivery: Schedule | null;
    reason: string;
    customNote: string;
  }>({
    isOpen: false,
    delivery: null,
    reason: 'Driver / Helper Tidak Masuk (Harus Segera Diganti)',
    customNote: ''
  });

  // 🔄 Minta Oper Jadwal Modal State (Permintaan oper penugasan)
  const [transferModal, setTransferModal] = useState<{
    isOpen: boolean;
    delivery: Schedule | null;
    reason: string;
    transferType: string;
    gpsPhotoUrl: string;
    constraintNote: string;
  }>({
    isOpen: false,
    delivery: null,
    reason: 'Darurat / Halangan pribadi',
    transferType: 'Oper ke driver lain (Driver cari pengganti)',
    gpsPhotoUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80',
    constraintNote: ''
  });

  // 🗑️ Konfirmasi Hapus Riwayat Pengiriman Selesai (Khusus Super Admin)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    delivery: Schedule | null;
  }>({
    isOpen: false,
    delivery: null
  });

  const [checklistInspectionType, setChecklistInspectionType] = useState<'pre_trip' | 'post_trip'>('pre_trip');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');

  // Proof of Delivery (Konfirmasi Tiba di Gudang Argo) completion modal state
  const [podModal, setPodModal] = useState<{
    isOpen: boolean;
    delivery: Schedule | null;
    conditionNote: string;
    hasSignature: boolean;
    photoUrl: string | null;
    photoTimestamp: string | null;
    postTripFleetStatus: 'available' | 'maintenance';
  }>({
    isOpen: false,
    delivery: null,
    conditionNote: 'Aman, tiba di gudang argo',
    hasSignature: true,
    photoUrl: null,
    photoTimestamp: null,
    postTripFleetStatus: 'available'
  });

  // Dedicated device camera capture modal state
  const [cameraModal, setCameraModal] = useState<{
    isOpen: boolean;
    delivery: Schedule | null;
  }>({
    isOpen: false,
    delivery: null
  });

  // Full-screen photo inspector modal state
  const [viewPhotoModal, setViewPhotoModal] = useState<{
    isOpen: boolean;
    photoUrl: string;
    title: string;
    subtitle: string;
  }>({
    isOpen: false,
    photoUrl: '',
    title: '',
    subtitle: ''
  });

  // Active Driver profile
  const currentDriver = useMemo(() => {
    const matched = crews.find(c => c.id === selectedDriverId);
    if (matched) {
      return {
        ...matched,
        name: portalDisplayName
      };
    }
    if (syncedCrew) {
      return {
        ...syncedCrew,
        name: portalDisplayName
      };
    }
    return crews[0] ? { ...crews[0], name: portalDisplayName } : null;
  }, [crews, selectedDriverId, syncedCrew, portalDisplayName]);

  // Assigned Fleet for current driver
  const assignedFleet = useMemo(() => {
    if (!currentDriver) return null;
    return fleets.find(f => f.driverId === currentDriver.id || f.id === currentDriver.currentFleetId) || fleets[0] || null;
  }, [fleets, currentDriver]);

  // Derived Outbound Waybills (Surat Jalan Keluar) for current driver's deliveries
  const driverWaybills = useMemo(() => {
    return driverWaybillService.getWaybillsForDriver(selectedDriverId, deliveries);
  }, [selectedDriverId, deliveries]);

  // Latest vehicle checklist for current driver/fleet
  const latestChecklist = useMemo(() => {
    return checklists.find(c => c.driverId === selectedDriverId) || checklists[0] || null;
  }, [checklists, selectedDriverId]);

  // Load deliveries with offline local caching (IndexedDB & LocalStorage)
  const loadDeliveries = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      // Integrasi penuh dengan Menu Jadwal & Penugasan (logisticsStore)
      const localSchedules = logisticsStore.getSchedules();
      const activeCrew = crews.find(c => c.id === selectedDriverId);
      const filtered = (selectedDriverId || activeCrew?.name)
        ? localSchedules.filter(s =>
            s.crewId === selectedDriverId ||
            (activeCrew && s.crew?.name?.toLowerCase() === activeCrew.name.toLowerCase()) ||
            (s.crew && activeCrew && s.crew.id === activeCrew.id) ||
            s.crewHelperId === selectedDriverId
          )
        : localSchedules;

      const targetList = filtered.length > 0 ? filtered : localSchedules;
      
      // Sort jadwal terbaru dan H+1 di bagian atas
      const sorted = [...targetList].sort((a, b) => {
        const dateA = new Date(a.departureDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.departureDate || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      setDeliveries(sorted);
      setIsSupabaseLive(false);
      driverOfflineSyncService.cacheDeliveries(sorted);
    } catch (err) {
      console.warn('[DriverMobileView] Error fetching deliveries, loading from offline cache:', err);
      const cached = await driverOfflineSyncService.getCachedDeliveries(selectedDriverId);
      if (cached && cached.length > 0) {
        setDeliveries(cached);
      }
    } finally {
      if (!silent) setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, [selectedDriverId]);

  // React to store updates
  useEffect(() => {
    const unsub = logisticsStore.subscribe(() => {
      const active = logisticsStore.getCurrentUser();
      setCurrentUser(active);
      const matched = logisticsStore.getActiveDriverCrew();
      if (matched) {
        setLoggedInDriver(matched);
        setSelectedDriverId(matched.id);
        setIsDriverLoggedIn(true);
      }
      setCrews(logisticsStore.getCrews());
      setFleets(logisticsStore.getFleets());
      loadDeliveries(true);
    });
    return unsub;
  }, []);

  // ⚡ Supabase Realtime Live Synchronization Layer
  useEffect(() => {
    import('../services/supabaseRealtimeSync').then(({ supabaseRealtimeSync }) => {
      supabaseRealtimeSync.subscribe((event) => {
        console.log('[DriverMobileView] Realtime sync event received:', event);
        setCrews(logisticsStore.getCrews());
        setFleets(logisticsStore.getFleets());
        loadDeliveries(true);
      });
    }).catch(() => {});

    const handleRealtimeSynced = () => {
      setCrews(logisticsStore.getCrews());
      setFleets(logisticsStore.getFleets());
      loadDeliveries(true);
    };

    window.addEventListener('akk-realtime-synced', handleRealtimeSynced);

    return () => {
      window.removeEventListener('akk-realtime-synced', handleRealtimeSynced);
      import('../services/supabaseRealtimeSync').then(({ supabaseRealtimeSync }) => {
        supabaseRealtimeSync.unsubscribe();
      }).catch(() => {});
    };
  }, [selectedDriverId]);

  // Cek peran user saat ini untuk hak akses khusus Super Admin
  const isSuperAdmin = currentUser?.role === 'super_admin';

  // 📦 Pemisahan tugas pengiriman dengan progresi jadwal otomatis:
  // - Pengiriman yang sudah selesai selalu berada di Selesai (deliveredDeliveries)
  // - Pengiriman yang sedang jalan / siap kirim berada di Aktif (inProgress)
  // - Pada tab Jadwal, menampilkan muatan untuk hari esoknya (H+1).
  // - Ketika hari berganti (simulatedDay === 'next_day'), jadwal H+1 otomatis pindah ke Aktif (Siap Kirim)
  //   dan jadwal di bawahnya bergerak naik ke atas menyesuaikan hari berikutnya!
  const { activeDeliveries, scheduledDeliveries, deliveredDeliveries } = useMemo(() => {
    const delivered = deliveries.filter(d => d.status === 'delivered');
    const inProgress = deliveries.filter(d => ['picked_up', 'in_transit', 'delayed'].includes(d.status));
    const allScheduled = deliveries.filter(d => d.status === 'scheduled');

    // Urutkan jadwal muat berdasarkan tanggal & waktu (antrean awal di posisi paling atas)
    const sortedScheduled = [...allScheduled].sort((a, b) => {
      const timeA = new Date(a.departureDate || a.createdAt || 0).getTime();
      const timeB = new Date(b.departureDate || b.createdAt || 0).getTime();
      return timeA - timeB;
    });

    return {
      activeDeliveries: inProgress,
      scheduledDeliveries: sortedScheduled,
      deliveredDeliveries: delivered
    };
  }, [deliveries]);

  // Filtered deliveries berdasarkan activeTab, selectedDateFilter, dan searchQuery
  const filteredDeliveries = useMemo(() => {
    let sourceList: Schedule[] = [];
    if (activeTab === 'active') sourceList = activeDeliveries;
    else if (activeTab === 'scheduled') sourceList = scheduledDeliveries;
    else if (activeTab === 'delivered') sourceList = deliveredDeliveries;
    else sourceList = [...activeDeliveries, ...scheduledDeliveries, ...deliveredDeliveries];

    if (selectedDateFilter) {
      sourceList = sourceList.filter(d => {
        const dDate = d.departureDate ? d.departureDate.substring(0, 10) : '';
        const cDate = d.createdAt ? d.createdAt.substring(0, 10) : '';
        return dDate === selectedDateFilter || cDate === selectedDateFilter;
      });
    }

    if (!searchQuery.trim()) return sourceList;

    const q = searchQuery.toLowerCase();
    return sourceList.filter(d => {
      const storeName = d.store?.storeName?.toLowerCase() || '';
      const city = d.store?.city?.toLowerCase() || '';
      const area = d.areaName?.toLowerCase() || '';
      const tracking = d.trackingNumber?.toLowerCase() || '';
      const cargo = d.cargoDescription?.toLowerCase() || '';
      return storeName.includes(q) || city.includes(q) || area.includes(q) || tracking.includes(q) || cargo.includes(q);
    });
  }, [activeDeliveries, scheduledDeliveries, deliveredDeliveries, activeTab, searchQuery, selectedDateFilter]);

  // Completed deliveries for History sub-tab
  const completedDeliveries = useMemo(() => {
    return deliveries.filter(d => d.status === 'delivered');
  }, [deliveries]);

  // Status handler with Local State Synchronization (Offline Queue & Immediate Optimistic UI)
  const handleUpdateStatus = async (
    delivery: Schedule,
    newStatus: ShipmentStatus,
    extraNotes?: string,
    podData?: {
      podPhotoUrl?: string;
      podReceiverName?: string;
      podConditionNote?: string;
      podPhotoTimestamp?: string;
    },
    fleetStatusOverride?: 'available' | 'on-duty' | 'maintenance'
  ) => {
    setIsRefreshing(true);

    // 1. Otomatis perbarui status armada ke 'Perjalanan' (on-duty) saat Mulai Kirim / In Transit
    if (newStatus === 'in_transit' || newStatus === 'picked_up') {
      if (delivery.fleetId) {
        logisticsStore.updateFleetStatus(delivery.fleetId, 'on-duty');
      }
    } else if (newStatus === 'delivered') {
      const targetFleetStatus = fleetStatusOverride || podModal.postTripFleetStatus || 'available';
      if (delivery.fleetId) {
        logisticsStore.updateFleetStatus(delivery.fleetId, targetFleetStatus);
      }
    }

    // Rekam pembaruan status ke antrean lokal (IndexedDB / localStorage) + Optimistic Store Update
    const res = await driverOfflineSyncService.recordTaskUpdate({
      scheduleId: delivery.id,
      trackingNumber: delivery.trackingNumber,
      driverId: selectedDriverId,
      newStatus,
      previousStatus: delivery.status,
      notes: extraNotes,
      podData
    });

    addNotification(
      newStatus === 'delayed' ? 'sla_warning' : 'delivery',
      res.syncedImmediately ? 'Status Pengiriman Diperbarui' : 'Tersimpan Offline di HP',
      res.message
    );

    // Optimistically update local deliveries view immediately
    setDeliveries(prev => prev.map(d => {
      if (d.id === delivery.id) {
        return {
          ...d,
          status: newStatus,
          notes: extraNotes !== undefined ? extraNotes : d.notes,
          actualArrival: newStatus === 'delivered' ? new Date().toISOString() : d.actualArrival,
          podPhotoUrl: podData?.podPhotoUrl || d.podPhotoUrl,
          podPhotoTimestamp: podData?.podPhotoTimestamp || d.podPhotoTimestamp
        };
      }
      return d;
    }));

    await loadDeliveries(true);
    setIsRefreshing(false);
  };

  // Submit delay report (Lapor Kendala Pengiriman)
  const submitDelayReport = async () => {
    if (!delayModal.delivery) return;
    const notes = `KENDALA: ${delayModal.reason}${delayModal.customNote ? ` - ${delayModal.customNote}` : ''}`;
    await handleUpdateStatus(delayModal.delivery, 'delayed', notes);

    // Otomatis terdata ke modul Laporan Kiriman Kru untuk SPV Logistik
    driverReportService.addReport({
      driverId: selectedDriverId,
      driverName: currentDriver?.name || 'Driver',
      helperName: delayModal.delivery?.crewHelper?.name,
      plateNumber: assignedFleet?.plateNumber || 'P 8125 VC',
      category: 'kendala_jalan',
      areaName: delayModal.delivery.areaName || delayModal.delivery.store?.storeName || 'Area Distribusi',
      deliveryId: delayModal.delivery.id,
      notes,
      photoUrl: null
    });

    addNotification('sla_warning', 'Laporan Kendala Terkirim', `Kendala "${delayModal.reason}" telah diteruskan ke SPV Logistik.`);
    setDelayModal({ isOpen: false, delivery: null, reason: 'Driver / Helper Tidak Masuk (Harus Segera Diganti)', customNote: '' });
  };

  // Submit transfer request (Minta Oper Jadwal) - Terintegrasi dengan Jadwal, Penugasan & Laporan Kiriman Kru
  const submitTransferRequest = async () => {
    if (!transferModal.delivery) return;
    const targetArea = transferModal.delivery.areaName || transferModal.delivery.store?.storeName || 'Area Distribusi';
    const driverName = currentDriver?.name || 'Driver';
    const notes = `[OPER JADWAL: ${transferModal.reason} (${transferModal.transferType})${transferModal.constraintNote ? ` - Kendala: ${transferModal.constraintNote}` : ''}]`;
    
    const transferData = {
      status: 'pending' as const,
      requestedAt: new Date().toISOString(),
      requestedByDriverId: selectedDriverId,
      requestedByDriverName: driverName,
      reason: transferModal.reason,
      transferType: transferModal.transferType,
      gpsPhotoUrl: transferModal.gpsPhotoUrl,
      constraintNote: transferModal.constraintNote,
      notes: transferModal.constraintNote
    };

    // 1. Integrasikan langsung ke data jadwal di logisticsStore & penugasan
    logisticsStore.updateSchedule(transferModal.delivery.id, {
      transferRequest: transferData,
      notes
    });

    // 2. Kirim permintaan pertukaran shift ke pool antrean (Plot ulang kru pengganti)
    logisticsStore.submitSwapShiftRequest({
      requesterCrewId: selectedDriverId,
      requesterCrewName: driverName,
      targetCrewId: 'unassigned',
      targetCrewName: 'SPV Logistik (Plot Ulang Kru Pengganti)',
      shiftDate: transferModal.delivery.departureDate || new Date().toISOString().split('T')[0],
      reason: `${transferModal.reason} (${transferModal.transferType}) - ${targetArea}`
    });

    // 3. Rekam ke menu Laporan Kiriman Kru & Kendala Oper Jadwal
    driverReportService.addReport({
      driverId: selectedDriverId,
      driverName,
      helperName: transferModal.delivery?.crewHelper?.name,
      plateNumber: assignedFleet?.plateNumber || 'P 8125 VC',
      category: 'kendala_jalan',
      areaName: targetArea,
      deliveryId: transferModal.delivery.id,
      notes: `[KENDALA OPER JADWAL] Alasan: ${transferModal.reason} (${transferModal.transferType}). Catatan: ${transferModal.constraintNote || 'Tanpa catatan'}`,
      photoUrl: transferModal.gpsPhotoUrl
    });

    // 4. Catat ke System Activity Log
    logisticsStore.logActivity(
      'Permintaan Oper Jadwal & Kendala',
      transferModal.delivery.trackingNumber,
      `[OPER JADWAL] Driver ${driverName} meminta oper rute ${targetArea}. Alasan: ${transferModal.reason} (${transferModal.transferType}). Kendala: ${transferModal.constraintNote}. SPV Logistik segera plot kru pengganti agar tidak terjadi double kiriman.`
    );

    // 5. Notifikasi prioritas tinggi ke SPV Logistik & Super Admin
    addNotification(
      'schedule',
      '🚨 PERMINTAAN OPER JADWAL & KENDALA (SPV Logistik & Super Admin)',
      `Driver ${driverName} mengajukan oper rute ${targetArea} (${transferModal.reason}). Segera input kru pengganti di menu jadwal & penugasan untuk mencegah double kiriman.`,
      true
    );

    setTransferModal({
      isOpen: false,
      delivery: null,
      reason: 'Darurat / Halangan pribadi',
      transferType: 'Oper ke driver lain (Driver cari pengganti)',
      gpsPhotoUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80',
      constraintNote: ''
    });
    await loadDeliveries(true);
  };

  // Hapus riwayat pengiriman selesai (Khusus Super Admin)
  const handleDeleteCompletedSchedule = async () => {
    if (!deleteConfirmModal.delivery) return;
    if (!isSuperAdmin) {
      addNotification('delivery', 'Akses Ditolak', 'Hanya Super Admin yang berhak menghapus riwayat pengiriman.');
      return;
    }

    logisticsStore.deleteSchedule(deleteConfirmModal.delivery.id);
    addNotification('delivery', 'Riwayat Dihapus', 'Jadwal pengiriman selesai berhasil dihapus permanen oleh Super Admin.');
    setDeleteConfirmModal({ isOpen: false, delivery: null });
    await loadDeliveries(true);
  };

  // Photo captured callback from DriverPodCameraModal
  const handlePhotoCaptured = (photoDataUrl: string, timestamp: string) => {
    if (!cameraModal.delivery) return;
    const target = cameraModal.delivery;

    // Attach to schedule in local store
    logisticsStore.attachImageToSchedule(
      target.id,
      photoDataUrl,
      'proof_of_delivery',
      `Foto barang diterima di ${target.store?.storeName || 'toko'}`
    );

    // Update local state deliveries optimistically
    setDeliveries(prev => prev.map(d => d.id === target.id ? {
      ...d,
      podPhotoUrl: photoDataUrl,
      podPhotoTimestamp: timestamp
    } : d));

    // If POD modal is open or corresponds to this delivery, update its photo state
    setPodModal(prev => {
      if (prev.delivery?.id === target.id || !prev.delivery) {
        return {
          ...prev,
          isOpen: true,
          delivery: target,
          photoUrl: photoDataUrl,
          photoTimestamp: timestamp
        };
      }
      return prev;
    });

    addNotification(
      'delivery',
      'Foto GPS Gudang Disimpan',
      `Foto GPS tiba di gudang untuk ${target.trackingNumber} berhasil dilampirkan.`
    );

    setCameraModal({ isOpen: false, delivery: null });
  };

  // Submit Konfirmasi Tiba di Gudang Argo (POD)
  const submitPod = async () => {
    if (!podModal.delivery) return;
    const podNote = `Tiba di Gudang Argo: ${podModal.conditionNote || 'Aman'}`;
    const podData = {
      podPhotoUrl: podModal.photoUrl || undefined,
      podPhotoTimestamp: podModal.photoTimestamp || new Date().toISOString(),
      podReceiverName: 'Gudang Argo DC',
      podConditionNote: podModal.conditionNote || 'Aman'
    };
    const choice = podModal.postTripFleetStatus || 'available';
    await handleUpdateStatus(podModal.delivery, 'delivered', podNote, podData, choice);
    setPodModal({
      isOpen: false,
      delivery: null,
      conditionNote: 'Aman, tiba di gudang argo',
      hasSignature: true,
      photoUrl: null,
      photoTimestamp: null,
      postTripFleetStatus: 'available'
    });
    addNotification(
      'delivery',
      'Status Armada Diperbarui Otomatis',
      `Armada ${podModal.delivery.fleet?.plateNumber || ''} kini otomatis berstatus: "${choice === 'available' ? 'Siap (Available)' : 'Perlu Perawatan (Maintenance)'}"`
    );
  };

  // Status badge helper
  const getStatusBadge = (status: ShipmentStatus) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
            <Clock className="w-3 h-3" />
            <span>Terjadwal</span>
          </span>
        );
      case 'picked_up':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
            <Package className="w-3 h-3" />
            <span>Siap Kirim</span>
          </span>
        );
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/30 animate-pulse">
            <Truck className="w-3 h-3" />
            <span>In Transit (Jalan)</span>
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>Terkirim (Delivered)</span>
          </span>
        );
      case 'delayed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" />
            <span>Tertunda (Delayed)</span>
          </span>
        );
      default:
        return null;
    }
  };

  if (!isDriverLoggedIn) {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-950 min-h-screen text-slate-100 flex flex-col justify-center p-6 shadow-2xl relative border-x border-slate-900">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full overflow-hidden shadow-2xl relative">
          {/* Modal Brand Header */}
          <div className="p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 border-b border-slate-800 text-center">
            <div className="flex justify-center mb-3">
              <AkkLogo size="lg" />
            </div>
            <p className="text-slate-400 text-xs mt-2 max-w-md mx-auto">
              Portal Akses Logistik Terintegrasi & Pengiriman Luar Pulau PT Anugrah Kemasan Kreatif.
            </p>

            {/* Tab Switcher */}
            <div className="flex items-center justify-center gap-2 mt-5 bg-slate-950 p-1 rounded-xl border border-slate-800 max-w-xs mx-auto">
              <button
                onClick={() => { setAuthTab('login'); setErrorMsg(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                  authTab === 'login'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk (Login)</span>
              </button>
              <button
                onClick={() => { setAuthTab('register'); setErrorMsg(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                  authTab === 'register'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Daftar Akun</span>
              </button>
            </div>
          </div>

          {/* Notifications */}
          {errorMsg && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {authTab === 'login' ? (
            <form onSubmit={handleDriverLoginSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Email / Username</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="admin atau nama@gmail.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Masuk ke Portal AKK</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="p-6 space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap Anda"
                  value={registerData.fullName}
                  onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Email / Username</label>
                <input
                  type="text"
                  required
                  placeholder="email@domain.com"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nomor WhatsApp</label>
                <input
                  type="text"
                  required
                  placeholder="08123456789"
                  value={registerData.phone}
                  onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Konfirmasi Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={registerData.confirmPassword}
                  onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Kirim Pendaftaran Akun</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-slate-950 min-h-screen text-slate-100 pb-24 shadow-2xl relative border-x border-slate-900 flex flex-col">
      {/* Top Mobile App Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <span>Driver AKK Mobile</span>
                <span>•</span>
                <span className={`inline-flex items-center gap-1 ${isSupabaseLive ? 'text-emerald-400' : 'text-cyan-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseLive ? 'bg-emerald-400' : 'bg-cyan-400'} animate-pulse`} />
                  {isSupabaseLive ? 'Supabase Live' : 'Local DB'}
                </span>
              </div>
              <h1 className="text-sm font-bold text-white truncate">
                {portalDisplayName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Network & Offline Queue Pill */}
            <button
              onClick={() => setIsQueueModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition active:scale-95 cursor-pointer ${
                !syncState.isOnline || syncState.isSimulatedOffline
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : syncState.pendingQueue.length > 0
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              }`}
              title="Status koneksi internet & antrean sinkronisasi offline (IndexedDB)"
            >
              {!syncState.isOnline || syncState.isSimulatedOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Offline {syncState.pendingQueue.length > 0 ? `(${syncState.pendingQueue.length})` : ''}</span>
                </>
              ) : syncState.pendingQueue.length > 0 ? (
                <>
                  <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Sync ({syncState.pendingQueue.length})</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Online</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setIsRefreshing(true);
                loadDeliveries();
              }}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-95 cursor-pointer disabled:opacity-50"
              title="Perbarui Data Pengiriman"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Driver Account Display & Assigned Truck Bar */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Supir:</span>
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 font-bold truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              <span className="truncate">{portalDisplayName}</span>
              <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0 font-mono">
                Akun Terverifikasi
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Armada:</span>
            <select
              value={assignedFleet?.id || ''}
              onChange={(e) => {
                const targetF = fleets.find(f => f.id === e.target.value);
                if (targetF && selectedDriverId) {
                  logisticsStore.updateCrew(selectedDriverId, { currentFleetId: targetF.id });
                  addNotification('delivery', 'Armada Diperbarui', `Armada supir dialihkan ke ${targetF.plateNumber} (${targetF.initialCode || targetF.vehicleType})`);
                }
              }}
              className="bg-slate-950 border border-slate-800 text-emerald-400 font-mono font-bold text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500"
            >
              {fleets.map(f => (
                <option key={f.id} value={f.id}>
                  {f.plateNumber} {f.initialCode ? `(${f.initialCode})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* 📶 PERSISTENT OFFLINE MODE BANNER */}
      {(!syncState.isOnline || syncState.isSimulatedOffline) && (
        <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-b border-amber-500/40 px-4 py-2.5 text-xs shadow-md flex items-center justify-between gap-3 animate-fadeIn shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <WifiOff className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-bold text-amber-300 text-xs">
                <span>Mode Offline Aktif</span>
                {syncState.isSimulatedOffline ? (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Simulasi Rute
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Tanpa Sinyal
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 leading-tight truncate">
                Status muat, berangkat &amp; foto POD disimpan di HP. Otomatis sync saat online.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsQueueModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] shrink-0 shadow transition cursor-pointer active:scale-95"
          >
            Antrean ({syncState.pendingQueue.length})
          </button>
        </div>
      )}

      {/* 🌐 ONLINE PENDING SYNC BANNER */}
      {syncState.isOnline && !syncState.isSimulatedOffline && syncState.pendingQueue.length > 0 && (
        <div className="bg-gradient-to-r from-blue-950/90 via-slate-900 to-emerald-950/90 border-b border-cyan-500/40 px-4 py-2.5 text-xs shadow-md flex items-center justify-between gap-3 animate-fadeIn shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <UploadCloud className="w-4 h-4 animate-bounce" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-cyan-300 text-xs">
                Koneksi Pulih • {syncState.pendingQueue.length} Tugas Menunggu Sync
              </div>
              <p className="text-[11px] text-slate-300 leading-tight truncate">
                Tersimpan di memori lokal HP saat offline, siap dikirim ke server kantor pusat.
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              const res = await driverOfflineSyncService.syncQueue();
              if (res.synced > 0) {
                addNotification(
                  'delivery',
                  'Sinkronisasi Sukses',
                  `${res.synced} pembaruan tugas berhasil dikirim ke server pusat.`
                );
                loadDeliveries(true);
              }
            }}
            disabled={syncState.isSyncingQueue}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-black text-[11px] shrink-0 flex items-center gap-1 shadow transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${syncState.isSyncingQueue ? 'animate-spin' : ''}`} />
            <span>{syncState.isSyncingQueue ? 'Mengirim...' : 'Sync Sekarang'}</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-3 space-y-4">
        {/* TAB 1: TUGAS PENGIRIMAN (MAIN VIEW) */}
        {bottomNav === 'deliveries' && (
          <>
            {/* 🕒 DRIVER SHIFT CHECK-IN & NEU-FLAT PERFORMANCE SUMMARY DASHBOARD */}
            <div className="neu-flat rounded-2xl p-4 space-y-3.5 shadow-xl border border-slate-800">
              {/* Header Profile & Shift Status Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl neu-flat-sm flex items-center justify-center text-amber-400 shrink-0 font-black">
                    {portalInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-xs text-white truncate">
                      {portalDisplayName}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Armada: <span className="text-amber-400 font-bold">{assignedFleet?.plateNumber || 'P 8509 VQ'}</span> · {assignedFleet?.vehicleType || 'Pick Up Box'}
                    </div>
                  </div>
                </div>

                {!activeShift ? (
                  <button
                    type="button"
                    onClick={() => setIsCheckinModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 flex items-center gap-1.5 shadow-md shadow-amber-500/25 transition active:scale-95 cursor-pointer"
                  >
                    <Fingerprint className="w-3.5 h-3.5" />
                    <span>Check-In</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutOdometer((activeShift.odometerStartKm || 124500) + 65);
                      setIsCheckoutModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 rounded-xl neu-button text-emerald-400 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Aktif ({activeShift.checkinTimeFormatted})</span>
                  </button>
                )}
              </div>

              {/* Current Shift's Performance Metrics Summary (Neu-Pressed Grid) */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div 
                  onClick={() => setActiveTab('active')}
                  className="neu-pressed p-2.5 rounded-xl cursor-pointer hover:border-blue-500/40 transition"
                >
                  <div className="text-lg font-black text-blue-400 tabular-nums">{activeDeliveries.length}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-0.5">Tugas Aktif</div>
                </div>
                <div 
                  onClick={() => setActiveTab('delivered')}
                  className="neu-pressed p-2.5 rounded-xl cursor-pointer hover:border-emerald-500/40 transition"
                >
                  <div className="text-lg font-black text-emerald-400 tabular-nums">{deliveredDeliveries.length} / {activeDeliveries.length + scheduledDeliveries.length + deliveredDeliveries.length}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-0.5">Terkirim</div>
                </div>
                <div 
                  onClick={() => setActiveTab('scheduled')}
                  className="neu-pressed p-2.5 rounded-xl cursor-pointer hover:border-amber-500/40 transition"
                >
                  <div className="text-lg font-black text-amber-400 tabular-nums">98.5%</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-0.5">Ketepatan</div>
                </div>
              </div>

              {/* Shift Odometer & Sync Status Bar */}
              <div className="flex items-center justify-between text-[11px] px-1 text-slate-400 font-mono">
                <span>Odo Mulai: {activeShift?.odometerStartKm ? `${activeShift.odometerStartKm.toLocaleString()} KM` : '124,500 KM'}</span>
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <Wifi className="w-3 h-3 animate-pulse" />
                  <span>Online Supabase Realtime</span>
                </span>
              </div>
            </div>

            {/* Camera Support Status Feedback Banner */}
            {cameraSupportStatus === 'blocked' && (
              <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3 text-xs text-amber-200 flex items-start gap-2.5">
                <CameraOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <span className="font-bold text-white block">Akses Kamera Perangkat Dibatasi / Diblokir</span>
                  <p className="text-[11px] text-amber-300 leading-relaxed">
                    Peramban atau sistem perangkat membatasi akses kamera langsung. Anda tetap dapat mengambil foto bukti kirim dengan lancar menggunakan tombol <strong>Buka Kamera Bawaan HP</strong> saat mengambil foto.
                  </p>
                </div>
              </div>
            )}

            {/* 📢 ARAHAN & SOLUSI RESMI DARI SPV LOGISTIK / SUPER ADMIN (TERHUBUNG LANGSUNG) */}
            {activeDriverSolutions.length > 0 && (
              <div className="space-y-2.5">
                {activeDriverSolutions.map(sol => (
                  <div
                    key={sol.id}
                    className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/60 border-2 border-amber-500/50 rounded-2xl p-4 shadow-xl space-y-3 relative overflow-hidden animate-in fade-in duration-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                          <Sparkles className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                            Arahan Resmi SPV Logistik / Super Admin
                          </span>
                          <h4 className="text-xs font-black text-white">
                            Solusi Kendala: {sol.areaName}
                          </h4>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        sol.driverAcknowledged
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                      }`}>
                        {sol.driverAcknowledged ? '✓ Dijalankan Kru' : 'Perlu Konfirmasi'}
                      </span>
                    </div>

                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                      <span className="text-[10px] text-slate-400 block font-semibold">Kendala yang Anda Laporkan:</span>
                      <p className="italic text-slate-200 mt-0.5 text-[11px]">"{sol.notes}"</p>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl space-y-1">
                      <span className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5" />
                        <span>Instruksi & Arahan Tindakan SPV:</span>
                      </span>
                      <p className="text-white font-medium text-xs leading-relaxed">
                        {sol.solution}
                      </p>
                      <div className="text-[10px] text-amber-400/80 pt-1 flex items-center justify-between">
                        <span>Disampaikan oleh: <strong>{sol.solutionBy}</strong></span>
                        {sol.solutionAt && (
                          <span>{new Date(sol.solutionAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                        )}
                      </div>
                    </div>

                    {!sol.driverAcknowledged ? (
                      <button
                        type="button"
                        onClick={() => {
                          driverReportService.acknowledgeReportSolution(sol.id);
                          loadDriverKendalaReports();
                          addNotification(
                            'delivery',
                            'Arahan Dikonfirmasi',
                            'Status arahan SPV telah diperbarui menjadi sedang dijalankan. Tetap utamakan keselamatan kerja!'
                          );
                        }}
                        className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Konfirmasi Mengerti & Mulai Jalankan Arahan</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-500/30 p-2 rounded-xl">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Anda telah mengonfirmasi arahan ini & sedang bekerja sesuai solusi.</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {sol.driverAcknowledgedAt ? new Date(sol.driverAcknowledgedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Quick Summary Metrics Grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div 
                onClick={() => setActiveTab('all')}
                className={`p-2 rounded-xl border transition cursor-pointer ${activeTab === 'all' ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
              >
                <div className="text-base font-black text-white">{activeDeliveries.length + scheduledDeliveries.length + deliveredDeliveries.length}</div>
                <div className="text-[10px] font-semibold uppercase mt-0.5">Total</div>
              </div>
              <div 
                onClick={() => setActiveTab('active')}
                className={`p-2 rounded-xl border transition cursor-pointer ${activeTab === 'active' ? 'bg-blue-500/15 border-blue-500/40 text-blue-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
              >
                <div className="text-base font-black text-blue-400">{activeDeliveries.length}</div>
                <div className="text-[10px] font-semibold uppercase mt-0.5">Aktif</div>
              </div>
              <div 
                onClick={() => setActiveTab('scheduled')}
                className={`p-2 rounded-xl border transition cursor-pointer ${activeTab === 'scheduled' ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
              >
                <div className="text-base font-black text-amber-400">{scheduledDeliveries.length}</div>
                <div className="text-[10px] font-semibold uppercase mt-0.5">Jadwal H+1</div>
              </div>
              <div 
                onClick={() => setActiveTab('delivered')}
                className={`p-2 rounded-xl border transition cursor-pointer ${activeTab === 'delivered' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
              >
                <div className="text-base font-black text-emerald-400">{deliveredDeliveries.length}</div>
                <div className="text-[10px] font-semibold uppercase mt-0.5">Terkirim</div>
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari toko, tujuan pengiriman..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:border-amber-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Fitur Kalender / Filter Tanggal Kirim */}
            <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300 pl-0.5">
                <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-semibold">Filter Tanggal Kirim:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDateFilter}
                  onChange={(e) => setSelectedDateFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 font-mono"
                />
                {selectedDateFilter && (
                  <button
                    type="button"
                    onClick={() => setSelectedDateFilter('')}
                    className="text-[10px] text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs (Segmented Buttons) */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('active')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition text-center ${activeTab === 'active' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Aktif ({activeDeliveries.length})
              </button>
              <button
                onClick={() => setActiveTab('scheduled')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition text-center ${activeTab === 'scheduled' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Jadwal ({scheduledDeliveries.length})
              </button>
              <button
                onClick={() => setActiveTab('delivered')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition text-center ${activeTab === 'delivered' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Selesai ({deliveredDeliveries.length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition text-center ${activeTab === 'all' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Semua
              </button>
            </div>

            {/* Deliveries List */}
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">Memuat tugas pengiriman driver...</span>
              </div>
            ) : filteredDeliveries.length === 0 ? (
              <div className="py-10 text-center bg-slate-900/60 rounded-2xl border border-slate-800/80 p-6 space-y-2">
                <Package className="w-8 h-8 text-slate-500 mx-auto" />
                <h3 className="text-sm font-bold text-white">Tidak Ada Pengiriman</h3>
                <p className="text-xs text-slate-400">
                  {searchQuery 
                    ? `Tidak ada pengiriman yang cocok dengan "${searchQuery}".`
                    : 'Belum ada rute pengiriman yang ditugaskan pada status ini.'}
                </p>
                <button
                  onClick={() => { setActiveTab('all'); setSearchQuery(''); }}
                  className="mt-2 text-xs text-amber-400 hover:underline font-semibold"
                >
                  Tampilkan Semua Penugasan
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDeliveries.map(delivery => {
                  const store = delivery.store;
                  const storeLat = store?.latitude || -8.219;
                  const storeLng = store?.longitude || 114.369;
                  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${storeLat},${storeLng}`;
                  const phoneNum = store?.phone || '081234567890';
                  const waUrl = `https://wa.me/${phoneNum.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo ${store?.contactPerson || 'PIC Toko'}, saya supir PT AKK yang mengantar pesanan ${delivery.trackingNumber}.`)}`;
                  const pendingAction = driverOfflineSyncService.getPendingActionForSchedule(delivery.id);

                  return (
                    <div
                      key={delivery.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition space-y-3"
                    >
                      {/* Delivery Header: Store Name & Status Badge (Tanpa Nomor PO) */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="text-base font-black text-white leading-tight truncate">
                            {store?.storeName || delivery.areaName || 'Toko Retail Mitra'}
                          </h2>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                            <span className="text-emerald-400 font-semibold">{store?.city || 'Banyuwangi'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{store?.island || 'Jawa'}</span>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-400 font-medium">{delivery.areaName || 'Area Distribusi'}</span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {getStatusBadge(delivery.status)}
                        </div>
                      </div>

                      {/* Offline Pending Sync Badge on Card */}
                      {pendingAction && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-xs text-amber-300">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                            <span className="font-bold text-[11px] truncate">
                              Tersimpan di HP ({pendingAction.newStatus.toUpperCase()})
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-amber-400/90 shrink-0">
                            Offline ({new Date(pendingAction.clientTimestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        </div>
                      )}

                      {/* Route Path (DC -> Outlet) */}
                      <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 text-xs space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          <span className="text-slate-400 text-[11px] truncate">
                            Asal: <strong className="text-slate-200">{delivery.originName || 'Gudang Pusat Sukowidi DC'}</strong>
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span className="text-slate-300 text-[11px] leading-snug">
                            {store?.address || 'Jl. Raya Distribusi Banyuwangi'}
                          </span>
                        </div>
                      </div>

                      {/* Tanggal Kirim & Timing Metadata */}
                      {delivery.status === 'delivered' ? (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                            <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5 text-blue-400" />
                              <span>Waktu Mulai Kirim</span>
                            </span>
                            <div className="font-bold text-white text-xs mt-0.5">
                              {new Date(delivery.departureDate || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </div>
                            <div className="text-[10px] text-blue-400 font-semibold mt-0.5">
                              Konfirmasi Mulai Berangkat
                            </div>
                          </div>

                          <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                            <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Waktu Selesai Kirim</span>
                            </span>
                            <div className="font-bold text-white text-xs mt-0.5">
                              {new Date(delivery.actualArrival || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </div>
                            <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                              Tiba &amp; Serah Terima
                            </div>
                          </div>
                        </div>
                      ) : (() => {
                        const portalTiming = getDriverPortalDepartureLabel(
                          delivery.departureDate,
                          delivery.areaName,
                          store?.storeName || delivery.store?.storeName
                        );
                        return (
                          <div className="space-y-2">
                            {/* Banner Khusus Area Luar Kota Berangkat Malam vs Reguler */}
                            {portalTiming.isNightRun ? (
                              <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-indigo-950/60 to-amber-500/10 border border-amber-500/40 flex items-center justify-between gap-2 shadow-xs">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-amber-500/25 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 font-bold">
                                    <Moon className="w-4 h-4 text-amber-400" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-black text-amber-300 text-xs truncate flex items-center gap-1.5">
                                      <span>{portalTiming.badgeTitle}</span>
                                      <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.2 rounded text-amber-200 border border-amber-500/30">
                                        {portalTiming.timing.departureLabel}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-300 truncate mt-0.5">
                                      Target Kepulangan: Besok jam <strong className="text-white">{portalTiming.timing.returnLabel}</strong>
                                    </div>
                                  </div>
                                </div>
                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 shrink-0">
                                  Luar Kota
                                </span>
                              </div>
                            ) : (
                              <div className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
                                  <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span className="truncate">
                                    Berangkat <strong className="text-white">{portalTiming.timing.departureLabel}</strong> • Kepulangan <strong className="text-white">{portalTiming.timing.returnLabel}</strong>
                                  </span>
                                </div>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-slate-400 shrink-0">
                                  Reguler
                                </span>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                                <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Tanggal Kirim</span>
                                </span>
                                <div className="font-bold text-white text-xs mt-0.5">
                                  {delivery.departureDate 
                                    ? new Date(delivery.departureDate).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                                    : 'Hari ini'}
                                </div>
                                <div className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                  <span>
                                    {portalTiming.isNightRun
                                      ? (delivery.departureDate && new Date(delivery.departureDate).getDate() !== new Date().getDate()
                                          ? 'Jadwal H+1 (Berangkat Nanti Malam)'
                                          : 'Berangkat Nanti Malam')
                                      : (delivery.departureDate && new Date(delivery.departureDate).getDate() !== new Date().getDate()
                                          ? 'Jadwal H+1 (Besok)'
                                          : 'Jadwal Kirim')}
                                  </span>
                                </div>
                              </div>

                              <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                                <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                                  <span>Waktu &amp; Kepulangan</span>
                                </span>
                                <div className="font-bold text-amber-300 text-xs mt-0.5">
                                  <span>{portalTiming.departureText}</span>
                                </div>
                                <div className="text-[10px] text-slate-300 font-medium mt-0.5">
                                  {portalTiming.returnText}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Status Terintegrasi: Permintaan Oper Jadwal */}
                      {delivery.transferRequest?.status === 'pending' && (
                        <div className="bg-amber-500/15 dark:bg-amber-950/40 border border-amber-400 dark:border-amber-600/70 rounded-xl p-3 space-y-1 shadow-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-black text-amber-950 dark:text-amber-300">
                              <ArrowRightLeft className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>Permintaan Oper Jadwal Diajukan</span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/70 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                              Menunggu SPV Logistik
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-800 dark:text-slate-200 space-y-0.5">
                            <div>Alasan: <strong className="text-slate-950 dark:text-white font-bold">{delivery.transferRequest.reason}</strong></div>
                            {delivery.transferRequest.transferType && (
                              <div className="text-slate-600 dark:text-slate-400 text-[10px]">Jenis Pengalihan: {delivery.transferRequest.transferType}</div>
                            )}
                            {delivery.transferRequest.notes && (
                              <div className="text-slate-600 dark:text-slate-400 text-[10px] italic">"{delivery.transferRequest.notes}"</div>
                            )}
                          </div>
                          <div className="text-[10px] text-amber-800 dark:text-amber-400 font-semibold flex items-center gap-1 pt-0.5">
                            <CheckCircle2 className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Notifikasi telah terkirim ke SPV Logistik &amp; Super Admin</span>
                          </div>
                        </div>
                      )}



                      {/* Driver Status Action Workflow Buttons */}
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                        {delivery.status === 'scheduled' && (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => setTransferModal({
                                isOpen: true,
                                delivery,
                                reason: delivery.transferRequest?.reason || 'Darurat / Halangan pribadi',
                                transferType: delivery.transferRequest?.transferType || 'Oper ke driver lain (Driver cari pengganti)',
                                gpsPhotoUrl: delivery.transferRequest?.gpsPhotoUrl || 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80',
                                constraintNote: delivery.transferRequest?.constraintNote || delivery.transferRequest?.notes || ''
                              })}
                              className={`w-full py-2.5 px-3 rounded-xl border-2 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer ${
                                delivery.transferRequest?.status === 'pending'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-600 dark:border-amber-400 text-amber-950 dark:text-amber-200'
                                  : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border-amber-500 text-amber-950 dark:text-amber-200'
                              }`}
                            >
                              <ArrowRightLeft className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                              <span>{delivery.transferRequest?.status === 'pending' ? 'Edit Oper Jadwal' : 'Minta Oper Jadwal'}</span>
                            </button>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block text-center font-medium">
                              Jadwal persiapan muat esok hari (H+1). Ajukan oper jadwal jika berhalangan.
                            </span>
                          </div>
                        )}

                        {delivery.status === 'picked_up' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUpdateStatus(delivery, 'in_transit')}
                              className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md cursor-pointer"
                            >
                              <Truck className="w-4 h-4" />
                              <span>Mulai Berangkat (In Transit)</span>
                            </button>
                            <button
                              onClick={() => setDelayModal({ isOpen: true, delivery, reason: 'Driver / Helper Tidak Masuk (Harus Segera Diganti)', customNote: '' })}
                              className="px-3 py-2.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 font-bold text-xs flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                              title="Lapor Kendala Pengiriman"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              <span>Kendala</span>
                            </button>
                          </div>
                        )}

                        {delivery.status === 'in_transit' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPodModal({
                                isOpen: true,
                                delivery,
                                conditionNote: 'Aman, tiba di gudang argo',
                                hasSignature: true,
                                photoUrl: delivery.podPhotoUrl || null,
                                photoTimestamp: delivery.podPhotoTimestamp || null,
                                postTripFleetStatus: 'available'
                              })}
                              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Konfirmasi Tiba di Gudang Argo</span>
                            </button>
                            <button
                              onClick={() => setDelayModal({ isOpen: true, delivery, reason: 'Antrean Bongkar Panjang di Toko', customNote: '' })}
                              className="px-3 py-2.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 font-bold text-xs flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                              title="Lapor Kendala Pengiriman"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              <span>Kendala</span>
                            </button>
                          </div>
                        )}

                        {delivery.status === 'delayed' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleUpdateStatus(delivery, 'in_transit', 'Kendala teratasi, melanjutkan rute')}
                                className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                <span>Lanjutkan Perjalanan</span>
                              </button>
                              <button
                                onClick={() => setPodModal({
                                  isOpen: true,
                                  delivery,
                                  conditionNote: 'Aman, tiba setelah keterlambatan',
                                  hasSignature: true,
                                  photoUrl: delivery.podPhotoUrl || null,
                                  photoTimestamp: delivery.podPhotoTimestamp || null,
                                  postTripFleetStatus: 'available'
                                })}
                                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Konfirmasi Tiba di Gudang Argo</span>
                              </button>
                            </div>
                            <span className="text-[10px] text-rose-300/80 block text-center">
                              Status saat ini: Terlaporkan Kendala ke SPV Logistik.
                            </span>
                          </div>
                        )}

                        {delivery.status === 'delivered' && (
                          <div className="space-y-2">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 flex items-center justify-between text-xs text-emerald-300">
                              <div className="flex items-center gap-2 min-w-0">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                <div className="min-w-0">
                                  <span className="font-bold block truncate">Pengiriman Berhasil Selesai</span>
                                  <div className="text-[10px] text-emerald-400/80">
                                    Tiba: {delivery.actualArrival ? new Date(delivery.actualArrival).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : 'Hari ini'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {delivery.podPhotoUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setViewPhotoModal({
                                      isOpen: true,
                                      photoUrl: delivery.podPhotoUrl!,
                                      title: `Bukti Foto POD - ${delivery.store?.storeName}`,
                                      subtitle: `Area: ${delivery.store?.storeName || delivery.areaName || 'Tujuan'} | Status: Selesai`
                                    })}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-2.5 h-2.5" />
                                    <span>Foto</span>
                                  </button>
                                )}
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/30">
                                  POD OK
                                </span>
                              </div>
                            </div>

                            {/* Fitur Hapus Riwayat Selesai (Khusus Super Admin) */}
                            {isSuperAdmin && (
                              <div className="flex items-center justify-between pt-1 px-1">
                                <span className="text-[10px] text-slate-500">
                                  Akses Super Admin:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmModal({ isOpen: true, delivery })}
                                  className="text-[11px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer"
                                  title="Hapus riwayat pengiriman selesai (Hanya Super Admin)"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-400" />
                                  <span>Hapus Riwayat Selesai</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Integrated Quick Actions: Surat Jalan Keluar & Checklist Kendaraan */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => {
                            const wb = driverWaybillService.getWaybillForSchedule(delivery);
                            setActiveWaybillToView(wb);
                            setIsWaybillModalOpen(true);
                          }}
                          className="py-2 px-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-400" />
                          <span>Surat Jalan Keluar</span>
                        </button>

                        {delivery.status === 'delivered' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveChecklistToEdit(latestChecklist || null);
                              setChecklistInspectionType('post_trip');
                              setIsChecklistModalOpen(true);
                            }}
                            className="py-2 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                            title="Checklist Armada Pasca-Jalan (Pulang)"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Checklist Pasca-Jalan (Pulang)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveChecklistToEdit(latestChecklist || null);
                              setChecklistInspectionType('pre_trip');
                              setIsChecklistModalOpen(true);
                            }}
                            className="py-2 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                            title="Checklist Armada Pra-Jalan (Pagi Sebelum Berangkat)"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                            <span>Checklist Pra-Jalan (Pagi)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* TAB 2: CHECKLIST KENDARAAN (INSPEKSI ARMADA PRA/PASCA JALAN) */}
        {bottomNav === 'checklist' && (
          <div className="space-y-4">
            {/* Header Status Armada & Driver */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-white font-mono tracking-tight">
                      {assignedFleet?.plateNumber || 'P 8848 U'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      {assignedFleet?.vehicleType || 'Engkel Long Box'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                    <span>Driver: <strong>{currentDriver?.name || 'Ach Taufiq'}</strong></span>
                    <span>·</span>
                    <span>Inisial: {assignedFleet?.initialCode || 'WB-01'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const fresh = driverChecklistService.createNewChecklistTemplate(
                      selectedDriverId,
                      currentDriver?.name || 'Driver',
                      assignedFleet?.id || 'fl-01',
                      assignedFleet?.plateNumber || 'P 8848 U',
                      assignedFleet?.vehicleType || 'Engkel Long Box'
                    );
                    setActiveChecklistToEdit(fresh);
                    setIsChecklistModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition cursor-pointer active:scale-95 shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Inspeksi Baru</span>
                </button>
              </div>

              {/* Status Kelayakan Hari Ini */}
              {latestChecklist ? (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className={`w-4 h-4 ${
                        latestChecklist.overallStatus === 'passed' ? 'text-emerald-400' :
                        latestChecklist.overallStatus === 'warning' ? 'text-amber-400' : 'text-rose-400'
                      }`} />
                      <span className="font-bold text-xs text-slate-200">
                        Status Inspeksi Terakhir:
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                      latestChecklist.overallStatus === 'passed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                      latestChecklist.overallStatus === 'warning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      {latestChecklist.overallStatus === 'passed' ? 'LOLOS (SIAP JALAN)' :
                       latestChecklist.overallStatus === 'warning' ? 'PERHATIAN KHUSUS' : 'TIDAK LAYAK JALAN'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-1 text-[11px] border-t border-slate-800/80">
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                      <div className="text-slate-400 text-[10px]">Poin Lolos</div>
                      <div className="font-black text-emerald-400 font-mono mt-0.5">
                        {latestChecklist.passedCount} / {latestChecklist.items.length}
                      </div>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                      <div className="text-slate-400 text-[10px]">Odometer</div>
                      <div className="font-black text-blue-400 font-mono mt-0.5">
                        {latestChecklist.odometerKm.toLocaleString()} KM
                      </div>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                      <div className="text-slate-400 text-[10px]">BBM Solar</div>
                      <div className="font-black text-amber-400 font-mono mt-0.5">
                        {latestChecklist.fuelLevelPercent}%
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                    <span>Diperiksa: {latestChecklist.date} · {latestChecklist.time} WIB ({latestChecklist.inspectionType === 'pre_trip' ? 'Pra-Jalan' : 'Pasca-Jalan'})</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveChecklistToEdit(latestChecklist);
                        setIsChecklistModalOpen(true);
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                    >
                      Buka Form Detail
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                  <div className="text-xs font-bold text-slate-200">Belum Ada Pemeriksaan Hari Ini</div>
                  <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                    SOP Pengemudi PT AKK mewajibkan pemeriksaan fisik armada sebelum keluar gerbang pool DC.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Inspection Items Checklist in Tab */}
            {latestChecklist && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Item Pemeriksaan Standar (23 Poin)
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Klik tombol status untuk memperbarui catatan inspeksi armada langsung di peramban.
                    </p>
                  </div>
                </div>

                {/* Filter Kategori */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                  {[
                    { key: 'all', label: 'Semua' },
                    { key: 'mesin_fluida', label: 'Mesin' },
                    { key: 'rem_roda', label: 'Rem & Ban' },
                    { key: 'lampu_listrik', label: 'Lampu' },
                    { key: 'fisik_dokumen', label: 'Dokumen' },
                    { key: 'darurat_k3', label: 'Darurat K3' }
                  ].map(cat => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setChecklistTabCategory(cat.key as any)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
                        checklistTabCategory === cat.key
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* List of Checklist Items */}
                <div className="space-y-2">
                  {latestChecklist.items
                    .filter(item => checklistTabCategory === 'all' || item.category === checklistTabCategory)
                    .map(item => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
                          item.status === 'issue'
                            ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                            : 'bg-slate-950 border-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="font-bold truncate text-slate-200">{item.name}</div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{item.description}</div>
                          {item.note && (
                            <div className="text-[9px] text-rose-300 italic mt-0.5">Catatan: {item.note}</div>
                          )}
                        </div>

                        {/* Interactive toggle */}
                        <div className="flex items-center p-0.5 bg-slate-900 rounded-lg border border-slate-800 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const updatedItems = latestChecklist.items.map(i =>
                                i.id === item.id ? { ...i, status: 'ok' as const } : i
                              );
                              const { overallStatus, passedCount, issueCount } = driverChecklistService.calculateStatus(updatedItems);
                              const updated: DriverVehicleChecklist = {
                                ...latestChecklist,
                                items: updatedItems,
                                overallStatus,
                                passedCount,
                                issueCount
                              };
                              driverChecklistService.saveChecklist(updated);
                              setChecklists(prev => prev.map(c => c.id === updated.id ? updated : c));
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                              item.status === 'ok' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedItems = latestChecklist.items.map(i =>
                                i.id === item.id ? { ...i, status: 'issue' as const } : i
                              );
                              const { overallStatus, passedCount, issueCount } = driverChecklistService.calculateStatus(updatedItems);
                              const updated: DriverVehicleChecklist = {
                                ...latestChecklist,
                                items: updatedItems,
                                overallStatus,
                                passedCount,
                                issueCount
                              };
                              driverChecklistService.saveChecklist(updated);
                              setChecklists(prev => prev.map(c => c.id === updated.id ? updated : c));
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                              item.status === 'issue' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-rose-400'
                            }`}
                          >
                            Kendala
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Riwayat Inspeksi Sebelumnya */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Riwayat Checklist Armada ({checklists.length})
              </h3>

              <div className="space-y-2">
                {checklists.map(chk => (
                  <div
                    key={chk.id}
                    onClick={() => {
                      setActiveChecklistToEdit(chk);
                      setIsChecklistModalOpen(true);
                    }}
                    className="p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between text-xs cursor-pointer transition"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono">{chk.plateNumber}</span>
                        <span className="text-[10px] text-slate-400">({chk.inspectionType === 'pre_trip' ? 'Pra-Jalan' : 'Pasca-Jalan'})</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {chk.date} · {chk.time} WIB · Odo: {chk.odometerKm.toLocaleString()} KM
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        chk.overallStatus === 'passed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        chk.overallStatus === 'warning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {chk.overallStatus.toUpperCase()}
                      </span>
                      <div className="text-[9px] text-slate-500 font-mono">
                        {chk.passedCount}/{chk.items.length} Poin
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SURAT JALAN KELUAR (OUTBOUND DELIVERY WAYBILL) */}
        {bottomNav === 'surat_jalan' && (
          <div className="space-y-4">
            {/* Header Surat Jalan Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-white">Surat Jalan Keluar (SJ Keluar)</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Dokumen resmi manifest muatan gerbang Distribution Center PT AKK.
                  </p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
              </div>

              {/* Status Counters */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div
                  onClick={() => setWaybillStatusFilter('all')}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    waybillStatusFilter === 'all'
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-sm font-black text-white">{driverWaybills.length}</div>
                  <div className="text-[9px] font-semibold uppercase mt-0.5">Total SJ</div>
                </div>

                <div
                  onClick={() => setWaybillStatusFilter('gate_out')}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    waybillStatusFilter === 'gate_out'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-sm font-black text-amber-400">
                    {driverWaybills.filter(w => w.status === 'checker_verified' || w.status === 'gate_out').length}
                  </div>
                  <div className="text-[9px] font-semibold uppercase mt-0.5">Siap Out</div>
                </div>

                <div
                  onClick={() => setWaybillStatusFilter('in_transit')}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    waybillStatusFilter === 'in_transit'
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-sm font-black text-cyan-400">
                    {driverWaybills.filter(w => w.status === 'in_transit').length}
                  </div>
                  <div className="text-[9px] font-semibold uppercase mt-0.5">Di Jalan</div>
                </div>

                <div
                  onClick={() => setWaybillStatusFilter('delivered')}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    waybillStatusFilter === 'delivered'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-sm font-black text-emerald-400">
                    {driverWaybills.filter(w => w.status === 'delivered').length}
                  </div>
                  <div className="text-[9px] font-semibold uppercase mt-0.5">Selesai</div>
                </div>
              </div>
            </div>

            {/* List of Outbound Waybills */}
            <div className="space-y-3">
              {driverWaybills
                .filter(w => {
                  if (waybillStatusFilter === 'all') return true;
                  if (waybillStatusFilter === 'gate_out') return w.status === 'checker_verified' || w.status === 'gate_out';
                  if (waybillStatusFilter === 'in_transit') return w.status === 'in_transit';
                  if (waybillStatusFilter === 'delivered') return w.status === 'delivered';
                  return true;
                })
                .map(wb => (
                  <div
                    key={wb.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 shadow-md transition"
                  >
                    {/* Top Row: Waybill Number & Status Pill */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-mono font-black text-xs text-blue-400">
                          {wb.waybillNumber}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        wb.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                        wb.status === 'in_transit' || wb.status === 'gate_out' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                        'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {wb.statusLabel}
                      </span>
                    </div>

                    {/* Destination & Manifest Details */}
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">{wb.destination.storeName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{wb.trackingNumber}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="truncate">{wb.destination.address}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-300">
                        <div>
                          Muatan: <strong>{wb.totalKoli} Koli</strong> ({(wb.totalWeightKg / 1000).toFixed(1)} Ton)
                        </div>
                        <div className="text-right">
                          Segel Box: <strong className="font-mono text-amber-300">{wb.securitySealNumber}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar per Waybill Card */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWaybillToView(wb);
                          setIsWaybillModalOpen(true);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md shadow-blue-600/20"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Buka Surat Jalan (Cetak & QR)</span>
                      </button>

                      {wb.status === 'checker_verified' && (
                        <button
                          type="button"
                          onClick={() => {
                            const success = driverWaybillService.updateWaybillStatus(wb.id, 'gate_out');
                            if (success) {
                              addNotification('schedule', 'Gate-Out Dikonfirmasi', `Armada ${wb.fleet.plateNumber} tercatat keluar gerbang DC.`);
                              loadDeliveries(true);
                            }
                          }}
                          className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer shrink-0"
                          title="Konfirmasi Keluar Gerbang DC"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Gate-Out</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

              {driverWaybills.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
                  Tidak ada Surat Jalan Keluar untuk pengemudi yang dipilih saat ini.
                </div>
              )}
            </div>
          </div>
        )}


        {/* TAB 3: RIWAYAT PENGIRIMAN SELESAI */}
        {bottomNav === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Riwayat Terkirim ({completedDeliveries.length})</h2>
              <span className="text-[10px] text-slate-400">Bulan Ini</span>
            </div>

            {completedDeliveries.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
                Belum ada pengiriman yang diselesaikan oleh supir ini.
              </div>
            ) : (
              completedDeliveries.map(d => (
                <div key={d.id} className="bg-slate-900 border border-slate-800/90 rounded-xl p-3.5 space-y-2.5 text-xs shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-emerald-400">{d.trackingNumber}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(d.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className="font-bold text-white">{d.store?.storeName}</div>
                  <div className="text-slate-400 text-[11px] truncate">{d.store?.address}</div>

                  {/* Proof of Delivery Photo Thumbnail if captured */}
                  {d.podPhotoUrl && (
                    <div className="bg-slate-950/80 p-2 rounded-xl border border-emerald-500/30 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={d.podPhotoUrl}
                          alt="POD Selesai"
                          className="w-11 h-11 object-cover rounded-lg border border-slate-700 cursor-pointer shrink-0 shadow-xs"
                          onClick={() => setViewPhotoModal({
                            isOpen: true,
                            photoUrl: d.podPhotoUrl!,
                            title: `Bukti Foto POD Selesai - ${d.store?.storeName}`,
                            subtitle: `Area: ${d.store?.storeName || d.areaName || 'Tujuan'} | Penerima: ${d.podReceiverName || 'PIC Toko'}`
                          })}
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 truncate">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>Bukti Foto Terlampir</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {d.podReceiverName ? `Penerima: ${d.podReceiverName}` : 'Telah diverifikasi toko'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewPhotoModal({
                          isOpen: true,
                          photoUrl: d.podPhotoUrl!,
                          title: `Bukti Foto POD Selesai - ${d.store?.storeName}`,
                          subtitle: `Area: ${d.store?.storeName || d.areaName || 'Tujuan'} | Penerima: ${d.podReceiverName || 'PIC Toko'}`
                        })}
                        className="px-2.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 font-bold text-[10px] flex items-center gap-1 shrink-0 border border-cyan-500/30 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Lihat</span>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/60 text-slate-400">
                    <span>Muatan: {d.cargoWeightTon} Ton</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Status: Selesai</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: PROFIL DRIVER & ARMADA */}
        {bottomNav === 'profile' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xl">
                  {portalInitials}
                </div>
                <div>
                  <h2 className="text-base font-black text-white">{portalDisplayName}</h2>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {currentUser?.role === 'driver' ? 'Kru Supir Utama' : (currentUser?.role || currentDriver?.role || 'Pengemudi')}
                  </div>
                  <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Status: {currentDriver?.status === 'on-duty' ? 'On-Duty' : 'Available'}</span>
                  </div>
                </div>
              </div>

              {/* Grid or other cards if needed */}
            </div>

            {/* Presensi Shift & Keamanan PIN Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-slate-200">Presensi Shift &amp; Keamanan PIN</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeShift ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {activeShift ? 'Shift Aktif' : 'Belum Check-In'}
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Status Dinas Hari Ini:</span>
                  <span className={`font-bold ${activeShift ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {activeShift ? `Masuk: ${activeShift.checkinTimeFormatted}` : 'Belum Check-In'}
                  </span>
                </div>
                {activeShift && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Metode Verifikasi:</span>
                    <span className="text-slate-300 font-semibold">
                      {activeShift.verificationMethod === 'biometric' ? 'Sidik Jari (Biometrik)' : 'PIN Keamanan'}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">PIN Masuk Bawaan:</span>
                  <span className="font-mono text-slate-300 font-bold">1234 (Default)</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCheckinModalOpen(true)}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span>{activeShift ? 'Lihat / Perbarui Shift' : 'Check-In Shift Sekarang'}</span>
                </button>
                {activeShift && (
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutOdometer((activeShift.odometerStartKm || 124500) + 65);
                      setIsCheckoutModalOpen(true);
                    }}
                    className="py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold border border-rose-500/30 transition cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Check-Out</span>
                  </button>
                )}
              </div>
            </div>

            {/* Opsi Aplikasi & Keluar Portal di Profil */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => setIsApkModalOpen(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
              >
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Unduh Berkas APK Android (v1.0.4)</span>
              </button>

              {onBackToPortal && (
                <button
                  type="button"
                  onClick={onBackToPortal}
                  className="w-full py-2.5 px-3 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
                >
                  <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                  <span>Kembali ke Portal Operasional</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDriverLogout}
                className="w-full py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4 text-rose-400" />
                <span>Keluar Akun Driver (Ganti Akun)</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button (+) di Pojok Kanan Bawah for Berbagi Foto Gmaps & Lapor Kendala / Akhir Kirim */}
      <div className="fixed bottom-20 right-4 sm:right-6 z-40">
        <button
          type="button"
          onClick={() => setIsGmapsShareModalOpen(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black shadow-xl shadow-amber-500/40 flex items-center justify-center transition-all duration-200 active:scale-95 hover:scale-105 border-2 border-slate-950 cursor-pointer group"
          title="Berbagi Foto Gmaps & Lapor Kendala / Akhir Kirim (+)"
          aria-label="Berbagi Foto Gmaps"
        >
          <Plus className="w-7 h-7 stroke-[3] transition-transform duration-200 group-hover:rotate-90 text-slate-950" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
          </span>
        </button>
      </div>

      {/* Sticky Bottom Navigation Bar for Driver Mobile View */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-2 max-w-md mx-auto">
        <div className="grid grid-cols-4 gap-1">
          <button
            onClick={() => setBottomNav('deliveries')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${bottomNav === 'deliveries' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Calendar className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Jadwal</span>
          </button>
          <button
            onClick={() => setBottomNav('checklist')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${bottomNav === 'checklist' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <ShieldCheck className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Checklist</span>
          </button>
          <button
            onClick={() => setBottomNav('surat_jalan')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${bottomNav === 'surat_jalan' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <FileText className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">SJ Keluar</span>
          </button>
          <button
            onClick={() => setBottomNav('profile')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${bottomNav === 'profile' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <User className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Profil</span>
          </button>
        </div>
      </nav>

      {/* MODAL 1: Lapor Kendala / Delayed Delivery */}
      {delayModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-black text-white">Lapor Kendala Pengiriman</h3>
              </div>
              <button
                onClick={() => setDelayModal({ isOpen: false, delivery: null, reason: 'Driver / Helper Tidak Masuk (Harus Segera Diganti)', customNote: '' })}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300">
              Tujuan: <strong className="text-white">{delayModal.delivery?.store?.storeName || delayModal.delivery?.areaName}</strong> - Area {delayModal.delivery?.areaName || delayModal.delivery?.store?.city || 'Distribusi'}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">Pilih Jenis Kendala:</label>
              {[
                'Driver / Helper Tidak Masuk (Harus Segera Diganti)',
                'Kendala Kerusakan Armada / Ban',
                'Macet Parah / Penutupan Jalur',
                'Antrean Bongkar Panjang di Toko',
                'Cuaca Buruk / Hujan Deras',
                'Jadwal Kapal ASDP Terlambat (Bali)',
                'Toko Belum Buka / Tutup Sementara'
              ].map((r, index) => (
                <label
                  key={`delay-${index}`}
                  onClick={() => setDelayModal(prev => ({ ...prev, reason: r }))}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${delayModal.reason === r ? 'bg-rose-500/15 border-rose-500/50 text-rose-200 font-bold' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                >
                  <input
                    type="radio"
                    name="delayReason"
                    checked={delayModal.reason === r}
                    onChange={() => {}}
                    className="text-rose-500 focus:ring-0"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">Catatan Tambahan Driver (Opsional):</label>
              <textarea
                value={delayModal.customNote}
                onChange={(e) => setDelayModal(prev => ({ ...prev, customNote: e.target.value }))}
                placeholder="Contoh: Estimasi keterlambatan 45 menit, butuh bantuan atau penyesuaian..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDelayModal({ isOpen: false, delivery: null, reason: 'Driver / Helper Tidak Masuk (Harus Segera Diganti)', customNote: '' })}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={submitDelayReport}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Laporan Kendala</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1B: Minta Oper Jadwal (Pengalihan / Handoff Penugasan) */}
      {transferModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                  <ArrowRightLeft className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Minta Oper Jadwal Pengiriman</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Pengalihan jadwal penugasan ke SPV Logistik &amp; Super Admin</p>
                </div>
              </div>
              <button
                onClick={() => setTransferModal({ isOpen: false, delivery: null, reason: 'Darurat / Halangan pribadi', transferType: 'Oper ke driver lain (Driver cari pengganti)', gpsPhotoUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80', constraintNote: '' })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 rounded-xl p-3 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5 shadow-xs">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed font-medium">
                Permintaan ini otomatis masuk ke antrean SPV Logistik &amp; Super Admin serta terintegrasi ke menu laporan kiriman agar kru pengganti segera terinput tanpa double kiriman.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="text-slate-600 dark:text-slate-400 font-medium">
                Tujuan: <strong className="text-slate-900 dark:text-white font-bold">{transferModal.delivery?.store?.storeName || transferModal.delivery?.areaName}</strong>
              </div>
              <div className="text-slate-600 dark:text-slate-400 font-medium">
                Area Distribusi: <span className="text-amber-700 dark:text-amber-400 font-bold">{transferModal.delivery?.areaName || 'Banyuwangi'}</span>
              </div>
            </div>

            {/* Alasan Pengajuan Oper Jadwal */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Alasan Pengajuan Oper Jadwal:</label>
              {[
                'Darurat / Halangan pribadi',
                'Sakit (surat dokter menyusul)',
                'Keperluan keluarga mendesak'
              ].map((reason) => {
                const isSelected = transferModal.reason === reason;
                return (
                  <label
                    key={reason}
                    onClick={() => setTransferModal(prev => ({ ...prev, reason }))}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-500 text-slate-950 dark:text-white font-black shadow-xs'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <input
                      type="radio"
                      name="transferReason"
                      checked={isSelected}
                      onChange={() => {}}
                      className="text-amber-600 focus:ring-amber-500 shrink-0 w-4 h-4 cursor-pointer"
                    />
                    <span className="flex-1">{reason}</span>
                  </label>
                );
              })}
            </div>

            {/* Jenis Pengalihan */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Jenis Pengalihan:</label>
              <select
                value={transferModal.transferType}
                onChange={(e) => setTransferModal(prev => ({ ...prev, transferType: e.target.value }))}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold text-xs rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="Oper ke driver lain (Driver cari pengganti)">Oper ke driver lain (Driver cari pengganti)</option>
                <option value="Tunda / Geser ke hari berikutnya">Tunda / Geser ke hari berikutnya</option>
              </select>
            </div>

            {/* Foto GPS & Lokasi */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Foto GPS &amp; Lokasi Terkini:</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Valid GPS Terkunci</span>
              </label>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 relative border border-slate-300 dark:border-slate-700">
                  <img
                    src={transferModal.gpsPhotoUrl || 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80'}
                    alt="GPS Location"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 text-[11px] space-y-0.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Lat: -8.2192, Lng: 114.3691</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[10px]">Terintegrasi ke modul Laporan Kiriman Kru</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const samplePhotos = [
                      'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
                      'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=600&auto=format&fit=crop&q=80',
                      'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80'
                    ];
                    const next = samplePhotos[Math.floor(Math.random() * samplePhotos.length)];
                    setTransferModal(prev => ({ ...prev, gpsPhotoUrl: next }));
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-[10px] hover:bg-amber-200 transition cursor-pointer"
                >
                  Ambil Ulang
                </button>
              </div>
            </div>

            {/* Kendala Oper Jadwal & Catatan Penugasan */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Kendala Oper Jadwal &amp; Catatan Penugasan:</label>
              <textarea
                value={transferModal.constraintNote}
                onChange={(e) => setTransferModal(prev => ({ ...prev, constraintNote: e.target.value }))}
                placeholder="Tuliskan kendala oper jadwal agar SPV Logistik segera input kru pengganti & hindari double kiriman..."
                rows={2}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded-xl p-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTransferModal({ isOpen: false, delivery: null, reason: 'Darurat / Halangan pribadi', transferType: 'Oper ke driver lain (Driver cari pengganti)', gpsPhotoUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80', constraintNote: '' })}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitTransferRequest}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Kirim Permintaan Oper</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1D: Konfirmasi Hapus Riwayat Selesai (Khusus Super Admin) */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-rose-500/40 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Hapus Riwayat Pengiriman Selesai</h3>
                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Akses Khusus Super Admin</span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="text-slate-400">
                Toko / Tujuan: <strong className="text-white">{deleteConfirmModal.delivery?.store?.storeName || deleteConfirmModal.delivery?.areaName}</strong>
              </div>
              <div className="text-slate-400">
                Area: <span className="text-emerald-400 font-semibold">{deleteConfirmModal.delivery?.areaName || 'Banyuwangi'}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Tiba Selesai: {deleteConfirmModal.delivery?.actualArrival ? new Date(deleteConfirmModal.delivery.actualArrival).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Hari ini'}
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Apakah Anda yakin ingin menghapus arsip pengiriman selesai ini? Data akan dihapus secara permanen dari server dan daftar riwayat driver.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal({ isOpen: false, delivery: null })}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteCompletedSchedule}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Konfirmasi Tiba di Gudang Argo */}
      {podModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-black text-white">Konfirmasi Tiba di Gudang Argo</h3>
              </div>
              <button
                onClick={() => setPodModal({ isOpen: false, delivery: null, conditionNote: 'Aman, tiba di gudang argo', hasSignature: true, photoUrl: null, photoTimestamp: null, postTripFleetStatus: 'available' })}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="font-bold text-white">{podModal.delivery?.store?.storeName}</div>
              <div className="text-slate-400 text-[11px]">{podModal.delivery?.store?.address}</div>
              <div className="text-amber-400 font-semibold text-[11px] pt-1">Area Kirim: {podModal.delivery?.store?.storeName || podModal.delivery?.areaName || 'Tujuan'}</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">Kendala Tambahan (Opsional):</label>
              <input
                type="text"
                value={podModal.conditionNote}
                onChange={(e) => setPodModal(prev => ({ ...prev, conditionNote: e.target.value }))}
                placeholder="Contoh: Aman, tiba sesuai jadwal"
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Pilihan Status Pasca-Jalan Armada (Siap vs Perlu Perawatan) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">Status Armada Pasca-Jalan (Setelah Selesai):</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPodModal(prev => ({ ...prev, postTripFleetStatus: 'available' }))}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    podModal.postTripFleetStatus === 'available'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Siap (Available)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPodModal(prev => ({ ...prev, postTripFleetStatus: 'maintenance' }))}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    podModal.postTripFleetStatus === 'maintenance'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Perlu Perawatan</span>
                </button>
              </div>
            </div>

            {/* Foto GPS Sudah di Gudang / Depan Gerbang */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-300">
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Foto GPS Sudah di Gudang / Depan Gerbang</span>
                </div>
                {podModal.photoUrl ? (
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Foto GPS Terlampir
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-bold">Wajib / GPS Terverifikasi</span>
                )}
              </div>

              {podModal.photoUrl ? (
                <div className="space-y-2">
                  <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-black group max-h-44 flex items-center justify-center">
                    <img
                      src={podModal.photoUrl}
                      alt="GPS Gudang Preview"
                      className="w-full h-36 object-cover cursor-pointer"
                      onClick={() => setViewPhotoModal({
                        isOpen: true,
                        photoUrl: podModal.photoUrl!,
                        title: `Bukti Foto GPS Gudang - ${podModal.delivery?.store?.storeName}`,
                        subtitle: `Area: ${podModal.delivery?.store?.storeName || 'Gudang Argo'} | Status: Tiba`
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setViewPhotoModal({
                        isOpen: true,
                        photoUrl: podModal.photoUrl!,
                        title: `Bukti Foto GPS Gudang - ${podModal.delivery?.store?.storeName}`,
                        subtitle: `Area: ${podModal.delivery?.store?.storeName || 'Gudang Argo'} | Status: Tiba`
                      })}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-xs text-white font-bold cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Perbesar Foto</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewPhotoModal({
                        isOpen: true,
                        photoUrl: podModal.photoUrl!,
                        title: `Bukti Foto GPS Gudang - ${podModal.delivery?.store?.storeName}`,
                        subtitle: `Area: ${podModal.delivery?.store?.storeName || 'Gudang Argo'} | Status: Tiba`
                      })}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Lihat Foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCameraModal({ isOpen: true, delivery: podModal.delivery })}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-[11px] font-bold text-cyan-300 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Foto Ulang</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCameraModal({ isOpen: true, delivery: podModal.delivery })}
                  className="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-cyan-600/25 to-blue-600/25 hover:from-cyan-600/35 hover:to-blue-600/35 border border-cyan-500/40 text-cyan-200 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-inner"
                >
                  <div className="w-7 h-7 rounded-full bg-cyan-500/30 flex items-center justify-center text-cyan-300">
                    <Camera className="w-4 h-4" />
                  </div>
                  <span>Buka Kamera &amp; Ambil Foto GPS Gudang / Gerbang</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPodModal({ isOpen: false, delivery: null, conditionNote: 'Aman, tiba di gudang argo', hasSignature: true, photoUrl: null, photoTimestamp: null, postTripFleetStatus: 'available' })}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitPod}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Konfirmasi Tiba di Gudang Argo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMERA MODAL: Direct device camera for Proof of Delivery */}
      <DriverPodCameraModal
        isOpen={cameraModal.isOpen}
        onClose={() => setCameraModal({ isOpen: false, delivery: null })}
        onPhotoCaptured={handlePhotoCaptured}
        delivery={cameraModal.delivery}
        driverName={currentDriver?.name}
        vehiclePlate={assignedFleet?.plateNumber}
      />

      {/* FULL-SCREEN PHOTO INSPECTOR MODAL */}
      {viewPhotoModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 max-w-md mx-auto animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="min-w-0 pr-2">
              <h3 className="text-xs font-bold text-white truncate">{viewPhotoModal.title}</h3>
              <p className="text-[10px] text-slate-400 truncate">{viewPhotoModal.subtitle}</p>
            </div>
            <button
              onClick={() => setViewPhotoModal({ isOpen: false, photoUrl: '', title: '', subtitle: '' })}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center py-2 overflow-hidden">
            <img
              src={viewPhotoModal.photoUrl}
              alt="Foto POD Penuh"
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-2xl border border-slate-800"
            />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <a
              href={viewPhotoModal.photoUrl}
              download={`POD_${Date.now()}.jpg`}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Foto</span>
            </a>
            <button
              onClick={() => setViewPhotoModal({ isOpen: false, photoUrl: '', title: '', subtitle: '' })}
              className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* MODAL 5: Pusat Antrean Sinkronisasi Offline (IndexedDB & LocalStorage) */}
      {isQueueModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                  !syncState.isOnline || syncState.isSimulatedOffline
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : syncState.pendingQueue.length > 0
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                }`}>
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    Antrean Sinkronisasi Offline
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                      IndexedDB &amp; LocalStorage
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Penyimpanan lokal di perangkat ponsel sopir tanpa koneksi internet
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQueueModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Connection Status & Simulation Switch Bar */}
            <div className="px-4 py-2.5 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  !syncState.isOnline || syncState.isSimulatedOffline
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-emerald-400'
                }`} />
                <span className="font-bold text-slate-200">
                  {!syncState.isOnline || syncState.isSimulatedOffline
                    ? syncState.isSimulatedOffline ? 'Mode Simulasi Offline (Aktif)' : 'Perangkat Terputus (Offline)'
                    : 'Perangkat Online (Tersambung ke Server)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => driverOfflineSyncService.setSimulatedOffline(!syncState.isSimulatedOffline)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                  syncState.isSimulatedOffline
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/30'
                }`}
              >
                {syncState.isSimulatedOffline ? 'Matikan Simulasi' : 'Uji Mode Offline'}
              </button>
            </div>

            {/* Stat Counter Strip */}
            <div className="grid grid-cols-3 gap-2 px-4 py-3 bg-slate-900 shrink-0 border-b border-slate-800/60 text-center">
              <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black font-mono text-amber-400">{syncState.pendingQueue.length}</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Tertahan di HP</div>
              </div>
              <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black font-mono text-emerald-400">{syncState.totalSyncedCount}</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Tersinkronkan</div>
              </div>
              <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                <div className="text-[12px] font-bold font-mono text-cyan-300 truncate mt-0.5">
                  {syncState.lastSyncTime ? `${syncState.lastSyncTime}` : '-'}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Sync Terakhir</div>
              </div>
            </div>

            {/* Queue List Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {syncState.pendingQueue.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">Semua Data Telah Tersinkronkan</h4>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
                      Tidak ada pembaruan status tugas atau foto bukti POD yang tertahan di memori lokal HP. Seluruh data telah masuk ke sistem operasional pusat.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Daftar Aksi Menunggu Jaringan ({syncState.pendingQueue.length})</span>
                    <span className="text-[10px] text-amber-400 lowercase font-normal font-mono">urutan fifo otomatis</span>
                  </div>

                  {syncState.pendingQueue.map((item, idx) => {
                    const matchedDelivery = deliveries.find(d => d.id === item.scheduleId);
                    const storeName = matchedDelivery?.store?.storeName || matchedDelivery?.areaName || 'Toko Retail';
                    const city = matchedDelivery?.store?.city || 'Banyuwangi';

                    return (
                      <div
                        key={item.id}
                        className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold font-mono text-amber-400">
                                #{idx + 1} · {item.trackingNumber}
                              </span>
                              <span className="text-slate-500">|</span>
                              <span className="text-xs font-bold text-white truncate">{storeName}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Tujuan: {city} · Driver ID: {item.driverId}
                            </div>
                          </div>

                          <div className="shrink-0">
                            {item.status === 'syncing' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                <span>Mengirim...</span>
                              </span>
                            ) : item.status === 'failed' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                <AlertCircle className="w-2.5 h-2.5" />
                                <span>Gagal ({item.retryCount}x)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                <Clock className="w-2.5 h-2.5" />
                                <span>Tertunda di HP</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Transition flow */}
                        <div className="flex items-center gap-2 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80 text-xs">
                          <span className="text-[11px] text-slate-400">Pembaruan:</span>
                          <span className="text-[10px] font-mono text-slate-300 font-semibold uppercase">
                            {item.previousStatus || 'scheduled'}
                          </span>
                          <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="text-[10px] font-mono font-black text-amber-400 uppercase bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                            {item.newStatus}
                          </span>
                        </div>

                        {/* Notes if any */}
                        {item.notes && (
                          <div className="text-[11px] text-slate-300 bg-slate-900/50 p-2 rounded-lg border border-slate-800/60 leading-snug">
                            <span className="text-slate-400 font-semibold">Catatan: </span>
                            {item.notes}
                          </div>
                        )}

                        {/* POD Preview if available */}
                        {item.podData?.podPhotoUrl && (
                          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={item.podData.podPhotoUrl}
                                alt="POD Offline"
                                className="w-10 h-10 object-cover rounded-md border border-slate-700 shrink-0"
                              />
                              <div className="min-w-0 text-[11px]">
                                <div className="font-bold text-emerald-300">Foto Bukti POD Tersimpan</div>
                                <div className="text-slate-400 text-[10px] truncate">
                                  Penerima: {item.podData.podReceiverName || 'PIC Toko'}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setViewPhotoModal({
                                isOpen: true,
                                photoUrl: item.podData!.podPhotoUrl!,
                                title: `Foto POD Offline - ${storeName}`,
                                subtitle: `PO ${item.trackingNumber} | Diterima: ${item.podData?.podReceiverName || 'PIC'}`
                              })}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-cyan-300 shrink-0 cursor-pointer"
                            >
                              Lihat
                            </button>
                          </div>
                        )}

                        {/* Timestamp & Actions */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                          <span className="text-slate-400 font-mono">
                            Dicatat HP: {new Date(item.clientTimestamp).toLocaleTimeString('id-ID')} WIB
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await driverOfflineSyncService.syncAction(item.id);
                                if (res.success) {
                                  addNotification('delivery', 'Sinkronisasi Berhasil', res.message);
                                  loadDeliveries(true);
                                } else {
                                  addNotification('sla_warning', 'Sinkronisasi Gagal', res.message);
                                }
                              }}
                              disabled={!driverOfflineSyncService.isEffectivelyOnline() || syncState.isSyncingQueue}
                              className="px-2 py-1 rounded-md bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 font-bold transition cursor-pointer disabled:opacity-40"
                              title="Kirim item ini ke server sekarang"
                            >
                              Kirim
                            </button>
                            <button
                              type="button"
                              onClick={() => driverOfflineSyncService.removeAction(item.id)}
                              className="px-2 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold transition cursor-pointer"
                              title="Hapus aksi dari antrean"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
              {syncState.pendingQueue.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Apakah Anda yakin ingin mengosongkan seluruh antrean offline? Data yang belum disinkronkan akan dihapus dari memori HP.')) {
                      driverOfflineSyncService.clearQueue();
                      addNotification('delivery', 'Antrean Dikosongkan', 'Seluruh aksi offline telah dihapus dari memori HP.');
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 text-xs font-bold transition cursor-pointer"
                >
                  Bersihkan Antrean
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsQueueModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Tutup
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const res = await driverOfflineSyncService.syncQueue();
                    if (res.synced > 0) {
                      addNotification(
                        'delivery',
                        'Sinkronisasi Sukses',
                        `${res.synced} pembaruan tugas berhasil disinkronkan ke server pusat.`
                      );
                      loadDeliveries(true);
                    } else if (res.failed > 0) {
                      addNotification(
                        'sla_warning',
                        'Sebagian Gagal',
                        `${res.failed} tugas gagal dikirim. Periksa koneksi internet Anda.`
                      );
                    }
                  }}
                  disabled={
                    syncState.pendingQueue.length === 0 ||
                    !driverOfflineSyncService.isEffectivelyOnline() ||
                    syncState.isSyncingQueue
                  }
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 text-xs font-black shadow-md transition active:scale-95 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncState.isSyncingQueue ? 'animate-spin' : ''}`} />
                  <span>
                    {syncState.isSyncingQueue
                      ? 'Menyinkronkan...'
                      : !driverOfflineSyncService.isEffectivelyOnline()
                      ? 'Offline (Tunggu Sinyal)'
                      : `Sinkronkan Semua (${syncState.pendingQueue.length})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Surat Jalan Keluar (Outbound Delivery Waybill Resmi) */}
      <DriverSuratJalanModal
        isOpen={isWaybillModalOpen}
        waybill={activeWaybillToView}
        onClose={() => {
          setIsWaybillModalOpen(false);
          setActiveWaybillToView(null);
        }}
        onStatusUpdated={(updated) => {
          setActiveWaybillToView(updated);
          loadDeliveries(true);
        }}
      />

      {/* MODAL 7: Checklist Kendaraan (Inspeksi Fisik Armada) */}
      <DriverVehicleChecklistModal
        isOpen={isChecklistModalOpen}
        onClose={() => {
          setIsChecklistModalOpen(false);
          setActiveChecklistToEdit(null);
        }}
        driverId={selectedDriverId}
        driverName={currentDriver?.name || 'Driver'}
        fleetId={assignedFleet?.id || 'fl-01'}
        plateNumber={assignedFleet?.plateNumber || 'P 8848 U'}
        vehicleType={assignedFleet?.vehicleType || 'Engkel Long Box'}
        initialChecklist={activeChecklistToEdit}
        defaultInspectionType={checklistInspectionType}
        onSaved={(saved) => {
          setChecklists(prev => {
            const idx = prev.findIndex(c => c.id === saved.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = saved;
              return copy;
            }
            return [saved, ...prev];
          });
        }}
      />

      {/* MODAL 8: Presensi Masuk Shift Driver (Biometrik & PIN) */}
      <DriverCheckinModal
        isOpen={isCheckinModalOpen}
        onClose={() => setIsCheckinModalOpen(false)}
        driverId={selectedDriverId}
        driverName={currentDriver?.name || 'Driver'}
        fleetId={assignedFleet?.id || 'fl-01'}
        plateNumber={assignedFleet?.plateNumber || 'P 8848 U'}
        vehicleType={assignedFleet?.vehicleType || 'Engkel Long Box'}
        odometerKm={assignedFleet?.odometerKm || 124580}
        onCheckinSuccess={(shift) => {
          setActiveShift(shift);
        }}
      />

      {/* MODAL 9: Unduh APK Android Driver Mobile */}
      <AndroidApkDownloadModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />

      {/* MODAL 10: Konfirmasi Check-Out Shift Driver */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <Clock className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-black text-white">Konfirmasi Check-Out Shift</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Pengemudi:</span>
                <span className="font-bold text-white">{currentDriver?.name || activeShift?.driverName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Armada / Plat:</span>
                <span className="font-mono text-cyan-400 font-bold">{assignedFleet?.plateNumber || activeShift?.plateNumber || 'P 8125 VC'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Waktu Masuk:</span>
                <span className="font-mono text-emerald-400 font-bold">{activeShift?.checkinTimeFormatted}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Odo Awal:</span>
                <span className="font-mono text-slate-300 font-bold">{activeShift?.odometerStartKm?.toLocaleString()} KM</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                <span>Odometer Akhir (KM):</span>
                <span className="text-[10px] text-slate-500 font-normal">Wajib diisi</span>
              </label>
              <input
                type="number"
                value={checkoutOdometer}
                onChange={(e) => setCheckoutOdometer(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 block">
                Catatan Akhir Shift (Opsional):
              </label>
              <textarea
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                placeholder="Contoh: Seluruh toko selesai terantar, armada terparkir aman di DC..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetDriverId = activeShift?.driverId || selectedDriverId;
                  const finalNote = `Odo Akhir: ${checkoutOdometer} KM${checkoutNotes ? ` - ${checkoutNotes}` : ''}`;
                  const res = await driverShiftService.checkOutDriver(targetDriverId, finalNote);
                  addNotification(
                    'schedule',
                    'Check-Out Berhasil',
                    res.message || 'Shift dinas resmi diakhiri hari ini.'
                  );
                  setActiveShift(null);
                  setIsCheckoutModalOpen(false);
                  setCheckoutNotes('');
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer active:scale-95 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Selesai & Check-Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 11: Berbagi Foto Gmaps & Lapor Kendala / Akhir Kiriman */}
      <DriverGmapsShareModal
        isOpen={isGmapsShareModalOpen}
        onClose={() => setIsGmapsShareModalOpen(false)}
        deliveries={deliveries}
        driverName={currentDriver?.name || activeShift?.driverName}
        plateNumber={assignedFleet?.plateNumber || activeShift?.plateNumber || 'P 8125 VC'}
        onReportSubmitted={async (report) => {
          if (report.delivery) {
            if (report.category === 'akhir_kiriman') {
              const podNote = `Akhir Kiriman: ${report.notes || 'Selesai serah terima di area tujuan'}`;
              await handleUpdateStatus(report.delivery, 'delivered', podNote, {
                podPhotoUrl: report.photoUrl || undefined,
                podPhotoTimestamp: new Date().toISOString(),
                podReceiverName: report.delivery.store?.contactPerson || 'PIC Toko',
                podConditionNote: report.notes || 'Selesai Baik'
              });
            } else if (report.category === 'kendala_jalan') {
              const delayNote = `KENDALA GMAPS: ${report.notes || 'Kendala rute perjalanan'} (GPS: ${report.driverLat.toFixed(4)}, ${report.driverLng.toFixed(4)})`;
              await handleUpdateStatus(report.delivery, 'delayed', delayNote);
            }
            if (report.photoUrl) {
              logisticsStore.attachImageToSchedule(
                report.delivery.id,
                report.photoUrl,
                report.category === 'akhir_kiriman' ? 'proof_of_delivery' : 'other',
                `Foto Gmaps [${report.category}]: ${report.notes || 'Dokumentasi'}`
              );
            }
          }
          addNotification(
            'delivery',
            'Laporan & Foto Gmaps Terkirim',
            `Laporan kiriman dan foto Google Maps berhasil dikirim ke sistem operasional DC.`
          );
        }}
      />
    </div>
  );
};
