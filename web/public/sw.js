/* 112 PWA：应用外壳缓存。
 * 只接管 /vrc/ 下的 GET；/api/ 一律直连（数据要新鲜，缓存会被当成故障）。
 * 导航用网络优先（发版后不能吃旧 index），静态资源用 stale-while-revalidate。
 */
const CACHE = 'vrc-shell-v1';
const SHELL = ['/vrc/', '/vrc/manifest.webmanifest', '/vrc/icon-192.png', '/vrc/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/vrc/')) return;
  if (url.pathname.startsWith('/vrc/api/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put('/vrc/', copy)).catch(() => {});
          return r;
        })
        .catch(() => caches.match('/vrc/')),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((r) => {
          if (r.ok) caches.open(CACHE).then((c) => c.put(req, r.clone())).catch(() => {});
          return r;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});
