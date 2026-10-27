// Legacy compatibility stub. Production database is Hostinger MySQL via /api/*.
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
export const SUPABASE_PUBLIC_KEY = '';
export const supabase = null;
export async function testSupabase() {
  try {
    const res = await fetch('/api/db-status');
    const data = await res.json();
    return { success: Boolean(res.ok && data?.success), data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
