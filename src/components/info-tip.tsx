import { Icon } from '@/components/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** A small (i) that explains a term in plain words, on hover or keyboard focus. */
export function InfoTip({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={`What is ${term}?`}
          className="inline-grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground/80 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          <Icon name="info" size={13} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-[0.8125rem] leading-snug">{children}</TooltipContent>
    </Tooltip>
  );
}
