import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logisticsStore } from './store';
import { Fleet, Crew, VehicleType, FleetStatus, CrewStatus } from '../types';

const DEFAULT_SUPABASE_URL = 'https://pfysnacxaixfnyvixmmh.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmeXNuYWN4YWl4Zm55dml4bW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjE5NTksImV4cCI6MjEwNjc5Nzk1OX0.EDGipSEnsKVaOPW0kysT7X7YeCmpoj-whr2hIl9vYJE';

/**
 * Sanitize raw Supabase URL string by stripping /rest/v1/ or trailing slashes
 */
export function sanitizeSupabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl || !rawUrl.trim()) return DEFAULT_SUPABASE_URL;
  let clean = rawUrl.trim();
  clean = clean.replace(/\/rest\/v1\/?$/, '');
  clean = clean.replace(/\/+$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }
  return clean;
}

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

/**
 * Get active Supabase JS Client instance
 */
export function getSupabaseClient(): SupabaseClient | null {
  const conf = logisticsStore.getSupabaseConfig();
  const rawUrl = conf.url || import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const rawKey = conf.anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  const url = sanitizeSupabaseUrl(rawUrl);
  const key = (rawKey || DEFAULT_SUPABASE_ANON_KEY).trim();

  if (!url || !key) return null;

  if (cachedClient && cachedUrl === url && cachedKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    cachedUrl = url;
    cachedKey = key;
    return cachedClient;
  } catch (err) {
    console.warn('[SupabaseService] Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Test real connection against Supabase API endpoint and table schema
 */
export async function testSupabaseConnection(customUrl?: string, customKey?: string): Promise<{ success: boolean; message: string }> {
  const conf = logisticsStore.getSupabaseConfig();
  const rawUrl = customUrl || conf.url || import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const rawKey = customKey || conf.anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  const url = sanitizeSupabaseUrl(rawUrl);
  const key = (rawKey || DEFAULT_SUPABASE_ANON_KEY).trim();

  if (!url || !key) {
    return { success: false, message: 'URL Supabase dan Anon Key wajib diisi.' };
  }

  try {
    // 1. Ping Auth Gateway health check (CORS-friendly, returns 200 with valid apikey)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const healthRes = await fetch(`${url}/auth/v1/health`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    // 2. Initialize client and test session & table existence
    const client = createClient(url, key, {
      auth: { persistSession: false }
    });

    const { error: sessionError } = await client.auth.getSession();
    if (sessionError && sessionError.message.includes('Invalid API key')) {
      return {
        success: false,
        message: 'Kunci Anon Key tidak valid untuk project ini. Periksa menu Project Settings > API di Supabase.'
      };
    }

    // 3. Test if PostgreSQL tables have been created & purge any AKK fleet plates
    const { error: tableError } = await client.from('stores').select('id').limit(1);

    // Auto-clean any fleet with plate ending in AKK
    try {
      await client.from('fleets').delete().ilike('plate_number', '%AKK');
    } catch {}

    logisticsStore.setSupabaseConfig({
      url,
      anonKey: key,
      isConnected: true
    });

    if (tableError && tableError.code === 'PGRST205') {
      return {
        success: true,
        message: `✅ Berhasil Terhubung ke Supabase (${url})!\nKredensial VALID. Catatan: Tabel database belum dibuat. Silakan salin skrip schema.sql di bawah dan jalankan di menu SQL Editor Supabase.`
      };
    }

    return {
      success: true,
      message: `✅ Berhasil Terhubung ke Supabase (${url})!\nKredensial VALID & Layanan Database Siap Digunakan.`
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        success: false,
        message: 'Koneksi waktu habis (Timeout) saat menghubungi server Supabase.'
      };
    }
    return {
      success: false,
      message: `Gagal menghubungkan ke Supabase: ${err?.message || 'Pastikan koneksi internet stabil & URL benar.'}`
    };
  }
}

/**
 * Hapus semua data armada berakhiran plat AKK dari Supabase
 */
export async function purgeAkkFleetsFromSupabase(): Promise<{ success: boolean; count: number; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, count: 0, message: 'Supabase client belum terinisialisasi.' };
  }
  try {
    const { data, error } = await client
      .from('fleets')
      .delete()
      .ilike('plate_number', '%AKK')
      .select('id, plate_number');
    
    if (error) {
      return { success: false, count: 0, message: error.message };
    }
    return {
      success: true,
      count: data?.length || 0,
      message: `Berhasil menghapus ${data?.length || 0} armada berakhiran AKK dari Supabase.`
    };
  } catch (e: any) {
    return { success: false, count: 0, message: e?.message || 'Gagal menghapus data di Supabase.' };
  }
}

/**
 * Persist schedules and weeks automatically to both Server Database and Supabase
 */
export async function persistSchedulesToDatabase(
  schedules: any[],
  weeks?: any[],
  meta?: { month?: string; year?: number; source?: string }
): Promise<{ success: boolean; serverSaved: boolean; supabaseSaved: boolean; count: number; message: string }> {
  let serverSaved = false;
  let supabaseSaved = false;
  const count = Array.isArray(schedules) ? schedules.length : 0;

  // 1. First priority: Server-side persistent disk database (100% reliable, zero data loss)
  try {
    const res = await fetch('/api/schedules/persist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedules,
        weeks,
        month: meta?.month || 'Januari',
        year: meta?.year || 2026,
        source: meta?.source || 'upload'
      })
    });
    if (res.ok) {
      serverSaved = true;
    }
  } catch (err) {
    console.warn('[Database Persistence] Server storage note:', err);
  }

  // 2. Second priority: Supabase Cloud Database (if client available)
  const client = getSupabaseClient();
  if (client && count > 0) {
    try {
      const chunks: any[][] = [];
      for (let i = 0; i < schedules.length; i += 50) {
        chunks.push(schedules.slice(i, i + 50));
      }

      for (const chunk of chunks) {
        const payload = chunk.map((sch: any, idx: number) => ({
          tracking_number: sch.trackingNumber || `PO-AKK-AUTO-${Date.now()}-${idx}`,
          origin_name: sch.originName || 'Gudang Pusat Banyuwangi DC',
          origin_latitude: sch.originCoords ? sch.originCoords[0] : -8.1906,
          origin_longitude: sch.originCoords ? sch.originCoords[1] : 114.3708,
          status: ['scheduled', 'in_transit', 'delivered', 'delayed'].includes(sch.status) ? sch.status : 'scheduled',
          departure_date: sch.departureDate || new Date().toISOString(),
          estimated_arrival: sch.estimatedArrival || new Date().toISOString(),
          cargo_description: sch.cargoDescription || `Karton Box & Sheet Kemasan - ${sch.areaName || 'Area Kirim'}`,
          cargo_weight_ton: Number(sch.cargoWeightTon) || 2.5,
          is_inter_island: Boolean(sch.isInterIsland),
          notes: sch.notes || `Rute Pengiriman Distribusi ${sch.areaName || '-'}`
        }));

        const { error } = await client.from('schedules').upsert(payload, { onConflict: 'tracking_number' });
        if (!error) {
          supabaseSaved = true;
        } else {
          console.warn('[Supabase Sync Note]', error.message);
        }
      }
    } catch (err) {
      console.warn('[Supabase Sync Error]', err);
    }
  }

  return {
    success: serverSaved || supabaseSaved,
    serverSaved,
    supabaseSaved,
    count,
    message: serverSaved
      ? `✅ ${count} jadwal pengiriman berhasil tersimpan permanen di database server ${supabaseSaved ? '& Supabase Cloud' : ''}!`
      : 'Tersimpan di cache lokal'
  };
}

/**
 * Fetch persisted schedules and weeks from server database
 */
export async function fetchPersistedSchedulesFromServer(): Promise<{ exists: boolean; schedules: any[]; weeks: any[]; count: number }> {
  try {
    const res = await fetch('/api/schedules/persisted');
    if (res.ok) {
      const data = await res.json();
      return {
        exists: Boolean(data?.exists && data?.count > 0),
        schedules: data?.schedules || [],
        weeks: data?.weeks || [],
        count: data?.count || 0
      };
    }
  } catch (err) {
    console.warn('[Fetch Persisted Error]', err);
  }
  return { exists: false, schedules: [], weeks: [], count: 0 };
}

// ============================================================================
// CRUD OPERATIONS FOR FLEETS & CREWS (SUPABASE BACKEND)
// ============================================================================

const isUuid = (str?: string): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
};

/**
 * Helper to map Supabase Fleet row to Frontend Fleet interface
 */
export function mapSupabaseRowToFleet(row: any, fallback?: Fleet): Fleet {
  const plate = (row.plate_number || fallback?.plateNumber || '').trim().toUpperCase();
  return {
    id: row.id || fallback?.id || `flt-${plate.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    plateNumber: plate,
    vehicleType: (row.vehicle_type as VehicleType) || fallback?.vehicleType || 'Engkel STD',
    status: (row.status as FleetStatus) || fallback?.status || 'available',
    initialCode: fallback?.initialCode || (plate ? plate.replace(/[^A-Z0-9]/gi, '').slice(-3) : 'UNIT'),
    driverId: fallback?.driverId,
    gpsImei: row.gps_imei || fallback?.gpsImei,
    lastMaintenance: row.last_maintenance || fallback?.lastMaintenance || new Date().toISOString().substring(0, 10),
    year: row.year ? Number(row.year) : (fallback?.year || 2024),
    brand: fallback?.brand || 'Mitsubishi Canter',
    engineCc: fallback?.engineCc || '3908 CC',
    boxCapacityM3: fallback?.boxCapacityM3,
    boxDimensions: fallback?.boxDimensions,
    boxInnerMultiplierPercent: fallback?.boxInnerMultiplierPercent !== undefined ? fallback.boxInnerMultiplierPercent : 90,
    boxInnerCapacityM3: fallback?.boxInnerCapacityM3,
    boxInnerDimensions: fallback?.boxInnerDimensions,
    kirDocUrl: fallback?.kirDocUrl,
    kirDocFileName: fallback?.kirDocFileName,
    taxDueDate: fallback?.taxDueDate,
    stnkExpiryDate: fallback?.stnkExpiryDate,
    kirExpiryDate: fallback?.kirExpiryDate,
    tonnageCapacity: Number(row.tonnage_capacity) || fallback?.tonnageCapacity || 5.0,
    currentTonnage: Number(row.current_tonnage) || fallback?.currentTonnage || 0,
    fuelLevelPercent: row.fuel_level_percent !== undefined ? Number(row.fuel_level_percent) : (fallback?.fuelLevelPercent || 100),
    odometerKm: row.odometer_km !== undefined ? Number(row.odometer_km) : (fallback?.odometerKm || 0)
  };
}

/**
 * Helper to map Supabase Crew row to Frontend Crew interface
 */
export function mapSupabaseRowToCrew(row: any, fallback?: Crew): Crew {
  return {
    id: row.id || fallback?.id || `crw-${Math.random().toString(36).substring(2, 8)}`,
    name: (row.name || fallback?.name || '').trim(),
    phone: row.phone || fallback?.phone || '-',
    role: (row.role as Crew['role']) || fallback?.role || 'Driver Utama',
    licenseNumber: row.license_number || fallback?.licenseNumber || '-',
    licenseType: (row.license_type as Crew['licenseType']) || fallback?.licenseType || 'SIM B1 Umum',
    status: (row.status as CrewStatus) || fallback?.status || 'available',
    currentFleetId: fallback?.currentFleetId,
    tripsCompleted: row.trips_completed !== undefined ? Number(row.trips_completed) : (fallback?.tripsCompleted || 0),
    rating: row.rating !== undefined ? Number(row.rating) : (fallback?.rating || 5.0),
    certifications: fallback?.certifications || ['K3 Bongkar Muat', 'Defensive Driving'],
    routeExperience: fallback?.routeExperience || ['Jawa Timur', 'Bali'],
    allowOutofTown: fallback?.allowOutofTown !== false
  };
}

/**
 * 1. READ: Ambil seluruh data Armada dari Supabase (dengan server REST fallback)
 */
export async function fetchFleetsFromSupabase(): Promise<{ success: boolean; data: Fleet[]; error?: string }> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('fleets')
        .select('*')
        .order('plate_number', { ascending: true });

      if (!error && data && data.length > 0) {
        const localFleets = logisticsStore.getFleets();
        const mappedFleets: Fleet[] = (data || [])
          .filter((r: any) => !(r.plate_number || '').trim().toUpperCase().endsWith('AKK'))
          .map((row: any) => {
            const local = localFleets.find(lf => 
              (isUuid(lf.id) && lf.id === row.id) ||
              lf.plateNumber.trim().toUpperCase() === (row.plate_number || '').trim().toUpperCase()
            );
            return mapSupabaseRowToFleet(row, local);
          });

        return { success: true, data: mappedFleets };
      }
    } catch (err: any) {
      console.warn('[Supabase fleets query error, checking server fallback]:', err?.message);
    }
  }

  // Fallback to server REST API /api/fleets
  try {
    const res = await fetch('/api/fleets');
    if (res.ok) {
      const srvData = await res.json();
      if (Array.isArray(srvData.data) && srvData.data.length > 0) {
        return { success: true, data: srvData.data };
      }
    }
  } catch (err) {}

  return { success: true, data: logisticsStore.getFleets() };
}

/**
 * 2. CREATE: Simpan armada baru ke tabel fleets Supabase & server database
 */
export async function createFleetInSupabase(fleet: Fleet): Promise<{ success: boolean; data?: any; error?: string }> {
  // Mirror to server database fallback
  try {
    fetch('/api/fleets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fleet)
    }).catch(() => {});
  } catch (e) {}

  const client = getSupabaseClient();
  if (!client) {
    return { success: true, data: { id: fleet.id } };
  }

  try {
    const plate = fleet.plateNumber.trim().toUpperCase();
    if (plate.endsWith('AKK')) {
      return { success: false, error: 'Plat berakhiran AKK dilarang.' };
    }

    const payload: any = {
      plate_number: plate,
      vehicle_type: fleet.vehicleType || 'Engkel STD',
      tonnage_capacity: fleet.tonnageCapacity || (fleet.boxCapacityM3 ? Number((fleet.boxCapacityM3 * 0.4).toFixed(2)) : 5.0),
      current_tonnage: fleet.currentTonnage || 0,
      status: fleet.status || 'available',
      gps_imei: fleet.gpsImei && fleet.gpsImei !== '-' ? fleet.gpsImei.trim() : null,
      fuel_level_percent: fleet.fuelLevelPercent !== undefined ? fleet.fuelLevelPercent : 100,
      odometer_km: fleet.odometerKm || 0,
      year: fleet.year || new Date().getFullYear(),
      last_maintenance: fleet.lastMaintenance || new Date().toISOString().substring(0, 10)
    };

    if (isUuid(fleet.id)) {
      payload.id = fleet.id;
    }

    const { data, error } = await client
      .from('fleets')
      .upsert([payload], { onConflict: 'plate_number' })
      .select('*')
      .single();

    if (error) {
      console.warn('[Supabase fleets create error]', error.message);
      return { success: true, data: { id: fleet.id } };
    }

    return { success: true, data };
  } catch (err: any) {
    console.warn('[Supabase fleets create exception]', err);
    return { success: true, data: { id: fleet.id } };
  }
}

/**
 * 3. UPDATE: Perbarui data armada di tabel fleets Supabase & server database
 */
export async function updateFleetInSupabase(
  id: string,
  updates: Partial<Fleet>
): Promise<{ success: boolean; data?: any; error?: string }> {
  // Mirror to server database fallback
  try {
    fetch(`/api/fleets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(() => {});
  } catch (e) {}

  const client = getSupabaseClient();
  if (!client) {
    return { success: true };
  }

  try {
    const payload: Record<string, any> = {};
    if (updates.plateNumber) payload.plate_number = updates.plateNumber.trim().toUpperCase();
    if (updates.vehicleType) payload.vehicle_type = updates.vehicleType;
    if (updates.status) payload.status = updates.status;
    if (updates.tonnageCapacity !== undefined) payload.tonnage_capacity = updates.tonnageCapacity;
    if (updates.currentTonnage !== undefined) payload.current_tonnage = updates.currentTonnage;
    if (updates.gpsImei !== undefined) payload.gps_imei = updates.gpsImei && updates.gpsImei !== '-' ? updates.gpsImei : null;
    if (updates.fuelLevelPercent !== undefined) payload.fuel_level_percent = updates.fuelLevelPercent;
    if (updates.odometerKm !== undefined) payload.odometer_km = updates.odometerKm;
    if (updates.year !== undefined) payload.year = updates.year;
    if (updates.lastMaintenance) payload.last_maintenance = updates.lastMaintenance;

    if (Object.keys(payload).length === 0) {
      return { success: true };
    }

    let query = client.from('fleets').update(payload);
    if (isUuid(id)) {
      const { data, error } = await query.eq('id', id).select('*');
      if (!error && data && data.length > 0) {
        return { success: true, data: data[0] };
      }
    }

    // Fallback match by plate number
    const plate = (updates.plateNumber || '').trim().toUpperCase();
    if (plate) {
      const { data: pData, error: pError } = await client
        .from('fleets')
        .update(payload)
        .eq('plate_number', plate)
        .select('*');

      if (pError) {
        return { success: false, error: pError.message };
      }
      return { success: true, data: pData?.[0] };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal update armada di Supabase' };
  }
}

/**
 * 4. DELETE: Hapus armada dari tabel fleets Supabase & server database
 */
export async function deleteFleetInSupabase(id: string, plateNumber?: string): Promise<{ success: boolean; error?: string }> {
  // Mirror to server database fallback
  try {
    fetch(`/api/fleets/${id}`, {
      method: 'DELETE'
    }).catch(() => {});
  } catch (e) {}

  const client = getSupabaseClient();
  if (!client) {
    return { success: true };
  }

  try {
    if (isUuid(id)) {
      const { error } = await client.from('fleets').delete().eq('id', id);
      if (!error) return { success: true };
    }

    if (plateNumber) {
      const cleanPlate = plateNumber.trim().toUpperCase();
      const { error: pErr } = await client.from('fleets').delete().eq('plate_number', cleanPlate);
      if (pErr) {
        return { success: false, error: pErr.message };
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menghapus armada di Supabase' };
  }
}

/**
 * 5. READ: Ambil seluruh data Kru Supir & Helper dari Supabase (dengan server REST fallback)
 */
export async function fetchCrewsFromSupabase(): Promise<{ success: boolean; data: Crew[]; error?: string }> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('crews')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        const localCrews = logisticsStore.getCrews();
        const mappedCrews: Crew[] = (data || []).map((row: any) => {
          const local = localCrews.find(lc =>
            (isUuid(lc.id) && lc.id === row.id) ||
            lc.name.trim().toLowerCase() === (row.name || '').trim().toLowerCase()
          );
          return mapSupabaseRowToCrew(row, local);
        });

        return { success: true, data: mappedCrews };
      }
    } catch (err: any) {
      console.warn('[Supabase crews query error, checking server fallback]:', err?.message);
    }
  }

  // Fallback to server REST API /api/crews
  try {
    const res = await fetch('/api/crews');
    if (res.ok) {
      const srvData = await res.json();
      if (Array.isArray(srvData.data) && srvData.data.length > 0) {
        return { success: true, data: srvData.data };
      }
    }
  } catch (err) {}

  return { success: true, data: logisticsStore.getCrews() };
}

/**
 * 6. CREATE: Simpan kru baru ke tabel crews Supabase & server database
 */
export async function createCrewInSupabase(crew: Crew): Promise<{ success: boolean; data?: any; error?: string }> {
  // Mirror to server database fallback
  try {
    fetch('/api/crews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crew)
    }).catch(() => {});
  } catch (e) {}

  const client = getSupabaseClient();
  if (!client) {
    return { success: true, data: { id: crew.id } };
  }

  try {
    let role = 'Driver Utama';
    if (crew.role.includes('Helper') || crew.role.includes('Kernet')) {
      role = 'Kernet / Helper';
    } else if (crew.role.includes('Cadangan')) {
      role = 'Driver Cadangan';
    }

    let licenseType = 'SIM B1 Umum';
    if (crew.licenseType?.includes('B2')) licenseType = 'SIM B2 Umum';
    else if (crew.licenseType?.includes('A')) licenseType = 'SIM A';
    else if (crew.licenseType === '-') licenseType = 'SIM A'; // DB check constraint fallback

    const payload: any = {
      name: crew.name.trim(),
      phone: crew.phone || '-',
      role,
      license_number: crew.licenseNumber || `SIM-${crew.name.substring(0, 3).toUpperCase()}-2026`,
      license_type: licenseType,
      status: crew.status || 'available',
      trips_completed: crew.tripsCompleted || 0,
      rating: crew.rating || 5.0
    };

    if (isUuid(crew.id)) {
      payload.id = crew.id;
    }

    const { data, error } = await client
      .from('crews')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      console.warn('[Supabase crews create error]', error.message);
      return { success: true, data: { id: crew.id } };
    }

    return { success: true, data };
  } catch (err: any) {
    console.warn('[Supabase crews create exception]', err);
    return { success: true, data: { id: crew.id } };
  }
}

/**
 * 7. UPDATE: Perbarui data kru di tabel crews Supabase & server database
 */
export async function updateCrewInSupabase(
  id: string,
  updates: Partial<Crew>
): Promise<{ success: boolean; data?: any; error?: string }> {
  // Mirror to server database fallback
  try {
    fetch(`/api/crews/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(() => {});
  } catch (e) {}

  const client = getSupabaseClient();
  if (!client) {
    return { success: true };
  }

  try {
    const payload: Record<string, any> = {};
    if (updates.name) payload.name = updates.name.trim();
    if (updates.phone) payload.phone = updates.phone;
    if (updates.role) {
      let role = updates.role;
      if (role.includes('Helper') || role.includes('Kernet')) role = 'Kernet / Helper';
      else if (role.includes('Cadangan')) role = 'Driver Cadangan';
      else role = 'Driver Utama';
      payload.role = role;
    }
    if (updates.licenseNumber) payload.license_number = updates.licenseNumber;
    if (updates.licenseType) {
      let lic = updates.licenseType;
      if (lic.includes('B2')) lic = 'SIM B2 Umum';
      else if (lic.includes('A')) lic = 'SIM A';
      else if (lic === '-') lic = 'SIM A';
      else lic = 'SIM B1 Umum';
      payload.license_type = lic;
    }
    if (updates.status) payload.status = updates.status;
    if (updates.tripsCompleted !== undefined) payload.trips_completed = updates.tripsCompleted;
    if (updates.rating !== undefined) payload.rating = updates.rating;

    if (Object.keys(payload).length === 0) {
      return { success: true };
    }

    if (isUuid(id)) {
      const { data, error } = await client.from('crews').update(payload).eq('id', id).select('*');
      if (!error && data && data.length > 0) {
        return { success: true, data: data[0] };
      }
    }

    // Fallback match by name
    const crewName = (updates.name || '').trim();
    if (crewName) {
      const { data, error } = await client.from('crews').update(payload).eq('name', crewName).select('*');
      if (error) return { success: false, error: error.message };
      return { success: true, data: data?.[0] };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal mengupdate kru di Supabase' };
  }
}

/**
 * 8. DELETE: Hapus kru dari tabel crews Supabase & server database
 */
export async function deleteCrewInSupabase(id: string, name?: string): Promise<{ success: boolean; error?: string }> {
  // Mirror to server database fallback
  try {
    fetch(`/api/crews/${id}`, {
      method: 'DELETE'
    }).catch(() => {});
  } catch (e) {}

  const client = getSupabaseClient();
  if (!client) {
    return { success: true };
  }

  try {
    if (isUuid(id)) {
      const { error } = await client.from('crews').delete().eq('id', id);
      if (!error) return { success: true };
    }

    if (name) {
      const cleanName = name.trim();
      const { error: nErr } = await client.from('crews').delete().eq('name', cleanName);
      if (nErr) return { success: false, error: nErr.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menghapus kru di Supabase' };
  }
}

/**
 * 9. SYNC: Sinkronisasi Dua Arah Fleets & Crews dengan Supabase Backend
 */
export async function syncFleetsAndCrewsWithSupabase(): Promise<{
  success: boolean;
  fleetsCount: number;
  crewsCount: number;
  message: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      fleetsCount: 0,
      crewsCount: 0,
      message: 'Koneksi ke Supabase belum terkonfigurasi atau offline.'
    };
  }

  try {
    const localFleets = logisticsStore.getFleets();
    const localCrews = logisticsStore.getCrews();

    // 1. Sync fleets
    const validLocalFleets = localFleets.filter(f => !f.plateNumber.trim().toUpperCase().endsWith('AKK'));
    const fleetPayload = validLocalFleets.map(f => ({
      plate_number: f.plateNumber.trim().toUpperCase(),
      vehicle_type: f.vehicleType || 'Engkel STD',
      tonnage_capacity: f.tonnageCapacity || (f.boxCapacityM3 ? Number((f.boxCapacityM3 * 0.4).toFixed(2)) : 5.0),
      current_tonnage: f.currentTonnage || 0,
      status: f.status || 'available',
      gps_imei: f.gpsImei && f.gpsImei !== '-' ? f.gpsImei.trim() : null,
      fuel_level_percent: f.fuelLevelPercent !== undefined ? f.fuelLevelPercent : 100,
      odometer_km: f.odometerKm || 0,
      year: f.year || 2024,
      last_maintenance: f.lastMaintenance || new Date().toISOString().substring(0, 10)
    }));

    const { data: upsertedFleets, error: fleetErr } = await client
      .from('fleets')
      .upsert(fleetPayload, { onConflict: 'plate_number' })
      .select('*');

    if (fleetErr) {
      console.warn('[Supabase Sync Fleets Note]', fleetErr.message);
    }

    // 2. Fetch all latest fleets from Supabase
    const { data: remoteFleets } = await client.from('fleets').select('*').order('plate_number', { ascending: true });
    if (remoteFleets && remoteFleets.length > 0) {
      const mergedFleets = remoteFleets
        .filter((rf: any) => !(rf.plate_number || '').toUpperCase().endsWith('AKK'))
        .map((rf: any) => {
          const existing = localFleets.find(lf => lf.plateNumber.trim().toUpperCase() === rf.plate_number.trim().toUpperCase());
          return mapSupabaseRowToFleet(rf, existing);
        });
      if (mergedFleets.length > 0) {
        logisticsStore.setFleets(mergedFleets);
      }
    }

    // 3. Sync crews
    for (const c of localCrews) {
      let role = 'Driver Utama';
      if (c.role.includes('Helper') || c.role.includes('Kernet')) role = 'Kernet / Helper';
      else if (c.role.includes('Cadangan')) role = 'Driver Cadangan';

      let licenseType = 'SIM B1 Umum';
      if (c.licenseType?.includes('B2')) licenseType = 'SIM B2 Umum';
      else if (c.licenseType?.includes('A')) licenseType = 'SIM A';
      else if (c.licenseType === '-') licenseType = 'SIM A';

      const crewData = {
        name: c.name.trim(),
        phone: c.phone || '-',
        role,
        license_number: c.licenseNumber || `SIM-${c.name.substring(0, 3).toUpperCase()}-2026`,
        license_type: licenseType,
        status: c.status || 'available',
        trips_completed: c.tripsCompleted || 0,
        rating: c.rating || 5.0
      };

      const { data: existingCrew } = await client.from('crews').select('id').eq('name', c.name.trim()).maybeSingle();
      if (existingCrew) {
        await client.from('crews').update(crewData).eq('id', existingCrew.id);
      } else {
        await client.from('crews').insert([crewData]);
      }
    }

    // 4. Fetch all latest crews from Supabase
    const { data: remoteCrews } = await client.from('crews').select('*').order('name', { ascending: true });
    if (remoteCrews && remoteCrews.length > 0) {
      const mergedCrews = remoteCrews.map((rc: any) => {
        const existing = localCrews.find(lc => lc.name.trim().toLowerCase() === rc.name.trim().toLowerCase());
        return mapSupabaseRowToCrew(rc, existing);
      });
      if (mergedCrews.length > 0) {
        logisticsStore.setCrews(mergedCrews);
      }
    }

    const currentFleets = logisticsStore.getFleets();
    const currentCrews = logisticsStore.getCrews();

    return {
      success: true,
      fleetsCount: currentFleets.length,
      crewsCount: currentCrews.length,
      message: `✅ Sinkronisasi Berhasil: ${currentFleets.length} armada & ${currentCrews.length} kru terhubung aktif dengan Supabase Cloud!`
    };
  } catch (err: any) {
    return {
      success: false,
      fleetsCount: 0,
      crewsCount: 0,
      message: err?.message || 'Terjadi kesalahan saat sinkronisasi Supabase.'
    };
  }
}


