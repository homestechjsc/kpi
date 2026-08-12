import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, get, ref, push, onValue, update, remove, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
let allTasksData = {};
let allStaffsData = {};
let appSettings = { taskTypes: ["Bảo trì", "Lắp đặt", "Sửa chữa", "Tư vấn"], priorities: ["Thấp", "Trung bình", "Cao", "Khẩn cấp"] };

// 1. Lắng nghe dữ liệu KPI từ Firebase
onValue(ref(db, 'kpis'), (s) => { 
    allKpiData = s.exists() ? s.val() : {}; 
    window.triggerDataLoad(); 
});

// 2. Lắng nghe dữ liệu Công việc quản lý[cite: 1]
onValue(ref(db, 'managementTasks'), (s) => { 
    allTasksData = s.exists() ? s.val() : {}; 
    allKpiData = allTasksData; 
    window.triggerDataLoad(); 
    renderAdminTasks();
    renderDashboard(); 
});

// 3. Lắng nghe Cài đặt hệ thống
onValue(ref(db, 'settings'), (s) => {
    if (s.exists()) {
        appSettings = s.val();
    }
    renderSettingsUI();
    populateDropdowns();
});

// 4. Lắng nghe dữ liệu Nhân sự
onValue(ref(db, 'staffs'), (s) => {
    allStaffsData = s.exists() ? s.val() : {};
    const tbody = document.getElementById('staffTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        if (Object.keys(allStaffsData).length > 0) {
            Object.entries(allStaffsData).forEach(([id, st]) => {
                const safeStaffJson = JSON.stringify(st).replace(/"/g, '&quot;');
                
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="p-4 pl-6 font-bold text-slate-800">${st.name || ''}</td>
                        <td class="p-4 text-slate-600 font-medium">${st.role || ''}</td>
                        <td class="p-4 text-emerald-600 font-bold">${st.username || ''}</td>
                        <td class="p-4 text-slate-400 font-mono">••••••</td>
                        
                        <!-- ĐOẠN CODE CỘT TELEGRAM ID VÀ NÚT TEST BOT ĐẶT Ở ĐÂY -->
                        <td class="p-4 text-blue-600 font-mono font-bold flex items-center gap-2">
                            <span>${st.telegramId || '<span class="text-slate-300 font-normal">Chưa có</span>'}</span>
                            ${st.telegramId ? `<button onclick="window.testTelegramBot('${st.telegramId}')" class="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition" title="Gửi tin nhắn test">Test Bot</button>` : ''}
                        </td>
                        
                        <td class="p-4 pr-6 text-center">
                            <div class="flex items-center justify-center gap-2">
                                <button onclick="window.openStaffModal('edit', '${id}', ${safeStaffJson})" class="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm" title="Sửa thông tin">
                                    <i class="fa-solid fa-pen"></i> Sửa
                                </button>
                                <button onclick="window.deleteStaff('${id}')" class="bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm" title="Xóa tài khoản">
                                    <i class="fa-solid fa-trash"></i> Xóa
                                </button>
                            </div>
                        </td>
                    </tr>`;
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-slate-400 font-medium">Chưa có tài khoản kỹ thuật nào trong hệ thống.</td></tr>`;
        }
    }
    populateDropdowns();
});

// 1. Lắng nghe và đồng bộ danh sách khách hàng từ nhánh 'customers' hoặc quét từ 'managementTasks'
let allCustomersData = {};

onValue(ref(db, 'managementTasks'), (snapshot) => {
    if (!snapshot.exists()) return;
    const tasks = snapshot.val();
    const uniqueCustomers = {};

    // Tự động thu thập khách hàng từ các công việc đã tạo
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
            // Ưu tiên cập nhật SĐT nếu có
            if (task.dienThoai && !uniqueCustomers[nameKey].phone) {
                uniqueCustomers[nameKey].phone = task.dienThoai;
            }
        }
    });

    allCustomersData = uniqueCustomers;
    renderCustomerTableAndDatalist();
});

// 2. Render bảng quản lý khách hàng và danh sách gợi ý chọn nhanh
function renderCustomerTableAndDatalist() {
    const tbody = document.getElementById('customerTableBody');
    const datalist = document.getElementById('customerSuggestions');
    
    if (tbody) tbody.innerHTML = '';
    if (datalist) datalist.innerHTML = '';

    const entries = Object.entries(allCustomersData);
    if (entries.length > 0) {
        entries.forEach(([key, cust]) => {
            // Đổ dữ liệu vào bảng Quản lý khách hàng
            if (tbody) {
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="p-4 pl-6 font-bold text-slate-800">${cust.name}</td>
                        <td class="p-4 text-slate-600">${cust.phone || 'N/A'}</td>
                        <td class="p-4 text-emerald-600 font-bold">${cust.count} công việc</td>
                        <td class="p-4 pr-6 text-center">
                            <span class="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-xl font-semibold">Hệ thống tự động lưu</span>
                        </td>
                    </tr>`;
            }
            // Đổ dữ liệu vào ô chọn nhanh khi tạo công việc
            if (datalist) {
                datalist.innerHTML += `<option value="${cust.name}">${cust.phone ? 'SĐT: ' + cust.phone : ''}</option>`;
            }
        });
    } else {
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-slate-400 font-medium">Chưa có dữ liệu khách hàng.</td></tr>`;
        }
    }
}

// Đổ dữ liệu vào các thẻ <select>
function populateDropdowns() {
    const staffSelect = document.getElementById('taskKtPhuTrach');
    const supportSelect = document.getElementById('taskKtHoTro');
    const typeSelect = document.getElementById('taskLoaiCv');
    const prioritySelect = document.getElementById('taskUuTien');

    if (staffSelect) staffSelect.innerHTML = '<option value="">-- Chọn kỹ thuật phụ trách --</option>' + Object.values(allStaffsData).map(st => `<option value="${st.name}">${st.name}</option>`).join('');
    if (supportSelect) supportSelect.innerHTML = '<option value="">-- Không có hỗ trợ --</option>' + Object.values(allStaffsData).map(st => `<option value="${st.name}">${st.name}</option>`).join('');

    if (typeSelect) {
        typeSelect.innerHTML = '<option value="">-- Chọn loại công việc --</option>';
        (appSettings.taskTypes || []).forEach(t => {
            typeSelect.innerHTML += `<option value="${t}">${t}</option>`;
        });
    }

    if (prioritySelect) {
        prioritySelect.innerHTML = '<option value="">-- Chọn mức ưu tiên --</option>';
        (appSettings.priorities || []).forEach(p => {
            prioritySelect.innerHTML += `<option value="${p}">${p}</option>`;
        });
    }
}

// 5. Trigger lọc dữ liệu KPI chờ duyệt theo tháng (Chỉ lấy các việc đã hoàn thành)
window.triggerDataLoad = () => {
    const monthInput = document.getElementById('filterMonth');
    if (!monthInput) return;
    const month = monthInput.value; // Định dạng "YYYY-MM"
    
    const entries = Object.entries(allKpiData).filter(([id, d]) => {
        const isCompleted = d.tinhTrang === 'Đã hoàn thành';
        const isRightMonth = d.thoiGianKetThuc && d.thoiGianKetThuc.startsWith(month);
        return isCompleted && isRightMonth;
    }).reverse();

    renderKpiTable(entries);
    renderReport(entries);
};

function renderKpiTable(entries) {
    const tbody = document.getElementById('adminKpiTable');
    if (!tbody) return;
    
    if (entries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-slate-400 font-medium">Không có công việc nào hoàn thành trong tháng này.</td></tr>`;
        return;
    }

    tbody.innerHTML = entries.map(([id, item]) => {
        const isChamped = item.diemKpi !== undefined && item.diemKpi !== null && Number(item.diemKpi) > 0;
        const rowBg = isChamped ? 'bg-white' : 'bg-emerald-50/20';

        // Tính thời gian hoàn thành (phút)
        let calcMinutes = 0;
        if (item.thoiGianBatDau && item.thoiGianKetThuc) {
            calcMinutes = Math.max(0, Math.round((new Date(item.thoiGianKetThuc) - new Date(item.thoiGianBatDau)) / 60000));
        }

        let tuVanInfo = item.coTuVanBanHang ? `
            <div class="text-[11px] text-indigo-700 bg-indigo-50/80 p-2 rounded-xl mt-1.5 border border-indigo-100 font-medium">
                <i class="fa-solid fa-comments mr-1"></i> <strong>Tư vấn:</strong> ${item.noiDungTuVan || 'Có tư vấn bán hàng'}
            </div>` : '';

        return `
            <tr class="${rowBg} hover:bg-slate-50 transition-colors border-b border-slate-100">
                <td class="p-4">
                    <div class="text-xs font-black text-slate-700">${item.thoiGianKetThuc ? item.thoiGianKetThuc.replace('T', ' ').substring(0, 10).split('-').reverse().join('/') : ''}</div>
                    <div class="text-xs font-bold text-emerald-600 mt-0.5">${item.ktPhuTrach || ''}</div>
                </td>
                <td class="p-4">
                    <div class="text-xs font-black text-blue-600">${item.maCv || ''}</div>
                    <div class="text-xs font-bold text-slate-800 mt-0.5">${item.khachHang || ''}</div>
                </td>
                <td class="p-4 max-w-xs">
                    <div class="text-xs text-slate-600 font-medium leading-relaxed">${item.noiDung || ''}</div>
                    ${tuVanInfo}
                </td>
                <td class="p-4 text-center">
                    <div class="flex justify-center items-center gap-2 text-base">
                        <i class="fa-solid fa-camera ${item.chupAnh ? 'text-emerald-500' : 'text-slate-200'}" title="Chụp ảnh/video"></i>
                        <i class="fa-solid fa-map ${item.danhGiaMaps ? 'text-blue-500' : 'text-slate-200'}" title="Đánh giá Maps"></i>
                    </div>
                </td>
                <td class="p-4 text-center text-xs font-extrabold text-slate-600">${calcMinutes}p</td>
                
                <!-- Điểm KPI -->
                <td class="p-3 text-center bg-emerald-50/30">
                    <input type="number" step="0.5" id="diem_${id}" value="${item.diemKpi || 0}" class="w-16 border border-emerald-200 bg-white rounded-xl p-2 text-center font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm">
                </td>
                
                <!-- Đánh giá từ Quản lý -->
                <td class="p-3 bg-emerald-50/30">
                    <input type="text" id="danhgia_${id}" value="${item.danhGiaAdmin || ''}" placeholder="Nhập đánh giá..." class="w-full border border-emerald-200 bg-white rounded-xl p-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 shadow-sm">
                </td>
                
                <td class="p-4 text-center">
                    <button onclick="window.saveReview('${id}')" class="bg-slate-900 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm active:scale-95">
                        <i class="fa-solid fa-check mr-1"></i> Lưu
                    </button>
                </td>
            </tr>`;
    }).join('');
}

// 6. Render Bảng Quản lý Công việc[cite: 1]
function renderAdminTasks() {
    const tbody = document.getElementById('adminTaskTableBody');
    if (!tbody) return;
    const entries = Object.entries(allTasksData).reverse();

    if (entries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-400 font-medium">Chưa có công việc nào được tạo.</td></tr>`;
        return;
    }

    tbody.innerHTML = entries.map(([id, task]) => {
        let statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
        if (task.tinhTrang === 'Đang thực hiện') statusColor = 'bg-blue-50 text-blue-700 border-blue-200';
        if (task.tinhTrang === 'Đã hoàn thành') statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (task.tinhTrang === 'Tạm ngưng') statusColor = 'bg-rose-50 text-rose-700 border-rose-200';

        // Hàm phụ để làm sạch định dạng thời gian (Cắt bỏ chữ T và phần mili-giây cho gọn)
        const formatTime = (timeStr) => {
            if (!timeStr) return '<span class="text-slate-400 italic">Chưa cập nhật</span>';
            return timeStr.replace('T', ' ').substring(0, 16);
        };

        // Tính tổng thời gian tăng ca từ danh sách tangCaList
        let totalTangCaMinutes = 0;
        let tangCaDetailsHtml = '';
        const tangCaList = task.tangCaList || [];

        if (tangCaList.length > 0) {
            tangCaList.forEach((ses, idx) => {
                let durationMin = 0;
                if (ses.batDau && ses.ketThuc) {
                    durationMin = Math.round((new Date(ses.ketThuc) - new Date(ses.batDau)) / 60000);
                    totalTangCaMinutes += durationMin;
                }
                tangCaDetailsHtml += `
                    <div class="bg-white p-3 rounded-2xl border border-amber-200/80 shadow-sm space-y-1.5">
                        <div class="flex justify-between items-center border-b border-amber-100 pb-1">
                            <span class="font-extrabold text-amber-900"><i class="fa-solid fa-business-time text-amber-600 mr-1"></i> Phiên tăng ca #${idx + 1}</span>
                            <span class="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">Dự kiến: ${ses.thoiGianDuKien || 0} phút</span>
                        </div>
                        <div class="text-[11px] text-slate-700 font-medium"><strong>Lý do:</strong> ${ses.lyDo || 'Không có lý do'}</div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-slate-500 pt-1">
                            <div class="bg-slate-50 p-1.5 rounded-xl border">
                                <span class="font-bold text-slate-600 block">Bắt đầu:</span> ${formatTime(ses.batDau)}
                                <div class="text-[9px] text-blue-600 font-mono mt-0.5"><i class="fa-solid fa-location-dot"></i> GPS: ${ses.gpsBatDau ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ses.gpsBatDau)}" target="_blank" class="underline font-bold">${ses.gpsBatDau} (Xem Map)</a>` : 'N/A'}</div>
                            </div>
                            <div class="bg-slate-50 p-1.5 rounded-xl border">
                                <span class="font-bold text-slate-600 block">Kết thúc:</span> ${formatTime(ses.ketThuc)}
                                <div class="text-[9px] text-emerald-600 font-mono mt-0.5"><i class="fa-solid fa-location-dot"></i> GPS: ${ses.gpsKetThuc ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ses.gpsKetThuc)}" target="_blank" class="underline font-bold">${ses.gpsKetThuc} (Xem Map)</a>` : 'N/A'}</div>
                            </div>
                        </div>
                        ${durationMin > 0 ? `<div class="text-[10px] font-black text-emerald-700 text-right pt-0.5">Thực tế tăng ca: ${durationMin} phút</div>` : ''}
                    </div>`;
            });
        } else {
            tangCaDetailsHtml = `<div class="text-center py-6 text-slate-400 italic bg-white rounded-2xl border border-dashed border-slate-200">Không có lịch sử tăng ca cho công việc này</div>`;
        }

        return `
            <!-- Dòng chính rút gọn -->
            <tr onclick="window.toggleRowDetail('${id}')" class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 cursor-pointer">
                <td class="p-3.5 font-bold text-slate-800">
                    <div>${task.ngayTao || ''}</div>
                    <div class="text-[10px] text-emerald-600 font-mono">${task.maCv || ''}</div>
                </td>
                <td class="p-3.5">
                    <div class="font-bold text-slate-900">${task.khachHang || ''}</div>
                    <div class="text-[11px] text-slate-400">SĐT: ${task.dienThoai || 'Chưa cập nhật'}</div>
                </td>
                <td class="p-3.5 max-w-xs text-slate-600 font-medium truncate">${task.noiDung || ''}</td>
                <td class="p-3.5 text-center">
                    <span class="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-[10px]">${task.uuTien || ''}</span>
                </td>
                <td class="p-3.5 text-center">
                    <span class="px-2.5 py-1 border rounded-full font-bold text-[10px] ${statusColor}">${task.tinhTrang || 'Chờ triển khai'}</span>
                </td>
                <td class="p-3.5 text-slate-600 font-medium">${task.nguoiTao || ''}</td>
                <td class="p-3.5 text-center space-x-1" onclick="event.stopPropagation()">
                    <button onclick="window.openTaskModal('${id}')" class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded-xl transition" title="Sửa">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="window.deleteTask('${id}')" class="text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 p-2 rounded-xl transition" title="Xóa">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>

            <!-- Phần mở rộng chuyên nghiệp (Accordion Details) -->
            <tr id="detail_${id}" class="hidden bg-slate-50/70 border-b border-slate-200">
                <td colspan="7" class="p-4">
                    <div class="bg-slate-100/80 p-4 rounded-3xl border border-slate-200 shadow-inner space-y-4 text-xs">
                        
                        <!-- Header thông tin thẻ -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
                                <div class="font-extrabold text-slate-800 border-b pb-1 mb-1.5 flex items-center gap-1.5">
                                    <i class="fa-solid fa-circle-info text-emerald-600"></i> Thông Tin Cơ Bản
                                </div>
                                <div><strong class="text-slate-500">Mã CV:</strong> <span class="font-mono font-bold text-emerald-700">${task.maCv || 'N/A'}</span></div>
                                <div><strong class="text-slate-500">Loại công việc:</strong> <span class="text-blue-600 font-bold">${task.loaiCv || 'N/A'}</span></div>
                                <div><strong class="text-slate-500">Số điện thoại:</strong> <a href="tel:${task.dienThoai}" class="text-blue-600 font-bold">${task.dienThoai || 'N/A'}</a></div>
                                <div><strong class="text-slate-500">Ghi chú:</strong> ${task.ghiChu || 'Không có'}</div>
                            </div>

                            <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
                                <div class="font-extrabold text-slate-800 border-b pb-1 mb-1.5 flex items-center gap-1.5">
                                    <i class="fa-solid fa-user-gear text-emerald-600"></i> Phân Công Nhân Sự
                                </div>
                                <div><strong class="text-slate-500">Phụ trách chính:</strong> <span class="font-bold text-slate-800 text-sm">${task.ktPhuTrach || 'Chưa phân công'}</span></div>
                                <div><strong class="text-slate-500">Kỹ thuật hỗ trợ:</strong> <span class="text-slate-700 font-semibold">${task.ktHoTro || 'Không'}</span></div>
                                <div><strong class="text-slate-500">Deadline CV:</strong> <span class="text-rose-600 font-bold">${task.deadline ? formatTime(task.deadline) : 'N/A'}</span></div>
                            </div>

                            <div class="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
                                <div class="font-extrabold text-slate-800 border-b pb-1 mb-1.5 flex items-center gap-1.5">
                                    <i class="fa-solid fa-location-crosshairs text-emerald-600"></i> Thời Gian & GPS Thực Tế
                                </div>
                                <div><strong class="text-slate-500">Bắt đầu CV:</strong> ${formatTime(task.thoiGianBatDau)}</div>
                                <div><strong class="text-slate-500">Kết thúc CV:</strong> ${formatTime(task.thoiGianKetThuc)}</div>
                                <div><strong class="text-slate-500">GPS Thực hiện:</strong> ${task.gpsThucHien ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.gpsThucHien)}" target="_blank" class="font-mono text-[11px] text-blue-600 underline font-bold hover:text-blue-800"><i class="fa-solid fa-map-location-dot mr-1"></i>${task.gpsThucHien} (Xem Map)</a>` : '<span class="text-slate-400 italic">Chưa có</span>'}</div>
<div><strong class="text-slate-500">GPS Hoàn thành:</strong> ${task.gpsHoanThanh ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.gpsHoanThanh)}" target="_blank" class="font-mono text-[11px] text-emerald-600 underline font-bold hover:text-emerald-800"><i class="fa-solid fa-map-location-dot mr-1"></i>${task.gpsHoanThanh} (Xem Map)</a>` : '<span class="text-slate-400 italic">Chưa có</span>'}</div>
                            </div>
                        </div>

                        <!-- Khối Quản lý Tăng Ca -->
                        <div class="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60 shadow-sm space-y-3">
                            <div class="flex justify-between items-center border-b border-amber-200/80 pb-2">
                                <span class="font-black text-amber-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                    <i class="fa-solid fa-business-time text-amber-600"></i> Quản Lý & Nhật Ký Tăng Ca
                                </span>
                                ${totalTangCaMinutes > 0 ? `<span class="bg-amber-600 text-white px-3 py-1 rounded-full font-extrabold text-[11px] shadow-sm">Tổng thời gian tăng ca: ${totalTangCaMinutes} phút</span>` : ''}
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                ${tangCaDetailsHtml}
                            </div>
                        </div>

                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Hàm bật/tắt hiển thị dòng chi tiết khi nhấp vào dòng chính
window.toggleRowDetail = (id) => {
    const detailRow = document.getElementById(`detail_${id}`);
    if (detailRow) {
        detailRow.classList.toggle('hidden');
    }
};

// 7. Render Cài đặt Danh mục[cite: 1]
function renderSettingsUI() {
    const taskTypeListEl = document.getElementById('settingTaskTypeList');
    const priorityListEl = document.getElementById('settingPriorityList');

    if (taskTypeListEl) {
        taskTypeListEl.innerHTML = (appSettings.taskTypes || []).map((t, idx) => `
            <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs font-semibold">
                <span>${t}</span>
                <button onclick="window.removeSettingItem('taskTypes', ${idx})" class="text-rose-500 hover:text-rose-700"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('');
    }

    if (priorityListEl) {
        priorityListEl.innerHTML = (appSettings.priorities || []).map((p, idx) => `
            <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs font-semibold">
                <span>${p}</span>
                <button onclick="window.removeSettingItem('priorities', ${idx})" class="text-rose-500 hover:text-rose-700"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('');
    }
}

window.addSettingItem = (e, type) => {
    e.preventDefault();
    const inputId = type === 'taskTypes' ? 'newSettingTaskType' : 'newSettingPriority';
    const val = document.getElementById(inputId).value.trim();
    if (!val) return;

    if (!appSettings[type]) appSettings[type] = [];
    appSettings[type].push(val);

    set(ref(db, 'settings'), appSettings).then(() => {
        document.getElementById(inputId).value = '';
        alert("Cập nhật danh mục thành công!");
    });
};

window.removeSettingItem = (type, idx) => {
    if (confirm("Bạn có chắc muốn xóa mục này?")) {
        appSettings[type].splice(idx, 1);
        set(ref(db, 'settings'), appSettings).then(() => alert("Đã xóa thành công!"));
    }
};

// 8. Quản lý Modal Công việc[cite: 1]
window.openTaskModal = (id = null) => {
    document.getElementById('editTaskId').value = '';
    document.getElementById('taskForm').reset();
    document.getElementById('taskNgayTao').value = new Date().toISOString().split('T')[0];

    if (id && allTasksData[id]) {
        const t = allTasksData[id];
        document.getElementById('editTaskId').value = id;
        document.getElementById('taskModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square text-emerald-600 mr-2"></i> Sửa Thông Tin Công Việc';
        document.getElementById('taskNgayTao').value = t.ngayTao || '';
        document.getElementById('taskMaCv').value = t.maCv || '';
        document.getElementById('taskTinhTrang').value = t.tinhTrang || 'Chờ triển khai';
        document.getElementById('taskKhachHang').value = t.khachHang || '';
        document.getElementById('taskDienThoai').value = t.dienThoai || '';
        document.getElementById('taskLoaiCv').value = t.loaiCv || '';
        document.getElementById('taskNoiDung').value = t.noiDung || '';
        document.getElementById('taskUuTien').value = t.uuTien || '';
        document.getElementById('taskDeadline').value = t.deadline || '';
        document.getElementById('taskKtPhuTrach').value = t.ktPhuTrach || '';
        document.getElementById('taskKtHoTro').value = t.ktHoTro || '';
        document.getElementById('taskNguoiTao').value = t.nguoiTao || '';
        document.getElementById('taskGhiChu').value = t.ghiChu || '';
        
        // Gán dữ liệu ẩn (thời gian & GPS)
        document.getElementById('taskThoiGianBatDau').value = t.thoiGianBatDau || '';
        document.getElementById('taskThoiGianKetThuc').value = t.thoiGianKetThuc || '';
        document.getElementById('taskBatDauTangCa').value = t.batDauTangCa || '';
        document.getElementById('taskKetThucTangCa').value = t.ketThucTangCa || '';
        document.getElementById('taskGpsThucHien').value = t.gpsThucHien || '';
        document.getElementById('taskGpsTamNgung').value = t.gpsTamNgung || '';
        document.getElementById('taskGpsHoanThanh').value = t.gpsHoanThanh || '';
    } else {
        document.getElementById('taskModalTitle').innerHTML = '<i class="fa-solid fa-tasks text-emerald-600 mr-2"></i> Tạo Mới Công Việc';
        document.getElementById('taskTinhTrang').value = 'Chờ triển khai';
        
        // Tự động sinh mã CV mới
        const totalExistingTasks = Object.keys(allTasksData).length;
        const autoCode = `CV-${String(totalExistingTasks + 1).padStart(2, '0')}`;
        document.getElementById('taskMaCv').value = autoCode;
    }
    document.getElementById('taskModal').classList.remove('hidden');
};

window.closeTaskModal = () => {
    document.getElementById('taskModal').classList.add('hidden');
};

window.saveTask = (e) => {
    e.preventDefault();
    const id = document.getElementById('editTaskId').value;
    const existingTask = (id && allTasksData[id]) ? allTasksData[id] : {};

    const taskData = {
        ngayTao: document.getElementById('taskNgayTao').value,
        maCv: document.getElementById('taskMaCv').value.trim(),
        tinhTrang: document.getElementById('taskTinhTrang').value,
        khachHang: document.getElementById('taskKhachHang').value.trim(),
        dienThoai: document.getElementById('taskDienThoai').value.trim(),
        loaiCv: document.getElementById('taskLoaiCv').value,
        noiDung: document.getElementById('taskNoiDung').value.trim(),
        uuTien: document.getElementById('taskUuTien').value,
        deadline: document.getElementById('taskDeadline').value,
        ktPhuTrach: document.getElementById('taskKtPhuTrach').value,
        ktHoTro: document.getElementById('taskKtHoTro').value,
        nguoiTao: document.getElementById('taskNguoiTao').value.trim(),
        ghiChu: document.getElementById('taskGhiChu').value.trim(),
        
        // Giữ lại hoặc cập nhật các trường thời gian & GPS ẩn
        thoiGianBatDau: document.getElementById('taskThoiGianBatDau').value || existingTask.thoiGianBatDau || '',
        thoiGianKetThuc: document.getElementById('taskThoiGianKetThuc').value || existingTask.thoiGianKetThuc || '',
        batDauTangCa: document.getElementById('taskBatDauTangCa').value || existingTask.batDauTangCa || '',
        ketThucTangCa: document.getElementById('taskKetThucTangCa').value || existingTask.ketThucTangCa || '',
        gpsThucHien: document.getElementById('taskGpsThucHien').value.trim() || existingTask.gpsThucHien || '',
        gpsTamNgung: document.getElementById('taskGpsTamNgung').value.trim() || existingTask.gpsTamNgung || '',
        gpsHoanThanh: document.getElementById('taskGpsHoanThanh').value.trim() || existingTask.gpsHoanThanh || ''
    };

    if (id) {
        update(ref(db, `managementTasks/${id}`), taskData).then(() => {
            alert("Cập nhật công việc thành công!");
            window.closeTaskModal();
        });
    } else {
        push(ref(db, 'managementTasks'), taskData).then(() => {
            alert("Tạo mới công việc thành công!");
            window.closeTaskModal();
            window.sendTelegramNotification('create', taskData, 'Hãy tiếp nhận và xử lý công việc.');
        });
    }
};

window.deleteTask = (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa công việc này không?")) {
        remove(ref(db, `managementTasks/${id}`)).then(() => alert("Đã xóa thành công!"));
    }
};

// 9. Render Báo Cáo Tổng Hợp Tháng Theo Nhân Sự
function renderReport(entries) {
    const sum = {};
    entries.forEach(([id, i]) => {
        const kt = i.ktPhuTrach || 'Khác';
        if (!sum[kt]) sum[kt] = { cv: 0, t: 0, ph: 0, ma: 0, tv: 0, sc: 0 };
        sum[kt].cv++; 
        sum[kt].t += Number(i.thoiGian) || 0;
        if (i.chupAnh) sum[kt].ph++; 
        if (i.danhGiaMaps) sum[kt].ma++; 
        if (i.coTuVanBanHang) sum[kt].tv++;
        sum[kt].sc += Number(i.diemKpi) || 0;
    });

    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return;

    if (Object.keys(sum).length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-400 font-medium">Chưa có dữ liệu báo cáo trong tháng này.</td></tr>`;
        return;
    }

    tbody.innerHTML = Object.entries(sum).map(([n, d]) => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 font-medium">
            <td class="p-3.5 font-bold text-slate-800">${n}</td>
            <td class="p-3.5 text-center font-bold text-slate-600">${d.cv}</td>
            <td class="p-3.5 text-center font-bold text-slate-600">${d.t}</td>
            <td class="p-3.5 text-center text-emerald-600 font-bold">${d.ph}</td>
            <td class="p-3.5 text-center text-blue-600 font-bold">${d.ma}</td>
            <td class="p-3.5 text-center text-indigo-600 font-bold">${d.tv}</td>
            <td class="p-3.5 text-center text-amber-600 font-black text-base">${d.sc}</td>
        </tr>`).join('');
}

// 10. Actions
window.saveReview = (id) => {
    const diemEl = document.getElementById(`diem_${id}`);
    const danhGiaEl = document.getElementById(`danhgia_${id}`);
    if (!diemEl || !danhGiaEl) return;
    
    // Đảm bảo cập nhật chính xác vào nhánh managementTasks
    update(ref(db, `managementTasks/${id}`), { 
        diemKpi: Number(diemEl.value), 
        danhGiaAdmin: danhGiaEl.value 
    }).then(() => {
        alert("Cập nhật điểm và đánh giá KPI thành công!");
    }).catch(error => {
        alert("Lỗi: " + error.message);
    });
};

window.addStaff = (e) => {
    e.preventDefault();

    // Gom dữ liệu nhân sự bao gồm cả Telegram ID
    const staffPayload = {
        name: document.getElementById('staffName').value.trim(),
        role: document.getElementById('staffRole').value.trim(),
        username: document.getElementById('staffUsername').value.trim(),
        password: document.getElementById('staffPassword').value.trim(),
        telegramId: document.getElementById('staffTelegramId').value.trim() // Lưu Chat ID
    };

    const originalUsername = document.getElementById('editStaffOriginalUsername').value;
    const targetKey = originalUsername || staffPayload.username;

    if (!targetKey) {
        alert("Vui lòng nhập tài khoản đăng nhập!");
        return;
    }

    // Đẩy dữ liệu lên Firebase tại nhánh staffs/${targetKey}
    set(ref(db, `staffs/${targetKey}`), staffPayload)
        .then(() => {
            alert("Đã lưu thông tin nhân sự thành công!");
            window.closeStaffModal();
        })
        .catch((err) => {
            alert("Lỗi: " + err.message);
        });
};

window.deleteStaff = (id) => { 
    if (confirm("Bạn có chắc chắn muốn xóa tài khoản kỹ thuật này không?")) { 
        remove(ref(db, `staffs/${id}`)); 
    } 
};

window.switchTab = (tab) => {
    // Ẩn tất cả các tab nội dung
    document.querySelectorAll('.tab-content').forEach(d => d.classList.add('hidden'));
    const targetTab = document.getElementById(tab);
    if (targetTab) targetTab.classList.remove('hidden');

    // Reset tất cả các nút menu về trạng thái chưa chọn (chữ sáng, hover sáng mờ)
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('bg-white', 'text-emerald-900', 'shadow-md', 'font-extrabold');
        b.classList.add('text-emerald-100', 'font-bold', 'hover:bg-white/10');
    });
    
    // Highlight nút menu đang được chọn (nền trắng, chữ xanh đậm, có bóng nhẹ)
    const activeBtn = document.getElementById('nav_' + tab);
    if (activeBtn) {
        activeBtn.classList.remove('text-emerald-100', 'font-bold', 'hover:bg-white/10');
        activeBtn.classList.add('bg-white', 'text-emerald-900', 'shadow-md', 'font-extrabold');
    }
    
    // Cập nhật tiêu đề Header tương ứng
    const titles = { 
        'dashboardTab': 'Dashboard Tổng Quan Tình Trạng Công Việc',
        'kpiTab': 'Duyệt & Chấm Điểm KPI', 
        'taskTab': 'Quản Lý Danh Sách Công Việc',
        'reportTab': 'Báo Cáo Tổng Hợp Hiệu Suất', 
        'staffTab': 'Quản Lý Nhân Sự & Tài Khoản',
        'customerTab': 'Quản Lý Danh Sách Khách Hàng',
        'settingsTab': 'Cài Đặt Danh Mục Hệ Thống'
    };
    const titleEl = document.getElementById('headerTitle');
    if (titleEl && titles[tab]) titleEl.textContent = titles[tab];
};
// Hàm tính toán và hiển thị số liệu tổng quan lên Dashboard
// Hàm tính toán và hiển thị Dashboard tổng quan chuyên nghiệp
function renderDashboard() {
    const monthInput = document.getElementById('filterMonth');
    const selectedMonth = monthInput ? monthInput.value : new Date().toISOString().slice(0, 7);

    let total = 0, waiting = 0, inProgress = 0, paused = 0, completed = 0;
    const staffStats = {};
    
    const listWaiting = document.getElementById('listWaitingTasks');
    const listInProgress = document.getElementById('listInProgressTasks');
    const listPaused = document.getElementById('listPausedTasks');
    
    if (listWaiting) listWaiting.innerHTML = '';
    if (listInProgress) listInProgress.innerHTML = '';
    if (listPaused) listPaused.innerHTML = '';

    let waitingItems = 0, inProgressItems = 0, pausedItems = 0;

    Object.entries(allTasksData || {}).forEach(([id, task]) => {
        if (!task.ngayTao || !task.ngayTao.startsWith(selectedMonth)) return;
        
        total++;
        const status = task.tinhTrang || 'Chờ triển khai';
        
        if (status === 'Chờ triển khai') {
            waiting++;
            waitingItems++;
            if (listWaiting) {
                listWaiting.innerHTML += `
                    <div class="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl space-y-1 text-xs">
                        <div class="flex justify-between font-bold text-slate-800">
                            <span>${task.maCv} - ${task.khachHang}</span>
                            <span class="text-amber-600">${task.uuTien || ''}</span>
                        </div>
                        <div class="text-slate-600 truncate">${task.noiDung}</div>
                        <div class="text-[10px] text-slate-400 flex justify-between pt-1">
                            <span>Phụ trách: <strong>${task.ktPhuTrach || 'Chưa phân công'}</strong></span>
                            <span>${task.ngayTao}</span>
                        </div>
                    </div>`;
            }
        } else if (status === 'Đang thực hiện') {
            inProgress++;
            inProgressItems++;
            if (listInProgress) {
                listInProgress.innerHTML += `
                    <div class="bg-blue-50/50 border border-blue-200/80 p-3 rounded-2xl space-y-1 text-xs">
                        <div class="flex justify-between font-bold text-slate-800">
                            <span>${task.maCv} - ${task.khachHang}</span>
                            <span class="text-blue-600 animate-pulse font-bold">Đang làm</span>
                        </div>
                        <div class="text-slate-600 truncate">${task.noiDung}</div>
                        <div class="text-[10px] text-slate-400 flex justify-between pt-1">
                            <span>Phụ trách: <strong>${task.ktPhuTrach || 'Chưa phân công'}</strong></span>
                            <span>Bắt đầu: ${task.thoiGianBatDau ? task.thoiGianBatDau.replace('T', ' ').substring(11, 16) : 'N/A'}</span>
                        </div>
                    </div>`;
            }
        } else if (status === 'Tạm ngưng') {
            paused++;
            pausedItems++;
            if (listPaused) {
                listPaused.innerHTML += `
                    <div class="bg-rose-50/50 border border-rose-200/80 p-3 rounded-2xl space-y-1 text-xs">
                        <div class="flex justify-between font-bold text-slate-800">
                            <span>${task.maCv} - ${task.khachHang}</span>
                            <span class="text-rose-600 font-bold">Tạm ngưng</span>
                        </div>
                        <div class="text-slate-600 truncate">${task.noiDung}</div>
                        <div class="text-[10px] text-slate-400 flex justify-between pt-1">
                            <span>Phụ trách: <strong>${task.ktPhuTrach || 'Chưa phân công'}</strong></span>
                            <span>${task.ngayTao}</span>
                        </div>
                    </div>`;
            }
        } else if (status === 'Đã hoàn thành') {
            completed++;
        }

        // Thống kê theo nhân sự phụ trách
        const kt = task.ktPhuTrach || 'Chưa phân công';
        if (!staffStats[kt]) {
            staffStats[kt] = { waiting: 0, inProgress: 0, completed: 0, paused: 0, total: 0, workMinutes: 0, overtimeMinutes: 0 };
        }

        staffStats[kt].total++;
        if (status === 'Chờ triển khai') staffStats[kt].waiting++;
        else if (status === 'Đang thực hiện') staffStats[kt].inProgress++;
        else if (status === 'Đã hoàn thành') staffStats[kt].completed++;
        else if (status === 'Tạm ngưng') staffStats[kt].paused++;

        // Tính thời gian làm việc thực tế
        if (task.thoiGianBatDau && task.thoiGianKetThuc) {
            const mins = Math.max(0, Math.round((new Date(task.thoiGianKetThuc) - new Date(task.thoiGianBatDau)) / 60000));
            staffStats[kt].workMinutes += mins;
        }

        // Tính thời gian tăng ca
        if (task.tangCaList && Array.isArray(task.tangCaList)) {
            task.tangCaList.forEach(ses => {
                if (ses.batDau && ses.ketThuc) {
                    const otMins = Math.max(0, Math.round((new Date(ses.ketThuc) - new Date(ses.batDau)) / 60000));
                    staffStats[kt].overtimeMinutes += otMins;
                }
            });
        }
    });

    // Cập nhật Widget số lượng
    document.getElementById('dashTotalTasks').textContent = total;
    document.getElementById('dashWaiting').textContent = waiting;
    document.getElementById('dashInProgress').textContent = inProgress;
    document.getElementById('dashPaused').textContent = paused;

    document.getElementById('badgeWaitingCount').textContent = waitingItems;
    document.getElementById('badgeInProgressCount').textContent = inProgressItems;
    document.getElementById('badgePausedCount').textContent = pausedItems;

    if (waitingItems === 0 && listWaiting) listWaiting.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">Không có việc chờ.</p>';
    if (inProgressItems === 0 && listInProgress) listInProgress.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">Không có việc đang làm.</p>';
    if (pausedItems === 0 && listPaused) listPaused.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">Không có việc tạm ngưng.</p>';

    // Render Biểu đồ thanh tỷ lệ khối lượng công việc theo nhân sự
    const chartContainer = document.getElementById('dashWorkloadChart');
    if (chartContainer) {
        chartContainer.innerHTML = '';
        const staffEntries = Object.entries(staffStats);
        if (staffEntries.length === 0) {
            chartContainer.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">Chưa có dữ liệu biểu đồ.</p>';
        } else {
            const maxTaskCount = Math.max(...staffEntries.map(([_, s]) => s.total), 1);
            staffEntries.forEach(([name, stat]) => {
                const percent = Math.round((stat.total / maxTaskCount) * 100);
                chartContainer.innerHTML += `
                    <div class="space-y-1 text-xs">
                        <div class="flex justify-between font-bold text-slate-700">
                            <span>${name}</span>
                            <span class="text-emerald-700">${stat.total} công việc (Xong: ${stat.completed}, Đang làm: ${stat.inProgress})</span>
                        </div>
                        <div class="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                            <div class="bg-emerald-500 h-full" style="width: ${Math.round((stat.completed/stat.total)*100 || 0)}%" title="Hoàn thành"></div>
                            <div class="bg-blue-500 h-full" style="width: ${Math.round((stat.inProgress/stat.total)*100 || 0)}%" title="Đang thực hiện"></div>
                            <div class="bg-amber-500 h-full" style="width: ${Math.round((stat.waiting/stat.total)*100 || 0)}%" title="Chờ triển khai"></div>
                            <div class="bg-rose-500 h-full" style="width: ${Math.round((stat.paused/stat.total)*100 || 0)}%" title="Tạm ngưng"></div>
                        </div>
                    </div>`;
            });
        }
    }

    // Render Bảng tổng hợp tổng thời gian làm việc
    const tbody = document.getElementById('dashStaffSummaryTable');
    if (tbody) {
        const staffEntries = Object.entries(staffStats);
        if (staffEntries.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-400 font-medium">Không có dữ liệu trong tháng này.</td></tr>`;
        } else {
            tbody.innerHTML = staffEntries.map(([name, stat]) => `
                <tr class="border-b border-slate-100 hover:bg-slate-50 font-medium">
                    <td class="p-3.5 font-bold text-slate-800">${name}</td>
                    <td class="p-3.5 text-center text-amber-600 font-bold">${stat.waiting}</td>
                    <td class="p-3.5 text-center text-blue-600 font-bold">${stat.inProgress}</td>
                    <td class="p-3.5 text-center text-emerald-600 font-bold">${stat.completed}</td>
                    <td class="p-3.5 text-center text-rose-600 font-bold">${stat.paused}</td>
                    <td class="p-3.5 text-center font-extrabold text-teal-700">${stat.workMinutes} phút</td>
                    <td class="p-3.5 text-center font-extrabold text-amber-600">${stat.overtimeMinutes} phút</td>
                </tr>
            `).join('');
        }
    }
}

// Tự động gán tháng hiện tại cho bộ lọc kỳ (định dạng YYYY-MM)
window.addEventListener('DOMContentLoaded', () => {
    const filterMonthInput = document.getElementById('filterMonth');
    if (filterMonthInput && !filterMonthInput.value) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        filterMonthInput.value = `${year}-${month}`;
        
        // Gọi hàm tải dữ liệu tương ứng với tháng hiện tại
        if (typeof window.triggerDataLoad === 'function') {
            window.triggerDataLoad();
        }
    }
});
// Mở modal Thêm hoặc Sửa nhân sự
window.openStaffModal = (mode, staffId = null, staffData = null) => {
    const modal = document.getElementById('staffModal');
    const title = document.getElementById('staffModalTitle');
    const form = document.getElementById('staffForm');
    form.reset();

    if (mode === 'add') {
        title.innerHTML = `<i class="fa-solid fa-user-plus text-emerald-600"></i> Thêm Tài Khoản Kỹ Thuật Mới`;
        document.getElementById('editStaffOriginalUsername').value = '';
        document.getElementById('staffUsername').disabled = false;
        document.getElementById('staffTelegramId').value = '';
    } else if (mode === 'edit' && staffData) {
        title.innerHTML = `<i class="fa-solid fa-user-pen text-emerald-600"></i> Chỉnh Sửa Thông Tin Nhân Sự`;
        document.getElementById('editStaffOriginalUsername').value = staffId;
        document.getElementById('staffName').value = staffData.name || '';
        document.getElementById('staffRole').value = staffData.role || '';
        document.getElementById('staffUsername').value = staffData.username || '';
        document.getElementById('staffPassword').value = staffData.password || '';
        document.getElementById('staffTelegramId').value = staffData.telegramId || ''; // Đổ dữ liệu Telegram ID
        document.getElementById('staffUsername').disabled = true; 
    }

    if (modal) modal.classList.remove('hidden');
};

// Đóng modal nhân sự
window.closeStaffModal = () => {
    const modal = document.getElementById('staffModal');
    if (modal) modal.classList.add('hidden');
};
// 1. Lọc danh sách khách hàng khi người dùng gõ chữ vào ô input
window.filterCustomerSuggestions = (keyword) => {
    const dropdown = document.getElementById('customerDropdownList');
    if (!dropdown) return;

    const term = keyword.toLowerCase().trim();
    if (!term) {
        dropdown.classList.add('hidden');
        return;
    }

    // Lọc từ kho dữ liệu khách hàng toàn cục (allCustomersData)
    const matches = Object.values(allCustomersData).filter(cust => 
        cust.name.toLowerCase().includes(term) || (cust.phone && cust.phone.includes(term))
    );

    if (matches.length > 0) {
        dropdown.innerHTML = '';
        matches.forEach(cust => {
            const div = document.createElement('div');
            div.className = 'p-3 hover:bg-emerald-50 cursor-pointer flex justify-between items-center transition text-xs';
            div.innerHTML = `
                <span class="font-bold text-slate-800">${cust.name}</span>
                <span class="text-slate-400 font-medium">${cust.phone ? 'SĐT: ' + cust.phone : 'Chưa có SĐT'}</span>
            `;
            // Khi bấm vào một khách hàng trong danh sách gợi ý
            div.onclick = () => {
                document.getElementById('taskKhachHang').value = cust.name;
                // Nếu form có ô số điện thoại, tự động điền luôn số điện thoại cũ của khách đó
                const phoneInput = document.getElementById('taskDienThoai');
                if (phoneInput) phoneInput.value = cust.phone || '';
                
                dropdown.classList.add('hidden');
            };
            dropdown.appendChild(div);
        });
        dropdown.classList.remove('hidden');
    } else {
        dropdown.classList.add('hidden');
    }
};

// 2. Ẩn khung gợi ý khi người dùng click ra ngoài màn hình
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('customerDropdownList');
    const input = document.getElementById('taskKhachHang');
    if (dropdown && input && !input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});
window.testTelegramBot = (chatId) => {
    if (!chatId) {
        alert("Nhân sự này chưa có Chat ID Telegram!");
        return;
    }

    // Đã thay thế bằng Bot Token thực tế của bạn
    const botToken = "8658570129:AAF6ggZ8G6bO0TS5BP18H2JuIpc2gTcoBc8"; 
    const message = encodeURIComponent("🔔 *KPI MASTER*: Đây là tin nhắn test kết nối Telegram thành công từ hệ thống quản trị kỹ thuật!");

    const url = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${message}&parse_mode=Markdown`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                alert("Đã gửi tin nhắn test thành công đến Telegram (Chat ID: " + chatId + ")!");
            } else {
                alert("Gửi thất bại: " + (data.description || "Lỗi không xác định"));
            }
        })
        .catch(error => {
            alert("Lỗi kết nối API Telegram: " + error.message);
        });
};
window.saveStaff = (e) => {
    e.preventDefault();

    // 1. Lấy dữ liệu từ các ô input trong modal
    const name = document.getElementById('staffName').value.trim();
    const role = document.getElementById('staffRole').value.trim();
    const username = document.getElementById('staffUsername').value.trim();
    const password = document.getElementById('staffPassword').value.trim();
    const telegramId = document.getElementById('staffTelegramId').value.trim();
    const originalUsername = document.getElementById('editStaffOriginalUsername').value;

    if (!username || !name) {
        alert("Vui lòng điền đầy đủ Tên và Tài khoản!");
        return;
    }

    const staffPayload = {
        name: name,
        role: role,
        username: username,
        password: password,
        telegramId: telegramId
    };

    // 2. Xác định đường dẫn Firebase: Nếu sửa thì dùng ID cũ, nếu thêm mới thì dùng username mới
    const targetKey = originalUsername || username;
    const staffRef = ref(db, `staffs/${targetKey}`);

    // 3. Tiến hành ghi dữ liệu lên Firebase
    set(staffRef, staffPayload)
        .then(() => {
            alert("Lưu thông tin nhân sự thành công!");
            window.closeStaffModal(); // Đóng modal sau khi lưu xong
        })
        .catch((err) => {
            alert("Lỗi khi lưu dữ liệu: " + err.message);
        });
};
// Hàm gửi thông báo Telegram tổng quát
window.sendTelegramNotification = async (actionType, taskData, extraMessage = '') => {
    try {
        // 1. Lấy cấu hình Telegram từ Firebase
        const snapshot = await get(ref(db, 'settings/telegram'));
        if (!snapshot.exists()) return;
        const config = snapshot.val();
        if (!config.botToken) return;

        // 2. Xác định cấu hình và tiêu đề dựa trên actionType
        let isEnabled = false;
        let actionTitle = '';
        let emoji = '📌';

        switch (actionType) {
            case 'create': isEnabled = config.notifOnCreate; actionTitle = 'CÔNG VIỆC MỚI'; emoji = '✨'; break;
            case 'inprogress': isEnabled = config.notifOnInProgress; actionTitle = 'BẮT ĐẦU THỰC HIỆN'; emoji = '🚀'; break;
            case 'pause': isEnabled = config.notifOnPause; actionTitle = 'TẠM NGƯNG CÔNG VIỆC'; emoji = '⏸️'; break;
            case 'complete': isEnabled = config.notifOnComplete; actionTitle = 'HOÀN THÀNH CÔNG VIỆC'; emoji = '✅'; break;
            case 'start_overtime': isEnabled = config.notifOnStartOvertime; actionTitle = 'BẮT ĐẦU TĂNG CA'; emoji = '⏱️'; break;
            case 'end_overtime': isEnabled = config.notifOnEndOvertime; actionTitle = 'KẾT THÚC TĂNG CA'; emoji = '🏁'; break;
        }

        if (!isEnabled) return;

        // 3. Chuẩn bị danh sách Chat ID (Nhóm quản lý + Kỹ thuật phụ trách + Kỹ thuật hỗ trợ)
        let chatIdsToSend = [];
        if (config.adminChatId) chatIdsToSend.push(config.adminChatId);

        // Tìm Chat ID từ nhánh 'staffs'
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
        // 4. Định dạng nội dung tin nhắn
        let staffLine = `🛠️ *Kỹ thuật:* ${taskData.ktPhuTrach || 'N/A'}`;
        if (taskData.ktHoTro && taskData.ktHoTro !== "") {
            staffLine += ` + ${taskData.ktHoTro} (Hỗ trợ)`;
        }

        const message = encodeURIComponent(
            `${emoji} *[THÔNG BÁO ${actionTitle}]*\n\n` +
            `📋 *Mã CV:* ${taskData.maCv || 'N/A'}\n` +
            `👤 *Khách hàng:* ${taskData.khachHang || 'N/A'}\n` +
            `${staffLine}\n` +
            `📝 *Nội dung:* ${taskData.noiDung || 'N/A'}\n` + 
            (extraMessage ? `💬 *Ghi chú:* ${extraMessage}\n` : '') +
            `🕒 *Thời gian:* ${new Date().toLocaleString('vi-VN')}`
        );

        // 5. Gửi tin nhắn cho tất cả các Chat ID đã lấy được
        // Loại bỏ các ID trùng lặp (nếu Admin cũng là kỹ thuật viên)
        const uniqueChatIds = [...new Set(chatIdsToSend)];
        
        for (const chatId of uniqueChatIds) {
            const url = `https://api.telegram.org/bot${config.botToken}/sendMessage?chat_id=${chatId}&text=${message}&parse_mode=Markdown`;
            fetch(url).catch(err => console.error("Lỗi gửi Telegram cho " + chatId, err));
        }

    } catch (error) {
        console.error("Lỗi hệ thống thông báo Telegram:", error);
    }
};
window.saveTelegramSettings = () => {
    const settingsData = {
        botToken: document.getElementById('settingBotToken').value.trim(),
        adminChatId: document.getElementById('settingAdminChatId').value.trim(),
        notifOnCreate: document.getElementById('notifOnCreate')?.checked || false,
        notifOnInProgress: document.getElementById('notifOnInProgress')?.checked || false,
        notifOnPause: document.getElementById('notifOnPause')?.checked || false,
        notifOnStartOvertime: document.getElementById('notifOnStartOvertime')?.checked || false,
        notifOnEndOvertime: document.getElementById('notifOnEndOvertime')?.checked || false,
        notifOnComplete: document.getElementById('notifOnComplete')?.checked || false,
        notifOnKpi: document.getElementById('notifOnKpi')?.checked || false
    };

    set(ref(db, 'settings/telegram'), settingsData)
        .then(() => {
            alert("Đã lưu cấu hình thông báo Telegram thành công!");
        })
        .catch((err) => {
            alert("Lỗi khi lưu cài đặt: " + err.message);
        });
};
window.testBot = async (telegramId) => {
    try {
        const botToken = "8658570129:AAF6ggZ8G6bO0TS5BP18H2JuIpc2gTcoBc8";

        if (!telegramId) {
            alert("Kỹ thuật viên này chưa có Telegram ID!");
            return;
        }

        const message = encodeURIComponent("🔔 *[TEST THÔNG BÁO]*\n\nXin chào! Hệ thống quản lý KPI HomesTech đã kết nối thành công với Telegram của bạn.");
        const url = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${telegramId}&text=${message}&parse_mode=Markdown`;

        console.log("Đang gọi URL:", url); // Kiểm tra trong Console (F12)

        const response = await fetch(url);
        const data = await response.json();

        console.log("Kết quả từ Telegram:", data); // Kiểm tra trong Console (F12)

        if (data.ok) {
            alert("Test Bot thành công! Hãy kiểm tra tin nhắn trên Telegram của bạn.");
        } else {
            alert("Telegram từ chối gửi: " + data.description);
        }
    } catch (err) {
        alert("Lỗi mạng/CORS: " + err.message);
    }
};

// Hàm tải cấu hình Telegram từ Firebase lên giao diện cài đặt
function loadTelegramSettings() {
    onValue(ref(db, 'settings/telegram'), (snapshot) => {
        if (!snapshot.exists()) return;
        const config = snapshot.val();

        // Đổ dữ liệu vào các ô input và checkbox
        if (document.getElementById('settingBotToken')) document.getElementById('settingBotToken').value = config.botToken || '';
        if (document.getElementById('settingAdminChatId')) document.getElementById('settingAdminChatId').value = config.adminChatId || '';
        
        if (document.getElementById('notifOnCreate')) document.getElementById('notifOnCreate').checked = !!config.notifOnCreate;
        if (document.getElementById('notifOnInProgress')) document.getElementById('notifOnInProgress').checked = !!config.notifOnInProgress;
        if (document.getElementById('notifOnPause')) document.getElementById('notifOnPause').checked = !!config.notifOnPause;
        if (document.getElementById('notifOnStartOvertime')) document.getElementById('notifOnStartOvertime').checked = !!config.notifOnStartOvertime;
        if (document.getElementById('notifOnEndOvertime')) document.getElementById('notifOnEndOvertime').checked = !!config.notifOnEndOvertime;
        if (document.getElementById('notifOnComplete')) document.getElementById('notifOnComplete').checked = !!config.notifOnComplete;
        if (document.getElementById('notifOnKpi')) document.getElementById('notifOnKpi').checked = !!config.notifOnKpi;
    }, { onlyOnce: true });
}
// Tự động tải cài đặt Telegram khi trang vừa khởi động xong
document.addEventListener("DOMContentLoaded", () => {
    loadTelegramSettings(); 
});
window.testBotGroup = async () => {
    try {
        // Lấy giá trị Token và Chat ID từ ô input trên giao diện
        const botToken = document.getElementById('settingBotToken')?.value.trim();
        const chatId = document.getElementById('settingAdminChatId')?.value.trim();

        if (!botToken) {
            alert("Vui lòng nhập Bot Token!");
            return;
        }
        if (!chatId) {
            alert("Vui lòng nhập Chat ID nhóm quản lý!");
            return;
        }

        const message = encodeURIComponent("🔔 *[TEST KẾT NỐI NHÓM]*\n\nBot đã kết nối thành công với Nhóm Quản Lý KPI.");
        const url = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${message}&parse_mode=Markdown`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.ok) {
            alert("Test Bot vào nhóm thành công! Kiểm tra tin nhắn trong nhóm quản lý nhé.");
        } else {
            alert("Test thất bại: " + (data.description || "Lỗi không xác định"));
        }
    } catch (err) {
        alert("Lỗi mạng: " + err.message);
    }
};