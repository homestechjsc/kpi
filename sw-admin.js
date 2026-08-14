const CACHE_NAME = 'kpi-admin-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['./adminmobile.html'])));
  self.skipWaiting(); // Kích hoạt ngay service worker mới
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // Xóa cache cũ khi có phiên bản v2, v3...
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});

// Lắng nghe lệnh ép cập nhật từ nút bấm giao diện
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
