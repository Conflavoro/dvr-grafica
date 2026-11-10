import {
  LayoutDashboard,
  Building2,
  FileText,
  ShieldAlert,
  GraduationCap,
  HardHat,
  CalendarDays,
  FolderOpen,
  Users,
  Settings,
  BarChart3,
  Network,
  Wrench,
  UserSquare2,
  ClipboardList,
  Camera,
  type LucideIcon,
} from 'lucide-react';
import type { NavIcon } from '@/lib/mock-auth';

/**
 * Icona del falco Conflavoro (agente). Usa il marchio come maschera CSS cosi'
 * eredita il colore del testo (currentColor) come le icone lucide.
 */
function FalcoIcon({ size = 18, className }: { size?: number; strokeWidth?: number; className?: string }) {
  const mask = 'url(/brand/falco-mark.svg) center / contain no-repeat';
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        backgroundColor: 'currentColor',
        WebkitMask: mask,
        mask,
      }}
    />
  );
}

type IconCmp = LucideIcon | typeof FalcoIcon;

const ICONS: Record<NavIcon, IconCmp> = {
  falco: FalcoIcon,
  dashboard: LayoutDashboard,
  building: Building2,
  document: FileText,
  shield: ShieldAlert,
  graduation: GraduationCap,
  helmet: HardHat,
  calendar: CalendarDays,
  folder: FolderOpen,
  users: Users,
  settings: Settings,
  analytics: BarChart3,
  tenants: Network,
  workers: UserSquare2,
  tools: Wrench,
  registro: ClipboardList,
  sopralluogo: Camera,
};

interface IconProps {
  name: NavIcon;
  className?: string;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ name, className, size = 18, strokeWidth = 2 }: IconProps) {
  const Cmp = ICONS[name];
  if (Cmp === FalcoIcon) return <FalcoIcon size={size} className={className} />;
  const Lucide = Cmp as LucideIcon;
  return <Lucide size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}
