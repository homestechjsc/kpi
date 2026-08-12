const CACHE_NAME = 'kpi-baocao-stable';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// Luôn lấy bản mới nhất từ mạng, nếu offline mới dùng cache cũ
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(e.request);
      })
  );
});
