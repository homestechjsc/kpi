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

    const entries = Object.entries(allManagementTasks).filter(([id, d]) => {
        const taskDate = d.ngayTao || (d.thoiGianKetThuc ? d.thoiGianKetThuc.split('T')[0] : "");
        if (!taskDate) return false;

        let matchMonth = currentMonth ? taskDate.startsWith(currentMonth) : true;
        let matchStaff = selectedStaff ? (d.ktPhuTrach === selectedStaff || d.ktHoTro === selectedStaff) : true;

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

    // Sắp xếp
    entries.sort((a, b) => {
        const aChamped = a[1].diemKpi !== undefined && a[1].diemKpi !== null && a[1].diemKpi !== "" && Number(a[1].diemKpi) > 0;
        const bChamped = b[1].diemKpi !== undefined && b[1].diemKpi !== null && b[1].diemKpi !== "" && Number(b[1].diemKpi) > 0;

        if (aChamped !== bChamped) {
            return aChamped ? 1 : -1;
        }
        return (b[1].ngayTao || '').localeCompare(a[1].ngayTao || '');
    });

    // 👉 Đảm bảo có đủ 3 hàm render này trong triggerDataLoad:
    renderKpiMobileList(entries);
    renderMobileReport(entries);
    renderDashboardMetrics(entries);
    renderAdminMasterTaskList(entries); // Dòng này dùng để đổ dữ liệu vào Tab Công Việc
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

// 8. Tính năng Dashboard Tổng quan
function renderDashboardMetrics(entries) {
    let choTrienKhai = 0;
    let dangThucHien = 0;
    let tamNgung = 0;
    let hoanThanh = 0;
    let totalScore = 0;
    let totalTime = 0;

    entries.forEach(([id, item]) => {
        const status = item.tinhTrang || 'Chờ triển khai';
        if (status === 'Chờ triển khai') choTrienKhai++;
        else if (status === 'Đang thực hiện') dangThucHien++;
        else if (status === 'Tạm ngưng') tamNgung++;
        else if (status === 'Đã hoàn thành') hoanThanh++;

        totalScore += Number(item.diemKpi) || 0;

        let calcTime = Number(item.thoiGian) || 0;
        if (item.thoiGianBatDau && item.thoiGianKetThuc) {
            const startMs = new Date(item.thoiGianBatDau).getTime();
            const endMs = new Date(item.thoiGianKetThuc).getTime();
            calcTime = Math.max(0, Math.round((endMs - startMs) / 60000));
        }
        totalTime += calcTime;
    });

    if (document.getElementById('dashChoTrienKhai')) document.getElementById('dashChoTrienKhai').textContent = choTrienKhai;
    if (document.getElementById('dashDangThucHien')) document.getElementById('dashDangThucHien').textContent = dangThucHien;
    if (document.getElementById('dashTamNgung')) document.getElementById('dashTamNgung').textContent = tamNgung;
    if (document.getElementById('dashHoanThanh')) document.getElementById('dashHoanThanh').textContent = hoanThanh;
    if (document.getElementById('dashTotalScore')) document.getElementById('dashTotalScore').textContent = totalScore;
    if (document.getElementById('dashTotalTime')) document.getElementById('dashTotalTime').textContent = `${totalTime}p`;
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

        container.innerHTML += `
            <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs space-y-2">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="font-black text-blue-600 text-sm">${item.maCv || 'CV'} - ${item.khachHang || ''}</span>
                        <div class="text-[10px] text-slate-400">Phụ trách: <strong class="text-slate-700">${item.ktPhuTrach || 'Chưa phân công'}${supportHtml}</strong></div>
                    </div>
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black ${statusColor}">${item.tinhTrang || 'Chờ triển khai'}</span>
                </div>
                <div class="text-slate-700 font-medium">${item.noiDung || ''}</div>
                <div class="flex justify-between items-center pt-2 border-t border-slate-200/60 text-[11px]">
                    <span class="text-slate-400">Ngày: ${item.ngayTao || ''}</span>
                    <div class="flex gap-2">
                        <button onclick="window.openEditAdminTaskModal('${id}')" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl font-bold hover:bg-blue-100 transition"><i class="fa-solid fa-pen mr-1"></i> Sửa</button>
                        <button onclick="window.deleteAdminTask('${id}')" class="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-xl font-bold hover:bg-rose-100 transition"><i class="fa-solid fa-trash mr-1"></i> Xóa</button>
                    </div>
                </div>
            </div>
        `;
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
    document.getElementById('adminTaskNgayTao').value = new Date().toISOString().split('T')[0];
    document.getElementById('adminTaskMaCv').value = 'CV-' + Date.now().toString().slice(-4);
    updateStaffSelectOptions();
    document.getElementById('adminTaskModal').classList.remove('hidden');
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

    const taskData = {
        ngayTao: document.getElementById('adminTaskNgayTao').value,
        maCv: document.getElementById('adminTaskMaCv').value,
        tinhTrang: document.getElementById('adminTaskTinhTrang').value,
        khachHang: document.getElementById('adminTaskKhachHang').value.trim(),
        dienThoai: document.getElementById('adminTaskDienThoai').value.trim(),
        loaiCv: document.getElementById('adminTaskLoaiCv').value,
        uuTien: document.getElementById('adminTaskUuTien').value,
        noiDung: document.getElementById('adminTaskNoiDung').value.trim(),
        ktPhuTrach: document.getElementById('adminTaskKtPhuTrach').value,
        ktHoTro: document.getElementById('adminTaskKtHoTro').value,
        deadline: document.getElementById('adminTaskDeadline').value,
        ghiChu: document.getElementById('adminTaskGhiChu').value.trim()
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
        taskData.nguoiTao = 'Admin';

        push(ref(db, 'managementTasks'), taskData)
            .then(() => {
                alert("Tạo công việc mới thành công!");
                window.closeAdminTaskModal();
            })
            .catch(err => alert("Lỗi: " + err.message));
    }
};

window.deleteAdminTask = (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa công việc này?")) {
        remove(ref(db, `managementTasks/${id}`))
            .then(() => alert("Đã xóa công việc thành công!"))
            .catch(err => alert("Lỗi: " + err.message));
    }
};