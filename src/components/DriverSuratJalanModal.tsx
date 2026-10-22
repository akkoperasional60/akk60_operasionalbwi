import React, { useState, useRef } from 'react';
import {
  FileText,
  X,
  Printer,
  CheckCircle2,
  Truck,
  MapPin,
  ShieldCheck,
  QrCode,
  ArrowRight,
  Building2,
  Copy,
  Check,
  Download,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { OutboundWaybill } from '../types';
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

  React.useEffect(() => {
    setCurrentWaybill(waybill);
  }, [waybill]);

  const allUsers = logisticsStore.getUsers();
  const spvUser = allUsers.find(u => u.role === 'spv_logistik' && u.status === 'approved') || { fullName: 'MUHAMMAD SYAIFUL BAHRI', role: 'spv_logistik' };
  const operasionalUser = allUsers.find(u => u.role === 'operasional' && u.status === 'approved') || { fullName: 'Hadi Purnomo', role: 'operasional' };
  const securityUser = allUsers.find(u => u.role === 'security' && u.status === 'approved') || { fullName: 'Slamet Riyadi (Security)', role: 'security' };
  const driverHelperName = `${currentWaybill?.crew.driverName || 'Driver'}${currentWaybill?.crew.helperName ? ` / ${currentWaybill.crew.helperName}` : ''}`;

  const handleToggleSignRole = (roleKey: 'preparedBy' | 'acknowledgedBy' | 'security' | 'driver') => {
    if (!currentWaybill) return;
    const now = new Date();
    const timeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
    const dateFormatted = now.toLocaleDateString('id-ID');
    const timestampStr = `${dateFormatted} ${timeFormatted}`;

    const updated: OutboundWaybill = { ...currentWaybill };
    if (roleKey === 'preparedBy') {
      const nextState = !(updated.preparedBySigned === true);
      updated.preparedBySigned = nextState;
      updated.preparedBySignedAt = nextState ? timestampStr : '';
      updated.preparedByName = spvUser.fullName;
    } else if (roleKey === 'acknowledgedBy') {
      const nextState = !(updated.acknowledgedBySigned === true);
      updated.acknowledgedBySigned = nextState;
      updated.acknowledgedBySignedAt = nextState ? timestampStr : '';
      updated.acknowledgedByName = operasionalUser.fullName;
    } else if (roleKey === 'security') {
      const nextState = !(updated.securitySigned === true);
      updated.securitySigned = nextState;
      updated.securitySignedAt = nextState ? timestampStr : '';
      updated.securityOfficerName = securityUser.fullName;
    } else if (roleKey === 'driver') {
      const nextState = !(updated.driverSigned === true);
      updated.driverSigned = nextState;
      updated.driverSignedAt = nextState ? timestampStr : '';
    }

    setCurrentWaybill(updated);
    driverWaybillService.saveWaybill(updated);
    if (onStatusUpdated) onStatusUpdated(updated);
  };

  const handleClearAllSignatures = () => {
    if (!currentWaybill) return;
    const updated: OutboundWaybill = {
      ...currentWaybill,
      preparedBySigned: false,
      preparedBySignedAt: '',
      acknowledgedBySigned: false,
      acknowledgedBySignedAt: '',
      securitySigned: false,
      securitySignedAt: '',
      driverSigned: false,
      driverSignedAt: ''
    };
    setCurrentWaybill(updated);
    driverWaybillService.saveWaybill(updated);
    if (onStatusUpdated) onStatusUpdated(updated);
    addNotification('schedule', 'TTD Dikosongkan', 'Seluruh kolom tanda tangan telah dikosongkan untuk tanda tangan basah/manual.');
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
    const text = `*SURAT JALAN KELUAR PT AKK (57-58mm)*\nNo: ${currentWaybill.waybillNumber}\nArmada: ${currentWaybill.fleet.plateNumber} (${currentWaybill.fleet.vehicleType})\nDriver: ${currentWaybill.crew.driverName}\nTujuan: ${currentWaybill.destination.storeName} (${currentWaybill.destination.city})\nStatus: ${currentWaybill.statusLabel}`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    addNotification('schedule', 'Teks Disalin', 'Ringkasan Surat Jalan disalin ke clipboard.');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    if (!currentWaybill || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const success = await downloadSuratJalanPdf(currentWaybill, suratJalanSheetRef.current);
      if (success) {
        addNotification(
          'delivery',
          'PDF 57-58mm Berhasil Diunduh',
          `Berkas ${currentWaybill.waybillNumber} ukuran kertas thermal 57-58 mm telah diunduh.`
        );
      } else {
        throw new Error('Gagal menghasilkan file PDF');
      }
    } catch (err) {
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

  const handlePrint = () => {
    handleDownloadPdf();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Modal Top Header */}
        <div className="bg-slate-950 p-3.5 px-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-1.5">
                <span>Surat Jalan (57-58 mm)</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {currentWaybill.waybillNumber}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClearAllSignatures}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition cursor-pointer"
              title="Kosongkan Semua TTD"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
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
              title="Unduh PDF Ukuran 57-58 mm"
            >
              {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Download className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable 57-58mm Thermal Paper Preview */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs bg-slate-950 flex flex-col items-center">
          <div className="text-[10px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
            Pratinjau Kertas Thermal 57-58 mm • Kolom TTD Dikosongi Terlebih Dahulu
          </div>

          {/* 58mm Thermal Receipt Sheet */}
          <div
            ref={suratJalanSheetRef}
            className="w-[260px] bg-white text-slate-950 rounded-md p-3.5 shadow-xl border border-slate-300 space-y-2.5 font-mono text-[10px] leading-snug"
          >
            {/* Header Instansi */}
            <div className="text-center border-b border-dashed border-slate-400 pb-2">
              <div className="font-black text-[11px] text-slate-950 tracking-tight font-sans">
                PT. ANUGRAH KEMASAN KREATIF
              </div>
              <div className="text-[9px] text-slate-700 font-sans">
                Divisi Logistik &amp; Distribusi Armada
              </div>
              <div className="text-[8px] text-slate-600 font-sans">
                Banyuwangi KM 12 • (0333) 412890
              </div>
            </div>

            {/* Nomor & Tanggal */}
            <div className="text-center border-b border-dashed border-slate-400 pb-2 space-y-0.5">
              <div className="font-bold text-[10px] text-slate-950 font-sans uppercase">
                SURAT JALAN KELUAR
              </div>
              <div className="font-bold text-[9.5px] text-blue-900">
                {currentWaybill.waybillNumber}
              </div>
              <div className="text-[8.5px] text-slate-700">
                Tgl: {currentWaybill.date} | Out: {currentWaybill.gateOutTime}
              </div>
              <div className="text-[8.5px] text-slate-700">
                Resi: {currentWaybill.trackingNumber}
              </div>
            </div>

            {/* Tujuan Pengiriman */}
            <div className="border-b border-dashed border-slate-400 pb-2 space-y-0.5">
              <div className="font-bold text-[9px] uppercase text-slate-700 flex items-center gap-1 font-sans">
                <MapPin className="w-3 h-3 text-slate-900 shrink-0" />
                <span>Tujuan Pengiriman:</span>
              </div>
              <div className="font-bold text-[10px] text-slate-950 font-sans">
                {currentWaybill.destination.storeName}
              </div>
              <div className="text-[8.5px] text-slate-800">
                Area: {currentWaybill.destination.areaName}
              </div>
              <div className="text-[8.5px] text-slate-700">
                {currentWaybill.destination.address}
              </div>
              <div className="text-[8.5px] text-slate-800 pt-0.5">
                PIC: {currentWaybill.destination.contactPerson} ({currentWaybill.destination.phone})
              </div>
            </div>

            {/* Data Armada & Kru */}
            <div className="border-b border-dashed border-slate-400 pb-2 space-y-0.5">
              <div className="font-bold text-[9px] uppercase text-slate-700 flex items-center gap-1 font-sans">
                <Truck className="w-3 h-3 text-slate-900 shrink-0" />
                <span>Armada &amp; Kru Pengemudi:</span>
              </div>
              <div className="font-bold text-[10px] text-slate-950">
                {currentWaybill.fleet.plateNumber} ({currentWaybill.fleet.vehicleType})
              </div>
              <div className="text-[8.5px] text-slate-800">
                Driver : {currentWaybill.crew.driverName}
              </div>
              <div className="text-[8.5px] text-slate-800">
                Helper : {currentWaybill.crew.helperName || '-'}
              </div>
              <div className="text-[8.5px] text-slate-700">
                Telp   : {currentWaybill.crew.driverPhone}
              </div>
            </div>

            {/* QR Gate-Pass */}
            <div className="border-b border-dashed border-slate-400 pb-2 flex items-center gap-2">
              <div className="w-9 h-9 bg-white p-0.5 rounded border border-slate-400 flex items-center justify-center shrink-0">
                <QrCode className="w-7 h-7 text-slate-950" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-[8.5px] text-slate-950 font-sans">
                  GATE-OUT DC PT AKK
                </div>
                <div className="text-[7.5px] text-slate-600 truncate">
                  {currentWaybill.qrCodeData}
                </div>
              </div>
            </div>

            {/* Kolom Tanda Tangan (TTD Dikosongi Terlebih Dahulu) */}
            <div className="pt-1 space-y-2">
              <div className="text-center font-bold text-[8.5px] text-slate-900 font-sans uppercase">
                KOLOM TANDA TANGAN (TTD)
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-[8px] font-sans">
                {/* 1. SPV Logistik */}
                <div className="border border-slate-300 rounded p-1.5 flex flex-col justify-between min-h-[76px]">
                  <div className="font-bold text-slate-800">Disiapkan (SPV):</div>
                  <div
                    onClick={() => handleToggleSignRole('preparedBy')}
                    className="my-1 min-h-[34px] flex flex-col items-center justify-center border-b border-dotted border-slate-400 cursor-pointer hover:bg-slate-50"
                    title="Klik untuk isi / kosongkan TTD"
                  >
                    {currentWaybill.preparedBySigned === true ? (
                      <span className="text-[7.5px] font-bold text-blue-700">✓ TTD Terisi</span>
                    ) : (
                      <span className="text-[7px] text-slate-400 italic">( Kosong )</span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900 text-[7.5px] truncate">
                    {currentWaybill.preparedByName || spvUser.fullName}
                  </div>
                </div>

                {/* 2. Operasional */}
                <div className="border border-slate-300 rounded p-1.5 flex flex-col justify-between min-h-[76px]">
                  <div className="font-bold text-slate-800">Operasional:</div>
                  <div
                    onClick={() => handleToggleSignRole('acknowledgedBy')}
                    className="my-1 min-h-[34px] flex flex-col items-center justify-center border-b border-dotted border-slate-400 cursor-pointer hover:bg-slate-50"
                    title="Klik untuk isi / kosongkan TTD"
                  >
                    {currentWaybill.acknowledgedBySigned === true ? (
                      <span className="text-[7.5px] font-bold text-indigo-700">✓ TTD Terisi</span>
                    ) : (
                      <span className="text-[7px] text-slate-400 italic">( Kosong )</span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900 text-[7.5px] truncate">
                    {currentWaybill.acknowledgedByName || operasionalUser.fullName}
                  </div>
                </div>

                {/* 3. Security */}
                <div className="border border-slate-300 rounded p-1.5 flex flex-col justify-between min-h-[76px]">
                  <div className="font-bold text-slate-800">Security Pos:</div>
                  <div
                    onClick={() => handleToggleSignRole('security')}
                    className="my-1 min-h-[34px] flex flex-col items-center justify-center border-b border-dotted border-slate-400 cursor-pointer hover:bg-slate-50"
                    title="Klik untuk isi / kosongkan TTD"
                  >
                    {currentWaybill.securitySigned === true ? (
                      <span className="text-[7.5px] font-bold text-emerald-700">✓ TTD Terisi</span>
                    ) : (
                      <span className="text-[7px] text-slate-400 italic">( Kosong )</span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900 text-[7.5px] truncate">
                    {currentWaybill.securityOfficerName || securityUser.fullName}
                  </div>
                </div>

                {/* 4. Driver / Helper */}
                <div className="border border-slate-300 rounded p-1.5 flex flex-col justify-between min-h-[76px]">
                  <div className="font-bold text-slate-800">Driver / Helper:</div>
                  <div
                    onClick={() => handleToggleSignRole('driver')}
                    className="my-1 min-h-[34px] flex flex-col items-center justify-center border-b border-dotted border-slate-400 cursor-pointer hover:bg-slate-50"
                    title="Klik untuk isi / kosongkan TTD"
                  >
                    {currentWaybill.driverSigned === true ? (
                      <span className="text-[7.5px] font-bold text-amber-700">✓ TTD Terisi</span>
                    ) : (
                      <span className="text-[7px] text-slate-400 italic">( Kosong )</span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900 text-[7.5px] truncate">
                    {driverHelperName}
                  </div>
                </div>
              </div>

              <div className="text-center text-[7.5px] text-slate-500 pt-1 border-t border-dashed border-slate-300 font-sans">
                Ukuran Cetak Kertas Thermal 57-58 mm • PT AKK
              </div>
            </div>
          </div>

          {/* Quick Gate Out Action Bar (For Driver) */}
          {currentWaybill.status === 'checker_verified' && (
            <div className="w-full p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-blue-300">Konfirmasi Keluar Gerbang (Gate-Out)</div>
                <div className="text-[10px] text-slate-400">
                  Tekan konfirmasi saat kendaraan melintasi gerbang DC.
                </div>
              </div>
              <button
                onClick={handleGateOutConfirm}
                disabled={isUpdating}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition cursor-pointer"
              >
                <span>Gate-Out</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>

        {/* Modal Bottom Action Controls */}
        <div className="bg-slate-900 p-3 px-4 border-t border-slate-800 flex items-center justify-between gap-2">
          <div className="text-[10px] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Kertas 57-58 mm</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition cursor-pointer active:scale-95"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF 58mm</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>

            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
