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
let allManagementTasks = {};

const filterMonthEl = document.getElementById('filterMonth');
if (filterMonthEl) {
    filterMonthEl.value = new Date().toISOString().slice(0, 7);
}

// 1. Lắng nghe dữ liệu công việc từ nhánh 'managementTasks'
onValue(ref(db, 'managementTasks'), (s) => { 
    allManagementTasks = s.exists() ? s.val() : {}; 
    
    // 👉 Gọi hàm thu thập danh sách khách hàng tự động ở đây
    collectAdminCustomersFromTasks(allManagementTasks);

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
    const currentMonth = filterMonthEl ? filterMonthEl.value : ""; // Định dạng YYYY-MM

    const entries = Object.entries(allManagementTasks).filter(([id, d]) => {
        // Lấy ngày tạo chuẩn (cắt bỏ phần giờ nếu có, lấy YYYY-MM-DD)
        const taskDate = d.ngayTao ? d.ngayTao.split('T')[0] : (d.thoiGianKetThuc ? d.thoiGianKetThuc.split('T')[0] : "");
        if (!taskDate) return false;

        // 1. Lọc theo tháng (Nếu có chọn tháng và không chọn khoảng ngày chi tiết)
        let matchMonth = true;
        if (currentMonth && !fromDate && !toDate) {
            matchMonth = taskDate.startsWith(currentMonth);
        }

        // 2. Lọc theo nhân sự (Phụ trách hoặc Hỗ trợ)
        let matchStaff = true;
        if (selectedStaff) {
            matchStaff = (d.ktPhuTrach === selectedStaff || d.ktHoTro === selectedStaff);
        }

        // 3. Lọc theo khoảng ngày (Từ ngày - Đến ngày)
        let matchDateRange = true;
        if (fromDate && toDate) {
            matchDateRange = taskDate >= fromDate && taskDate <= toDate;
        } else if (fromDate) {
            matchDateRange = taskDate >= fromDate;
        } else if (toDate) {
            matchDateRange = taskDate <= toDate;
        }

        return matchMonth && matchStaff && matchDateRange;
    });

    // Sắp xếp đưa việc chưa chấm điểm lên đầu, sau đó theo ngày mới nhất
    entries.sort((a, b) => {
        const aChamped = a[1].diemKpi !== undefined && a[1].diemKpi !== null && a[1].diemKpi !== "" && Number(a[1].diemKpi) > 0;
        const bChamped = b[1].diemKpi !== undefined && b[1].diemKpi !== null && b[1].diemKpi !== "" && Number(b[1].diemKpi) > 0;

        if (aChamped !== bChamped) {
            return aChamped ? 1 : -1;
        }
        return (b[1].ngayTao || '').localeCompare(a[1].ngayTao || '');
    });

    // Render lại toàn bộ các khu vực dữ liệu
    renderKpiMobileList(entries);
    renderMobileReport(entries);
    renderDashboardMetrics(entries);
    renderAdminMasterTaskList(entries);
    renderPerformanceReport(entries);
};
// 5. Nút đặt lại bộ lọc
window.resetFilter = () => {
    if (document.getElementById('filterStaff')) document.getElementById('filterStaff').value = "";
    if (document.getElementById('filterFromDate')) document.getElementById('filterFromDate').value = "";
    if (document.getElementById('filterToDate')) document.getElementById('filterToDate').value = "";
    if (filterMonthEl) filterMonthEl.value = new Date().toISOString().slice(0, 7);
    window.triggerDataLoad();
};

// 6. Render danh sách duyệt KPI dạng thẻ card
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
        const isChamped = item.diemKpi !== undefined && item.diemKpi !== null && item.diemKpi !== "" && Number(item.diemKpi) > 0;
        const cardOpacity = isChamped ? 'opacity-85 bg-slate-50/90 border-slate-200' : 'bg-white border-emerald-200/80 shadow-sm';
        
        const statusBadge = isChamped 
            ? `<span class="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1 shadow-sm"><i class="fa-solid fa-check"></i> Đã chấm: ${item.diemKpi}đ</span>`
            : `<span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 animate-pulse"><i class="fa-solid fa-clock mr-1"></i> Chờ chấm</span>`;

        const actionButtonIcon = isChamped
            ? `<button onclick="window.toggleReviewBox('${id}')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-[11px] font-black transition flex items-center gap-1.5 border border-emerald-200"><i class="fa-solid fa-circle-check"></i> Đã chấm KPI</button>`
            : `<button onclick="window.toggleReviewBox('${id}')" class="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-xl text-[11px] font-black transition flex items-center gap-1.5 border border-blue-200 shadow-sm"><i class="fa-solid fa-star-half-stroke"></i> Chấm KPI</button>`;

        let tuVanHtml = item.coTuVanBanHang ? `<div class="text-[11px] text-indigo-700 bg-indigo-50/80 p-2 rounded-xl mt-1 font-medium"><i class="fa-solid fa-comments mr-1"></i> <strong>Tư vấn:</strong> ${item.noiDungTuVan || 'Có'}</div>` : '';
        let supportHtml = item.ktHoTro ? `<span class="text-slate-500 font-normal"> + Hỗ trợ: ${item.ktHoTro}</span>` : '';

        let calcTime = Number(item.thoiGian) || 0;
        if (item.thoiGianBatDau && item.thoiGianKetThuc) {
            const startMs = new Date(item.thoiGianBatDau).getTime();
            const endMs = new Date(item.thoiGianKetThuc).getTime();
            calcTime = Math.max(0, Math.round((endMs - startMs) / 60000));
        }

        container.innerHTML += `
            <div class="${cardOpacity} border rounded-2xl p-4 text-xs space-y-2.5 transition-all">
                <div class="flex justify-between items-start gap-2">
                    <div>
                        <span class="font-extrabold text-emerald-700 text-sm">${item.ktPhuTrach || 'Chưa phân công'}${supportHtml}</span>
                        <div class="text-[11px] text-slate-400">Ngày tạo: ${item.ngayTao ? item.ngayTao.split('-').reverse().join('/') : ''}</div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${statusBadge}
                        ${actionButtonIcon}
                    </div>
                </div>

                <div class="font-bold text-blue-600 text-xs">${item.maCv || 'CV'} - ${item.khachHang || ''}</div>
                <div class="text-slate-700 font-medium text-xs leading-relaxed">${item.noiDung || ''}</div>
                ${tuVanHtml}

                <div class="text-[11px] text-slate-500 flex items-center gap-3 pt-1 border-t border-slate-100">
                    <span>TG: <strong>${calcTime}p</strong></span>
                    <span>Ảnh: <i class="fa-solid fa-camera ${item.chupAnh ? 'text-emerald-500':'text-slate-300'}"></i></span>
                    <span>Maps: <i class="fa-solid fa-map ${item.danhGiaMaps ? 'text-blue-500':'text-slate-300'}"></i></span>
                </div>

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
        
        let calcTime = Number(i.thoiGian) || 0;
        if (i.thoiGianBatDau && i.thoiGianKetThuc) {
            const startMs = new Date(i.thoiGianBatDau).getTime();
            const endMs = new Date(i.thoiGianKetThuc).getTime();
            calcTime = Math.max(0, Math.round((endMs - startMs) / 60000));
        }
        sum[kt].t += calcTime;
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

// 8. Tính năng Dashboard Tổng quan & Thống kê tài chính
function renderDashboardMetrics(entries) {
    let choTrienKhai = 0;
    let dangThucHien = 0;
    let tamNgung = 0;
    let hoanThanh = 0;
    let totalScore = 0;
    let totalTime = 0;

    let totalRevenue = 0;
    let totalDebt = 0;
    let warrantyCount = 0;
    let supportCount = 0;

    entries.forEach(([id, item]) => {
        const status = item.tinhTrang || 'Chờ triển khai';
        if (status === 'Chờ triển khai') choTrienKhai++;
        else if (status === 'Đang thực hiện') dangThucHien++;
        else if (status === 'Tạm ngưng') tamNgung++;
        else if (status === 'Đã hoàn thành') {
            hoanThanh++;

            // 👉 Tính toán tài chính & dịch vụ chính xác từ dữ liệu Firebase
            const hinhThuc = (item.hinhThucThanhToan || item.hinhThucXuLy || '').toLowerCase();
            const soTien = Number(item.soTienThanhToan || item.chiPhi) || 0;
            const congNo = item.tinhTrangCongNo || 'Không';

            if (congNo === 'Có nợ') {
                totalDebt += soTien;
            } else if (hinhThuc.includes('bảo hành') || item.chiPhi === 0 || item.hinhThucXuLy === 'baohanh') {
                warrantyCount++;
            } else if (hinhThuc.includes('hỗ trợ') || hinhThuc.includes('hotro') || hinhThuc.includes('miễn phí')) {
                supportCount++;
            } else {
                if (soTien > 0) totalRevenue += soTien;
            }
        }

        totalScore += Number(item.diemKpi) || 0;

        let calcTime = Number(item.thoiGian) || 0;
        if (item.thoiGianBatDau && item.thoiGianKetThuc) {
            const startMs = new Date(item.thoiGianBatDau).getTime();
            const endMs = new Date(item.thoiGianKetThuc).getTime();
            calcTime = Math.max(0, Math.round((endMs - startMs) / 60000));
        }
        totalTime += calcTime;
    });

    // Cập nhật số liệu trạng thái lên Dashboard Admin
    if (document.getElementById('dashChoTrienKhai')) document.getElementById('dashChoTrienKhai').textContent = choTrienKhai;
    if (document.getElementById('dashDangThucHien')) document.getElementById('dashDangThucHien').textContent = dangThucHien;
    if (document.getElementById('dashTamNgung')) document.getElementById('dashTamNgung').textContent = tamNgung;
    if (document.getElementById('dashHoanThanh')) document.getElementById('dashHoanThanh').textContent = hoanThanh;
    if (document.getElementById('dashTotalScore')) document.getElementById('dashTotalScore').textContent = totalScore;
    if (document.getElementById('dashTotalTime')) document.getElementById('dashTotalTime').textContent = `${totalTime}p`;

    // 👉 Cập nhật số liệu tài chính & dịch vụ vào các thẻ HTML tương ứng
    if (document.getElementById('adminTotalRevenue')) document.getElementById('adminTotalRevenue').textContent = `${totalRevenue.toLocaleString()} đ`;
    if (document.getElementById('adminTotalDebt')) document.getElementById('adminTotalDebt').textContent = `${totalDebt.toLocaleString()} đ`;
    if (document.getElementById('adminTotalWarranty')) document.getElementById('adminTotalWarranty').textContent = `${warrantyCount} CV`;
    if (document.getElementById('adminTotalSupport')) document.getElementById('adminTotalSupport').textContent = `${supportCount} CV`;
}
// 9. Actions
window.saveReview = (id) => {
    const diem = Number(document.getElementById(`diem_${id}`).value);
    const danhGia = document.getElementById(`danhgia_${id}`).value;

    update(ref(db, `managementTasks/${id}`), { diemKpi: diem, danhGiaAdmin: danhGia })
        .then(() => {
            alert("Cập nhật điểm KPI thành công!");
            const box = document.getElementById(`reviewBox_${id}`);
            if (box) box.classList.add('hidden');
        })
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

// 10. Chuyển Tab Admin Mobile
window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(d => d.classList.add('hidden'));
    const targetTab = document.getElementById(tab);
    if (targetTab) targetTab.classList.remove('hidden');

    const titles = { 
        'dashboardTab': 'Tổng Quan Dashboard', 
        'kpiTab': 'Duyệt & Chấm KPI', 
        'taskTab': 'Quản Lý Công Việc', 
        'reportTab': 'Báo Cáo Hiệu Suất' 
        };
    if (document.getElementById('headerTitle')) {
        document.getElementById('headerTitle').textContent = titles[tab] || 'Quản Trị';
    }

    document.querySelectorAll('.nav-btn').forEach(b => {
        b.className = "nav-btn flex flex-col items-center text-slate-400 hover:text-slate-600 transition py-1 group";
        const iconDiv = b.querySelector('div');
        if (iconDiv) iconDiv.className = "w-8 h-8 rounded-xl flex items-center justify-center transition mb-0.5";
    });

    const activeBtn = document.getElementById('nav_' + tab);
    if (activeBtn) {
        activeBtn.className = "nav-btn flex flex-col items-center text-emerald-600 transition py-1 group";
        const activeIconDiv = activeBtn.querySelector('div');
        if (activeIconDiv) activeIconDiv.className = "w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-50 transition mb-0.5";
    }
};

window.toggleReviewBox = (id) => {
    const box = document.getElementById(`reviewBox_${id}`);
    if (box) {
        box.classList.toggle('hidden');
    }
};

window.toggleFilterBox = () => {
    const filterBox = document.getElementById('filterContainer');
    if (filterBox) {
        filterBox.classList.toggle('hidden');
    }
};
// 2. Cập nhật hàm render danh sách có tích hợp hiển thị thông tin thanh toán
function renderAdminMasterTaskList(entries) {
    const container = document.getElementById('adminMasterTaskList');
    const badge = document.getElementById('adminTotalTasksBadge');
    if (!container) return;
    container.innerHTML = '';

    if (badge) badge.textContent = `${entries.length} CV`;

    if (entries.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-2xl border">Chưa có công việc nào.</p>';
        return;
    }

    entries.forEach(([id, item]) => {
        let statusColor = 'bg-amber-100 text-amber-800';
        if (item.tinhTrang === 'Đang thực hiện') statusColor = 'bg-blue-100 text-blue-800';
        if (item.tinhTrang === 'Đã hoàn thành') statusColor = 'bg-emerald-100 text-emerald-800';
        if (item.tinhTrang === 'Tạm ngưng') statusColor = 'bg-rose-100 text-rose-800';

        let supportHtml = item.ktHoTro ? ` + ${item.ktHoTro}` : '';

        const formatTime = (timeStr) => {
            if (!timeStr) return '<span class="text-slate-400 italic">Chưa cập nhật</span>';
            return timeStr.replace('T', ' ').substring(0, 16);
        };

        // Tính toán tổng thời gian hoàn thành thực tế
        let totalMinutes = 0;
        if (item.thoiGianBatDau && item.thoiGianKetThuc) {
            const startMs = new Date(item.thoiGianBatDau).getTime();
            const endMs = new Date(item.thoiGianKetThuc).getTime();
            totalMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
        } else if (item.thoiGian) {
            totalMinutes = Number(item.thoiGian) || 0;
        }

        let timeDisplayStr = `${totalMinutes}p`;
        if (totalMinutes >= 60) {
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            timeDisplayStr = mins > 0 ? `${hours}h ${mins}p` : `${hours}h`;
        }

        // Xác định Badge Icon hình thức xử lý (Tính phí, Bảo hành, Hỗ trợ) nằm ở bên phải
        let modeBadgeHtml = '';
        const hinhThuc = item.hinhThucThanhToan || item.hinhThucXuLy || '';
        
        if (item.tinhTrang === 'Đã hoàn thành') {
            if (hinhThuc.toLowerCase().includes('bảo hành') || item.chiPhi === 0) {
                modeBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1 shadow-xs"><i class="fa-solid fa-shield-halved"></i> Bảo hành</span>`;
            } else if (hinhThuc.toLowerCase().includes('hỗ trợ')) {
                modeBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 shadow-xs"><i class="fa-solid fa-handshake-angle"></i> Hỗ trợ</span>`;
            } else {
                const soTienStr = item.soTienThanhToan ? ` • ${Number(item.soTienThanhToan).toLocaleString()}đ` : '';
                modeBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shadow-xs"><i class="fa-solid fa-file-invoice-dollar"></i> Có phí${soTienStr}</span>`;
            }
        }

        // Tổng hợp lịch sử tăng ca (nếu có)
        let tangCaHtml = '';
        if (item.tangCaList && item.tangCaList.length > 0) {
            item.tangCaList.forEach((ses, idx) => {
                tangCaHtml += `
                    <div class="bg-white p-2.5 rounded-xl border border-amber-100 space-y-1 text-[11px]">
                        <div class="font-bold text-amber-900">Phiên tăng ca #${idx + 1} (Dự kiến: ${ses.thoiGianDuKien || 0} phút)</div>
                        <div>Lý do: ${ses.lyDo || 'Không có'}</div>
                        <div class="text-slate-500">Bắt đầu: ${formatTime(ses.batDau)}</div>
                        <div class="text-slate-500">Kết thúc: ${formatTime(ses.ketThuc)}</div>
                    </div>`;
            });
        } else {
            tangCaHtml = `<div class="text-slate-400 italic text-[11px]">Không có lịch sử tăng ca</div>`;
        }

        container.innerHTML += `
            <!-- Thẻ công việc chính -->
            <div class="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-2.5 transition">
                <div class="flex justify-between items-start gap-2">
                    <div onclick="window.toggleMobileRowDetail('${id}')" class="cursor-pointer flex-1">
                        <span class="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">${item.maCv || 'N/A'}</span>
                        <h4 class="font-black text-slate-800 text-sm mt-1">${item.khachHang || 'Khách hàng'}</h4>
                    </div>
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black ${statusColor} shrink-0">${item.tinhTrang || 'Chờ triển khai'}</span>
                </div>

                <p onclick="window.toggleMobileRowDetail('${id}')" class="text-xs text-slate-600 line-clamp-2 font-medium cursor-pointer">${item.noiDung || ''}</p>

                <!-- Thông tin phụ trách -->
                <div class="text-[11px] text-slate-500 pt-1 border-t border-slate-100" onclick="window.toggleMobileRowDetail('${id}')">
                    Phụ trách: <strong class="text-slate-700">${item.ktPhuTrach || 'Chưa phân công'}${supportHtml}</strong>
                </div>

                <!-- DÒNG CUỐI: Tổng thời gian (trái) & Badge phí/bảo hành (phải) & Mũi tên mở rộng -->
                <div class="flex justify-between items-center pt-1.5 cursor-pointer" onclick="window.toggleMobileRowDetail('${id}')">
                    <!-- Góc trái: Tổng thời gian hoàn thành -->
                    <div>
                        ${item.tinhTrang === 'Đã hoàn thành' ? `
                            <span class="bg-emerald-50 text-emerald-700 font-black px-2.5 py-1 rounded-xl border border-emerald-200 flex items-center gap-1 text-[11px]">
                                <i class="fa-solid fa-clock-rotate-left"></i> TG: ${timeDisplayStr}
                            </span>` : '<span class="text-[10px] text-slate-400 italic">Chưa xong</span>'
                        }
                    </div>

                    <!-- Góc phải: Badge thu phí/bảo hành và icon mũi tên mở rộng -->
                    <div class="flex items-center gap-2">
                        ${modeBadgeHtml}
                        <button class="bg-slate-100 hover:bg-slate-200 text-slate-600 w-7 h-7 rounded-xl font-bold transition flex items-center justify-center" title="Xem chi tiết">
                            <i class="fa-solid fa-chevron-down text-[10px]"></i>
                        </button>
                    </div>
                </div>

                <!-- PHẦN CHI TIẾT MỞ RỘNG (Đã chuyển nút Sửa/Xóa vào đây) -->
                <div id="mobile_detail_${id}" class="hidden space-y-3 pt-3 mt-2 border-t border-slate-100 text-xs text-slate-700" onclick="event.stopPropagation()">
                    
                    <!-- Nút thao tác Sửa / Xóa đưa vào trong phần mở rộng -->
                    <div class="flex gap-2 pb-1">
                        <button onclick="window.openEditAdminTaskModal('${id}')" class="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-xs">
                            <i class="fa-solid fa-pen"></i> Sửa Công Việc
                        </button>
                        <button onclick="window.deleteAdminTask('${id}')" class="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-xs">
                            <i class="fa-solid fa-trash"></i> Xóa Công Việc
                        </button>
                    </div>

                    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/60 space-y-1.5">
                        <div class="font-extrabold text-slate-800 border-b pb-1 mb-1 flex items-center gap-1.5">
                            <i class="fa-solid fa-circle-info text-emerald-600"></i> Thông Tin Chi Tiết
                        </div>
                        <div><strong>SĐT:</strong> <a href="tel:${item.dienThoai}" class="text-blue-600 font-bold">${item.dienThoai || 'N/A'}</a></div>
                        <div><strong>Loại CV:</strong> <span class="text-blue-600 font-bold">${item.loaiCv || 'N/A'}</span></div>
                        <div><strong>Ưu tiên:</strong> ${item.uuTien || 'N/A'}</div>
                        <div><strong>Deadline:</strong> <span class="text-rose-600 font-bold">${item.deadline ? formatTime(item.deadline) : 'N/A'}</span></div>
                        <div><strong>Ghi chú:</strong> ${item.ghiChu || 'Không có'}</div>
                    </div>

                    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/60 space-y-1.5">
                        <div class="font-extrabold text-slate-800 border-b pb-1 mb-1 flex items-center gap-1.5">
                            <i class="fa-solid fa-user-gear text-emerald-600"></i> Phân Công Nhân Sự
                        </div>
                        <div><strong>Phụ trách chính:</strong> ${item.ktPhuTrach || 'N/A'}</div>
                        <div><strong>Kỹ thuật hỗ trợ:</strong> ${item.ktHoTro || 'Không có'}</div>
                        <div><strong>Người tạo:</strong> ${item.nguoiTao || 'N/A'}</div>
                    </div>

                    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/60 space-y-1.5">
                        <div class="font-extrabold text-slate-800 border-b pb-1 mb-1 flex items-center gap-1.5">
                            <i class="fa-solid fa-location-crosshairs text-emerald-600"></i> Thời Gian & GPS
                        </div>
                        <div><strong>Bắt đầu:</strong> ${formatTime(item.thoiGianBatDau)}</div>
                        <div><strong>Kết thúc:</strong> ${formatTime(item.thoiGianKetThuc)}</div>
                        <div><strong>GPS Thực hiện:</strong> ${item.gpsThucHien ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.gpsThucHien)}" target="_blank" class="text-blue-600 underline font-bold">${item.gpsThucHien}</a>` : 'Chưa có'}</div>
                    </div>

                    <div class="bg-amber-50/50 p-3 rounded-xl border border-amber-200 space-y-2">
                        <div class="font-extrabold text-amber-900 border-b border-amber-200 pb-1 flex items-center gap-1.5">
                            <i class="fa-solid fa-business-time text-amber-600"></i> Nhật Ký Tăng Ca
                        </div>
                        ${tangCaHtml}
                    </div>
                </div>
            </div>`;
    });
}
// Đổ danh sách kỹ thuật vào các select box trong modal quản lý
function updateStaffSelectOptions(selectedPhuTrach = '', selectedHoTro = '') {
    onValue(ref(db, 'staffs'), (s) => {
        const phuTrachEl = document.getElementById('adminTaskKtPhuTrach');
        const hoTroEl = document.getElementById('adminTaskKtHoTro');
        if (!phuTrachEl || !hoTroEl) return;

        let options = '<option value="">-- Chọn kỹ thuật --</option>';
        let supportOptions = '<option value="">-- Không có hỗ trợ --</option>';

        if (s.exists()) {
            Object.values(s.val()).forEach(st => {
                options += `<option value="${st.name}">${st.name}</option>`;
                supportOptions += `<option value="${st.name}">${st.name}</option>`;
            });
        }

        phuTrachEl.innerHTML = options;
        hoTroEl.innerHTML = supportOptions;

        if (selectedPhuTrach) phuTrachEl.value = selectedPhuTrach;
        if (selectedHoTro) hoTroEl.value = selectedHoTro;
    }, { onlyOnce: true });
}

window.openAdminTaskModal = () => {
    document.getElementById('adminModalTaskId').value = '';
    document.getElementById('adminTaskModalTitle').innerHTML = '<i class="fa-solid fa-list-check text-emerald-600"></i> Tạo Mới Công Việc';
    document.getElementById('adminTaskForm').reset();
    
    // 👉 Lấy mốc thời gian hiện tại chuẩn định dạng datetime-local (YYYY-MM-DDTHH:mm)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

    // Gán thời gian tạo mặc định bằng hiện tại
    document.getElementById('adminTaskNgayTao').value = currentDateTime;
    
    // Sinh mã CV tự động
    document.getElementById('adminTaskMaCv').value = 'CV-' + Date.now().toString().slice(-4);

    // 👉 Tự động đặt Deadline cộng thêm 2 giờ so với thời điểm hiện tại
    window.updateAdminDeadlineAutomatically();

    updateStaffSelectOptions();
    document.getElementById('adminTaskModal').classList.remove('hidden');
};
// Hàm tự động cập nhật Deadline cộng thêm 2 giờ dựa trên Ngày giờ tạo được chọn
window.updateAdminDeadlineAutomatically = () => {
    const ngayTaoInput = document.getElementById('adminTaskNgayTao');
    const deadlineInput = document.getElementById('adminTaskDeadline');
    
    if (!ngayTaoInput || !deadlineInput || !ngayTaoInput.value) return;

    // Lấy thời gian từ ô Ngày tạo người dùng vừa chọn
    const selectedDate = new Date(ngayTaoInput.value);
    if (isNaN(selectedDate.getTime())) return;

    // Cộng thêm 2 giờ
    const deadlineTime = new Date(selectedDate.getTime() + 2 * 60 * 60 * 1000);
    
    const dYear = deadlineTime.getFullYear();
    const dMonth = String(deadlineTime.getMonth() + 1).padStart(2, '0');
    const dDay = String(deadlineTime.getDate()).padStart(2, '0');
    const dHours = String(deadlineTime.getHours()).padStart(2, '0');
    const dMinutes = String(deadlineTime.getMinutes()).padStart(2, '0');

    // Gán lại giá trị tự động cho ô Deadline
    deadlineInput.value = `${dYear}-${dMonth}-${dDay}T${dHours}:${dMinutes}`;
};
window.openEditAdminTaskModal = (id) => {
    const task = allManagementTasks[id];
    if (!task) return;

    document.getElementById('adminModalTaskId').value = id;
    document.getElementById('adminTaskModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square text-emerald-600"></i> Sửa Thông Tin Công Việc';
    document.getElementById('adminTaskNgayTao').value = task.ngayTao || '';
    document.getElementById('adminTaskMaCv').value = task.maCv || '';
    document.getElementById('adminTaskTinhTrang').value = task.tinhTrang || 'Chờ triển khai';
    document.getElementById('adminTaskKhachHang').value = task.khachHang || '';
    document.getElementById('adminTaskDienThoai').value = task.dienThoai || '';
    document.getElementById('adminTaskLoaiCv').value = task.loaiCv || 'Bảo trì';
    document.getElementById('adminTaskUuTien').value = task.uuTien || 'Thường';
    document.getElementById('adminTaskNoiDung').value = task.noiDung || '';
    document.getElementById('adminTaskDeadline').value = task.deadline || '';
    document.getElementById('adminTaskGhiChu').value = task.ghiChu || '';

    updateStaffSelectOptions(task.ktPhuTrach, task.ktHoTro);
    document.getElementById('adminTaskModal').classList.remove('hidden');
};

window.closeAdminTaskModal = () => {
    document.getElementById('adminTaskModal').classList.add('hidden');
};

window.saveAdminTask = (e) => {
    e.preventDefault();
    const id = document.getElementById('adminModalTaskId').value;
    const existingTask = (id && allManagementTasks[id]) ? allManagementTasks[id] : {};

    const ngayTaoVal = document.getElementById('adminTaskNgayTao').value;
    // 👉 Lấy mốc timestamp chính xác từ thời gian tạo/thực hiện công việc do Admin chọn trên form (tránh bị lỗi treo việc khi tạo việc cho ngày tương lai)
    const ngayTaoTimestampVal = ngayTaoVal ? new Date(ngayTaoVal).getTime() : Date.now();

    const taskData = {
        ngayTao: ngayTaoVal,
        ngayTaoTimestamp: ngayTaoTimestampVal, // 👉 Gán mốc timestamp chuẩn
        maCv: document.getElementById('adminTaskMaCv').value.trim(),
        tinhTrang: document.getElementById('adminTaskTinhTrang').value,
        khachHang: document.getElementById('adminTaskKhachHang').value.trim(),
        dienThoai: document.getElementById('adminTaskDienThoai').value.trim(),
        loaiCv: document.getElementById('adminTaskLoaiCv').value,
        uuTien: document.getElementById('adminTaskUuTien').value,
        noiDung: document.getElementById('adminTaskNoiDung').value.trim(),
        ktPhuTrach: document.getElementById('adminTaskKtPhuTrach').value,
        ktHoTro: document.getElementById('adminTaskKtHoTro').value,
        deadline: document.getElementById('adminTaskDeadline').value,
        ghiChu: document.getElementById('adminTaskGhiChu').value.trim(),
        
        // Giữ lại các trường thời gian & GPS ẩn nếu đang ở chế độ sửa
        thoiGianBatDau: existingTask.thoiGianBatDau || '',
        thoiGianKetThuc: existingTask.thoiGianKetThuc || '',
        gpsThucHien: existingTask.gpsThucHien || '',
        gpsHoanThanh: existingTask.gpsHoanThanh || ''
    };

    if (id) {
        update(ref(db, `managementTasks/${id}`), taskData)
            .then(() => {
                alert("Cập nhật công việc thành công!");
                window.closeAdminTaskModal();
            })
            .catch(err => alert("Lỗi: " + err.message));
    } else {
        taskData.chupAnh = false;
        taskData.danhGiaMaps = false;
        taskData.coTuVanBanHang = false;
        taskData.noiDungTuVan = '';
        taskData.nguoiTao = 'Admin Mobile';
        taskData.alertCount = 0;
        taskData.lastAlertTime = null;

        push(ref(db, 'managementTasks'), taskData)
            .then(() => {
                alert("Tạo công việc mới thành công!");
                window.closeAdminTaskModal();
                
                // 👉 Kích hoạt gửi thông báo tới kỹ thuật phụ trách & hỗ trợ qua Telegram
                sendAdminMobileTelegramNotification(taskData);
            })
            .catch(err => alert("Lỗi: " + err.message));
    }
};

// 👉 Thêm hàm hỗ trợ gửi thông báo Telegram từ Admin Mobile
async function sendAdminMobileTelegramNotification(taskData) {
    try {
        const snapshot = await get(ref(db, 'settings/telegram'));
        if (!snapshot.exists()) return;
        const config = snapshot.val();
        if (!config.botToken) return;

        // Kiểm tra xem có bật tính năng thông báo khi tạo mới không
        if (!config.notifOnCreate) return;

        let chatIdsToSend = [];
        if (config.adminChatId) chatIdsToSend.push(config.adminChatId);

        // Lấy danh sách Telegram ID của kỹ thuật viên từ nhánh 'staffs'
        const staffSnapshot = await get(ref(db, 'staffs'));
        if (staffSnapshot.exists()) {
            const staffList = Object.values(staffSnapshot.val());
            
            // Tìm kỹ thuật phụ trách chính
            const matchedStaff = staffList.find(s => s.name === taskData.ktPhuTrach);
            if (matchedStaff && matchedStaff.telegramId) {
                chatIdsToSend.push(matchedStaff.telegramId);
            }

            // Tìm kỹ thuật hỗ trợ (nếu có chọn)
            if (taskData.ktHoTro && taskData.ktHoTro !== "") {
                const supportStaff = staffList.find(s => s.name === taskData.ktHoTro);
                if (supportStaff && supportStaff.telegramId) {
                    chatIdsToSend.push(supportStaff.telegramId);
                }
            }
        }

        let staffLine = `🛠️ *Kỹ thuật phụ trách:* ${taskData.ktPhuTrach || 'N/A'}`;
        if (taskData.ktHoTro && taskData.ktHoTro !== "") {
            staffLine += ` + ${taskData.ktHoTro} (Hỗ trợ)`;
        }

        const message = encodeURIComponent(
            `✨ *[THÔNG BÁO CÔNG VIỆC MỚI]* ✨\n\n` +
            `📋 *Mã CV:* ${taskData.maCv || 'N/A'}\n` +
            `👤 *Khách hàng:* ${taskData.khachHang || 'N/A'}\n` +
            `${staffLine}\n` +
            `📝 *Nội dung:* ${taskData.noiDung || 'N/A'}\n` +
            `⏳ *Deadline:* ${taskData.deadline ? taskData.deadline.replace('T', ' ') : 'N/A'}\n` +
            `🕒 *Thời gian tạo:* ${new Date().toLocaleString('vi-VN')}`
        );

        // Loại bỏ các ID trùng lặp và gửi tin nhắn
        const uniqueChatIds = [...new Set(chatIdsToSend)];
        for (const chatId of uniqueChatIds) {
            const url = `https://api.telegram.org/bot${config.botToken}/sendMessage?chat_id=${chatId}&text=${message}&parse_mode=Markdown`;
            fetch(url).catch(err => console.error("Lỗi gửi Telegram:", err));
        }
    } catch (error) {
        console.error("Lỗi hệ thống thông báo Telegram:", error);
    }
}

window.deleteAdminTask = (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa công việc này?")) {
        remove(ref(db, `managementTasks/${id}`))
            .then(() => alert("Đã xóa công việc thành công!"))
            .catch(err => alert("Lỗi: " + err.message));
    }
};
// Render danh sách công việc trên trang adminmobile.html
function renderAdminMobileTasks(tasksArray) {
    const container = document.getElementById('adminMobileTaskList'); // Thay thế bằng ID container chứa danh sách công việc của bạn
    if (!container) return;
    container.innerHTML = '';

    if (tasksArray.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-2xl border">Chưa có công việc nào.</p>';
        return;
    }

    tasksArray.forEach(([id, task]) => {
        let statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
        if (task.tinhTrang === 'Đang thực hiện') statusColor = 'bg-blue-50 text-blue-700 border-blue-200';
        if (task.tinhTrang === 'Đã hoàn thành') statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (task.tinhTrang === 'Tạm ngưng') statusColor = 'bg-rose-50 text-rose-700 border-rose-200';

        const formatTime = (timeStr) => {
            if (!timeStr) return '<span class="text-slate-400 italic">Chưa cập nhật</span>';
            return timeStr.replace('T', ' ').substring(0, 16);
        };

        // Tổng hợp lịch sử tăng ca (nếu có)
        let tangCaHtml = '';
        if (task.tangCaList && task.tangCaList.length > 0) {
            task.tangCaList.forEach((ses, idx) => {
                tangCaHtml += `
                    <div class="bg-white p-2.5 rounded-xl border border-amber-100 space-y-1 text-[11px]">
                        <div class="font-bold text-amber-900">Phiên tăng ca #${idx + 1} (Dự kiến: ${ses.thoiGianDuKien || 0} phút)</div>
                        <div>Lý do: ${ses.lyDo || 'Không có'}</div>
                        <div class="text-slate-500">Bắt đầu: ${formatTime(ses.batDau)}</div>
                        <div class="text-slate-500">Kết thúc: ${formatTime(ses.ketThuc)}</div>
                    </div>`;
            });
        } else {
            tangCaHtml = `<div class="text-slate-400 italic text-[11px]">Không có lịch sử tăng ca</div>`;
        }

        container.innerHTML += `
            <!-- Thẻ công việc chính (Bấm vào để mở rộng chi tiết) -->
            <div onclick="window.toggleMobileRowDetail('${id}')" class="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-2 cursor-pointer hover:border-emerald-300 transition">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">${task.maCv || 'N/A'}</span>
                        <h4 class="font-black text-slate-800 text-sm mt-1">${task.khachHang || 'Khách hàng'}</h4>
                    </div>
                    <span class="px-2.5 py-0.5 border rounded-full font-bold text-[10px] ${statusColor}">${task.tinhTrang || 'Chờ triển khai'}</span>
                </div>

                <p class="text-xs text-slate-600 line-clamp-2 font-medium">${task.noiDung || ''}</p>

                <div class="flex justify-between items-center text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                    <span>Phụ trách: <strong class="text-slate-700">${task.ktPhuTrach || 'Chưa phân công'}</strong></span>
                    <span class="text-emerald-600 font-bold flex items-center gap-1"><i class="fa-solid fa-chevron-down text-[9px]"></i> Bấm để xem chi tiết</span>
                </div>

                <!-- PHẦN CHI TIẾT MỞ RỘNG (ACCORDION DETAILS - ẨN MẶC ĐỊNH) -->
                <div id="mobile_detail_${id}" class="hidden space-y-3 pt-3 mt-2 border-t border-slate-100 text-xs text-slate-700" onclick="event.stopPropagation()">
                    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/60 space-y-1.5">
                        <div class="font-extrabold text-slate-800 border-b pb-1 mb-1 flex items-center gap-1.5">
                            <i class="fa-solid fa-circle-info text-emerald-600"></i> Thông Tin Chi Tiết
                        </div>
                        <div><strong>SĐT:</strong> <a href="tel:${task.dienThoai}" class="text-blue-600 font-bold">${task.dienThoai || 'N/A'}</a></div>
                        <div><strong>Loại CV:</strong> <span class="text-blue-600 font-bold">${task.loaiCv || 'N/A'}</span></div>
                        <div><strong>Ưu tiên:</strong> ${task.uuTien || 'N/A'}</div>
                        <div><strong>Deadline:</strong> <span class="text-rose-600 font-bold">${task.deadline ? formatTime(task.deadline) : 'N/A'}</span></div>
                        <div><strong>Ghi chú:</strong> ${task.ghiChu || 'Không có'}</div>
                    </div>

                    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/60 space-y-1.5">
                        <div class="font-extrabold text-slate-800 border-b pb-1 mb-1 flex items-center gap-1.5">
                            <i class="fa-solid fa-user-gear text-emerald-600"></i> Phân Công Nhân Sự
                        </div>
                        <div><strong>Phụ trách chính:</strong> ${task.ktPhuTrach || 'N/A'}</div>
                        <div><strong>Kỹ thuật hỗ trợ:</strong> ${task.ktHoTro || 'Không có'}</div>
                        <div><strong>Người tạo:</strong> ${task.nguoiTao || 'N/A'}</div>
                    </div>

                    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/60 space-y-1.5">
                        <div class="font-extrabold text-slate-800 border-b pb-1 mb-1 flex items-center gap-1.5">
                            <i class="fa-solid fa-location-crosshairs text-emerald-600"></i> Thời Gian & GPS
                        </div>
                        <div><strong>Bắt đầu:</strong> ${formatTime(task.thoiGianBatDau)}</div>
                        <div><strong>Kết thúc:</strong> ${formatTime(task.thoiGianKetThuc)}</div>
                        <div><strong>GPS Thực hiện:</strong> ${task.gpsThucHien ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.gpsThucHien)}" target="_blank" class="text-blue-600 underline font-bold">${task.gpsThucHien}</a>` : 'Chưa có'}</div>
                    </div>

                    <div class="bg-amber-50/50 p-3 rounded-xl border border-amber-200 space-y-2">
                        <div class="font-extrabold text-amber-900 border-b border-amber-200 pb-1 flex items-center gap-1.5">
                            <i class="fa-solid fa-business-time text-amber-600"></i> Nhật Ký Tăng Ca
                        </div>
                        ${tangCaHtml}
                    </div>

                    <!-- Nút thao tác nhanh trên mobile -->
                    <div class="flex gap-2 pt-2">
                        <button onclick="window.openTaskModal('${id}')" class="flex-1 bg-blue-50 text-blue-600 py-2 rounded-xl font-bold hover:bg-blue-100 transition flex items-center justify-center gap-1">
                            <i class="fa-solid fa-pen"></i> Sửa CV
                        </button>
                        <button onclick="window.deleteTask('${id}')" class="flex-1 bg-rose-50 text-rose-600 py-2 rounded-xl font-bold hover:bg-rose-100 transition flex items-center justify-center gap-1">
                            <i class="fa-solid fa-trash"></i> Xóa CV
                        </button>
                    </div>
                </div>
            </div>`;
    });
}
// Hàm bật/tắt hiển thị chi tiết công việc trên mobile
window.toggleMobileRowDetail = (id) => {
    const detailDiv = document.getElementById(`mobile_detail_${id}`);
    if (detailDiv) {
        detailDiv.classList.toggle('hidden');
    }
};
// ================= HỆ THỐNG GỢI Ý & LƯU TRỮ KHÁCH HÀNG TỰ ĐỘNG =================
let allAdminCustomersData = {};

// Thu thập khách hàng tự động từ tất cả công việc có sẵn
function collectAdminCustomersFromTasks(tasks) {
    const uniqueCustomers = {};
    Object.values(tasks).forEach(task => {
        if (task.khachHang) {
            const nameKey = task.khachHang.trim();
            if (!uniqueCustomers[nameKey]) {
                uniqueCustomers[nameKey] = {
                    name: nameKey,
                    phone: task.dienThoai || '',
                    count: 0
                };
            }
            uniqueCustomers[nameKey].count++;
            if (task.dienThoai && !uniqueCustomers[nameKey].phone) {
                uniqueCustomers[nameKey].phone = task.dienThoai;
            }
        }
    });
    allAdminCustomersData = uniqueCustomers;
}

// Lọc danh sách gợi ý khi người dùng gõ vào ô nhập tên khách hàng
window.filterAdminCustomerSuggestions = (keyword) => {
    const dropdown = document.getElementById('adminCustomerDropdownList');
    if (!dropdown) return;

    const term = keyword.toLowerCase().trim();
    if (!term) {
        dropdown.classList.add('hidden');
        return;
    }

    // Quét toàn bộ các công việc từ biến toàn cục allManagementTasks
    const customerMap = new Map();
    if (typeof allManagementTasks !== 'undefined' && allManagementTasks) {
        Object.values(allManagementTasks).forEach(task => {
            if (task.khachHang) {
                customerMap.set(task.khachHang.trim(), task.dienThoai || '');
            }
        });
    }

    // Lọc theo từ khóa gõ vào
    const matches = Array.from(customerMap.entries()).filter(([name, phone]) => {
        return name.toLowerCase().includes(term) || (phone && phone.includes(term));
    });

    if (matches.length > 0) {
        dropdown.innerHTML = '';
        matches.forEach(([name, phone]) => {
            const div = document.createElement('div');
            div.className = 'p-2.5 hover:bg-emerald-50 cursor-pointer text-xs font-medium text-slate-700 flex justify-between items-center';
            div.innerHTML = `<span><strong>${name}</strong></span> <span class="text-[10px] text-slate-400">${phone || ''}</span>`;
            
            // Khi bấm chọn khách hàng, tự động điền tên và số điện thoại
            div.onclick = () => {
                document.getElementById('adminTaskKhachHang').value = name;
                const phoneInput = document.getElementById('adminTaskDienThoai');
                if (phoneInput && phone) {
                    phoneInput.value = phone;
                }
                dropdown.classList.add('hidden');
            };
            dropdown.appendChild(div);
        });
        dropdown.classList.remove('hidden');
    } else {
        dropdown.classList.add('hidden');
    }
};

// Ẩn khung gợi ý khi click ra bên ngoài form
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('adminCustomerDropdownList');
    const input = document.getElementById('adminTaskKhachHang');
    if (dropdown && input && !input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});
// ================= KIỂM TRA & CẬP NHẬT PHIÊN BẢN (PWA) =================
window.checkForAppUpdates = () => {
    const updateIcon = document.getElementById('updateIcon');
    if (updateIcon) updateIcon.classList.add('animate-spin');

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((registration) => {
            if (!registration) {
                alert("Ứng dụng chưa được đăng ký Service Worker.");
                if (updateIcon) updateIcon.classList.remove('animate-spin');
                return;
            }

            // Ép Service Worker kiểm tra xem trên server có bản code mới hay không
            registration.update().then(() => {
                setTimeout(() => {
                    if (updateIcon) updateIcon.classList.remove('animate-spin');
                    
                    // Nếu phát hiện có phiên bản mới đang chờ kích hoạt
                    if (registration.waiting) {
                        if (confirm("Đã có phiên bản mới của ứng dụng! Bạn có muốn cập nhật và tải lại ngay bây giờ không?")) {
                            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                            window.location.reload();
                        }
                    } else {
                        alert("Ứng dụng của bạn đang ở phiên bản mới nhất!");
                    }
                }, 1000);
            }).catch((err) => {
                if (updateIcon) updateIcon.classList.remove('animate-spin');
                alert("Không thể kiểm tra cập nhật lúc này (kiểm tra lại kết nối mạng).");
            });
        });
    } else {
        alert("Trình duyệt không hỗ trợ tính năng cập nhật này.");
    }
};
// ================= HÀM TÍNH TOÁN & XẾP HẠNG HIỆU SUẤT KỸ THUẬT =================
function renderPerformanceReport(entries) {
    const container = document.getElementById('performanceReportList');
    if (!container) return;
    container.innerHTML = '';

    const staffStats = {};
    const maxScore = 10; // Đặt giá trị chuẩn tối đa cho biểu đồ thanh

    entries.forEach(([id, item]) => {
        const kt = item.ktPhuTrach || 'Chưa phân công';
        if (!staffStats[kt]) {
            staffStats[kt] = {
                totalTasks: 0,
                completedTasks: 0,
                onTimeTasks: 0,
                hasImages: 0,
                hasMaps: 0,
                hasConsulting: 0,
                totalScore: 0
            };
        }

        const stat = staffStats[kt];
        stat.totalTasks++;

        if (item.tinhTrang === 'Đã hoàn thành') {
            stat.completedTasks++;
            
            // 1. Kiểm tra đúng hạn (Deadline >= Thời gian kết thúc)
            if (item.deadline && item.thoiGianKetThuc) {
                if (new Date(item.thoiGianKetThuc) <= new Date(item.deadline)) {
                    stat.onTimeTasks++;
                }
            } else {
                stat.onTimeTasks++; // Mặc định nếu không có deadline khắt khe
            }

            // 2. Tiêu chí hình ảnh
            if (item.chupAnh) stat.hasImages++;

            // 3. Tiêu chí đánh giá Maps
            if (item.danhGiaMaps) stat.hasMaps++;

            // 4. Tiêu chí tư vấn bán hàng
            if (item.coTuVanBanHang) stat.hasConsulting++;

            // 5. Điểm KPI tích lũy từ Admin
            stat.totalScore += Number(item.diemKpi) || 0;
        }
    });

    if (Object.keys(staffStats).length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Chưa có dữ liệu hiệu suất để đánh giá.</p>';
        return;
    }

    // --- PHẦN 1: VẼ BIỂU ĐỒ TỔNG QUAN SO SÁNH CÁC KỸ THUẬT ---
    let chartHtml = `
        <div class="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl shadow-md space-y-3 mb-4">
            <div class="flex justify-between items-center border-b border-slate-700 pb-2">
                <span class="font-extrabold text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <i class="fa-solid fa-chart-column"></i> Biểu Đồ So Sánh Hiệu Suất Kỹ Thuật
                </span>
                <span class="text-[10px] text-slate-400">Thang điểm 10</span>
            </div>
            <div class="space-y-2.5 pt-1">
    `;

    const processedStaffs = Object.entries(staffStats).map(([name, data]) => {
        const completionRate = data.totalTasks > 0 ? (data.completedTasks / data.totalTasks) : 0;
        const onTimeRate = data.completedTasks > 0 ? (data.onTimeTasks / data.completedTasks) : 0;
        const imageRate = data.completedTasks > 0 ? (data.hasImages / data.completedTasks) : 0;
        const mapsRate = data.completedTasks > 0 ? (data.hasMaps / data.completedTasks) : 0;

        let score = ((onTimeRate * 0.4) + (completionRate * 0.3) + (imageRate * 0.15) + (mapsRate * 0.15)) * 10;
        return { name, score: Number(score.toFixed(1)), data };
    });

    // Sắp xếp theo điểm hiệu suất từ cao xuống thấp
    processedStaffs.sort((a, b) => b.score - a.score);

    processedStaffs.forEach(st => {
        const barWidth = Math.min(100, Math.max(10, (st.score / maxScore) * 100));
        chartHtml += `
            <div class="space-y-1">
                <div class="flex justify-between text-xs">
                    <span class="font-bold text-slate-200">${st.name}</span>
                    <span class="font-black text-emerald-400">${st.score} đ</span>
                </div>
                <div class="w-full bg-slate-700/80 h-3 rounded-full overflow-hidden p-0.5">
                    <div class="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-700" style="width: ${barWidth}%"></div>
                </div>
            </div>
        `;
    });

    chartHtml += `</div></div>`;

    // --- PHẦN 2: CHI TIẾT TỪNG NHÂN SỰ ---
    let detailsHtml = '';
    Object.entries(staffStats).forEach(([name, data]) => {
        const completionRate = data.totalTasks > 0 ? Math.round((data.completedTasks / data.totalTasks) * 100) : 0;
        const onTimeRate = data.completedTasks > 0 ? Math.round((data.onTimeTasks / data.completedTasks) * 100) : 0;
        const imageRate = data.completedTasks > 0 ? Math.round((data.hasImages / data.completedTasks) * 100) : 0;
        const mapsRate = data.completedTasks > 0 ? Math.round((data.hasMaps / data.completedTasks) * 100) : 0;

        let performanceScore = ((onTimeRate * 0.4) + (completionRate * 0.3) + (imageRate * 0.15) + (mapsRate * 0.15)) / 10;
        performanceScore = Math.min(10, Math.max(0, performanceScore)).toFixed(1);

        let badgeColor = 'bg-emerald-100 text-emerald-800';
        if (performanceScore < 7) badgeColor = 'bg-amber-100 text-amber-800';
        if (performanceScore < 5) badgeColor = 'bg-rose-100 text-rose-800';

        detailsHtml += `
            <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5 text-xs mb-3">
                <div class="flex justify-between items-center border-b pb-2">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-xs shadow-xs">
                            ${name.charAt(0)}
                        </div>
                        <span class="font-black text-slate-800 text-sm">${name}</span>
                    </div>
                    <span class="px-2.5 py-1 rounded-xl text-xs font-black ${badgeColor}">Hiệu suất: ${performanceScore}/10 đ</span>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div class="bg-white p-2 rounded-xl border border-slate-200/60 text-center">
                        <span class="text-slate-400 block text-[9px] uppercase font-bold">Hoàn Thành CV</span>
                        <strong class="text-slate-700 text-sm">${data.completedTasks}/${data.totalTasks}</strong> (${completionRate}%)
                    </div>
                    <div class="bg-white p-2 rounded-xl border border-slate-200/60 text-center">
                        <span class="text-slate-400 block text-[9px] uppercase font-bold">Đúng Hạn Sớm</span>
                        <strong class="text-emerald-600 text-sm">${onTimeRate}%</strong>
                    </div>
                    <div class="bg-white p-2 rounded-xl border border-slate-200/60 text-center">
                        <span class="text-slate-400 block text-[9px] uppercase font-bold">Chụp Ảnh / Maps</span>
                        <strong class="text-blue-600 text-sm">${data.hasImages} / ${data.hasMaps}</strong>
                    </div>
                    <div class="bg-white p-2 rounded-xl border border-slate-200/60 text-center">
                        <span class="text-slate-400 block text-[9px] uppercase font-bold">Tư Vấn Bán Hàng</span>
                        <strong class="text-indigo-600 text-sm">${data.hasConsulting} CV</strong>
                    </div>
                </div>
            </div>`;
    });

    // Gộp cả biểu đồ tổng quan và danh sách chi tiết vào container
    container.innerHTML = chartHtml + detailsHtml;
}
