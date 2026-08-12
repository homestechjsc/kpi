const CACHE_NAME = 'kpi-baocao-v2'; // Tăng version lên v2 (mỗi lần sửa code lớn bạn đổi thành v3, v4...)

// 1. Cài đặt và ép Service Worker mới nhận diện ngay lập tức
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['./baocao.html']);
    })
  );
});

// 2. Kích hoạt và dọn dẹp các cache phiên bản cũ (tránh lưu rác)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // Xóa cache cũ
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Chiến lược Fetch: Luôn gọi mạng trước để lấy dữ liệu mới nhất
self.addEventListener('fetch', (e) => {
  // Chỉ áp dụng cho yêu cầu tải trang HTML hoặc điều hướng
  if (e.request.mode === 'navigate' || e.request.url.includes('baocao.html')) {
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          // Nếu có mạng, lưu bản mới nhất vào cache và trả về cho người dùng
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // Nếu mất mạng (offline), lấy tạm bản trong cache ra dùng
          return caches.match(e.request);
        })
    );
  } else {
    // Các tài nguyên khác (icon, ảnh,...) dùng kiểu cũ bình thường
    e.respondWith(
      caches.match(e.request).then((res) => res || fetch(e.request))
    );
  }
});
