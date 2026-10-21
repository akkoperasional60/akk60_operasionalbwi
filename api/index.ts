import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { sanitizeText, sanitizeNumber } from '../src/utils/security';

dotenv.config();

const app = express();
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ limit: '35mb', extended: true }));

// Initialize Gemini Client if API key is present
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

const SYSTEM_INSTRUCTION = `
Anda adalah "Operasional AI Assistant" untuk PT Anugrah Kemasan Kreatif (PT AKK Logistics Banyuwangi DC).
Anda bertugas menjawab pertanyaan seputar operasional logistik, armada truk, jadwal pengiriman, sopir/helper, BBM, tiket kapal penyeberangan, sparepart, dan SOP perusahaan secara profesional, cepat, ramah, dan akurat dalam bahasa Indonesia.
`;

const MODELS_TO_TRY = ['gemini-3.8-flash', 'gemini-flash-latest'];

// 1. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    platform: 'Vercel Serverless Function',
    geminiConfigured: !!apiKey
  });
});

// 2. Chat AI API
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const rawMessage = req.body?.message || '';
    const message = sanitizeText(rawMessage, 2000);
    const contextTab = sanitizeText(req.body?.contextTab || 'Umum', 100);

    if (!message) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
    }

    if (genAI) {
      for (const modelName of MODELS_TO_TRY) {
        try {
          const response = await genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: `[Konteks: ${contextTab}]\n${message}` }] }],
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              temperature: 0.7
            }
          });
          if (response.text) {
            return res.json({ reply: response.text.trim() });
          }
        } catch (err) {
          console.warn(`[Vercel API] Model ${modelName} error, trying fallback...`, err);
        }
      }
    }

    // Fallback response if API key not set or quota exceeded
    return res.json({
      reply: `Halo! Permintaan Anda seputar operasional logistik AKK Banyuwangi DC telah diterima. Silakan periksa modul Dashboard, Jadwal Pengiriman, atau Analitik Armada untuk informasi mendalam.`
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memproses pesan.', details: error.message });
  }
});

// 3. WhatsApp Notification Mock Endpoint
app.post('/api/notify-whatsapp', (req: Request, res: Response) => {
  const phone = sanitizeText(req.body?.phoneNumber || '', 30);
  const message = sanitizeText(req.body?.message || '', 1000);

  res.json({
    success: true,
    message: `Pesan WhatsApp berhasil dikirim ke nomor ${phone}`,
    preview: message.slice(0, 100) + '...',
    timestamp: new Date().toISOString()
  });
});

// 4. Tracksolid GPS Mock Sync
app.get('/api/tracksolid/status', (_req: Request, res: Response) => {
  res.json({
    connected: true,
    protocol: 'Tracksolid Pro Cloud GNSS',
    devicesTracked: 12,
    lastHeartbeat: new Date().toISOString()
  });
});

// 5. General Error Handler
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('[Vercel Serverless Error]:', err);
  res.status(500).json({ error: 'Internal Server Error', message: sanitizeText(err?.message || 'Terjadi kesalahan sistem.') });
});

export default app;
