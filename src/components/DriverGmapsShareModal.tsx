import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Navigation,
  Send,
  Truck,
  Check,
  Building2,
  RefreshCw,
  CameraOff,
  Coffee
} from 'lucide-react';
import { Schedule } from '../types';
import { driverChecklistService } from '../services/driverChecklistService';
import { driverReportService } from '../services/driverReportService';
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
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Live Camera Stream State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
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

  useEffect(() => {
    if (isOpen) {
      // 1. Ambil nomor kendaraan otomatis sesuai data checklist terbaru
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

      // 2. Auto-select area kirim pertama jika tersedia
      if (deliveries.length > 0 && !selectedDeliveryId) {
        setSelectedDeliveryId(deliveries[0].id);
      }

      // 3. Rekam koordinat GPS di background
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
  }, [isOpen, deliveries, driverId, plateNumber]);

  // Selected delivery object
  const selectedDelivery = deliveries.find(d => d.id === selectedDeliveryId) || null;
  const currentAreaName = selectedDelivery 
    ? `${selectedDelivery.areaName || selectedDelivery.store?.storeName || 'Area Pengiriman'}${selectedDelivery.store?.city ? ` (${selectedDelivery.store.city})` : ''}`
    : 'Laporan Umum (Rute Perjalanan)';

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

  // Start live webcam / mobile camera stream with auto-fallbacks
  const startLiveCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('NOT_SUPPORTED');
      }
      
      let stream: MediaStream | null = null;
      let lastErr: unknown = null;

      // Tier 1: Try mobile back camera with ideal HD
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (e1) {
        lastErr = e1;
        console.warn('[DriverGmaps] Tier 1 camera constraint failed:', e1);
      }

      // Tier 2: Try simple facingMode environment
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
          });
        } catch (e2) {
          lastErr = e2;
          console.warn('[DriverGmaps] Tier 2 facingMode failed:', e2);
        }
      }

      // Tier 3: Fallback for laptop / desktop webcams or any video source
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (e3) {
          lastErr = e3;
          console.warn('[DriverGmaps] Tier 3 basic video failed:', e3);
        }
      }

      if (!stream) {
        throw lastErr || new Error('Tidak dapat membuka stream video.');
      }

      streamRef.current = stream;
      setIsCameraActive(true);
      setCameraError(null);
    } catch (err: unknown) {
      console.warn('[DriverGmaps] Live camera access error:', err);
      const errName = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : String(err);

      // Log camera error to Firebase / logisticsStore activity log in real-time
      try {
        logisticsStore.logActivity(
          'Akses Kamera Ditolak',
          driverName || 'Driver Operasional',
          `Kendala Gmaps/Rute Kamera (${errName || 'Error'}): ${msg} [Plat: ${autoPlateNumber}]`
        );
      } catch (logErr) {
        console.warn('Failed to log camera error to store:', logErr);
      }

      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        msg.includes('Permission') ||
        msg.includes('denied') ||
        msg.includes('NotAllowedError') ||
        msg.includes('SecurityError')
      ) {
        setCameraError('Akses kamera ditolak oleh Perangkat / OS. Buka Pengaturan HP (Settings -> Apps -> Browser -> Permissions -> Kamera) dan pilih "Izinkan", atau gunakan tombol "Kamera Bawaan HP" di bawah.');
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError' || msg.includes('NotFound')) {
        setCameraError('Hardware kamera tidak ditemukan. Silakan gunakan tombol "Kamera Bawaan HP".');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError' || msg.includes('NotReadable')) {
        setCameraError('Kamera sedang digunakan aplikasi lain. Silakan gunakan tombol "Kamera Bawaan HP".');
      } else {
        setCameraError('Kamera tidak dapat dimulai otomatis. Anda dapat mengetuk tombol Kamera Bawaan HP di bawah.');
      }
    }
  };

  // Trigger native camera synchronously on user gesture
  const openDeviceCameraNative = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const openDeviceCamera = () => {
    startLiveCamera();
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

    // Accent line
    ctx.fillStyle = category === 'kendala_jalan' ? '#f43f5e' : category === 'akhir_kiriman' ? '#10b981' : '#f59e0b';
    ctx.fillRect(0, bannerY, w, 4);

    const fontSize = Math.max(12, Math.floor(w * 0.024));
    ctx.textBaseline = 'top';

    // Line 1: Header
    ctx.fillStyle = '#38bdf8';
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    const titleTag = category === 'kendala_jalan' 
      ? '⚠️ KENDALA DI JALAN' 
      : category === 'akhir_kiriman' 
      ? '📦 AKHIR KIRIMAN (POD)' 
      : '☕ LAPORAN ISTIRAHAT KRU';
    ctx.fillText(`${titleTag} • PT ANUGRAH KEMASAN KREATIF`, 16, bannerY + 10);

    // Line 2: Nama Area Kirim, Nomor Kendaraan & Inisial Armada
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize - 1}px system-ui, sans-serif`;
    const initialText = fleetInitial ? ` [${fleetInitial}]` : '';
    ctx.fillText(`Area: ${currentAreaName} | Driver: ${driverName} [${autoPlateNumber}${initialText}]`, 16, bannerY + 12 + fontSize);

    // Line 3: Waktu & GPS
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

  // Handle Photo File Upload
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

  // Generate a verified sample proof photo if device camera hardware is unavailable
  const useSampleProofPhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bgGrad = ctx.createLinearGradient(0, 0, 1000, 700);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1000, 700);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 40; i < 1000; i += 60) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 700);
      ctx.stroke();
    }
    for (let j = 40; j < 700; j += 60) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(1000, j);
      ctx.stroke();
    }

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, 920, 500);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DOKUMENTASI PENGIRIMAN & BUKTI FISIK', 500, 180);

    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('PT ANUGRAH KEMASAN KREATIF • LOGISTIK BANYUWANGI', 500, 230);

    ctx.font = '16px monospace';
    ctx.fillStyle = '#fde047';
    ctx.fillText(`ARMADA: ${autoPlateNumber} ${fleetInitial ? `[INISIAL: ${fleetInitial}]` : ''}`, 500, 290);
    ctx.fillText(`DRIVER: ${driverName} | AREA: ${currentAreaName}`, 500, 330);
    ctx.fillText(`STATUS: ${category === 'kendala_jalan' ? 'KENDALA JALAN' : category === 'akhir_kiriman' ? 'AKHIR KIRIMAN (SELESAI)' : 'UPDATE LOKASI GMAPS'}`, 500, 370);

    ctx.textAlign = 'left';
    applyWatermarkToCanvas(canvas);
  };

  const gmapsLink = `https://www.google.com/maps?q=${driverLat},${driverLng}`;

  // WhatsApp formatted share text
  const getWhatsAppShareText = () => {
    const categoryLabel = category === 'kendala_jalan' 
      ? '🚨 LAPORAN KENDALA DI JALAN' 
      : category === 'akhir_kiriman' 
      ? '📦 LAPORAN AKHIR KIRIMAN (SELESAI BONGKAR)' 
      : '📍 UPDATE TITIK LOKASI GMAPS';

    return encodeURIComponent(
      `*${categoryLabel}*\n` +
      `*Driver:* ${driverName}\n` +
      `*Armada:* ${autoPlateNumber}${fleetInitial ? ` [Inisial: ${fleetInitial}]` : ''}\n` +
      `*Area Kirim:* ${currentAreaName}\n` +
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
    // 1. Simpan ke service laporan driver/helper agar terlist di submenu baru admin
    driverReportService.addReport({
      driverId: driverId || 'crew-driver',
      driverName: driverName,
      plateNumber: autoPlateNumber,
      category,
      areaName: currentAreaName,
      deliveryId: selectedDelivery?.id,
      notes: notes || (category === 'akhir_kiriman' ? 'Selesai serah terima di area tujuan' : 'Dokumentasi pengiriman'),
      photoUrl: photoDataUrl,
      latitude: driverLat,
      longitude: driverLng,
      gmapsUrl: gmapsLink
    });

    // 2. Jalankan callback update status
    onReportSubmitted({
      category,
      delivery: selectedDelivery,
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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center shadow-md font-black">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                Lapor Kendala, Istirahat &amp; Akhir Kirim
              </h3>
              <p className="text-[10px] text-slate-400">
                Dokumentasi kendala rute, waktu istirahat kru, dan konfirmasi serah terima
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
          
          {/* Category Selector Tabs */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Pilih Jenis Laporan:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setCategory('kendala_jalan')}
                className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition cursor-pointer ${
                  category === 'kendala_jalan'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Kendala Jalan</span>
              </button>

              <button
                type="button"
                onClick={() => setCategory('akhir_kiriman')}
                className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition cursor-pointer ${
                  category === 'akhir_kiriman'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Akhir Kiriman</span>
              </button>

              <button
                type="button"
                onClick={() => setCategory('istirahat')}
                className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition cursor-pointer ${
                  category === 'istirahat' || category === 'update_lokasi'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Coffee className="w-4 h-4 text-amber-400" />
                <span>Istirahat</span>
              </button>
            </div>
          </div>

          {/* Nomor Kendaraan Armada (Otomatis Terisi Sesuai Data Checklist) */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Nomor Kendaraan Armada:</span>
              <span className="text-[10px] text-emerald-400 font-normal">✓ Otomatis terisi data checklist</span>
            </label>
            <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" />
                <span className="font-mono font-bold text-amber-300 text-sm">{autoPlateNumber}</span>
                {fleetInitial && (
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black">
                    Inisial: {fleetInitial}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Terverifikasi Checklist</span>
            </div>
          </div>

          {/* NAMA AREA KIRIM (Menggantikan Toko Tujuan Terkait, Tanpa Nomor PO) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Nama Area Kirim:</span>
              <span className="text-[10px] text-slate-500 lowercase">({deliveries.length} area terdaftar)</span>
            </label>
            <select
              value={selectedDeliveryId}
              onChange={(e) => setSelectedDeliveryId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="">-- Laporan Umum (Tidak Terikat Area Tertentu) --</option>
              {deliveries.map((del) => {
                const areaTitle = del.areaName || del.store?.storeName || 'Area Pengiriman';
                const cityTitle = del.store?.city ? ` (${del.store.city})` : '';
                return (
                  <option key={del.id} value={del.id}>
                    {areaTitle}{cityTitle}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Photo Capture & Upload Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Unggah Foto Bukti (Kamera / Galeri):
              </label>
              {photoDataUrl && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={startLiveCamera}
                    className="text-[10px] text-amber-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Buka Kamera</span>
                  </button>
                  <span className="text-slate-600">&bull;</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] text-blue-400 font-bold hover:underline cursor-pointer"
                  >
                    Pilih Galeri
                  </button>
                </div>
              )}
            </div>

            {/* Native Device Camera Trigger */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              className="hidden"
            />

            {/* Gallery / File Picker */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />

            {/* LIVE CAMERA VIEWFINDER (Direct WebRTC Stream) */}
            {isCameraActive && (
              <div className="relative rounded-2xl overflow-hidden border-2 border-amber-500 shadow-2xl bg-black animate-in fade-in">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full max-h-72 object-cover bg-black"
                />
                <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-amber-300 font-mono font-bold flex items-center gap-1.5 border border-amber-500/40">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>Kamera Aktif &bull; {currentAreaName}</span>
                </div>
                <button
                  type="button"
                  onClick={stopLiveCamera}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-slate-300 hover:text-white cursor-pointer"
                  title="Tutup Kamera"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={captureLivePhoto}
                    className="px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-xl shadow-amber-500/40 active:scale-95 transition cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Jepret Foto Sekarang</span>
                  </button>
                </div>
              </div>
            )}

            {/* ERROR ALERT & RECOVERY IF CAMERA PERMISSION DENIED */}
            {cameraError && !isCameraActive && (
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 space-y-2">
                <div className="flex items-start gap-2">
                  <CameraOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed flex-1">
                    <span className="font-bold text-white block">Akses Kamera Perangkat Terkendala</span>
                    {cameraError}
                    <div className="mt-3 bg-slate-900 rounded-lg p-3 text-[10px] border border-slate-700">
                      <p className="font-bold text-amber-300 mb-2">Panduan Perbaikan (Android):</p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-300">
                        <li>Buka <span className="font-bold">Pengaturan (Settings)</span> HP.</li>
                        <li>Pilih <span className="font-bold">Aplikasi (Apps)</span> &gt; Browser Anda (Chrome).</li>
                        <li>Pilih <span className="font-bold">Izin (Permissions)</span> &gt; <span className="font-bold">Kamera</span>.</li>
                        <li>Pilih <span className="font-bold">Izinkan hanya saat aplikasi digunakan</span>.</li>
                        <li>Muat ulang halaman ini.</li>
                      </ol>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
                  <button
                    type="button"
                    onClick={startLiveCamera}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer hover:bg-amber-400 active:scale-95 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Izinkan &amp; Buka Kamera Ulang</span>
                  </button>
                  <button
                    type="button"
                    onClick={openDeviceCameraNative}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-cyan-300 font-bold text-[11px] border border-slate-700 hover:bg-slate-700 cursor-pointer transition flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Kamera Bawaan HP</span>
                  </button>
                </div>
              </div>
            )}

            {!isCameraActive && (
              photoDataUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-lg group">
                  <img
                    src={photoDataUrl}
                    alt="Foto Bukti Gmaps"
                    className="w-full max-h-56 object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] text-emerald-400 font-bold flex items-center gap-1 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Foto Berstempel Siap Kirim</span>
                  </div>
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={startLiveCamera}
                      className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-amber-300 font-bold text-[10px] border border-amber-500/30 cursor-pointer flex items-center gap-1"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Kamera Langsung</span>
                    </button>
                    <button
                      type="button"
                      onClick={openDeviceCameraNative}
                      className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-cyan-300 font-bold text-[10px] border border-cyan-500/30 cursor-pointer flex items-center gap-1"
                    >
                      <span>Kamera HP</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={startLiveCamera}
                    className="w-full p-4 rounded-2xl border-2 border-dashed border-amber-500/70 hover:border-amber-400 bg-amber-500/10 hover:bg-amber-500/15 flex items-center justify-center gap-3 cursor-pointer transition text-center group active:scale-95 shadow-lg shadow-amber-500/10"
                  >
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-110 transition shrink-0">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <div className="font-black text-white text-sm">
                        Buka Kamera HP Langsung
                      </div>
                      <div className="text-[11px] text-amber-300 font-medium mt-0.5">
                        Izinkan kamera &amp; ambil foto berstempel resmi operasional
                      </div>
                    </div>
                  </button>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={openDeviceCameraNative}
                      className="py-2.5 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                    >
                      <Camera className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Alternatif: Buka Kamera Bawaan HP</span>
                    </button>
                  </div>
                </div>
              )
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
                category === 'kendala_jalan'
                  ? 'Contoh: Macet perbaikan jalan di jalur Rogojampi, perkiraan keterlambatan 25 menit...'
                  : category === 'akhir_kiriman'
                  ? 'Contoh: Muatan 15 box diterima lengkap di gudang toko dalam keadaan baik...'
                  : category === 'istirahat'
                  ? 'Contoh: Istirahat makan siang & ibadah di SPBU / Rest Area selama 30 menit...'
                  : 'Catatan kondisi rute atau posisi armada...'
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
            <span>Simpan Laporan</span>
          </button>
        </div>

      </div>
    </div>
  );
};
