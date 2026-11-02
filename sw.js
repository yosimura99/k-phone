/* K.Phone service worker – chỉ cache vỏ ứng dụng (offline shell). Không cache trang ProxyDancu. */
var CACHE = 'kphone-shell-v4';
var SHELL = [
  './',
  './index.html',
  './exit.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // không đụng tới trang máy / bên thứ ba

  // Mạng trước, lỗi mạng thì dùng cache (để luôn có bản mới nhất khi online).
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504 });
      });
    })
  );
});
