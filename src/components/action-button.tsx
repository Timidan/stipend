import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/icons';

export type ActionState = 'idle' | 'loading' | 'done';

export function Spinner({ className, size }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" width={size} height={size} className={cn('size-4 animate-spin [animation-duration:800ms]', className)}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

/**
 * A button that morphs idle → working → done in place (from Resend/Raycast).
 * All three labels share one grid cell, so the width never jumps; the done state flashes the event colour.
 */
export function ActionButton({ state, idle, loading, done, icon, trail, onClick, className, size = 'default', variant = 'default', type = 'button', disabled }: {
  state: ActionState; idle: string; loading: string; done: string; icon?: IconName; trail?: boolean;
  onClick?: () => void; className?: string; size?: 'default' | 'sm' | 'lg'; variant?: 'default' | 'outline' | 'event'; type?: 'button' | 'submit'; disabled?: boolean;
}) {
  const layer = 'col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-[opacity,translate] duration-200 ease-out';
  return (
    <Button type={type} size={size} variant={state === 'done' ? 'event' : variant} disabled={disabled} aria-busy={state === 'loading'} aria-disabled={state === 'loading'}
      onClick={onClick} className={cn('grid', state === 'loading' && 'pointer-events-none', state === 'done' && 'animate-[tern-rise_0.2s_ease-out]', className)}>
      <span aria-hidden={state !== 'idle'} className={cn(layer, state !== 'idle' && 'pointer-events-none -translate-y-1 opacity-0')}>
        {icon && <Icon name={icon} />}{idle}{trail && <Icon name="arrow-right" className="trail" />}
      </span>
      <span aria-hidden={state !== 'loading'} className={cn(layer, state !== 'loading' && 'translate-y-1 opacity-0')}>
        <Spinner />{loading}
      </span>
      <span aria-hidden={state !== 'done'} className={cn(layer, state !== 'done' && 'translate-y-1 opacity-0')}>
        <Icon name="check" />{done}
      </span>
      <span className="sr-only" aria-live="polite">{state === 'loading' ? loading : state === 'done' ? done : ''}</span>
    </Button>
  );
}
