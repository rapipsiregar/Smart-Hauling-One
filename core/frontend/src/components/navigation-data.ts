import {
  Video,
  FileText,
  Settings,
  Clock,
  Cpu,
  RotateCw,
  Wrench,
  Truck,
  LucideIcon,
} from "lucide-react";


export type UserRole = "super_admin" | "gate_operator" | "logistics_auditor" | "field_technician";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  avatarText: string;
  defaultLanding: string;
}

export const DEMO_PROFILES: UserProfile[] = [
  { id: "usr-1", name: "Budi Santoso", email: "admin@ishs.co.id", role: "super_admin", roleTitle: "Supervisor Pusat", avatarText: "BS", defaultLanding: "/" },
  { id: "usr-2", name: "Ahmad Rizal", email: "operator@ishs.co.id", role: "gate_operator", roleTitle: "Operator Gerbang", avatarText: "AR", defaultLanding: "/" },
  { id: "usr-3", name: "Siti Rahma", email: "auditor@ishs.co.id", role: "logistics_auditor", roleTitle: "Logistics Auditor", avatarText: "SR", defaultLanding: "/ritase" },
  { id: "usr-4", name: "Dedi Kurniawan", email: "technician@ishs.co.id", role: "field_technician", roleTitle: "Teknisi Telemetri", avatarText: "DK", defaultLanding: "/" },
];

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  section: string;
  roles?: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    label: "Pantauan Kamera Live",
    href: "/",
    icon: Video,
    match: (p) => p === "/",
    section: "Pemantauan Pos",
    roles: ["super_admin", "gate_operator", "field_technician"],
  },
  {
    key: "ritase",
    label: "Status Ritase & Posisi Truk",
    href: "/ritase",
    icon: RotateCw,
    match: (p) => p.startsWith("/ritase"),
    section: "Data Ritase & Armada",
    roles: ["super_admin", "logistics_auditor"],
  },
  {
    key: "cctv-history",
    label: "Riwayat Pembacaan Kamera",
    href: "/cctv-history",
    icon: Clock,
    match: (p) => p.startsWith("/cctv-history"),
    section: "Data Ritase & Armada",
    roles: ["super_admin", "logistics_auditor"],
  },
  {
    key: "fleet-master",
    label: "Data Master Armada",
    href: "/fleet-master",
    icon: Truck,
    match: (p) => p.startsWith("/fleet-master"),
    section: "Data Ritase & Armada",
    roles: ["super_admin", "logistics_auditor"],
  },
  {
    key: "reports",
    label: "Laporan Ritase Shift",
    href: "/reports",
    icon: FileText,
    match: (p) => p.startsWith("/reports"),
    section: "Laporan & Analisis",
    roles: ["super_admin", "logistics_auditor"],
  },
  {
    key: "settings",
    label: "Pengaturan Pos & Kamera",
    href: "/settings",
    icon: Settings,
    match: (p) => p === "/settings",
    section: "Pengaturan Sistem",
    roles: ["super_admin"],
  },
  {
    key: "devices",
    label: "Kamera Per Pos",
    href: "/settings/devices",
    icon: Cpu,
    match: (p) => p.startsWith("/settings/devices"),
    section: "Pengaturan Sistem",
    roles: ["super_admin", "field_technician"],
  },
];

export const NAV_SECTIONS = ["Pemantauan Pos", "Data Ritase & Armada", "Laporan & Analisis", "Pengaturan Sistem"];

export const HEADINGS: Record<string, string> = {
  "/": "Pantauan Kamera Live",
  "/ritase": "Status Ritase & Posisi Truk",
  "/cctv-history": "Riwayat Pembacaan Kamera Pos",
  "/fleet-master": "Data Master Armada",
  "/reports": "Laporan Ritase Harian & Shift",
  "/settings": "Pengaturan Pos Check Point & Kamera",
  "/settings/devices": "Pengaturan Kamera Per Pos Gerbang",
  "/live": "Tayangan Langsung Kamera Pos",
};



