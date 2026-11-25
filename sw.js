/* Offline support: the page itself is network-first (so updates show up), with the last copy
   kept for offline use; paper images and icons are cache-first. Supabase calls are never cached. */
const CACHE = 'hub-v4';
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'manifest.webmanifest', 'icon-192.png']))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (r.mode === 'navigate' || u.pathname === '/' || u.pathname.endsWith('.html')) {
    e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put('./', c)); return res; }).catch(() => caches.match('./')));
    return;
  }
  // hashed files (app.<hash>.js, sb.<hash>.js, notes.<hash>.txt) never change: keep the newest of each, drop older ones
  const hm = u.pathname.match(/\/(app|sb|notes)\.[0-9a-f]{10}\.(js|txt)$/);
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
    if (res.ok) { const c = res.clone(); caches.open(CACHE).then(async x => {
      if (hm) { for (const q of await x.keys()) { const p = new URL(q.url).pathname; if (p !== u.pathname && new RegExp('/' + hm[1] + '\\.[0-9a-f]{10}\\.').test(p)) await x.delete(q); } }
      await x.put(r, c); }); }
    return res; })));
});

/* Exam reminders */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: '7th Sem Study Hub', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || '7th Sem Study Hub', { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'exam', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { for (const w of ws) { if ('focus' in w) { w.navigate(url).catch(() => {}); return w.focus(); } } return clients.openWindow(url); }));
});
