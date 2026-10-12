import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { App } from '@/App';
import { TooltipProvider } from '@/components/ui/tooltip';
import '@/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><MotionConfig reducedMotion="user"><TooltipProvider delayDuration={200}><App /></TooltipProvider></MotionConfig></StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => console.warn('Offline app shell could not be installed.'));
  });
}
