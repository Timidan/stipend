import { useEffect, useState } from 'react';
import { cn } from 'cn';
import { useReducedMotion } from 'motion/react';
import { useTheme } from '@/theme';

const stops = (colors: string[]) => colors.map((color, i) => ({ color, position: i / (colors.length - 1) }));
const PALETTE = {
  light: stops(['#F3F5F6', '#E1E7EA', '#E2F98A', '#F3F5F6', '#BDEAD6']),
  dark: stops(['#0D0F11', '#161B1F', '#3A4A08', '#0D0F11', '#0D3D2E']),
};

/** CSS gradient underneath; the WebGPU mesh (~730 KB gzip) is fetched only once an adapter exists. */
export function Backdrop() {
  const { dark } = useTheme();
  const reduced = useReducedMotion();
  const [lib, setLib] = useState<typeof import('shaders/react') | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<object | null> } }).gpu;
    gpu?.requestAdapter()
      .then(adapter => adapter && import('shaders/react'))
      .then(mod => { if (live && mod) setLib(mod); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return (
    <div aria-hidden="true" className={cn('app-backdrop pointer-events-none fixed inset-0 -z-10', lib && ready && 'shader-on')}>
      {lib && (
        <lib.Shader key={dark ? 'dark' : 'light'} disableTelemetry onReady={() => setReady(true)} onUnavailable={() => setLib(null)}
          className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: ready ? 1 : 0 }}>
          <lib.MeshGradient colorA="" colorB="" stops={dark ? PALETTE.dark : PALETTE.light} count={6} smoothness={2.4} swirl={0.6} drift={1} speed={reduced ? 0 : 1.6} seed={7} />
          <lib.FilmGrain strength={dark ? 0.1 : 0.12} animated={!reduced} />
        </lib.Shader>
      )}
    </div>
  );
}
