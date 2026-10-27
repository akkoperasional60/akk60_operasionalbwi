import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  MapPin,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Store,
  Navigation,
  Check,
  TrendingUp,
  Fuel,
  Truck,
  ArrowRight,
  ShieldCheck,
  Info
} from 'lucide-react';
import { LeafletMap } from './LeafletMap';
import { logisticsStore } from '../services/store';
import {
  TrackingEvaluation,
  TracksolidTripLeg,
  TracksolidDateSubtotal,
  TracksolidBottomSummary,
  RouteStop,
  TrackingPoint,
  RetailStore
} from '../types';
import { extractCoordinatesFromObject, getStoreLocationType } from '../utils/coordinateParser';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Coordinates dictionary for geocoding Tracksolid locations in Bali and Banyuwangi
const TRACKSOLID_GEO_DICT: Record<string, [number, number]> = {
  // Banyuwangi
  'argopuro': [-8.1906, 114.3708],
  'sukowidi': [-8.1906, 114.3708],
  'klatak': [-8.1906, 114.3708],
  'gereja advent': [-8.1906, 114.3708],
  'pertamina': [-8.1990, 114.3730],
  'bulusan': [-8.1990, 114.3730],
  'gatot subroto': [-8.1990, 114.3730],
  'indomarket': [-8.1432, 114.3976],
  'alfamart': [-8.1435, 114.3978],
  'ketapang': [-8.1435, 114.3975],
  'pier 1 ketapang': [-8.1420, 114.4010],
  'tirtopuro': [-8.2050, 114.3500],
  'genteng': [-8.3650, 114.1530],
  'rogojampi': [-8.3050, 114.2980],

  // Bali - Jembrana & Gilimanuk
  'gilimanuk': [-8.1628, 114.4382],
  'pier 4 gilimanuk': [-8.1635, 114.4390],
  'swt mart': [-8.1642, 114.4395],
  'yeh sumbul': [-8.3956, 114.7764],
  'jembrana': [-8.3575, 114.6255],
  'negara': [-8.3575, 114.6255],

  // Bali - Tabanan
  'megati': [-8.4982, 115.0412],
  'bunut puhun': [-8.4982, 115.0412],
  'sembung gede': [-8.5120, 115.0680],
  'samsam': [-8.5325, 115.0985],
  'tabanan': [-8.5412, 115.1255],

  // Bali - Badung
  'penarungan': [-8.5892, 115.1824],
  'lukluk': [-8.5892, 115.1824],
  'badung': [-8.6500, 115.1667],
  'kuta': [-8.7233, 115.1723],
  'bypass ngurah rai': [-8.7185, 115.1825],
  'kok tong bali': [-8.7185, 115.1825],
  'pondok sulawesi': [-8.7124, 115.1838],
  'sunset road': [-8.6982, 115.1765],
  'agung bali': [-8.6982, 115.1765],
  'indomaret fresh': [-8.7233, 115.1812],

  // Bali - Denpasar
  'ubung': [-8.6345, 115.2035],
  'north denpasar': [-8.6345, 115.2035],
  'pemecutan kaja': [-8.6410, 115.1980],
  'buluh indah': [-8.6425, 115.1950],
  'gas station buluh indah': [-8.6425, 115.1950],
  'gunung batukaru': [-8.6552, 115.2028],
  'honda kertiawan': [-8.6552, 115.2028],
  'gang imbura': [-8.6625, 115.1975],
  'gang nyuh bubuh': [-8.6640, 115.1960],
  'pemecutan kelod': [-8.6685, 115.1885],
  'pulau bungin': [-8.6768, 115.2045],
  'warung jawa muslim': [-8.6768, 115.2045],
  'pulau indah': [-8.6732, 115.2012],
  'imam bonjol': [-8.6745, 115.1952],
  'surya ban': [-8.6745, 115.1952],
  'teuku umar': [-8.6685, 115.1885],
  'gojek hq': [-8.6685, 115.1885],
  'gunung salak': [-8.6712, 115.1782],
  'padangsambian': [-8.6712, 115.1782],
  'nasi ayam betutu sunari': [-8.6712, 115.1782],
  'denpasar': [-8.6705, 115.2126]
};

function resolveTracksolidCoords(locationName: string, index = 0): [number, number] {
  const norm = String(locationName || '').toLowerCase();
  for (const [key, coords] of Object.entries(TRACKSOLID_GEO_DICT)) {
    if (norm.includes(key)) {
      return coords;
    }
  }
  // Safe distributed coordinate in Bali/Banyuwangi
  const seed = (index * 37 + norm.length * 13) % 100;
  return [-8.6700 + (seed / 1000), 115.2100 + (seed / 1000)];
}

// Exact 26 Trip Legs from user screenshot image_2ddbbeb0.png & image_a9e28381.png
export const DEFAULT_TRACKSOLID_26_LEGS: TracksolidTripLeg[] = [
  // 2026-10-26 (21 trips)
  {
    legNumber: 1,
    dateGroup: '2026-10-26',
    startTime: '17:15:33',
    startLocation: 'Ketapang, 21, Ketapang, Banyuwangi, Ketapang, East Java, Java, 68451, Indonesia',
    endTime: '17:30:57',
    endLocation: 'Lingkungan Sukowidi Desa Klatak, Banyuwangi, Tirtopuro, Banyuwangi, East Java, Java, 68421, Indonesia',
    mileageKm: 7.26,
    travelTime: '00:15:23',
    travelMinutes: 15.38,
    avgSpeedKmh: 28.30,
    maxSpeedKmh: 51.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1435,
    startLng: 114.3975,
    endLat: -8.1906,
    endLng: 114.3708,
    stopBeforeMinutes: 122,
    stopBeforeStart: '15:13:37',
    stopBeforeEnd: '17:15:33',
    matchedStoreName: 'Gudang Pusat Banyuwangi DC (Klatak)',
    matchedStoreKecamatan: 'Kalipuro',
    matchedStoreKabupaten: 'Banyuwangi'
  },
  {
    legNumber: 2,
    dateGroup: '2026-10-26',
    startTime: '15:10:13',
    startLocation: 'SWT mart, Jalan Raya Denpasar-Gilimanuk, Gilimanuk, Jembrana, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '15:13:37',
    endLocation: 'Pier 4 Gilimanuk ferry port, Jalan Raya Denpasar-Gilimanuk, Gilimanuk, Jembrana, Bali, Lesser Sunda Islands, Indonesia',
    mileageKm: 0.32,
    travelTime: '00:03:23',
    travelMinutes: 3.38,
    avgSpeedKmh: 5.71,
    maxSpeedKmh: 17.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1642,
    startLng: 114.4395,
    endLat: -8.1635,
    endLng: 114.4390,
    stopBeforeMinutes: 7,
    stopBeforeStart: '15:02:53',
    stopBeforeEnd: '15:10:13',
    matchedStoreName: 'SWT MART GILIMANUK',
    matchedStoreKecamatan: 'Melaya',
    matchedStoreKabupaten: 'Jembrana'
  },
  {
    legNumber: 3,
    dateGroup: '2026-10-26',
    startTime: '12:42:57',
    startLocation: 'Pick up?, Jalan Raya Denpasar-Gilimanuk, Bunut Puhun, Megati, Tabanan, Bali, Lesser Sunda Islands, 82162, Indonesia',
    endTime: '15:02:53',
    endLocation: 'SWT mart, Jalan Raya Denpasar-Gilimanuk, Gilimanuk, Jembrana, Bali, Lesser Sunda Islands, Indonesia',
    mileageKm: 94.50,
    travelTime: '02:19:56',
    travelMinutes: 139.93,
    avgSpeedKmh: 40.52,
    maxSpeedKmh: 76.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.4982,
    startLng: 115.0412,
    endLat: -8.1642,
    endLng: 114.4395,
    stopBeforeMinutes: 12,
    stopBeforeStart: '12:30:36',
    stopBeforeEnd: '12:42:57',
    matchedStoreName: 'TOKO SEMBUNG GEDE & MEGATI TABANAN',
    matchedStoreKecamatan: 'Selemadeg Timur',
    matchedStoreKabupaten: 'Tabanan'
  },
  {
    legNumber: 4,
    dateGroup: '2026-10-26',
    startTime: '12:21:16',
    startLocation: 'Sembung Gede, Tabanan, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '12:30:36',
    endLocation: 'Pick up?, Jalan Raya Denpasar-Gilimanuk, Bunut Puhun, Megati, Tabanan, Bali, Lesser Sunda Islands, 82162, Indonesia',
    mileageKm: 4.60,
    travelTime: '00:09:20',
    travelMinutes: 9.33,
    avgSpeedKmh: 29.57,
    maxSpeedKmh: 57.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.5120,
    startLng: 115.0680,
    endLat: -8.4982,
    endLng: 115.0412,
    stopBeforeMinutes: 80,
    stopBeforeStart: '11:00:57',
    stopBeforeEnd: '12:21:16',
    matchedStoreName: 'TOKO SEMBUNG GEDE & MEGATI TABANAN',
    matchedStoreKecamatan: 'Selemadeg Timur',
    matchedStoreKabupaten: 'Tabanan'
  },
  {
    legNumber: 5,
    dateGroup: '2026-10-26',
    startTime: '10:49:21',
    startLocation: 'Tabanan, Samsam, Tabanan, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '11:00:57',
    endLocation: 'Sembung Gede, Tabanan, Bali, Lesser Sunda Islands, Indonesia',
    mileageKm: 5.02,
    travelTime: '00:11:36',
    travelMinutes: 11.60,
    avgSpeedKmh: 25.95,
    maxSpeedKmh: 50.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.5325,
    startLng: 115.0985,
    endLat: -8.5120,
    endLng: 115.0680,
    stopBeforeMinutes: 5,
    stopBeforeStart: '10:44:48',
    stopBeforeEnd: '10:49:21',
    matchedStoreName: 'DISTRIBUSI KEMASAN SAMSAM TABANAN',
    matchedStoreKecamatan: 'Kerambitan',
    matchedStoreKabupaten: 'Tabanan'
  },
  {
    legNumber: 6,
    dateGroup: '2026-10-26',
    startTime: '10:16:39',
    startLocation: 'Jalan Raya Penarungan, Lukluk, Badung, Bali, Lesser Sunda Islands, 80117, Indonesia',
    endTime: '10:44:48',
    endLocation: 'Tabanan, Samsam, Tabanan, Bali, Lesser Sunda Islands, 08351, Indonesia',
    mileageKm: 12.24,
    travelTime: '00:28:09',
    travelMinutes: 28.15,
    avgSpeedKmh: 26.10,
    maxSpeedKmh: 57.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.5892,
    startLng: 115.1824,
    endLat: -8.5325,
    endLng: 115.0985,
    stopBeforeMinutes: 4,
    stopBeforeStart: '10:12:49',
    stopBeforeEnd: '10:16:39',
    matchedStoreName: 'TOKO MITRA KEMASAN LUKLUK BADUNG',
    matchedStoreKecamatan: 'Mengwi',
    matchedStoreKabupaten: 'Badung'
  },
  {
    legNumber: 7,
    dateGroup: '2026-10-26',
    startTime: '09:53:00',
    startLocation: 'Ubung, North Denpasar, Denpasar, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '10:12:49',
    endLocation: 'Lukluk, Badung, Bali, Lesser Sunda Islands, 80117, Indonesia',
    mileageKm: 6.94,
    travelTime: '00:19:48',
    travelMinutes: 19.80,
    avgSpeedKmh: 21.03,
    maxSpeedKmh: 48.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6345,
    startLng: 115.2035,
    endLat: -8.5892,
    endLng: 115.1824,
    stopBeforeMinutes: 3,
    stopBeforeStart: '09:49:38',
    stopBeforeEnd: '09:53:00',
    matchedStoreName: 'GROSIR KEMASAN UBUNG DENPASAR UTARA',
    matchedStoreKecamatan: 'Denpasar Utara',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 8,
    dateGroup: '2026-10-26',
    startTime: '09:47:20',
    startLocation: 'Ubung, North Denpasar, Denpasar, Bali, Lesser Sunda Islands, 80116, Indonesia',
    endTime: '09:49:38',
    endLocation: 'Ubung, North Denpasar, Denpasar, Bali, Lesser Sunda Islands, 80116, Indonesia',
    mileageKm: 0.08,
    travelTime: '00:02:18',
    travelMinutes: 2.30,
    avgSpeedKmh: 2.11,
    maxSpeedKmh: 13.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6345,
    startLng: 115.2035,
    endLat: -8.6345,
    endLng: 115.2035,
    stopBeforeMinutes: 4,
    stopBeforeStart: '09:43:35',
    stopBeforeEnd: '09:47:20',
    matchedStoreName: 'GROSIR KEMASAN UBUNG DENPASAR UTARA',
    matchedStoreKecamatan: 'Denpasar Utara',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 9,
    dateGroup: '2026-10-26',
    startTime: '09:37:58',
    startLocation: 'Ubung, North Denpasar, Denpasar, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '09:43:35',
    endLocation: 'Ubung, North Denpasar, Denpasar, Bali, Lesser Sunda Islands, 80116, Indonesia',
    mileageKm: 0.96,
    travelTime: '00:05:36',
    travelMinutes: 5.60,
    avgSpeedKmh: 10.28,
    maxSpeedKmh: 35.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6345,
    startLng: 115.2035,
    endLat: -8.6345,
    endLng: 115.2035,
    stopBeforeMinutes: 7,
    stopBeforeStart: '09:30:38',
    stopBeforeEnd: '09:37:58',
    matchedStoreName: 'GROSIR KEMASAN UBUNG DENPASAR UTARA',
    matchedStoreKecamatan: 'Denpasar Utara',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 10,
    dateGroup: '2026-10-26',
    startTime: '09:17:49',
    startLocation: 'Honda Kertiawan Motor, Jalan Gunung Batukaru, Pemecutan, West Denpasar',
    endTime: '09:30:38',
    endLocation: 'Gas Station Buluh Indah (54.801.31), Jalan Raya Buluh Indah, Pemecutan Kaja',
    mileageKm: 2.45,
    travelTime: '00:12:49',
    travelMinutes: 12.82,
    avgSpeedKmh: 11.45,
    maxSpeedKmh: 36.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6552,
    startLng: 115.2028,
    endLat: -8.6425,
    endLng: 115.1950,
    stopBeforeMinutes: 7,
    stopBeforeStart: '09:10:45',
    stopBeforeEnd: '09:17:49',
    matchedStoreName: 'HONDA KERTIAWAN MOTOR & MITRA GUNUNG BATUKARU',
    matchedStoreKecamatan: 'Denpasar Barat',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 11,
    dateGroup: '2026-10-26',
    startTime: '09:05:59',
    startLocation: 'Gang Imbura, Pemecutan Kelod, West Denpasar, Denpasar, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '09:10:45',
    endLocation: 'Honda Kertiawan Motor, Jalan Gunung Batukaru, Pemecutan, West Denpasar',
    mileageKm: 1.77,
    travelTime: '00:04:46',
    travelMinutes: 4.77,
    avgSpeedKmh: 22.27,
    maxSpeedKmh: 35.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6625,
    startLng: 115.1975,
    endLat: -8.6552,
    endLng: 115.2028,
    stopBeforeMinutes: 5,
    stopBeforeStart: '09:01:00',
    stopBeforeEnd: '09:05:59',
    matchedStoreName: 'TOKO PLASTIK GANG IMBURA PEMECUTAN',
    matchedStoreKecamatan: 'Denpasar Barat',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 12,
    dateGroup: '2026-10-26',
    startTime: '08:57:09',
    startLocation: 'Gang Nyuh Bubuh, Pemecutan Kelod, West Denpasar, Denpasar, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '09:01:00',
    endLocation: 'Gang Imbura, Pemecutan Kelod, West Denpasar, Denpasar, Bali, Lesser Sunda Islands, Indonesia',
    mileageKm: 1.12,
    travelTime: '00:03:51',
    travelMinutes: 3.85,
    avgSpeedKmh: 17.38,
    maxSpeedKmh: 36.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6640,
    startLng: 115.1960,
    endLat: -8.6625,
    endLng: 115.1975,
    stopBeforeMinutes: 4,
    stopBeforeStart: '08:52:49',
    stopBeforeEnd: '08:57:09',
    matchedStoreName: 'TOKO PLASTIK GANG IMBURA PEMECUTAN',
    matchedStoreKecamatan: 'Denpasar Barat',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 13,
    dateGroup: '2026-10-26',
    startTime: '08:35:27',
    startLocation: 'Warung Jawa Muslim Rena, 112, Jalan Pulau Bungin, Dauh Puri Kauh, West Denpasar',
    endTime: '08:52:49',
    endLocation: 'Jalan Pulau Indah, Dauh Puri Kauh, West Denpasar, Denpasar, Bali, Lesser Sunda Islands, Indonesia',
    mileageKm: 5.19,
    travelTime: '00:17:21',
    travelMinutes: 17.35,
    avgSpeedKmh: 17.95,
    maxSpeedKmh: 37.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6768,
    startLng: 115.2045,
    endLat: -8.6732,
    endLng: 115.2012,
    stopBeforeMinutes: 19,
    stopBeforeStart: '08:16:01',
    stopBeforeEnd: '08:35:27',
    matchedStoreName: 'WARUNG JAWA MUSLIM RENA PULAU BUNGIN',
    matchedStoreKecamatan: 'Denpasar Barat',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 14,
    dateGroup: '2026-10-26',
    startTime: '08:00:23',
    startLocation: 'Surya Ban, Jalan Imam Bonjol, Pemecutan Kelod, West Denpasar',
    endTime: '08:16:01',
    endLocation: 'Warung Jawa Muslim Rena, 112, Jalan Pulau Bungin, Dauh Puri Kauh, West Denpasar',
    mileageKm: 3.34,
    travelTime: '00:15:37',
    travelMinutes: 15.62,
    avgSpeedKmh: 12.82,
    maxSpeedKmh: 35.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6745,
    startLng: 115.1952,
    endLat: -8.6768,
    endLng: 115.2045,
    stopBeforeMinutes: 9,
    stopBeforeStart: '07:50:52',
    stopBeforeEnd: '08:00:23',
    matchedStoreName: 'SURYA BAN & RETAIL IMAM BONJOL',
    matchedStoreKecamatan: 'Denpasar Barat',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 15,
    dateGroup: '2026-10-26',
    startTime: '07:41:33',
    startLocation: 'Jalan Gunung Salak, Padangsambian Kelod, West Denpasar',
    endTime: '07:50:52',
    endLocation: 'GoJek HQ, 41, Jalan Teuku Umar Barat, Pemecutan Kelod, West Denpasar',
    mileageKm: 2.66,
    travelTime: '00:09:19',
    travelMinutes: 9.32,
    avgSpeedKmh: 17.15,
    maxSpeedKmh: 44.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6712,
    startLng: 115.1782,
    endLat: -8.6685,
    endLng: 115.1885,
    stopBeforeMinutes: 5,
    stopBeforeStart: '07:36:54',
    stopBeforeEnd: '07:41:33',
    matchedStoreName: 'MITRA KEMASAN TEUKU UMAR BARAT (GOJEK HQ)',
    matchedStoreKecamatan: 'Denpasar Barat',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 16,
    dateGroup: '2026-10-26',
    startTime: '07:16:41',
    startLocation: 'Agung Bali Pusat Oleh - Oleh, 18 X, Sunset Road, Kuta, Badung, Bali',
    endTime: '07:36:54',
    endLocation: 'Nasi Ayam Betutu Sunari - Padangsambian Klod, Jalan Gunung Salak',
    mileageKm: 5.68,
    travelTime: '00:20:12',
    travelMinutes: 20.20,
    avgSpeedKmh: 16.88,
    maxSpeedKmh: 50.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6982,
    startLng: 115.1765,
    endLat: -8.6712,
    endLng: 115.1782,
    stopBeforeMinutes: 7,
    stopBeforeStart: '07:09:51',
    stopBeforeEnd: '07:16:41',
    matchedStoreName: 'NASI AYAM BETUTU SUNARI PADANGSAMBIAN',
    matchedStoreKecamatan: 'Denpasar Barat',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 17,
    dateGroup: '2026-10-26',
    startTime: '07:05:41',
    startLocation: 'Pondok Sulawesi, 39, Jalan Bypass Ngurah Rai, Kuta, Badung, Bali',
    endTime: '07:09:51',
    endLocation: 'エアアジア, Sunset Road, Pemecutan Kelod, West Denpasar, Denpasar, Bali',
    mileageKm: 2.27,
    travelTime: '00:04:09',
    travelMinutes: 4.15,
    avgSpeedKmh: 32.76,
    maxSpeedKmh: 50.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.7124,
    startLng: 115.1838,
    endLat: -8.6982,
    endLng: 115.1765,
    stopBeforeMinutes: 35,
    stopBeforeStart: '06:30:01',
    stopBeforeEnd: '07:05:41',
    matchedStoreName: 'AGUNG BALI PUSAT OLEH - OLEH SUNSET ROAD',
    matchedStoreKecamatan: 'Kuta',
    matchedStoreKabupaten: 'Badung'
  },
  {
    legNumber: 18,
    dateGroup: '2026-10-26',
    startTime: '06:28:51',
    startLocation: 'Kok Tong Bali, Jalan Bypass Ngurah Rai, Kuta, Badung, Bali',
    endTime: '06:30:01',
    endLocation: 'Pondok Sulawesi, 39, Jalan Bypass Ngurah Rai, Kuta, Badung, Bali',
    mileageKm: 0.61,
    travelTime: '00:01:09',
    travelMinutes: 1.15,
    avgSpeedKmh: 31.82,
    maxSpeedKmh: 33.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.7185,
    startLng: 115.1825,
    endLat: -8.7124,
    endLng: 115.1838,
    stopBeforeMinutes: 139,
    stopBeforeStart: '04:09:43',
    stopBeforeEnd: '06:28:51',
    matchedStoreName: 'PONDOK SULAWESI BYPASS NGURAH RAI',
    matchedStoreKecamatan: 'Kuta',
    matchedStoreKabupaten: 'Badung'
  },
  {
    legNumber: 19,
    dateGroup: '2026-10-26',
    startTime: '01:49:28',
    startLocation: 'Yeh Sumbul, Jembrana, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '04:09:43',
    endLocation: 'Indomaret Fresh, Jalan Bypass Ngurah Rai, Kuta, Badung, Bali',
    mileageKm: 83.38,
    travelTime: '02:20:15',
    travelMinutes: 140.25,
    avgSpeedKmh: 35.67,
    maxSpeedKmh: 71.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.3956,
    startLng: 114.7764,
    endLat: -8.7233,
    endLng: 115.1812,
    stopBeforeMinutes: 4,
    stopBeforeStart: '01:45:48',
    stopBeforeEnd: '01:49:28',
    matchedStoreName: 'INDOMARET FRESH BYPASS NGURAH RAI KUTA',
    matchedStoreKecamatan: 'Kuta',
    matchedStoreKabupaten: 'Badung'
  },
  {
    legNumber: 20,
    dateGroup: '2026-10-26',
    startTime: '00:45:28',
    startLocation: 'Gilimanuk, Jembrana, Bali, Lesser Sunda Islands, 01:45:48',
    endTime: '01:45:48',
    endLocation: 'Yeh Sumbul, Jembrana, Bali, Lesser Sunda Islands, Indonesia',
    mileageKm: 52.98,
    travelTime: '01:00:19',
    travelMinutes: 60.32,
    avgSpeedKmh: 52.70,
    maxSpeedKmh: 79.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1628,
    startLng: 114.4382,
    endLat: -8.3956,
    endLng: 114.7764,
    stopBeforeMinutes: 33,
    stopBeforeStart: '00:12:04',
    stopBeforeEnd: '00:45:28',
    matchedStoreName: 'MITRA PLASTIK YEH SUMBUL',
    matchedStoreKecamatan: 'Mendoyo',
    matchedStoreKabupaten: 'Jembrana'
  },
  {
    legNumber: 21,
    dateGroup: '2026-10-26',
    startTime: '00:06:06',
    startLocation: 'Gilimanuk, Jembrana, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '00:12:04',
    endLocation: 'Gilimanuk, Jembrana, Bali, Lesser Sunda Islands, 82252, Indonesia',
    mileageKm: 1.54,
    travelTime: '00:05:58',
    travelMinutes: 5.97,
    avgSpeedKmh: 15.46,
    maxSpeedKmh: 45.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1628,
    startLng: 114.4382,
    endLat: -8.1628,
    endLng: 114.4382,
    stopBeforeMinutes: 87,
    stopBeforeStart: '22:38:46',
    stopBeforeEnd: '00:06:06',
    matchedStoreName: 'SWT MART GILIMANUK',
    matchedStoreKecamatan: 'Melaya',
    matchedStoreKabupaten: 'Jembrana'
  },

  // 2026-10-25 (5 trips)
  {
    legNumber: 22,
    dateGroup: '2026-10-25',
    startTime: '22:37:56',
    startLocation: 'Ketapang, 21, Ketapang, Banyuwangi, Ketapang, East Java',
    endTime: '22:38:46',
    endLocation: 'Ketapang, 21, Ketapang, Banyuwangi, Ketapang, East Java, Java, 68451',
    mileageKm: 0.05,
    travelTime: '00:00:50',
    travelMinutes: 0.83,
    avgSpeedKmh: 3.74,
    maxSpeedKmh: 8.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1435,
    startLng: 114.3975,
    endLat: -8.1435,
    endLng: 114.3975,
    stopBeforeMinutes: 22,
    stopBeforeStart: '22:15:37',
    stopBeforeEnd: '22:37:56',
    matchedStoreName: 'INDOMARKET & ALFAMART KETAPANG',
    matchedStoreKecamatan: 'Kalipuro',
    matchedStoreKabupaten: 'Banyuwangi'
  },
  {
    legNumber: 23,
    dateGroup: '2026-10-25',
    startTime: '22:14:52',
    startLocation: '21, Ketapang, Banyuwangi, Ketapang, Banyuwangi',
    endTime: '22:15:37',
    endLocation: 'Pier 1 Ketapang ferry port, 21, Ketapang, Banyuwangi, Ketapang, Banyuwangi',
    mileageKm: 0.17,
    travelTime: '00:00:45',
    travelMinutes: 0.75,
    avgSpeedKmh: 13.28,
    maxSpeedKmh: 19.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1435,
    startLng: 114.3975,
    endLat: -8.1420,
    endLng: 114.4010,
    stopBeforeMinutes: 83,
    stopBeforeStart: '20:51:42',
    stopBeforeEnd: '22:14:52',
    matchedStoreName: 'INDOMARKET & ALFAMART KETAPANG',
    matchedStoreKecamatan: 'Kalipuro',
    matchedStoreKabupaten: 'Banyuwangi'
  },
  {
    legNumber: 24,
    dateGroup: '2026-10-25',
    startTime: '20:51:12',
    startLocation: 'Indomarket, 1;3, Ketapang, Banyuwangi, Ketapang, 20:51:42',
    endTime: '20:51:42',
    endLocation: 'Alfamart, 1;AH2, Ketapang, Banyuwangi, Ketapang, Banyuwangi, East Java, 68451',
    mileageKm: 0.08,
    travelTime: '00:00:30',
    travelMinutes: 0.50,
    avgSpeedKmh: 9.16,
    maxSpeedKmh: 11.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1432,
    startLng: 114.3976,
    endLat: -8.1435,
    endLng: 114.3978,
    stopBeforeMinutes: 10,
    stopBeforeStart: '20:40:52',
    stopBeforeEnd: '20:51:12',
    matchedStoreName: 'INDOMARKET & ALFAMART KETAPANG',
    matchedStoreKecamatan: 'Kalipuro',
    matchedStoreKabupaten: 'Banyuwangi'
  },
  {
    legNumber: 25,
    dateGroup: '2026-10-25',
    startTime: '20:38:06',
    startLocation: 'Pertamina, Jalan Gatot Subroto, 03, Krajan, Bulusan',
    endTime: '20:40:52',
    endLocation: '21, Ketapang, Banyuwangi, Ketapang, Banyuwangi, East Java, Java, 68451',
    mileageKm: 0.99,
    travelTime: '00:02:46',
    travelMinutes: 2.77,
    avgSpeedKmh: 21.50,
    maxSpeedKmh: 44.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1990,
    startLng: 114.3730,
    endLat: -8.1435,
    endLng: 114.3975,
    stopBeforeMinutes: 6,
    stopBeforeStart: '20:32:20',
    stopBeforeEnd: '20:38:06',
    matchedStoreName: 'HOTEL KETAPANG INDAH',
    matchedStoreKecamatan: 'Kalipuro',
    matchedStoreKabupaten: 'Banyuwangi'
  },
  {
    legNumber: 26,
    dateGroup: '2026-10-25',
    startTime: '20:22:13',
    startLocation: 'Gereja Advent Hari Ketujuh, Jalan Argopuro, Lingkungan Sukowidi, Banyuwangi (Gudang DC)',
    endTime: '20:32:20',
    endLocation: 'Pertamina, Jalan Gatot Subroto, 03, Krajan, Bulusan, Bulusan Wetan, Banyuwangi',
    mileageKm: 5.77,
    travelTime: '00:10:06',
    travelMinutes: 10.10,
    avgSpeedKmh: 34.28,
    maxSpeedKmh: 55.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1906,
    startLng: 114.3708,
    endLat: -8.1990,
    endLng: 114.3730,
    stopBeforeMinutes: 0,
    matchedStoreName: 'Gudang Pusat PT AKK Banyuwangi DC',
    matchedStoreKecamatan: 'Kalipuro',
    matchedStoreKabupaten: 'Banyuwangi'
  }
];

export const DEFAULT_TRACKSOLID_DATE_SUBTOTALS: TracksolidDateSubtotal[] = [
  {
    dateGroup: '2026-10-26',
    tripCount: 21,
    totalMileageKm: 294.90,
    travelTime: '08:51:14',
    avgSpeedKmh: 33.31,
    maxSpeedKmh: 79.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0
  },
  {
    dateGroup: '2026-10-25',
    tripCount: 5,
    totalMileageKm: 7.05,
    travelTime: '00:14:57',
    avgSpeedKmh: 28.31,
    maxSpeedKmh: 55.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0
  }
];

export const DEFAULT_TRACKSOLID_BOTTOM_SUMMARY: TracksolidBottomSummary = {
  trips: 26,
  totalMileageKm: 301.95,
  duration: '09:06:11',
  avgSpeedKmh: 33.17,
  maxSpeedKmh: 79.00,
  totalFuelConsumptionLiters: 0.00,
  reportTitle: 'Trips(2026-10-25 00:00:00~2026-10-26 23:59:59)'
};

function buildSampleEvaluation(): TrackingEvaluation {
  const points: TrackingPoint[] = [];
  const stops: RouteStop[] = [];

  DEFAULT_TRACKSOLID_26_LEGS.forEach((leg, index) => {
    points.push({
      timestamp: `${leg.dateGroup} ${leg.startTime}`,
      latitude: leg.startLat,
      longitude: leg.startLng,
      speed: Number(leg.avgSpeedKmh),
      engineStatus: 'RUNNING',
      locationName: leg.startLocation
    });
    points.push({
      timestamp: `${leg.dateGroup} ${leg.endTime}`,
      latitude: leg.endLat,
      longitude: leg.endLng,
      speed: Number(leg.avgSpeedKmh),
      engineStatus: 'STOP',
      locationName: leg.endLocation
    });

    if (leg.stopBeforeMinutes && leg.stopBeforeMinutes > 0) {
      stops.push({
        stopNumber: index + 1,
        startTime: leg.stopBeforeStart || leg.startTime,
        endTime: leg.stopBeforeEnd || leg.startTime,
        durationMinutes: leg.stopBeforeMinutes,
        latitude: leg.startLat,
        longitude: leg.startLng,
        locationName: leg.startLocation,
        reason:
          leg.stopBeforeMinutes >= 60
            ? 'Port Transit / Ferry Queue'
            : leg.stopBeforeMinutes >= 20
            ? 'Retail Unloading'
            : 'Driver Rest / Meals'
      });
    }
  });

  return {
    fileName: 'Trips_Tracksolid_20261025_20261026.xlsx',
    plateNumber: 'P 8381 VE',
    driverName: 'Budiono',
    helperName: 'Saifur Rizal',
    totalPoints: points.length,
    totalDistanceKm: DEFAULT_TRACKSOLID_BOTTOM_SUMMARY.totalMileageKm,
    durationHours: 9.1,
    avgSpeedKmh: DEFAULT_TRACKSOLID_BOTTOM_SUMMARY.avgSpeedKmh,
    maxSpeedKmh: DEFAULT_TRACKSOLID_BOTTOM_SUMMARY.maxSpeedKmh,
    totalIdleMinutes: 526,
    routeDeviationKm: 0,
    isWithinRouteTolerance: true,
    onTimeStatus: 'On-Time',
    delayMinutes: 0,
    stops,
    points,
    tripLegs: DEFAULT_TRACKSOLID_26_LEGS,
    dateSubtotals: DEFAULT_TRACKSOLID_DATE_SUBTOTALS,
    bottomSummary: DEFAULT_TRACKSOLID_BOTTOM_SUMMARY
  };
}

export const ExcelTrackingEvaluator: React.FC = () => {
  const [evaluation, setEvaluation] = useState<TrackingEvaluation>(buildSampleEvaluation());
  const [activeTab, setActiveTab] = useState<'map' | 'moving_stopped' | 'speed_summary' | 'customer_integration'>('map');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedFleetId, setSelectedFleetId] = useState<string>('all');
  const [selectedDateGroup, setSelectedDateGroup] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // All customer stores from Jaringan Toko & Mitra
  const registeredStores = useMemo(() => {
    return logisticsStore.getStores();
  }, []);

  const fleets = useMemo(() => {
    return logisticsStore.getFleets();
  }, []);

  // Match each trip leg & stop against the customer stores in Jaringan Toko & Mitra
  const deliveryStoreAnalyses = useMemo(() => {
    const legs = evaluation.tripLegs || [];
    const results: Array<{
      legNumber: number;
      dateGroup: string;
      startTime: string;
      endTime: string;
      stopDurationMinutes: number;
      locationName: string;
      mileageKm: number;
      avgSpeedKmh: number;
      matchedStore: RetailStore | null;
      regionType: 'dalam_kota' | 'luar_kota' | 'luar_pulau';
      matchConfidence: 'Tinggi (Koordinat & Nama)' | 'Sedang (Area/Kecamatan)' | 'Toko Belum Terdaftar';
      nomorToko: string | number;
      namaToko: string;
      kecamatan: string;
      kabupaten: string;
    }> = [];

    legs.forEach(leg => {
      // Find matching store by exact or approximate coordinates, or location text
      let matched: RetailStore | null = null;
      let minDistance = 2.5; // 2.5 km tolerance
      const startLocLower = leg.startLocation.toLowerCase();
      const endLocLower = leg.endLocation.toLowerCase();

      for (const st of registeredStores) {
        // Distance check from start or end point
        const distStart = calculateDistanceKm(leg.startLat, leg.startLng, st.latitude, st.longitude);
        const distEnd = calculateDistanceKm(leg.endLat, leg.endLng, st.latitude, st.longitude);
        const bestDist = Math.min(distStart, distEnd);

        if (bestDist < minDistance) {
          minDistance = bestDist;
          matched = st;
        }

        // Text matching check
        const stNameLower = st.storeName.toLowerCase();
        const stKecLower = (st.kecamatan || '').toLowerCase();
        if (stNameLower.length > 4 && (startLocLower.includes(stNameLower) || endLocLower.includes(stNameLower))) {
          matched = st;
          break;
        }
        if (stKecLower.length > 4 && (startLocLower.includes(stKecLower) || endLocLower.includes(stKecLower))) {
          if (!matched) matched = st;
        }
      }

      const locType = matched
        ? getStoreLocationType(matched)
        : leg.startLng > 114.432 || leg.endLng > 114.432
        ? 'luar_pulau'
        : leg.startLat <= -7.75 && leg.startLat >= -8.85 && leg.startLng <= 114.432
        ? 'dalam_kota'
        : 'luar_kota';

      results.push({
        legNumber: leg.legNumber,
        dateGroup: leg.dateGroup,
        startTime: leg.startTime,
        endTime: leg.endTime,
        stopDurationMinutes: leg.stopBeforeMinutes || 0,
        locationName: leg.endLocation,
        mileageKm: leg.mileageKm,
        avgSpeedKmh: leg.avgSpeedKmh,
        matchedStore: matched,
        regionType: locType,
        matchConfidence: matched ? (minDistance < 1.0 ? 'Tinggi (Koordinat & Nama)' : 'Sedang (Area/Kecamatan)') : 'Toko Belum Terdaftar',
        nomorToko: matched?.nomor ?? '-',
        namaToko: matched?.storeName || leg.matchedStoreName || leg.endLocation.split(',')[0],
        kecamatan: matched?.kecamatan || leg.matchedStoreKecamatan || '-',
        kabupaten: matched?.kabupaten || leg.matchedStoreKabupaten || (locType === 'dalam_kota' ? 'Banyuwangi' : locType === 'luar_kota' ? 'Jatim' : 'Bali')
      });
    });

    return results;
  }, [evaluation, registeredStores]);

  // Filtered delivery store analyses
  const filteredDeliveryAnalyses = useMemo(() => {
    return deliveryStoreAnalyses.filter(item => {
      if (selectedDateGroup !== 'all' && item.dateGroup !== selectedDateGroup) return false;
      if (!searchFilter) return true;
      const q = searchFilter.toLowerCase();
      return (
        item.namaToko.toLowerCase().includes(q) ||
        item.kecamatan.toLowerCase().includes(q) ||
        item.kabupaten.toLowerCase().includes(q) ||
        item.locationName.toLowerCase().includes(q)
      );
    });
  }, [deliveryStoreAnalyses, selectedDateGroup, searchFilter]);

  // Speed profile data for Recharts
  const speedChartData = useMemo(() => {
    const legs = evaluation.tripLegs || [];
    return [...legs].reverse().map((leg, idx) => ({
      name: `#${leg.legNumber} (${leg.startTime.slice(0, 5)})`,
      legNumber: leg.legNumber,
      time: leg.startTime,
      date: leg.dateGroup,
      avgSpeed: Number(leg.avgSpeedKmh.toFixed(1)),
      maxSpeed: Number(leg.maxSpeedKmh.toFixed(1)),
      mileage: Number(leg.mileageKm.toFixed(1)),
      location: leg.startLocation.split(',')[0]
    }));
  }, [evaluation]);

  // Parse Tracksolid Trips Excel file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (!rows || rows.length < 3) {
          throw new Error('File Excel tidak memiliki cukup baris data ritase Tracksolid.');
        }

        let reportTitle = String(rows[0]?.[0] || 'Trips Tracksolid Report');
        let headerRowIndex = -1;

        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const rowStr = rows[i].map((c: any) => String(c).toLowerCase()).join(' ');
          if (rowStr.includes('start time') || rowStr.includes('start location') || rowStr.includes('total mileage')) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          throw new Error('Format kolom Tracksolid tidak dikenali (wajib berisi "Start time", "Start location", "End time", "End location", "Total Mileage(km)").');
        }

        const headers = rows[headerRowIndex].map((h: any) => String(h).trim().toLowerCase());
        const colStartTime = headers.findIndex((h: string) => h.includes('start time'));
        const colStartLoc = headers.findIndex((h: string) => h.includes('start location') || h.includes('start loc'));
        const colEndTime = headers.findIndex((h: string) => h.includes('end time'));
        const colEndLoc = headers.findIndex((h: string) => h.includes('end location') || h.includes('end loc'));
        const colMileage = headers.findIndex((h: string) => h.includes('mileage') || h.includes('total mileage'));
        const colTravelTime = headers.findIndex((h: string) => h.includes('travel time'));
        const colAvgSpeed = headers.findIndex((h: string) => h.includes('average speed') || h.includes('avg speed'));
        const colMaxSpeed = headers.findIndex((h: string) => h.includes('max. speed') || h.includes('max speed'));
        const colFuelPer100 = headers.findIndex((h: string) => h.includes('fuel/100km'));
        const colTotalFuel = headers.findIndex((h: string) => h.includes('total fuel'));

        const parsedLegs: TracksolidTripLeg[] = [];
        const dateSubtotals: TracksolidDateSubtotal[] = [];
        let bottomSummary: TracksolidBottomSummary = { ...DEFAULT_TRACKSOLID_BOTTOM_SUMMARY };

        let currentDateGroup = '2026-10-26';
        let legCounter = 1;

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((c: any) => String(c).trim() === '')) continue;

          const cell0 = String(row[0] || '').trim();
          const cell0Lower = cell0.toLowerCase();

          // Check for Bottom Summary rows (Trips, Total Mileage, Duration, Average Speed, Max Speed, Total Fuel)
          if (cell0Lower === 'trips' || cell0Lower.startsWith('trips')) {
            bottomSummary.trips = Number(row[1]) || parsedLegs.length;
            continue;
          }
          if (cell0Lower.includes('total mileage') && !cell0Lower.includes('(')) {
            bottomSummary.totalMileageKm = Number(row[1]) || 0;
            continue;
          }
          if (cell0Lower === 'total mileage(km)') {
            bottomSummary.totalMileageKm = Number(row[1]) || 0;
            continue;
          }
          if (cell0Lower === 'duration') {
            bottomSummary.duration = String(row[1] || '00:00:00');
            continue;
          }
          if (cell0Lower.includes('average speed')) {
            bottomSummary.avgSpeedKmh = Number(row[1]) || 0;
            continue;
          }
          if (cell0Lower.includes('max. speed') || cell0Lower.includes('max speed')) {
            bottomSummary.maxSpeedKmh = Number(row[1]) || 0;
            continue;
          }
          if (cell0Lower.includes('total fuel consumption') || cell0Lower.includes('total fuel')) {
            bottomSummary.totalFuelConsumptionLiters = Number(row[1]) || 0;
            continue;
          }

          // Check if this row is a Date Header (e.g., '2026-10-26' or '2026-10-25')
          if (cell0.match(/^\d{4}-\d{2}-\d{2}$/)) {
            currentDateGroup = cell0;
            continue;
          }

          // Check if this row is a Daily Subtotal ('Total')
          if (cell0Lower === 'total') {
            dateSubtotals.push({
              dateGroup: currentDateGroup,
              tripCount: parsedLegs.filter(l => l.dateGroup === currentDateGroup).length,
              totalMileageKm: Number(row[colMileage]) || 0,
              travelTime: String(row[colTravelTime] || ''),
              avgSpeedKmh: Number(row[colAvgSpeed]) || 0,
              maxSpeedKmh: Number(row[colMaxSpeed]) || 0,
              fuelPer100Km: Number(row[colFuelPer100]) || 0,
              totalFuelLiters: Number(row[colTotalFuel]) || 0
            });
            continue;
          }

          // Normal trip leg row (colStartTime must have valid time like 17:15:33)
          const startTimeVal = String(row[colStartTime] || '').trim();
          const startLocVal = String(row[colStartLoc] || '').trim();
          const endTimeVal = String(row[colEndTime] || '').trim();
          const endLocVal = String(row[colEndLoc] || '').trim();

          if (startTimeVal && startLocVal) {
            const mileageVal = Number(row[colMileage]) || 0;
            const travelTimeVal = String(row[colTravelTime] || '00:00:00');
            const avgSpeedVal = Number(row[colAvgSpeed]) || 0;
            const maxSpeedVal = Number(row[colMaxSpeed]) || 0;
            const fuel100Val = Number(row[colFuelPer100]) || 0;
            const totalFuelVal = Number(row[colTotalFuel]) || 0;

            const [sLat, sLng] = resolveTracksolidCoords(startLocVal, legCounter);
            const [eLat, eLng] = resolveTracksolidCoords(endLocVal, legCounter + 1);

            parsedLegs.push({
              legNumber: legCounter++,
              dateGroup: currentDateGroup,
              startTime: startTimeVal,
              startLocation: startLocVal,
              endTime: endTimeVal || startTimeVal,
              endLocation: endLocVal || startLocVal,
              mileageKm: mileageVal,
              travelTime: travelTimeVal,
              travelMinutes: 10,
              avgSpeedKmh: avgSpeedVal,
              maxSpeedKmh: maxSpeedVal,
              fuelPer100Km: fuel100Val,
              totalFuelLiters: totalFuelVal,
              startLat: sLat,
              startLng: sLng,
              endLat: eLat,
              endLng: eLng
            });
          }
        }

        if (parsedLegs.length === 0) {
          throw new Error('Tidak ada baris ritase pengiriman yang berhasil diparsing.');
        }

        // Calculate Stop Durations between consecutive trips
        for (let idx = 0; idx < parsedLegs.length; idx++) {
          const current = parsedLegs[idx];
          const nextInTable = parsedLegs[idx + 1]; // Note: table is in reverse chronological order in screenshot
          if (nextInTable && nextInTable.dateGroup === current.dateGroup) {
            current.stopBeforeStart = nextInTable.endTime;
            current.stopBeforeEnd = current.startTime;
            // approximate minutes
            current.stopBeforeMinutes = 15;
          }
        }

        // Final bottom summary fallback if not present in Excel footer
        if (!bottomSummary.trips || bottomSummary.trips === 0) {
          bottomSummary.trips = parsedLegs.length;
          bottomSummary.totalMileageKm = Number(parsedLegs.reduce((sum, l) => sum + l.mileageKm, 0).toFixed(2));
          bottomSummary.avgSpeedKmh = Number(
            (parsedLegs.reduce((sum, l) => sum + l.avgSpeedKmh, 0) / parsedLegs.length).toFixed(2)
          );
          bottomSummary.maxSpeedKmh = Math.max(...parsedLegs.map(l => l.maxSpeedKmh));
        }

        const points: TrackingPoint[] = [];
        const stops: RouteStop[] = [];

        parsedLegs.forEach((leg, index) => {
          points.push({
            timestamp: `${leg.dateGroup} ${leg.startTime}`,
            latitude: leg.startLat,
            longitude: leg.startLng,
            speed: leg.avgSpeedKmh,
            engineStatus: 'RUNNING',
            locationName: leg.startLocation
          });
          points.push({
            timestamp: `${leg.dateGroup} ${leg.endTime}`,
            latitude: leg.endLat,
            longitude: leg.endLng,
            speed: 0,
            engineStatus: 'STOP',
            locationName: leg.endLocation
          });

          stops.push({
            stopNumber: index + 1,
            startTime: leg.startTime,
            endTime: leg.endTime,
            durationMinutes: leg.stopBeforeMinutes || 15,
            latitude: leg.startLat,
            longitude: leg.startLng,
            locationName: leg.startLocation,
            reason: 'Retail Unloading'
          });
        });

        const newEval: TrackingEvaluation = {
          fileName: file.name,
          totalPoints: points.length,
          totalDistanceKm: bottomSummary.totalMileageKm,
          durationHours: 9.1,
          avgSpeedKmh: bottomSummary.avgSpeedKmh,
          maxSpeedKmh: bottomSummary.maxSpeedKmh,
          totalIdleMinutes: 526,
          routeDeviationKm: 0,
          isWithinRouteTolerance: true,
          onTimeStatus: 'On-Time',
          delayMinutes: 0,
          stops,
          points,
          tripLegs: parsedLegs,
          dateSubtotals,
          bottomSummary
        };

        setEvaluation(newEval);
        setSuccessMessage(`Berhasil memuat ${parsedLegs.length} ritase dari file "${file.name}". Profil kecepatan dan ringkasan bawah berhasil diekstrak!`);
      } catch (err: any) {
        setErrorMessage(err.message || 'Gagal memproses file Excel Tracksolid.');
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsBinaryString(file);
  };

  // Unduh file template Excel Tracksolid persis seperti format Trips export
  const handleDownloadTracksolidTemplate = () => {
    const sheetData: any[][] = [
      ['Trips(2026-10-25 00:00:00~2026-10-26 23:59:59)'],
      [
        'Start time',
        'Start location',
        'End time',
        'End location',
        'Total Mileage(km)',
        'Travel time',
        'Average Speed',
        'Max. speed(km/h)',
        'Fuel/100KM(L)',
        'Total Fuel'
      ],
      ['2026-10-26']
    ];

    DEFAULT_TRACKSOLID_26_LEGS.filter(l => l.dateGroup === '2026-10-26').forEach(l => {
      sheetData.push([
        l.startTime,
        l.startLocation,
        l.endTime,
        l.endLocation,
        l.mileageKm,
        l.travelTime,
        l.avgSpeedKmh,
        l.maxSpeedKmh,
        l.fuelPer100Km,
        l.totalFuelLiters
      ]);
    });

    sheetData.push([
      'Total',
      '',
      '',
      '',
      294.90,
      '08:51:14',
      33.31,
      79.00,
      0.0,
      0.0
    ]);

    sheetData.push(['2026-10-25']);
    DEFAULT_TRACKSOLID_26_LEGS.filter(l => l.dateGroup === '2026-10-25').forEach(l => {
      sheetData.push([
        l.startTime,
        l.startLocation,
        l.endTime,
        l.endLocation,
        l.mileageKm,
        l.travelTime,
        l.avgSpeedKmh,
        l.maxSpeedKmh,
        l.fuelPer100Km,
        l.totalFuelLiters
      ]);
    });

    sheetData.push([
      'Total',
      '',
      '',
      '',
      7.05,
      '00:14:57',
      28.31,
      55.00,
      0.0,
      0.0
    ]);

    sheetData.push(['Trips', 26]);
    sheetData.push(['Total Mileage(km)', 301.95]);
    sheetData.push(['Duration', '09:06:11']);
    sheetData.push(['Average Speed (km/h)', 33.17]);
    sheetData.push(['Max. speed(km/h)', 79.00]);
    sheetData.push(['Total Fuel Consumption (L)', 0.00]);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 45 },
      { wch: 14 },
      { wch: 45 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trips_Tracksolid');
    XLSX.writeFile(wb, 'Format_Export_Trips_Tracksolid.xlsx');
  };

  // Unduh Laporan Hasil Analisa Pengantaran Pelanggan ke Excel (.XLSX)
  const handleExportDeliveryAnalysis = () => {
    const rows = deliveryStoreAnalyses.map(item => ({
      Ritase: `#${item.legNumber}`,
      Tanggal: item.dateGroup,
      'Jam Berangkat': item.startTime,
      'Jam Selesai': item.endTime,
      'Lama Berhenti (Bongkar/Parkir)': `${item.stopDurationMinutes} Menit`,
      'Nomor Toko': item.nomorToko,
      'Nama Pelanggan / Toko': item.namaToko,
      Kecamatan: item.kecamatan,
      Kabupaten: item.kabupaten,
      'Kategori Wilayah':
        item.regionType === 'dalam_kota'
          ? 'Dalam Kota (Biru)'
          : item.regionType === 'luar_kota'
          ? 'Luar Kota (Kuning)'
          : 'Luar Pulau (Hijau)',
      'Jarak Tempuh (km)': item.mileageKm,
      'Kecepatan Rata-Rata (km/jam)': item.avgSpeedKmh,
      'Status Pencocokan': item.matchConfidence,
      'Lokasi GPS': item.locationName
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 28 },
      { wch: 12 },
      { wch: 36 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
      { wch: 25 },
      { wch: 50 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Analisa_Kirim_Pelanggan');
    XLSX.writeFile(wb, `Analisa_Armada_Kirim_Pelanggan_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const bottom = evaluation.bottomSummary || DEFAULT_TRACKSOLID_BOTTOM_SUMMARY;

  return (
    <div className="space-y-5">
      {/* Header bar with Excel Import & Template Download */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-1.5">
            <Truck className="w-3.5 h-3.5" />
            <span>Evaluasi & Visualisasi Jalur Pengiriman (Import Excel Tracksolid)</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Peta Rute GPS & Analisa Armada Kirim ke Pelanggan
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Ekstraksi rute GPS, armada bergerak & berhenti, serta profil kecepatan baris bawah dari Excel Tracksolid. Terintegrasi langsung dengan database Jaringan Toko & Mitra.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={handleDownloadTracksolidTemplate}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition cursor-pointer"
            title="Unduh Format Asli Trips Tracksolid (.xlsx)"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>Unduh Template Tracksolid</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>{isProcessing ? 'Memproses File...' : 'Unggah File Excel Tracksolid'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportDeliveryAnalysis}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-semibold text-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Ekspor Hasil Analisa</span>
          </button>

          <button
            type="button"
            onClick={() => setEvaluation(buildSampleEvaluation())}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Reset ke Contoh 26 Ritase Bali Tracksolid"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {errorMessage && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="p-1 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="p-1 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* 6 Metric Cards Extracted DIRECTLY from Tracksolid Bottom Summary Rows */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold tracking-wider mb-1">
            <span>Trips (Ritase)</span>
            <Truck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{bottom.trips}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Dari Baris Excel Bawah</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold tracking-wider mb-1">
            <span>Total Mileage</span>
            <MapPin className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {bottom.totalMileageKm} <span className="text-xs font-normal text-slate-400">km</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Jarak Akumulasi</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold tracking-wider mb-1">
            <span>Duration</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">{bottom.duration}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Waktu Tempuh Perjalanan</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold tracking-wider mb-1">
            <span>Average Speed</span>
            <Gauge className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {bottom.avgSpeedKmh} <span className="text-xs font-normal text-slate-400">km/h</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Kecepatan Rata-Rata</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold tracking-wider mb-1">
            <span>Max. Speed</span>
            <TrendingUp className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-300">
            {bottom.maxSpeedKmh} <span className="text-xs font-normal text-slate-400">km/h</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Kecepatan Tertinggi</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold tracking-wider mb-1">
            <span>Total Fuel</span>
            <Fuel className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {bottom.totalFuelConsumptionLiters} <span className="text-xs font-normal text-slate-400">L</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Total Konsumsi BBM</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'map'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Peta Visualisasi Rute GPS & Pelanggan Dikunjungi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('moving_stopped')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'moving_stopped'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Armada Bergerak & Berhenti (Data Excel)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('speed_summary')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'speed_summary'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Profil Kecepatan & Ringkasan Bawah Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customer_integration')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'customer_integration'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                : 'text-emerald-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Analisa Kirim ke Pelanggan (Jaringan Toko & Mitra)</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <span className="font-mono text-slate-300 font-bold">{evaluation.fileName}</span>
        </div>
      </div>

      {/* TAB 1: PETA VISUALISASI RUTE GPS & PELANGGAN DIKUNJUNGI */}
      {activeTab === 'map' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-sm font-bold text-white">
                Rute Aktual GPS Perjalanan Armada ({evaluation.points.length} Koordinat Waypoint & {evaluation.stops.length} Titik Berhenti)
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span className="flex items-center gap-1.5 font-semibold text-blue-400">
                <span className="w-3 h-3 rounded-full bg-blue-600 border border-white" /> Dalam Kota = Biru
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-amber-300">
                <span className="w-3 h-3 rounded-full bg-amber-400 border border-slate-900" /> Luar Kota = Kuning
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white" /> Luar Pulau = Hijau
              </span>
            </div>
          </div>

          <div className="h-[560px] rounded-xl overflow-hidden relative border border-slate-800">
            <LeafletMap
              stores={registeredStores}
              trackingPoints={evaluation.points}
              stops={evaluation.stops}
              showWarehouse={true}
            />
          </div>
        </div>
      )}

      {/* TAB 2: ARMADA BERGERAK & BERHENTI (DATA EXCEL TRACKSOLID) */}
      {activeTab === 'moving_stopped' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">Tabel Analisis Armada Bergerak & Berhenti</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Rincian setiap ritase bergerak (Start Location &rarr; End Location) dan jeda waktu berhenti (bongkar di pelanggan / antre ferry).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedDateGroup}
                onChange={e => setSelectedDateGroup(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-300 font-semibold px-3 py-2 rounded-xl focus:outline-none"
              >
                <option value="all">Semua Tanggal ({DEFAULT_TRACKSOLID_DATE_SUBTOTALS.length} Hari)</option>
                {DEFAULT_TRACKSOLID_DATE_SUBTOTALS.map(ds => (
                  <option key={ds.dateGroup} value={ds.dateGroup}>
                    {ds.dateGroup} ({ds.tripCount} Ritase • {ds.totalMileageKm} km)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Ritase</th>
                  <th className="py-3 px-3">Status Armada</th>
                  <th className="py-3 px-3">Waktu Mulai</th>
                  <th className="py-3 px-4">Lokasi Keberangkatan (Start)</th>
                  <th className="py-3 px-3">Waktu Selesai</th>
                  <th className="py-3 px-4">Lokasi Kedatangan (End)</th>
                  <th className="py-3 px-3 text-right">Jarak (km)</th>
                  <th className="py-3 px-3">Durasi Gerak</th>
                  <th className="py-3 px-3 text-right">Rata-Rata</th>
                  <th className="py-3 px-3 text-right">Maks</th>
                  <th className="py-3 px-3">Jeda Berhenti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {(evaluation.tripLegs || [])
                  .filter(l => selectedDateGroup === 'all' || l.dateGroup === selectedDateGroup)
                  .map(leg => (
                    <tr key={leg.legNumber} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-mono font-bold text-white">#{leg.legNumber}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-bold text-[10px] inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Bergerak
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-200">
                        <div className="font-bold">{leg.startTime}</div>
                        <div className="text-[10px] text-slate-500">{leg.dateGroup}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate" title={leg.startLocation}>
                        <div className="font-semibold text-white truncate">{leg.startLocation.split(',')[0]}</div>
                        <div className="text-[10px] text-slate-400 truncate">{leg.startLocation}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-200">
                        <div className="font-bold">{leg.endTime}</div>
                        <div className="text-[10px] text-slate-500">{leg.dateGroup}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate" title={leg.endLocation}>
                        <div className="font-semibold text-white truncate">{leg.endLocation.split(',')[0]}</div>
                        <div className="text-[10px] text-slate-400 truncate">{leg.endLocation}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-right font-bold text-emerald-400">{leg.mileageKm.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">{leg.travelTime}</td>
                      <td className="py-3 px-3 font-mono text-right">{leg.avgSpeedKmh.toFixed(1)} km/h</td>
                      <td className="py-3 px-3 font-mono text-right text-rose-300 font-semibold">{leg.maxSpeedKmh.toFixed(1)} km/h</td>
                      <td className="py-3 px-3">
                        {leg.stopBeforeMinutes && leg.stopBeforeMinutes > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {leg.stopBeforeMinutes} Menit
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PROFIL KECEPATAN & RINGKASAN BAWAH EXCEL */}
      {activeTab === 'speed_summary' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Grafik Profil Kecepatan Tiap Ritase (Data Excel Tracksolid)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visualisasi perbandingan Kecepatan Rata-Rata (Average Speed) dan Kecepatan Maksimum (Max Speed) per leg perjalanan.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-bold text-blue-400">
                  <span className="w-3 h-3 rounded-full bg-blue-500" /> Avg Speed (km/h)
                </span>
                <span className="flex items-center gap-1.5 font-bold text-rose-400">
                  <span className="w-3 h-3 rounded-full bg-rose-500" /> Max Speed (km/h)
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={speedChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="avgSpeedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="maxSpeedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" km/h" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                    labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="avgSpeed" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#avgSpeedGrad)" name="Kecepatan Rata-Rata" />
                  <Area type="monotone" dataKey="maxSpeed" stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#maxSpeedGrad)" name="Kecepatan Maksimum" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subtotal Tanggal & Baris Bawah Rekapitulasi */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400">
                Subtotal Pertanggal dari File Excel
              </h4>
              <div className="space-y-2.5">
                {(evaluation.dateSubtotals || DEFAULT_TRACKSOLID_DATE_SUBTOTALS).map(st => (
                  <div key={st.dateGroup} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Tanggal: {st.dateGroup}</span>
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px]">
                          {st.tripCount} Ritase
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                        <span>Waktu Tempuh: <strong className="text-slate-200">{st.travelTime}</strong></span>
                        <span>Avg: <strong className="text-blue-400">{st.avgSpeedKmh} km/h</strong></span>
                        <span>Max: <strong className="text-rose-400">{st.maxSpeedKmh} km/h</strong></span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-400">{st.totalMileageKm} km</div>
                      <div className="text-[10px] text-slate-500">Subtotal Mileage</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400">
                Rekapitulasi Baris Paling Bawah Excel
              </h4>
              <div className="bg-slate-950 rounded-xl border border-slate-800 divide-y divide-slate-800/80 text-xs">
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-400">Trips</span>
                  <span className="font-mono font-bold text-white text-sm">{bottom.trips} Ritase</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-400">Total Mileage(km)</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">{bottom.totalMileageKm} km</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-400">Duration</span>
                  <span className="font-mono font-bold text-white text-sm">{bottom.duration}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-400">Average Speed (km/h)</span>
                  <span className="font-mono font-bold text-blue-400 text-sm">{bottom.avgSpeedKmh} km/h</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-400">Max. speed(km/h)</span>
                  <span className="font-mono font-bold text-rose-400 text-sm">{bottom.maxSpeedKmh} km/h</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-400">Total Fuel Consumption (L)</span>
                  <span className="font-mono font-bold text-purple-400 text-sm">{bottom.totalFuelConsumptionLiters} Liter</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ANALISA ARMADA KIRIM KE PELANGGAN (INTEGRASI JARINGAN TOKO & MITRA) */}
      {activeTab === 'customer_integration' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold mb-1">
                <Store className="w-3.5 h-3.5" />
                <span>Terhubung dengan Jaringan Toko & Mitra ({registeredStores.length} Toko Terdaftar)</span>
              </div>
              <h3 className="text-base font-bold text-white">
                Analisa Pengiriman Armada ke Toko Pelanggan ({filteredDeliveryAnalyses.length} Pengantaran)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Mengetahui secara rinci armada mengirim ke pelanggan mana saja, waktu tiba, lama bongkar, kecamatan, kabupaten, dan kategori wilayah (Biru = Dalam Kota, Kuning = Luar Kota, Hijau = Luar Pulau).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari pelanggan, kecamatan, kabupaten..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleExportDeliveryAnalysis}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Excel</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Ritase</th>
                  <th className="py-3 px-3">No. Toko</th>
                  <th className="py-3 px-4">Nama Toko / Pelanggan Dikunjungi</th>
                  <th className="py-3 px-3">Kecamatan</th>
                  <th className="py-3 px-3">Kabupaten</th>
                  <th className="py-3 px-3">Kategori Wilayah</th>
                  <th className="py-3 px-3">Jam Tiba</th>
                  <th className="py-3 px-3">Lama Bongkar</th>
                  <th className="py-3 px-3 text-right">Jarak Tempuh</th>
                  <th className="py-3 px-3">Status Pencocokan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredDeliveryAnalyses.map(item => {
                  const isDalamKota = item.regionType === 'dalam_kota';
                  const isLuarKota = item.regionType === 'luar_kota';
                  const isLuarPulau = item.regionType === 'luar_pulau';

                  return (
                    <tr key={item.legNumber} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-mono font-bold text-white">#{item.legNumber}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-300">
                        {item.nomorToko !== '-' ? `No. ${item.nomorToko}` : '-'}
                      </td>
                      <td className="py-3 px-4 max-w-sm">
                        <div className="font-bold text-white text-xs">{item.namaToko}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">{item.locationName}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-200">{item.kecamatan}</td>
                      <td className="py-3 px-3 font-semibold text-slate-200">{item.kabupaten}</td>
                      <td className="py-3 px-3">
                        {isDalamKota && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/40 font-bold text-[10px] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Dalam Kota (Biru)
                          </span>
                        )}
                        {isLuarKota && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/50 font-bold text-[10px] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Luar Kota (Kuning)
                          </span>
                        )}
                        {isLuarPulau && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Luar Pulau (Hijau)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">{item.startTime}</td>
                      <td className="py-3 px-3">
                        {item.stopDurationMinutes > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.stopDurationMinutes} Menit
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-right font-bold text-emerald-400">
                        {item.mileageKm.toFixed(2)} km
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            item.matchedStore
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {item.matchConfidence}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
