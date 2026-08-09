import { NavigationTab } from './types';

export type UserRole = 'super_admin' | 'gate_operator' | 'logistics_auditor' | 'field_technician';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  avatarUrl: string;
  contractor?: string;
}

export const ROLE_PERMISSIONS: Record<UserRole, NavigationTab[]> = {
  super_admin: ['dashboard', 'gate_console', 'map', 'ledger', 'fleet', 'ritase', 'reports', 'maintenance', 'analytics', 'contractor'],
  gate_operator: ['gate_console', 'dashboard', 'map'],
  logistics_auditor: ['ledger', 'reports', 'dashboard', 'analytics', 'contractor', 'ritase'],
  field_technician: ['maintenance', 'map', 'dashboard'],
};



export const DEMO_USERS: User[] = [
  {
    id: 'usr-1',
    name: 'Budi Santoso (Admin)',
    email: 'admin@smarthauling.id',
    role: 'super_admin',
    roleTitle: 'Supervisor Pusat (Head Ops)',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  },
  {
    id: 'usr-2',
    name: 'Ahmad Rizal (Operator)',
    email: 'operator@smarthauling.id',
    role: 'gate_operator',
    roleTitle: 'Operator Pos Gerbang CK North',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    contractor: 'PT Tunas Inti Abadi',
  },
  {
    id: 'usr-3',
    name: 'Siti Rahma (Auditor)',
    email: 'auditor@smarthauling.id',
    role: 'logistics_auditor',
    roleTitle: 'Senior Logistics Auditor',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    contractor: 'PT Borneo Indah Cemerlang',
  },
  {
    id: 'usr-4',
    name: 'Dedi Kurniawan (Teknisi)',
    email: 'technician@smarthauling.id',
    role: 'field_technician',
    roleTitle: 'Teknisi Edge & Telemetri Tower',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
  },
];

const STORAGE_KEY = 'smart_hauling_auth_user';

export function getStoredUser(): User | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasPermission(role: UserRole, tab: NavigationTab): boolean {
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes(tab);
}
