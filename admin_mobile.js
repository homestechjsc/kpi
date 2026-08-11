import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCUREZAu7XSS6-JwdpUL-FbqFv0gLVIQMk",
  authDomain: "kpihomestech.firebaseapp.com",
  databaseURL: "https://kpihomestech-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kpihomestech",
  storageBucket: "kpihomestech.firebasestorage.app",
  messagingSenderId: "154523584067",
  appId: "1:154523584067:web:37e45fc5af9c3367c7f6f6",
  measurementId: "G-30N67568FG"
};

const db = getDatabase(initializeApp(firebaseConfig));
let allKpiData = {};

const filterMonthEl = document.getElementById('filterMonth');
if (filterMonthEl) {
    filterMonthEl.value = new Date().toISOString().slice(0, 7);
}

// 1. Lắng nghe dữ liệu KPI
onValue(ref(db, 'kpis'), (s) => { 
    allKpiData = s.exists() ? s.val() : {}; 
    window.triggerDataLoad(); 
});

// 2. Lắng nghe dữ liệu Nhân sự (Đồng thời đổ vào Select Box Bộ Lọc)
onValue(ref(db, 'staffs'), (s) => {
    const staffSelect = document.getElementById('filterStaff');
    const mobileStaffList = document.getElementById('mobileStaffList');
    
    if (staffSelect) {
        staffSelect.innerHTML = '<option value="">-- Tất cả kỹ thuật --</option>';
        if (s.exists()) {
            Object.values(s.val()).forEach(st => {
                staffSelect.innerHTML += `<option value="${st.name}">${st.name}</option>`;
            });
        }
    }

    if (!mobileStaffList) return;
    mobileStaffList.innerHTML = '';
    
    if (s.exists()) {
        Object.entries(s.val()).forEach(([id, st]) => {
            mobileStaffList.innerHTML += `
                <div class="bg-slate-50 border border-slate-200/70 rounded-xl p-3 text-xs flex justify-between items-center">
                    <div>
                        <div class="font-extrabold text-slate-800 text-sm">${st.name}</div>
                        <div class="text-emerald-600 font-bold">${st.role || ''} • <span class="text-slate-500 font-medium">${st.username}</span></div>
                    </div>
                    <button onclick="window.deleteStaff('${id}')" class="text-rose-500 bg-rose-50 hover:bg-rose-100 p-2.5 rounded-xl transition">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>`;
        });
    } else {
        mobileStaffList.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Chưa có tài khoản kỹ thuật nào.</p>';
    }
});

// 3. Xử lý bộ lọc kết hợp (Tháng, Tên kỹ thuật, Khoảng ngày)
window.triggerDataLoad = () => {
    const selectedStaff = document.getElementById('filterStaff') ? document.getElementById('filterStaff').value : "";
    const fromDate = document.getElementById('filterFromDate') ? document.getElementById('filterFromDate').value : "";
    const toDate = document.getElementById('filterToDate') ? document.getElementById('filterToDate').value : "";
    const currentMonth = filterMonthEl ? filterMonthEl.value : "";

    const entries = Object.entries(allKpiData).filter(([id, d]) => {
        if (!d.ngayThucHien) return false;

        let matchMonth = currentMonth ? d.ngayThucHien.startsWith(currentMonth) : true;
        let matchStaff = selectedStaff ? d.ktPhuTrach === selectedStaff : true;

        let matchDateRange = true;
        if (fromDate && toDate) {
            matchDateRange = d.ngayThucHien >= fromDate && d.ngayThucHien <= toDate;
        } else if (fromDate) {
            matchDateRange = d.ngayThucHien >= fromDate;
        } else if (toDate) {
            matchDateRange = d.ngayThucHien <= toDate;
        }

        return matchMonth && matchStaff && matchDateRange;
    });

    // 4. SẮP XẾP THÔNG MINH: Chưa chấm điểm lên đầu, sau đó theo ngày mới nhất
    entries.sort((a, b) => {
        const aChamped = a[1].diemKpi !== undefined && a[1].diemKpi !== null && Number(a[1].diemKpi) > 0;
        const bChamped = b[1].diemKpi !== undefined && b[1].diemKpi !== null && Number(b[1].diemKpi) > 0;

        if (aChamped !== bChamped) {
            return aChamped ? 1 : -1; // Chưa chấm (false) lên trước đã chấm (true)
        }
        // Nếu cùng trạng thái chấm, sắp xếp theo ngày mới nhất lên đầu
        return (b[1].ngayThucHien || '').localeCompare(a[1].ngayThucHien || '');
    });

    renderKpiMobileList(entries);
    renderMobileReport(entries);
};

// 5. Nút đặt lại bộ lọc
window.resetFilter = () => {
    if (document.getElementById('filterStaff')) document.getElementById('filterStaff').value = "";
    if (document.getElementById('filterFromDate')) document.getElementById('filterFromDate').value = "";
    if (document.getElementById('filterToDate')) document.getElementById('filterToDate').value = "";
    if (filterMonthEl) filterMonthEl.value = new Date().toISOString().slice(0, 7);
    window.triggerDataLoad();
};

// 6. Render danh sách duyệt KPI dạng thẻ card (Đã làm mờ và thu gọn khi đã chấm)
// Render danh sách duyệt KPI dạng thẻ card tối ưu màn hình mobile (Có nút bung/gấp khung chấm điểm)
function renderKpiMobileList(entries) {
    const container = document.getElementById('adminKpiMobileList');
    const badge = document.getElementById('pendingCountBadge');
    if (!container) return;
    container.innerHTML = '';

    if (badge) badge.textContent = `${entries.length} CV`;

    if (entries.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-8 bg-white rounded-2xl border">Không có dữ liệu công việc phù hợp.</p>';
        return;
    }

    entries.forEach(([id, item]) => {
        const isChamped = item.diemKpi !== undefined && item.diemKpi !== null && Number(item.diemKpi) > 0;
        
        const cardOpacity = isChamped ? 'opacity-85 bg-slate-50/90 border-slate-200' : 'bg-white border-emerald-200/80 shadow-sm';
        
        // Huy hiệu trạng thái trên góc thẻ
        const statusBadge = isChamped 
            ? `<span class="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1 shadow-sm"><i class="fa-solid fa-check"></i> Đã chấm: ${item.diemKpi}đ</span>`
            : `<span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 animate-pulse"><i class="fa-solid fa-clock mr-1"></i> Chờ chấm</span>`;

        // Icon nút bấm chấm KPI (Thay đổi linh hoạt dựa vào trạng thái đã chấm hay chưa)
        const actionButtonIcon = isChamped
            ? `<button onclick="window.toggleReviewBox('${id}')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-[11px] font-black transition flex items-center gap-1.5 border border-emerald-200"><i class="fa-solid fa-circle-check"></i> Đã chấm KPI</button>`
            : `<button onclick="window.toggleReviewBox('${id}')" class="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-xl text-[11px] font-black transition flex items-center gap-1.5 border border-blue-200 shadow-sm"><i class="fa-solid fa-star-half-stroke"></i> Chấm KPI</button>`;

        let tuVanHtml = item.coTuVanBanHang ? `<div class="text-[11px] text-indigo-700 bg-indigo-50/80 p-2 rounded-xl mt-1 font-medium"><i class="fa-solid fa-comments mr-1"></i> <strong>Tư vấn:</strong> ${item.noiDungTuVan || 'Có'}</div>` : '';

        container.innerHTML += `
            <div class="${cardOpacity} border rounded-2xl p-4 text-xs space-y-2.5 transition-all">
                <div class="flex justify-between items-start gap-2">
                    <div>
                        <span class="font-extrabold text-emerald-700 text-sm">${item.ktPhuTrach || 'Kỹ thuật'}</span>
                        <div class="text-[11px] text-slate-400">${item.ngayThucHien ? item.ngayThucHien.split('-').reverse().join('/') : ''}</div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${statusBadge}
                        ${actionButtonIcon}
                    </div>
                </div>

                <div class="font-bold text-blue-600 text-xs">${item.sttCv || ''} - ${item.khachHang || ''}</div>
                <div class="text-slate-700 font-medium text-xs leading-relaxed">${item.noiDung || ''}</div>
                ${tuVanHtml}

                <div class="text-[11px] text-slate-500 flex items-center gap-3 pt-1 border-t border-slate-100">
                    <span>TG: <strong>${item.thoiGian || 0}p</strong></span>
                    <span>Ảnh: <i class="fa-solid fa-camera ${item.chupAnh ? 'text-emerald-500':'text-slate-300'}"></i></span>
                    <span>Maps: <i class="fa-solid fa-map ${item.danhGiaMaps ? 'text-blue-500':'text-slate-300'}"></i></span>
                </div>

                <!-- Khu vực nhập điểm và đánh giá (Mặc định ẩn đi để giao diện cực kỳ gọn gàng) -->
                <div id="reviewBox_${id}" class="hidden bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5 pt-2 animate-in fade-in duration-200">
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">Điểm KPI</label>
                            <input type="number" step="0.5" id="diem_${id}" value="${item.diemKpi || 0}" class="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-center font-black text-emerald-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">Nhận xét</label>
                            <input type="text" id="danhgia_${id}" value="${item.danhGiaAdmin || ''}" placeholder="Nhận xét..." class="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500">
                        </div>
                    </div>
                    <button onclick="window.saveReview('${id}')" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-check"></i> Lưu Chấm Điểm
                    </button>
                </div>
            </div>
        `;
    });
}
// 7. Render báo cáo tổng hợp trên mobile
function renderMobileReport(entries) {
    const sum = {};
    entries.forEach(([id, i]) => {
        const kt = i.ktPhuTrach || 'Khác';
        if (!sum[kt]) sum[kt] = { cv: 0, t: 0, sc: 0 };
        sum[kt].cv++; 
        sum[kt].t += Number(i.thoiGian) || 0;
        sum[kt].sc += Number(i.diemKpi) || 0;
    });

    const container = document.getElementById('mobileReportList');
    if (!container) return;
    container.innerHTML = '';

    if (Object.keys(sum).length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Chưa có dữ liệu báo cáo trong khoảng thời gian này.</p>';
        return;
    }

    Object.entries(sum).forEach(([name, data]) => {
        container.innerHTML += `
            <div class="bg-slate-50 border border-slate-200/70 rounded-xl p-3 text-xs flex justify-between items-center">
                <div>
                    <div class="font-extrabold text-slate-800 text-sm">${name}</div>
                    <div class="text-slate-500 text-[11px] mt-0.5">${data.cv} công việc • Tổng TG: ${data.t}p</div>
                </div>
                <div class="text-right">
                    <span class="text-[10px] uppercase font-bold text-emerald-600 block">Tổng Điểm</span>
                    <span class="text-base font-black text-emerald-700">${data.sc}</span>
                </div>
            </div>
        `;
    });
}

// 8. Actions
window.saveReview = (id) => {
    const diem = Number(document.getElementById(`diem_${id}`).value);
    const danhGia = document.getElementById(`danhgia_${id}`).value;

    update(ref(db, `kpis/${id}`), { diemKpi: diem, danhGiaAdmin: danhGia })
        .then(() => alert("Cập nhật điểm KPI thành công!"))
        .catch(err => alert("Lỗi: " + err.message));
};

window.addStaff = (e) => {
    e.preventDefault();
    const name = document.getElementById('staffName').value.trim();
    const role = document.getElementById('staffRole').value.trim();
    const username = document.getElementById('staffUsername').value.trim();
    const password = document.getElementById('staffPassword').value.trim();

    if (name && username && password) {
        push(ref(db, 'staffs'), { name, role, username, password })
            .then(() => {
                alert("Tạo tài khoản kỹ thuật thành công!");
                document.getElementById('staffForm').reset();
            });
    }
};

window.deleteStaff = (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa tài khoản này?")) {
        remove(ref(db, `staffs/${id}`));
    }
};

// 9. Chuyển Tab Admin Mobile
window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(d => d.classList.add('hidden'));
    document.getElementById(tab).classList.remove('hidden');

    const titles = { 'kpiTab': 'Duyệt & Chấm KPI', 'reportTab': 'Báo Cáo Hiệu Suất', 'staffTab': 'Quản Lý Nhân Sự' };
    document.getElementById('headerTitle').textContent = titles[tab];

    document.querySelectorAll('.nav-btn').forEach(b => {
        b.className = "nav-btn flex flex-col items-center text-slate-400 hover:text-slate-600 transition py-1 group";
        b.querySelector('div').className = "w-8 h-8 rounded-xl flex items-center justify-center transition mb-0.5";
    });

    const activeBtn = document.getElementById('nav_' + tab);
    if (activeBtn) {
        activeBtn.className = "nav-btn flex flex-col items-center text-emerald-600 transition py-1 group";
        activeBtn.querySelector('div').className = "w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-50 transition mb-0.5";
    }
};
// Hàm bật/tắt ẩn hiện khung chấm điểm khi bấm vào icon/nút
window.toggleReviewBox = (id) => {
    const box = document.getElementById(`reviewBox_${id}`);
    if (box) {
        box.classList.toggle('hidden');
    }
};

// Cập nhật lại hàm saveReview để sau khi lưu xong sẽ tự động ẩn khung chấm và cập nhật giao diện gọn lại
window.saveReview = (id) => {
    const diem = Number(document.getElementById(`diem_${id}`).value);
    const danhGia = document.getElementById(`danhgia_${id}`).value;

    update(ref(db, `kpis/${id}`), { diemKpi: diem, danhGiaAdmin: danhGia })
        .then(() => {
            alert("Cập nhật điểm KPI thành công!");
            // Tự động ẩn khung chấm đi sau khi lưu thành công cho gọn
            const box = document.getElementById(`reviewBox_${id}`);
            if (box) box.classList.add('hidden');
        })
        .catch(err => alert("Lỗi: " + err.message));
};

window.toggleFilterBox = () => {
    const filterBox = document.getElementById('filterContainer');
    if (filterBox) {
        filterBox.classList.toggle('hidden');
    }
};