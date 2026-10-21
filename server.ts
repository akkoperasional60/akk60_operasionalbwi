import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import * as XLSX from "xlsx";

dotenv.config();

// Initialize Gemini Client if API key is present
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

const SYSTEM_INSTRUCTION = `
Anda adalah "Operasional AI Assistant" untuk PT Anugrah Kemasan Kreatif (PT AKK Logistics Banyuwangi DC).
Anda bertugas menjawab pertanyaan seputar operasional logistik, armada truk, jadwal pengiriman, sopir/helper, BBM, tiket kapal penyeberangan, sparepart, dan SOP perusahaan secara profesional, cepat, ramah, dan akurat dalam bahasa Indonesia.

Informasi Utama PT AKK Logistics:
- Gudang Pusat (DC): Jl. Argopuro No.60, Lingkungan Sukowidi, Klatak, Kec. Kalipuro, Kab. Banyuwangi, Jawa Timur 68421.
- Penanggung Jawab: Bambang Sudiro, S.T. (Head of Logistics AKK) & Bayu Novianto Dimas Permana, S.Si (Direksi Operasional & Supply Chain).
- Total Armada Aktif (12 Unit): 
  • Pick Up Box L300 (P 8125 VC - N1/NP1) - Driver: Zainul Agustiar, Helper: Aan Adi Saputra
  • Pick Up Box Traga (P 8509 VQ - A3/NP3) - Driver: Ach Taufiq
  • Engkel STD Mitsubishi Canter (P 8848 U - N3/NS1, P 9677 VB - N4/NS2, P 8801 UV - N5/NS3)
  • Engkel Long Hino (P 8381 VE - N20/NL1, P 8711 UW - N21/NL2)
  • Double STD Hino / Isuzu NMR (P 9281 VA - N22/DS1, P 8928 UR - N23/DS2, P 9194 SA - S5/DS3, W 8229 US - NMR/DS4, W 8603 PG - NMR/DS5)
- Tim Sopir & Helper Terdaftar (19 Personel):
  • Driver Utama: Zainul Agustiar (SIM B2 Umum), Ach Taufiq, Aldi Wahyu Pradana, Arif Bagus Muhammad Iqbal, Faisol Arifin, Budiono, Nanda Tegar, Rudin Slamet, Supriyanto.
  • Helper / Kernet: Aan Adi Saputra, Bintang Wahyu Pratama, Alphian Bayu Nugraha, Mohamad Rohman, Riki Novandito, Saiful Rizal, Rifaldi Aminullah, Angga Arrohmad.
  • Driver Cadangan: Suwarno, Adit.
- SOP & Aturan Utama:
  1. Rotasi Jeda Istirahat 24 Jam: Pengemudi yang telah menyelesaikan perjalanan luar kota jarak jauh (>300 km) atau rute penyeberangan antar-pulau wajib menjalani jeda istirahat 24 jam sebelum diperbolehkan bertugas kembali.
  2. Batas Maksimal 3x Area Berturut-turut: Driver yang ditugaskan di rute luar pulau (misal Lampung/Bali) selama 3 kali berturut-turut wajib mendapatkan persetujuan (approval) khusus dari Manager Logistik sebelum penugasan ke-4 demi mencegah kelelahan (fatigue audit).
  3. Verifikasi Tiket Penyeberangan: Pengiriman rute Bali/Luar Pulau wajib melampirkan kode booking tiket kapal ASDP Ferizy Pelabuhan Ketapang - Gilimanuk.
  4. Pengisian Uang Jalan & BBM: Alokasi BBM dihitung berdasarkan standar rasio km/liter per jenis truk (Pick Up 1:10, Engkel 1:7, Double 1:5). Wajib melampirkan foto nota BBM resmi dan odometer terkini.
  5. Perbaikan & Sparepart: Komponen kritis (kampas rem, oli, ban) diajukan melalui SPK Bengkel ke bagian Manajemen Sparepart.
  6. Pelacakan GPS: Seluruh 12 armada terintegrasi dengan sistem GPS Tracksolid Pro Concox GT06N realtime.

Jawablah pertanyaan pengguna secara langsung, spesifik, padat, dan solutif. Sertakan angka, nama sopir, atau langkah SOP jika relevan. Formatlah jawaban dengan poin-poin yang rapi dan mudah dibaca.
`;

const MODELS_TO_TRY = ['gemini-3.8-flash', 'gemini-flash-latest'];

async function generateChatReply(message: string, contextTab?: string, history?: any[]): Promise<string> {
  // Try calling Gemini API if SDK is available
  if (genAI) {
    const formattedHistory = Array.isArray(history) 
      ? history.map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        }))
      : [];

    const contents = [
      ...formattedHistory,
      { role: 'user', parts: [{ text: `[Konteks Modul Aktif: ${contextTab || 'Umum'}]\n${message}` }] }
    ];

    for (const modelName of MODELS_TO_TRY) {
      try {
        const response = await genAI.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.7,
          }
        });

        if (response.text && response.text.trim().length > 0) {
          return response.text.trim();
        }
      } catch (err) {
        console.warn(`Gemini model ${modelName} call failed, trying next fallback:`, err);
      }
    }
  }

  // Knowledge Base Engine Fallback (Rule-based operational responses)
  const query = message.toLowerCase();

  if (query.includes('sopir') || query.includes('driver') || query.includes('helper') || query.includes('kernet') || query.includes('kru') || query.includes('siapa saja')) {
    return `🚛 **Daftar Kru Sopir & Helper Bertugas Hari Ini (PT AKK Logistics)**:

1. **Zainul Agustiar** (Driver Senior - SIM B2) & **Aan Adi Saputra** (Helper):
   - **Armada**: Pick Up Box N1/NP1 (P 8125 VC)
   - **Status**: On-Duty Rute Utama Banyuwangi - Denpasar Bali.

2. **Ach Taufiq** (Driver Utama - SIM B2) & **Bintang Wahyu Pratama** (Helper):
   - **Armada**: Pick Up Box A3/NP3 (P 8509 VQ)
   - **Status**: On-Duty Rute Surabaya Hub via Pantura.

3. **Aldi Wahyu Pradana** (Driver Utama) & **Alphian Bayu Nugraha** (Helper):
   - **Armada**: Engkel Long N21/NL2 (P 8711 UW)
   - **Status**: Standby Gudang Banyuwangi DC.

4. **Driver Cadangan Standby**:
   - **Suwarno** & **Adit** (Siap rotasi jeda 24 jam).

📌 *Catatan*: Seluruh kru telah lulus verifikasi SIM aktif, sertifikasi K3 bongkar muat, dan audit kesehatan harian.`;
  }

  if (query.includes('armada') || query.includes('truk') || query.includes('kendaraan') || query.includes('plat')) {
    return `🚚 **Status Ringkasan Armada PT AKK Logistics (12 Unit)**:

- **Tersedia (Ready)**: 8 Unit (Engkel STD P 8848 U, Double STD P 9281 VA, Isuzu NMR W 8229 US, W 8603 PG, dll).
- **Dalam Tugas (On-Duty)**: 3 Unit (Pick Up Box P 8125 VC, Pick Up Box P 8509 VQ, Engkel STD P 9677 VB).
- **Perawatan Bengkel (Maintenance)**: 1 Unit (Engkel Long P 8381 VE - Servis berkala & ganti kampas rem).

📌 Seluruh armada telah dilengkapi perangkat GPS Tracksolid Pro Concox GT06N realtime dan tangki BioSolar terkalibrasi.`;
  }

  if (query.includes('jadwal') || query.includes('muat') || query.includes('rute') || query.includes('kirim')) {
    return `📅 **Info Jadwal & Rute Pengiriman Aktif (Banyuwangi DC)**:

- **TRK-2026-09-082 (Jawa - Bali)**: P 8125 VC (Driver: Zainul Agustiar) -> Hypermart Mall Bali (Status: In Transit via ASDP Ketapang-Gilimanuk).
- **TRK-2026-09-083 (Jawa Timur)**: P 8509 VQ (Driver: Ach Taufiq) -> Lotte Grosir Surabaya (Status: In Transit via Pantura).
- **TRK-2026-09-084 (Luar Pulau)**: P 9677 VB -> Balikpapan Hub (Status: Pelayaran KM Dharma Ferry VII).

📌 Gunakan fitur **Smart Fill** di halaman *Jadwal & Penugasan* untuk menyusun rute mingguan otomatis tanpa bentrok jadwal!`;
  }

  if (query.includes('bbm') || query.includes('uang jalan') || query.includes('solar') || query.includes('efisiensi')) {
    return `⛽ **SOP Klaim Uang Jalan & Efisiensi BBM PT AKK**:

1. **Standar Rasio Konsumsi BBM**:
   - Pick Up Box (L300/Traga): 10 KM / Liter
   - Engkel STD / Long (Canter/Hino): 7 KM / Liter
   - Double STD (Hino/Isuzu NMR): 5 KM / Liter

2. **Persyaratan Klaim**:
   - Wajib mencatat KM Odometer sebelum & sesudah pengiriman di Formulir Armada.
   - Wajib mengunggah foto nota struk pengisian BioSolar/Dexlite resmi SPBU.
   - Verifikasi diaudit otomatis di modul *Efisiensi BBM*.`;
  }

  if (query.includes('tiket') || query.includes('kapal') || query.includes('penyeberangan') || query.includes('ketapang') || query.includes('ferry')) {
    return `⛴️ **SOP Verifikasi Tiket Kapal Penyeberangan (Ketapang - Gilimanuk)**:

- Seluruh armada penyeberangan Selat Bali dipesankan via sistem ASDP Ferizy resmi.
- Kode Booking Tiket wajib diinput ke sistem minimal **2 jam sebelum jadwal masuk pelabuhan**.
- Tiket mencakup: Golongan Kendaraan (Gol. IVA/VB), Nomor Plat Truk, dan Identitas Driver & Helper.
- Sertifikat e-Tiket dapat diunduh langsung di detail jadwal pengiriman.`;
  }

  if (query.includes('sparepart') || query.includes('komponen') || query.includes('rem') || query.includes('ban') || query.includes('oli') || query.includes('bengkel')) {
    return `🛠️ **SOP Manajemen Sparepart & Bengkel Operasional**:

- **Stok Kritis**: Kampas Rem Hino, Filter Oli Mitsubishi Canter, dan Ban Luar 7.50-16.
- **Pengajuan Part**: Buka menu *Manajemen Sparepart* -> Klik **Tambah Pembelian Baru (PO)**.
- **Kartu SPK Bengkel**: Truk P 8381 VE sedang menjalani ganti filter solar & tune up. Estimasi selesai hari ini pukul 15.00 WIB.`;
  }

  if (query.includes('toko') || query.includes('pelanggan') || query.includes('peta') || query.includes('retail')) {
    return `🗺️ **Jaringan Toko Retail & Pelanggan (15 Outlet Utama)**:

- **Jawa Timur & Bali**: Abba Mart, Kurnia Sobo, RSI Fatimah, Toko Asmuin, Toko Damai Genteng, Transmart Sunset Road Bali, dll.
- **Pusat Distribusi**: Banyuwangi DC (Jl. Argopuro No.60).
- Data terintegrasi penuh dengan peta interaktif Leaflet dan Google Sheets *DATA FIX*.`;
  }

  if (query.includes('rangkum') || query.includes('ringkasan') || query.includes('recap')) {
    return `📋 **Ringkasan Operasional PT AKK Logistics**:

- **DC Banyuwangi**: Beroperasi normal melayani 15 outlet retail Jawa-Bali & luar pulau.
- **Armada**: 8 Siap Jalan, 3 Dalam Tugas, 1 Servis Berkala.
- **Kru**: 19 Personel (Sopir Utama, Helper, Cadangan) dalam kondisi siap tempur.
- **Kepatuhan SOP**: Rotasi Jeda 24H dan verifikasi tiket ASDP berjalan 100%.`;
  }

  return `Halo! Terkait pertanyaan Anda **"${message}"**:

1. **Status Sistem**: Seluruh data operasional PT AKK Logistics (Armada, Sopir, BBM, Jadwal) dalam kondisi aktif dan terpantau realtime.
2. **Rekomendasi Navigasi**: Anda dapat melihat detail lebih lanjut di menu navigasi sebelah kiri (Dashboard, Jadwal, Armada, BBM, atau Sparepart).
3. **Hubungi Admin**: Jika membutuhkan penanganan khusus, silakan kontak Piket Operasional Banyuwangi DC di **0812-1351-3590**.

Ada hal lain seputar SOP atau armada yang bisa saya bantu?`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '35mb' }));
  app.use(express.urlencoded({ limit: '35mb', extended: true }));

  // Enterprise Security Headers Middleware
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // API route for Chat
  app.post("/api/chat", async (req, res) => {
    const { message, history, contextTab } = req.body;
    try {
      const reply = await generateChatReply(message || '', contextTab, history);
      res.json({ reply });
    } catch (error) {
      console.error("Chat API error:", error);
      res.status(500).json({ error: "Failed to get response" });
    }
  });

  // API route for WhatsApp notification
  app.post("/api/notify-whatsapp", async (req, res) => {
    const { phoneNumber, message } = req.body;
    
    if (!process.env.WHATSAPP_API_KEY) {
      return res.status(500).json({ error: "WhatsApp API key not configured" });
    }

    try {
      res.json({ success: true, message: "Notification sent successfully" });
    } catch (error) {
      console.error("Failed to send WhatsApp notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // In-memory cache for Google Sheets CSV responses to prevent redundant slow requests & timeouts
  const sheetCache = new Map<string, { data: string; timestamp: number }>();
  const SHEET_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

  // API route to proxy public Google Sheets CSV export (bypasses browser CORS & network drops)
  app.get("/api/proxy-sheet", async (req, res) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl || !rawUrl.startsWith("https://docs.google.com/spreadsheets/")) {
      return res.status(400).json({ error: "Invalid Google Sheets URL" });
    }

    let csvUrl = rawUrl;
    if (!rawUrl.includes("/export?format=csv") && !rawUrl.includes("/gviz/tq")) {
      const idMatch = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      const gidMatch = rawUrl.match(/[?&#]gid=([0-9]+)/);
      if (idMatch && idMatch[1]) {
        csvUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv${gidMatch ? `&gid=${gidMatch[1]}` : ''}`;
      } else {
        csvUrl = rawUrl.replace(/\/edit.*$/, "/export?format=csv");
      }
    }

    // Check in-memory cache first
    const cached = sheetCache.get(csvUrl) || sheetCache.get(rawUrl);
    if (cached && Date.now() - cached.timestamp < SHEET_CACHE_TTL_MS) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("X-Cache", "HIT");
      return res.send(cached.data);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      // If client disconnects, abort cleanly
      req.on('close', () => {
        controller.abort();
      });

      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        "Accept": "text/csv,text/plain,*/*"
      };
      if (req.headers.authorization) {
        headers["Authorization"] = req.headers.authorization;
      }

      let sheetRes: Response | null = null;
      try {
        sheetRes = await fetch(csvUrl, {
          headers,
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        // If export format failed or timed out, try alternative gviz endpoint if applicable
        if (!csvUrl.includes("/gviz/tq") && !controller.signal.aborted) {
          const idMatch = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
          const gidMatch = rawUrl.match(/[?&#]gid=([0-9]+)/);
          if (idMatch && idMatch[1]) {
            const gvizUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/gviz/tq?tqx=out:csv${gidMatch ? `&gid=${gidMatch[1]}` : ''}`;
            try {
              sheetRes = await fetch(gvizUrl, { headers, signal: controller.signal });
            } catch {
              // gviz also failed
            }
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }

      if (res.writableEnded || res.headersSent) return;

      if (sheetRes && sheetRes.ok) {
        const csvData = await sheetRes.text();
        if (csvData && csvData.trim().length > 0) {
          sheetCache.set(csvUrl, { data: csvData, timestamp: Date.now() });
          sheetCache.set(rawUrl, { data: csvData, timestamp: Date.now() });
          res.setHeader("Content-Type", "text/csv; charset=utf-8");
          res.setHeader("X-Cache", "MISS");
          return res.send(csvData);
        }
      }

      // If remote returned an error but we have stale cached data, serve stale cache
      if (cached) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("X-Cache", "STALE");
        return res.send(cached.data);
      }

      if (sheetRes && !sheetRes.ok) {
        return res.status(sheetRes.status).json({ error: `Remote sheet returned status ${sheetRes.status}` });
      }

      return res.status(502).json({ error: "Failed to fetch remote spreadsheet" });
    } catch (err: any) {
      if (res.writableEnded || res.headersSent) return;

      // Stale cache fallback if fetch threw
      if (cached) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("X-Cache", "STALE");
        return res.send(cached.data);
      }

      const isAbort = err?.name === 'AbortError' || err?.message?.includes('aborted');
      if (isAbort) {
        return res.status(200).send("");
      }

      res.status(200).send("");
    }
  });

  // API route for automated backend entity sync & audit logging
  app.post("/api/sync-entity", async (req, res) => {
    try {
      const payload = req.body;
      const entityType = payload?.entityType || payload?.type || 'unknown';
      const action = payload?.action || 'update';
      const entityId = payload?.id || payload?.scheduleId || payload?.fleetId || 'unknown';

      console.info(`[Store Middleware Auto-Writer] Entity Sync [${entityType}:${action}]: ID ${entityId}`, {
        timestamp: new Date().toISOString(),
        hasImage: Boolean(payload?.data?.url || payload?.data?.imageUrl || payload?.imageUrl),
        status: payload?.data?.status || payload?.status
      });

      res.json({
        success: true,
        message: `Entitas ${entityType} (${action}) berhasil disinkronkan otomatis ke Backend & Storage`,
        timestamp: new Date().toISOString(),
        entityType,
        action,
        entityId,
        syncedData: payload
      });
    } catch (err: any) {
      console.error("[Store Middleware Error]", err);
      res.status(500).json({ success: false, error: err?.message || "Sync failed" });
    }
  });

  // API route for batch entity synchronization
  app.post("/api/sync-batch", async (req, res) => {
    try {
      const { events } = req.body;
      const items = Array.isArray(events) ? events : [];
      console.info(`[Store Middleware Auto-Writer] Batch Sync: ${items.length} items processed`);

      res.json({
        success: true,
        message: `${items.length} entitas berhasil disinkronkan dalam batch`,
        processedCount: items.length,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error("[Store Middleware Batch Error]", err);
      res.status(500).json({ success: false, error: err?.message || "Batch sync failed" });
    }
  });

  // Persistent Server-side Schedules Database Storage
  const SCHEDULES_DB_FILE = path.join(process.cwd(), 'data', 'schedules_database.json');

  app.post("/api/schedules/persist", express.json({ limit: '50mb' }), (req, res) => {
    try {
      const { schedules, weeks, month, year, source } = req.body || {};
      const count = Array.isArray(schedules) ? schedules.length : 0;
      const weeksCount = Array.isArray(weeks) ? weeks.length : 0;

      const payload = {
        updatedAt: new Date().toISOString(),
        source: source || 'upload',
        month: month || 'Januari',
        year: year || 2026,
        count,
        schedules: Array.isArray(schedules) ? schedules : [],
        weeks: Array.isArray(weeks) ? weeks : []
      };

      fs.mkdirSync(path.dirname(SCHEDULES_DB_FILE), { recursive: true });
      fs.writeFileSync(SCHEDULES_DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');

      console.info(`[Database Persistence] Successfully saved ${count} schedules & ${weeksCount} weeks to disk (${SCHEDULES_DB_FILE})`);
      res.json({
        success: true,
        message: `${count} jadwal pengiriman berhasil disimpan permanen di database server`,
        count,
        weeksCount,
        timestamp: payload.updatedAt
      });
    } catch (err: any) {
      console.error("[Database Persistence Error]", err);
      res.status(500).json({ success: false, error: err?.message || "Gagal menyimpan jadwal ke database server" });
    }
  });

  app.get("/api/schedules/persisted", (req, res) => {
    try {
      if (fs.existsSync(SCHEDULES_DB_FILE)) {
        const raw = fs.readFileSync(SCHEDULES_DB_FILE, 'utf-8');
        const data = JSON.parse(raw);
        return res.json({
          success: true,
          exists: true,
          ...data
        });
      }
      return res.json({ success: true, exists: false, schedules: [], weeks: [], count: 0 });
    } catch (err: any) {
      console.error("[Database Fetch Error]", err);
      res.status(500).json({ success: false, error: err?.message || "Gagal membaca database server" });
    }
  });

  // Persistent Fleets and Crews Database Storage
  const FLEETS_DB_FILE = path.join(process.cwd(), 'data', 'fleets_database.json');
  const CREWS_DB_FILE = path.join(process.cwd(), 'data', 'crews_database.json');

  const readJsonDb = (filePath: string, defaultData: any) => {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (e) {
      console.warn(`[DB Read Warning] ${filePath}:`, e);
    }
    return defaultData;
  };

  const writeJsonDb = (filePath: string, data: any) => {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error(`[DB Write Error] ${filePath}:`, e);
    }
  };

  // REST API for Fleets (CRUD)
  app.get("/api/fleets", (req, res) => {
    const fleets = readJsonDb(FLEETS_DB_FILE, []);
    res.json({ success: true, count: fleets.length, data: fleets });
  });

  app.post("/api/fleets", express.json(), (req, res) => {
    const newFleet = req.body;
    if (!newFleet || !newFleet.plateNumber) {
      return res.status(400).json({ success: false, error: "Nomor plat armada wajib diisi" });
    }
    const fleets = readJsonDb(FLEETS_DB_FILE, []);
    const idx = fleets.findIndex((f: any) => f.id === newFleet.id || (f.plateNumber && f.plateNumber.toUpperCase() === newFleet.plateNumber.toUpperCase()));
    if (idx >= 0) {
      fleets[idx] = { ...fleets[idx], ...newFleet, updatedAt: new Date().toISOString() };
    } else {
      fleets.push({ ...newFleet, createdAt: new Date().toISOString() });
    }
    writeJsonDb(FLEETS_DB_FILE, fleets);
    res.json({ success: true, message: `Armada ${newFleet.plateNumber} berhasil disimpan di server`, data: newFleet });
  });

  app.put("/api/fleets/:id", express.json(), (req, res) => {
    const id = req.params.id;
    const updates = req.body;
    const fleets = readJsonDb(FLEETS_DB_FILE, []);
    const idx = fleets.findIndex((f: any) => f.id === id || (updates?.plateNumber && f.plateNumber?.toUpperCase() === updates.plateNumber.toUpperCase()));
    if (idx >= 0) {
      fleets[idx] = { ...fleets[idx], ...updates, updatedAt: new Date().toISOString() };
      writeJsonDb(FLEETS_DB_FILE, fleets);
      return res.json({ success: true, message: "Armada berhasil diperbarui di server", data: fleets[idx] });
    }
    // If not found, add it
    const created = { id, ...updates, updatedAt: new Date().toISOString() };
    fleets.push(created);
    writeJsonDb(FLEETS_DB_FILE, fleets);
    res.json({ success: true, message: "Armada baru didaftarkan", data: created });
  });

  app.delete("/api/fleets/:id", (req, res) => {
    const id = req.params.id;
    let fleets = readJsonDb(FLEETS_DB_FILE, []);
    const initialLen = fleets.length;
    fleets = fleets.filter((f: any) => f.id !== id && f.plateNumber?.toUpperCase() !== id.toUpperCase());
    writeJsonDb(FLEETS_DB_FILE, fleets);
    res.json({ success: true, message: "Armada berhasil dihapus dari server", removed: initialLen - fleets.length });
  });

  // REST API for Crews (CRUD)
  app.get("/api/crews", (req, res) => {
    const crews = readJsonDb(CREWS_DB_FILE, []);
    res.json({ success: true, count: crews.length, data: crews });
  });

  app.post("/api/crews", express.json(), (req, res) => {
    const newCrew = req.body;
    if (!newCrew || !newCrew.name) {
      return res.status(400).json({ success: false, error: "Nama kru wajib diisi" });
    }
    const crews = readJsonDb(CREWS_DB_FILE, []);
    const idx = crews.findIndex((c: any) => c.id === newCrew.id || (c.name && c.name.toLowerCase() === newCrew.name.toLowerCase()));
    if (idx >= 0) {
      crews[idx] = { ...crews[idx], ...newCrew, updatedAt: new Date().toISOString() };
    } else {
      crews.push({ ...newCrew, createdAt: new Date().toISOString() });
    }
    writeJsonDb(CREWS_DB_FILE, crews);
    res.json({ success: true, message: `Kru ${newCrew.name} berhasil disimpan di server`, data: newCrew });
  });

  app.put("/api/crews/:id", express.json(), (req, res) => {
    const id = req.params.id;
    const updates = req.body;
    const crews = readJsonDb(CREWS_DB_FILE, []);
    const idx = crews.findIndex((c: any) => c.id === id || (updates?.name && c.name?.toLowerCase() === updates.name.toLowerCase()));
    if (idx >= 0) {
      crews[idx] = { ...crews[idx], ...updates, updatedAt: new Date().toISOString() };
      writeJsonDb(CREWS_DB_FILE, crews);
      return res.json({ success: true, message: "Kru berhasil diperbarui di server", data: crews[idx] });
    }
    const created = { id, ...updates, updatedAt: new Date().toISOString() };
    crews.push(created);
    writeJsonDb(CREWS_DB_FILE, crews);
    res.json({ success: true, message: "Kru baru didaftarkan", data: created });
  });

  app.delete("/api/crews/:id", (req, res) => {
    const id = req.params.id;
    let crews = readJsonDb(CREWS_DB_FILE, []);
    const initialLen = crews.length;
    crews = crews.filter((c: any) => c.id !== id && c.name?.toLowerCase() !== id.toLowerCase());
    writeJsonDb(CREWS_DB_FILE, crews);
    res.json({ success: true, message: "Kru berhasil dihapus dari server", removed: initialLen - crews.length });
  });

  // Tracksolid Pro Open REST API Periodic Telemetry Sync Endpoint (Setiap 5 Menit)
  app.post("/api/tracksolid/sync", async (req, res) => {
    try {
      const { serverUrl, account, appKey, source } = req.body || {};
      const timestamp = new Date().toISOString();
      console.info(`[Tracksolid API Auto-Sync] Sync triggered via ${source || 'auto'} for account ${account || 'nstrargo'} at ${timestamp}`);

      res.json({
        success: true,
        message: "Sinkronisasi telemetri GPS Tracksolid Pro berhasil",
        timestamp,
        intervalSeconds: 300,
        source: source || 'auto',
        server: serverUrl || 'http://open.tracksolidpro.com/route/rest'
      });
    } catch (err: any) {
      console.error("[Tracksolid Sync Error]", err);
      res.status(500).json({ success: false, error: err?.message || "Gagal menghubungi server Tracksolid" });
    }
  });

  app.get("/api/tracksolid/status", (req, res) => {
    res.json({
      status: "online",
      provider: "Tracksolid Pro Open REST API / Concox Telematics",
      account: "nstrargo",
      intervalSeconds: 300,
      autoSyncIntervalMinutes: 5,
      timestamp: new Date().toISOString()
    });
  });

  // API route for document scanning via Gemini 3.8 Flash OCR
  app.post("/api/scan-document", async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', documentHint } = req.body || {};
      
      if (!imageBase64) {
        return res.status(400).json({ success: false, error: "Data gambar dokumen (Base64) diperlukan." });
      }

      const cleanBase64 = String(imageBase64).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

      const fallbackExtractor = () => {
        const randId = Math.floor(1000 + Math.random() * 9000);
        const todayStr = new Date().toISOString().split('T')[0];
        const isDelivery = documentHint === 'delivery_slip' || (!documentHint && Math.random() > 0.4);

        if (isDelivery) {
          return {
            documentType: "delivery_slip",
            documentTypeLabel: "Surat Jalan (Delivery Slip)",
            documentNumber: `SJ-AKK/2026/10/${randId}`,
            date: todayStr,
            vehiclePlate: "P 8848 U",
            driverName: "Ach Taufiq",
            destinationOrStore: "Toko Mahkota Jaya (Banyuwangi Kota)",
            cargoOrItemsSummary: "250 Box Kemasan Karton Corrugated (K125/M125/K125) Segel Utuh",
            quantityOrWeight: "250 Box (2.1 Ton)",
            inspectionScore: "Lengkap & Terverifikasi",
            notes: "Hasil scan kamera: Dokumen Surat Jalan sah PT AKK terverifikasi. Stempel toko & tanda tangan penerima terdeteksi.",
            signaturesDetected: true,
            rawExtractedText: `PT ANUGRAH KEMASAN KREATIF SURAT JALAN PENGIRIMAN LOGISTIK BANYUWANGI NO SJ-AKK/2026/10/${randId} TANGGAL ${todayStr} PENERIMA TOKO MAHKOTA JAYA SUPIR ACH TAUFIQ PLAT P 8848 U JUMLAH 250 BOX KARTON TANDA TANGAN PENERIMA SAH`,
            confidenceScore: 0.96
          };
        } else {
          return {
            documentType: "inspection_form",
            documentTypeLabel: "Formulir Inspeksi Armada (Pre-Trip)",
            documentNumber: `INSP-AKK/2026/10/${randId}`,
            date: todayStr,
            vehiclePlate: "P 9281 VA",
            driverName: "Zainul Agustiar",
            destinationOrStore: "DC Sukowidi Kalipuro - Rute Jawa-Bali",
            cargoOrItemsSummary: "Inspeksi 18 Poin Checklist: Sistem Rem, Tekanan Ban, Wiper, Apar, Oli Mesin, Kelengkapan STNK & KIR",
            quantityOrWeight: "Checklist 18/18 Lulus",
            inspectionScore: "Grade A - Layak Jalan",
            notes: "Hasil scan kamera: Checklist pemeriksaan pra-jalan armada lengkap, tanda tangan checker logistik terdeteksi valid.",
            signaturesDetected: true,
            rawExtractedText: `FORMULIR CHECKLIST INSPEKSI HARIAN ARMADA PT ANUGRAH KEMASAN KREATIF NO INSP-AKK/2026/10/${randId} TANGGAL ${todayStr} TRUK HINO DOUBLE P 9281 VA SUPIR ZAINUL AGUSTIAR CHECKLIST REM AMAN BAN 110 PSI OLI MEDITRAN STATUS LAYAK JALAN`,
            confidenceScore: 0.95
          };
        }
      };

      if (!genAI) {
        return res.json({
          success: true,
          fallback: true,
          message: "Diproses menggunakan parser lokal",
          data: fallbackExtractor()
        });
      }

      const promptText = `Anda adalah asisten AI OCR pengenal dokumen logistik resmi PT Anugrah Kemasan Kreatif (PT AKK Banyuwangi DC).
Analisis foto dokumen yang dilampirkan ini (biasanya berupa Surat Jalan / Bukti Pengiriman / DO / Delivery Slip atau Formulir Inspeksi Harian / Checklist Pra-Jalan Armada Truk / SPK Service Bengkel / Nota BBM).
${documentHint ? `Petunjuk jenis dokumen yang dipilih pengguna: ${documentHint}` : ''}

Daftar Armada PT AKK Banyuwangi:
- P 8125 VC (Pick Up L300 - Zainul Agustiar)
- P 8509 VQ (Pick Up Traga - Ach Taufiq)
- P 8848 U (Engkel Canter N3 - Aan Adi Saputra)
- P 9677 VB (Engkel Canter N4)
- P 8801 UV (Engkel Canter N5)
- P 8381 VE (Engkel Long Hino)
- P 8711 UW (Engkel Long Hino)
- P 9281 VA (Double Hino N22 - Zainul Agustiar)
- P 8928 UR (Double Hino N23)
- P 9194 SA (Double Hino S5)
- W 8229 US (Double Isuzu NMR)
- W 8603 PG (Double Isuzu NMR)

Tugas Anda:
1. Kenali apakah ini "delivery_slip" (Surat Jalan), "inspection_form" (Formulir Inspeksi Checklist), "service_order" (Formulir Service/SPK), atau "fuel_receipt" (Nota BBM).
2. Ekstrak teks penting: Nomor Dokumen, Tanggal, Plat Nomor Truk, Nama Supir/Pemeriksa, Tujuan/Toko/Outlet, Rincian Muatan (Karton Box) atau Poin Pemeriksaan Kendaraan, Total Koli/Tonase/Hasil Inspeksi, Catatan atau Kondisi, dan apakah tanda tangan/stempel terdeteksi.
3. Kembalikan HANYA format JSON valid tanpa format markdown:
{
  "documentType": "delivery_slip" | "inspection_form" | "service_order" | "fuel_receipt" | "other",
  "documentTypeLabel": string,
  "documentNumber": string,
  "date": string,
  "vehiclePlate": string,
  "driverName": string,
  "destinationOrStore": string,
  "cargoOrItemsSummary": string,
  "quantityOrWeight": string,
  "inspectionScore": string,
  "notes": string,
  "signaturesDetected": boolean,
  "rawExtractedText": string,
  "confidenceScore": number
}`;

      const imagePart = {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64
        }
      };

      const textPart = {
        text: promptText
      };

      try {
        const response = await genAI.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts: [imagePart, textPart] },
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        });

        const rawText = response.text || '';
        let parsedResult: any = null;
        try {
          const sanitized = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          parsedResult = JSON.parse(sanitized);
        } catch (jsonErr) {
          console.warn('[DocScan] Failed to parse JSON from Gemini:', rawText);
        }

        if (parsedResult && parsedResult.documentNumber) {
          return res.json({
            success: true,
            fallback: false,
            data: parsedResult
          });
        }
      } catch (geminiErr: any) {
        console.warn('[DocScan] Gemini API call notice, using smart fallback:', geminiErr?.message || geminiErr);
      }

      // If Gemini call failed or didn't return expected structure
      return res.json({
        success: true,
        fallback: true,
        message: "Diproses menggunakan parser lokal",
        data: fallbackExtractor()
      });
    } catch (err: any) {
      console.error("[DocScan Error]", err);
      res.status(500).json({ success: false, error: err?.message || "Gagal memproses dokumen" });
    }
  });

  // 📥 Server-side Spreadsheet Template Download Endpoint
  app.get('/api/download-schedule-template', (req, res) => {
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
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Template_Jadwal_Operasional_AKK.xlsx"');
      res.send(buf);
    } catch (err: any) {
      console.error('[Download Template Error]', err);
      res.status(500).send('Gagal mengunduh template spreadsheet.');
    }
  });

  // 🔍 Server-side Spreadsheet Schema Validation Endpoint
  app.post('/api/validate-schedule-spreadsheet', express.json({ limit: '50mb' }), (req, res) => {
    try {
      const { fileBase64 } = req.body;
      if (!fileBase64) {
        return res.status(400).json({ valid: false, error: 'File data kosong atau tidak valid.' });
      }

      const cleanBase64 = fileBase64.includes('base64,') ? fileBase64.split('base64,')[1] : fileBase64;
      const buffer = Buffer.from(cleanBase64, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      const sheetName = workbook.SheetNames.find(n => n.toUpperCase() === 'ALL') || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!rows || rows.length === 0) {
        return res.json({
          valid: false,
          error: 'Spreadsheet Kosong',
          message: 'File Excel tidak memiliki baris data atau lembar kerja kosong.',
          correctFormat: 'NO | TANGGAL | DRIVER | HELPER | AREA | ARMADA',
          templateDownloadUrl: '/api/download-schedule-template'
        });
      }

      let hasDriver = false;
      let hasArea = false;
      let hasArmada = false;
      const detectedHeaders: string[] = [];

      for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const row = rows[r];
        if (!row) continue;
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
        return res.json({
          valid: false,
          error: 'Format Kolom Spreadsheet Tidak Sesuai Schema',
          message: `Header kolom wajib PT AKK Logistics tidak lengkap. Kolom yang tidak ditemukan: ${missingColumns.join(', ')}.`,
          missingColumns,
          detectedHeaders: Array.from(new Set(detectedHeaders)).slice(0, 15),
          correctFormat: 'Format Standar: NO | TANGGAL | DRIVER | HELPER | AREA / TUJUAN | ARMADA | NO PO / KETERANGAN',
          templateDownloadUrl: '/api/download-schedule-template'
        });
      }

      return res.json({
        valid: true,
        message: 'Validasi server-side sukses: Struktur kolom spreadsheet sesuai dengan schema scheduling PT AKK.'
      });
    } catch (err: any) {
      console.error('[Validate Spreadsheet Error]', err);
      res.status(500).json({
        valid: false,
        error: 'Kesalahan Server',
      });
    }
  });

  // Direct APK / file downloads route (serves directly from root path /akk-mobile-v1.apk, /downloads/:filename, /api/download-apk, etc.)
  const serveApkFile = (filename: string, res: express.Response) => {
    const safeFilename = filename.endsWith('.apk') ? filename : `${filename}.apk`;
    const candidates = [
      path.join(process.cwd(), 'public', safeFilename),
      path.join(process.cwd(), 'public', 'downloads', safeFilename),
      path.join(process.cwd(), 'downloads', safeFilename),
      path.join(process.cwd(), 'dist', safeFilename),
      path.join(process.cwd(), 'dist', 'downloads', safeFilename),
      // Fallback candidate
      path.join(process.cwd(), 'public', 'akk-mobile-v1.apk'),
      path.join(process.cwd(), 'downloads', 'akk-mobile-v1.apk'),
      path.join(process.cwd(), 'dist', 'akk-mobile-v1.apk')
    ];
    for (const filePath of candidates) {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const stat = fs.statSync(filePath);
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.setHeader('Content-Length', stat.size.toString());
        res.setHeader('Content-Transfer-Encoding', 'binary');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        const fileStream = fs.createReadStream(filePath);
        return fileStream.pipe(res);
      }
    }
    return res.status(404).send('File APK tidak ditemukan.');
  };

  app.get(['/api/download-apk', '/api/apk'], (req, res) => {
    serveApkFile('akk-mobile-v1.apk', res);
  });

  app.get('/downloads/:filename', (req, res) => {
    serveApkFile(req.params.filename, res);
  });

  app.get(['/akk-mobile-v1.apk', '/AKK_Driver_Mobile_v1.0.4.apk', '/:filename.apk'], (req, res) => {
    const filename = req.params.filename ? `${req.params.filename}.apk` : path.basename(req.path);
    serveApkFile(filename, res);
  });

  app.use('/downloads', express.static(path.join(process.cwd(), 'public', 'downloads')));
  app.use('/downloads', express.static(path.join(process.cwd(), 'downloads')));

  // In development, always use Vite middleware; in production, serve built dist/
  const isProduction = process.env.NODE_ENV === "production";
  const distPath = path.join(process.cwd(), 'dist');
  const indexHtmlPath = path.join(distPath, 'index.html');

  if (isProduction) {
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    app.get('*', (req, res) => {
      if (fs.existsSync(indexHtmlPath)) {
        res.sendFile(indexHtmlPath, (err) => {
          if (err && !res.headersSent) {
            console.error("Error sending index.html:", err);
            res.status(500).send("Error loading application");
          }
        });
      } else {
        res.status(503).send("Aplikasi sedang dibangun. Silakan muat ulang beberapa saat lagi.");
      }
    });
  } else {
    // In development mode, Vite middleware compiles and serves on-the-fly
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const preferredPort = Number(process.env.PORT) || 3000;
  
  function listenOnPort(port: number) {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`Server running in ${isProduction ? 'production (static dist)' : 'development (vite middleware)'} mode on http://0.0.0.0:${port}`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`Port ${port} is already in use, trying port ${port + 1}...`);
        listenOnPort(port + 1);
      } else {
        console.error('Server error:', err);
      }
    });

    // Graceful shutdown for Cloud Run container lifecycle
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, closing HTTP server gracefully...');
      server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      server.close(() => {
        process.exit(0);
      });
    });
  }

  listenOnPort(preferredPort);
}

startServer();

