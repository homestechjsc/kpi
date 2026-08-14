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

        // Khối hiển thị thông tin thanh toán & hoàn thành công việc
        let paymentDetailsHtml = '';
        if (task.tinhTrang === 'Đã hoàn thành') {
            const xuLyText = task.hinhThucXuLy === 'baohanh' ? 'Bảo hành (Miễn phí)' : (task.hinhThucXuLy === 'hotro' ? 'Hỗ trợ kỹ thuật' : (task.hinhThucXuLy === 'tinhphi' ? 'Tính phí dịch vụ' : (task.hinhThucThanhToan || 'N/A')));
            const soTienVal = Number(task.soTienThanhToan || task.chiPhi || 0).toLocaleString();
            
            paymentDetailsHtml = `
                <div class="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-2">
                    <div class="font-extrabold text-emerald-900 border-b border-emerald-200 pb-1.5 flex items-center gap-1.5 text-xs">
                        <i class="fa-solid fa-receipt text-emerald-600"></i> Thông Tin Thanh Toán & Hoàn Thành Công Việc
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-slate-700">
                        <div><strong class="text-slate-500 block">Hình thức xử lý:</strong> <span class="font-bold text-emerald-700">${xuLyText}</span></div>
                        <div><strong class="text-slate-500 block">Thanh toán:</strong> <span class="font-medium">${task.hinhThucThanhToan || 'N/A'}</span></div>
                        <div><strong class="text-slate-500 block">Số tiền:</strong> <span class="font-black text-emerald-800 text-xs">${soTienVal} VNĐ</span></div>
                        <div><strong class="text-slate-500 block">Công nợ:</strong> <span class="${task.tinhTrangCongNo === 'Có nợ' ? 'text-rose-600 font-bold' : 'text-slate-700'}">${task.tinhTrangCongNo || 'Không'}</span></div>
                    </div>
                    ${task.ghiChuThanhToan ? `<div class="text-[11px] text-slate-600 pt-1"><strong>Ghi chú thanh toán:</strong> ${task.ghiChuThanhToan}</div>` : ''}
                    ${task.lyDoHoTro ? `<div class="text-[11px] text-indigo-700 pt-1"><strong>Lý do hỗ trợ:</strong> ${task.lyDoHoTro}</div>` : ''}
                    ${task.ghiChuBaoHanh ? `<div class="text-[11px] text-blue-700 pt-1"><strong>Ghi chú bảo hành:</strong> ${task.ghiChuBaoHanh}</div>` : ''}
                </div>
            `;
        }

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

                        <!-- Khối Thông Tin Thanh Toán & Hoàn Thành (Nếu có) -->
                        ${paymentDetailsHtml}

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
    // --- PHẦN TẠO MỚI CÔNG VIỆC ---
    document.getElementById('taskModalTitle').innerHTML = '<i class="fa-solid fa-tasks text-emerald-600 mr-2"></i> Tạo Mới Công Việc';
    document.getElementById('taskTinhTrang').value = 'Chờ triển khai';
    
    // 👉 1. Tự động gán thời điểm hiện tại cho ô Ngày/Giờ tạo (taskNgayTao)
    const nowLocal = new Date();
    const lYear = nowLocal.getFullYear();
    const lMonth = String(nowLocal.getMonth() + 1).padStart(2, '0');
    const lDay = String(nowLocal.getDate()).padStart(2, '0');
    const lHours = String(nowLocal.getHours()).padStart(2, '0');
    const lMinutes = String(nowLocal.getMinutes()).padStart(2, '0');
    document.getElementById('taskNgayTao').value = `${lYear}-${lMonth}-${lDay}T${lHours}:${lMinutes}`;

    // 👉 2. Tự động gán Deadline CV là thời gian hiện tại CỘNG THÊM 2 GIỜ
    const deadlineTime = new Date(nowLocal.getTime() + 2 * 60 * 60 * 1000);
    const dYear = deadlineTime.getFullYear();
    const dMonth = String(deadlineTime.getMonth() + 1).padStart(2, '0');
    const dDay = String(deadlineTime.getDate()).padStart(2, '0');
    const dHours = String(deadlineTime.getHours()).padStart(2, '0');
    const dMinutes = String(deadlineTime.getMinutes()).padStart(2, '0');
    document.getElementById('taskDeadline').value = `${dYear}-${dMonth}-${dDay}T${dHours}:${dMinutes}`;

    // 👉 3. Gán Người tạo CV mặc định là "Hệ thống"
    document.getElementById('taskNguoiTao').value = 'Hệ thống';
    
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
        'cameraTab': 'Quản Lý Thiết Bị Camera Công Trình',
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
            chartContainer.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">Chưa có dữ liệu phân tích hiệu suất trong tháng này.</p>';
        } else {
            chartContainer.className = "space-y-4 pt-2 w-full";

            // Sắp xếp kỹ thuật viên theo số lượng công việc hoàn thành từ cao xuống thấp
            staffEntries.sort((a, b) => b[1].completed - a[1].completed);

            staffEntries.forEach(([name, stat], index) => {
                const completedPct = Math.round((stat.completed / stat.total) * 100) || 0;
                
                let performanceBadge = '';
                let borderStyle = 'border-slate-200/90';
                
                if (completedPct >= 80 && stat.waiting === 0) {
                    performanceBadge = `<span class="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-xl font-extrabold text-[10px] flex items-center gap-1"><i class="fa-solid fa-trophy text-amber-500"></i> Xuất sắc</span>`;
                    borderStyle = 'border-emerald-300 bg-emerald-50/10';
                } else if (stat.waiting > 3 || stat.paused > 1) {
                    performanceBadge = `<span class="bg-amber-100 text-amber-800 px-3 py-1 rounded-xl font-extrabold text-[10px] flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation"></i> Cần đôn đốc</span>`;
                    borderStyle = 'border-amber-200 bg-amber-50/10';
                } else {
                    performanceBadge = `<span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-xl font-extrabold text-[10px] flex items-center gap-1"><i class="fa-solid fa-business-time"></i> Ổn định</span>`;
                }

                chartContainer.innerHTML += `
                    <div class="bg-white border ${borderStyle} p-4 rounded-3xl shadow-sm transition space-y-3 text-xs">
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div class="flex items-center gap-3">
                                <!-- Thay nền đen (bg-slate-900) thành nền sáng xanh ngọc (bg-emerald-100 text-emerald-800) -->
                                <div class="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs border border-emerald-200 shadow-sm">
                                    #${index + 1}
                                </div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <h4 class="font-black text-slate-900 text-sm">${name}</h4>
                                        ${performanceBadge}
                                    </div>
                                    <span class="text-[10px] text-slate-400 font-bold">Khối lượng: <strong class="text-slate-700">${stat.total} công việc</strong> trong kỳ</span>
                                </div>
                            </div>

                            <!-- Chỉ số đánh giá nhanh -->
                            <div class="flex items-center gap-3 text-right">
                                <div>
                                    <span class="text-[10px] text-slate-400 block font-bold uppercase">Tỷ lệ hoàn thành</span>
                                    <span class="text-sm font-black text-emerald-700">${completedPct}%</span>
                                </div>
                                <div class="border-l border-slate-200 pl-3">
                                    <span class="text-[10px] text-slate-400 block font-bold uppercase">Tổng thời gian</span>
                                    <span class="text-sm font-black text-blue-600">${stat.workMinutes} phút</span>
                                </div>
                            </div>
                        </div>

                        <!-- Thanh tiến độ hiệu suất trực quan -->
                        <div class="space-y-1 pt-1">
                            <div class="flex justify-between text-[11px] font-bold text-slate-500 pb-1">
                                <span>Tiến độ xử lý công việc</span>
                                <span class="text-slate-700">${stat.completed}/${stat.total} hoàn thành</span>
                            </div>
                            <div class="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex p-0.5 border border-slate-200/60 shadow-inner">
                                <div class="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500" style="width: ${completedPct}%"></div>
                            </div>
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

// ================= KIỂM TRA QUÁ HẠN DEADLINE CÔNG VIỆC VÀ GỬI CHO KỸ THUẬT =================
function checkTaskDeadlines() {
    if (!allTasksData || Object.keys(allTasksData).length === 0) return;

    const now = new Date().getTime();

    Object.entries(allTasksData).forEach(([id, task]) => {
        // Chỉ kiểm tra các việc chưa hoàn thành, có cài đặt deadline và chưa từng gửi thông báo quá hạn deadline
        if (task.tinhTrang !== 'Đã hoàn thành' && task.deadline && !task.daGuiThongBaoQuaHanDeadline) {
            const deadlineTime = new Date(task.deadline).getTime();

            // Nếu thời gian hiện tại đã vượt qua mốc Deadline
            if (now > deadlineTime) {
                // Tiến hành gửi tin nhắn riêng cho kỹ thuật viên phụ trách
                sendDeadlineOverdueNotificationToStaff(task);

                // Đánh dấu đã gửi để không bị lặp lại liên tục
                update(ref(db, `managementTasks/${id}`), { daGuiThongBaoQuaHanDeadline: true });
            }
        }
    });
}

// Hàm gửi tin nhắn Telegram thông báo quá hạn deadline cho đúng kỹ thuật phụ trách & quản lý
async function sendDeadlineOverdueNotificationToStaff(taskData) {
    try {
        const snapshot = await get(ref(db, 'settings/telegram'));
        if (!snapshot.exists()) return;
        const config = snapshot.val();
        if (!config.botToken) return;

        // Tìm Chat ID của kỹ thuật phụ trách từ nhánh 'staffs'
        let targetChatId = null;
        const staffSnapshot = await get(ref(db, 'staffs'));
        if (staffSnapshot.exists()) {
            const staffList = Object.values(staffSnapshot.val());
            const matchedStaff = staffList.find(s => s.name === taskData.ktPhuTrach);
            if (matchedStaff && matchedStaff.telegramId) {
                targetChatId = matchedStaff.telegramId;
            }
        }

        const message = encodeURIComponent(
            `⏰ *[CẢNH BÁO: CÔNG VIỆC ĐÃ QUÁ HẠN DEADLINE]* ⏰\n\n` +
            `📋 *Mã CV:* ${taskData.maCv || 'N/A'}\n` +
            `👤 *Khách hàng:* ${taskData.khachHang || 'N/A'}\n` +
            `🛠️ *Phụ trách:* ${taskData.ktPhuTrach || 'N/A'}\n` +
            `📝 *Nội dung:* ${taskData.noiDung || 'N/A'}\n` +
            `⏳ *Deadline quy định:* ${taskData.deadline ? taskData.deadline.replace('T', ' ') : 'N/A'}\n\n` +
            `⚠️ *Trạng thái:* Công việc này đã quá hạn nhưng **chưa hoàn thành**. Vui lòng kiểm tra và xử lý gấp!`
        );

        // Gửi riêng cho kỹ thuật viên nếu họ có cấu hình Telegram ID cá nhân
        if (targetChatId) {
            const urlStaff = `https://api.telegram.org/bot${config.botToken}/sendMessage?chat_id=${targetChatId}&text=${message}&parse_mode=Markdown`;
            fetch(urlStaff).catch(err => console.error("Lỗi gửi thông báo quá hạn cho kỹ thuật:", err));
        }

        // Đồng thời gửi bản sao vào nhóm quản lý (nếu có cấu hình adminChatId)
        if (config.adminChatId) {
            const urlAdmin = `https://api.telegram.org/bot${config.botToken}/sendMessage?chat_id=${config.adminChatId}&text=${message}&parse_mode=Markdown`;
            fetch(urlAdmin).catch(err => console.error("Lỗi gửi thông báo quá hạn cho nhóm quản lý:", err));
        }

    } catch (error) {
        console.error("Lỗi hệ thống khi gửi cảnh báo quá hạn deadline:", error);
    }
}

// Chạy tự động kiểm tra mỗi 5 phút một lần khi trang quản trị đang mở
setInterval(checkTaskDeadlines, 10 * 60 * 1000);

let allCameraDevices = {};

// 1. Lắng nghe dữ liệu thiết bị camera từ Firebase
onValue(ref(db, 'cameraDevices'), (snapshot) => {
    allCameraDevices = snapshot.exists() ? snapshot.val() : {};
    renderAdminCameraTable(Object.entries(allCameraDevices).reverse());
});

// 2. Render bảng quản lý thiết bị camera trên trang quản trị
function renderAdminCameraTable(entries) {
    const tbody = document.getElementById('adminCameraTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!entries || entries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-400 font-medium">Chưa có phiếu xuất/nhập thiết bị nào.</td></tr>`;
        return;
    }

    entries.forEach(([id, item]) => {
        const isExport = item.action === 'Xuất kho';
        const actionBadge = isExport 
            ? `<span class="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full font-black text-[10px]"><i class="fa-solid fa-arrow-up-from-bracket mr-1"></i> Xuất công trình</span>`
            : `<span class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-black text-[10px]"><i class="fa-solid fa-arrow-down-to-bracket mr-1"></i> Nhập kho kỹ thuật</span>`;

        let devicesHtml = '';
        let totalQty = 0;
        if (item.devices && Array.isArray(item.devices)) {
            item.devices.forEach(d => {
                totalQty += Number(d.quantity) || 0;
                devicesHtml += `<div class="text-slate-700">• ${d.deviceName} (<strong class="text-emerald-700">${d.quantity} cái</strong>) ${d.note ? '- ' + d.note : ''}</div>`;
            });
        }

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
                <td class="p-4 pl-6 align-top">
                    <div class="font-black text-slate-800">${item.date ? item.date.split('-').reverse().join('/') : ''}</div>
                    <div class="mt-1">${actionBadge}</div>
                </td>
                <td class="p-4 font-bold text-slate-900 align-top">${isExport ? (item.projectName || 'N/A') : '<span class="text-emerald-600 italic">Kho kỹ thuật</span>'}</td>
                <td class="p-4 font-semibold text-blue-600 align-top">${isExport ? (item.contractor || 'Không có') : 'N/A'}</td>
                <td class="p-4 align-top">
                    <div class="space-y-0.5">${devicesHtml}</div>
                    <div class="text-[10px] text-slate-400 mt-1">Người lập: ${item.staff || 'Admin'}</div>
                </td>
                <td class="p-4 text-center font-black text-emerald-700 text-sm align-top">${totalQty} cái</td>
                <td class="p-4 text-slate-600 align-top">${item.note || 'Không có'}</td>
                <td class="p-4 pr-6 text-center align-top">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="window.openEditAdminCameraModal('${id}')" class="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1">
                            <i class="fa-solid fa-pen"></i> Sửa
                        </button>
                        <button onclick="window.deleteAdminCameraDevice('${id}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1">
                            <i class="fa-solid fa-trash"></i> Xóa
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}


// ================= 1. TÍNH NĂNG SAO LƯU (BACKUP) =================
window.backupDatabase = async () => {
    try {
        // Lấy toàn bộ dữ liệu từ gốc (root) của Firebase Database
        const snapshot = await get(ref(db));
        if (!snapshot.exists()) {
            alert("Không có dữ liệu trên hệ thống để sao lưu!");
            return;
        }

        const dbData = snapshot.val();
        const jsonString = JSON.stringify(dbData, null, 2);
        
        // Tạo một file JSON ảo để tải về máy tự động
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = `kpi-backup-${dateStr}.json`;

        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert("Sao lưu dữ liệu thành công!");
    } catch (error) {
        alert("Lỗi khi sao lưu dữ liệu: " + error.message);
    }
};

// ================= 2. TÍNH NĂNG KHÔI PHỤC (RESTORE) =================
window.restoreDatabase = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm("⚠️ CẢNH BÁO QUAN TRỌNG:\nViệc khôi phục sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại trên hệ thống bằng dữ liệu từ file sao lưu.\n\nBạn có chắc chắn muốn tiếp tục không?")) {
        event.target.value = ""; // Reset input file
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const jsonData = JSON.parse(e.target.result);

            // Ghi đè toàn bộ dữ liệu từ file JSON lên nhánh gốc của Firebase
            await set(ref(db), jsonData);

            alert("Khôi phục dữ liệu hệ thống thành công! Trang sẽ được tải lại.");
            location.reload();
        } catch (error) {
            alert("Lỗi: File dữ liệu không hợp lệ hoặc lỗi kết nối! (" + error.message + ")");
        }
    };
    reader.readAsText(file);
};

// ================= QUẢN LÝ CAMERA & THIẾT BỊ CÔNG TRÌNH (TỐI ƯU THEO TÊN & TỒN KHO) =================
let allCameraReceipts = {}; 

onValue(ref(db, 'cameraDevices'), (snapshot) => {
    allCameraReceipts = snapshot.exists() ? snapshot.val() : {};
    renderAdminCameraManagement();
});

// Hàm render bảng và tính toán thống kê chuẩn xác theo "Camera" và "Thẻ"
function renderAdminCameraManagement() {
    const tableBody = document.getElementById('adminCameraTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    let totalCameraInStock = 0;      // Tổng Camera nhập kho ban đầu
    let installedCameraCount = 0;    // Camera đang lắp công trình

    let totalCardInStock = 0;        // Tổng Thẻ nhớ nhập kho ban đầu
    let installedCardCount = 0;      // Thẻ nhớ đang lắp công trình

    const entries = Object.entries(allCameraReceipts).reverse();

    if (entries.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400 font-medium">Chưa có phiếu xuất/nhập thiết bị nào.</td></tr>`;
        updateCameraStatsUI(0, 0, 0, 0);
        return;
    }

    entries.forEach(([id, item]) => {
        const isExport = item.action === 'Xuất kho';
        const isReturnNote = item.projectName && item.projectName.includes('Thu hồi'); // Nhận diện phiếu thu hồi
        
        let actionBadge = '';
        if (isExport) {
            actionBadge = `<span class="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full font-black text-[10px]"><i class="fa-solid fa-arrow-up-from-bracket mr-1"></i> Xuất công trình</span>`;
        } else if (isReturnNote) {
            actionBadge = `<span class="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-black text-[10px]"><i class="fa-solid fa-rotate-left mr-1"></i> Thu hồi về kho</span>`;
        } else {
            actionBadge = `<span class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-black text-[10px]"><i class="fa-solid fa-arrow-down-to-bracket mr-1"></i> Nhập kho kỹ thuật</span>`;
        }

        let devicesHtml = '';
        let totalQtyInReceipt = 0;

        if (item.devices && Array.isArray(item.devices)) {
            item.devices.forEach(d => {
                const deviceName = (d.deviceName || d.name || '').trim();
                const qty = Number(d.quantity || d.qty) || 0;
                totalQtyInReceipt += qty;

                devicesHtml += `<div class="text-slate-700">• ${deviceName} (<strong class="text-emerald-700">${qty} cái</strong>) ${d.note ? '- ' + d.note : ''}</div>`;

                const lowerName = deviceName.toLowerCase();
                const isCamera = lowerName.startsWith('camera');
                const isCard = lowerName.startsWith('thẻ') || lowerName.startsWith('the');

                if (isExport) {
                    // Nếu là phiếu xuất công trình -> Cộng dồn vào số lượng đang lắp
                    if (isCamera) installedCameraCount += qty;
                    if (isCard) installedCardCount += qty;
                } else {
                    // Nếu là phiếu Nhập kho chuẩn (không tính phiếu thu hồi để tránh bị cộng lặp 2 lần)
                    if (!isReturnNote) {
                        if (isCamera) totalCameraInStock += qty;
                        if (isCard) totalCardInStock += qty;
                    }
                }
            });
        }

        // Nút hành động Nhập Về Kho khi xuất đi
        let actionButtons = '';
        if (isExport) {
            actionButtons = `
                <button onclick="window.returnCameraToStock('${id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1 shadow-sm mx-auto mb-1">
                    <i class="fa-solid fa-rotate-left"></i> Nhập Về Kho
                </button>`;
        } else {
            actionButtons = `<span class="text-slate-400 text-[10px]">Phiếu kho</span>`;
        }

        tableBody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
                <td class="p-4 pl-6 align-top">
                    <div class="font-black text-slate-800">${item.date ? item.date.split('-').reverse().join('/') : ''}</div>
                    <div class="mt-1">${actionBadge}</div>
                </td>
                <td class="p-4 font-bold text-slate-900 align-top">${isExport ? (item.projectName || 'N/A') : '<span class="text-emerald-600 italic">Kho kỹ thuật</span>'}</td>
                <td class="p-4 font-semibold text-blue-600 align-top">${isExport ? (item.contractor || 'Không có') : 'N/A'}</td>
                <td class="p-4 align-top">
                    <div class="space-y-0.5">${devicesHtml}</div>
                    <div class="text-[10px] text-slate-400 mt-1">Người lập: ${item.staff || 'Admin'}</div>
                </td>
                <td class="p-4 text-center font-black text-emerald-700 text-sm align-top">${totalQtyInReceipt} cái</td>
                <td class="p-4 text-slate-600 align-top">${item.note || 'Không có'}</td>
                <td class="p-4 pr-6 text-center align-top">
                    ${actionButtons}
                    <div class="flex items-center justify-center gap-1.5 mt-1">
                        <button onclick="window.openEditAdminCameraModal('${id}')" class="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1">
                            <i class="fa-solid fa-pen"></i> Sửa
                        </button>
                        <button onclick="window.deleteAdminCameraDevice('${id}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1">
                            <i class="fa-solid fa-trash"></i> Xóa
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    updateCameraStatsUI(totalCameraInStock, installedCameraCount, totalCardInStock, installedCardCount);
}

// Cập nhật 4 chỉ số lên giao diện thẻ thống kê
function updateCameraStatsUI(totalCam, installedCam, totalCard, installedCard) {
    const remainingCam = Math.max(0, totalCam - installedCam);
    const remainingCard = Math.max(0, totalCard - installedCard);

    const el1 = document.getElementById('statInstalledCam');     // Đang lắp Camera
    const el2 = document.getElementById('statRemainingCam');     // Tồn kho Camera
    const el3 = document.getElementById('statInstalledCard');    // Đang lắp Thẻ nhớ
    const el4 = document.getElementById('statRemainingCard');    // Tồn kho Thẻ nhớ

    if (el1) el1.textContent = installedCam;
    if (el2) el2.textContent = remainingCam;
    if (el3) el3.textContent = installedCard;
    if (el4) el4.textContent = remainingCard;
}

// Hàm thu hồi thiết bị về kho
// 1. Khi bấm nút "Nhập Về Kho" trên bảng danh sách, mở modal hiển thị danh sách để kiểm tra
window.returnCameraToStock = (receiptId) => {
    const item = allCameraReceipts[receiptId];
    if (!item) return;

    document.getElementById('returnReceiptId').value = receiptId;
    const container = document.getElementById('returnDeviceRowsContainer');
    if (!container) return;
    container.innerHTML = '';

    // Đổ danh sách thiết bị của phiếu xuất đó ra bảng xác nhận
    if (item.devices && Array.isArray(item.devices)) {
        item.devices.forEach((d, index) => {
            const devName = d.deviceName || d.name || '';
            const qty = Number(d.quantity || d.qty) || 1;
            const note = d.note || '';

            container.innerHTML += `
                <tr class="border-b border-slate-100 return-device-row" data-index="${index}">
                    <td class="p-3 pl-3 font-bold text-slate-800">
                        ${devName}
                        <input type="hidden" class="ret-name" value="${devName}">
                    </td>
                    <td class="p-3 text-center">
                        <input type="number" min="0" value="${qty}" class="w-24 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center text-emerald-700 ret-qty" required>
                    </td>
                    <td class="p-3">
                        <input type="text" placeholder="VD: Hư hỏng, bể vỡ..." value="${note}" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium ret-note">
                    </td>
                </tr>
            `;
        });
    }

    const modal = document.getElementById('returnCameraModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeReturnModal = () => {
    const modal = document.getElementById('returnCameraModal');
    if (modal) modal.classList.add('hidden');
};

// 2. Khi bấm "Xác Nhận Nhập Kho": Xóa phiếu xuất công trình và cộng dồn thiết bị thực tế về kho
window.confirmReturnToStock = (e) => {
    e.preventDefault();
    const receiptId = document.getElementById('returnReceiptId').value;
    if (!receiptId) return;

    // Lấy chính xác dữ liệu gốc của phiếu xuất đó để tham chiếu
    const originalReceipt = allCameraReceipts[receiptId];
    if (!originalReceipt) {
        alert("Không tìm thấy dữ liệu phiếu xuất!");
        return;
    }

    const rows = document.querySelectorAll('.return-device-row');
    const updatedDevices = [];

    rows.forEach((row, index) => {
        const name = row.querySelector('.ret-name').value.trim();
        const qty = Number(row.querySelector('.ret-qty').value) || 0;
        const note = row.querySelector('.ret-note').value.trim();

        if (qty > 0) {
            updatedDevices.push({
                deviceName: name,
                quantity: qty, // Lấy đúng số lượng người dùng xác nhận trong modal
                note: note ? `Thu hồi: ${note}` : 'Thu hồi về kho'
            });
        }
    });

    if (updatedDevices.length === 0) {
        alert("Số lượng thu hồi thực tế bằng 0 hoặc không có thiết bị hợp lệ!");
        return;
    }

    // Tạo phiếu nhập kho mới ghi nhận ĐÚNG số lượng thực tế thu hồi
    const returnReceiptData = {
        action: 'Nhập kho',
        date: new Date().toISOString().split('T')[0],
        projectName: `Kho kỹ thuật (Thu hồi từ: ${originalReceipt.projectName || 'Công trình'})`,
        contractor: 'N/A',
        devices: updatedDevices, // Mảng thiết bị chuẩn xác không bị nhân đôi
        note: `Thu hồi từ phiếu công trình: ${originalReceipt.projectName || ''}`,
        staff: 'Admin'
    };

    // Tiến hành đẩy phiếu nhập mới vào Firebase và XÓA phiếu xuất cũ đi
    Promise.all([
        push(ref(db, 'cameraDevices'), returnReceiptData), 
        remove(ref(db, `cameraDevices/${receiptId}`))     
    ])
    .then(() => {
        alert("Xác nhận nhập kho thành công! Số lượng tồn kho đã được cộng đúng chuẩn thực tế.");
        window.closeReturnModal();
    })
    .catch((err) => {
        alert("Lỗi khi xác nhận nhập kho: " + err.message);
    });
};
// Mở Modal chế độ Sửa phiếu camera
window.openEditAdminCameraModal = (id) => {
    const item = allCameraReceipts[id];
    if (!item) return;

    const setVal = (elementId, val) => {
        const el = document.getElementById(elementId);
        if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    setVal('adminCamId', id);
    setVal('adminCamAction', item.action || 'Nhập kho');
    setVal('adminCamDate', item.date || '');
    setVal('adminCamStaff', item.staff || '');
    setVal('adminCamProject', item.projectName || '');
    setVal('adminCamContractor', item.contractor || '');
    setVal('adminCamNote', item.note || '');

    window.toggleProjectField();

    const container = document.getElementById('deviceRowsContainer');
    if (container) {
        container.innerHTML = '';
        if (item.devices && Array.isArray(item.devices) && item.devices.length > 0) {
            item.devices.forEach(d => {
                window.addDeviceRow(d.deviceName || d.name, d.quantity || d.qty, d.note);
            });
        } else {
            window.addDeviceRow();
        }
    }

    const modal = document.getElementById('adminCameraModal');
    if (modal) modal.classList.remove('hidden');
};

window.toggleProjectField = () => {
    const action = document.getElementById('adminCamAction').value;
    const projectContainer = document.getElementById('projectInfoContainer');
    const projectInput = document.getElementById('adminCamProject');

    if (action === 'Nhập kho') {
        projectContainer.classList.add('hidden');
        if (projectInput) projectInput.required = false;
    } else {
        projectContainer.classList.remove('hidden');
        if (projectInput) projectInput.required = true;
    }
};

// Thêm dòng thiết bị động (Có tích hợp gợi ý tên thiết bị từ lịch sử đã lưu)
window.addDeviceRow = (deviceName = '', quantity = 1, note = '') => {
    const container = document.getElementById('deviceRowsContainer');
    if (!container) return;

    // Tự động thu thập tất cả các tên thiết bị từng dùng để làm danh sách gợi ý (datalist)
    let uniqueDeviceNames = new Set();
    Object.values(allCameraReceipts).forEach(receipt => {
        if (receipt.devices && Array.isArray(receipt.devices)) {
            receipt.devices.forEach(d => {
                if (d.deviceName || d.name) uniqueDeviceNames.add(d.deviceName || d.name);
            });
        }
    });

    let datalistOptions = '';
    uniqueDeviceNames.forEach(name => {
        datalistOptions += `<option value="${name}">`;
    });

    const datalistId = 'suggestions_' + Date.now() + Math.random().toString(36).substr(2, 5);

    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-100 device-row';
    tr.innerHTML = `
        <td class="p-2 pl-3">
            <input type="text" list="${datalistId}" placeholder="Tên thiết bị / Model..." value="${deviceName}" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium device-name" required>
            <datalist id="${datalistId}">
                ${datalistOptions}
            </datalist>
        </td>
        <td class="p-2">
            <input type="number" min="1" value="${quantity}" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center text-emerald-700 device-qty" required>
        </td>
        <td class="p-2">
            <input type="text" placeholder="Ghi chú / Số seri..." value="${note}" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium device-note">
        </td>
        <td class="p-2 text-center">
            <button type="button" onclick="this.closest('tr').remove()" class="text-rose-500 hover:text-rose-700 bg-rose-50 p-2 rounded-xl transition"><i class="fa-solid fa-trash"></i></button>
        </td>
    `;
    container.appendChild(tr);
};

window.openAdminCameraModal = () => {
    document.getElementById('adminCamId').value = '';
    document.getElementById('adminCameraForm').reset();
    document.getElementById('adminCamDate').value = new Date().toISOString().split('T')[0];
    
    const container = document.getElementById('deviceRowsContainer');
    if (container) container.innerHTML = '';
    window.addDeviceRow(); // Tự động bật 1 dòng trống (có gợi ý thiết bị cũ)

    window.toggleProjectField();
    document.getElementById('adminCameraModal').classList.remove('hidden');
};

window.closeAdminCameraModal = () => {
    document.getElementById('adminCameraModal').classList.add('hidden');
};

window.saveAdminCameraDevice = (e) => {
    e.preventDefault();
    
    const getVal = (elementId) => {
        const el = document.getElementById(elementId);
        return el ? el.value.trim() : '';
    };

    const id = getVal('adminCamId');
    const action = getVal('adminCamAction') || 'Nhập kho';
    const date = getVal('adminCamDate') || new Date().toISOString().split('T')[0];
    const staff = getVal('adminCamStaff') || 'Admin';
    const project = getVal('adminCamProject');
    const contractor = getVal('adminCamContractor');
    const note = getVal('adminCamNote');

    const deviceRows = document.querySelectorAll('.device-row');
    const devicesList = [];

    deviceRows.forEach(row => {
        const nameInput = row.querySelector('.device-name');
        const qtyInput = row.querySelector('.device-qty');
        const noteInput = row.querySelector('.device-note');

        if (nameInput) {
            const name = nameInput.value.trim();
            const qty = qtyInput ? Number(qtyInput.value) || 1 : 1;
            const deviceNote = noteInput ? noteInput.value.trim() : '';

            if (name) {
                devicesList.push({ deviceName: name, quantity: qty, note: deviceNote });
            }
        }
    });

    if (devicesList.length === 0) {
        alert("Vui lòng nhập ít nhất một thiết bị!");
        return;
    }

    const deviceData = {
        action: action,
        date: date,
        projectName: action === 'Xuất kho' ? (project || 'Chưa rõ') : 'Kho kỹ thuật',
        contractor: action === 'Xuất kho' ? (contractor || 'N/A') : 'N/A',
        devices: devicesList,
        note: note,
        staff: staff
    };

    if (id) {
        update(ref(db, `cameraDevices/${id}`), deviceData).then(() => {
            alert("Cập nhật phiếu thành công!");
            window.closeAdminCameraModal();
        }).catch(err => alert("Lỗi: " + err.message));
    } else {
        push(ref(db, 'cameraDevices'), deviceData).then(() => {
            alert("Tạo phiếu thành công!");
            window.closeAdminCameraModal();
        }).catch(err => alert("Lỗi: " + err.message));
    }
};

window.deleteAdminCameraDevice = (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa phiếu thiết bị này không?")) {
        remove(ref(db, `cameraDevices/${id}`)).then(() => {
            alert("Đã xóa thành công!");
        }).catch(err => alert("Lỗi: " + err.message));
    }
};
// Hàm tự động cập nhật Deadline cộng thêm 2 giờ dựa trên Ngày giờ tạo được chọn
window.updateDeadlineAutomatically = () => {
    const ngayTaoInput = document.getElementById('taskNgayTao');
    const deadlineInput = document.getElementById('taskDeadline');
    
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
// ================= KIỂM TRA CÔNG VIỆC BỊ TREO KHI KỸ THUẬT RẢNH =================

function isTechnicianFree(techName) {
    if (!techName) return false;
    const cleanTechName = techName.trim().toLowerCase();
    
    const busyTasks = Object.values(allTasksData || {}).filter(task => {
        const phuTrach = (task.ktPhuTrach || '').trim().toLowerCase();
        const hoTro = (task.ktHoTro || '').trim().toLowerCase();
        
        const isAssignedToTech = (phuTrach === cleanTechName || hoTro === cleanTechName);
        const isInProgress = (task.tinhTrang === 'Đang thực hiện');
        
        return isAssignedToTech && isInProgress;
    });
    
    return busyTasks.length === 0;
}

function checkPendingTasksTimeout() {
    if (!allTasksData || Object.keys(allTasksData).length === 0) return;
    
    const now = new Date().getTime();
    const CHECK_INTERVAL_MINUTES = 5 * 60 * 1000; // Chu kỳ 5 phút

    Object.entries(allTasksData).forEach(([id, task]) => {
        // 🛑 BẮT BUỘC: Nếu công việc KHÔNG CÒN ở trạng thái "Chờ triển khai" (tức là đã nhận, đang làm, tạm ngưng hoặc hoàn thành), 
        // Lập tức bỏ qua và reset lại bộ đếm cảnh báo nếu lỡ còn lưu trên hệ thống.
        if (task.tinhTrang !== 'Chờ triển khai') {
            if (task.alertCount > 0) {
                update(ref(db, `managementTasks/${id}`), { alertCount: 0, lastAlertTime: null });
            }
            return;
        }
            
        // Nếu công việc mới tạo chưa có mốc timestamp
        if (!task.ngayTaoTimestamp) {
            update(ref(db, `managementTasks/${id}`), { ngayTaoTimestamp: now, alertCount: 0 });
            return;
        }

        const createdAt = task.ngayTaoTimestamp;
        const lastAlert = task.lastAlertTime || createdAt;
        const alertCount = task.alertCount || 0;

        const isFirstAlert = (alertCount === 0 && (now - createdAt >= CHECK_INTERVAL_MINUTES));
        const isRepeatAlert = (alertCount > 0 && alertCount < 3 && (now - lastAlert >= CHECK_INTERVAL_MINUTES));

        if (isFirstAlert || isRepeatAlert) {
            const techPhuTrach = task.ktPhuTrach;
            const techHoTro = task.ktHoTro;

            const isPhuTrachFree = techPhuTrach ? isTechnicianFree(techPhuTrach) : false;
            const isHoTroFree = techHoTro ? isTechnicianFree(techHoTro) : false;

            if (isPhuTrachFree || isHoTroFree) {
                let freeTechName = isPhuTrachFree ? techPhuTrach : techHoTro;
                
                sendTimeoutTelegramNotification(task, freeTechName, alertCount + 1);

                update(ref(db, `managementTasks/${id}`), { 
                    alertCount: alertCount + 1,
                    lastAlertTime: now 
                });
            }
        }
    });
}

async function sendTimeoutTelegramNotification(taskData, freeTech, times) {
    try {
        const snapshot = await get(ref(db, 'settings/telegram'));
        if (!snapshot.exists()) return;
        const config = snapshot.val();
        if (!config.botToken) return;

        const message = encodeURIComponent(
            `🚨 *[NHẮC NHỞ LẦN ${times}: CÔNG VIỆC BỊ TREO]*\n\n` +
            `📋 *Mã CV:* ${taskData.maCv || 'N/A'}\n` +
            `👤 *Khách hàng:* ${taskData.khachHang || 'N/A'}\n` +
            `🛠️ *Kỹ thuật rãnh:* ${freeTech}\n` +
            `📝 *Nội dung:* ${taskData.noiDung || 'N/A'}\n\n` +
            `⚡ *Kỹ thuật đang rảnh việc nhưng chưa tiếp nhận. Yêu cầu xử lý gấp CV!*`
        );

        if (config.adminChatId) {
            const adminUrl = `https://api.telegram.org/bot${config.botToken}/sendMessage?chat_id=${config.adminChatId}&text=${message}&parse_mode=Markdown`;
            fetch(adminUrl).catch(err => console.error("Lỗi gửi nhóm:", err));
        }

        const staffSnapshot = await get(ref(db, 'staffs'));
        if (staffSnapshot.exists()) {
            const cleanFreeTech = freeTech.trim().toLowerCase();
            staffSnapshot.forEach((child) => {
                const staff = child.val();
                const staffName = (staff.name || '').trim().toLowerCase();
                if (staffName === cleanFreeTech && staff.telegramId) {
                    const techUrl = `https://api.telegram.org/bot${config.botToken}/sendMessage?chat_id=${staff.telegramId}&text=${message}&parse_mode=Markdown`;
                    fetch(techUrl).catch(err => console.error("Lỗi gửi cá nhân:", err));
                }
            });
        }
    } catch (error) {
        console.error("Lỗi check timeout telegram:", error);
    }
}

// Chạy quét kiểm tra mỗi 1 phút
setInterval(checkPendingTasksTimeout, 60000);
