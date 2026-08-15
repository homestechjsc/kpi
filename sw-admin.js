const CACHE_NAME = 'kpi-admin-v2'; // Tăng version lên v2

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['./adminmobile.html'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // Xóa sạch cache cũ
          }
        })
      );
    })
  );
  self.clients.claim(); // Kiểm soát ngay lập tức các client đang mở
});

// Sửa chiến lược fetch thành Network-First để luôn lấy code mới nhất
self.addEventListener('fetch', (e) => {
  // Bỏ qua các request không phải GET hoặc request kết nối Firebase/API bên ngoài nếu cần
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Nếu lấy được từ mạng, cập nhật lại cache và trả về response mới
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // Nếu mất kết nối mạng, mới dùng tạm dữ liệu từ cache cũ
        return caches.match(e.request);
      })
  );
});

// Lắng nghe lệnh ép cập nhật từ nút bấm giao diện
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
