import {
  Sun,
  ListTodo,
  NotebookText,
  Wallet,
  Compass,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "اليوم", icon: Sun },
  { href: "/tasks", label: "المهام", icon: ListTodo },
  { href: "/notes", label: "الملاحظات", icon: NotebookText },
  { href: "/finance", label: "المالية", icon: Wallet },
  { href: "/plans", label: "الخطط", icon: Compass },
];

export const ADMIN_ITEM: NavItem = {
  href: "/admin",
  label: "الإدارة",
  icon: ShieldCheck,
};
