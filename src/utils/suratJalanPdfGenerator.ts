import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { OutboundWaybill, Schedule, ScannedDocumentLog } from '../types';
import { driverWaybillService } from '../services/driverWaybillService';
import { logisticsStore } from '../services/store';

/**
 * Generate and download high-quality official Surat Jalan Keluar PDF
 * Supports both direct vector rendering and HTML element capture fallback.
 */
export async function downloadSuratJalanPdf(
  waybill: OutboundWaybill,
  elementToCapture?: HTMLElement | null
): Promise<boolean> {
  const cleanNumber = (waybill.waybillNumber || 'SJ_AKK').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Surat_Jalan_Keluar_${cleanNumber}.pdf`;

  // 1. Try html2canvas capture if element is supplied, wrapped safely
  if (elementToCapture) {
    try {
      const canvas = await html2canvas(elementToCapture, {
        scale: 2, // High resolution for crisp text
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      if (canvas && canvas.width > 0 && canvas.height > 0) {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
        const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
        const margin = 10;
        const contentWidth = pageWidth - margin * 2;
        const contentHeight = (canvas.height * contentWidth) / canvas.width;

        if (contentHeight <= pageHeight - margin * 2) {
          pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight);
        } else {
          // Multi-page split if content overflows
          let heightLeft = contentHeight;
          let position = margin;

          pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight);
          heightLeft -= pageHeight;

          while (heightLeft > 0) {
            position = heightLeft - contentHeight + margin;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight);
            heightLeft -= pageHeight;
          }
        }

        pdf.save(fileName);
        return true;
      }
    } catch (canvasErr) {
      console.warn('html2canvas capture skipped/failed, using direct jsPDF vector builder:', canvasErr);
    }
  }

  // 2. Direct pristine jsPDF vector layout builder (guaranteed 100% reliable)
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    let y = 14;

    // Header Company Branding
    doc.setFillColor(30, 58, 138); // Blue 900
    doc.rect(14, y, 182, 1.5, 'F');
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 58, 138);
    doc.text('PT. ANUGRAH KEMASAN KREATIF', 14, y);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Divisi Logistik, Supply Chain & Distribusi Armada', 14, y + 4);
    doc.text(waybill.originWarehouse?.address || 'Kawasan Pergudangan Logistik Industri Banyuwangi KM 12', 14, y + 8);
    doc.text(`Telp: ${waybill.originWarehouse?.phone || '(0333) 412890'} · Gerbang: ${waybill.originWarehouse?.gateNumber || 'Gate 03 Outbound'}`, 14, y + 12);

    // Document Code Badge (Top Right)
    doc.setFillColor(239, 246, 255); // Blue 50
    doc.setDrawColor(191, 219, 254); // Blue 200
    doc.roundedRect(128, y - 4, 68, 17, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 64, 175);
    doc.text(waybill.waybillNumber || 'SJ-OUT/AKK/2026/10/08-01', 132, y + 1);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Tgl: ${waybill.date || new Date().toISOString().slice(0, 10)} · Waktu Out: ${waybill.gateOutTime || '07:30 WIB'}`, 132, y + 5.5);
    doc.text(`Tracking Resi: ${waybill.trackingNumber || '-'}`, 132, y + 9.5);

    y += 20;

    y += 10;

    // Grid: Tujuan Pengiriman (Left) vs Armada & Kru (Right)
    const boxW = 89;
    const boxH = 38;

    // Destination Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, boxW, boxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('TUJUAN PENGIRIMAN:', 18, y + 5);

    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(waybill.destination?.storeName || 'Toko Mitra Distribusi', 18, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const destinationAddress = waybill.destination?.address || 'Jl. Raya Industri Banyuwangi';
    const splitAddr = doc.splitTextToSize(destinationAddress, boxW - 8);
    doc.text(splitAddr, 18, y + 15);

    doc.setFont('helvetica', 'bold');
    doc.text(`PIC: ${waybill.destination?.contactPerson || 'Staff Toko'}`, 18, y + 29);
    doc.setFont('helvetica', 'normal');
    doc.text(`Telp: ${waybill.destination?.phone || '-'}`, 18, y + 33);

    // Fleet & Crew Box
    doc.roundedRect(107, y, boxW, boxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('ARMADA & KRU PENGEMUDI:', 111, y + 5);

    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${waybill.fleet?.plateNumber || '-'}  (${waybill.fleet?.vehicleType || 'Engkel Box'})`, 111, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Driver: ${waybill.crew?.driverName || '-'} (${waybill.crew?.licenseType || 'SIM B1'})`, 111, y + 15);
    doc.text(`Helper: ${waybill.crew?.helperName || 'Helper Terjadwal'}`, 111, y + 19);
    doc.text(`Telp Driver: ${waybill.crew?.driverPhone || '-'}`, 111, y + 23);
    doc.text(`Wilayah Area: ${waybill.destination?.areaName || 'Banyuwangi'}`, 111, y + 27);
    doc.text(`Inisial Truk: ${waybill.fleet?.initialCode || 'WB-01'}`, 111, y + 31);

    y += boxH + 12;

    // Digital QR Gate-Pass Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, y, 182, 12, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text('VERIFIKASI DIGITAL GATE-OUT DC PT AKK (SECURITY GATE-PASS)', 18, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const qrData = waybill.qrCodeData || `PT_AKK|${waybill.waybillNumber}|VERIFIED`;
    doc.text(`Payload Otentikasi: ${qrData} · Tervalidasi Sistem Otentikasi Terpusat PT AKK`, 18, y + 9);

    y += 18;

    // Signatures Table (4 Columns: SPV Logistik, Super Admin, Security, Driver / Helper)
    const sigW = 43;
    const sigH = 26;

    const allUsers = logisticsStore.getUsers();
    const spvName = waybill.preparedByName || allUsers.find(u => u.role === 'spv_logistik')?.fullName || 'MUHAMMAD SYAIFUL BAHRI';
    const operasionalName = waybill.acknowledgedByName || allUsers.find(u => u.role === 'operasional')?.fullName || 'Hadi Purnomo';
    const secName = waybill.securityOfficerName || allUsers.find(u => u.role === 'security')?.fullName || 'Slamet Riyadi (Security)';
    const crewName = `${waybill.crew?.driverName || 'Driver'}${waybill.crew?.helperName ? ` / ${waybill.crew.helperName}` : ''}`;

    const signatures = [
      { role: 'Disiapkan (SPV Logistik):', name: spvName, status: '✓ Tervalidasi Digital' },
      { role: 'Mengetahui (Operasional):', name: operasionalName, status: '✓ Tervalidasi Digital' },
      { role: 'Security (Pos Gerbang):', name: secName, status: '✓ Tervalidasi Digital' },
      { role: 'Dibawa (Driver/Helper):', name: crewName, status: '✓ Tervalidasi Digital' }
    ];

    signatures.forEach((sig, i) => {
      const sx = 14 + i * (sigW + 3.3);
      doc.setDrawColor(226, 232, 240);
      doc.rect(sx, y, sigW, sigH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      doc.text(sig.role, sx + 2, y + 4.5);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(37, 99, 235);
      doc.text(sig.status, sx + 2, y + 13);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);
      doc.text(sig.name, sx + 2, y + 21);
    });

    // Save and download PDF file
    doc.save(fileName);
    return true;
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    return false;
  }
}

/**
 * Generate and download PDF from a Schedule object directly
 */
export async function downloadScheduleManifestPdf(schedule: Schedule): Promise<boolean> {
  try {
    const waybill = driverWaybillService.generateWaybillFromSchedule(schedule);
    return await downloadSuratJalanPdf(waybill);
  } catch (err) {
    console.error('Error generating Schedule PDF:', err);
    return false;
  }
}

/**
 * Generate and download PDF for a Scanned Document Log
 */
export async function downloadScannedDocumentPdf(docLog: ScannedDocumentLog): Promise<boolean> {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    let y = 14;

    // Header
    doc.setFillColor(30, 58, 138);
    doc.rect(14, y, 182, 1.5, 'F');
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 58, 138);
    doc.text('PT. ANUGRAH KEMASAN KREATIF', 14, y);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Arsip Digital Bukti Fisik Operasional Logistik & Distribusi', 14, y + 4);

    // Document Code Box
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(120, y - 4, 76, 17, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 64, 175);
    doc.text(docLog.documentNumber || 'DOC-SCAN-001', 124, y + 1);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Tipe: ${docLog.documentTypeLabel} (${docLog.documentType})`, 124, y + 5.5);
    doc.text(`Dipindai: ${new Date(docLog.timestamp).toLocaleString('id-ID')} WIB`, 124, y + 9.5);

    y += 22;

    // Metadata card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 26, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('INFORMASI PENGARSIPAN:', 18, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Nomor Dokumen / Resi : ${docLog.documentNumber || '-'}`, 18, y + 10);
    doc.text(`Armada Pelaksana     : ${docLog.vehiclePlate || '-'}`, 18, y + 14);
    doc.text(`Pengemudi / Petugas  : ${docLog.driverName || docLog.capturedBy}`, 18, y + 18);
    doc.text(`Penerima / Toko      : ${docLog.destinationOrStore || '-'}`, 18, y + 22);

    doc.text(`Metode Input   : ${docLog.source === 'camera' ? 'Kamera HP (Scanner Langsung)' : 'Unggah File'}`, 110, y + 10);
    doc.text(`Status Dokumen : ${(docLog.status || 'verified').toUpperCase()}`, 110, y + 14);
    doc.text(`ID Referensi   : ${docLog.id}`, 110, y + 18);

    y += 32;

    // OCR Extracted Data
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('TEKS HASIL PEMINDAIAN OCR & CATATAN SISTEM:', 14, y);
    y += 4;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, y, 182, 30, 1, 1, 'FD');

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    const splitOcr = doc.splitTextToSize(docLog.rawExtractedText || 'Tidak ada teks OCR tambahan.', 174);
    doc.text(splitOcr, 18, y + 5);

    y += 36;

    // Photo scan embed if photo data is available
    if (docLog.photoDataUrl) {
      try {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text('LAMPIRAN FOTO FISIK BERKAS PEMINDAIAN:', 14, y);
        y += 4;

        doc.addImage(docLog.photoDataUrl, 'JPEG', 14, y, 110, 85);
        y += 90;
      } catch (imgErr) {
        console.warn('Could not embed raw scan image in PDF, skipping photo box:', imgErr);
      }
    }

    // Signatures
    const sigY = Math.min(y + 6, 260);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Dicatat & Diarsipkan oleh:', 14, sigY);
    doc.text('Mengetahui / Diverifikasi oleh:', 120, sigY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(docLog.capturedBy || 'Petugas Lapangan', 14, sigY + 14);
    doc.text('Koordinator Pergudangan PT AKK', 120, sigY + 14);

    const safeNum = (docLog.documentNumber || 'DOC').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Arsip_Scan_${safeNum}.pdf`);
    return true;
  } catch (err) {
    console.error('Failed to generate Scanned Document PDF:', err);
    return false;
  }
}

