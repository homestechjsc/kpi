import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, get, ref, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
let allStaffsData = {};

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
    
    // 👉 Thêm đoạn này để hiện Telegram ID ngay khi đăng nhập
    const currentId = currentUser.telegramId || '';
    const displayEl = document.getElementById('currentTelegramIdDisplay');
    const inputEl = document.getElementById('accTelegramId');
    if (displayEl) displayEl.textContent = currentId || 'Chưa cập nhật';
    if (inputEl) inputEl.value = currentId;

    loadTodayTasks();
}

// Modal Thêm Mới
window.openModal = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Đổ danh sách vào select
    const staffSelect = document.getElementById('taskKtPhuTrach');
    const supportSelect = document.getElementById('taskKtHoTro');
    
    // Tạo danh sách options từ allStaffsData
    const options = Object.values(allStaffsData).map(st => `<option value="${st.name}">${st.name}</option>`).join('');
    
    staffSelect.innerHTML = '<option value="">-- Chọn kỹ thuật --</option>' + options;
    supportSelect.innerHTML = '<option value="">-- Không có hỗ trợ --</option>' + options;

    // Thiết lập giá trị mặc định
    document.getElementById('taskNgayTao').value = todayStr;
    document.getElementById('taskNguoiTao').value = currentUser ? currentUser.name : '';
    document.getElementById('taskKtPhuTrach').value = currentUser ? currentUser.name : '';
    
    const autoCode = 'CV-' + Date.now().toString().slice(-4);
    document.getElementById('taskMaCv').value = autoCode;

    document.getElementById('taskModal').classList.remove('hidden');
};

window.closeModal = () => {
    document.getElementById('taskModal').classList.add('hidden');
};


// Modal Sửa
window.closeEditModal = () => document.getElementById('editTaskModal').classList.add('hidden');

function loadTodayTasks() {
    onValue(ref(db, 'managementTasks'), (snapshot) => {
        const list = document.getElementById('todayTaskList');
        const badge = document.getElementById('todayCountBadge');
        if (!list) return;
        list.innerHTML = '';

        let todayTaskCount = 0;

        if (snapshot.exists()) {
            const allMgmtTasks = snapshot.val();
            
            // Lọc các công việc thuộc về user hiện tại và đã hoàn thành trong ngày
            const myCompletedTodayTasks = Object.entries(allMgmtTasks).filter(([id, task]) => {
                const isAssigned = task.ktPhuTrach === currentUser.name || task.ktHoTro === currentUser.name;
                const isCompleted = task.tinhTrang === 'Đã hoàn thành';
                // Nới lỏng điều kiện ngày để không bị trôi dữ liệu khi quản lý chấm điểm
                const matchesDate = (task.thoiGianKetThuc && task.thoiGianKetThuc.includes(todayStr)) || (task.ngayTao === todayStr);
                return isAssigned && isCompleted && matchesDate;
            });

            todayTaskCount = myCompletedTodayTasks.length;
            if (badge) badge.textContent = `${todayTaskCount} CV`;

            if (myCompletedTodayTasks.length === 0) {
                list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 bg-white rounded-2xl border border-slate-200">Hôm nay bạn chưa có công việc nào hoàn thành được đồng bộ.</p>';
            } else {
                myCompletedTodayTasks.reverse().forEach(([id, task]) => {
                    let calculatedMinutes = 0;
                    if (task.thoiGianBatDau && task.thoiGianKetThuc) {
                        const startMs = new Date(task.thoiGianBatDau).getTime();
                        const endMs = new Date(task.thoiGianKetThuc).getTime();
                        calculatedMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
                    }

                    // Ép kiểu tường minh và kiểm tra giá trị điểm KPI từ quản lý chấm
                    const diemSo = (task.diemKpi !== undefined && task.diemKpi !== null && task.diemKpi !== "") ? Number(task.diemKpi) : 0;
                    
                    let kpiBadgeHtml = '';
                    if (diemSo > 0) {
                        kpiBadgeHtml = `<span class="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1 shadow-sm"><i class="fa-solid fa-star text-amber-500"></i> Điểm KPI: ${diemSo}</span>`;
                    } else {
                        kpiBadgeHtml = `<span class="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><i class="fa-solid fa-clock"></i> Chờ Quản Lý Chấm KPIs</span>`;
                    }

                    let tuVanHtml = task.coTuVanBanHang ? `
                        <div class="text-indigo-700 font-medium bg-indigo-50/80 p-2.5 rounded-xl mt-1 text-xs border border-indigo-100">
                            <i class="fa-solid fa-comments mr-1"></i> <strong>Tư vấn bán hàng:</strong> ${task.noiDungTuVan || 'Có tư vấn'}
                        </div>` : '';

                    let danhGiaHtml = task.danhGiaAdmin ? `
                        <div class="mt-2 bg-blue-50/60 p-3 text-slate-700 rounded-xl border border-blue-100 text-xs space-y-0.5">
                            <div class="font-bold text-blue-900 flex items-center gap-1"><i class="fa-solid fa-user-tie"></i> Đánh giá từ Quản lý:</div>
                            <div class="italic text-slate-600">${task.danhGiaAdmin}</div>
                        </div>` : '';

                    const chupAnhChecked = task.chupAnh ? '<i class="fa-solid fa-square-check text-emerald-600 mr-1"></i>' : '<i class="fa-regular fa-square text-slate-300 mr-1"></i>';
                    const mapsChecked = task.danhGiaMaps ? '<i class="fa-solid fa-square-check text-emerald-600 mr-1"></i>' : '<i class="fa-regular fa-square text-slate-300 mr-1"></i>';
                    const tuVanChecked = task.coTuVanBanHang ? '<i class="fa-solid fa-square-check text-emerald-600 mr-1"></i>' : '<i class="fa-regular fa-square text-slate-300 mr-1"></i>';

                    list.innerHTML += `
                        <div class="bg-white border border-slate-200/80 rounded-2xl p-4 text-xs relative shadow-sm space-y-2.5">
                            <div class="flex justify-between items-start gap-2">
                                <div>
                                    <span class="font-extrabold text-blue-600 text-sm">${task.maCv || 'CV'} - ${task.khachHang || ''}</span>
                                    <div class="text-[10px] text-slate-400">Ngày: ${task.ngayTao || todayStr}</div>
                                </div>
                                <div>${kpiBadgeHtml}</div>
                            </div>

                            <div class="text-slate-700 font-medium text-xs leading-relaxed">${task.noiDung || ''}</div>

                            <div class="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 text-[11px] text-slate-600 font-semibold">
                                <div>${chupAnhChecked} Ảnh/Video</div>
                                <div>${mapsChecked} Đánh giá Maps</div>
                                <div>${tuVanChecked} Tư vấn bán hàng</div>
                            </div>
                            
                            ${tuVanHtml}
                            ${danhGiaHtml}

                            <div class="text-slate-400 text-[11px] pt-2 border-t border-slate-100 flex justify-between items-center">
                                <span>Thời gian hoàn thành: <strong class="text-emerald-600">${calculatedMinutes} phút</strong></span>
                                <button onclick="window.openTechEditModal('${id}')" class="text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition text-xs flex items-center gap-1 shadow-sm">
                                    <i class="fa-solid fa-pen"></i> Sửa Tiêu Chí
                                </button>
                            </div>
                        </div>
                    `;
                });
            }
        } else {
            if (badge) badge.textContent = `0 CV`;
            list.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 bg-white rounded-2xl border border-slate-200">Chưa có dữ liệu công việc.</p>';
        }
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
    
    const updatedData = {
        khachHang: document.getElementById('editKhachHang').value.trim(),
        noiDung: document.getElementById('editNoiDung').value.trim(),
        ktHoTro: document.getElementById('editKtHoTro').value.trim(),
        thoiGian: Number(document.getElementById('editThoiGian').value) || 0,
        deadline: document.getElementById('editDeadline').value,
        ghiChu: document.getElementById('editGhiChu').value.trim(),
        chupAnh: document.getElementById('editChupAnh').checked,
        danhGiaMaps: document.getElementById('editDanhGiaMaps').checked,
        coTuVanBanHang: document.getElementById('editCoTuVanBanHang').checked,
        noiDungTuVan: document.getElementById('editNoiDungTuVan').value.trim()
    };

    update(ref(db, `managementTasks/${id}`), updatedData)
        .then(() => {
            alert("Cập nhật công việc thành công!");
            window.closeEditModal();
        })
        .catch(err => alert("Lỗi: " + err.message));
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
    
    // Lấy dữ liệu từ form chuẩn mới
    const newTask = {
        ngayTao: document.getElementById('taskNgayTao')?.value || new Date().toISOString().split('T')[0],
        maCv: document.getElementById('taskMaCv')?.value || ('CV-' + Date.now().toString().slice(-4)),
        sttCv: document.getElementById('taskMaCv')?.value || ('CV-' + Date.now().toString().slice(-4)),
        tinhTrang: document.getElementById('taskTinhTrang')?.value || 'Chờ triển khai',
        khachHang: document.getElementById('taskKhachHang')?.value.trim() || '',
        dienThoai: document.getElementById('taskDienThoai')?.value.trim() || '',
        loaiCv: document.getElementById('taskLoaiCv')?.value || '',
        uuTien: document.getElementById('taskUuTien')?.value || 'Thường',
        noiDung: document.getElementById('taskNoiDung')?.value.trim() || '',
        ktPhuTrach: document.getElementById('taskKtPhuTrach')?.value || '',
        ktHoTro: document.getElementById('taskKtHoTro')?.value || '',
        deadline: document.getElementById('taskDeadline')?.value || '',
        nguoiTao: document.getElementById('taskNguoiTao')?.value || (currentUser ? currentUser.name : ''),
        ghiChu: document.getElementById('taskGhiChu')?.value.trim() || '',
        chupAnh: false,
        danhGiaMaps: false,
        coTuVanBanHang: false,
        noiDungTuVan: ''
    };

    push(ref(db, 'managementTasks'), newTask)
        .then(() => {
            alert("Tạo công việc mới thành công!");
            window.closeModal();
            document.getElementById('kpiForm')?.reset();
        })
        .catch(err => {
            alert("Lỗi: " + err.message);
        });
};
if (currentUser) { initApp(); }
// Thêm hàm này vào file mobile.js
window.switchTab = (tab) => {
    // 1. Khai báo các nội dung tab
    const todayContent = document.getElementById('todayTabContent');
    const assignedTabContent = document.getElementById('assignedTasksTabContent');
    const reportContent = document.getElementById('reportTabContent');
    const accountContent = document.getElementById('accountTabContent');
    
    // 2. Khai báo các nút menu điều hướng (Khớp chính xác id trong baocao.html)
    const navToday = document.getElementById('nav_today');
    const navAssignedTasks = document.getElementById('nav_assignedTasks');
    const navReport = document.getElementById('nav_report');
    const navAccount = document.getElementById('nav_account');

    // 3. Ẩn tất cả các nội dung tab trước
    if (todayContent) todayContent.classList.add('hidden');
    if (reportContent) reportContent.classList.add('hidden');
    if (accountContent) accountContent.classList.add('hidden');
    if (assignedTabContent) assignedTabContent.classList.add('hidden');

    // 4. Xử lý hiển thị nội dung theo từng tab được chọn và gọi hàm dữ liệu
    if (tab === 'today') {
        if (todayContent) todayContent.classList.remove('hidden');
        if (typeof window.loadTodayTasks === 'function') window.loadTodayTasks();
    } else if (tab === 'report') {
        if (reportContent) reportContent.classList.remove('hidden');
        if (typeof window.loadMonthlyReport === 'function') window.loadMonthlyReport();
    } else if (tab === 'account') {
        if (accountContent) accountContent.classList.remove('hidden');
        
        // Đổ thông tin tài khoản & Telegram ID hiện tại vào Tab Tài khoản
        if (typeof currentUser !== 'undefined' && currentUser) {
            const accNameEl = document.getElementById('accName');
            const accRoleEl = document.getElementById('accRole');
            const accUsernameEl = document.getElementById('accUsername');
            if (accNameEl) accNameEl.textContent = currentUser.name;
            if (accRoleEl) accRoleEl.textContent = currentUser.role || 'Kỹ thuật viên';
            if (accUsernameEl) accUsernameEl.textContent = currentUser.username;
            
            const currentId = currentUser.telegramId || '';
            const displayEl = document.getElementById('currentTelegramIdDisplay');
            const inputEl = document.getElementById('accTelegramId');
            if (displayEl) displayEl.textContent = currentId || 'Chưa cập nhật';
            if (inputEl) inputEl.value = currentId;
        }
    } else if (tab === 'assignedTasks') {
        if (assignedTabContent) assignedTabContent.classList.remove('hidden');
        if (typeof window.renderAssignedTasks === 'function') window.renderAssignedTasks();
    }

    // 5. Reset toàn bộ các nút menu về trạng thái mặc định (chữ xám mờ, icon không có nền)
    const allNavButtons = [navToday, navAssignedTasks, navReport, navAccount];
    allNavButtons.forEach(btn => {
        if (!btn) return;
        btn.className = "nav-btn flex flex-col items-center text-slate-400 hover:text-slate-600 transition py-1 group";
        const iconDiv = btn.querySelector('div');
        if (iconDiv) {
            const hasRelative = iconDiv.classList.contains('relative');
            iconDiv.className = `w-8 h-8 rounded-xl flex items-center justify-center transition mb-0.5 ${hasRelative ? 'relative' : ''}`;
        }
        const textSpan = btn.querySelector('span');
        if (textSpan) textSpan.className = "text-[10px] font-bold";
    });

    // 6. Xác định nút menu đang active dựa vào tab
    let activeBtn = null;
    if (tab === 'today') activeBtn = navToday;
    else if (tab === 'assignedTasks') activeBtn = navAssignedTasks;
    else if (tab === 'report') activeBtn = navReport;
    else if (tab === 'account') activeBtn = navAccount;

    // 7. Kích hoạt hiệu ứng nổi bật (chữ xanh ngọc đậm, icon có nền bg-emerald-50)
    if (activeBtn) {
        activeBtn.className = "nav-btn flex flex-col items-center text-emerald-600 transition py-1 group";
        const iconDiv = activeBtn.querySelector('div');
        if (iconDiv) {
            const hasRelative = iconDiv.classList.contains('relative');
            iconDiv.className = `w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-50 transition mb-0.5 ${hasRelative ? 'relative' : ''}`;
        }
        const textSpan = activeBtn.querySelector('span');
        if (textSpan) textSpan.className = "text-[10px] font-black";
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
// Đặt giá trị mặc định cho ô chọn tháng là tháng hiện tại khi mở app
const reportMonthInputEl = document.getElementById('reportMonthInput');
if (reportMonthInputEl) {
    reportMonthInputEl.value = new Date().toISOString().slice(0, 7);
}

// Hàm tải và tính toán báo cáo KPI theo tháng cho Tab Báo Cáo
window.loadMonthlyReport = () => {
    const monthInput = document.getElementById('reportMonthInput');
    if (!monthInput || !currentUser) return;
    const selectedMonth = monthInput.value; // Định dạng "YYYY-MM"

    let totalCv = 0;
    let totalTime = 0;
    let totalScore = 0;
    let scoredCount = 0;

    const monthlyTaskListEl = document.getElementById('monthlyTaskList');
    if (monthlyTaskListEl) monthlyTaskListEl.innerHTML = '';

    // Lọc các công việc thuộc về user hiện tại (Phụ trách hoặc Hỗ trợ) và đúng tháng đã chọn
    const myMonthlyTasks = Object.entries(allAssignedTasks || {}).filter(([id, task]) => {
        const isAssigned = task.ktPhuTrach === currentUser.name || task.ktHoTro === currentUser.name;
        // Kiểm tra theo ngày tạo hoặc thời gian kết thúc bắt đầu bằng tháng được chọn (YYYY-MM)
        const taskDate = task.ngayTao || task.thoiGianKetThuc || '';
        const matchesMonth = taskDate.startsWith(selectedMonth);
        return isAssigned && matchesMonth;
    }).reverse(); // Mới nhất lên đầu

    myMonthlyTasks.forEach(([id, task]) => {
        totalCv++;
        
        // Tính thời gian hoàn thành (nếu có đủ thời gian bắt đầu và kết thúc)
        let calculatedMinutes = Number(task.thoiGian) || 0;
        if (task.thoiGianBatDau && task.thoiGianKetThuc) {
            const startMs = new Date(task.thoiGianBatDau).getTime();
            const endMs = new Date(task.thoiGianKetThuc).getTime();
            calculatedMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
        }
        totalTime += calculatedMinutes;

        const score = (task.diemKpi !== undefined && task.diemKpi !== null && task.diemKpi !== "") ? Number(task.diemKpi) : 0;
        if (score > 0) {
            totalScore += score;
            scoredCount++;
        }

        const badgeColor = score > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
        const statusText = score > 0 ? `Điểm KPI: ${score}` : (task.tinhTrang === 'Đã hoàn thành' ? 'Chờ chấm' : task.tinhTrang);

        let tuVanHtml = task.coTuVanBanHang ? `<div class="text-[11px] text-indigo-700 bg-indigo-50 p-2 rounded-xl mt-1 font-medium"><i class="fa-solid fa-comments mr-1"></i> <strong>Tư vấn:</strong> ${task.noiDungTuVan || 'Có'}</div>` : '';
        let danhGiaHtml = task.danhGiaAdmin ? `<div class="text-[11px] text-slate-600 bg-slate-100 p-2 rounded-xl mt-1 italic"><i class="fa-solid fa-user-tie text-emerald-600 mr-1"></i> ${task.danhGiaAdmin}</div>` : '';

        if (monthlyTaskListEl) {
            monthlyTaskListEl.innerHTML += `
                <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="font-extrabold text-slate-800">${(task.ngayTao || todayStr).split('-').reverse().join('/')} - <span class="text-blue-600">${task.maCv || 'CV'}</span></span>
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}">${statusText}</span>
                    </div>
                    <div class="font-bold text-slate-700">${task.khachHang || ''}</div>
                    <div class="text-slate-600">${task.noiDung || ''}</div>
                    ${tuVanHtml}
                    ${danhGiaHtml}
                    <div class="text-slate-400 text-[11px] pt-1 border-t border-slate-200/60 flex justify-between">
                        <span>TG: <strong>${calculatedMinutes} phút</strong></span>
                        <div class="flex gap-2">
                            <span>Ảnh: <i class="fa-solid fa-camera ${task.chupAnh ? 'text-emerald-500':'text-slate-300'}"></i></span>
                            <span>Maps: <i class="fa-solid fa-map ${task.danhGiaMaps ? 'text-blue-500':'text-slate-300'}"></i></span>
                        </div>
                    </div>
                </div>
            `;
        }
    });

    if (myMonthlyTasks.length === 0 && monthlyTaskListEl) {
        monthlyTaskListEl.innerHTML = '<p class="text-xs text-slate-400 text-center py-6 bg-white rounded-2xl border">Không có công việc nào trong tháng này.</p>';
    }

    const avgScore = scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : 0;

    // Cập nhật số liệu lên các ô tổng hợp phía trên Tab Báo Cáo
    document.getElementById('repTotalCv').textContent = totalCv;
    document.getElementById('repTotalTime').textContent = `${totalTime}p`;
    document.getElementById('repTotalScore').textContent = totalScore;
    document.getElementById('repAvgScore').textContent = avgScore;
};
// ================= QUẢN LÝ TAB "VIỆC ĐƯỢC GIAO" CHO KỸ THUẬT =================
let allAssignedTasks = {};

// 1. Lắng nghe dữ liệu việc được giao từ trang quản trị (managementTasks)
onValue(ref(db, 'managementTasks'), (snapshot) => {
    allAssignedTasks = snapshot.exists() ? snapshot.val() : {};
    renderAssignedTasks();
});

// 2. Render danh sách việc được giao cho kỹ thuật hiện tại (Phụ trách hoặc Hỗ trợ)
function renderAssignedTasks() {
    const container = document.getElementById('assignedTasksList');
    const badgeHeader = document.getElementById('assignedBadgeHeader');
    const navBadge = document.getElementById('assignedCountBadge');
    if (!container || !currentUser) return;

    container.innerHTML = '';
    
    // 👉 Lấy giá trị từ ô chọn tháng, tên khách hàng và loại CV
    const selectedMonth = document.getElementById('filterAssignedMonth')?.value || "";
    const customerKeyword = document.getElementById('filterAssignedCustomer')?.value.trim().toLowerCase() || "";
    const selectedType = document.getElementById('filterAssignedType')?.value || "";

    // 👉 Lọc công việc của user kết hợp với điều kiện tên khách hàng (tìm kiếm gần đúng)
    const myTasks = Object.entries(allAssignedTasks).filter(([id, task]) => {
        const isAssigned = task.ktPhuTrach === currentUser.name || task.ktHoTro === currentUser.name;
        if (!isAssigned) return false;

        const taskDate = task.ngayTao || (task.thoiGianKetThuc ? task.thoiGianKetThuc.split('T')[0] : "");
        const matchMonth = selectedMonth ? taskDate.startsWith(selectedMonth) : true;
        
        // Kiểm tra tên khách hàng chứa từ khóa tìm kiếm (không phân biệt hoa thường)
        const customerName = (task.khachHang || "").toLowerCase();
        const matchCustomer = customerKeyword ? customerName.includes(customerKeyword) : true;
        
        const matchType = selectedType ? task.loaiCv === selectedType : true;

        return matchMonth && matchCustomer && matchType;
    }).reverse();

    // Đếm số việc chưa hoàn thành để hiển thị badge tổng
    const activeTasksCount = myTasks.filter(([id, task]) => task.tinhTrang !== 'Đã hoàn thành').length;

    if (badgeHeader) badgeHeader.textContent = `${myTasks.length} CV`;
    
    if (navBadge) {
        if (activeTasksCount > 0) {
            navBadge.textContent = activeTasksCount;
            navBadge.classList.remove('hidden');
        } else {
            navBadge.classList.add('hidden');
        }
    }

    if (myTasks.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-8 bg-slate-50 rounded-2xl border">Không tìm thấy công việc phù hợp với bộ lọc.</p>';
        return;
    }

    // Hàm kiểm tra ngoài giờ làm việc (Sáng 07h30-11h30 & Chiều 13h30-17h30, Chủ Nhật nghỉ)
    const checkIsOvertime = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTimeVal = hours * 60 + minutes;

    if (dayOfWeek === 0) return true; // Chủ Nhật nghỉ tính cả ngày là ngoài giờ

    // Giờ làm việc hành chính: Sáng 07h30 - 11h30 & Chiều 13h30 - 17h30
    const morningEnd = 11 * 60 + 30;
    const afternoonStart = 13 * 60 + 30;
    const afternoonEnd = 17 * 60 + 30;

    // Ngoài giờ: từ 11h30 đến 13h30 HOẶC sau 17h30 (đến trước 07h30 sáng hôm sau)
    const isLunchBreakOvertime = (currentTimeVal > morningEnd && currentTimeVal < afternoonStart);
    const isEveningOvertime = (currentTimeVal > afternoonEnd || currentTimeVal < 7 * 60 + 30);

    return isLunchBreakOvertime || isEveningOvertime;
};

    const formatTime = (timeStr) => {
        if (!timeStr) return 'Chưa cập nhật';
        return timeStr.replace('T', ' ').substring(0, 16);
    };

    myTasks.forEach(([id, task]) => {
        let statusColor = 'bg-amber-100 text-amber-800';
        if (task.tinhTrang === 'Đang thực hiện') statusColor = 'bg-blue-100 text-blue-800 animate-pulse';
        if (task.tinhTrang === 'Đã hoàn thành') statusColor = 'bg-emerald-100 text-emerald-800';
        if (task.tinhTrang === 'Tạm ngưng') statusColor = 'bg-rose-100 text-rose-800';

        // Nút bấm hành động trạng thái chính
        let actionButtons = '';
        if (task.tinhTrang === 'Chờ triển khai') {
            actionButtons = `<button onclick="window.updateAssignedTaskStatus('${id}', 'Đang thực hiện')" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-2xl font-black text-xs transition shadow-lg flex items-center justify-center gap-2 active:scale-[0.99]"><i class="fa-solid fa-play"></i> Nhận Việc & Bắt Đầu</button>`;
        } else if (task.tinhTrang === 'Đang thực hiện') {
            actionButtons = `<div class="grid grid-cols-2 gap-2.5">
                <button onclick="window.updateAssignedTaskStatus('${id}', 'Tạm ngưng')" class="bg-amber-500 text-white py-3 rounded-2xl font-black text-xs transition active:scale-[0.99]"><i class="fa-solid fa-pause"></i> Tạm Ngưng</button>
                <button onclick="window.openPaymentModal('${id}')" class="bg-emerald-600 text-white py-3 rounded-2xl font-black text-xs transition active:scale-[0.99]"><i class="fa-solid fa-check"></i> Hoàn Thành</button>
            </div>`;
        } else if (task.tinhTrang === 'Tạm ngưng') {
            actionButtons = `<div class="grid grid-cols-2 gap-2.5">
                <button onclick="window.updateAssignedTaskStatus('${id}', 'Đang thực hiện')" class="bg-blue-600 text-white py-3 rounded-2xl font-black text-xs transition active:scale-[0.99]"><i class="fa-solid fa-play"></i> Tiếp Tục</button>
                <button onclick="window.openPaymentModal('${id}')" class="bg-emerald-600 text-white py-3 rounded-2xl font-black text-xs transition active:scale-[0.99]"><i class="fa-solid fa-check"></i> Hoàn Thành</button>
            </div>`;
        } else {
            actionButtons = `<div class="text-center text-emerald-700 font-extrabold text-xs py-3 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm"><i class="fa-solid fa-circle-check mr-1.5"></i> Đã hoàn thành</div>`;
        }

        // Logic Sửa/Xóa công việc khi chưa hoàn thành
        let editDeleteButtons = '';
        if (task.tinhTrang !== 'Đã hoàn thành') {
            editDeleteButtons = `
                <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 mt-2">
                    <button onclick="window.openEditTaskModal('${id}')" class="bg-blue-50 text-blue-600 py-2 rounded-xl font-bold text-[10px] hover:bg-blue-100 transition"><i class="fa-solid fa-pen mr-1"></i> Sửa</button>
                    <button onclick="window.deleteTaskByTech('${id}')" class="bg-rose-50 text-rose-600 py-2 rounded-xl font-bold text-[10px] hover:bg-rose-100 transition"><i class="fa-solid fa-trash mr-1"></i> Xóa</button>
                </div>`;
        }

        // Xử lý thông tin tăng ca
        let tangCaSectionHtml = '';
        const isOvertimeWindow = checkIsOvertime();
        const isCompleted = task.tinhTrang === 'Đã hoàn thành';
        let tangCaList = task.tangCaList || [];
        let activeTangCa = tangCaList.find(s => s.trangThai === 'Đang tăng ca');

        if (!isCompleted && isOvertimeWindow) {
            if (activeTangCa) {
                tangCaSectionHtml = `
                    <div class="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-3 rounded-2xl space-y-1.5 shadow-sm">
                        <div class="flex justify-between items-center text-amber-900 font-bold">
                            <span class="flex items-center gap-1.5"><i class="fa-solid fa-business-time text-amber-600"></i> Đang tăng ca: ${activeTangCa.lyDo}</span>
                            <button onclick="window.endTangCaSession('${id}', '${activeTangCa.id}')" class="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-[10px] font-black transition shadow-sm">Kết thúc TC</button>
                        </div>
                        <div class="text-[10px] text-slate-500">Dự kiến: ${activeTangCa.thoiGianDuKien} phút • Bắt đầu: ${formatTime(activeTangCa.batDau)}</div>
                    </div>`;
            } else {
                tangCaSectionHtml = `
                    <button onclick="window.openTangCaModal('${id}')" class="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-2.5 rounded-2xl font-extrabold text-xs transition shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-[0.99]">
                        <i class="fa-solid fa-business-time"></i> Bắt Đầu Tăng Ca Mới
                    </button>`;
            }
        }

        let historyTangCaHtml = '';
if (tangCaList.length > 0) {
    historyTangCaHtml = `<div class="text-[11px] text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
        <div class="font-bold text-slate-700 flex items-center gap-1"><i class="fa-solid fa-clock-rotate-left text-amber-600"></i> Lịch sử tăng ca (${tangCaList.length} lần):</div>`;
    tangCaList.forEach((ses, idx) => {
        const isDone = ses.trangThai === 'Đã kết thúc';
        historyTangCaHtml += `
            <div class="pl-2 border-l-2 ${isDone ? 'border-emerald-400' : 'border-amber-400'} space-y-0.5">
                <div>• Lần ${idx+1}: <span class="font-medium text-slate-700">${ses.lyDo}</span> (${ses.thoiGianDuKien}p) - <span class="font-bold ${isDone ? 'text-emerald-600' : 'text-amber-600'}">${ses.trangThai}</span></div>
                <div class="text-[10px] text-slate-400">Bắt đầu: ${formatTime(ses.batDau)} (${ses.gpsBatDau || 'N/A'})</div>
                ${isDone ? `<div class="text-[10px] text-slate-400">Kết thúc: ${formatTime(ses.ketThuc)} (${ses.gpsKetThuc || 'N/A'})</div>` : ''}
            </div>`;
    });
    historyTangCaHtml += `</div>`;
}

        container.innerHTML += `
            <div class="bg-white border border-slate-200/90 rounded-3xl p-4 text-xs space-y-3 shadow-sm hover:shadow transition">
                <div onclick="window.toggleMobileAccordion('${id}')" class="cursor-pointer space-y-2">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="font-black text-emerald-700 text-sm tracking-tight">${task.maCv || ''} - ${task.khachHang || ''}</span>
                            <div class="text-slate-400 text-[10px] font-bold">Ngày tạo: ${task.ngayTao || ''}</div>
                        </div>
                        <div class="flex flex-col items-end gap-1">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black ${statusColor}">${task.tinhTrang}</span>
                            <span class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-[9px]">${task.uuTien || 'Thường'}</span>
                        </div>
                    </div>
                    <div class="text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-2xl border flex justify-between items-center">
                        <span>${task.noiDung || ''}</span>
                        <i class="fa-solid fa-chevron-down text-slate-400 text-[10px] transition-transform" id="icon_${id}"></i>
                    </div>
                </div>

                <!-- PHẦN CHI TIẾT MỞ RỘNG ĐẦY ĐỦ -->
                <div id="accordion_${id}" class="hidden space-y-3 pt-2 border-t border-slate-100">
                    <!-- Thông tin chung -->
                    <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 p-3 rounded-2xl border">
                        <div><strong>SĐT:</strong> <a href="tel:${task.dienThoai}" class="text-blue-600 font-bold">${task.dienThoai || 'N/A'}</a></div>
                        <div><strong>Loại CV:</strong> <span class="text-blue-600 font-bold">${task.loaiCv || 'Khác'}</span></div>
                        <div><strong>Mức ưu tiên:</strong> <span class="text-amber-600 font-bold">${task.uuTien || 'Thường'}</span></div>
                        <div><strong>Deadline:</strong> <span class="text-rose-600 font-bold">${formatTime(task.deadline) || 'Không'}</span></div>
                        <div><strong>Phụ trách:</strong> ${task.ktPhuTrach || ''}</div>
                        <div><strong>Hỗ trợ:</strong> ${task.ktHoTro || 'Không'}</div>
                        <div class="col-span-2"><strong>Người tạo:</strong> ${task.nguoiTao || ''}</div>
                        <div class="col-span-2"><strong>Ghi chú:</strong> ${task.ghiChu || 'Không có'}</div>
                    </div>

                    <!-- Thời gian & GPS -->
                    <div class="bg-slate-50 p-3 rounded-2xl border text-[11px] space-y-1">
                        <div class="font-bold text-slate-700 border-b pb-1 mb-1"><i class="fa-solid fa-clock text-emerald-600"></i> Thời gian & GPS thực tế:</div>
                        <div><strong>Bắt đầu CV:</strong> ${formatTime(task.thoiGianBatDau)}</div>
                        <div><strong>Kết thúc CV:</strong> ${formatTime(task.thoiGianKetThuc)}</div>
                        <div><strong>GPS Thực hiện:</strong> ${task.gpsThucHien ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.gpsThucHien)}" target="_blank" class="text-blue-600 underline font-bold">Xem Map</a>` : 'Chưa có'}</div>
                        <div><strong>GPS Hoàn thành:</strong> ${task.gpsHoanThanh ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.gpsHoanThanh)}" target="_blank" class="text-emerald-600 underline font-bold">Xem Map</a>` : 'Chưa có'}</div>
                    </div>

                    <!-- THÔNG TIN THANH TOÁN (Chỉ hiện khi hoàn thành) -->
                    ${task.tinhTrang === 'Đã hoàn thành' && task.hinhThucThanhToan ? `
                        <div class="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200 text-[11px] space-y-1 text-slate-700">
                            <div class="font-bold text-emerald-800 border-b border-emerald-200 pb-1 mb-1 flex items-center gap-1">
                                <i class="fa-solid fa-receipt"></i> Thông tin thanh toán & bảo hành:
                            </div>
                            <div class="grid grid-cols-2 gap-1">
                                <div><strong>Hình thức:</strong> ${task.hinhThucThanhToan}</div>
                                <div><strong>Số tiền:</strong> <span class="text-emerald-700 font-black">${Number(task.soTienThanhToan || 0).toLocaleString()} VNĐ</span></div>
                                <div><strong>Công nợ:</strong> <span class="${task.tinhTrangCongNo === 'Có nợ' ? 'text-rose-600 font-bold' : 'text-slate-700'}">${task.tinhTrangCongNo || 'Không'}</span></div>
                                <div><strong>Bảo hành:</strong> ${task.thoiGianBaoHanh || 'Không'}</div>
                            </div>
                            ${task.ghiChuThanhToan ? `<div class="pt-1 text-slate-600"><strong>Ghi chú phí:</strong> ${task.ghiChuThanhToan}</div>` : ''}
                        </div>
                    ` : ''}

                    <!-- KHU VỰC TĂNG CA -->
                    ${(tangCaSectionHtml || historyTangCaHtml) ? `
                        <div class="space-y-2 pt-1 border-t border-slate-100">
                            ${tangCaSectionHtml}
                            ${historyTangCaHtml}
                        </div>` : ''}
                </div>

                <div class="pt-1">${actionButtons}</div>
                ${editDeleteButtons}
            </div>
        `;
    });
}

// Hàm mở rộng/thu gọn chi tiết công việc trên Mobile
window.toggleMobileAccordion = (id) => {
    const accordion = document.getElementById(`accordion_${id}`);
    const icon = document.getElementById(`icon_${id}`);
    if (accordion) {
        accordion.classList.toggle('hidden');
        if (icon) {
            icon.classList.toggle('rotate-180');
        }
    }
};

// 3. Hàm bấm nhận việc / cập nhật trạng thái kèm GPS và thời gian thực
window.updateAssignedTaskStatus = (taskId, newStatus) => {
    if (!navigator.geolocation) {
        alert("Trình duyệt không hỗ trợ định vị GPS.");
        executeAssignedStatusUpdate(taskId, newStatus, "Không hỗ trợ GPS");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const gpsString = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            executeAssignedStatusUpdate(taskId, newStatus, gpsString);
        },
        (error) => {
            console.warn("Không lấy được GPS:", error.message);
            executeAssignedStatusUpdate(taskId, newStatus, "Không lấy được GPS");
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
};

function executeAssignedStatusUpdate(taskId, newStatus, gpsCoords) {
    const nowTime = new Date().toISOString();
    let updatePayload = { tinhTrang: newStatus };

    if (newStatus === 'Đang thực hiện') {
        updatePayload.thoiGianBatDau = nowTime;
        updatePayload.gpsThucHien = gpsCoords;
    } else if (newStatus === 'Tạm ngưng') {
        updatePayload.gpsTamNgung = gpsCoords;
    } else if (newStatus === 'Đã hoàn thành') {
        updatePayload.thoiGianKetThuc = nowTime;
        updatePayload.gpsHoanThanh = gpsCoords;
    }

    update(ref(db, `managementTasks/${taskId}`), updatePayload)
        .then(() => {
            alert(`Cập nhật trạng thái thành công: "${newStatus}"`);

            // 👉 KÍCH HOẠT GỬI THÔNG BÁO TELEGRAM KHI BẮT ĐẦU HOẶC ĐỔI TRẠNG THÁI
            const currentTaskData = allAssignedTasks[taskId] || {};
            const mergedData = { ...currentTaskData, ...updatePayload };
            
            if (newStatus === 'Đang thực hiện') {
                sendMobileTelegramNotification('inprogress', mergedData, 'Kỹ thuật viên đã nhận việc và bắt đầu triển khai.');
            } else if (newStatus === 'Tạm ngưng') {
                sendMobileTelegramNotification('pause', mergedData, 'Công việc đã bị tạm ngưng.');
            }
        })
        .catch((err) => {
            alert("Lỗi cập nhật: " + err.message);
        });
}

// Hàm hỗ trợ gửi Telegram trực tiếp từ mobile.js
async function sendMobileTelegramNotification(actionType, taskData, extraMessage = '') {
    try {
        const snapshot = await get(ref(db, 'settings/telegram'));
        if (!snapshot.exists()) return;
        const config = snapshot.val();
        if (!config.botToken) return;

        let isEnabled = false;
        let actionTitle = '';
        let emoji = '📌';

        switch (actionType) {
            case 'inprogress': isEnabled = config.notifOnInProgress; actionTitle = 'BẮT ĐẦU THỰC HIỆN'; emoji = '🚀'; break;
            case 'pause': isEnabled = config.notifOnPause; actionTitle = 'TẠM NGƯNG CÔNG VIỆC'; emoji = '⏸️'; break;
            case 'complete': isEnabled = config.notifOnComplete; actionTitle = 'HOÀN THÀNH CÔNG VIỆC'; emoji = '✅'; break;
            case 'start_overtime': isEnabled = config.notifOnStartOvertime; actionTitle = 'BẮT ĐẦU TĂNG CA'; emoji = '⏱️'; break;
            case 'end_overtime': isEnabled = config.notifOnEndOvertime; actionTitle = 'KẾT THÚC TĂNG CA'; emoji = '🏁'; break;
        }

        if (!isEnabled) return;

        // Chỉ gửi thông báo về nhóm quản lý
        if (!config.adminChatId) return;
        const targetChatId = config.adminChatId;

        // Tạo dòng hiển thị kỹ thuật
        let staffLine = `🛠️ *Kỹ thuật:* ${taskData.ktPhuTrach || currentUser.name}`;
        if (taskData.ktHoTro && taskData.ktHoTro !== "") {
            staffLine += ` + ${taskData.ktHoTro} (Hỗ trợ)`;
        }

        // Định dạng nội dung tin nhắn gửi nhóm
        const message = encodeURIComponent(
            `${emoji} *[THÔNG BÁO ${actionTitle}]*\n\n` +
            `📋 *Mã CV:* ${taskData.maCv || 'N/A'}\n` +
            `👤 *Khách hàng:* ${taskData.khachHang || 'N/A'}\n` +
            `${staffLine}\n` +
            `📝 *Nội dung:* ${taskData.noiDung || 'N/A'}\n` +
            (extraMessage ? `💬 *Chi tiết:* ${extraMessage}\n` : '') +
            `🕒 *Thời gian:* ${new Date().toLocaleString('vi-VN')}`
        );

        // Gửi thẳng vào nhóm quản lý
        const url = `https://api.telegram.org/bot${config.botToken}/sendMessage?chat_id=${targetChatId}&text=${message}&parse_mode=Markdown`;
        fetch(url).catch(err => console.error("Lỗi gửi Telegram nhóm:", err));

    } catch (error) {
        console.error("Lỗi gửi thông báo mobile:", error);
    }
}

// 4. Mở rộng hàm switchTab để hỗ trợ Tab "assignedTasks"
const originalSwitchTab = window.switchTab;
window.switchTab = (tab) => {
    // 1. Khai báo các nội dung tab
    const todayContent = document.getElementById('todayTabContent');
    const assignedTabContent = document.getElementById('assignedTasksTabContent');
    const reportContent = document.getElementById('reportTabContent');
    const accountContent = document.getElementById('accountTabContent');
    
    // 2. Khai báo chính xác các nút menu có dấu gạch dưới khớp với baocao.html
    const navToday = document.getElementById('nav_today');
    const navAssignedTasks = document.getElementById('nav_assignedTasks');
    const navReport = document.getElementById('nav_report');
    const navAccount = document.getElementById('nav_account');

    // 3. Ẩn tất cả nội dung tab
    if (todayContent) todayContent.classList.add('hidden');
    if (assignedTabContent) assignedTabContent.classList.add('hidden');
    if (reportContent) reportContent.classList.add('hidden');
    if (accountContent) accountContent.classList.add('hidden');

    // 4. Hiển thị tab được chọn và gọi dữ liệu tương ứng
    if (tab === 'today') {
        if (todayContent) todayContent.classList.remove('hidden');
        if (typeof window.loadTodayTasks === 'function') window.loadTodayTasks();
    } else if (tab === 'assignedTasks') {
        if (assignedTabContent) assignedTabContent.classList.remove('hidden');
        if (typeof window.renderAssignedTasks === 'function') window.renderAssignedTasks();
    } else if (tab === 'report') {
        if (reportContent) reportContent.classList.remove('hidden');
        if (typeof window.loadMonthlyReport === 'function') window.loadMonthlyReport();
    } else if (tab === 'account') {
        if (accountContent) accountContent.classList.remove('hidden');
        
        if (typeof currentUser !== 'undefined' && currentUser) {
            const accNameEl = document.getElementById('accName');
            const accRoleEl = document.getElementById('accRole');
            const accUsernameEl = document.getElementById('accUsername');
            if (accNameEl) accNameEl.textContent = currentUser.name;
            if (accRoleEl) accRoleEl.textContent = currentUser.role || 'Kỹ thuật viên';
            if (accUsernameEl) accUsernameEl.textContent = currentUser.username;
            
            const currentId = currentUser.telegramId || '';
            const displayEl = document.getElementById('currentTelegramIdDisplay');
            const inputEl = document.getElementById('accTelegramId');
            if (displayEl) displayEl.textContent = currentId || 'Chưa cập nhật';
            if (inputEl) inputEl.value = currentId;
        }
    }

    // 5. Reset toàn bộ menu về trạng thái mờ (chữ xám, không có nền)
    const allNavButtons = [navToday, navAssignedTasks, navReport, navAccount];
    allNavButtons.forEach(btn => {
        if (!btn) return;
        btn.className = "nav-btn flex flex-col items-center text-slate-400 hover:text-slate-600 transition py-1 group";
        const iconDiv = btn.querySelector('div');
        if (iconDiv) {
            const hasRelative = iconDiv.classList.contains('relative');
            iconDiv.className = `w-8 h-8 rounded-xl flex items-center justify-center transition mb-0.5 ${hasRelative ? 'relative' : ''}`;
        }
        const textSpan = btn.querySelector('span');
        if (textSpan) textSpan.className = "text-[10px] font-bold";
    });

    // 6. Xác định đúng nút menu đang active
    let activeBtn = null;
    if (tab === 'today') activeBtn = navToday;
    else if (tab === 'assignedTasks') activeBtn = navAssignedTasks;
    else if (tab === 'report') activeBtn = navReport;
    else if (tab === 'account') activeBtn = navAccount;

    // 7. Tô sáng nút menu đang chọn (chữ xanh ngọc đậm, icon có nền bg-emerald-50)
    if (activeBtn) {
        activeBtn.className = "nav-btn flex flex-col items-center text-emerald-600 transition py-1 group";
        const iconDiv = activeBtn.querySelector('div');
        if (iconDiv) {
            const hasRelative = iconDiv.classList.contains('relative');
            iconDiv.className = `w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-50 transition mb-0.5 ${hasRelative ? 'relative' : ''}`;
        }
        const textSpan = activeBtn.querySelector('span');
        if (textSpan) textSpan.className = "text-[10px] font-black";
    }
};
// ================= QUẢN LÝ TĂNG CA (HỖ TRỢ NHIỀU LẦN/NGÀY) =================

// Mở Modal nhập lý do khi kỹ thuật bấm nút Bắt đầu tăng ca
window.openTangCaModal = (taskId) => {
    document.getElementById('tangCaTaskId').value = taskId;
    document.getElementById('tangCaForm').reset();
    document.getElementById('tangCaModal').classList.remove('hidden');
};

window.closeTangCaModal = () => {
    document.getElementById('tangCaModal').classList.add('hidden');
};

// Xử lý khi kỹ thuật submit thông tin bắt đầu tăng ca
window.submitStartTangCa = (e) => {
    e.preventDefault();
    const taskId = document.getElementById('tangCaTaskId').value;
    const lyDo = document.getElementById('tangCaLyDo').value.trim();
    const thoiGianDuKien = Number(document.getElementById('tangCaThoiGianDuKien').value) || 0;
    
    if (!taskId || !lyDo) return;

    // Lấy GPS chính xác mới nhất ngay khi bấm
    getFreshGPS((freshGps) => {
        saveTangCaToFirebase(taskId, lyDo, thoiGianDuKien, freshGps);
    });
};
function saveTangCaToFirebase(taskId, lyDo, thoiGianDuKien, gpsStart) {
    const task = allAssignedTasks[taskId];
    if (!task) return;

    let tangCaList = task.tangCaList || [];
    const newSession = {
        id: 'TC-' + Date.now(),
        lyDo: lyDo,
        thoiGianDuKien: thoiGianDuKien,
        batDau: new Date().toISOString(),
        gpsBatDau: gpsStart,
        trangThai: 'Đang tăng ca'
    };

    tangCaList.push(newSession);

    update(ref(db, `managementTasks/${taskId}`), { tangCaList })
        .then(() => {
            alert("Đã bắt đầu phiên tăng ca!");
            window.closeTangCaModal();
            // 👉 GỬI THÔNG BÁO TELEGRAM KHI BẮT ĐẦU TĂNG CA
sendMobileTelegramNotification('start_overtime', task, `Bắt đầu phiên tăng ca mới.\n- Lý do: ${lyDo}\n- Dự kiến: ${thoiGianDuKien} phút`);        })
        .catch(err => alert("Lỗi: " + err.message));
}

// Hàm kết thúc một phiên tăng ca đang diễn ra
window.endTangCaSession = (taskId, sessionId) => {
    const task = allAssignedTasks[taskId];
    if (!task || !task.tangCaList) return;

    getFreshGPS((freshGps) => {
        processEndTangCa(taskId, sessionId, freshGps);
    });
};
function processEndTangCa(taskId, sessionId, gpsEnd) {
    const task = allAssignedTasks[taskId];
    let tangCaList = task.tangCaList || [];

    tangCaList = tangCaList.map(s => {
        if (s.id === sessionId) {
            return {
                ...s,
                ketThuc: new Date().toISOString(),
                gpsKetThuc: gpsEnd,
                trangThai: 'Đã kết thúc'
            };
        }
        return s;
    });

    update(ref(db, `managementTasks/${taskId}`), { tangCaList })
        .then(() => {
            alert("Đã kết thúc phiên tăng ca!");
            // 👉 GỬI THÔNG BÁO TELEGRAM KHI KẾT THÚC TĂNG CA
            if (endedSession) {
                const durationMins = Math.round((new Date(endedSession.ketThuc) - new Date(endedSession.batDau)) / 60000);
sendMobileTelegramNotification('end_overtime', task, `Đã kết thúc phiên tăng ca "${endedSession.lyDo}". Thời gian thực tế: ${durationMins} phút.`);            }
        })
        .catch(err => alert("Lỗi: " + err.message));
}
// 1. Mở Modal sửa tiêu chí checkbox cho kỹ thuật
window.openTechEditModal = (taskId) => {
    const task = allAssignedTasks[taskId];
    if (!task) return;

    document.getElementById('techEditTaskId').value = taskId;
    document.getElementById('techEditChupAnh').checked = !!task.chupAnh;
    document.getElementById('techEditDanhGiaMaps').checked = !!task.danhGiaMaps;
    
    const coTuVan = !!task.coTuVanBanHang;
    document.getElementById('techEditCoTuVanBanHang').checked = coTuVan;
    
    const container = document.getElementById('techEditTuVanContainer');
    if (coTuVan) {
        container.classList.remove('hidden');
        document.getElementById('techEditNoiDungTuVan').value = task.noiDungTuVan || '';
    } else {
        container.classList.add('hidden');
        document.getElementById('techEditNoiDungTuVan').value = '';
    }

    document.getElementById('techEditTaskModal').classList.remove('hidden');
};

window.closeTechEditModal = () => {
    document.getElementById('techEditTaskModal').classList.add('hidden');
};

// 2. Lưu cập nhật checkbox và nội dung tư vấn lên nhánh managementTasks trên Firebase
window.saveTechTaskCriteria = (e) => {
    e.preventDefault();
    const taskId = document.getElementById('techEditTaskId').value;
    const coTuVan = document.getElementById('techEditCoTuVanBanHang').checked;

    const updatedCriteria = {
        chupAnh: document.getElementById('techEditChupAnh').checked,
        danhGiaMaps: document.getElementById('techEditDanhGiaMaps').checked,
        coTuVanBanHang: coTuVan,
        noiDungTuVan: coTuVan ? document.getElementById('techEditNoiDungTuVan').value.trim() : ''
    };

    update(ref(db, `managementTasks/${taskId}`), updatedCriteria)
        .then(() => {
            alert("Cập nhật tiêu chí thành công!");
            window.closeTechEditModal();
        })
        .catch(err => {
            alert("Lỗi: " + err.message);
        });
};

onValue(ref(db, 'staffs'), (s) => {
    allStaffsData = s.exists() ? s.val() : {};
    // Không cần render giao diện ở đây, chỉ cần dữ liệu sẵn sàng
});
// Xóa công việc
window.deleteTaskByTech = (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa công việc này không?")) {
        remove(ref(db, `managementTasks/${id}`))
            .then(() => alert("Đã xóa thành công!"))
            .catch(err => alert("Lỗi: " + err.message));
    }
};

// Mở modal sửa (tận dụng lại Modal đã có hoặc tạo mới nếu cần)
window.openEditTaskModal = (id) => {
    const task = allAssignedTasks[id];
    if (!task) return;

    document.getElementById('editTaskId').value = id;
    document.getElementById('editNgayTao').value = task.ngayTao || '';
    document.getElementById('editMaCv').value = task.maCv || '';
    document.getElementById('editTinhTrang').value = task.tinhTrang || '';
    document.getElementById('editKhachHang').value = task.khachHang || '';
    document.getElementById('editDienThoai').value = task.dienThoai || '';
    document.getElementById('editLoaiCv').value = task.loaiCv || '';
    document.getElementById('editUuTien').value = task.uuTien || '';
    document.getElementById('editNoiDung').value = task.noiDung || '';
    document.getElementById('editDeadline').value = task.deadline || '';
    document.getElementById('editNguoiTao').value = task.nguoiTao || '';
    document.getElementById('editGhiChu').value = task.ghiChu || '';

    // Đổ danh sách kỹ thuật vào select
    const options = Object.values(allStaffsData).map(st => `<option value="${st.name}">${st.name}</option>`).join('');
    document.getElementById('editKtPhuTrach').innerHTML = '<option value="">-- Chọn kỹ thuật --</option>' + options;
    document.getElementById('editKtHoTro').innerHTML = '<option value="">-- Không có hỗ trợ --</option>' + options;
    
    document.getElementById('editKtPhuTrach').value = task.ktPhuTrach || '';
    document.getElementById('editKtHoTro').value = task.ktHoTro || '';

    document.getElementById('editTaskModal').classList.remove('hidden');
};
// Mở modal thanh toán khi bấm Hoàn Thành
window.openPaymentModal = (id) => {
    const modal = document.getElementById('paymentModal');
    const taskIdInput = document.getElementById('payTaskId');
    if (taskIdInput) taskIdInput.value = id;
    
    const form = document.getElementById('paymentForm');
    if (form) form.reset();
    
    if (modal) modal.classList.remove('hidden');
};

// Đóng modal thanh toán
window.closePaymentModal = () => {
    const modal = document.getElementById('paymentModal');
    if (modal) modal.classList.add('hidden');
};

// Lưu thông tin thanh toán và chuyển trạng thái thành Đã hoàn thành lên Firebase
window.submitCompleteTaskWithPayment = (e) => {
    e.preventDefault();
    const id = document.getElementById('payTaskId').value;
    if (!id) return;

    // Lấy GPS mới nhất ngay tại thời điểm bấm hoàn thành
    getFreshGPS((freshGps) => {
        const task = allAssignedTasks[id] || {};
        let tangCaList = task.tangCaList || [];
        const nowISO = new Date().toISOString();

        // Tự động kết thúc các ca tăng ca đang chạy và gán GPS kết thúc mới nhất
        if (tangCaList.length > 0) {
            tangCaList = tangCaList.map(s => {
                if (s.trangThai === 'Đang tăng ca') {
                    return {
                        ...s,
                        ketThuc: nowISO,
                        gpsKetThuc: freshGps,
                        trangThai: 'Đã kết thúc'
                    };
                }
                return s;
            });
        }

        const paymentData = {
            tinhTrang: 'Đã hoàn thành',
            thoiGianKetThuc: nowISO,
            gpsHoanThanh: freshGps, // Cập nhật GPS hoàn thành mới nhất
            tangCaList: tangCaList,
            hinhThucThanhToan: document.getElementById('payHinhThuc')?.value || 'Tiền mặt',
            soTienThanhToan: Number(document.getElementById('paySoTien')?.value) || 0,
            ghiChuThanhToan: document.getElementById('payGhiChuPhi')?.value.trim() || '',
            thongTinHoTroThem: document.getElementById('payHoTro')?.value.trim() || '',
            tinhTrangCongNo: document.getElementById('payCongNo')?.value || 'Không',
            thoiGianBaoHanh: document.getElementById('payBaoHanh')?.value.trim() || ''
        };

        update(ref(db, `managementTasks/${id}`), paymentData)
            .then(() => {
                alert("Đã hoàn thành công việc và cập nhật GPS mới nhất thành công!");
                window.closePaymentModal();
                // 👉 GỬI THÔNG BÁO TELEGRAM KHI HOÀN THÀNH
                const mergedData = { ...task, ...paymentData };
                sendMobileTelegramNotification('complete', mergedData, `Đã hoàn thành. Thanh toán: ${paymentData.soTienThanhToan.toLocaleString()} VNĐ (${paymentData.hinhThucThanhToan})`);
            })
            .catch(err => {
                alert("Lỗi: " + err.message);
            });
    });
    // Tiến hành lấy vị trí GPS trước khi lưu dữ liệu
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const gps = `${position.coords.latitude}, ${position.coords.longitude}`;
            executeUpdate(gps);
        }, () => {
            executeUpdate("Không lấy được GPS");
        }, { enableHighAccuracy: true });
    } else {
        executeUpdate("Không hỗ trợ GPS");
    }
};
// Hàm hỗ trợ lấy GPS chính xác và mới nhất (không dùng cache cũ)
const getFreshGPS = (callback) => {
    if (!navigator.geolocation) {
        callback("Không hỗ trợ GPS");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const gpsStr = `${position.coords.latitude}, ${position.coords.longitude}`;
            callback(gpsStr);
        },
        (error) => {
            console.warn("Lỗi lấy GPS:", error.message);
            callback("Không lấy được GPS");
        },
        {
            enableHighAccuracy: true, // Bật chế độ định vị độ chính xác cao (GPS vệ tinh)
            maximumAge: 0,          // Không sử dụng vị trí cũ lưu trong cache
            timeout: 10000          // Đợi tối đa 10 giây
        }
    );
};
window.populateTelegramInput = () => {
    const inputEl = document.getElementById('accTelegramId');
    if (inputEl) {
        inputEl.focus();
        inputEl.value = currentUser.telegramId || '';
    }
};
window.saveTelegramIdOnly = () => {
    const newTelegramId = document.getElementById('accTelegramId').value.trim();

    if (!currentUser || !currentUser.firebaseId) {
        alert("Lỗi phiên đăng nhập, vui lòng đăng nhập lại!");
        return;
    }

    update(ref(db, `staffs/${currentUser.firebaseId}`), { telegramId: newTelegramId })
        .then(() => {
            alert("Cập nhật Telegram ID thành công!");
            currentUser.telegramId = newTelegramId;
            localStorage.setItem('techUser', JSON.stringify(currentUser));
            
            // Cập nhật lại dòng hiển thị phía trên
            document.getElementById('currentTelegramIdDisplay').textContent = newTelegramId || 'Chưa cập nhật';
        })
        .catch(err => {
            alert("Lỗi khi cập nhật Telegram ID: " + err.message);
        });
};
// Hàm Bật/Tắt ẩn hiện khung nhập ID khi bấm nút "Đổi ID"
window.toggleTelegramEdit = () => {
    const container = document.getElementById('telegramEditContainer');
    const inputEl = document.getElementById('accTelegramId');
    if (container) {
        container.classList.toggle('hidden');
        // Nếu container mở lên thì tự động điền sẵn ID hiện tại vào ô input và focus
        if (!container.classList.contains('hidden') && inputEl) {
            inputEl.value = currentUser.telegramId || '';
            inputEl.focus();
        }
    }
};
// Hàm Test gửi tin nhắn trực tiếp vào Telegram cá nhân vừa nhập
window.testPersonalBot = async () => {
    const testChatId = document.getElementById('accTelegramId').value.trim();
    
    if (!testChatId) {
        alert("Vui lòng nhập Chat ID cá nhân cần test!");
        return;
    }

    try {
        // Lấy cấu hình Token từ Firebase (giống như các hàm trước)
        const snapshot = await get(ref(db, 'settings/telegram'));
        if (!snapshot.exists()) {
            alert("Hệ thống chưa cấu hình Bot Telegram!");
            return;
        }
        const config = snapshot.val();
        if (!config.botToken) {
            alert("Thiếu Bot Token trong cấu hình hệ thống!");
            return;
        }

        const message = encodeURIComponent("🔔 *[TEST THÔNG BÁO CÁ NHÂN]*\n\nXin chào! Bot đã kết nối thành công với Telegram ID cá nhân của bạn.");
        const url = `https://api.telegram.org/bot${config.botToken}/sendMessage?chat_id=${testChatId}&text=${message}&parse_mode=Markdown`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.ok) {
            alert("Test thành công! Hãy kiểm tra tin nhắn Telegram cá nhân của bạn.");
        } else {
            alert("Test thất bại: " + (data.description || "Kiểm tra lại Chat ID hoặc bấm Start với bot trước."));
        }
    } catch (err) {
        alert("Lỗi kết nối: " + err.message);
    }
};
// 1. Tự động gán tháng hiện tại vào ô lọc khi khởi động
const filterAssignedMonthEl = document.getElementById('filterAssignedMonth');
if (filterAssignedMonthEl) {
    filterAssignedMonthEl.value = new Date().toISOString().slice(0, 7);
}

// 2. Bật/Tắt khung hiển thị bộ lọc nâng cao
window.toggleAssignedFilterBox = () => {
    const filterBox = document.getElementById('assignedFilterContainer');
    if (filterBox) {
        filterBox.classList.toggle('hidden');
    }
};

// 3. Đặt lại (Reset) bộ lọc về mặc định
window.resetAssignedFilter = () => {
    if (document.getElementById('filterAssignedCustomer')) document.getElementById('filterAssignedCustomer').value = "";
    if (document.getElementById('filterAssignedType')) document.getElementById('filterAssignedType').value = "";
    const filterAssignedMonthEl = document.getElementById('filterAssignedMonth');
    if (filterAssignedMonthEl) filterAssignedMonthEl.value = new Date().toISOString().slice(0, 7);
    window.filterAssignedTasks();
};
// 4. Hàm lọc dữ liệu công việc được giao
window.filterAssignedTasks = () => {
    renderAssignedTasks(); // Gọi lại hàm render có kèm điều kiện lọc
};
// ================= TÍNH NĂNG VUỐT RELOAD (PULL TO REFRESH) =================
let touchStartY = 0;
let isPulling = false;
const ptrIndicator = document.getElementById('ptrIndicator');

window.addEventListener('touchstart', (e) => {
    // Chỉ kích hoạt khi người dùng đang ở vị trí trên cùng của trang
    if (window.scrollY === 0) {
        touchStartY = e.touches[0].clientY;
        isPulling = true;
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (!isPulling) return;
    const currentY = e.touches[0].clientY;
    const pullDistance = currentY - touchStartY;

    // Nếu vuốt xuống dưới hơn 70px khi đang ở đỉnh trang
    if (pullDistance > 0 && window.scrollY === 0) {
        if (ptrIndicator) {
            // Hiển thị hiệu ứng kéo
            const translateVal = Math.min(pullDistance * 0.4, 60);
            ptrIndicator.style.transform = `translateY(${translateVal}px)`;
        }
    }
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (!isPulling) return;
    isPulling = false;

    if (ptrIndicator) {
        const currentTransform = ptrIndicator.style.transform;
        const match = currentTransform.match(/translateY\(([\d.]+)px\)/);
        const pulledPx = match ? parseFloat(match[1]) : 0;

        // Nếu vuốt đủ độ sâu (trên 40px) thì tiến hành làm mới
        if (pulledPx > 40) {
            if (ptrIndicator) ptrIndicator.style.transform = 'translateY(50px)';
            
            // Cập nhật trạng thái đang tải
            const ptrText = document.getElementById('ptrText');
            if (ptrText) ptrText.textContent = 'Đang làm mới dữ liệu...';

            // Thực hiện tải lại dữ liệu các tab đang hoạt động hoặc load lại trang
            setTimeout(() => {
                location.reload(); // Hoặc gọi các hàm load lại dữ liệu tương ứng
            }, 600);
        } else {
            // Trả về vị trí cũ nếu vuốt chưa đủ độ
            ptrIndicator.style.transform = 'translateY(-100%)';
        }
    }
}, { passive: true });
