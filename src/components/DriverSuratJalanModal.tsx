import React, { useState, useRef } from 'react';
import {
  FileText,
  X,
  Printer,
  Share2,
  CheckCircle2,
  Truck,
  User,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  QrCode,
  Lock,
  ArrowRight,
  Building2,
  Package,
  Phone,
  Copy,
  Check,
  Download,
  Loader2
} from 'lucide-react';
import { OutboundWaybill, OutboundWaybillStatus } from '../types';
import { driverWaybillService } from '../services/driverWaybillService';
import { downloadSuratJalanPdf } from '../utils/suratJalanPdfGenerator';
import { logisticsStore } from '../services/store';
import { useToast } from '../context/ToastContext';

interface DriverSuratJalanModalProps {
  waybill: OutboundWaybill | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated?: (updated: OutboundWaybill) => void;
}

export const DriverSuratJalanModal: React.FC<DriverSuratJalanModalProps> = ({
  waybill,
  isOpen,
  onClose,
  onStatusUpdated
}) => {
  const { addNotification } = useToast();
  const suratJalanSheetRef = useRef<HTMLDivElement>(null);
  const [currentWaybill, setCurrentWaybill] = useState<OutboundWaybill | null>(waybill);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Update local state when prop changes
  React.useEffect(() => {
    setCurrentWaybill(waybill);
  }, [waybill]);

  // Four specific role-based user accounts for Surat Jalan
  const allUsers = logisticsStore.getUsers();
  const spvUser = allUsers.find(u => u.role === 'spv_logistik' && u.status === 'approved') || { fullName: 'MUHAMMAD SYAIFUL BAHRI', role: 'spv_logistik' };
  const operasionalUser = allUsers.find(u => u.role === 'operasional' && u.status === 'approved') || { fullName: 'Hadi Purnomo', role: 'operasional' };
  const securityUser = allUsers.find(u => u.role === 'security' && u.status === 'approved') || { fullName: 'Slamet Riyadi (Security)', role: 'security' };
  const driverHelperName = `${currentWaybill?.crew.driverName || 'Driver'}${currentWaybill?.crew.helperName ? ` / ${currentWaybill.crew.helperName}` : ''}`;

  const handleSignRole = (roleKey: 'preparedBy' | 'acknowledgedBy' | 'security' | 'driver') => {
    if (!currentWaybill) return;
    const now = new Date();
    const timeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
    const dateFormatted = now.toLocaleDateString('id-ID');
    const timestampStr = `${dateFormatted} ${timeFormatted}`;

    const updated: OutboundWaybill = { ...currentWaybill };
    if (roleKey === 'preparedBy') {
      updated.preparedBySigned = true;
      updated.preparedBySignedAt = timestampStr;
      updated.preparedByName = spvUser.fullName;
    } else if (roleKey === 'acknowledgedBy') {
      updated.acknowledgedBySigned = true;
      updated.acknowledgedBySignedAt = timestampStr;
      updated.acknowledgedByName = operasionalUser.fullName;
    } else if (roleKey === 'security') {
      updated.securitySigned = true;
      updated.securitySignedAt = timestampStr;
      updated.securityOfficerName = securityUser.fullName;
    } else if (roleKey === 'driver') {
      updated.driverSigned = true;
      updated.driverSignedAt = timestampStr;
    }

    setCurrentWaybill(updated);
    driverWaybillService.saveWaybill(updated);
    if (onStatusUpdated) onStatusUpdated(updated);
    addNotification('delivery', 'Tanda Tangan Digital Berhasil', `Surat jalan berhasil ditandatangani secara digital.`);
  };

  if (!isOpen || !currentWaybill) return null;

  const handleGateOutConfirm = () => {
    setIsUpdating(true);
    const success = driverWaybillService.updateWaybillStatus(currentWaybill.id, 'gate_out');
    if (success) {
      const now = new Date();
      const updated: OutboundWaybill = {
        ...currentWaybill,
        status: 'gate_out',
        statusLabel: 'Gate-Out Gerbang DC (Berangkat)',
        gateOutTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`
      };
      setCurrentWaybill(updated);
      if (onStatusUpdated) onStatusUpdated(updated);
      addNotification(
        'schedule',
        'Gate-Out Berhasil',
        `Armada ${currentWaybill.fleet.plateNumber} tercatat keluar gerbang gudang DC.`
      );
    }
    setIsUpdating(false);
  };

  const handleCopySummary = () => {
    const text = `*SURAT JALAN KELUAR PT AKK*\nNo: ${currentWaybill.waybillNumber}\nArmada: ${currentWaybill.fleet.plateNumber} (${currentWaybill.fleet.vehicleType})\nDriver: ${currentWaybill.crew.driverName}\nTujuan: ${currentWaybill.destination.storeName} (${currentWaybill.destination.city})\nMuatan: ${currentWaybill.totalKoli} Koli (${(currentWaybill.totalWeightKg / 1000).toFixed(1)} Ton)\nSegel: ${currentWaybill.securitySealNumber}\nStatus: ${currentWaybill.statusLabel}`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    addNotification('schedule', 'Teks Disalin', 'Ringkasan Surat Jalan disalin ke clipboard.');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Dedicated direct PDF download generator (works 100% inside iframe & mobile)
  const handleDownloadPdf = async () => {
    if (!currentWaybill || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const success = await downloadSuratJalanPdf(currentWaybill, suratJalanSheetRef.current);
      if (success) {
        addNotification(
          'delivery',
          'PDF Surat Jalan Berhasil Diunduh',
          `Berkas ${currentWaybill.waybillNumber} telah diunduh dan tersimpan ke perangkat Anda.`
        );
      } else {
        throw new Error('Gagal menghasilkan file PDF');
      }
    } catch (err: any) {
      console.error('PDF generation error:', err);
      addNotification(
        'sla_warning',
        'Gagal Cetak PDF',
        'Terjadi kendala saat memproses berkas PDF. Silakan coba kembali.'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Print helper with iframe fallback
  const handlePrint = () => {
    try {
      if (window.self !== window.top) {
        // We are inside an iframe where window.print() might be sandboxed
        // Provide direct PDF generation as reliable default
        handleDownloadPdf();
      } else {
        window.print();
      }
    } catch {
      handleDownloadPdf();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Modal Top Header */}
        <div className="bg-slate-950 p-3.5 px-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wide">
                Surat Jalan Keluar Resmi
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {currentWaybill.waybillNumber}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopySummary}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Salin ringkasan teks"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="p-1.5 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
              title="Unduh Berkas PDF Resmi"
            >
              {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Download className="w-4 h-4" />}
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Cetak Surat Jalan"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs bg-slate-950">
          
          {/* Printable Surat Jalan Form Card (Captured by HTML2Canvas / Printable paper) */}
          <div
            ref={suratJalanSheetRef}
            className="bg-white text-slate-900 rounded-xl p-4 sm:p-5 shadow-lg border border-slate-200 space-y-4 print:p-0 print:border-none print:shadow-none"
          >
            
            {/* Header Instansi */}
            <div className="border-b border-slate-300 pb-3 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-1.5 text-blue-900 font-black text-xs sm:text-sm tracking-tight">
                  <Building2 className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>PT. ANUGRAH KEMASAN KREATIF</span>
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5 font-medium">
                  Divisi Logistik, Supply Chain & Distribusi Armada
                </div>
                <div className="text-[9px] text-slate-500 max-w-xs leading-tight">
                  {currentWaybill.originWarehouse.address} · Telp: {currentWaybill.originWarehouse.phone}
                </div>
              </div>
              <div className="text-right">
                <div className="inline-block px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 font-mono font-bold text-[10px]">
                  {currentWaybill.waybillNumber}
                </div>
                <div className="text-[9px] text-slate-500 mt-1">
                  Tanggal: {new Date(currentWaybill.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div className="text-[9px] text-slate-500">
                  Tracking: <span className="font-mono font-semibold text-slate-700">{currentWaybill.trackingNumber}</span>
                </div>
              </div>
            </div>

            {/* Destination & Fleet Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              
              {/* Tujuan Pengiriman */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-blue-600" />
                  <span>Tujuan Pengiriman:</span>
                </div>
                <div className="font-bold text-slate-900 text-xs">
                  {currentWaybill.destination.storeName}
                </div>
                <div className="text-slate-600 text-[10px] leading-snug">
                  {currentWaybill.destination.address}
                </div>
                <div className="text-[10px] text-slate-600 pt-1 border-t border-slate-200 flex justify-between">
                  <span>PIC: <strong>{currentWaybill.destination.contactPerson}</strong></span>
                  <span>Telp: {currentWaybill.destination.phone}</span>
                </div>
              </div>

              {/* Data Armada & Kru */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                  <Truck className="w-3 h-3 text-amber-600" />
                  <span>Armada & Kru Pengemudi:</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 font-mono text-xs">
                    {currentWaybill.fleet.plateNumber}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                    {currentWaybill.fleet.vehicleType}
                  </span>
                </div>
                <div className="text-slate-600 text-[10px]">
                  Driver: <strong>{currentWaybill.crew.driverName}</strong> ({currentWaybill.crew.licenseType || 'SIM B1'})
                </div>
                <div className="text-slate-600 text-[10px]">
                  Helper: <strong>{currentWaybill.crew.helperName || 'Helper Terjadwal'}</strong>
                </div>
                <div className="text-[9px] text-slate-500 pt-0.5">
                  Telp Driver: {currentWaybill.crew.driverPhone}
                </div>
              </div>
            </div>

            {/* QR Code Digital Gate-Pass & Verification Footer */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-12 h-12 bg-white p-1 rounded border border-slate-300 flex items-center justify-center shrink-0">
                  <QrCode className="w-10 h-10 text-slate-900" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-900">
                    Verifikasi Digital Gate-Out DC PT AKK
                  </div>
                  <div className="text-[9px] text-slate-500 max-w-xs font-mono">
                    {currentWaybill.qrCodeData}
                  </div>
                  <div className="text-[9px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Tervalidasi Sistem Otentikasi Terpusat</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Kolom Tanda Tangan Resmi 4 Pihak dengan Tanda Tangan Digital */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2.5 text-center text-[9px] text-slate-700 border-t border-slate-200">
              
              {/* 1. DISIAPKAN OLEH (SPV LOGISTIK) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-slate-800">Disiapkan Oleh:</div>
                  <div className="text-[8px] font-extrabold text-blue-700 bg-blue-100 rounded px-1 py-0.5 inline-block mt-0.5">
                    SPV Logistik
                  </div>
                </div>

                <div className="my-1.5 py-1 px-1 bg-white border border-slate-200/80 rounded-lg flex flex-col items-center justify-center min-h-[52px]">
                  {currentWaybill.preparedBySigned !== false ? (
                    <>
                      <svg viewBox="0 0 100 28" className="w-20 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 20 C 20 8, 28 26, 38 12 C 48 4, 52 24, 70 14 C 82 8, 88 22, 95 10" />
                        <path d="M18 24 C 38 22, 65 23, 90 20" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />
                      </svg>
                      <span className="text-[7.5px] font-bold text-blue-700 flex items-center gap-0.5 mt-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 text-blue-600" />
                        <span>Tervalidasi Digital</span>
                      </span>
                      <span className="text-[7px] text-slate-400 font-mono">
                        {currentWaybill.preparedBySignedAt || '16/10/2026 07:10 WIB'}
                      </span>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSignRole('preparedBy')}
                      className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[8px] cursor-pointer"
                    >
                      + Tanda Tangani
                    </button>
                  )}
                </div>

                <div>
                  <div className="font-bold text-slate-900 leading-tight text-[9.5px]">
                    {currentWaybill.preparedByName || spvUser.fullName}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSignRole('preparedBy')}
                    className="text-[7px] text-blue-600 hover:underline mt-0.5 font-semibold cursor-pointer block mx-auto"
                  >
                    [Ubah TTD]
                  </button>
                </div>
              </div>

              {/* 2. MENGETAHUI (OPERASIONAL) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-slate-800">Mengetahui:</div>
                  <div className="text-[8px] font-extrabold text-indigo-700 bg-indigo-100 rounded px-1 py-0.5 inline-block mt-0.5">
                    Operasional
                  </div>
                </div>

                <div className="my-1.5 py-1 px-1 bg-white border border-slate-200/80 rounded-lg flex flex-col items-center justify-center min-h-[52px]">
                  {currentWaybill.acknowledgedBySigned !== false ? (
                    <>
                      <svg viewBox="0 0 100 28" className="w-20 h-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22 C 22 10, 32 25, 42 14 C 52 6, 60 22, 75 12 C 85 8, 90 20, 96 12" />
                        <path d="M20 25 C 45 23, 70 24, 92 21" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />
                      </svg>
                      <span className="text-[7.5px] font-bold text-indigo-700 flex items-center gap-0.5 mt-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 text-indigo-600" />
                        <span>Tervalidasi Digital</span>
                      </span>
                      <span className="text-[7px] text-slate-400 font-mono">
                        {currentWaybill.acknowledgedBySignedAt || '16/10/2026 07:20 WIB'}
                      </span>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSignRole('acknowledgedBy')}
                      className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[8px] cursor-pointer"
                    >
                      + Tanda Tangani
                    </button>
                  )}
                </div>

                <div>
                  <div className="font-bold text-slate-900 leading-tight text-[9.5px]">
                    {currentWaybill.acknowledgedByName || operasionalUser.fullName}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSignRole('acknowledgedBy')}
                    className="text-[7px] text-indigo-600 hover:underline mt-0.5 font-semibold cursor-pointer block mx-auto"
                  >
                    [Ubah TTD]
                  </button>
                </div>
              </div>

              {/* 3. SECURITY (POS GERBANG DC) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-slate-800">Security:</div>
                  <div className="text-[8px] font-extrabold text-emerald-700 bg-emerald-100 rounded px-1 py-0.5 inline-block mt-0.5">
                    Pos Satpam Gerbang
                  </div>
                </div>

                <div className="my-1.5 py-1 px-1 bg-white border border-slate-200/80 rounded-lg flex flex-col items-center justify-center min-h-[52px]">
                  {currentWaybill.securitySigned !== false ? (
                    <>
                      <svg viewBox="0 0 100 28" className="w-20 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 18 C 24 6, 35 28, 48 10 C 58 5, 65 25, 78 15 C 86 10, 92 18, 97 12" />
                        <path d="M15 24 C 40 23, 70 24, 94 22" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />
                      </svg>
                      <span className="text-[7.5px] font-bold text-emerald-700 flex items-center gap-0.5 mt-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        <span>Gate Pass Digital</span>
                      </span>
                      <span className="text-[7px] text-slate-400 font-mono">
                        {currentWaybill.securitySignedAt || '16/10/2026 07:30 WIB'}
                      </span>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSignRole('security')}
                      className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[8px] cursor-pointer"
                    >
                      + Tanda Tangani
                    </button>
                  )}
                </div>

                <div>
                  <div className="font-bold text-slate-900 leading-tight text-[9.5px]">
                    {currentWaybill.securityOfficerName || securityUser.fullName}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSignRole('security')}
                    className="text-[7px] text-emerald-600 hover:underline mt-0.5 font-semibold cursor-pointer block mx-auto"
                  >
                    [Ubah TTD]
                  </button>
                </div>
              </div>

              {/* 4. DIBAWA OLEH (DRIVER / HELPER) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-slate-800">Dibawa Oleh:</div>
                  <div className="text-[8px] font-extrabold text-amber-700 bg-amber-100 rounded px-1 py-0.5 inline-block mt-0.5">
                    Driver / Helper
                  </div>
                </div>

                <div className="my-1.5 py-1 px-1 bg-white border border-slate-200/80 rounded-lg flex flex-col items-center justify-center min-h-[52px]">
                  {currentWaybill.driverSigned !== false ? (
                    <>
                      <svg viewBox="0 0 100 28" className="w-20 h-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 24 C 25 10, 32 26, 45 16 C 55 8, 62 24, 76 12 C 86 6, 92 20, 96 14" />
                        <path d="M18 26 C 42 24, 68 25, 92 23" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />
                      </svg>
                      <span className="text-[7.5px] font-bold text-amber-700 flex items-center gap-0.5 mt-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 text-amber-600" />
                        <span>Kru Terverifikasi</span>
                      </span>
                      <span className="text-[7px] text-slate-400 font-mono">
                        {currentWaybill.driverSignedAt || '16/10/2026 07:35 WIB'}
                      </span>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSignRole('driver')}
                      className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[8px] cursor-pointer"
                    >
                      + Tanda Tangani
                    </button>
                  )}
                </div>

                <div>
                  <div className="font-bold text-slate-900 leading-tight text-[9.5px]">
                    {driverHelperName}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSignRole('driver')}
                    className="text-[7px] text-amber-600 hover:underline mt-0.5 font-semibold cursor-pointer block mx-auto"
                  >
                    [Ubah TTD]
                  </button>
                </div>
              </div>

            </div>

          </div>

          {/* Quick Gate Out Action Bar (For Driver) */}
          {currentWaybill.status === 'checker_verified' && (
            <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-blue-300">Konfirmasi Keluar Gerbang (Gate-Out)</div>
                <div className="text-[10px] text-slate-400">
                  Muatan siap berangkat. Tekan konfirmasi saat kendaraan melintasi gerbang DC.
                </div>
              </div>
              <button
                onClick={handleGateOutConfirm}
                disabled={isUpdating}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition cursor-pointer"
              >
                <span>Gate-Out Sekarang</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>

        {/* Modal Bottom Action Controls */}
        <div className="bg-slate-900 p-3 px-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Dokumen Resmi PT AKK Terintegrasi</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition cursor-pointer active:scale-95 disabled:cursor-not-allowed"
              title="Unduh berkas PDF resmi ke perangkat"
            >
              {isExportingPdf ? (
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
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Cetak langsung menggunakan dialog printer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
