import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, UserX, Clock, ShieldAlert, CheckCircle2, XCircle, 
  Search, Filter, Plus, Shield, User, Building, Phone, Mail, Calendar, 
  AlertTriangle, Edit3, Lock, Save, UserCog, ShieldCheck, X, Key, Copy, Check,
  ChevronDown, ChevronRight, Settings, Eye, EyeOff, BarChart3
} from 'lucide-react';
import { UserProfile, UserRole, UserApprovalStatus, UserPermissions } from '../types';
import { logisticsStore } from '../services/store';


const MODULE_DEFINITIONS = [
  {
    id: 'logistics',
    name: 'Logistik & Pengiriman',
    subMenus: [
      { id: 'dashboard_logistik', name: 'Dashboard Logistik' },
      { id: 'armada_ceklis', name: 'Armada & Ceklis KIR' },
      { id: 'live_map', name: 'Live Map GPS' },
      { id: 'monitoring_sla', name: 'Monitoring SLA Pengiriman' },
      { id: 'rencana_rute', name: 'Rencana Rute & Jadwal' },
      { id: 'portal_driver', name: 'Portal Driver Mobile' }
    ]
  },
  {
    id: 'sales_admin',
    name: 'Admin Penjualan',
    subMenus: [
      { id: 'dashboard_penjualan', name: 'Dashboard Penjualan' },
      { id: 'aktivitas_harian', name: 'Aktivitas Harian Admin' },
      { id: 'jadwal_admin', name: 'Jadwal Admin' },
      { id: 'durasi_muat', name: 'Durasi Muat' },
      { id: 'matriks_skil', name: 'Matriks Skil' },
      { id: 'pengaturan_sop', name: 'Pengaturan SOP & Jobdesk' },
      { id: 'data_kpi', name: 'Data KPI' }
    ]
  },
  {
    id: 'warehouse',
    name: 'Gudang',
    subMenus: [
      { id: 'stok_barang', name: 'Stok Barang & Material' },
      { id: 'permintaan_barang', name: 'Permintaan Barang' },
      { id: 'opname_stok', name: 'Opname Stok Fisik' },
      { id: 'ceklis_muat', name: 'Ceklis Muat Barang' }
    ]
  },
  {
    id: 'marketing',
    name: 'Marketing',
    subMenus: [
      { id: 'kampanye', name: 'Kampanye & Promosi' },
      { id: 'leads_pipeline', name: 'Leads Pipeline Toko' },
      { id: 'laporan_kunjungan', name: 'Laporan Kunjungan Lapangan' }
    ]
  },
  {
    id: 'purchasing',
    name: 'Admin Pembelian',
    subMenus: [
      { id: 'permintaan_pembelian', name: 'Permintaan Pembelian (PR)' },
      { id: 'po_vendor', name: 'Purchase Order (PO) Vendor' },
      { id: 'evaluasi_harga', name: 'Evaluasi Harga Supplier' }
    ]
  },
  {
    id: 'finance_tax',
    name: 'Finance & Tax',
    subMenus: [
      { id: 'kas_bank', name: 'Kas & Bank Operasional' },
      { id: 'faktur_pajak', name: 'Faktur Pajak & E-Faktur' },
      { id: 'rekonsiliasi', name: 'Rekonsiliasi Keuangan' },
      { id: 'laba_rugi', name: 'Laporan Laba Rugi' }
    ]
  },
  {
    id: 'hr',
    name: 'Human Resources',
    subMenus: [
      { id: 'hr_data_karyawan', name: 'HR - Data Karyawan & Presensi' },
      { id: 'hr_gaji_kpi', name: 'HR - Gaji, Lembur & Penilaian Kinerja' },
      { id: 'ga_security', name: 'GA - Security (Keamanan Pabrik)' },
      { id: 'ga_hk', name: 'GA - HK (Housekeeping & Kebersihan)' },
      { id: 'ga_aset', name: 'GA - Aset (Inventaris & Fasilitas)' },
      { id: 'td_video_training', name: 'Training & Development - Video Training' },
      { id: 'td_training_karyawan', name: 'Training & Development - Training Karyawan' }
    ]
  },
  {
    id: 'sistem_pengguna',
    name: 'Sistem Pengguna & Akses Eksekutif',
    subMenus: [
      { id: 'daftar_pengguna', name: 'Daftar Pengguna Sistem' },
      { id: 'manajemen_hak_akses', name: 'Manajemen Hak Akses & Role' },
      { id: 'dashboard_eksekutif', name: 'Dashboard Eksekutif (Akses Terbatas)' },
      { id: 'log_aktivitas_sistem', name: 'Log Aktivitas Sistem' },
      { id: 'persetujuan_akun', name: 'Persetujuan Akun (Approval)' }
    ]
  }
];

const DEPARTMENT_FILTER_OPTIONS = [
  { id: 'all', label: 'Semua Role / Departemen', shortLabel: 'Semua', icon: '🌐' },
  { id: 'logistics', label: 'Logistik & Pengiriman', shortLabel: 'Logistik', icon: '🚚' },
  { id: 'sales', label: 'Admin Penjualan (Sales)', shortLabel: 'Sales', icon: '💼' },
  { id: 'warehouse', label: 'Gudang (Warehouse)', shortLabel: 'Gudang', icon: '📦' },
  { id: 'marketing', label: 'Marketing', shortLabel: 'Marketing', icon: '📢' },
  { id: 'purchasing', label: 'Admin Pembelian', shortLabel: 'Pembelian', icon: '🛒' },
  { id: 'finance', label: 'Finance & Tax', shortLabel: 'Finance', icon: '💰' },
  { id: 'hr', label: 'Human Resources & GA', shortLabel: 'HR & GA', icon: '👥' },
  { id: 'super_admin', label: 'Super Admin', shortLabel: 'Super Admin', icon: '👑' },
];

export interface UserManagementProps {
  onNavigateToE2E?: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ onNavigateToE2E }) => {
  const [users, setUsers] = useState<UserProfile[]>(logisticsStore.getUsers());
  const [currentUser, setCurrentUser] = useState<UserProfile>(logisticsStore.getCurrentUser());
  const [statusFilter, setStatusFilter] = useState<'all' | UserApprovalStatus>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  // Super Admin check
  const isSuperAdmin = currentUser.role === 'super_admin';

  // Selected User for Split-Screen Detail View
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const selectedUser = users.find(u => u.id === selectedUserId) || users[0] || null;

  // Granular Access & Menu Permissions State
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({ logistics: true, sales_admin: true });
  const [editingPermissions, setEditingPermissions] = useState<UserPermissions['modules']>({});
  
  // Copy Access Modal State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [sourceUserIdForCopy, setSourceUserIdForCopy] = useState<string>('');
  
  // Delete Confirmation Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Change Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // In-Page Pop-up Notification Modal State (Request: popup di depan halaman user manajemen)
  const [pageModalNotification, setPageModalNotification] = useState<{
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
  } | null>(null);

  const showNotification = (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    setPageModalNotification({ title, message, type });
  };

  // Edit User Profile State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'spv_logistik' as UserRole,
    department: '',
    status: 'approved' as UserApprovalStatus,
    notes: '',
    approvedBy: ''
  });
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // New user form state
  const [newUser, setNewUser] = useState({
    fullName: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      const freshUsers = logisticsStore.getUsers();
      setUsers(freshUsers);
      setCurrentUser(logisticsStore.getCurrentUser());
      if (!selectedUserId && freshUsers.length > 0) {
        setSelectedUserId(freshUsers[0].id);
      }
    });
  }, [selectedUserId]);

  // Whenever selectedUser changes, initialize editingPermissions
  useEffect(() => {
    if (selectedUser) {
      const initialPerms: UserPermissions['modules'] = {};
      MODULE_DEFINITIONS.forEach(mod => {
        const userMod = selectedUser.permissions?.modules?.[mod.id];
        const subMenuPerms: Record<string, 'read_only' | 'full_access' | 'none'> = {};
        mod.subMenus.forEach(sub => {
          subMenuPerms[sub.id] = userMod?.subMenus?.[sub.id] || (selectedUser.role === 'super_admin' ? 'full_access' : 'read_only');
        });
        initialPerms[mod.id] = {
          enabled: userMod ? userMod.enabled : (selectedUser.role === 'super_admin' || selectedUser.role === 'spv_logistik'),
          subMenus: subMenuPerms
        };
      });
      setEditingPermissions(initialPerms);
    }
  }, [selectedUser?.id]);

  const ROLE_LABELS: Record<UserRole, string> = {
    super_admin: 'Super Admin / Manager',
    spv_logistik: 'SPV Logistik',
    operasional: 'Operasional',
    security: 'Security / Keamanan',
    sales_admin: 'Adm. Penjualan',
    purchasing_admin: 'Adm. Pembelian',
    hr_admin: 'HR Admin',
    finance_tax_admin: 'Finance & Tax',
    warehouse_admin: 'Gudang',
    driver: 'Kru Supir / Driver',
    marketing_online: 'Marketing Online',
    marketing_offline: 'Marketing Offline',
    crew_helper: 'Kru Helper'
  };

  const toggleModuleExpansion = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const handleToggleModuleEnabled = (modId: string, enabled: boolean) => {
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang berwenang mengubah hak akses modul.', 'warning');
      return;
    }
    setEditingPermissions(prev => ({
      ...prev,
      [modId]: {
        ...(prev[modId] || { subMenus: {} }),
        enabled
      }
    }));
  };

  const handleSubMenuPermissionChange = (modId: string, subId: string, accessLevel: 'none' | 'read_only' | 'full_access') => {
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang berwenang mengubah hak akses sub-menu.', 'warning');
      return;
    }
    setEditingPermissions(prev => {
      const mod = prev[modId] || { enabled: true, subMenus: {} };
      return {
        ...prev,
        [modId]: {
          ...mod,
          subMenus: {
            ...mod.subMenus,
            [subId]: accessLevel
          }
        }
      };
    });
  };

  const handleSaveAccess = () => {
    if (!selectedUser) return;
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang dapat menyimpan perubahan akses.', 'warning');
      return;
    }

    const updatedPermissions: UserPermissions = {
      modules: editingPermissions
    };

    const success = logisticsStore.updateUserProfile(selectedUser.id, {
      permissions: updatedPermissions
    });

    if (success) {
      showNotification('Hak Akses Disimpan', `Hak akses dan pembatasan input untuk "${selectedUser.fullName}" berhasil disimpan ke sistem.`, 'success');
      setSaveSuccessMessage(`Hak akses dan pembatasan input untuk "${selectedUser.fullName}" berhasil disimpan.`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    }
  };

  const handleCopyAccess = () => {
    if (!sourceUserIdForCopy) {
      showNotification('Peringatan', 'Silakan pilih user sumber untuk menyalin akses.', 'warning');
      return;
    }
    const sourceUser = users.find(u => u.id === sourceUserIdForCopy);
    if (!sourceUser || !sourceUser.permissions) {
      showNotification('User Sumber Kosong', 'User sumber tidak memiliki konfigurasi akses khusus.', 'warning');
      return;
    }
    setEditingPermissions(JSON.parse(JSON.stringify(sourceUser.permissions.modules)));
    setIsCopyModalOpen(false);
    setSourceUserIdForCopy('');
    showNotification('Salin Akses Berhasil', `Berhasil menyalin hak akses dari ${sourceUser.fullName}. Klik 'Simpan Akses' di kanan bawah untuk menerapkan ke database.`, 'success');
  };

  const handleChangePassword = () => {
    if (!selectedUser) return;
    if (!newPasswordInput || newPasswordInput.length < 6) {
      showNotification('Password Tidak Valid', 'Password baru minimal harus 6 karakter.', 'warning');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      showNotification('Password Tidak Cocok', 'Konfirmasi password tidak cocok dengan password baru. Harap periksa kembali kedua input.', 'error');
      return;
    }
    const success = logisticsStore.updateUserProfile(selectedUser.id, {
      password: newPasswordInput
    });
    if (success) {
      showNotification('Password Berhasil Diubah', `Password baru untuk akun "${selectedUser.fullName}" berhasil disimpan ke database.`, 'success');
      setSaveSuccessMessage(`Password akun "${selectedUser.fullName}" berhasil diubah.`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      setIsPasswordModalOpen(false);
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  };

  const handleApprove = (userId: string, notes?: string) => {
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang dapat menyetujui akun pengguna.', 'warning');
      return;
    }
    logisticsStore.approveUser(userId, notes || 'Disetujui oleh ' + currentUser.fullName);
    showNotification('Akun Disetujui', 'Akun pengguna berhasil disetujui dan kini berstatus aktif.', 'success');
  };

  const handleDelete = (userId: string) => {
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang dapat menghapus akun pengguna.', 'warning');
      return;
    }
    
    setDeleteTargetId(userId);
    setIsDeleteModalOpen(true);
  };
  
  const confirmDelete = () => {
    if (!deleteTargetId) return;
    
    const target = users.find(u => u.id === deleteTargetId);
    logisticsStore.deleteUser(deleteTargetId);
    const remaining = users.filter(u => u.id !== deleteTargetId);
    if (remaining.length > 0) {
      setSelectedUserId(remaining[0].id);
    }
    
    setIsDeleteModalOpen(false);
    setDeleteTargetId(null);
    showNotification('Akun Dihapus', `Akun ${target?.fullName || 'pengguna'} telah berhasil dihapus dari sistem.`, 'success');
  };

  const handleOpenEdit = (user: UserProfile) => {
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Fitur edit profil hanya dapat diakses oleh Super Admin.', 'warning');
      return;
    }
    setEditingUser(user);
    setEditFormData({
      fullName: user.fullName || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      department: user.department || '',
      status: user.status,
      notes: user.notes || '',
      approvedBy: user.approvedBy || currentUser.fullName
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang berwenang mengubah profil pengguna.', 'warning');
      return;
    }

    const success = logisticsStore.updateUserProfile(editingUser.id, {
      fullName: editFormData.fullName.trim(),
      email: editFormData.email.trim(),
      phone: editFormData.phone.trim(),
      role: editFormData.role,
      department: editFormData.department.trim(),
      status: editFormData.status,
      notes: editFormData.notes.trim(),
      approvedBy: editFormData.status === 'approved' ? (editFormData.approvedBy || currentUser.fullName) : editingUser.approvedBy
    });

    if (success) {
      setSaveSuccessMessage(`Profil "${editFormData.fullName}" berhasil diperbarui.`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      setEditingUser(null);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email) return;

    const created = logisticsStore.registerUser({
      fullName: newUser.fullName || 'Pengguna Baru',
      email: newUser.email,
      phone: '-',
      role: 'spv_logistik',
      department: 'Umum',
      notes: 'Akun dibuat langsung oleh Super Admin AKK'
    });
    // Removed automatic approval

    setIsAddUserModalOpen(false);
    setSelectedUserId(created.id);
    setNewUser({
      fullName: '',
      email: '',
      password: ''
    });
  };

  // Simplified Add User Modal UI (I will update the JSX below to match this)

  const pendingCount = users.filter(u => u.status === 'pending').length;
  const approvedCount = users.filter(u => u.status === 'approved').length;
  const rejectedCount = users.filter(u => u.status === 'rejected').length;

  const matchUserDepartment = (u: UserProfile, filterKey: string) => {
    if (filterKey === 'all') return true;
    const dept = (u.department || '').toLowerCase();
    const role = (u.role || '').toLowerCase();
    switch (filterKey) {
      case 'logistics':
        return role === 'spv_logistik' || role === 'driver' || /logistik|pengiriman|distribusi|armada|supir/i.test(dept);
      case 'sales':
        return role === 'sales_admin' || /sales|penjualan/i.test(dept);
      case 'warehouse':
        return role === 'warehouse_admin' || /gudang|warehouse/i.test(dept);
      case 'marketing':
        return role === 'marketing_online' || role === 'marketing_offline' || /marketing|pemasaran/i.test(dept);
      case 'purchasing':
        return role === 'purchasing_admin' || /pembelian|purchasing|pengadaan/i.test(dept);
      case 'finance':
        return role === 'finance_tax_admin' || /finance|tax|keuangan|pajak/i.test(dept);
      case 'hr':
        return role === 'hr_admin' || /hr|human|ga|personalia|general affair/i.test(dept);
      case 'super_admin':
        return role === 'super_admin' || /super|direksi|manajemen/i.test(dept);
      default:
        return role === filterKey || dept.includes(filterKey.toLowerCase());
    }
  };

  const countUsersInDept = (deptId: string) => {
    if (deptId === 'all') return users.length;
    return users.filter(u => matchUserDepartment(u, deptId)).length;
  };

  const filteredUsers = users.filter(u => {
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesDept = matchUserDepartment(u, departmentFilter);
    const matchesQuery =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesDept && matchesQuery;
  });

  // Auto-select first matching user if current selected user is filtered out
  useEffect(() => {
    if (filteredUsers.length > 0) {
      const isSelectedPresent = filteredUsers.some(u => u.id === selectedUserId);
      if (!isSelectedPresent) {
        setSelectedUserId(filteredUsers[0].id);
      }
    }
  }, [departmentFilter, statusFilter, searchQuery]);

  const activeDeptOption = DEPARTMENT_FILTER_OPTIONS.find(opt => opt.id === departmentFilter);

  return (
    <div className="space-y-6">
      {/* RBAC Header & Authorization Notice */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
        isSuperAdmin
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          : 'bg-slate-900 border-slate-800 text-slate-400'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
            isSuperAdmin
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-inner'
              : 'bg-slate-800 border-slate-700 text-slate-500'
          }`}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
              <span>{isSuperAdmin ? 'Manajemen User & Hak Akses Granular (Super Admin Mode)' : 'Hak Akses Pengguna Terbatas'}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                isSuperAdmin
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {isSuperAdmin ? '👑 Super Admin' : '🔒 Read Only'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isSuperAdmin
                ? 'Pilih user di daftar sebelah kiri untuk melihat dan mengatur rincian menu, sub-menu, pembatasan input, copy akses, ubah password, dan kelola akun di sebelah kanan.'
                : `Manajemen user dan perubahan hak akses dikunci khusus untuk Super Admin. Anda login sebagai: ${currentUser.role === 'super_admin' ? 'Super Admin' : currentUser.fullName} (${currentUser.role}).`}
            </p>
          </div>
        </div>
      </div>

      {/* Save Success Alert Banner */}
      {saveSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs flex items-center justify-between shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{saveSuccessMessage}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMessage(null)}
            className="p-1 text-emerald-400 hover:text-white rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Toolbar: Add User & Search / Filter */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah User Langsung</span>
          </button>

          {onNavigateToE2E && (
            <button
              onClick={onNavigateToE2E}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition cursor-pointer"
              title="Buka Pusat Pengujian E2E & Simulasi Akun Pengguna"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Pusat Uji E2E &amp; Simulasi Akun</span>
            </button>
          )}

          {/* Department / Role Filter Dropdown in Top Toolbar */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs shadow-inner">
            <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-400 font-semibold text-[11px] hidden sm:inline">Role / Dept:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-transparent text-amber-300 font-bold text-xs focus:outline-none cursor-pointer pr-1"
            >
              {DEPARTMENT_FILTER_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id} className="bg-slate-900 text-slate-200 font-medium">
                  {opt.icon} {opt.label} ({countUsersInDept(opt.id)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua ({users.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'pending' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Pending</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-2.5 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'approved' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Aktif ({approvedCount})
            </button>
          </div>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama, email, divisi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* ================= SPLIT SCREEN MASTER-DETAIL LAYOUT ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: User List (List User) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col max-h-[82vh]">
          {/* Header */}
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-xs flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>Daftar Pengguna ({filteredUsers.length})</span>
            </h3>
            <span className="text-[10px] text-slate-400">Pilih user untuk atur akses</span>
          </div>

          {/* Quick Filter Pill Ribbon for Roles & Departments */}
          <div className="p-2.5 bg-slate-950/70 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 text-[10px]">
                <Filter className="w-3 h-3 text-amber-400" />
                <span>Pilih Departemen / Role:</span>
              </span>
              {departmentFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setDepartmentFilter('all')}
                  className="text-amber-400 hover:text-amber-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 transition"
                >
                  <X className="w-3 h-3" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            {/* Horizontally Scrollable Department Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {DEPARTMENT_FILTER_OPTIONS.map(opt => {
                const count = countUsersInDept(opt.id);
                const isActive = departmentFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDepartmentFilter(opt.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400 font-extrabold'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.shortLabel}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                      isActive ? 'bg-slate-950 text-amber-300' : 'bg-slate-900 text-slate-400'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Filter Indicator Badge */}
            {departmentFilter !== 'all' && (
              <div className="pt-1 flex items-center justify-between text-[11px] text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                <span className="flex items-center gap-1.5">
                  <span>{activeDeptOption?.icon}</span>
                  <span>Menampilkan filter: <strong>{activeDeptOption?.label}</strong></span>
                </span>
                <span className="font-mono text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded font-bold">
                  {filteredUsers.length} User
                </span>
              </div>
            )}
          </div>

          <div className="overflow-y-auto divide-y divide-slate-800/80 flex-1">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Tidak ada user yang ditemukan.
              </div>
            ) : (
              filteredUsers.map(user => {
                const isSelected = selectedUser?.id === user.id;
                const isCurrent = user.id === currentUser.id;

                return (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`p-3.5 transition cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected 
                        ? 'bg-amber-600/15 border-l-4 border-amber-500 text-white' 
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow ${
                        isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200'
                      }`}>
                        {user.role === 'super_admin' ? '👑' : user.fullName.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate flex items-center gap-1.5">
                          <span className={isSelected ? 'text-amber-300 font-extrabold' : 'text-white'}>
                            {user.role === 'super_admin' ? 'Super Admin' : user.fullName}
                          </span>
                          {isCurrent && (
                            <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-blue-500/25 text-blue-300">
                              Anda
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {ROLE_LABELS[user.role] || user.role}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {user.department}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {user.status === 'approved' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Aktif" />
                      )}
                      {user.status === 'pending' && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" title="Pending" />
                      )}
                      {user.status === 'rejected' && (
                        <span className="w-2 h-2 rounded-full bg-rose-500" title="Ditolak" />
                      )}
                      <span className="text-[10px] text-slate-400">
                        {user.status === 'approved' ? 'Aktif' : user.status === 'pending' ? 'Pending' : 'Ditolak'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Selected User Details & Menu/Submenu Granular Access */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          {selectedUser ? (
            <>
              {/* Selected User Header Banner */}
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-600 flex items-center justify-center text-white font-bold text-base shadow-md">
                    {selectedUser.role === 'super_admin' ? '👑' : selectedUser.fullName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white">
                        {selectedUser.role === 'super_admin' ? 'Super Admin' : selectedUser.fullName}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {ROLE_LABELS[selectedUser.role] || selectedUser.role}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-500" />
                        {selectedUser.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building className="w-3 h-3 text-slate-500" />
                        {selectedUser.department}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                  {onNavigateToE2E && (
                    <button
                      onClick={() => {
                        logisticsStore.setCurrentUser(selectedUser);
                        onNavigateToE2E();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-white border border-emerald-500/40 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
                      title={`Simulasikan sesi dan uji alur kerja sistem sebagai ${selectedUser.fullName}`}
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Uji Akun Ini</span>
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button
                      onClick={() => handleOpenEdit(selectedUser)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
                      title={`Edit Data ${selectedUser.fullName} (${ROLE_LABELS[selectedUser.role] || selectedUser.role})`}
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Edit {selectedUser.fullName}</span>
                    </button>
                  )}
                  {selectedUser.status === 'pending' && isSuperAdmin && (
                    <button
                      onClick={() => handleApprove(selectedUser.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-sm active:scale-95"
                    >
                      Setujui Akun
                    </button>
                  )}
                </div>
              </div>

              {/* Granular Menu & Submenu Permissions Section */}
              <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto text-xs">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span>Rincian Menu &amp; Sub-Menu Hak Akses</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Centang modul dan sub-menu yang dapat diakses, serta atur pembatasan input data (*Full Akses* vs *Hanya Lihat*).
                    </div>
                  </div>
                  <button
                    onClick={() => setIsCopyModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    title="Salin hak akses dari user lain"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Akses</span>
                  </button>
                </div>

                {/* Modules Accordion List */}
                <div className="space-y-3">
                  {MODULE_DEFINITIONS.map(mod => {
                    const modState = editingPermissions[mod.id] || { enabled: true, subMenus: {} };
                    const isExpanded = expandedModules[mod.id];

                    return (
                      <div key={mod.id} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
                        <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={modState.enabled}
                              onChange={(e) => handleToggleModuleEnabled(mod.id, e.target.checked)}
                              disabled={!isSuperAdmin}
                              className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                            />
                            <button
                              type="button"
                              onClick={() => toggleModuleExpansion(mod.id)}
                              className="font-bold text-white flex items-center gap-2 text-left cursor-pointer hover:text-amber-400"
                            >
                              <span>{mod.name}</span>
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </button>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            modState.enabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {modState.enabled ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>

                        {isExpanded && modState.enabled && (
                          <div className="p-3 divide-y divide-slate-800/60 space-y-2">
                            {mod.subMenus.map(sub => {
                              const accessLevel = modState.subMenus[sub.id] || 'read_only';
                              const isSubActive = accessLevel !== 'none';

                              return (
                                <div key={sub.id} className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={isSubActive}
                                      onChange={(e) => handleSubMenuPermissionChange(
                                        mod.id, 
                                        sub.id, 
                                        e.target.checked ? 'full_access' : 'none'
                                      )}
                                      disabled={!isSuperAdmin}
                                      className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-amber-500 cursor-pointer"
                                    />
                                    <span className={isSubActive ? 'text-slate-200 font-medium' : 'text-slate-500 line-through'}>
                                      {sub.name}
                                    </span>
                                  </div>

                                  {isSubActive && (
                                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                      <span className="text-[10px] text-slate-400">Akses Input:</span>
                                      <select
                                        value={accessLevel}
                                        onChange={(e) => handleSubMenuPermissionChange(mod.id, sub.id, e.target.value as any)}
                                        disabled={!isSuperAdmin}
                                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
                                      >
                                        <option value="full_access">🟢 Full Akses (Bisa Input/Edit)</option>
                                        <option value="read_only">🟡 Hanya Lihat (Read Only)</option>
                                        <option value="none">🔴 Tidak Ada Akses</option>
                                      </select>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Right Actions Footer (Copy Akses, Ubah Password, Simpan Akses, Hapus) */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {isSuperAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsPasswordModalOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700 text-xs shadow-xs"
                        title="Ubah password akun apabila user lupa password"
                      >
                        <Key className="w-4 h-4 text-amber-400" />
                        <span>Ubah Password</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(selectedUser.id)}
                        className="px-3.5 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900 text-rose-300 font-bold flex items-center gap-1.5 transition cursor-pointer border border-rose-950 text-xs shadow-xs"
                        title="Hapus akun dari sistem"
                      >
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span>Hapus Akun</span>
                      </button>
                    </>
                  )}
                </div>

                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={handleSaveAccess}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-95 text-xs self-end sm:self-auto"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Akses</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs">
              Pilih pengguna di sebelah kiri untuk melihat rincian hak akses.
            </div>
          )}
        </div>

      </div>

      {/* ================= COPY ACCESS SUB-MODAL ================= */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Copy className="w-4 h-4 text-amber-400" />
              <span>Salin Akses dari User Lain</span>
            </h4>
            <p className="text-xs text-slate-400">
              Pilih akun pengguna sumber untuk menyalin seluruh konfigurasi hak akses modul dan sub-menu ke user saat ini ({selectedUser?.fullName}).
            </p>
            <select
              value={sourceUserIdForCopy}
              onChange={(e) => setSourceUserIdForCopy(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
            >
              <option value="">-- Pilih User Sumber --</option>
              {users.filter(u => u.id !== selectedUser?.id).map(u => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({ROLE_LABELS[u.role] || u.role})
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-semibold text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleCopyAccess}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Terapkan Salin Akses
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CHANGE PASSWORD SUB-MODAL ================= */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Ubah Password Akun: {selectedUser?.fullName}</span>
              </h4>
              <button
                onClick={() => { setIsPasswordModalOpen(false); setNewPasswordInput(''); setConfirmPasswordInput(''); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Masukkan password baru untuk akun ini (digunakan apabila user lupa password).
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Password Baru <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Minimal 6 karakter"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white pr-9 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    title={showNewPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Konfirmasi Password Baru <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Ketik ulang password baru"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-xs text-white pr-9 focus:outline-none ${
                      confirmPasswordInput && newPasswordInput !== confirmPasswordInput
                        ? 'border-rose-500/70 focus:border-rose-500'
                        : confirmPasswordInput && newPasswordInput === confirmPasswordInput
                        ? 'border-emerald-500/70 focus:border-emerald-500'
                        : 'border-slate-800 focus:border-amber-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    title={showConfirmPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Real-time mismatch detection */}
              {confirmPasswordInput.length > 0 && (
                <div className="text-[11px] flex items-center gap-1.5 pt-0.5">
                  {newPasswordInput !== confirmPasswordInput ? (
                    <span className="text-rose-400 flex items-center gap-1 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Password konfirmasi tidak cocok!</span>
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Password cocok dan terkonfirmasi.</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setIsPasswordModalOpen(false); setNewPasswordInput(''); setConfirmPasswordInput(''); }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={!newPasswordInput || newPasswordInput.length < 6 || newPasswordInput !== confirmPasswordInput}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md shadow-amber-500/20 active:scale-95 disabled:cursor-not-allowed"
              >
                Simpan Password Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-amber-400" />
                Tambah Pengguna Baru AKK
              </h3>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap User"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Email / Username</label>
                <input
                  type="text"
                  required
                  placeholder="nama@gmail.com atau username"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="********"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold shadow"
                >
                  Simpan &amp; Setujui
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Profile Modal (Khusus Super Admin) */}
      {editingUser && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <UserCog className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                    <span>Edit Pengguna: {editingUser.fullName}</span>
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {ROLE_LABELS[editingUser.role] || editingUser.role}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Perbarui data akun <strong className="text-slate-200">{editingUser.fullName}</strong> &bull; ID: <code className="text-amber-400 font-mono">{editingUser.id}</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>Nama Lengkap &amp; Gelar</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.fullName}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                    <span>Email Akun</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>No. WhatsApp</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>Hak Akses (Role)</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="super_admin">👑 Super Admin / Manager</option>
                    <option value="spv_logistik">🚛 SPV Logistik</option>
                    <option value="operasional">📋 Operasional (Operational Lead)</option>
                    <option value="security">🛡️ Security (Pos Satpam &amp; Keamanan)</option>
                    <option value="driver">🚚 Kru Supir / Driver</option>
                    <option value="crew_helper">🤝 Kru Helper / Kernet</option>
                    <option value="sales_admin">💼 Adm. Penjualan</option>
                    <option value="purchasing_admin">🛒 Adm. Pembelian</option>
                    <option value="hr_admin">👥 HR Admin</option>
                    <option value="finance_tax_admin">💰 Finance &amp; Tax</option>
                    <option value="warehouse_admin">📦 Gudang</option>
                    <option value="marketing_online">🌐 Marketing Online</option>
                    <option value="marketing_offline">📣 Marketing Offline</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Status Akun</span>
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as UserApprovalStatus })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="approved">Aktif / Disetujui (Approved)</option>
                    <option value="pending">Menunggu Approval (Pending)</option>
                    <option value="rejected">Ditolak / Dibekukan (Rejected)</option>
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Departemen / Divisi</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ================= DELETE CONFIRMATION SUB-MODAL ================= */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl neu-flat">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">
                  Konfirmasi Hapus Akun
                </h4>
                <p className="text-[10px] text-slate-400">
                  Panel Pengguna &bull; PT Anugrah Kemasan Kreatif
                </p>
              </div>
            </div>

            {users.find(u => u.id === deleteTargetId) && (
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                  {users.find(u => u.id === deleteTargetId)?.fullName.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-xs truncate">
                    {users.find(u => u.id === deleteTargetId)?.fullName}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {users.find(u => u.id === deleteTargetId)?.email} &bull; <span className="text-amber-400">{ROLE_LABELS[users.find(u => u.id === deleteTargetId)?.role || 'spv_logistik']}</span>
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus akun pengguna ini? Tindakan ini bersifat permanen dan seluruh hak akses akun akan dihapus dari sistem.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setIsDeleteModalOpen(false); setDeleteTargetId(null); }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                Tidak, Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition cursor-pointer active:scale-95"
              >
                Ya, Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ================= IN-PAGE POP-UP MODAL NOTIFICATION ================= */}
      {pageModalNotification && (
        <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl text-center">
            <div className="flex flex-col items-center gap-2.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                pageModalNotification.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                pageModalNotification.type === 'error' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                pageModalNotification.type === 'warning' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {pageModalNotification.type === 'success' && <CheckCircle2 className="w-6 h-6" />}
                {pageModalNotification.type === 'error' && <AlertTriangle className="w-6 h-6" />}
                {pageModalNotification.type === 'warning' && <ShieldAlert className="w-6 h-6" />}
                {pageModalNotification.type === 'info' && <ShieldCheck className="w-6 h-6" />}
              </div>
              <h4 className="font-bold text-white text-base">
                {pageModalNotification.title}
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {pageModalNotification.message}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPageModalNotification(null)}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95"
              >
                Oke, Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
