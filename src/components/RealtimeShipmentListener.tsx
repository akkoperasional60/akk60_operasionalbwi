import { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';
import { Schedule } from '../types';

export const RealtimeShipmentListener: React.FC = () => {
  const { addNotification } = useToast();

  useEffect(() => {
    const channel = (supabase.channel('schema-db-changes') as any)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'schedules' },
        (payload: { new: Schedule; old: Schedule }) => {
          const { new: newSchedule, old: oldSchedule } = payload;
          
          if (newSchedule.status !== oldSchedule.status) {
            const statusLabels: Record<string, string> = {
              'delayed': 'Terlambat',
              'in_transit': 'Sedang Transit',
              'delivered': 'Telah Sampai'
            };

            if (['delayed', 'in_transit', 'delivered'].includes(newSchedule.status)) {
              addNotification(
                'schedule',
                'Pembaruan Status Pengiriman',
                `Jadwal ${newSchedule.trackingNumber} telah berubah status menjadi: ${statusLabels[newSchedule.status] || newSchedule.status}.`,
                newSchedule.status === 'delayed'
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNotification]);

  return null;
};
