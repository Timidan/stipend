const CACHE = 'stipend-shell-v2';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch('/', { cache: 'reload' });
    if (!response.ok) throw new Error('App shell unavailable');
    const html = await response.clone().text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(match => match[1]);
    await cache.addAll(['/icon.svg', '/manifest.webmanifest', ...assets]);
    await cache.put('/', response);
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('stipend-shell-') && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navigation = event.request.mode === 'navigate' && ['/', '/weeks', '/trade', '/activity'].includes(url.pathname);
  const asset = url.pathname.startsWith('/assets/') || ['/icon.svg', '/manifest.webmanifest'].includes(url.pathname);
  if (!navigation && !asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (navigation) {
      try { return await fetch(event.request); }
      catch { return (await cache.match('/')) ?? Response.error(); }
    }
    return (await cache.match(event.request)) ?? fetch(event.request);
  })());
});
