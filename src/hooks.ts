import { useEffect, useState, useSyncExternalStore } from 'react';
import { app, type Snapshot } from '@/lib/app';

export const useApp = (): Snapshot => useSyncExternalStore(app.subscribe, app.getSnapshot);

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
