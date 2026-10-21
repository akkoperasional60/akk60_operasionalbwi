import { createClient } from '@supabase/supabase-js';

// ============================================================================
// 1. SUPABASE PROJECT URL
// Tempel URL Project Supabase Anda di sini.
// CATATAN: Format standar adalah https://[project-ref].supabase.co
// Jika Anda menyertakan /rest/v1/, sanitasi otomatis di bawah akan membersihkannya.
// ============================================================================
export const SUPABASE_URL = 'https://pfysnacxaixfnyvixmmh.supabase.co/rest/v1/';

// ============================================================================
// 2. SUPABASE ANON / PUBLIC API KEY
// Tempel Kunci Anonim / Public API Key Anda di bawah ini:
// ============================================================================
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmeXNuYWN4YWl4Zm55dml4bW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjE5NTksImV4cCI6MjEwNjc5Nzk1OX0.EDGipSEnsKVaOPW0kysT7X7YeCmpoj-whr2hIl9vYJE';
export const SUPABASE_PUBLIC_KEY = SUPABASE_ANON_KEY;

// Sanitasi otomatis: hilangkan /rest/v1/ dan slash di akhir jika ada
const cleanUrl = (SUPABASE_URL || '')
  .trim()
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');

// ============================================================================
// 3. EXPORT SUPABASE CLIENT INSTANCE
// ============================================================================
export const supabase = createClient(cleanUrl, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

// Fungsi pengujian koneksi cepat
export async function testSupabase() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[Supabase] Auth error:', error.message);
      return { success: false, error: error.message };
    }
    console.log('✅ Supabase Client siap dan berhasil terhubung!');
    return { success: true, data };
  } catch (err) {
    console.error('[Supabase] Connection error:', err);
    return { success: false, error: err.message };
  }
}

