import { sanitizeCoordinate } from '../components/GoogleSheetsStoreSyncModal';

export interface ParsedCoordinatePair {
  latitude: number;
  longitude: number;
  isValid: boolean;
  rawLat: string;
  rawLng: string;
}

const BANYUWANGI_DISTRICTS = [
  { name: 'Banyuwangi (Genteng)', lat: -8.3650, lng: 114.1530 },
  { name: 'Kota Banyuwangi', lat: -8.2190, lng: 114.3680 },
  { name: 'Banyuwangi (Rogojampi)', lat: -8.3050, lng: 114.2980 },
  { name: 'Banyuwangi (Srono)', lat: -8.3980, lng: 114.2650 },
  { name: 'Banyuwangi (Kalipuro)', lat: -8.1580, lng: 114.3920 },
  { name: 'Banyuwangi (Glagah)', lat: -8.2185, lng: 114.3160 },
  { name: 'Banyuwangi (Glenmore)', lat: -8.3080, lng: 114.0520 },
  { name: 'Banyuwangi (Muncar)', lat: -8.4350, lng: 114.3350 },
  { name: 'Banyuwangi (Gambiran)', lat: -8.4020, lng: 114.1480 },
  { name: 'Banyuwangi (Cluring)', lat: -8.4280, lng: 114.2250 },
  { name: 'Banyuwangi (Songgon)', lat: -8.2650, lng: 114.1850 },
  { name: 'Banyuwangi (Singojuruh)', lat: -8.3180, lng: 114.2280 },
  { name: 'Banyuwangi (Purwoharjo)', lat: -8.5080, lng: 114.2480 }
];

function getDistributedFallback(index: number, nameOrCode = ''): { lat: number; lng: number } {
  let seed = index;
  if (nameOrCode) {
    for (let i = 0; i < nameOrCode.length; i++) {
      seed = (seed * 31 + nameOrCode.charCodeAt(i)) & 0xffffff;
    }
  }
  const district = BANYUWANGI_DISTRICTS[Math.abs(seed) % BANYUWANGI_DISTRICTS.length];
  const latOffset = ((Math.sin(seed * 12.9898) * 43758.5453) % 1) * 0.025;
  const lngOffset = ((Math.cos(seed * 78.233) * 43758.5453) % 1) * 0.025;
  return {
    lat: Number((district.lat + latOffset).toFixed(8)),
    lng: Number((district.lng + lngOffset).toFixed(8))
  };
}

/**
 * Specifically checks for and parses 'lat'/'lng' or 'latitude'/'longitude' fields from raw objects.
 * Handles strings, numbers, Indonesian thousand separators (e.g. -83.694.284, 1.141.809.061),
 * combined coordinate pairs, and various casing conventions.
 * Strictly validates against null, undefined, empty strings, and (0,0) zero coordinates.
 */
export function extractCoordinatesFromObject(raw: any, fallbackIndex = 0): ParsedCoordinatePair {
  const fallback = getDistributedFallback(fallbackIndex, raw?.storeCode || raw?.storeName || String(fallbackIndex));

  if (!raw || typeof raw !== 'object') {
    return {
      latitude: fallback.lat,
      longitude: fallback.lng,
      isValid: false,
      rawLat: '',
      rawLng: ''
    };
  }

  // 1. Check direct latitude key candidates
  const latCandidates = [
    raw.latitude,
    raw.lat,
    raw.Lat,
    raw.Latitude,
    raw.LATITUDE,
    raw.LAT,
    raw.rawLat,
    raw.raw_lat,
    raw.koordinat_lat,
    raw.y,
    raw.Y
  ];

  // 2. Check direct longitude key candidates
  const lngCandidates = [
    raw.longitude,
    raw.lng,
    raw.Lng,
    raw.Longitude,
    raw.LONGITUDE,
    raw.LNG,
    raw.lon,
    raw.Lon,
    raw.long,
    raw.Long,
    raw.rawLng,
    raw.raw_lng,
    raw.koordinat_lng,
    raw.x,
    raw.X
  ];

  let rawLatVal: any = latCandidates.find(v => v !== undefined && v !== null && String(v).trim() !== '');
  let rawLngVal: any = lngCandidates.find(v => v !== undefined && v !== null && String(v).trim() !== '');

  // 3. Check combined coordinates string field if individual fields not found (e.g., "koordinat", "coords", "location", "lat_lng")
  if (rawLatVal === undefined || rawLngVal === undefined) {
    const combinedCandidates = [
      raw.koordinat,
      raw.coordinates,
      raw.coords,
      raw.lat_lng,
      raw.latLng,
      raw.location,
      raw.lokasi,
      raw.point
    ];

    const combinedStr = combinedCandidates.find(v => typeof v === 'string' && v.trim().length > 0);
    if (combinedStr) {
      const parts = combinedStr.split(/[,;\s/|]+/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
      if (parts.length >= 2) {
        rawLatVal = rawLatVal ?? parts[0];
        rawLngVal = rawLngVal ?? parts[1];
      }
    } else if (Array.isArray(raw.coordinates) && raw.coordinates.length >= 2) {
      rawLatVal = rawLatVal ?? raw.coordinates[0];
      rawLngVal = rawLngVal ?? raw.coordinates[1];
    }
  }

  const strLat = String(rawLatVal ?? '').trim();
  const strLng = String(rawLngVal ?? '').trim();

  // Validate against zero, null string placeholders, or missing values
  const isLatZeroOrEmpty = !strLat || strLat === '0' || strLat === '0.0' || strLat === 'null' || strLat === 'undefined' || strLat === '-' || strLat === 'NaN';
  const isLngZeroOrEmpty = !strLng || strLng === '0' || strLng === '0.0' || strLng === 'null' || strLng === 'undefined' || strLng === '-' || strLng === 'NaN';

  // 4. Sanitize and parse numbers explicitly
  const parsedLat = isLatZeroOrEmpty ? fallback.lat : sanitizeCoordinate(strLat || (typeof rawLatVal === 'number' ? rawLatVal : fallback.lat), false);
  const parsedLng = isLngZeroOrEmpty ? fallback.lng : sanitizeCoordinate(strLng || (typeof rawLngVal === 'number' ? rawLngVal : fallback.lng), true);

  // Cast strictly to Number type
  const numLat = Number(parsedLat);
  const numLng = Number(parsedLng);

  // Strict validation: non-zero, finite, within Indonesia boundaries (not 0,0 Null Island)
  const isValidLat = !isLatZeroOrEmpty && !isNaN(numLat) && isFinite(numLat) && numLat !== 0 && numLat >= -12.0 && numLat <= 6.0;
  const isValidLng = !isLngZeroOrEmpty && !isNaN(numLng) && isFinite(numLng) && numLng !== 0 && numLng >= 95.0 && numLng <= 145.0;
  const isValid = isValidLat && isValidLng;

  return {
    latitude: isValid ? Number(numLat.toFixed(8)) : fallback.lat,
    longitude: isValid ? Number(numLng.toFixed(8)) : fallback.lng,
    isValid,
    rawLat: strLat || String(isValid ? numLat : fallback.lat),
    rawLng: strLng || String(isValid ? numLng : fallback.lng)
  };
}

/**
 * Normalizes a store object to ensure latitude and longitude are valid numbers.
 */
export function normalizeStoreWithCoordinates<T extends Record<string, any>>(store: T, index = 0): T & { latitude: number; longitude: number } {
  const coords = extractCoordinatesFromObject(store, index);
  return {
    ...store,
    latitude: coords.latitude,
    longitude: coords.longitude,
    rawLat: coords.rawLat,
    rawLng: coords.rawLng
  };
}

export type StoreLocationType = 'dalam_kota' | 'luar_kota' | 'luar_pulau';

/**
 * Classifies store location into:
 * - 'dalam_kota': Stores within Banyuwangi Regency (Genteng, Banyuwangi Kota, Rogojampi, Srono, Kalipuro, Wongsorejo, etc.)
 * - 'luar_kota': Stores in East Java outside Banyuwangi (Jember, Lumajang, Situbondo, Bondowoso, Probolinggo, etc.)
 * - 'luar_pulau': Stores on outer islands (Bali, NTB, Sumatera, etc.)
 */
export function getStoreLocationType(store: { island?: string; city?: string; address?: string; storeName?: string; latitude?: number; longitude?: number }): StoreLocationType {
  // 1. Outer islands check (Bali, NTB, Sumatera, etc.)
  if (store.island && store.island !== 'Jawa') {
    return 'luar_pulau';
  }

  const lat = Number(store.latitude);
  const lng = Number(store.longitude);

  // 2. Exact Geographical Coordinate Boundary for Kabupaten Banyuwangi:
  // - North: Wongsorejo & Bajulmati (-7.70° to -8.00°)
  // - South: Grajagan, Sukamade, Alas Purwo (-8.85°)
  // - West: Kalibaru / Gunung Gumitir border (113.92°) - Anything west (< 113.92°) is Jember, Lumajang, Probolinggo, etc.
  // - East: Ketapang & Selat Bali coastline (114.48°)
  const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

  if (hasValidCoords) {
    const isStrictlyInBanyuwangiCoords = lat <= -7.70 && lat >= -8.85 && lng >= 113.92 && lng <= 114.48;
    if (!isStrictlyInBanyuwangiCoords) {
      // Strictly outside Banyuwangi coordinates (e.g. Jember at lng 113.20° - 113.88°, Situbondo north of -7.70°, etc.)
      return 'luar_kota';
    }
    // Inside Banyuwangi coordinates box (Genteng, Banyuwangi Kota, Wongsorejo, Rogojampi, Kalipuro, dsb.)
    return 'dalam_kota';
  }

  // 3. Fallback text check if coordinates are missing:
  const cityLower = (store.city || '').toLowerCase();
  const addressLower = (store.address || '').toLowerCase();
  const nameLower = (store.storeName || '').toLowerCase();

  const isOutOfTownText =
    cityLower.includes('jember') ||
    cityLower.includes('lumajang') ||
    cityLower.includes('situbondo') ||
    cityLower.includes('bondowoso') ||
    cityLower.includes('probolinggo') ||
    cityLower.includes('pasuruan') ||
    cityLower.includes('malang') ||
    cityLower.includes('surabaya') ||
    cityLower.includes('sidoarjo') ||
    cityLower.includes('kediri') ||
    cityLower.includes('blitar') ||
    addressLower.includes('jember') ||
    addressLower.includes('lumajang') ||
    addressLower.includes('probolinggo') ||
    addressLower.includes('bondowoso');

  if (isOutOfTownText) {
    return 'luar_kota';
  }

  const isBanyuwangiText =
    cityLower.includes('banyuwangi') ||
    cityLower.includes('genteng') ||
    cityLower.includes('rogojampi') ||
    cityLower.includes('srono') ||
    cityLower.includes('kalipuro') ||
    cityLower.includes('glagah') ||
    cityLower.includes('glenmore') ||
    cityLower.includes('kalibaru') ||
    cityLower.includes('muncar') ||
    cityLower.includes('gambiran') ||
    cityLower.includes('cluring') ||
    cityLower.includes('songgon') ||
    cityLower.includes('singojuruh') ||
    cityLower.includes('purwoharjo') ||
    cityLower.includes('tegaldlimo') ||
    cityLower.includes('wongsorejo') ||
    cityLower.includes('watukebo') ||
    cityLower.includes('bajulmati') ||
    cityLower.includes('sidodadi') ||
    cityLower.includes('sidowangi') ||
    cityLower.includes('sumberkencono') ||
    cityLower.includes('sumber kencono') ||
    cityLower.includes('bimorejo') ||
    addressLower.includes('banyuwangi') ||
    addressLower.includes('wongsorejo') ||
    nameLower.includes('bwi') ||
    nameLower.includes('genteng');

  if (isBanyuwangiText) {
    return 'dalam_kota';
  }

  return 'luar_kota';
}

export function getStorePriorityLevel(store: any): 'High' | 'Medium' | 'Low' {
  if (!store) return 'Low';
  if (store.priorityLevel && ['High', 'Medium', 'Low'].includes(store.priorityLevel)) {
    return store.priorityLevel as 'High' | 'Medium' | 'Low';
  }
  const category = store.storeCategory || '';
  if (['Hypermarket', 'Supermarket', 'Distribution Hub', 'Horeca & Corporate'].includes(category)) {
    return 'High';
  }
  if (['Minimarket Cluster', 'Mitra Distributor'].includes(category)) {
    return 'Medium';
  }
  return 'Low';
}
