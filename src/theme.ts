import { useSyncExternalStore } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';

function read(): ThemeChoice {
  try {
    const value = localStorage.getItem('stipend-theme');
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch { return 'system'; }
}

// One theme for the whole app. Every useTheme() caller reads this shared state.
const media = matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();
let choice = read();
const isDark = () => choice === 'dark' || (choice === 'system' && media.matches);
function apply() {
  document.documentElement.classList.toggle('dark', isDark());
  listeners.forEach(listener => listener());
}
media.addEventListener('change', () => { if (choice === 'system') apply(); });
window.addEventListener('storage', event => { if (event.key === 'stipend-theme') { choice = read(); apply(); } });
apply();

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, () => `${choice}:${isDark()}`);
  const [current, dark] = snapshot.split(':');
  return { choice: current as ThemeChoice, dark: dark === 'true' };
}
