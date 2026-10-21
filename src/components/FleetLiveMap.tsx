import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { 
  Radio, 
  Truck, 
  MapPin, 
  Navigation, 
  Signal, 
  RotateCcw, 
  Search, 
  Filter, 
  Zap, 
  Battery, 
  Layers, 
  Compass, 
  Maximize2, 
  Minimize2, 
  Building2, 
  Clock, 
  ShieldCheck, 
  Activity, 
  ChevronRight,
  Eye,
  RefreshCw,
  Flame,
  AlertTriangle,
  Fuel,
  Bell,
  ShieldAlert,
  Phone,
  MessageSquare,
  CheckCircle2,
  X
} from 'lucide-react';
import { TracksolidDevice, Fleet, Schedule, RetailStore } from '../types';
import { logisticsStore } from '../services/store';
import { CENTRAL_WAREHOUSE } from '../data/mockData';
import { tracksolidSyncService, TracksolidSyncState } from '../services/tracksolidSyncService';
import { useToast } from '../context/ToastContext';

interface FleetLiveMapProps {
  heightClass?: string;
  className?: string;
  selectedImeiFromParent?: string | null;
  onSelectFleet?: (device: TracksolidDevice) => void;
}

type MapTileProvider = 'dark' | 'osm' | 'satellite';

// 24-Hour Idling Hotspot Data Model
export interface IdleHotspot24h {
  id: string;
  locationName: string;
  latitude: number;
  longitude: number;
  totalIdleHours: number;
  idleMinutes: number;
  fleetsInvolvedCount: number;
  fleetPlates: string[];
  primaryReason: 'Ferry Queue / Port' | 'Warehouse Loading / Staging' | 'Driver Rest / Meals' | 'Retail Unloading Queue' | 'Traffic / Red Light Stop';
  severity: 'high' | 'medium' | 'low';
  estimatedFuelWastedLiters: number;
}

// Model for Idle/OFF > 60 Mins Outside Central Warehouse Alert
export interface IdleOutsideDCAlert {
  device: TracksolidDevice;
  distanceKmFromDC: number;
  idleMinutes: number;
  locationAddress: string;
  driverName: string;
}

// Calculate distance in km from Central Warehouse Sukowidi DC
export function getDistanceFromCentralDC(lat: number, lng: number): number {
  const dcLat = CENTRAL_WAREHOUSE.coordinates[0];
  const dcLng = CENTRAL_WAREHOUSE.coordinates[1];
  const R = 6371; // Earth radius in km
  const dLat = (lat - dcLat) * (Math.PI / 180);
  const dLng = (lng - dcLng) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(dcLat * (Math.PI / 180)) * 
    Math.cos(lat * (Math.PI / 180)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

// Convert stopDuration string or device status to estimated idle minutes
export function parseStopDurationMinutes(stopDuration?: string, status?: string, speed?: number): number {
  if (speed && speed > 0) return 0;
  if (!stopDuration) {
    if (status === 'Sleeping') return 65; // Default sleeping assumption >60m
    return 0;
  }
  const clean = stopDuration.toLowerCase().trim();
  if (clean.includes('hr') || clean.includes('jam')) {
    const matched = clean.match(/\d+/);
    if (matched) return parseInt(matched[0], 10) * 60;
    return 60; // fallback "1hr+"
  }
  if (clean.includes('m') || clean.includes('mnt') || clean.includes('min')) {
    const matched = clean.match(/\d+/);
    if (matched) return parseInt(matched[0], 10);
  }
  if (status === 'Sleeping') return 65;
  return 0;
}

// Default 24h Idle Hotspot Clusters across Key Transit Routes
const INITIAL_IDLE_HOTSPOTS_24H: IdleHotspot24h[] = [
  {
    id: 'hotspot-01',
    locationName: 'Pelabuhan Ketapang Transit Queue',
    latitude: -8.1415,
    longitude: 114.3980,
    totalIdleHours: 4.5,
    idleMinutes: 270,
    fleetsInvolvedCount: 3,
    fleetPlates: ['B 9128 UYX', 'P 9677 VB', 'B 9301 TXR'],
    primaryReason: 'Ferry Queue / Port',
    severity: 'high',
    estimatedFuelWastedLiters: 6.75
  },
  {
    id: 'hotspot-02',
    locationName: 'Gudang Pusat AKK Sukowidi Staging Area',
    latitude: -8.1906,
    longitude: 114.3708,
    totalIdleHours: 3.8,
    idleMinutes: 228,
    fleetsInvolvedCount: 4,
    fleetPlates: ['B 9802 KLS', 'B 9552 PKM', 'B 9445 WES', 'P 8801 UV'],
    primaryReason: 'Warehouse Loading / Staging',
    severity: 'high',
    estimatedFuelWastedLiters: 5.7
  },
  {
    id: 'hotspot-03',
    locationName: 'Rest Area Tol Probolinggo KM 820',
    latitude: -7.7540,
    longitude: 113.2160,
    totalIdleHours: 2.2,
    idleMinutes: 132,
    fleetsInvolvedCount: 2,
    fleetPlates: ['P 8848 U', 'B 9110 SYA'],
    primaryReason: 'Driver Rest / Meals',
    severity: 'medium',
    estimatedFuelWastedLiters: 3.3
  },
  {
    id: 'hotspot-04',
    locationName: 'DC Retail Surabaya Rungkut Unloading Gate',
    latitude: -7.3290,
    longitude: 112.7750,
    totalIdleHours: 2.8,
    idleMinutes: 168,
    fleetsInvolvedCount: 2,
    fleetPlates: ['B 9128 UYX', 'P 8381 VE'],
    primaryReason: 'Retail Unloading Queue',
    severity: 'medium',
    estimatedFuelWastedLiters: 4.2
  },
  {
    id: 'hotspot-05',
    locationName: 'Sanur Bali Retail Drop Point',
    latitude: -8.6750,
    longitude: 115.2580,
    totalIdleHours: 1.5,
    idleMinutes: 90,
    fleetsInvolvedCount: 1,
    fleetPlates: ['P 9812 AK'],
    primaryReason: 'Retail Unloading Queue',
    severity: 'medium',
    estimatedFuelWastedLiters: 2.25
  },
  {
    id: 'hotspot-06',
    locationName: 'Situbondo Lintas Pantura Rest Stop',
    latitude: -7.7050,
    longitude: 113.9920,
    totalIdleHours: 0.8,
    idleMinutes: 48,
    fleetsInvolvedCount: 1,
    fleetPlates: ['W 8603 PG'],
    primaryReason: 'Driver Rest / Meals',
    severity: 'low',
    estimatedFuelWastedLiters: 1.2
  }
];

export const FleetLiveMap: React.FC<FleetLiveMapProps> = ({
  heightClass = 'h-[550px]',
  className = '',
  selectedImeiFromParent = null,
  onSelectFleet
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Local State
  const [devices, setDevices] = useState<TracksolidDevice[]>(logisticsStore.getDevices());
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());
  const [stores, setStores] = useState<RetailStore[]>(logisticsStore.getStores());
  const [schedules, setSchedules] = useState<Schedule[]>(logisticsStore.getSchedules());

  const [selectedDevice, setSelectedDevice] = useState<TracksolidDevice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'moving' | 'sleeping' | 'alert_idle_outside_dc'>('all');
  const [tileProvider, setTileProvider] = useState<MapTileProvider>('dark');
  const [isSimulatingLive, setIsSimulatingLive] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRetailStores, setShowRetailStores] = useState(true);
  
  // 🔥 Visual Heatmap Toggle for 24h Vehicle Idling Occurrences
  const [showIdleHeatmap, setShowIdleHeatmap] = useState<boolean>(true);
  const [selectedHotspot, setSelectedHotspot] = useState<IdleHotspot24h | null>(null);

  // 🚨 Idle >60m Outside Central Warehouse Warning Modal & Toast Notifications State
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [approvedAlertImeis, setApprovedAlertImeis] = useState<string[]>([]);
  const [dismissedToastImeis, setDismissedToastImeis] = useState<string[]>([]);

  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  // 📡 Tracksolid Pro 5-Minute Auto-Sync Engine Integration
  const { addNotification } = useToast();
  const [syncState, setSyncState] = useState<TracksolidSyncState>(tracksolidSyncService.getState());
  const [syncNotificationBanner, setSyncNotificationBanner] = useState<string | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  // Network listener for offline/online transitions
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Subscribe to Tracksolid 5-Minute Auto-Sync Service
  useEffect(() => {
    const unsubSync = tracksolidSyncService.subscribe((state) => {
      setSyncState(state);
      if (state.lastSyncTime) {
        setLastSyncTime(state.lastSyncTime);
      }
    });

    const handleSyncEvent = (e: any) => {
      const detail = e.detail;
      if (detail) {
        const msg = `Pembaruan Otomatis Tracksolid: ${detail.count} armada diperbarui (${detail.time} WIB)`;
        setSyncNotificationBanner(msg);
        addNotification(
          'geofence',
          'Sinkronisasi Otomatis Tracksolid (Tiap 5 Menit)',
          `Posisi GPS ${detail.count} armada telah diperbarui akurat pada peta.`,
          false
        );
        setTimeout(() => setSyncNotificationBanner(null), 5000);
      }
    };

    window.addEventListener('tracksolid-synced', handleSyncEvent);

    return () => {
      unsubSync();
      window.removeEventListener('tracksolid-synced', handleSyncEvent);
    };
  }, [addNotification]);

  // Listen for changes in logisticsStore
  useEffect(() => {
    const unsubscribe = logisticsStore.subscribe(() => {
      setDevices(logisticsStore.getDevices());
      setFleets(logisticsStore.getFleets());
      setStores(logisticsStore.getStores());
      setSchedules(logisticsStore.getSchedules());
    });
    return () => unsubscribe();
  }, []);

  // Compute 🚨 Idle/OFF > 60 Minutes Outside Central Warehouse Alerts
  const idleOutsideDCAlerts: IdleOutsideDCAlert[] = useMemo(() => {
    const alerts: IdleOutsideDCAlert[] = [];

    devices.forEach(dev => {
      if (!dev.latitude || !dev.longitude) return;

      const idleMins = parseStopDurationMinutes(dev.stopDuration, dev.status, dev.currentSpeedKmh);
      const distFromDC = getDistanceFromCentralDC(dev.latitude, dev.longitude);
      const isIdleOrOff = dev.status === 'Sleeping' || dev.accStatus === 'OFF' || dev.currentSpeedKmh === 0;

      // RULE: Idle or OFF >= 60 minutes AND Distance from Gudang Pusat > 1.5 KM
      if (isIdleOrOff && idleMins >= 60 && distFromDC > 1.5) {
        alerts.push({
          device: dev,
          distanceKmFromDC: distFromDC,
          idleMinutes: idleMins,
          locationAddress: dev.address || `Koordinat (${dev.latitude}, ${dev.longitude})`,
          driverName: dev.driverName
        });
      }
    });

    return alerts;
  }, [devices]);

  // Active Toast Alerts Queue (filtered out dismissed ones)
  const activeToastAlerts = useMemo(() => {
    return idleOutsideDCAlerts.filter(a => !dismissedToastImeis.includes(a.device.imei));
  }, [idleOutsideDCAlerts, dismissedToastImeis]);

  // Compute dynamic 24h idle hotspots
  const idleHotspots24h: IdleHotspot24h[] = useMemo(() => {
    const dynamicHotspots: IdleHotspot24h[] = [...INITIAL_IDLE_HOTSPOTS_24H];

    devices.forEach(dev => {
      if (dev.status === 'Sleeping' && dev.latitude && dev.longitude) {
        const existing = dynamicHotspots.find(
          h => Math.abs(h.latitude - dev.latitude) < 0.008 && Math.abs(h.longitude - dev.longitude) < 0.008
        );

        if (existing) {
          if (!existing.fleetPlates.includes(dev.vehiclePlate)) {
            existing.fleetPlates.push(dev.vehiclePlate);
            existing.fleetsInvolvedCount += 1;
          }
        } else {
          dynamicHotspots.push({
            id: `dynamic-${dev.imei}`,
            locationName: dev.address || `Titik Diam ${dev.vehiclePlate}`,
            latitude: dev.latitude,
            longitude: dev.longitude,
            totalIdleHours: 1.5,
            idleMinutes: 90,
            fleetsInvolvedCount: 1,
            fleetPlates: [dev.vehiclePlate],
            primaryReason: 'Warehouse Loading / Staging',
            severity: 'medium',
            estimatedFuelWastedLiters: 2.25
          });
        }
      }
    });

    return dynamicHotspots;
  }, [devices]);

  // Aggregated 24h Idling Metrics for Summary Pill
  const aggregatedIdleMetrics = useMemo(() => {
    const totalHotspots = idleHotspots24h.length;
    const totalIdleHours = Number(idleHotspots24h.reduce((sum, h) => sum + h.totalIdleHours, 0).toFixed(1));
    const totalFuelWasted = Number(idleHotspots24h.reduce((sum, h) => sum + h.estimatedFuelWastedLiters, 0).toFixed(1));
    const highSeverityCount = idleHotspots24h.filter(h => h.severity === 'high').length;

    return {
      totalHotspots,
      totalIdleHours,
      totalFuelWasted,
      highSeverityCount
    };
  }, [idleHotspots24h]);

  // Filtered devices list
  const filteredDevices = useMemo(() => {
    return devices.filter(dev => {
      const matchSearch = 
        dev.vehiclePlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dev.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dev.vehicleName && dev.vehicleName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        dev.imei.includes(searchQuery);

      let matchStatus = true;
      if (statusFilter === 'moving') {
        matchStatus = dev.currentSpeedKmh > 0 || dev.accStatus === 'ON';
      } else if (statusFilter === 'sleeping') {
        matchStatus = dev.status === 'Sleeping' || (dev.currentSpeedKmh === 0 && dev.accStatus === 'OFF');
      } else if (statusFilter === 'alert_idle_outside_dc') {
        matchStatus = idleOutsideDCAlerts.some(a => a.device.imei === dev.imei);
      }

      return matchSearch && matchStatus;
    });
  }, [devices, searchQuery, statusFilter, idleOutsideDCAlerts]);

  // Handle parent-selected IMEI
  useEffect(() => {
    if (selectedImeiFromParent) {
      const found = devices.find(d => d.imei === selectedImeiFromParent);
      if (found) {
        setSelectedDevice(found);
        if (mapInstanceRef.current && found.latitude && found.longitude) {
          mapInstanceRef.current.setView([found.latitude, found.longitude], 14, { animate: true });
        }
      }
    }
  }, [selectedImeiFromParent, devices]);

  // Manual trigger synchronization helper
  const handleTriggerManualSync = async () => {
    setIsManualSyncing(true);
    try {
      const res = await tracksolidSyncService.triggerSync('manual');
      if (res.success) {
        setSyncNotificationBanner(`Sinkronisasi manual berhasil: ${res.devices.length} armada diperbarui`);
        setTimeout(() => setSyncNotificationBanner(null), 4000);
      }
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Interval change helper
  const handleIntervalSelect = (seconds: number) => {
    if (seconds <= 0) {
      tracksolidSyncService.setAutoSyncEnabled(false);
    } else {
      tracksolidSyncService.setAutoSyncEnabled(true);
      tracksolidSyncService.setIntervalSeconds(seconds);
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = -8.1906;
      const initialLng = 114.3708;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 10,
        zoomControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const getTileUrl = (provider: MapTileProvider) => {
        if (provider === 'osm') {
          return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        }
        if (provider === 'satellite') {
          return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        }
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      };

      const tileLayer = L.tileLayer(getTileUrl(tileProvider), {
        attribution: '&copy; OpenStreetMap &amp; Tracksolid API',
        maxZoom: 19
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    let url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    if (tileProvider === 'osm') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    } else if (tileProvider === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    }

    const newTileLayer = L.tileLayer(url, {
      attribution: '&copy; OpenStreetMap &amp; Tracksolid API',
      maxZoom: 19
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newTileLayer;
  }, [tileProvider]);

  // Render Map Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    // 1. 🔥 Overlay 24-Hour Idling Occurrences Heatmap Circles
    if (showIdleHeatmap) {
      idleHotspots24h.forEach(hotspot => {
        let circleColor = '#ef4444';
        let fillColor = '#f87171';
        let radiusMeters = 3500;

        if (hotspot.severity === 'medium') {
          circleColor = '#f59e0b';
          fillColor = '#fbbf24';
          radiusMeters = 2500;
        } else if (hotspot.severity === 'low') {
          circleColor = '#eab308';
          fillColor = '#fde047';
          radiusMeters = 1800;
        }

        const heatCircle = L.circle([hotspot.latitude, hotspot.longitude], {
          radius: radiusMeters,
          color: circleColor,
          weight: 2,
          opacity: 0.8,
          fillColor: fillColor,
          fillOpacity: 0.25
        });

        const heatMarkerIcon = L.divIcon({
          className: 'custom-heat-marker',
          html: `
            <div class="relative flex items-center justify-center cursor-pointer group">
              <div class="absolute -inset-3 rounded-full ${hotspot.severity === 'high' ? 'bg-rose-500/40 animate-ping' : 'bg-amber-500/30 animate-pulse'}"></div>
              <div class="w-8 h-8 rounded-full ${hotspot.severity === 'high' ? 'bg-rose-950 border-rose-500' : 'bg-amber-950 border-amber-500'} border-2 text-white flex items-center justify-center shadow-2xl font-bold text-xs">
                🔥
              </div>
              <div class="absolute top-full mt-1 bg-slate-950/95 text-rose-300 text-[9px] font-mono font-bold px-2 py-0.5 rounded border border-rose-500/40 whitespace-nowrap shadow-xl">
                Idle ${hotspot.totalIdleHours} Jam
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const heatMarker = L.marker([hotspot.latitude, hotspot.longitude], { icon: heatMarkerIcon });

        heatMarker.on('click', () => {
          setSelectedHotspot(hotspot);
        });

        const popupContent = `
          <div class="p-3 text-xs text-slate-100 font-sans max-w-xs space-y-2">
            <div class="flex items-center justify-between border-b border-slate-700 pb-1.5">
              <div class="flex items-center gap-1.5 font-bold text-rose-400 text-xs">
                🔥 <span>${hotspot.locationName}</span>
              </div>
              <span class="px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                hotspot.severity === 'high' 
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }">
                ${hotspot.severity.toUpperCase()} IDLE
              </span>
            </div>

            <div class="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
              <div class="bg-slate-900 p-1.5 rounded border border-slate-800">
                <span class="text-slate-400 text-[9px] block">Total Idle (24j):</span>
                <strong className="text-rose-400">${hotspot.totalIdleHours} Jam (${hotspot.idleMinutes} mnt)</strong>
              </div>
              <div class="bg-slate-900 p-1.5 rounded border border-slate-800">
                <span class="text-slate-400 text-[9px] block">Estimasi Solar Rusak:</span>
                <strong className="text-amber-300">~${hotspot.estimatedFuelWastedLiters} Liter</strong>
              </div>
            </div>

            <div class="text-[10px] text-slate-300 leading-snug">
              📍 <strong>Penyebab Utama:</strong> <span class="text-slate-200">${hotspot.primaryReason}</span>
            </div>

            <div class="pt-1.5 border-t border-slate-800 text-[10px]">
              <span class="text-slate-400 block mb-1">Armada Terdeteksi Diam (${hotspot.fleetsInvolvedCount} Unit):</span>
              <div class="flex flex-wrap gap-1 font-mono">
                ${hotspot.fleetPlates.map(p => `<span class="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-800">${p}</span>`).join('')}
              </div>
            </div>
          </div>
        `;

        heatCircle.bindPopup(popupContent);
        heatMarker.bindPopup(popupContent);

        layerGroup.addLayer(heatCircle);
        layerGroup.addLayer(heatMarker);
      });
    }

    // 2. Central Warehouse DC Marker (Banyuwangi Hub)
    const hubIcon = L.divIcon({
      className: 'custom-hub-marker',
      html: `
        <div class="relative flex items-center justify-center cursor-pointer group">
          <div class="absolute -inset-2 rounded-full bg-blue-500/30 animate-ping"></div>
          <div class="w-9 h-9 rounded-xl bg-slate-900 border-2 border-blue-400 text-blue-400 flex items-center justify-center shadow-lg font-bold text-xs">
            🏢
          </div>
          <div class="absolute bottom-full mb-1 bg-slate-900/90 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/40 whitespace-nowrap shadow-md">
            Gudang Pusat AKK DC
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    const hubMarker = L.marker([CENTRAL_WAREHOUSE.coordinates[0], CENTRAL_WAREHOUSE.coordinates[1]], { icon: hubIcon });
    hubMarker.bindPopup(`
      <div class="p-2.5 text-xs text-slate-100 font-sans max-w-xs">
        <div class="font-bold text-blue-400 text-sm flex items-center gap-1.5 mb-1">
          🏢 ${CENTRAL_WAREHOUSE.name}
        </div>
        <p class="text-slate-300 text-[11px] leading-snug">${CENTRAL_WAREHOUSE.address}</p>
        <div class="mt-2 pt-2 border-t border-slate-700 text-[10px] text-slate-400 font-mono">
          Koordinat: ${CENTRAL_WAREHOUSE.coordinates.join(', ')}
        </div>
      </div>
    `);
    layerGroup.addLayer(hubMarker);

    // 3. Retail Store Markers (if enabled)
    if (showRetailStores) {
      stores.forEach(st => {
        if (!st.latitude || !st.longitude) return;

        const storeIcon = L.divIcon({
          className: 'custom-store-marker',
          html: `
            <div class="relative flex items-center justify-center cursor-pointer group" title="${st.storeName}">
              <div class="w-5 h-5 rounded-full bg-slate-900/90 border border-purple-400/80 text-purple-300 flex items-center justify-center text-[10px] shadow-sm font-bold">
                🛒
              </div>
            </div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const storeMarker = L.marker([st.latitude, st.longitude], { icon: storeIcon });
        storeMarker.bindPopup(`
          <div class="p-2 text-xs text-slate-100 font-sans">
            <div class="font-bold text-purple-400 text-xs">${st.storeName}</div>
            <div class="text-[10px] text-slate-300">${st.city}, ${st.province}</div>
            <div class="text-[10px] text-slate-400 mt-1">Kat: <strong class="text-amber-300">${st.storeCategory}</strong></div>
          </div>
        `);
        layerGroup.addLayer(storeMarker);
      });
    }

    // 4. Tracksolid Live Fleet Markers
    filteredDevices.forEach(dev => {
      if (!dev.latitude || !dev.longitude) return;

      const isMoving = dev.currentSpeedKmh > 0 || dev.accStatus === 'ON';
      const isSleeping = dev.status === 'Sleeping';
      const isOffline = dev.status === 'Offline';

      const idleMins = parseStopDurationMinutes(dev.stopDuration, dev.status, dev.currentSpeedKmh);
      const distFromDC = getDistanceFromCentralDC(dev.latitude, dev.longitude);
      const isIdleOrOff = isSleeping || dev.accStatus === 'OFF' || dev.currentSpeedKmh === 0;

      // CRITICAL RULE: Idle or OFF >= 60 mins AND Outside Gudang Pusat (> 1.5 km)
      const isWarningIdleOutsideDC = isIdleOrOff && idleMins >= 60 && distFromDC > 1.5;

      let statusBgClass = 'bg-emerald-500';
      let borderClass = 'border-emerald-400';
      let badgeBg = 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50';

      if (isWarningIdleOutsideDC) {
        statusBgClass = 'bg-rose-600 animate-pulse';
        borderClass = 'border-rose-500 ring-4 ring-rose-500/40';
        badgeBg = 'bg-rose-950 text-rose-200 border-rose-500 shadow-rose-500/20 animate-bounce';
      } else if (isSleeping) {
        statusBgClass = 'bg-amber-500';
        borderClass = 'border-amber-400';
        badgeBg = 'bg-amber-950/90 text-amber-300 border-amber-500/50';
      } else if (isOffline) {
        statusBgClass = 'bg-rose-500';
        borderClass = 'border-rose-400';
        badgeBg = 'bg-rose-950/90 text-rose-300 border-rose-500/50';
      }

      const isSelected = selectedDevice?.imei === dev.imei;

      const fleetIcon = L.divIcon({
        className: 'custom-fleet-marker',
        html: `
          <div class="relative flex flex-col items-center justify-center cursor-pointer group ${isSelected ? 'scale-110 z-30' : 'z-20'}">
            ${isWarningIdleOutsideDC ? `<div class="absolute -inset-3 rounded-full bg-rose-600/40 animate-ping"></div>` : isMoving ? `<div class="absolute -inset-2 rounded-full ${statusBgClass}/30 animate-ping"></div>` : ''}
            
            <div class="mb-1 ${badgeBg} px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border shadow-md flex items-center gap-1 whitespace-nowrap">
              ${isWarningIdleOutsideDC ? `<span class="text-rose-300 font-black">🚨 IDLE ${idleMins}m (${distFromDC}km dari DC)</span>` : `<span>${dev.vehiclePlate}</span>${isMoving ? `<span class="text-amber-300 font-extrabold ml-0.5">${dev.currentSpeedKmh}km/h</span>` : ''}`}
            </div>

            <div class="w-8 h-8 rounded-full bg-slate-900 ${borderClass} border-2 text-white flex items-center justify-center shadow-lg font-bold text-xs relative">
              <span className="text-sm">${isWarningIdleOutsideDC ? '⚠️' : '🚚'}</span>
              <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${statusBgClass} border border-slate-900"></span>
            </div>
          </div>
        `,
        iconSize: [120, 50],
        iconAnchor: [60, 38]
      });

      const marker = L.marker([dev.latitude, dev.longitude], { icon: fleetIcon });

      marker.on('click', () => {
        setSelectedDevice(dev);
        if (onSelectFleet) onSelectFleet(dev);
      });

      marker.bindPopup(`
        <div class="p-3 text-xs text-slate-100 font-sans max-w-xs space-y-2">
          ${isWarningIdleOutsideDC ? `
            <div class="p-2 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-200 font-bold text-[11px] flex items-center gap-1.5 animate-pulse">
              <span>⚠️ PERINGATAN: IDLE > 60 MNT DILUAR GUDANG PUSAT</span>
            </div>
          ` : ''}

          <div class="flex items-center justify-between border-b border-slate-700 pb-1.5">
            <div>
              <div class="font-mono font-black text-amber-400 text-sm">${dev.vehiclePlate}</div>
              <div class="text-[10px] text-slate-400 font-semibold">${dev.vehicleName || 'Truck Fleet'}</div>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeBg}">
              ${dev.status}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
            <div class="bg-slate-900 p-1.5 rounded border border-slate-800">
              <span class="text-slate-400 text-[9px] block">Driver Utama:</span>
              <strong class="text-white font-sans">${dev.driverName}</strong>
            </div>
            <div class="bg-slate-900 p-1.5 rounded border border-slate-800">
              <span class="text-slate-400 text-[9px] block">Durasi Diam:</span>
              <strong class="${isWarningIdleOutsideDC ? 'text-rose-400 font-bold' : 'text-emerald-400'}">${idleMins} MNT</strong>
            </div>
            <div class="bg-slate-900 p-1.5 rounded border border-slate-800">
              <span class="text-slate-400 text-[9px] block">Jarak dari Gudang DC:</span>
              <strong class="${distFromDC > 1.5 ? 'text-amber-300' : 'text-emerald-400'}">${distFromDC} KM</strong>
            </div>
            <div class="bg-slate-900 p-1.5 rounded border border-slate-800">
              <span class="text-slate-400 text-[9px] block">Kontak ACC:</span>
              <strong class="${dev.accStatus === 'ON' ? 'text-emerald-400' : 'text-slate-400'}">${dev.accStatus}</strong>
            </div>
          </div>

          <div class="text-[10px] text-slate-300 leading-snug pt-1">
            📍 <span class="font-mono">${dev.address}</span>
          </div>

          <div class="flex items-center justify-between text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-800">
            <span>GSM: ${dev.signalGsm}/5 | Bat: ${dev.batteryPercent}%</span>
            <span>Fix: ${dev.lastFix || 'Live'}</span>
          </div>
        </div>
      `);

      layerGroup.addLayer(marker);
    });
  }, [filteredDevices, selectedDevice, showRetailStores, stores, showIdleHeatmap, idleHotspots24h]);

  // Center map on all fleets bounds
  const fitAllFleets = () => {
    if (!mapInstanceRef.current || filteredDevices.length === 0) return;

    const validCoords: [number, number][] = filteredDevices
      .filter(d => d.latitude && d.longitude)
      .map(d => [d.latitude, d.longitude]);

    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  };

  // Center map on a specific device
  const focusDevice = (device: TracksolidDevice) => {
    setSelectedDevice(device);
    if (onSelectFleet) onSelectFleet(device);

    if (mapInstanceRef.current && device.latitude && device.longitude) {
      mapInstanceRef.current.setView([device.latitude, device.longitude], 14, { animate: true });
    }
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col relative ${isFullscreen ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)]' : className}`}>
      {/* 🚨 CRITICAL ALERT BANNER: ARMADA IDLE/OFF > 60 MNT DILUAR GUDANG PUSAT */}
      {idleOutsideDCAlerts.length > 0 && (
        <div className="bg-rose-950/95 border-b-2 border-rose-500 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg animate-pulse backdrop-blur">
          <div className="flex items-center gap-2.5 text-rose-200">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-extrabold text-white uppercase tracking-wider text-[11px] block">
                🚨 PERINGATAN OPERASIONAL DILUAR ZONA GUDANG PUSAT ({idleOutsideDCAlerts.length} ARMADA)
              </span>
              <span className="text-[11px] text-rose-300">
                Terdeteksi armada posisi idle / OFF &gt; 60 menit di luar area Gudang Pusat Banyuwangi DC.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {dismissedToastImeis.length > 0 && (
              <button
                onClick={() => setDismissedToastImeis([])}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                title="Tampilkan kembali notifikasi toast yang sebelumnya ditutup"
              >
                <Bell size={12} className="text-amber-400" />
                <span>Reset Toast ({dismissedToastImeis.length})</span>
              </button>
            )}

            <button
              onClick={() => {
                setStatusFilter('alert_idle_outside_dc');
                setShowWarningModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs border border-rose-400 shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Bell size={13} className="animate-bounce" />
              <span>Inspeksi {idleOutsideDCAlerts.length} Armada Violasi</span>
            </button>
          </div>
        </div>
      )}

      {/* Map Control Header Bar */}
      <div className="bg-slate-950/90 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>Fleet Live Map Telemetry (Tracksolid GPS)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                Peta Posisi Real-Time
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Sinkronisasi data otomatis dengan API Tracksolid setiap 5 menit • Lokasi armada di peta selalu akurat tanpa refresh manual
            </p>
          </div>
        </div>

        {/* Live Controls & Map Toolbar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* 🔥 24-HOUR IDLE HEATMAP TOGGLE BUTTON */}
          <button
            onClick={() => setShowIdleHeatmap(!showIdleHeatmap)}
            className={`px-3 py-1.5 rounded-xl font-bold border transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
              showIdleHeatmap
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-500/10'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Tampilkan / Sembunyikan Overlay Heatmap Kejadian Armada Idle 24 Jam Terakhir"
          >
            <Flame size={14} className={showIdleHeatmap ? 'text-rose-400' : 'text-slate-500'} />
            <span>Heatmap Idle (24 Jam): {showIdleHeatmap ? 'ON' : 'OFF'}</span>
          </button>

          {/* Map Layer Selector */}
          <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
            <button
              onClick={() => setTileProvider('dark')}
              className={`px-2 py-0.5 rounded transition cursor-pointer font-semibold ${
                tileProvider === 'dark' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setTileProvider('satellite')}
              className={`px-2 py-0.5 rounded transition cursor-pointer font-semibold ${
                tileProvider === 'satellite' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Satelit
            </button>
            <button
              onClick={() => setTileProvider('osm')}
              className={`px-2 py-0.5 rounded transition cursor-pointer font-semibold ${
                tileProvider === 'osm' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Street
            </button>
          </div>

          {/* Center All Fleets */}
          <button
            onClick={fitAllFleets}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1 cursor-pointer font-semibold"
            title="Pusatkan peta ke seluruh koordinat armada"
          >
            <Compass size={13} className="text-amber-400" />
            <span>Fit All</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
            title={isFullscreen ? 'Kecilkan Peta' : 'Layar Penuh'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* 📡 DEDICATED TRACKSOLID 5-MINUTE AUTO-SYNC STATUS & CONTROL BAR */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner">
        <div className="flex flex-wrap items-center gap-3">
          {/* Active Radar Status Pill */}
          <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-xs">
            <div className="relative flex items-center justify-center">
              <span className={`w-3 h-3 rounded-full ${
                !isOnline
                  ? 'bg-amber-400 opacity-60'
                  : syncState.isAutoSyncEnabled
                  ? 'bg-emerald-400 animate-ping opacity-75'
                  : 'bg-slate-500'
              }`} />
              <span className={`w-2 h-2 rounded-full absolute ${
                !isOnline
                  ? 'bg-amber-400'
                  : syncState.isAutoSyncEnabled
                  ? 'bg-emerald-500'
                  : 'bg-slate-400'
              }`} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-xs">Auto-Sync Tracksolid API:</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold uppercase border ${
                !isOnline
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs shadow-amber-500/20'
                  : syncState.isAutoSyncEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {!isOnline ? 'Dijeda (Offline)' : syncState.isAutoSyncEnabled ? 'Aktif (Tiap 5 Menit)' : 'Dijeda'}
              </span>
            </div>
          </div>

          {/* Countdown Clock to Next Automatic Sync or Offline Warning */}
          {!isOnline ? (
            <div className="flex items-center gap-2 bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-500/30 text-amber-300 font-mono shadow-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] text-amber-200 font-sans font-semibold">Pelacakan Real-Time Dijeda (Menunggu Internet)</span>
            </div>
          ) : syncState.isAutoSyncEnabled ? (
            <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-cyan-500/30 text-slate-300 font-mono shadow-xs">
              <Clock size={13} className="text-cyan-400 animate-pulse" />
              <span className="text-[11px] text-slate-400 font-sans">Sinkronisasi otomatis dalam:</span>
              <span className="text-cyan-300 font-bold text-xs bg-slate-950 px-2 py-0.5 rounded border border-cyan-500/40 tracking-wider">
                {tracksolidSyncService.formatCountdown(syncState.countdownSeconds)}
              </span>
            </div>
          ) : null}

          {/* Last Sync Info & Monitored Fleets */}
          <div className="hidden lg:flex items-center gap-2 text-slate-400 text-[11px]">
            <span>Terakhir disinkronkan:</span>
            <span className="text-slate-200 font-mono font-bold">{syncState.lastSyncTime || lastSyncTime} WIB</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-semibold">{devices.length} Armada Akurat</span>
            <span className="text-slate-500 text-[10px]">(Tanpa Refresh Halaman)</span>
          </div>
        </div>

        {/* Right Actions: Interval Selector & Manual Sync Now Button */}
        <div className="flex items-center gap-2">
          {/* Interval Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs">
            <span className="text-slate-400 text-[11px] font-medium">Interval:</span>
            <select
              value={syncState.isAutoSyncEnabled ? syncState.intervalSeconds : 0}
              onChange={(e) => handleIntervalSelect(parseInt(e.target.value, 10))}
              className="bg-transparent text-emerald-400 font-bold text-xs border-none outline-none cursor-pointer pr-1"
            >
              <option value={300} className="bg-slate-900 text-slate-100 font-medium">Setiap 5 Menit (Standar Tracksolid)</option>
              <option value={60} className="bg-slate-900 text-slate-100 font-medium">Setiap 1 Menit (Cepat)</option>
              <option value={180} className="bg-slate-900 text-slate-100 font-medium">Setiap 3 Menit</option>
              <option value={600} className="bg-slate-900 text-slate-100 font-medium">Setiap 10 Menit</option>
              <option value={0} className="bg-slate-900 text-slate-100 font-medium">Jeda Auto-Sync</option>
            </select>
          </div>

          {/* "Sinkronkan Sekarang" Button */}
          <button
            onClick={handleTriggerManualSync}
            disabled={syncState.isSyncing || isManualSyncing}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 text-xs ${
              syncState.isSyncing || isManualSyncing
                ? 'bg-blue-600/50 text-blue-200 cursor-not-allowed border border-blue-500/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 shadow-blue-500/20'
            }`}
            title="Sinkronkan posisi GPS seluruh armada langsung dengan API Tracksolid tanpa harus refresh browser"
          >
            <RefreshCw size={13} className={syncState.isSyncing || isManualSyncing ? 'animate-spin' : ''} />
            <span>{syncState.isSyncing || isManualSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
          </button>
        </div>
      </div>

      {/* 🟢 TOAST / BANNER NOTIFIKASI SINKRONISASI OTOMATIS BERHASIL */}
      {syncNotificationBanner && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/50 px-4 py-2 flex items-center justify-between text-xs text-emerald-200 animate-fadeIn backdrop-blur">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span className="font-semibold text-emerald-100">{syncNotificationBanner}</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-500/30">
            Peta Diperbarui Otomatis (Tanpa Refresh Halaman)
          </span>
        </div>
      )}

      {/* 🔥 24-Hour Idling Summary Banner Bar */}
      {showIdleHeatmap && (
        <div className="bg-slate-950/95 border-b border-rose-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs backdrop-blur">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-400 animate-pulse shrink-0" />
            <span className="font-bold text-white uppercase tracking-wider text-[11px]">
              Ringkasan Kejadian Armada Idle (24 Jam Terakhir):
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
              🔥 {aggregatedIdleMetrics.totalHotspots} Titik Kluster
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
              ⏱️ {aggregatedIdleMetrics.totalIdleHours} Jam Total Idle
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30">
              ⛽ ~{aggregatedIdleMetrics.totalFuelWasted} L Solar Terbuang
            </span>
          </div>
        </div>
      )}

      {/* Main Container: Map Canvas + Interactive Fleet Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 relative overflow-hidden">
        {/* Leaflet Map Canvas */}
        <div className="lg:col-span-8 relative min-h-[380px]">
          <div ref={mapContainerRef} className="w-full h-full min-h-[380px] z-10" />

          {/* Floating Map Legend Overlay */}
          <div className="absolute top-3 left-3 z-20 bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 text-[10px] space-y-1.5 font-mono shadow-xl backdrop-blur max-w-[210px]">
            <div className="font-bold text-slate-200 font-sans uppercase border-b border-slate-800 pb-1 flex items-center justify-between">
              <span>Legenda Posisi &amp; Warning</span>
              <button
                onClick={() => setShowRetailStores(!showRetailStores)}
                className={`text-[9px] px-1.5 py-0.2 rounded border ${showRetailStores ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
              >
                Toko: {showRetailStores ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-rose-400 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping border border-rose-300" />
              <span>🚨 Idle &gt;60m (Luar DC)</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Moving / Online (&gt;0 km/h)</span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Sleeping / Parkir Idle</span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-400 pt-0.5 border-t border-slate-800/80">
              <span>🏢 Gudang Pusat Banyuwangi DC</span>
            </div>
          </div>

          {/* Selected Hotspot Banner */}
          {selectedHotspot && showIdleHeatmap && (
            <div className="absolute top-3 right-3 z-20 bg-slate-950/95 border border-rose-500/50 rounded-xl p-3 shadow-2xl backdrop-blur max-w-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-rose-400">
                <span className="flex items-center gap-1">
                  <Flame size={14} />
                  <span>{selectedHotspot.locationName}</span>
                </span>
                <button
                  onClick={() => setSelectedHotspot(null)}
                  className="text-slate-400 hover:text-white font-bold px-1"
                >
                  ✕
                </button>
              </div>
              <div className="text-[11px] text-slate-300">
                Total Idle: <strong className="text-rose-300">{selectedHotspot.totalIdleHours} Jam</strong> | Solar: <strong className="text-amber-300">~{selectedHotspot.estimatedFuelWastedLiters} L</strong>
              </div>
            </div>
          )}

          {/* Selected Device Banner */}
          {selectedDevice && (
            <div className="absolute bottom-3 left-3 right-3 z-20 bg-slate-950/95 border border-emerald-500/40 rounded-xl p-3 shadow-2xl backdrop-blur flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                  🚚
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-white text-sm">{selectedDevice.vehiclePlate}</span>
                    <span className="text-[10px] bg-slate-900 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 font-mono font-bold">
                      {selectedDevice.currentSpeedKmh} KM/H
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Driver: <strong>{selectedDevice.driverName}</strong> | {selectedDevice.address}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => focusDevice(selectedDevice)}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer flex items-center gap-1 text-xs"
                >
                  <MapPin size={12} />
                  <span>Fokus Lokasi</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Fleets & Idle Hotspots Sidebar List */}
        <div className="lg:col-span-4 bg-slate-950 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col h-full max-h-[550px] overflow-hidden">
          {/* Sidebar Search & Status Filter */}
          <div className="p-3 border-b border-slate-800 space-y-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Cari Plat / Driver / IMEI..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px]">
              <button
                onClick={() => setStatusFilter('all')}
                className={`py-1 rounded-lg text-center transition font-semibold cursor-pointer ${
                  statusFilter === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Semua ({devices.length})
              </button>
              <button
                onClick={() => setStatusFilter('moving')}
                className={`py-1 rounded-lg text-center transition font-semibold cursor-pointer ${
                  statusFilter === 'moving' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Moving
              </button>
              <button
                onClick={() => setStatusFilter('sleeping')}
                className={`py-1 rounded-lg text-center transition font-semibold cursor-pointer ${
                  statusFilter === 'sleeping' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Idle
              </button>
              <button
                onClick={() => setStatusFilter('alert_idle_outside_dc')}
                className={`py-1 rounded-lg text-center transition font-bold cursor-pointer flex items-center justify-center gap-0.5 ${
                  statusFilter === 'alert_idle_outside_dc' 
                    ? 'bg-rose-600 text-white shadow-xs animate-pulse' 
                    : 'text-rose-400 hover:bg-rose-950/50'
                }`}
                title="Filter armada posisi idle/off > 60 mnt diluar gudang pusat"
              >
                <span>🚨 Warning</span>
                <span className="px-1 bg-rose-950 rounded-full text-[9px] border border-rose-400">
                  {idleOutsideDCAlerts.length}
                </span>
              </button>
            </div>
          </div>

          {/* Fleets List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 divide-y divide-slate-800/50">
            {filteredDevices.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                Tidak ada armada GPS yang cocok dengan kriteria pencarian.
              </div>
            ) : (
              filteredDevices.map(dev => {
                const isSelected = selectedDevice?.imei === dev.imei;
                const isMoving = dev.currentSpeedKmh > 0 || dev.accStatus === 'ON';
                const idleMins = parseStopDurationMinutes(dev.stopDuration, dev.status, dev.currentSpeedKmh);
                const distFromDC = getDistanceFromCentralDC(dev.latitude, dev.longitude);
                const isIdleOrOff = dev.status === 'Sleeping' || dev.accStatus === 'OFF' || dev.currentSpeedKmh === 0;
                const isViolatingDCIdle = isIdleOrOff && idleMins >= 60 && distFromDC > 1.5;

                return (
                  <div
                    key={dev.imei}
                    onClick={() => focusDevice(dev)}
                    className={`p-2.5 rounded-xl transition cursor-pointer border ${
                      isViolatingDCIdle
                        ? 'bg-rose-950/30 border-rose-500/80 hover:bg-rose-950/50 shadow-md'
                        : isSelected 
                        ? 'bg-slate-900 border-emerald-500/60 shadow-md' 
                        : 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono font-black text-white text-xs flex items-center gap-1.5">
                          <span>{dev.vehiclePlate}</span>
                          {isViolatingDCIdle && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-sans text-[9px] font-bold border border-rose-500/40">
                              ⚠️ IDLE {idleMins}m
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-300 font-medium mt-0.5">
                          {dev.driverName}
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono shrink-0 ${
                        isViolatingDCIdle
                          ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                          : dev.status === 'Online' 
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                          : dev.status === 'Sleeping'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}>
                        {isViolatingDCIdle ? `🚨 >60m Luar DC` : dev.status === 'Online' && isMoving ? `${dev.currentSpeedKmh} km/h` : dev.status}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 mt-1.5 truncate flex items-center gap-1">
                      <MapPin size={10} className="text-slate-500 shrink-0" />
                      <span className="truncate">{dev.address}</span>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono mt-2 pt-1.5 border-t border-slate-800/80">
                      <span>ACC: <strong className={dev.accStatus === 'ON' ? 'text-emerald-400' : 'text-slate-500'}>{dev.accStatus}</strong></span>
                      <span>Jarak DC: <strong className={distFromDC > 1.5 ? 'text-rose-400' : 'text-emerald-400'}>{distFromDC} km</strong></span>
                      <span>Bat: {dev.batteryPercent}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 🚨 FLOATING TOAST NOTIFICATIONS SYSTEM FOR IDLE/OFF > 60 MINS OUTSIDE CENTRAL WAREHOUSE PT AKK */}
      {activeToastAlerts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
          {activeToastAlerts.map(toast => (
            <div
              key={toast.device.imei}
              className="pointer-events-auto bg-slate-950/95 border-2 border-rose-500 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 fade-in duration-300 space-y-2 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600 animate-pulse" />

              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-400 flex items-center justify-center shrink-0">
                    <ShieldAlert size={18} className="animate-bounce" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-[11px] uppercase tracking-wider flex items-center gap-1">
                      <span>ALARM IDLE DILUAR GUDANG PT AKK</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
                        &gt;60m
                      </span>
                    </h4>
                    <p className="text-[11px] text-rose-300 font-mono font-bold mt-0.5">
                      {toast.device.vehiclePlate} ({toast.device.vehicleName || 'Truck Unit'})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setDismissedToastImeis(prev => [...prev, toast.device.imei])}
                  className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900 border border-slate-800 transition cursor-pointer"
                  title="Tutup Notifikasi Toast Ini"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="text-[10px] text-slate-300 space-y-1 bg-slate-900/80 p-2 rounded-xl border border-slate-800/80 font-sans">
                <div className="flex items-center justify-between">
                  <span>Driver: <strong className="text-white">{toast.driverName}</strong></span>
                  <span className="text-rose-400 font-mono font-bold">⏱️ {toast.idleMinutes} Mnt Idle</span>
                </div>
                <div className="text-slate-400 text-[10px] truncate flex items-center gap-1">
                  <MapPin size={10} className="text-rose-400 shrink-0" />
                  <span className="truncate">{toast.locationAddress}</span>
                </div>
                <div className="text-[10px] text-amber-300 font-mono">
                  📍 Jarak dari Gudang Pusat DC: <strong>{toast.distanceKmFromDC} KM</strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-0.5">
                <button
                  onClick={() => focusDevice(toast.device)}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <MapPin size={11} />
                  <span>Fokus Peta</span>
                </button>

                <button
                  onClick={() => {
                    window.alert(`Mengirim pesan WhatsApp peringatan darurat ke Driver ${toast.driverName} (${toast.device.vehiclePlate})...`);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <Phone size={11} />
                  <span>Hubungi Supir</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🚨 MODAL WARNING INSPEKSI IDLE/OFF > 60 MNT DILUAR GUDANG PUSAT */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border-2 border-rose-500 rounded-2xl max-w-3xl w-full p-5 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowWarningModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert size={22} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Audit Violasi Armada Idle &gt; 60 Menit Diluar Gudang Pusat</span>
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full font-mono font-bold border border-rose-500/40">
                    {idleOutsideDCAlerts.length} Kasus Terdeteksi
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Daftar armada aktif dengan posisi kunci kontak OFF / Idle &ge; 60 menit diluar zona Gudang Pusat Sukowidi DC (&gt;1,5 KM)
                </p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5 font-semibold">Armada &amp; Plat</th>
                    <th className="p-2.5 font-semibold">Driver Utama</th>
                    <th className="p-2.5 font-semibold">Durasi Diam</th>
                    <th className="p-2.5 font-semibold">Jarak dari DC</th>
                    <th className="p-2.5 font-semibold">Lokasi Terkini</th>
                    <th className="p-2.5 font-semibold text-center">Tindakan Dispatcher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {idleOutsideDCAlerts.map(alertItem => {
                    const isApproved = approvedAlertImeis.includes(alertItem.device.imei);

                    return (
                      <tr key={alertItem.device.imei} className="hover:bg-slate-800/50 transition">
                        <td className="p-2.5 font-mono">
                          <div className="font-bold text-white text-xs">{alertItem.device.vehiclePlate}</div>
                          <div className="text-[10px] text-slate-400">{alertItem.device.vehicleName || 'Truck Unit'}</div>
                        </td>
                        <td className="p-2.5 font-medium text-slate-200">
                          {alertItem.driverName}
                        </td>
                        <td className="p-2.5 font-mono">
                          <span className="px-2 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            {alertItem.idleMinutes} Mnt
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-amber-300 font-bold">
                          {alertItem.distanceKmFromDC} KM
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-300 max-w-xs truncate">
                          {alertItem.locationAddress}
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                focusDevice(alertItem.device);
                                setShowWarningModal(false);
                              }}
                              className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                              title="Pusatkan peta ke lokasi armada"
                            >
                              <MapPin size={10} />
                              <span>Lihat</span>
                            </button>

                            <button
                              onClick={() => {
                                window.alert(`Mengirim pesan WhatsApp darurat ke Driver ${alertItem.driverName}...`);
                              }}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                              title="Hubungi Driver"
                            >
                              <Phone size={10} />
                              <span>Hubungi</span>
                            </button>

                            <button
                              onClick={() => {
                                setApprovedAlertImeis(prev => [...prev, alertItem.device.imei]);
                              }}
                              disabled={isApproved}
                              className={`px-2 py-1 rounded-lg font-bold text-[10px] transition cursor-pointer flex items-center gap-1 ${
                                isApproved 
                                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed' 
                                  : 'bg-amber-600 hover:bg-amber-500 text-white'
                              }`}
                            >
                              <CheckCircle2 size={10} />
                              <span>{isApproved ? 'Disetujui' : 'Izinkan'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <p className="text-slate-400 text-[11px]">
                💡 <strong>Catatan Kebijakan:</strong> Armada yang berhenti &ge; 60m diluar Gudang Pusat tanpa izin tertulis akan secara otomatis dicatat dalam audit evaluasi kinerja pengemudi.
              </p>
              <button
                onClick={() => setShowWarningModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer"
              >
                Tutup Inspeksi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
