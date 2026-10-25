import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Send,
  Truck,
  RefreshCw,
  CameraOff,
  Coffee,
  FileText,
  Maximize2,
  Clock,
  LogOut,
  Play,
  Store
} from 'lucide-react';
import { Schedule } from '../types';
import { driverChecklistService } from '../services/driverChecklistService';
import { driverReportService, DriverHelperReport } from '../services/driverReportService';
import { driverWaybillService } from '../services/driverWaybillService';
import { logisticsStore } from '../services/store';

export type GmapsReportCategory = 'kendala_jalan' | 'akhir_kiriman' | 'istirahat' | 'update_lokasi';

interface DriverGmapsShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveries: Schedule[];
  driverName?: string;
  plateNumber?: string;
  driverId?: string;
  onReportSubmitted: (report: {
    category: GmapsReportCategory;
    delivery: Schedule | null;
    notes: string;
    photoUrl: string | null;
    distanceMeters: number | null;
    isWithinRadius: boolean;
    driverLat: number;
    driverLng: number;
    gmapsUrl: string;
    plateNumber: string;
    areaName: string;
  }) => void;
}

export const DriverGmapsShareModal: React.FC<DriverGmapsShareModalProps> = ({
  isOpen,
  onClose,
  deliveries,
  driverName = 'Supir AKK',
  plateNumber = 'P 8125 VC',
  driverId,
  onReportSubmitted
}) => {
  const [category, setCategory] = useState<GmapsReportCategory>('kendala_jalan');
  const [reportSubMode, setReportSubMode] = useState<'kendala_umum' | 'antri_customer'>('kendala_umum');
  const [notes, setNotes] = useState<string>('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isFullPhotoPreviewOpen, setIsFullPhotoPreviewOpen] = useState<boolean>(false);

  // State Fitur Baru: Kendala Sedang Mengantri di Customer -> Selang Beberapa Menit Baru Keluar dari Customer
  const [activeQueueReport, setActiveQueueReport] = useState<DriverHelperReport | null>(null);
  const [customerOutletInput, setCustomerOutletInput] = useState<string>('');
  const [simulatedExtraMin, setSimulatedExtraMin] = useState<number>(0);
  const [elapsedQueueSeconds, setElapsedQueueSeconds] = useState<number>(0);
  const [queueCompletedToast, setQueueCompletedToast] = useState<string | null>(null);

  // Live Camera Stream State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Otomatis terisi nomor kendaraan sesuai data checklist
  const [autoPlateNumber, setAutoPlateNumber] = useState<string>(plateNumber);

  // Lookup inisial armada dari master data
  const fleets = logisticsStore.getFleets();
  const matchedFleet = fleets.find(f =>
    f.plateNumber.replace(/\s+/g, '').toUpperCase() === (autoPlateNumber || '').replace(/\s+/g, '').toUpperCase()
  );
  const fleetInitial = matchedFleet?.initialCode || (autoPlateNumber.includes('8848') ? 'ES-03' : autoPlateNumber.includes('8125') ? 'N1 / NP1' : autoPlateNumber.includes('8509') ? 'A3 / NP3' : undefined);

  // GPS Coordinates (Direkam otomatis di background untuk sistem)
  const [driverLat, setDriverLat] = useState<number>(-8.2190);
  const [driverLng, setDriverLng] = useState<number>(114.3680);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Otomatis pilih jadwal / Surat Jalan Keluar yang sedang aktif hari ini (tanpa scrolldown manual)
  const todayStr = new Date().toISOString().split('T')[0];
  const activeDelivery: Schedule | null = React.useMemo(() => {
    if (!deliveries || deliveries.length === 0) return null;
    const inTransit = deliveries.find(d => d.status === 'in_transit' || d.status === 'picked_up');
    if (inTransit) return inTransit;
    const todayMatch = deliveries.find(d => d.departureDate <= todayStr && d.status !== 'delivered');
    if (todayMatch) return todayMatch;
    return deliveries[0];
  }, [deliveries, todayStr]);

  const activeWaybill = React.useMemo(() => {
    if (!activeDelivery) return null;
    try {
      return driverWaybillService.getWaybillForSchedule(activeDelivery);
    } catch {
      return null;
    }
  }, [activeDelivery]);

  const currentAreaName = React.useMemo(() => {
    if (activeWaybill?.destination) {
      const area = activeWaybill.destination.areaName || activeWaybill.destination.storeName;
      const city = activeWaybill.destination.city ? ` (${activeWaybill.destination.city})` : '';
      return `${area}${city}`;
    }
    if (activeDelivery) {
      const area = activeDelivery.areaName || activeDelivery.store?.storeName || 'Area Pengiriman';
      const city = activeDelivery.store?.city ? ` (${activeDelivery.store.city})` : '';
      return `${area}${city}`;
    }
    return 'Sesuai Surat Jalan Keluar Aktif';
  }, [activeWaybill, activeDelivery]);

  const currentWaybillNo = activeWaybill?.waybillNumber || activeDelivery?.trackingNumber || 'SJ-OUT/AKK/AKTIF';

  // Cek apakah ada antrean customer yang sedang aktif untuk kru ini
  const refreshActiveQueue = () => {
    const allReports = driverReportService.getReports();
    const found = allReports.find(
      r =>
        r.customerQueueStatus === 'sedang_mengantri' &&
        ((driverId && r.driverId === driverId) ||
          r.driverName.toLowerCase() === (driverName || '').toLowerCase() ||
          r.plateNumber === autoPlateNumber)
    );
    setActiveQueueReport(found || null);
    if (found) {
      setCategory('kendala_jalan');
      setReportSubMode('antri_customer');
      if (found.customerOutletName) {
        setCustomerOutletInput(found.customerOutletName);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setQueueCompletedToast(null);
      try {
        const checklists = driverChecklistService.getChecklists();
        const activeChecklist = driverId
          ? checklists.find(c => c.driverId === driverId)
          : checklists[0];
        if (activeChecklist?.plateNumber) {
          setAutoPlateNumber(activeChecklist.plateNumber);
        } else if (plateNumber) {
          setAutoPlateNumber(plateNumber);
        }
      } catch {
        setAutoPlateNumber(plateNumber);
      }

      if (!customerOutletInput) {
        setCustomerOutletInput(currentAreaName);
      }

      refreshActiveQueue();

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setDriverLat(pos.coords.latitude);
            setDriverLng(pos.coords.longitude);
          },
          () => {
            setDriverLat(-8.2190);
            setDriverLng(114.3680);
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }
    } else {
      stopLiveCamera();
    }
  }, [isOpen, driverId, plateNumber, currentAreaName]);

  // Timer detikan real-time selama kru sedang mengantri di customer
  useEffect(() => {
    if (!activeQueueReport) {
      setElapsedQueueSeconds(0);
      return;
    }
    const startMs = activeQueueReport.customerQueueStartIso
      ? new Date(activeQueueReport.customerQueueStartIso).getTime()
      : new Date(activeQueueReport.timestamp).getTime();

    const updateTimer = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setElapsedQueueSeconds(diffSec);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeQueueReport]);

  const totalQueueMinutesDisplay = Math.max(1, Math.floor(elapsedQueueSeconds / 60) + simulatedExtraMin);

  // Mulai Mengantri di Customer
  const handleStartQueueAtCustomer = () => {
    const outletName = customerOutletInput.trim() || currentAreaName;
    const created = driverReportService.startCustomerQueueReport({
      driverId: driverId || 'crew-driver',
      driverName,
      plateNumber: autoPlateNumber,
      areaName: currentAreaName,
      customerOutletName: outletName,
      deliveryId: activeDelivery?.id,
      notes: notes.trim() || `Sedang mengantri bongkar muatan di customer (${outletName})`,
      photoUrl: photoDataUrl,
      latitude: driverLat,
      longitude: driverLng,
      gmapsUrl: gmapsLink
    });
    setActiveQueueReport(created);
    setSimulatedExtraMin(0);
    setQueueCompletedToast(null);
  };

  // Selesai Mengantri & Keluar dari Customer (Selang Beberapa Menit)
  const handleExitCustomerQueue = () => {
    if (!activeQueueReport) return;
    const completed = driverReportService.completeCustomerQueueExit({
      reportId: activeQueueReport.id,
      driverId: driverId || 'crew-driver',
      driverName,
      simulatedExtraMinutes: simulatedExtraMin,
      exitNotes: notes.trim()
    });

    if (completed) {
      setActiveQueueReport(null);
      setSimulatedExtraMin(0);
      setQueueCompletedToast(
        `Tercatat! Kru keluar dari customer pukul ${completed.customerQueueExitFormatted} (Selang antri: ${completed.customerQueueDurationMinutes} menit).`
      );
      onReportSubmitted({
        category: 'kendala_jalan',
        delivery: activeDelivery,
        notes: completed.notes,
        photoUrl: completed.photoUrl || photoDataUrl,
        distanceMeters: null,
        isWithinRadius: true,
        driverLat,
        driverLng,
        gmapsUrl: gmapsLink,
        plateNumber: autoPlateNumber,
        areaName: currentAreaName
      });
    }
  };

  // Automatically attach stream to video element when camera is active
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.muted = true;
      videoRef.current.play().catch(pErr => {
        console.warn('[DriverGmaps] video.play error:', pErr);
      });
    }
  }, [isCameraActive]);

  const startLiveCamera = async (mode: 'environment' | 'user' = facingMode) => {
    stopLiveCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('NOT_SUPPORTED');
      }

      let stream: MediaStream | null = null;
      let lastErr: unknown = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (e1) {
        lastErr = e1;
      }

      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode },
            audio: false
          });
        } catch (e2) {
          lastErr = e2;
        }
      }

      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (e3) {
          lastErr = e3;
        }
      }

      if (!stream) {
        throw lastErr || new Error('Tidak dapat membuka stream video.');
      }

      streamRef.current = stream;
      setIsCameraActive(true);
      setCameraError(null);
    } catch (err: unknown) {
      const errName = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : String(err);

      try {
        logisticsStore.logActivity(
          'Akses Kamera Ditolak',
          driverName || 'Driver Operasional',
          `Kendala Gmaps/Rute Kamera (${errName || 'Error'}): ${msg} [Plat: ${autoPlateNumber}]`
        );
      } catch {
        // ignore
      }

      // Jika kamera WebRTC ditolak, otomatis buka input kamera perangkat
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      } else {
        setCameraError('Akses kamera terkendala izin perangkat. Silakan izinkan akses kamera pada browser Anda.');
      }
    }
  };

  const handleFlipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startLiveCamera(nextMode);
  };

  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Watermark stamper helper
  const applyWatermarkToCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    const bannerHeight = Math.max(90, Math.floor(h * 0.17));
    const bannerY = h - bannerHeight;

    const grad = ctx.createLinearGradient(0, bannerY, 0, h);
    grad.addColorStop(0, 'rgba(2, 6, 23, 0.90)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, bannerY, w, bannerHeight);

    ctx.fillStyle = category === 'kendala_jalan' ? '#f43f5e' : category === 'akhir_kiriman' ? '#10b981' : '#f59e0b';
    ctx.fillRect(0, bannerY, w, 4);

    const fontSize = Math.max(12, Math.floor(w * 0.024));
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#38bdf8';
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    const titleTag =
      category === 'kendala_jalan' && reportSubMode === 'antri_customer'
        ? '⏳ ANTRI DI CUSTOMER'
        : category === 'kendala_jalan'
        ? '⚠️ KENDALA DI JALAN'
        : category === 'akhir_kiriman'
        ? '📦 AKHIR KIRIMAN (POD)'
        : '☕ LAPORAN ISTIRAHAT KRU';
    ctx.fillText(`${titleTag} • PT ANUGRAH KEMASAN KREATIF`, 16, bannerY + 10);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize - 1}px system-ui, sans-serif`;
    const initialText = fleetInitial ? ` [${fleetInitial}]` : '';
    ctx.fillText(`Area: ${currentAreaName} | Driver: ${driverName} [${autoPlateNumber}${initialText}]`, 16, bannerY + 12 + fontSize);

    const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
    ctx.fillStyle = '#f59e0b';
    ctx.font = `bold ${fontSize - 2}px monospace`;
    ctx.fillText(`🕒 ${nowStr} | 📍 GPS: ${driverLat.toFixed(5)}, ${driverLng.toFixed(5)}`, 16, bannerY + 14 + (fontSize * 2));

    const stampedUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoDataUrl(stampedUrl);
  };

  const captureLivePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopLiveCamera();
    applyWatermarkToCanvas(canvas);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCapturing(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          applyWatermarkToCanvas(canvas);
        }
        setIsCapturing(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const gmapsLink = `https://www.google.com/maps?q=${driverLat},${driverLng}`;

  const getWhatsAppShareText = () => {
    const categoryLabel =
      category === 'kendala_jalan' && reportSubMode === 'antri_customer'
        ? '⏳ LAPORAN ANTRI DI CUSTOMER'
        : category === 'kendala_jalan'
        ? '🚨 LAPORAN KENDALA DI JALAN'
        : category === 'akhir_kiriman'
        ? '📦 LAPORAN AKHIR KIRIMAN (SELESAI BONGKAR)'
        : '📍 UPDATE TITIK LOKASI GMAPS';

    return encodeURIComponent(
      `*${categoryLabel}*\n` +
      `*Driver:* ${driverName}\n` +
      `*Armada:* ${autoPlateNumber}${fleetInitial ? ` [Inisial: ${fleetInitial}]` : ''}\n` +
      `*Area Kirim (Surat Jalan):* ${currentAreaName}\n` +
      `*No. Surat Jalan:* ${currentWaybillNo}\n` +
      `*Keterangan:* ${notes || 'Dokumentasi terlampir'}\n` +
      `*Titik Google Maps:* ${gmapsLink}\n` +
      `*Waktu:* ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`
    );
  };

  const handleShareWhatsApp = () => {
    const waUrl = `https://wa.me/?text=${getWhatsAppShareText()}`;
    window.open(waUrl, '_blank');
  };

  const handleSubmit = () => {
    if (category === 'kendala_jalan' && reportSubMode === 'antri_customer') {
      if (!activeQueueReport) {
        handleStartQueueAtCustomer();
        return;
      } else {
        handleExitCustomerQueue();
        return;
      }
    }

    driverReportService.addReport({
      driverId: driverId || 'crew-driver',
      driverName: driverName,
      plateNumber: autoPlateNumber,
      category,
      areaName: currentAreaName,
      deliveryId: activeDelivery?.id,
      notes: notes || (category === 'akhir_kiriman' ? 'Selesai serah terima di area tujuan' : 'Dokumentasi pengiriman'),
      photoUrl: photoDataUrl,
      latitude: driverLat,
      longitude: driverLng,
      gmapsUrl: gmapsLink
    });

    onReportSubmitted({
      category,
      delivery: activeDelivery,
      notes,
      photoUrl: photoDataUrl,
      distanceMeters: null,
      isWithinRadius: true,
      driverLat,
      driverLng,
      gmapsUrl: gmapsLink,
      plateNumber: autoPlateNumber,
      areaName: currentAreaName
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* LIVE CAMERA OVERLAY WHEN TAKING PHOTO */}
      {isCameraActive && (
        <div className="fixed inset-0 z-[80] w-screen h-screen bg-black flex flex-col justify-between p-0 animate-in fade-in duration-150">
          {/* Top Camera Bar */}
          <div className="p-4 bg-gradient-to-b from-black/90 to-transparent flex items-center justify-between z-20">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <div>
                <div className="text-xs font-black text-white">
                  KAMERA • {category === 'kendala_jalan' && reportSubMode === 'antri_customer' ? 'ANTRI CUSTOMER' : category === 'kendala_jalan' ? 'KENDALA JALAN' : category === 'akhir_kiriman' ? 'AKHIR KIRIMAN' : 'ISTIRAHAT'}
                </div>
                <div className="text-[10px] text-amber-300 font-mono">
                  Area: {currentAreaName} ({autoPlateNumber})
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFlipCamera}
                className="p-2.5 rounded-full bg-slate-800/90 text-white hover:bg-slate-700 cursor-pointer"
                title="Balik Kamera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={stopLiveCamera}
                className="p-2.5 rounded-full bg-rose-600/90 text-white hover:bg-rose-500 cursor-pointer"
                title="Tutup Kamera"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Video Viewfinder */}
          <div className="flex-1 relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-6 pointer-events-none border border-white/25 rounded-2xl flex flex-col justify-between p-3">
              <div className="flex justify-between">
                <div className="w-6 h-6 border-t-2 border-l-2 border-amber-400" />
                <div className="w-6 h-6 border-t-2 border-r-2 border-amber-400" />
              </div>
              <div className="flex justify-between">
                <div className="w-6 h-6 border-b-2 border-l-2 border-amber-400" />
                <div className="w-6 h-6 border-b-2 border-r-2 border-amber-400" />
              </div>
            </div>
          </div>

          {/* Bottom Shutter Bar */}
          <div className="p-6 bg-gradient-to-t from-black via-black/90 to-transparent flex items-center justify-center gap-8 px-8 z-20">
            <button
              type="button"
              onClick={captureLivePhoto}
              className="w-20 h-20 rounded-full border-4 border-white p-1.5 flex items-center justify-center shadow-2xl active:scale-90 transition cursor-pointer"
            >
              <div className="w-full h-full rounded-full bg-amber-500 hover:bg-amber-400 flex items-center justify-center text-slate-950">
                <Camera className="w-8 h-8" />
              </div>
            </button>

            <button
              type="button"
              onClick={stopLiveCamera}
              className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700 cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* PHOTO PREVIEW MODAL */}
      {isFullPhotoPreviewOpen && photoDataUrl && (
        <div
          className="fixed inset-0 z-[85] w-screen h-screen bg-black/95 flex flex-col justify-between p-4 animate-in fade-in duration-150"
          onClick={() => setIsFullPhotoPreviewOpen(false)}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700">
              Pratinjau Foto Bukti
            </span>
            <button
              type="button"
              onClick={() => setIsFullPhotoPreviewOpen(false)}
              className="p-2.5 rounded-full bg-rose-600 text-white font-bold cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden my-2">
            <img
              src={photoDataUrl}
              alt="Bukti"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="text-center text-xs text-slate-300 pb-2">
            Ketuk di mana saja untuk menutup tampilan
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
          
          {/* Header - High Contrast */}
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md font-black shrink-0">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">
                  Lapor Kendala &amp; Istirahat Kru
                </h3>
                <p className="text-[11px] text-slate-300 font-medium">
                  Dokumentasi kendala jalan, antri di customer, dan waktu istirahat kru
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            
            {/* Category Selector Tabs: Kendala Jalan, Antri di Customer, Istirahat */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Pilih Jenis Laporan:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCategory('kendala_jalan');
                    setReportSubMode('kendala_umum');
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    category === 'kendala_jalan' && reportSubMode === 'kendala_umum'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Kendala Jalan</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCategory('kendala_jalan');
                    setReportSubMode('antri_customer');
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer relative ${
                    category === 'kendala_jalan' && reportSubMode === 'antri_customer'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Antri Customer</span>
                  {activeQueueReport && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-1.5 right-1.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCategory('istirahat');
                    setReportSubMode('kendala_umum');
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    category === 'istirahat' || category === 'update_lokasi'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Istirahat</span>
                </button>
              </div>
            </div>

            {/* ⏳ FITUR BARU: KENDALA SEDANG MENGANTRI DI CUSTOMER -> SELANG BEBERAPA MENIT BARU KELUAR DARI CUSTOMER */}
            {category === 'kendala_jalan' && (
              <div className={`p-3.5 rounded-2xl border space-y-3 transition ${
                activeQueueReport
                  ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                  : reportSubMode === 'antri_customer'
                  ? 'bg-slate-950 border-cyan-500/50'
                  : 'bg-slate-950/80 border-slate-800'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${
                      activeQueueReport
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 animate-pulse'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    }`}>
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-black text-white text-xs flex items-center gap-1.5">
                        <span>Status Antrean Bongkar di Customer</span>
                        {activeQueueReport && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white animate-pulse">
                            SEDANG MENGANTRI
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Catat waktu mulai mengantri di customer hingga selang beberapa menit keluar dari customer
                      </p>
                    </div>
                  </div>
                </div>

                {/* Input Nama Customer / Toko */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400">
                    Nama Customer / Toko Tempat Mengantri:
                  </label>
                  <input
                    type="text"
                    value={customerOutletInput}
                    onChange={(e) => setCustomerOutletInput(e.target.value)}
                    placeholder={currentAreaName}
                    disabled={Boolean(activeQueueReport)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-cyan-500 disabled:opacity-75"
                  />
                </div>

                {queueCompletedToast && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{queueCompletedToast}</span>
                  </div>
                )}

                {activeQueueReport ? (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-cyan-500/30">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Mulai Mengantri:</span>
                        <span className="font-mono font-black text-amber-300 text-xs">
                          {activeQueueReport.customerQueueStartFormatted}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Selang Waktu Antri:</span>
                        <span className="font-mono font-black text-cyan-300 text-xs">
                          {totalQueueMinutesDisplay} Menit ({elapsedQueueSeconds % 60} dtk)
                        </span>
                      </div>
                    </div>

                    {/* Simulasi Tambah Selang Menit agar mudah ditrial langsung */}
                    <div className="flex items-center justify-between gap-2 bg-slate-900/90 px-2.5 py-2 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-300 font-semibold">
                        Simulasi Selang Menit Keluar:
                      </span>
                      <div className="flex items-center gap-1">
                        {[5, 15, 30].map((minVal) => (
                          <button
                            key={minVal}
                            type="button"
                            onClick={() => setSimulatedExtraMin(prev => prev + minVal)}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold cursor-pointer transition"
                          >
                            +{minVal}m
                          </button>
                        ))}
                        {simulatedExtraMin > 0 && (
                          <button
                            type="button"
                            onClick={() => setSimulatedExtraMin(0)}
                            className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-[10px] font-bold cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleExitCustomerQueue}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Selesai Antri &amp; Keluar dari Customer ({totalQueueMinutesDisplay} Menit)</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartQueueAtCustomer}
                    className="w-full py-2.5 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-black text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Mulai Mengantri di Customer Sekarang</span>
                  </button>
                )}
              </div>
            )}

            {/* Nomor Kendaraan Armada (Otomatis Terkunci Sesuai Pilihan Armada Setelah Check-In) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Nomor Kendaraan Armada:</span>
                <span className="text-[10px] text-emerald-400 font-bold">✓ Terkunci Otomatis Sesuai Check-In</span>
              </label>
              <div className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2.5 text-xs flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span className="font-mono font-bold text-amber-400 text-sm">{autoPlateNumber}</span>
                  {fleetInitial && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[11px] font-black">
                      Inisial: {fleetInitial}
                    </span>
                  )}
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                  Terkunci Otomatis
                </span>
              </div>
            </div>

            {/* NAMA AREA KIRIM (OTOMATIS SESUAI SURAT JALAN KELUAR - TANPA SCROLLDOWN) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Nama Area Kirim:</span>
                <span className="text-[10px] text-emerald-400 font-bold">✓ Otomatis sesuai Surat Jalan Keluar</span>
              </label>
              <div className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2.5 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-white text-xs truncate">
                      {currentAreaName}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                      <FileText className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>No. SJ: {currentWaybillNo}</span>
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold shrink-0">
                  Terkunci Otomatis
                </span>
              </div>
            </div>

            {/* Photo Capture & Upload Section (Tanpa Kata Full Screen & Tanpa Fitur Alternatif Buka Kamera) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Unggah Foto Bukti (Kamera):
                </label>
                {photoDataUrl && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startLiveCamera()}
                      className="text-[10px] text-amber-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Buka Kamera</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Hidden Native Device Camera Trigger */}
              <input
                type="file"
                ref={cameraInputRef}
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              {/* Hidden Gallery / File Picker */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              {/* ERROR ALERT IF CAMERA PERMISSION DENIED */}
              {cameraError && !isCameraActive && (
                <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <CameraOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed flex-1">
                      <span className="font-bold text-white block">Akses Kamera Perangkat Terkendala</span>
                      {cameraError}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
                    <button
                      type="button"
                      onClick={() => startLiveCamera()}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer hover:bg-amber-400 active:scale-95 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Buka Kamera</span>
                    </button>
                  </div>
                </div>
              )}

              {photoDataUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-black shadow-lg group">
                  <img
                    src={photoDataUrl}
                    alt="Foto Bukti"
                    onClick={() => setIsFullPhotoPreviewOpen(true)}
                    className="w-full max-h-64 object-contain bg-black cursor-pointer"
                  />
                  <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-emerald-400 font-bold flex items-center gap-1 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Foto Berstempel Siap Kirim</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFullPhotoPreviewOpen(true)}
                    className="absolute top-2 right-2 bg-black/80 hover:bg-black text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-white/20 cursor-pointer"
                  >
                    <Maximize2 className="w-3 h-3 text-amber-400" />
                    <span>Perbesar</span>
                  </button>
                  <div className="p-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400">Ketuk gambar untuk memperbesar</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startLiveCamera()}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-[10px] border border-amber-500/30 cursor-pointer flex items-center gap-1"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Buka Kamera</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => startLiveCamera()}
                    disabled={isCapturing}
                    className="w-full p-4 rounded-2xl border-2 border-dashed border-amber-500/70 hover:border-amber-400 bg-amber-500/10 hover:bg-amber-500/15 flex items-center justify-center gap-3 cursor-pointer transition text-center group active:scale-95 shadow-lg shadow-amber-500/10"
                  >
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-110 transition shrink-0">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <div className="font-black text-white text-sm">
                        Buka Kamera
                      </div>
                      <div className="text-[11px] text-amber-400 font-medium mt-0.5">
                        Ambil foto bukti berstempel resmi operasional
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Notes Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Keterangan / Catatan Laporan:
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  category === 'kendala_jalan' && reportSubMode === 'antri_customer'
                    ? 'Contoh: Sedang mengantri bongkar di gudang customer karena ada 2 armada di depan...'
                    : category === 'kendala_jalan'
                    ? 'Contoh: Macet perbaikan jalan di jalur Rogojampi, perkiraan keterlambatan 25 menit...'
                    : category === 'akhir_kiriman'
                    ? 'Contoh: Muatan diterima lengkap di gudang toko dalam keadaan baik...'
                    : 'Contoh: Istirahat makan siang & ibadah di SPBU / Rest Area selama 30 menit...'
                }
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-500"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md cursor-pointer"
              title="Bagikan format laporan & link koordinat ke grup WhatsApp"
            >
              <Share2 className="w-4 h-4" />
              <span>Bagikan WA</span>
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {category === 'kendala_jalan' && reportSubMode === 'antri_customer'
                  ? activeQueueReport
                    ? 'Selesai & Keluar Customer'
                    : 'Mulai Antri Customer'
                  : 'Simpan Laporan'}
              </span>
            </button>
          </div>

        </div>
      </div>
    </>
  );
};
