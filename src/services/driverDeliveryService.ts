import { Schedule, ShipmentStatus, Crew, Fleet, RetailStore } from '../types';
import { logisticsStore } from './store';
import { getSupabaseClient } from './supabaseService';

export interface DriverDeliveryStats {
  totalAssigned: number;
  scheduled: number;
  pickedUp: number;
  inTransit: number;
  delivered: number;
  delayed: number;
  totalWeightTon: number;
}

export interface StatusUpdateResult {
  success: boolean;
  message: string;
  syncedToSupabase: boolean;
}

class DriverDeliveryService {
  /**
   * Fetch deliveries assigned to a driver.
   * Pulls from Supabase PostgreSQL if online and available, with graceful fallback to local store.
   */
  public async getDriverDeliveries(driverId?: string): Promise<{
    deliveries: Schedule[];
    isSupabaseLive: boolean;
  }> {
    const supabase = getSupabaseClient();
    const localSchedules = logisticsStore.getSchedules();
    const allCrews = logisticsStore.getCrews();

    // Default target driver: the provided driverId, or the first active driver from crews
    const activeDriver = driverId 
      ? allCrews.find(c => c.id === driverId || c.name.toLowerCase() === driverId.toLowerCase())
      : allCrews.find(c => c.role.includes('Driver')) || allCrews[0];

    const targetDriverId = activeDriver?.id || driverId || '';
    const targetDriverName = activeDriver?.name || '';

    let isSupabaseLive = false;

    // Try live Supabase query
    if (supabase) {
      try {
        const { data: schData, error: schError } = await supabase
          .from('schedules')
          .select(`
            id,
            tracking_number,
            origin_name,
            origin_latitude,
            origin_longitude,
            store_id,
            fleet_id,
            crew_id,
            status,
            departure_date,
            estimated_arrival,
            actual_arrival,
            cargo_description,
            cargo_weight_ton,
            is_inter_island,
            ferry_booking_code,
            transit_port,
            notes,
            created_at
          `)
          .order('departure_date', { ascending: true });

        if (!schError && schData && schData.length > 0) {
          isSupabaseLive = true;
          // Hydrate foreign keys with store references
          const stores = logisticsStore.getStores();
          const fleets = logisticsStore.getFleets();

          const hydrated: Schedule[] = schData.map(row => {
            const matchedStore = stores.find(s => s.id === row.store_id || s.storeName.toLowerCase() === (row.origin_name || '').toLowerCase());
            const matchedFleet = fleets.find(f => f.id === row.fleet_id);
            const matchedCrew = allCrews.find(c => c.id === row.crew_id);

            return {
              id: row.id,
              trackingNumber: row.tracking_number,
              originName: row.origin_name || 'Gudang Pusat Banyuwangi DC',
              originCoords: [Number(row.origin_latitude) || -8.1906, Number(row.origin_longitude) || 114.3708],
              storeId: row.store_id || (matchedStore ? matchedStore.id : 'str-01'),
              store: matchedStore,
              fleetId: row.fleet_id || '',
              fleet: matchedFleet,
              crewId: row.crew_id || '',
              crew: matchedCrew,
              status: (['scheduled', 'picked_up', 'in_transit', 'delivered', 'delayed'].includes(row.status)
                ? row.status
                : 'scheduled') as ShipmentStatus,
              departureDate: row.departure_date,
              estimatedArrival: row.estimated_arrival,
              actualArrival: row.actual_arrival,
              cargoDescription: row.cargo_description || 'Muatan Karton Box AKK',
              cargoWeightTon: Number(row.cargo_weight_ton) || 2.5,
              isInterIsland: Boolean(row.is_inter_island),
              ferryBookingCode: row.ferry_booking_code,
              transitPort: row.transit_port,
              notes: row.notes,
              createdAt: row.created_at
            };
          });

          // Filter for target driver if specified
          const filtered = targetDriverId || targetDriverName
            ? hydrated.filter(s => 
                s.crewId === targetDriverId || 
                (s.crew && s.crew.name.toLowerCase() === targetDriverName.toLowerCase())
              )
            : hydrated;

          // If driver has matches in Supabase, return them
          if (filtered.length > 0) {
            return { deliveries: filtered, isSupabaseLive: true };
          }
        }
      } catch (err) {
        console.warn('[DriverDeliveryService] Supabase pull notice, using local store:', err);
      }
    }

    // Fallback: Filter local store schedules
    const targetDeliveries = (targetDriverId || targetDriverName)
      ? localSchedules.filter(s => 
          s.crewId === targetDriverId ||
          (s.crew && s.crew.name.toLowerCase() === targetDriverName.toLowerCase()) ||
          s.crewHelperId === targetDriverId
        )
      : localSchedules;

    // If still empty (e.g. driver has no active assignment yet), provide relevant local schedules
    const finalDeliveries = targetDeliveries.length > 0 ? targetDeliveries : localSchedules.slice(0, 5);

    return { deliveries: finalDeliveries, isSupabaseLive };
  }

  /**
   * Update delivery status by Driver with notes, proof of delivery photo/data, and Supabase sync.
   */
  public async updateDeliveryStatus(
    scheduleId: string,
    trackingNumber: string,
    newStatus: ShipmentStatus,
    reasonOrNotes?: string,
    podData?: {
      podPhotoUrl?: string;
      podReceiverName?: string;
      podConditionNote?: string;
      podPhotoTimestamp?: string;
    }
  ): Promise<StatusUpdateResult> {
    // 1. Optimistic Local Store update (instant reactivity for UI)
    logisticsStore.updateScheduleStatus(scheduleId, newStatus, reasonOrNotes, podData);

    // 2. Sync to Supabase Backend
    const supabase = getSupabaseClient();
    let syncedToSupabase = false;

    if (supabase) {
      try {
        const updatePayload: Record<string, any> = {
          status: newStatus,
        };

        if (newStatus === 'delivered') {
          updatePayload.actual_arrival = new Date().toISOString();
        }

        if (reasonOrNotes && reasonOrNotes.trim()) {
          updatePayload.notes = reasonOrNotes.trim();
        } else if (podData?.podReceiverName) {
          updatePayload.notes = `Diterima: ${podData.podReceiverName} (${podData.podConditionNote || 'Kondisi Baik'})${podData.podPhotoUrl ? ' [Bukti Foto POD OK]' : ''}`;
        }

        // Try updating by tracking_number first
        const { error: updErr, count } = await supabase
          .from('schedules')
          .update(updatePayload)
          .eq('tracking_number', trackingNumber);

        if (!updErr) {
          syncedToSupabase = true;
        } else {
          // If tracking number update had note, attempt update by UUID
          const { error: idErr } = await supabase
            .from('schedules')
            .update(updatePayload)
            .eq('id', scheduleId);
          if (!idErr) {
            syncedToSupabase = true;
          }
        }
      } catch (err) {
        console.warn('[DriverDeliveryService] Supabase status sync exception (persisted locally):', err);
      }
    }

    const statusLabels: Record<ShipmentStatus, string> = {
      scheduled: 'Terjadwal',
      picked_up: 'Picked Up (Selesai Muat)',
      in_transit: 'In Transit (Berangkat)',
      delivered: 'Delivered (Terkirim)',
      delayed: 'Delayed (Tertunda)'
    };

    return {
      success: true,
      message: `Status pengiriman ${trackingNumber} berhasil diperbarui menjadi "${statusLabels[newStatus]}".`,
      syncedToSupabase
    };
  }

  /**
   * Compute stats for a driver's deliveries
   */
  public computeStats(deliveries: Schedule[]): DriverDeliveryStats {
    let scheduled = 0;
    let pickedUp = 0;
    let inTransit = 0;
    let delivered = 0;
    let delayed = 0;
    let totalWeightTon = 0;

    deliveries.forEach(d => {
      totalWeightTon += Number(d.cargoWeightTon) || 0;
      if (d.status === 'scheduled') scheduled++;
      else if (d.status === 'picked_up') pickedUp++;
      else if (d.status === 'in_transit') inTransit++;
      else if (d.status === 'delivered') delivered++;
      else if (d.status === 'delayed') delayed++;
    });

    return {
      totalAssigned: deliveries.length,
      scheduled,
      pickedUp,
      inTransit,
      delivered,
      delayed,
      totalWeightTon: Number(totalWeightTon.toFixed(1))
    };
  }
}

export const driverDeliveryService = new DriverDeliveryService();
