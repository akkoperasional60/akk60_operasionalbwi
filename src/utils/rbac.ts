import { UserProfile, UserRole } from '../types';

export const isDispatcherRole = (role: UserRole | string): boolean => {
  return role === 'spv_logistik' || role === 'dispatcher' || role === 'operasional';
};

export const isDriverRole = (role: UserRole | string): boolean => {
  return role === 'driver' || role === 'crew_helper';
};

export const isSuperAdminRole = (role: UserRole | string): boolean => {
  return role === 'super_admin';
};

export const getUserRoleDisplayTitle = (role: UserRole | string): string => {
  switch (role) {
    case 'super_admin':
      return 'Super Administrator (Full Access)';
    case 'spv_logistik':
    case 'dispatcher':
      return 'Dispatcher / SPV Logistik';
    case 'driver':
      return 'Driver / Pengemudi Utama';
    case 'crew_helper':
      return 'Kernet / Helper';
    case 'sales_admin':
      return 'Sales & Marketing Admin';
    case 'finance_tax_admin':
      return 'Finance & Tax Admin';
    case 'warehouse_admin':
      return 'Warehouse Administrator';
    case 'security':
      return 'Security & Gate Control';
    default:
      return 'Staf Operasional AKK';
  }
};

export const canAccess = (user: UserProfile, moduleId: string, subMenuId?: string): boolean => {
  if (!user) return false;
  if (isSuperAdminRole(user.role)) return true;
  if (user.status !== 'approved') return false;

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
  if (isDispatcherRole(role)) {
    // Restricted from Super Admin user management, system architecture, and finance configuration
    if (['users', 'sistem_pengguna', 'architecture', 'finance_tax', 'finance_dashboard'].includes(moduleId)) {
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



