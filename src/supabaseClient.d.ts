import { SupabaseClient } from '@supabase/supabase-js';

export declare const SUPABASE_URL: string;
export declare const SUPABASE_ANON_KEY: string;
export declare const SUPABASE_PUBLIC_KEY: string;
export declare const supabase: SupabaseClient;
export declare function testSupabase(): Promise<{ success: boolean; data?: any; error?: string }>;
export default supabase;
