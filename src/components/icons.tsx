import { cn } from 'cn';
import {
  ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, Bank, CalendarDots, ChartLineUp, Check, Drop, Gauge, House, Info, Key, Pulse, ShieldCheck, WarningCircle, X,
  type IconWeight,
} from '@phosphor-icons/react';

const ICONS = {
  home: House, order: ChartLineUp, calendar: CalendarDots, activity: Pulse, key: Key, faucet: Drop, shield: ShieldCheck,
  'arrow-down': ArrowDown, 'arrow-up': ArrowUp, 'arrow-right': ArrowRight, 'arrow-up-right': ArrowUpRight,
  gauge: Gauge, bank: Bank, check: Check, close: X, info: Info, alert: WarningCircle,
};
export type IconName = keyof typeof ICONS;

/** Phosphor icons, sized in rem; `glyph-<name>` hooks the press/hover morphs in index.css. */
export function Icon({ name, size = 16, className, label, weight = 'bold' }: { name: IconName; size?: number; className?: string; label?: string; weight?: IconWeight }) {
  const Glyph = ICONS[name];
  return (
    <Glyph size={`${size / 16}rem`} weight={weight} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      className={cn('glyph', `glyph-${name}`, 'shrink-0', className)} />
  );
}
