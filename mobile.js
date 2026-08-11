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
let currentUser = JSON.parse(localStorage.getItem('techUser')) || null;
const todayStr = new Date().toISOString().split('T')[0];
let allKpiList = {}; // Lưu trữ dữ liệu tạm thời để phục vụ tính năng sửa

document.getElementById('currentDateLabel').textContent = `Hôm nay, ngày ${todayStr.split('-').reverse().join('/')}`;

window.login = (e) => {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPassword').value.trim();

    onValue(ref(db, 'staffs'), (snapshot) => {
        if (!snapshot.exists()) { alert("Chưa có tài khoản nào!"); return; }
        let matchedUser = null;
        let matchedKey = null;

        snapshot.forEach((child) => {
            const val = child.val();
            if (val.username === u && val.password === p) {
                matchedUser = val;
                matchedKey = child.key; // Lấy chính xác ID key của nhân sự trên Firebase
            }
        });

        if (matchedUser) {
            matchedUser.firebaseId = matchedKey; // Lưu lại firebaseId chuẩn
            localStorage.setItem('techUser', JSON.stringify(matchedUser));
            currentUser = matchedUser;
            initApp();
        } else {
            alert("Sai tài khoản hoặc mật khẩu!");
        }
    }, { onlyOnce: true });
};

window.logout = () => { localStorage.removeItem('techUser'); location.reload(); };

function initApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('userNameDisplay').textContent = currentUser.name;
    document.getElementById('userRoleDisplay').textContent = currentUser.role || 'Kỹ thuật viên';
    loadTodayTasks();
}

// Modal Thêm Mới
window.openModal = () => {
    document.getElementById('ngayThucHien').value = todayStr;
    document.getElementById('taskModal').classList.remove('hidden');
};
window.closeModal = () => document.getElementById('taskModal').classList.add('hidden');

// Modal Sửa
window.closeEditModal = () => document.getElementById('editTaskModal').classList.add('hidden');

function loadTodayTasks() {
    onValue(ref(db, 'kpis'), (snapshot) => {
        const list = document.getElementById('todayTaskList');
        const badge = document.getElementById('todayCountBadge');
        if (!list) return;
        list.innerHTML = '';

        let todayTaskCount = 0;

        if (snapshot.exists()) {
            allKpiList = snapshot.val();
            const myTodayTasks = Object.entries(allKpiList).filter(([id, task]) => 
                task.ktPhuTrach === currentUser.name && task.ngayThucHien === todayStr
            );

            todayTaskCount = myTodayTasks.length;
            if (badge) badge.textContent = `${todayTaskCount} CV`;

            if (myTodayTasks.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 bg-white rounded-2xl border border-slate-200">Hôm nay bạn chưa có báo cáo công việc nào.</p>';
            } else {
                myTodayTasks.reverse().forEach(([id, task]) => {
                    // Lấy giá trị điểm KPI do quản lý chấm
                    const diemSo = task.diemKpi !== undefined && task.diemKpi !== null ? Number(task.diemKpi) : 0;
                    
                    // Tạo Badge hiển thị trạng thái và điểm KPI
                    let kpiBadgeHtml = '';
                    if (diemSo > 0) {
                        kpiBadgeHtml = `<span class="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1 shadow-sm"><i class="fa-solid fa-star text-amber-500"></i> Điểm KPI: ${diemSo}</span>`;
                    } else {
                        kpiBadgeHtml = `<span class="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><i class="fa-solid fa-clock"></i> Chờ Quản Lý Chấm KPIs</span>`;
                    }

                    // Khóa nút Sửa/Xóa nếu quản lý đã chấm điểm KPI (> 0)
                    const actionButtons = diemSo === 0 ? `
                        <div class="flex gap-2">
                            <button onclick="window.openEditModal('${id}')" class="text-blue-600 hover:text-blue-800 font-semibold px-2.5 py-1 rounded-lg bg-blue-50 transition text-xs"><i class="fa-solid fa-pen mr-1"></i> Sửa</button>
                            <button onclick="window.deleteTask('${id}')" class="text-red-600 hover:text-red-800 font-semibold px-2.5 py-1 rounded-lg bg-red-50 transition text-xs"><i class="fa-solid fa-trash mr-1"></i> Xóa</button>
                        </div>
                    ` : `<span class="text-[11px] text-slate-400 italic bg-slate-100 px-2.5 py-1 rounded-lg">Đã chấm điểm (Khóa sửa)</span>`;

                    // Hiển thị nội dung tư vấn bán hàng nếu có tích chọn
                    let tuVanHtml = task.coTuVanBanHang ? `
                        <div class="text-indigo-700 font-medium bg-indigo-50/80 p-2.5 rounded-xl mt-1 text-xs border border-indigo-100">
                            <i class="fa-solid fa-comments mr-1"></i> <strong>Tư vấn bán hàng:</strong> ${task.noiDungTuVan || 'Có tư vấn'}
                        </div>` : '';

                    // Hiển thị đánh giá từ quản lý
                    let danhGiaHtml = task.danhGiaAdmin ? `
                        <div class="mt-2 bg-blue-50/60 p-3 text-slate-700 rounded-xl border border-blue-100 text-xs space-y-0.5">
                            <div class="font-bold text-blue-900 flex items-center gap-1"><i class="fa-solid fa-user-tie"></i> Đánh giá từ Quản lý:</div>
                            <div class="italic text-slate-600">${task.danhGiaAdmin}</div>
                        </div>` : '';

                    list.innerHTML += `
                        <div class="bg-white border border-slate-200/80 rounded-2xl p-4 text-xs relative shadow-sm space-y-2.5">
                            <div class="flex justify-between items-start gap-2">
                                <div>
                                    <span class="font-extrabold text-blue-600 text-sm">${task.sttCv} - ${task.khachHang}</span>
                                </div>
                                <div>${kpiBadgeHtml}</div>
                            </div>

                            <div class="text-slate-700 font-medium text-xs leading-relaxed">${task.noiDung}</div>
                            
                            ${tuVanHtml}
                            ${danhGiaHtml}

                            <div class="text-slate-400 text-[11px] pt-2 border-t border-slate-100 flex justify-between items-center">
                                <span>Thời gian: <strong class="text-slate-600">${task.thoiGian} phút</strong></span>
                                ${actionButtons}
                            </div>
                        </div>
                    `;
                });
            }
        } else {
            if (badge) badge.textContent = `0 CV`;
            list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 bg-white rounded-2xl border border-slate-200">Chưa có dữ liệu công việc.</p>';
        }

        const nextSttNum = todayTaskCount + 1;
        const formattedStt = `CV-${String(nextSttNum).padStart(2, '0')}`;
        const sttInput = document.getElementById('sttCv');
        if (sttInput) sttInput.value = formattedStt;
    });
}

// Mở form Sửa và đổ dữ liệu cũ vào
window.openEditModal = (id) => {
    const task = allKpiList[id];
    if (!task) return;

    document.getElementById('editTaskId').value = id;
    document.getElementById('editNgayThucHien').value = task.ngayThucHien;
    document.getElementById('editSttCv').value = task.sttCv;
    document.getElementById('editKhachHang').value = task.khachHang;
    document.getElementById('editNoiDung').value = task.noiDung;
    document.getElementById('editKtHoTro').value = task.ktHoTro || '';
    document.getElementById('editThoiGian').value = task.thoiGian;
    document.getElementById('editDeadline').value = task.deadline || '';
    document.getElementById('editChupAnh').checked = !!task.chupAnh;
    document.getElementById('editDanhGiaMaps').checked = !!task.danhGiaMaps;
    
    const coTuVan = !!task.coTuVanBanHang;
    document.getElementById('editCoTuVanBanHang').checked = coTuVan;
    const editTuVanContainer = document.getElementById('editTuVanContainer');
    if (coTuVan) {
        editTuVanContainer.classList.remove('hidden');
        document.getElementById('editNoiDungTuVan').value = task.noiDungTuVan || '';
    } else {
        editTuVanContainer.classList.add('hidden');
        document.getElementById('editNoiDungTuVan').value = '';
    }

    document.getElementById('editGhiChu').value = task.ghiChu || '';
    document.getElementById('editTaskModal').classList.remove('hidden');
};

// Cập nhật công việc lên Firebase
window.updateKPI = (e) => {
    e.preventDefault();
    const id = document.getElementById('editTaskId').value;
    const coTuVan = document.getElementById('editCoTuVanBanHang').checked;
    
    const updatedData = {
        khachHang: document.getElementById('editKhachHang').value,
        noiDung: document.getElementById('editNoiDung').value,
        ktHoTro: document.getElementById('editKtHoTro').value,
        thoiGian: Number(document.getElementById('editThoiGian').value),
        deadline: document.getElementById('editDeadline').value,
        chupAnh: document.getElementById('editChupAnh').checked,
        danhGiaMaps: document.getElementById('editDanhGiaMaps').checked,
        coTuVanBanHang: coTuVan,
        noiDungTuVan: coTuVan ? document.getElementById('editNoiDungTuVan').value : '',
        ghiChu: document.getElementById('editGhiChu').value
    };

    update(ref(db, `kpis/${id}`), updatedData).then(() => {
        alert("Cập nhật công việc thành công!");
        window.closeEditModal();
    }).catch(err => alert("Lỗi: " + err.message));
};

// Xóa công việc khỏi Firebase
window.deleteTask = (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa công việc này không?")) {
        remove(ref(db, `kpis/${id}`)).then(() => {
            alert("Đã xóa công việc!");
        }).catch(err => alert("Lỗi: " + err.message));
    }
};

window.submitKPI = (e) => {
    e.preventDefault();
    const sttAutoValue = document.getElementById('sttCv').value;
    const coTuVan = document.getElementById('coTuVanBanHang').checked;

    const data = {
        ngayThucHien: todayStr,
        sttCv: sttAutoValue,
        khachHang: document.getElementById('khachHang').value,
        noiDung: document.getElementById('noiDung').value,
        ktPhuTrach: currentUser.name,
        ktHoTro: document.getElementById('ktHoTro').value,
        deadline: document.getElementById('deadline').value,
        thoiGian: Number(document.getElementById('thoiGian').value),
        chupAnh: document.getElementById('chupAnh').checked,
        danhGiaMaps: document.getElementById('danhGiaMaps').checked,
        coTuVanBanHang: coTuVan,
        noiDungTuVan: coTuVan ? document.getElementById('noiDungTuVan').value : '',
        ghiChu: document.getElementById('ghiChu').value,
        diemKpi: 0,
        danhGiaAdmin: ""
    };

    push(ref(db, 'kpis'), data).then(() => {
        alert("Thêm công việc thành công!");
        document.getElementById('kpiForm').reset();
        document.getElementById('tuVanContainer').classList.add('hidden');
        window.closeModal();
    }).catch(err => alert("Lỗi: " + err.message));
};
if (currentUser) { initApp(); }
// Thêm hàm này vào file mobile.js
window.switchTab = (tab) => {
    const todayContent = document.getElementById('todayTabContent');
    const reportContent = document.getElementById('reportTabContent');
    const accountContent = document.getElementById('accountTabContent');
    
    const navToday = document.getElementById('navToday');
    const navReport = document.getElementById('navReport');
    const navAccount = document.getElementById('navAccount');

    // Ẩn tất cả nội dung tab
    todayContent.classList.add('hidden');
    reportContent.classList.add('hidden');
    accountContent.classList.add('hidden');

    // Reset màu icon menu về mặc định
    [navToday, navReport, navAccount].forEach(btn => {
        btn.className = "flex flex-col items-center text-slate-400 hover:text-slate-600 transition py-1";
    });

    // Kích hoạt tab được chọn
    if (tab === 'today') {
        todayContent.classList.remove('hidden');
        navToday.className = "flex flex-col items-center text-blue-600 transition py-1";
    } else if (tab === 'report') {
        reportContent.classList.remove('hidden');
        navReport.className = "flex flex-col items-center text-blue-600 transition py-1";
        if (typeof window.loadMonthlyReport === 'function') window.loadMonthlyReport();
    } else if (tab === 'account') {
        accountContent.classList.remove('hidden');
        navAccount.className = "flex flex-col items-center text-blue-600 transition py-1";
        
        // Đổ thông tin tài khoản hiện tại vào tab Thông tin
        if (currentUser) {
            document.getElementById('accName').textContent = currentUser.name;
            document.getElementById('accRole').textContent = currentUser.role || 'Kỹ thuật viên';
            document.getElementById('accUsername').textContent = currentUser.username;
        }
    }
};

// Hàm thay đổi mật khẩu từ Tab Tài khoản
window.changePassword = (e) => {
    e.preventDefault();
    const oldPass = document.getElementById('oldPassword').value.trim();
    const newPass = document.getElementById('newPassword').value.trim();
    const confirmPass = document.getElementById('confirmPassword').value.trim();

    if (!currentUser || !currentUser.firebaseId) {
        alert("Lỗi phiên đăng nhập, vui lòng đăng xuất và đăng nhập lại!");
        return;
    }

    if (oldPass !== currentUser.password) {
        alert("Mật khẩu hiện tại không chính xác!");
        return;
    }
    if (newPass !== confirmPass) {
        alert("Mật khẩu mới và xác nhận mật khẩu không khớp!");
        return;
    }
    if (newPass.length < 6) {
        alert("Mật khẩu mới phải có ít nhất 6 ký tự!");
        return;
    }

    // Cập nhật mật khẩu mới trực tiếp lên nhánh tương ứng của Firebase
    update(ref(db, `staffs/${currentUser.firebaseId}`), { password: newPass })
        .then(() => {
            alert("Đổi mật khẩu thành công! Vui lòng sử dụng mật khẩu mới cho lần đăng nhập sau.");
            currentUser.password = newPass;
            localStorage.setItem('techUser', JSON.stringify(currentUser));
            
            // Xóa sạch ô nhập
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        })
        .catch(err => alert("Lỗi hệ thống khi đổi mật khẩu: " + err.message));
};