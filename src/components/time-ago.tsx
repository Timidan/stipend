import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function timeAgo(at: number, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - at) / 1000)), minutes = Math.floor(seconds / 60), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
  if (seconds < 60) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  const date = new Date(at);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(date.getFullYear() !== new Date(now).getFullYear() && { year: 'numeric' }) });
}

/** Relative time that keeps itself current; the exact local time is in the tooltip. */
export function TimeAgo({ at, className }: { at: number; className?: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const exact = new Date(at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
  return (
    <Tooltip>
      <TooltipTrigger asChild><time tabIndex={0} dateTime={new Date(at).toISOString()} className={className}>{timeAgo(at, now)}</time></TooltipTrigger>
      <TooltipContent>{exact}</TooltipContent>
    </Tooltip>
  );
}
