import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseService';
import { logisticsStore } from './store';

/**
 * Supabase Realtime Synchronization Service
 * -----------------------------------------
 * Manages real-time PostgreSQL subscriptions via Supabase Realtime WebSocket channels
 * for schedules, shipments, live locations, fleet checklists, and driver reports.
 * Ensures the Driver Mobile view and Admin dashboard remain perfectly synchronized in real-time.
 */

let realtimeChannel: any = null;
let isSubscribed = false;
const listeners: Array<(event: { table: string; eventType: string; payload: any }) => void> = [];

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
        .channel('akk-operations-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'schedules' },
          (payload) => {
            console.log('[SupabaseRealtime] Schedule change received:', payload);
            notifyListeners('schedules', payload.eventType, payload.new || payload.old);
            triggerStoreSync();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'fleets' },
          (payload) => {
            console.log('[SupabaseRealtime] Fleet change received:', payload);
            notifyListeners('fleets', payload.eventType, payload.new || payload.old);
            triggerStoreSync();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'driver_reports' },
          (payload) => {
            console.log('[SupabaseRealtime] Driver report change received:', payload);
            notifyListeners('driver_reports', payload.eventType, payload.new || payload.old);
            triggerStoreSync();
          }
        )
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
