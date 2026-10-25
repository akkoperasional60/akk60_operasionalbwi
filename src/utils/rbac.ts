import { UserProfile, UserRole, UserPermissions } from '../types';

export const isSpvLogistikRole = (role: UserRole | string): boolean => {
  return role === 'spv_logistik' || role === 'spv logistik' || role === 'dispatcher' || role === 'operasional';
};

export const isDispatcherRole = (role: UserRole | string): boolean => {
  return isSpvLogistikRole(role);
};

export const isDriverRole = (role: UserRole | string): boolean => {
  return role === 'driver' || role === 'crew_helper';
};

export const isSuperAdminRole = (role: UserRole | string): boolean => {
  return role === 'super_admin';
};

export const hasRequiredRole = (
  user: UserProfile | null | undefined,
  allowedRoles: Array<UserRole | 'dispatcher' | 'manager'>
): boolean => {
  if (!user || user.status !== 'approved') return false;
  if (isSuperAdminRole(user.role)) return true;

  return allowedRoles.some(allowed => {
    if (allowed === 'manager' || allowed === 'super_admin') {
      return isSuperAdminRole(user.role);
    }
    if (allowed === 'dispatcher' || allowed === 'spv_logistik') {
      return isSpvLogistikRole(user.role);
    }
    if (allowed === 'driver') {
      return isDriverRole(user.role);
    }
    return user.role === allowed;
  });
};

export const getUserRoleDisplayTitle = (role: UserRole | string): string => {
  switch (role) {
    case 'super_admin':
      return 'Super Admin / Manager';
    case 'dispatcher':
    case 'spv_logistik':
    case 'spv logistik':
      return 'SPV Logistik';
    case 'operasional':
      return 'Operasional (Operational Lead)';
    case 'security':
      return 'Security (Pos Satpam & Keamanan)';
    case 'driver':
      return 'Kru Supir / Driver';
    case 'crew_helper':
      return 'Kru Helper / Kernet';
    case 'sales_admin':
      return 'Adm. Penjualan';
    case 'purchasing_admin':
      return 'Adm. Pembelian';
    case 'hr_admin':
      return 'HR Admin';
    case 'finance_tax_admin':
      return 'Finance & Tax';
    case 'warehouse_admin':
      return 'Gudang';
    case 'marketing_online':
      return 'Marketing Online';
    case 'marketing_offline':
      return 'Marketing Offline';
    case 'unassigned':
      return 'Perlu Diisi (Belum Ditentukan)';
    default:
      return 'Perlu Diisi (Belum Ditentukan)';
  }
};

export const getDefaultTabForRole = (role: UserRole | string): string => {
  switch (role) {
    case 'super_admin':
      return 'dashboard';
    case 'spv_logistik':
    case 'dispatcher':
    case 'operasional':
      return 'operational_dashboard';
    case 'driver':
    case 'crew_helper':
      return 'driver_portal';
    case 'sales_admin':
      return 'sales_dashboard';
    case 'purchasing_admin':
      return 'purchasing_dashboard';
    case 'hr_admin':
      return 'hr_dashboard';
    case 'security':
      return 'ga_security';
    case 'finance_tax_admin':
      return 'finance_dashboard';
    case 'warehouse_admin':
      return 'warehouse_dashboard';
    case 'marketing_online':
      return 'marketing_online';
    case 'marketing_offline':
      return 'marketing_offline';
    default:
      return 'operational_dashboard';
  }
};

export const getDefaultPermissionsForRole = (role: UserRole | string): UserPermissions['modules'] => {
  const isAll = role === 'super_admin';
  const isLogistikStaff = role === 'spv_logistik' || role === 'dispatcher' || role === 'operasional';
  const isCrew = role === 'driver' || role === 'crew_helper';
  const isSales = role === 'sales_admin';
  const isWarehouse = role === 'warehouse_admin';
  const isMktOnline = role === 'marketing_online';
  const isMktOffline = role === 'marketing_offline';
  const isPurchasing = role === 'purchasing_admin';
  const isFinance = role === 'finance_tax_admin';
  const isHr = role === 'hr_admin';
  const isSecurity = role === 'security';

  return {
    logistics: {
      enabled: isAll || isLogistikStaff || isCrew,
      subMenus: {
        dashboard_logistik: isAll || isLogistikStaff ? 'full_access' : 'none',
        armada_ceklis: isAll || isLogistikStaff ? 'full_access' : 'none',
        live_map: isAll || isLogistikStaff ? 'full_access' : 'none',
        monitoring_sla: isAll || isLogistikStaff || isCrew ? 'full_access' : 'none',
        rencana_rute: isAll || isLogistikStaff ? 'full_access' : 'none',
        portal_driver: isAll || isLogistikStaff || isCrew ? 'full_access' : 'none'
      }
    },
    sales_admin: {
      enabled: isAll || isSales,
      subMenus: {
        dashboard_penjualan: isAll || isSales ? 'full_access' : 'none',
        aktivitas_harian: isAll || isSales ? 'full_access' : 'none',
        jadwal_admin: isAll || isSales ? 'full_access' : 'none',
        durasi_muat: isAll || isSales ? 'full_access' : 'none',
        matriks_skil: isAll || isSales ? 'full_access' : 'none',
        pengaturan_sop: isAll || isSales ? 'full_access' : 'none',
        data_kpi: isAll || isSales ? 'full_access' : 'none'
      }
    },
    warehouse: {
      enabled: isAll || isWarehouse,
      subMenus: {
        stok_barang: isAll || isWarehouse ? 'full_access' : 'none',
        permintaan_barang: isAll || isWarehouse ? 'full_access' : 'none',
        opname_stok: isAll || isWarehouse ? 'full_access' : 'none',
        ceklis_muat: isAll || isWarehouse ? 'full_access' : 'none'
      }
    },
    marketing: {
      enabled: isAll || isMktOnline || isMktOffline,
      subMenus: {
        kampanye: isAll || isMktOnline ? 'full_access' : 'none',
        leads_pipeline: isAll || isMktOffline ? 'full_access' : 'none',
        laporan_kunjungan: isAll || isMktOnline || isMktOffline ? 'full_access' : 'none'
      }
    },
    purchasing: {
      enabled: isAll || isPurchasing,
      subMenus: {
        permintaan_pembelian: isAll || isPurchasing ? 'full_access' : 'none',
        po_vendor: isAll || isPurchasing ? 'full_access' : 'none',
        evaluasi_harga: isAll || isPurchasing ? 'full_access' : 'none'
      }
    },
    finance_tax: {
      enabled: isAll || isFinance,
      subMenus: {
        kas_bank: isAll || isFinance ? 'full_access' : 'none',
        faktur_pajak: isAll || isFinance ? 'full_access' : 'none',
        rekonsiliasi: isAll || isFinance ? 'full_access' : 'none',
        laba_rugi: isAll || isFinance ? 'full_access' : 'none'
      }
    },
    hr: {
      enabled: isAll || isHr || isSecurity,
      subMenus: {
        hr_data_karyawan: isAll || isHr ? 'full_access' : 'none',
        hr_gaji_kpi: isAll || isHr ? 'full_access' : 'none',
        ga_security: isAll || isHr || isSecurity ? 'full_access' : 'none',
        ga_hk: isAll || isHr ? 'full_access' : 'none',
        ga_aset: isAll || isHr ? 'full_access' : 'none',
        td_video_training: isAll || isHr ? 'full_access' : 'none',
        td_training_karyawan: isAll || isHr ? 'full_access' : 'none'
      }
    },
    sistem_pengguna: {
      enabled: isAll,
      subMenus: {
        daftar_pengguna: isAll ? 'full_access' : 'none',
        manajemen_hak_akses: isAll ? 'full_access' : 'none',
        dashboard_eksekutif: isAll ? 'full_access' : 'none',
        log_aktivitas_sistem: isAll ? 'full_access' : 'none',
        persetujuan_akun: isAll ? 'full_access' : 'none'
      }
    }
  };
};

export interface RolePolicySummary {
  roleKey: 'super_admin' | 'dispatcher' | 'driver';
  title: string;
  badgeColor: string;
  allowedModules: string[];
  databaseRlsSummary: string[];
}

export const RBAC_ROLE_MATRIX: RolePolicySummary[] = [
  {
    roleKey: 'super_admin',
    title: 'Super Admin / Manager',
    badgeColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    allowedModules: [
      'Executive & Operational Dashboards',
      'User Management & RBAC Approval',
      'Fleet, Crew, Store & Schedule Management',
      'Finance, Tax, Sales KPI & Supabase SQL Architecture'
    ],
    databaseRlsSummary: [
      'FOR ALL ON public.profiles, fleets, crews, stores, schedules, tracking_logs USING (public.get_my_role() = \'super_admin\')',
      'Full read/write/delete authority across all tables and audit logs'
    ]
  },
  {
    roleKey: 'dispatcher',
    title: 'Dispatcher / SPV Logistik',
    badgeColor: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    allowedModules: [
      'Operational Dashboard & Live GPS Tracking',
      'Schedule & Dispatch Management (Assign Driver & Fleet)',
      'Fleet, Sparepart, Fuel & Store Coordinate Registry',
      'Driver Delivery Reports & Issue Resolution'
    ],
    databaseRlsSummary: [
      'FOR ALL ON public.schedules, fleets, crews, stores USING (public.get_my_role() IN (\'super_admin\', \'dispatcher\', \'spv_logistik\'))',
      'SELECT only on public.profiles (cannot modify user roles or system config)'
    ]
  },
  {
    roleKey: 'driver',
    title: 'Driver / Crew Helper',
    badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    allowedModules: [
      'Mobile Driver Portal (Assigned Deliveries Only)',
      'Delivery Status Updates (In Transit, Delivered + POD Photo, Delayed)',
      'Live GPS Geolocation Sync & Outbound Waybill (58mm)',
      'Vehicle Pre/Post-Trip Checklist & Shift PIN Check-In'
    ],
    databaseRlsSummary: [
      'SELECT ON public.schedules USING (driver_user_id = auth.uid() OR crew_id IN (SELECT id FROM public.crews WHERE user_id = auth.uid()))',
      'UPDATE (status, actual_arrival, pod_photo_url, notes) ON public.schedules USING (driver_user_id = auth.uid())',
      'INSERT ON public.tracking_logs WITH CHECK (driver_user_id = auth.uid())'
    ]
  }
];

const TAB_TO_MODULE_MAP: Record<string, { moduleId: string; subMenuId?: string }> = {
  dashboard: { moduleId: 'sistem_pengguna', subMenuId: 'dashboard_eksekutif' },
  driver_portal: { moduleId: 'logistics', subMenuId: 'portal_driver' },
  driver_reports: { moduleId: 'logistics', subMenuId: 'monitoring_sla' },
  operational_dashboard: { moduleId: 'logistics', subMenuId: 'dashboard_logistik' },
  analytics_reports: { moduleId: 'logistics', subMenuId: 'dashboard_logistik' },
  schedules: { moduleId: 'logistics', subMenuId: 'rencana_rute' },
  fleets: { moduleId: 'logistics', subMenuId: 'armada_ceklis' },
  spareparts: { moduleId: 'logistics', subMenuId: 'armada_ceklis' },
  fuel_efficiency: { moduleId: 'logistics', subMenuId: 'armada_ceklis' },
  crew_history: { moduleId: 'logistics', subMenuId: 'monitoring_sla' },
  tracking_eval: { moduleId: 'logistics', subMenuId: 'monitoring_sla' },
  tracksolid: { moduleId: 'logistics', subMenuId: 'live_map' },
  fleet_forms: { moduleId: 'logistics', subMenuId: 'armada_ceklis' },
  sales_dashboard: { moduleId: 'sales_admin', subMenuId: 'dashboard_penjualan' },
  sales_activities: { moduleId: 'sales_admin', subMenuId: 'aktivitas_harian' },
  sales_schedules: { moduleId: 'sales_admin', subMenuId: 'jadwal_admin' },
  sales_loading_duration: { moduleId: 'sales_admin', subMenuId: 'durasi_muat' },
  sales_skill_matrix: { moduleId: 'sales_admin', subMenuId: 'matriks_skil' },
  sales_jobdesk: { moduleId: 'sales_admin', subMenuId: 'pengaturan_sop' },
  sales_kpi: { moduleId: 'sales_admin', subMenuId: 'data_kpi' },
  sales_kpi_individual: { moduleId: 'sales_admin', subMenuId: 'data_kpi' },
  sales_kpi_fines: { moduleId: 'sales_admin', subMenuId: 'data_kpi' },
  sales_kpi_nusantara: { moduleId: 'sales_admin', subMenuId: 'data_kpi' },
  warehouse_dashboard: { moduleId: 'warehouse', subMenuId: 'stok_barang' },
  warehouse_inventory: { moduleId: 'warehouse', subMenuId: 'stok_barang' },
  warehouse_inbound: { moduleId: 'warehouse', subMenuId: 'permintaan_barang' },
  warehouse_outbound: { moduleId: 'warehouse', subMenuId: 'ceklis_muat' },
  warehouse_scanner: { moduleId: 'warehouse', subMenuId: 'stok_barang' },
  warehouse_slotting: { moduleId: 'warehouse', subMenuId: 'stok_barang' },
  warehouse_opname: { moduleId: 'warehouse', subMenuId: 'opname_stok' },
  marketing_offline: { moduleId: 'marketing', subMenuId: 'leads_pipeline' },
  customer_map: { moduleId: 'marketing', subMenuId: 'laporan_kunjungan' },
  purchasing_dashboard: { moduleId: 'purchasing', subMenuId: 'permintaan_pembelian' },
  purchasing_stock_overview: { moduleId: 'purchasing', subMenuId: 'po_vendor' },
  purchasing_stock_forecast: { moduleId: 'purchasing', subMenuId: 'po_vendor' },
  finance_dashboard: { moduleId: 'finance_tax', subMenuId: 'kas_bank' },
  hr_dashboard: { moduleId: 'hr', subMenuId: 'hr_data_karyawan' },
  ga_security: { moduleId: 'hr', subMenuId: 'ga_security' },
  ga_hk: { moduleId: 'hr', subMenuId: 'ga_hk' },
  ga_aset: { moduleId: 'hr', subMenuId: 'ga_aset' },
  training_videos: { moduleId: 'hr', subMenuId: 'td_video_training' },
  training_karyawan: { moduleId: 'hr', subMenuId: 'td_training_karyawan' },
  activity_log: { moduleId: 'sistem_pengguna', subMenuId: 'log_aktivitas_sistem' },
  users: { moduleId: 'sistem_pengguna', subMenuId: 'daftar_pengguna' },
  e2e_testing: { moduleId: 'sistem_pengguna', subMenuId: 'daftar_pengguna' },
  architecture: { moduleId: 'sistem_pengguna', subMenuId: 'manajemen_hak_akses' }
};

export const canAccess = (user: UserProfile, moduleId: string, subMenuId?: string): boolean => {
  if (!user) return false;
  if (user.status === 'inactive' || user.status !== 'approved') return false;
  if (isSuperAdminRole(user.role)) return true;
  if (user.role === 'unassigned') return false;

  // Map NavTab to (moduleId, subMenuId) if moduleId is a tab name
  let resolvedModuleId = moduleId;
  let resolvedSubMenuId = subMenuId;
  if (!subMenuId && TAB_TO_MODULE_MAP[moduleId]) {
    resolvedModuleId = TAB_TO_MODULE_MAP[moduleId].moduleId;
    resolvedSubMenuId = TAB_TO_MODULE_MAP[moduleId].subMenuId;
  }

  // 1. Granular permissions check if explicitly configured in user profile
  const userModules = user.permissions?.modules;
  const defaultModules = getDefaultPermissionsForRole(user.role);
  const modulePerms = (userModules && userModules[resolvedModuleId])
    ? userModules[resolvedModuleId]
    : defaultModules[resolvedModuleId];

  if (!modulePerms || !modulePerms.enabled) return false;

  if (resolvedSubMenuId) {
    const subPerm = modulePerms.subMenus?.[resolvedSubMenuId];
    if (!subPerm || subPerm === 'none') return false;
  }

  return true;
};

