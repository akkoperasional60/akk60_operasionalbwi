import { UserProfile, UserRole } from '../types';

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
      return 'Super Administrator / Manager (Full Access)';
    case 'dispatcher':
      return 'Dispatcher / SPV Logistik';
    case 'spv_logistik':
    case 'spv logistik':
      return 'SPV Logistik / Dispatcher';
    case 'driver':
      return 'Driver / Pengemudi Utama';
    case 'crew_helper':
      return 'Kernet / Helper';
    case 'sales_admin':
      return 'Sales & Marketing Admin';
    case 'purchasing_admin':
      return 'Admin Pembelian';
    case 'hr_admin':
      return 'HR Admin';
    case 'finance_tax_admin':
      return 'Finance & Tax Admin';
    case 'warehouse_admin':
      return 'Warehouse Administrator';
    case 'security':
      return 'Security & Gate Control';
    case 'unassigned':
      return 'Perlu Diisi (Belum Ditentukan)';
    default:
      return 'Perlu Diisi (Belum Ditentukan)';
  }
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

export const canAccess = (user: UserProfile, moduleId: string, subMenuId?: string): boolean => {
  if (!user) return false;
  if (user.status === 'inactive' || user.status !== 'approved') return false;
  if (isSuperAdminRole(user.role)) return true;
  if (user.role === 'unassigned') return false;

  // 1. Granular permissions check if explicitly configured in user profile
  if (user.permissions && user.permissions.modules && user.permissions.modules[moduleId]) {
    const modulePerms = user.permissions.modules[moduleId];
    if (!modulePerms.enabled) return false;

    if (subMenuId) {
      const subPerm = modulePerms.subMenus?.[subMenuId];
      if (!subPerm || subPerm === 'none') return false;
    }
    return true;
  }

  const role = user.role;

  // 2. Driver & Crew Role Boundaries: Restricted exclusively to driver portal & mobile operations
  if (isDriverRole(role)) {
    if (moduleId === 'driver_portal' || moduleId === 'logistics' || moduleId === 'crew_history') {
      return true;
    }
    return false;
  }

  // 3. Dispatcher / SPV Logistik Role Boundaries: Operational logistics, scheduling, fleets, tracking, reports
  if (isSpvLogistikRole(role)) {
    // Restricted from Super Admin user management and finance configuration
    if (['users', 'sistem_pengguna', 'finance_tax', 'finance_dashboard'].includes(moduleId)) {
      return false;
    }
    return true;
  }

  // 4. Special check for Executive Dashboard ('dashboard')
  if (moduleId === 'dashboard') {
    if (isDriverRole(role) || role === 'security') return false;
    return true;
  }

  return true;
};
