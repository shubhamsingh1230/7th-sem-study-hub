/* Offline support: the page, manifest and icons are network-first (so updates show up), with the last copy
   kept for offline use; paper images and hashed code/notes files are cache-first. Supabase calls are never cached. */
const CACHE = 'hub-v9';
const DL = 'hub-dl'; // subjects the student saved for offline (videos, thumbnails, paper scans); kept across app updates
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'manifest.webmanifest', 'icon-192.png']))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== DL).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (r.mode === 'navigate' || u.pathname === '/' || u.pathname.endsWith('.html')) {
    e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put('./', c)); return res; }).catch(() => caches.match('./')));
    return;
  }
  // saved for offline: serve from the student's copy (with byte ranges, so video seeking works offline)
  if (/^\/(v|vt|papers)\//.test(u.pathname)) {
    e.respondWith(caches.open(DL).then(c => c.match(u.href)).then(async hit => {
      if (!hit) return /^\/v\//.test(u.pathname) ? fetch(r) : caches.match(r).then(h => h || fetch(r).then(res => { if (res.ok && res.status === 200) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); } return res; }));
      const range = r.headers.get('range'); if (!range) return hit;
      const buf = await hit.arrayBuffer(); const m = /bytes=(\d*)-(\d*)/.exec(range) || []; const size = buf.byteLength;
      let a = m[1] === '' || m[1] == null ? null : +m[1], b = m[2] === '' || m[2] == null ? null : +m[2];
      if (a == null) { a = Math.max(0, size - (b || 0)); b = size - 1; } else if (b == null || b >= size) b = size - 1;
      if (a >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      return new Response(buf.slice(a, b + 1), { status: 206, headers: { 'Content-Type': hit.headers.get('Content-Type') || 'video/mp4', 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': String(b - a + 1), 'Accept-Ranges': 'bytes' } });
    }));
    return;
  }
  // app identity (manifest, icons, share image): network-first, so a new logo or name always reaches installed apps
  if (/\/(manifest\.webmanifest|icon-\d+\.png|apple-touch-icon\.png|favicon-\d+\.png|og\.png)$/.test(u.pathname)) {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); } return res; }).catch(() => caches.match(r)));
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
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Semcrasher', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Semcrasher', { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'exam', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { for (const w of ws) { if ('focus' in w) { w.navigate(url).catch(() => {}); return w.focus(); } } return clients.openWindow(url); }));
});
