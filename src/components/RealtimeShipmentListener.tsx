import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';
import { Schedule } from '../types';
import { logisticsStore } from '../services/store';
import {
  isScheduleAssignedToDriver,
  buildDriverNotificationPayload,
  triggerNativeDriverPush,
  DriverRealtimeNotificationPayload
} from '../services/supabaseRealtimeSync';

/**
 * RealtimeShipmentListener
 * ------------------------
 * Subscribes to Supabase Realtime (`postgres_changes` for `INSERT` & `UPDATE` on `public.schedules`
 * as well as real-time schedule broadcast events).
 * - When a Driver / Helper is active, strictly filters notifications so they ONLY receive
 *   push notifications and real-time updates for schedules assigned to them (`crewId`, `crewHelperId`, `crewHelper2Id`, or crew name).
 * - Notifies drivers immediately on:
 *   1. New delivery schedule assignments (`INSERT` or driver re-assignment)
 *   2. Updates to ongoing delivery schedules (`UPDATE` of status, departure time, fleet, destination, or notes)
 */
export const RealtimeShipmentListener: React.FC = () => {
  const { addNotification } = useToast();
  const [currentUser, setCurrentUser] = useState(() => logisticsStore.getCurrentUser());
  const [activeCrew, setActiveCrew] = useState(() => logisticsStore.getActiveDriverCrew());

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setCurrentUser(logisticsStore.getCurrentUser());
      setActiveCrew(logisticsStore.getActiveDriverCrew());
    });
  }, []);

  useEffect(() => {
    const isDriverOrHelperRole =
      currentUser?.role === 'driver' ||
      currentUser?.role === 'crew_helper' ||
      window.location.search.includes('tab=driver_portal') ||
      window.location.hash.includes('driver_portal');

    const driverId = activeCrew?.id || currentUser?.id || '';
    const driverName = activeCrew?.name || currentUser?.fullName || '';

    const handleRealtimeSchedulePayload = (
      eventType: 'INSERT' | 'UPDATE',
      newSchedule: Partial<Schedule> & Record<string, any>,
      oldSchedule?: (Partial<Schedule> & Record<string, any>) | null,
      prebuiltNotif?: DriverRealtimeNotificationPayload
    ) => {
      if (!newSchedule) return;

      // Pastikan driver hanya menerima notifikasi untuk tugas yang ditugaskan kepadanya
      if (isDriverOrHelperRole) {
        const assignedToCurrentDriver = isScheduleAssignedToDriver(newSchedule, driverId, driverName);
        if (!assignedToCurrentDriver) {
          return;
        }
      }

      const notif = prebuiltNotif || buildDriverNotificationPayload(eventType, newSchedule, oldSchedule);

      addNotification(
        notif.notificationCategory === 'new_assignment' ? 'schedule' : 'delivery',
        notif.title,
        notif.message,
        notif.urgent
      );

      if (isDriverOrHelperRole) {
        triggerNativeDriverPush(notif);
      }
    };

    // 1. Subscribe to Supabase Realtime postgres_changes (INSERT & UPDATE on schedules)
    const channelConfig =
      isDriverOrHelperRole && driverId
        ? {
            event: '*' as const,
            schema: 'public',
            table: 'schedules',
            filter: `crew_id=eq.${driverId}`
          }
        : {
            event: '*' as const,
            schema: 'public',
            table: 'schedules'
          };

    const channel = (supabase.channel(`realtime-schedules-${driverId || 'global'}`) as any)
      .on(
        'postgres_changes',
        { ...channelConfig, event: 'INSERT' },
        (payload: { new: Schedule }) => {
          if (payload?.new) {
            handleRealtimeSchedulePayload('INSERT', payload.new, null);
          }
        }
      )
      .on(
        'postgres_changes',
        { ...channelConfig, event: 'UPDATE' },
        (payload: { new: Schedule; old: Schedule }) => {
          if (payload?.new) {
            handleRealtimeSchedulePayload('UPDATE', payload.new, payload.old);
          }
        }
      )
      .subscribe();

    // 2. Listen for immediate in-app / cross-tab Supabase Realtime schedule events
    const handleCustomRealtimeEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !detail.schedule) return;
      handleRealtimeSchedulePayload(
        detail.eventType || 'UPDATE',
        detail.schedule,
        detail.previousSchedule,
        detail.notification
      );
    };

    window.addEventListener('akk-driver-schedule-realtime', handleCustomRealtimeEvent);

    return () => {
      window.removeEventListener('akk-driver-schedule-realtime', handleCustomRealtimeEvent);
      supabase.removeChannel(channel);
    };
  }, [addNotification, currentUser, activeCrew]);

  return null;
};
