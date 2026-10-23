import { getSupabaseClient } from './supabaseService';
import { Schedule, ShipmentStatus } from '../types';

/**
 * Supabase Realtime Synchronization & Driver Push Notification Service
 * --------------------------------------------------------------------
 * Manages real-time PostgreSQL subscriptions (`INSERT`, `UPDATE`, `DELETE`) and
 * broadcast channels via Supabase Realtime WebSockets.
 * Enforces strict driver-level filtering so each driver only receives push
 * notifications and real-time updates for schedules assigned specifically to them.
 */

export interface DriverRealtimeNotificationPayload {
  id: string;
  eventType: 'INSERT' | 'UPDATE';
  notificationCategory: 'new_assignment' | 'schedule_updated' | 'status_changed';
  scheduleId: string;
  trackingNumber: string;
  crewId: string;
  crewName?: string;
  crewHelperId?: string;
  crewHelperName?: string;
  crewHelper2Id?: string;
  crewHelper2Name?: string;
  storeName: string;
  areaName?: string;
  plateNumber?: string;
  departureDate?: string;
  status: ShipmentStatus | string;
  previousStatus?: ShipmentStatus | string;
  title: string;
  message: string;
  urgent: boolean;
  timestamp: string;
  changedFields?: string[];
}

export interface DriverSubscriptionConfig {
  driverId: string;
  driverName?: string;
  onNotification: (notification: DriverRealtimeNotificationPayload, rawSchedule?: any) => void;
  onScheduleSync?: () => void;
}

let realtimeChannel: any = null;
let isSubscribed = false;
const listeners: Array<(event: { table: string; eventType: string; payload: any }) => void> = [];
const driverSubscribers = new Map<string, DriverSubscriptionConfig>();
const driverFilteredChannels = new Map<string, any>();
const recentEventSignatures = new Map<string, number>();

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Terjadwal',
  picked_up: 'Telah Dimuat (Picked Up)',
  in_transit: 'Dalam Perjalanan (In Transit)',
  delivered: 'Terkirim (Delivered)',
  delayed: 'Tertunda (Delayed)'
};

function normalizeIdentifier(val?: string | null): string {
  return (val || '').trim().toLowerCase();
}

/**
 * Checks whether a schedule record (from Supabase DB row or client Schedule object)
 * is assigned to the specified driver (either as primary Driver or Helper 1/2).
 */
export function isScheduleAssignedToDriver(
  schedule: Partial<Schedule> & Record<string, any>,
  targetDriverId?: string,
  targetDriverName?: string
): boolean {
  if (!schedule) return false;

  const cleanTargetId = normalizeIdentifier(targetDriverId);
  const cleanTargetName = normalizeIdentifier(targetDriverName);

  if (!cleanTargetId && !cleanTargetName) return false;

  const rowCrewId = normalizeIdentifier(schedule.crewId || schedule.crew_id || schedule.crew?.id);
  const rowHelper1Id = normalizeIdentifier(schedule.crewHelperId || schedule.crew_helper_id || schedule.crewHelper?.id);
  const rowHelper2Id = normalizeIdentifier(schedule.crewHelper2Id || schedule.crew_helper2_id || schedule.crewHelper2?.id);

  // 1. Exact ID match (including usr- / crw- prefix normalization)
  if (cleanTargetId) {
    const strippedTargetId = cleanTargetId.replace(/^(usr-|crw-)/, '');
    const candidateIds = [rowCrewId, rowHelper1Id, rowHelper2Id].filter(Boolean);
    for (const cid of candidateIds) {
      const strippedCid = cid.replace(/^(usr-|crw-)/, '');
      if (cid === cleanTargetId || (strippedTargetId.length >= 3 && strippedCid === strippedTargetId)) {
        return true;
      }
    }
  }

  // 2. Driver / Helper Name match
  if (cleanTargetName && cleanTargetName.length >= 3) {
    const rowCrewName = normalizeIdentifier(schedule.crew?.name || schedule.crewName || schedule.crew_name);
    const rowHelper1Name = normalizeIdentifier(schedule.crewHelper?.name || schedule.crewHelperName || schedule.crew_helper_name);
    const rowHelper2Name = normalizeIdentifier(schedule.crewHelper2?.name || schedule.crewHelper2Name || schedule.crew_helper2_name);

    const candidateNames = [rowCrewName, rowHelper1Name, rowHelper2Name].filter(Boolean);
    for (const cname of candidateNames) {
      if (cname === cleanTargetName || cname.includes(cleanTargetName) || cleanTargetName.includes(cname)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Deduplicate rapid identical realtime events (e.g. broadcast + postgres_changes)
 */
function isDuplicateEvent(signature: string): boolean {
  const now = Date.now();
  const prev = recentEventSignatures.get(signature);
  if (prev && now - prev < 3500) {
    return true;
  }
  recentEventSignatures.set(signature, now);
  if (recentEventSignatures.size > 200) {
    const cutoff = now - 10000;
    for (const [k, ts] of recentEventSignatures.entries()) {
      if (ts < cutoff) recentEventSignatures.delete(k);
    }
  }
  return false;
}

/**
 * Triggers native Browser Push Notification & Haptic Vibration if supported
 */
export function triggerNativeDriverPush(notif: DriverRealtimeNotificationPayload): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(notif.urgent ? [250, 100, 250, 100, 300] : [180, 80, 180]);
    }
  } catch {}

  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(notif.title, {
        body: notif.message,
        tag: notif.id,
        requireInteraction: notif.urgent
      });
    }
  } catch {}
}

/**
 * Builds a structured DriverRealtimeNotificationPayload from a schedule INSERT or UPDATE event
 */
export function buildDriverNotificationPayload(
  eventType: 'INSERT' | 'UPDATE',
  newSchedule: Partial<Schedule> & Record<string, any>,
  oldSchedule?: (Partial<Schedule> & Record<string, any>) | null
): DriverRealtimeNotificationPayload {
  const scheduleId = String(newSchedule.id || oldSchedule?.id || `sch-${Date.now()}`);
  const trackingNumber = String(newSchedule.trackingNumber || newSchedule.tracking_number || oldSchedule?.trackingNumber || 'TRK-AKK');
  const crewId = String(newSchedule.crewId || newSchedule.crew_id || newSchedule.crew?.id || '');
  const crewName = String(newSchedule.crew?.name || newSchedule.crewName || newSchedule.crew_name || '');
  const crewHelperId = String(newSchedule.crewHelperId || newSchedule.crew_helper_id || newSchedule.crewHelper?.id || '');
  const crewHelperName = String(newSchedule.crewHelper?.name || newSchedule.crewHelperName || '');
  const crewHelper2Id = String(newSchedule.crewHelper2Id || newSchedule.crew_helper2_id || newSchedule.crewHelper2?.id || '');
  const crewHelper2Name = String(newSchedule.crewHelper2?.name || newSchedule.crewHelper2Name || '');

  const storeName = String(
    newSchedule.store?.storeName ||
      newSchedule.areaName ||
      newSchedule.area_name ||
      newSchedule.origin_name ||
      'Toko / Area Tujuan'
  );
  const areaName = String(newSchedule.areaName || newSchedule.area_name || storeName);
  const plateNumber = String(newSchedule.fleet?.plateNumber || newSchedule.plateNumber || newSchedule.fleet_id || 'Armada AKK');
  const departureDate = String(newSchedule.departureDate || newSchedule.departure_date || '');
  const status = String(newSchedule.status || 'scheduled');
  const previousStatus = oldSchedule ? String(oldSchedule.status || '') : undefined;

  const depFormatted = departureDate
    ? new Date(departureDate).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Sesuai Jadwal';

  const oldCrewId = oldSchedule ? String(oldSchedule.crewId || oldSchedule.crew_id || oldSchedule.crew?.id || '') : '';
  const isReassignedToNewDriver = Boolean(eventType === 'UPDATE' && oldCrewId && crewId && oldCrewId !== crewId);

  if (eventType === 'INSERT' || isReassignedToNewDriver) {
    return {
      id: `rt-notif-${scheduleId}-${Date.now()}`,
      eventType: 'INSERT',
      notificationCategory: 'new_assignment',
      scheduleId,
      trackingNumber,
      crewId,
      crewName,
      crewHelperId,
      crewHelperName,
      crewHelper2Id,
      crewHelper2Name,
      storeName,
      areaName,
      plateNumber,
      departureDate,
      status,
      previousStatus,
      title: '📦 Penugasan Jadwal Pengiriman Baru',
      message: `Anda menerima tugas pengiriman baru ${trackingNumber} tujuan ${storeName} menggunakan armada ${plateNumber}. Waktu berangkat: ${depFormatted}.`,
      urgent: Boolean(newSchedule.isInterIsland || newSchedule.isUrgentOverride),
      timestamp: new Date().toISOString(),
      changedFields: ['assignment']
    };
  }

  // Determine what changed on an ongoing schedule
  const changedFields: string[] = [];
  const changeDescriptions: string[] = [];

  if (oldSchedule) {
    if (previousStatus && previousStatus !== status) {
      changedFields.push('status');
      changeDescriptions.push(`Status: ${STATUS_LABELS[previousStatus] || previousStatus} → ${STATUS_LABELS[status] || status}`);
    }
    const oldDep = String(oldSchedule.departureDate || oldSchedule.departure_date || '');
    if (oldDep && departureDate && oldDep.slice(0, 16) !== departureDate.slice(0, 16)) {
      changedFields.push('departureDate');
      changeDescriptions.push(`Jadwal berangkat: ${depFormatted}`);
    }
    const oldFleet = String(oldSchedule.fleet?.plateNumber || oldSchedule.fleetId || oldSchedule.fleet_id || '');
    const newFleet = String(newSchedule.fleet?.plateNumber || newSchedule.fleetId || newSchedule.fleet_id || '');
    if (oldFleet && newFleet && oldFleet !== newFleet) {
      changedFields.push('fleet');
      changeDescriptions.push(`Armada: ${plateNumber}`);
    }
    const oldStore = String(oldSchedule.store?.storeName || oldSchedule.areaName || oldSchedule.storeId || '');
    const newStore = String(newSchedule.store?.storeName || newSchedule.areaName || newSchedule.storeId || '');
    if (oldStore && newStore && oldStore !== newStore) {
      changedFields.push('destination');
      changeDescriptions.push(`Tujuan: ${storeName}`);
    }
    const oldNotes = String(oldSchedule.notes || '').trim();
    const newNotes = String(newSchedule.notes || '').trim();
    if (newNotes && oldNotes !== newNotes) {
      changedFields.push('notes');
      changeDescriptions.push(`Catatan: "${newNotes}"`);
    }
  }

  const isStatusChangeOnly = changedFields.length === 1 && changedFields[0] === 'status';
  const summaryText =
    changeDescriptions.length > 0
      ? changeDescriptions.join(' • ')
      : `Status jadwal ${trackingNumber} menuju ${storeName} kini: ${STATUS_LABELS[status] || status}.`;

  const isUrgent = status === 'delayed' || Boolean(newSchedule.isUrgentOverride);

  return {
    id: `rt-notif-${scheduleId}-${Date.now()}`,
    eventType: 'UPDATE',
    notificationCategory: isStatusChangeOnly ? 'status_changed' : 'schedule_updated',
    scheduleId,
    trackingNumber,
    crewId,
    crewName,
    crewHelperId,
    crewHelperName,
    crewHelper2Id,
    crewHelper2Name,
    storeName,
    areaName,
    plateNumber,
    departureDate,
    status,
    previousStatus,
    title:
      status === 'delayed'
        ? '⚠️ Peringatan Jadwal Pengiriman Tertunda'
        : isStatusChangeOnly
        ? '🚚 Pembaruan Status Jadwal Berjalan'
        : '🔄 Perubahan Jadwal Pengiriman Berjalan',
    message: `Jadwal ${trackingNumber} (${storeName}): ${summaryText}`,
    urgent: isUrgent,
    timestamp: new Date().toISOString(),
    changedFields
  };
}

function dispatchToMatchingDrivers(
  eventType: 'INSERT' | 'UPDATE',
  newRow: any,
  oldRow?: any,
  prebuiltNotif?: DriverRealtimeNotificationPayload
) {
  if (!newRow) return;

  const notif = prebuiltNotif || buildDriverNotificationPayload(eventType, newRow, oldRow);
  const sig = `${notif.eventType}:${notif.scheduleId}:${notif.status}:${notif.departureDate || ''}:${(notif.changedFields || []).join(',')}`;
  if (isDuplicateEvent(sig)) return;

  // Simpan notifikasi perubahan jadwal agar tampil di menu Laporan Kiriman Kru
  try {
    const raw = localStorage.getItem('akk_schedule_change_notifs_v1');
    const prevList: DriverRealtimeNotificationPayload[] = raw ? JSON.parse(raw) : [];
    const nextList = [notif, ...prevList.filter(item => item.id !== notif.id)].slice(0, 30);
    localStorage.setItem('akk_schedule_change_notifs_v1', JSON.stringify(nextList));
    window.dispatchEvent(
      new CustomEvent('akk-driver-schedule-realtime', {
        detail: { eventType, schedule: newRow, previousSchedule: oldRow, notification: notif }
      })
    );
  } catch {}

  driverSubscribers.forEach((sub) => {
    const isMatched = isScheduleAssignedToDriver(newRow, sub.driverId, sub.driverName);
    if (isMatched) {
      try {
        sub.onNotification(notif, newRow);
        sub.onScheduleSync?.();
      } catch (err) {
        console.error('[SupabaseRealtime] Error in driver notification callback:', err);
      }
    }
  });
}

export const supabaseRealtimeSync = {
  /**
   * Subscribe to real-time changes on core operational tables
   */
  subscribe(onDataChanged?: (event: { table: string; eventType: string; payload: any }) => void): void {
    if (onDataChanged && !listeners.includes(onDataChanged)) {
      listeners.push(onDataChanged);
    }

    if (isSubscribed && realtimeChannel) return;

    const client = getSupabaseClient();
    if (!client) {
      console.warn('[SupabaseRealtime] Client not initialized. Realtime subscription skipped.');
      return;
    }

    if (realtimeChannel) {
      try {
        client.removeChannel(realtimeChannel);
      } catch (e) {}
      realtimeChannel = null;
    }

    isSubscribed = false;

    try {
      realtimeChannel = client
        .channel('akk-operations-realtime', {
          config: { broadcast: { self: true } }
        })
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'schedules' },
          (payload) => {
            console.log('[SupabaseRealtime] Schedule INSERT received:', payload);
            notifyListeners('schedules', 'INSERT', payload.new);
            dispatchToMatchingDrivers('INSERT', payload.new, null);
            triggerStoreSync();
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'schedules' },
          (payload) => {
            console.log('[SupabaseRealtime] Schedule UPDATE received:', payload);
            notifyListeners('schedules', 'UPDATE', payload.new);
            dispatchToMatchingDrivers('UPDATE', payload.new, payload.old);
            triggerStoreSync();
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'schedules' },
          (payload) => {
            notifyListeners('schedules', 'DELETE', payload.old);
            triggerStoreSync();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'fleets' },
          (payload) => {
            notifyListeners('fleets', payload.eventType, payload.new || payload.old);
            triggerStoreSync();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'driver_reports' },
          (payload) => {
            notifyListeners('driver_reports', payload.eventType, payload.new || payload.old);
            triggerStoreSync();
          }
        )
        .on('broadcast', { event: 'driver-schedule-push' }, (payload) => {
          const data = payload?.payload;
          if (data && data.schedule) {
            dispatchToMatchingDrivers(data.eventType || 'UPDATE', data.schedule, data.previousSchedule, data.notification);
            triggerStoreSync();
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            isSubscribed = true;
            console.log('[SupabaseRealtime] Successfully subscribed to AKK operations channel.');
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            isSubscribed = false;
          }
        });
    } catch (err) {
      isSubscribed = false;
      console.error('[SupabaseRealtime] Failed to establish realtime subscription:', err);
    }
  },

  /**
   * Subscribe specifically for a single Driver's schedule assignments & ongoing updates.
   * Ensures the driver ONLY receives notifications for tasks assigned to them (`crew_id=eq.${driverId}`).
   */
  subscribeForDriver(config: DriverSubscriptionConfig): () => void {
    const key = `${config.driverId || 'anon'}_${config.driverName || ''}`;
    driverSubscribers.set(key, config);

    // Ensure main channel is active
    this.subscribe();

    const client = getSupabaseClient();
    if (client && config.driverId && !driverFilteredChannels.has(config.driverId)) {
      try {
        const driverChannel = client
          .channel(`driver-assigned-schedules-${config.driverId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'schedules',
              filter: `crew_id=eq.${config.driverId}`
            },
            (payload) => {
              dispatchToMatchingDrivers('INSERT', payload.new, null);
              triggerStoreSync();
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'schedules',
              filter: `crew_id=eq.${config.driverId}`
            },
            (payload) => {
              dispatchToMatchingDrivers('UPDATE', payload.new, payload.old);
              triggerStoreSync();
            }
          )
          .subscribe();

        driverFilteredChannels.set(config.driverId, driverChannel);
      } catch (err) {
        console.warn('[SupabaseRealtime] Driver-filtered channel setup notice:', err);
      }
    }

    return () => {
      driverSubscribers.delete(key);
      if (client && config.driverId) {
        const stillHasDriver = Array.from(driverSubscribers.values()).some(s => s.driverId === config.driverId);
        if (!stillHasDriver && driverFilteredChannels.has(config.driverId)) {
          try {
            client.removeChannel(driverFilteredChannels.get(config.driverId));
          } catch {}
          driverFilteredChannels.delete(config.driverId);
        }
      }
    };
  },

  /**
   * Publishes a schedule assignment (`INSERT`) or ongoing schedule update (`UPDATE`)
   * across Supabase PostgreSQL, Supabase Realtime Broadcast, and local driver listeners.
   * Only drivers assigned to this schedule will receive the push notification.
   */
  async publishScheduleChange(
    eventType: 'INSERT' | 'UPDATE',
    schedule: Schedule,
    previousSchedule?: Schedule | null
  ): Promise<DriverRealtimeNotificationPayload> {
    const notification = buildDriverNotificationPayload(eventType, schedule, previousSchedule);

    // 1. Dispatch immediately to any connected driver subscribers matching this schedule's driver
    dispatchToMatchingDrivers(eventType, schedule, previousSchedule, notification);

    // 2. Broadcast over Supabase Realtime WebSocket channel for multi-device / multi-tab driver sessions
    try {
      if (realtimeChannel && isSubscribed) {
        realtimeChannel.send({
          type: 'broadcast',
          event: 'driver-schedule-push',
          payload: {
            eventType,
            schedule,
            previousSchedule: previousSchedule || null,
            notification
          }
        });
      }
    } catch (err) {
      console.warn('[SupabaseRealtime] Broadcast send notice:', err);
    }

    // 3. Upsert to Supabase `schedules` table so `postgres_changes` listeners on other devices fire
    try {
      const client = getSupabaseClient();
      if (client) {
        const dbPayload: Record<string, any> = {
          id: schedule.id,
          tracking_number: schedule.trackingNumber,
          origin_name: schedule.originName || 'Gudang Pusat Banyuwangi DC',
          origin_latitude: schedule.originCoords?.[0] ?? -8.1906,
          origin_longitude: schedule.originCoords?.[1] ?? 114.3708,
          store_id: schedule.storeId,
          fleet_id: schedule.fleetId,
          crew_id: schedule.crewId,
          status: schedule.status,
          departure_date: schedule.departureDate,
          estimated_arrival: schedule.estimatedArrival,
          actual_arrival: schedule.actualArrival || null,
          cargo_description: schedule.cargoDescription,
          cargo_weight_ton: schedule.cargoWeightTon,
          is_inter_island: schedule.isInterIsland,
          ferry_booking_code: schedule.ferryBookingCode || null,
          transit_port: schedule.transitPort || null,
          notes: schedule.notes || null
        };
        await client.from('schedules').upsert(dbPayload, { onConflict: 'id' });
      }
    } catch {}

    // 4. Emit window event for same-device listeners
    try {
      window.dispatchEvent(
        new CustomEvent('akk-driver-schedule-realtime', {
          detail: { eventType, schedule, previousSchedule, notification }
        })
      );
    } catch {}

    return notification;
  },

  /**
   * Unsubscribe from Supabase Realtime channel
   */
  unsubscribe(): void {
    const client = getSupabaseClient();
    if (client && realtimeChannel) {
      client.removeChannel(realtimeChannel);
      realtimeChannel = null;
      isSubscribed = false;
      console.log('[SupabaseRealtime] Unsubscribed from AKK operations channel.');
    }
  },

  /**
   * Register a listener callback
   */
  addListener(callback: (event: { table: string; eventType: string; payload: any }) => void): () => void {
    if (!listeners.includes(callback)) {
      listeners.push(callback);
    }
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  },

  isChannelActive(): boolean {
    return isSubscribed;
  }
};

function notifyListeners(table: string, eventType: string, payload: any) {
  for (const l of listeners) {
    try {
      l({ table, eventType, payload });
    } catch (err) {
      console.error('[SupabaseRealtime] Error in listener callback:', err);
    }
  }
}

function triggerStoreSync() {
  try {
    // Notify window components that state has synchronized from Supabase Realtime
    window.dispatchEvent(new CustomEvent('akk-realtime-synced', { detail: { timestamp: Date.now() } }));
  } catch {}
}
