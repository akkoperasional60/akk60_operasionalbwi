import fs from 'fs';
import path from 'path';

console.log('🔍 [Pre-Build] Memeriksa variabel lingkungan (Environment Variables)...');

const requiredKeys = ['VITE_SUPABASE_URL'];
const optionalKeys = ['VITE_SUPABASE_ANON_KEY', 'GEMINI_API_KEY', 'APP_URL'];

let missingRequired: string[] = [];

// Load .env if present
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

for (const key of requiredKeys) {
  const val = process.env[key] || (import.meta as any).env?.[key];
  if (!val || val === '') {
    missingRequired.push(key);
  }
}

if (missingRequired.length > 0) {
  console.warn('⚠️ [Pre-Build Warning] Variabel lingkungan berikut belum diatur:');
  missingRequired.forEach(k => console.warn(`   - ${k}`));
  console.warn('   Pastikan telah mengonfigurasinya di Vercel Dashboard (Settings -> Environment Variables) atau berkas .env lokal.');
  console.warn('   Aplikasi akan menggunakan fallback default bawaan, namun disarankan untuk mengatur variabel ini untuk produksi.');
} else {
  console.log('✅ [Pre-Build] Semua variabel lingkungan esensial terpenuhi.');
}

console.log('🚀 [Pre-Build] Validasi lingkungan selesai. Melanjutkan proses build...');
process.exit(0);
