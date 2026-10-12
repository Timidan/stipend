import { cn } from 'cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function StipendMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-7 shrink-0', className)}>
      <path fill="currentColor" d="M32 6a26 26 0 1 0 25.7 30H34a2 2 0 0 1-2-2V6Z" />
      <path className="fill-[var(--event)]" d="M37 2.6V27a2 2 0 0 0 2 2h22.4A26 26 0 0 0 37 2.6Z" />
    </svg>
  );
}

/** Monad's logomark, as served on monad.xyz. */
export function MonadMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('size-5 shrink-0', className)}>
      <path fill="#836EF9" d="M11.782 0C8.37963 0 0 8.53443 0 11.9999C0 15.4654 8.37963 24 11.782 24C15.1844 24 23.5642 15.4653 23.5642 11.9999C23.5642 8.53458 15.1845 0 11.782 0ZM9.94598 18.8619C8.51124 18.4637 4.65378 11.5912 5.04481 10.1299C5.43584 8.66856 12.1834 4.73984 13.6181 5.1381C15.0529 5.5363 18.9104 12.4087 18.5194 13.87C18.1283 15.3314 11.3807 19.2602 9.94598 18.8619Z" />
    </svg>
  );
}

/** Agora's mark, from its brand kit. AUSD is Agora's dollar. */
export function AgoraMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 227 222" aria-hidden="true" className={cn('size-5 shrink-0', className)}>
      <path fill="currentColor" d="M107.9 0v88.1c0 3.7-4.4 5.5-7 2.9L59.4 50.5 76.8 5.3C78 2.1 81.1 0 84.5 0zM107.9 120v49.5c0 3.3-3.9 4.9-6.3 2.7l-64.3-60.6 18.9-49 46.9 45.9c3.1 3 4.8 7.1 4.8 11.5M107.9 199.8V222H8.2c-5.7 0-9.7-5.8-7.6-11.1l33.4-87 69.3 65.4c3 2.7 4.6 6.5 4.6 10.5M118.6 0v88.1c0 3.7 4.4 5.5 7 2.9L167 50.5 149.7 5.3C148.4 2.1 145.4 0 142 0zM118.6 120v49.5c0 3.3 3.9 4.9 6.3 2.7l64.3-60.6-18.9-49-46.9 45.9c-3.1 3-4.9 7.1-4.9 11.5zM118.6 199.8V222h99.6c5.8 0 9.8-5.8 7.7-11.1l-33.5-87-69.3 65.4c-2.9 2.7-4.5 6.5-4.5 10.5" />
    </svg>
  );
}

/** Perpl's mark, as served on perpl.xyz. */
export function PerplMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-5 shrink-0', className)}>
      <path fill="currentColor" d="M9.71373 0H4V31H9.71373V0ZM21.5062 15.4392H15.7925V31H21.5062V15.4392ZM27.2196 0H21.5059V15.4392H27.2196V0Z" />
    </svg>
  );
}

/** Mera's mark: the italic serif "m" from mera.category.xyz. */
export function MeraMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-5 shrink-0', className)}>
      <text x="32" y="50" fontFamily="Georgia,serif" fontStyle="italic" fontSize="64" textAnchor="middle" fill="currentColor">m</text>
    </svg>
  );
}

export const PARTNERS = [
  { Mark: MonadMark, name: 'Monad' },
  { Mark: AgoraMark, name: 'AUSD by Agora' },
  { Mark: MeraMark, name: 'Mera passkeys' },
  { Mark: PerplMark, name: 'Perpl perps' },
];

export function NetworkMark() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="Monad testnet" className="tap grid size-9 place-items-center rounded-full"><MonadMark /></button>
      </TooltipTrigger>
      <TooltipContent sideOffset={4}>Monad testnet</TooltipContent>
    </Tooltip>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[1.0625rem] font-semibold tracking-[-0.02em]', className)}>
      <StipendMark />Stipend
    </span>
  );
}
