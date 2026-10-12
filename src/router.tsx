import { useEffect, useState } from 'react';

export function navigate(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return path;
}

export function Link({ to, children, className, ariaLabel, ariaCurrent }: { to: string; children: React.ReactNode; className?: string; ariaLabel?: string; ariaCurrent?: 'page' }) {
  return <a href={to} className={className} aria-label={ariaLabel} aria-current={ariaCurrent} onClick={(event) => {
    if (to.startsWith('#') || /^https?:/.test(to)) return;
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(to); }
  }}>{children}</a>;
}
