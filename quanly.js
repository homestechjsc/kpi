import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

const reportMonthInput = document.getElementById('reportMonthInput');
if (reportMonthInput) {
    reportMonthInput.value = new Date().toISOString().slice(0, 7);
}

// 1. Lắng nghe danh sách nhân sự
onValue(ref(db, 'staffs'), (s) => {
    const staffSelect = document.getElementById('selectStaff');
    if (!staffSelect) return;

    staffSelect.innerHTML = '<option value="">-- Tất cả nhân viên --</option>';
    if (s.exists()) {
        Object.values(s.val()).forEach(st => {
            staffSelect.innerHTML += `<option value="${st.name}">${st.name}</option>`;
        });
    }
});

// 2. Lắng nghe dữ liệu KPI
onValue(ref(db, 'kpis'), (s) => {
    allKpiData = s.exists() ? s.val() : {};
    window.loadManagerReport();
});

// 3. Tính toán và hiển thị báo cáo tổng hợp & nhật ký công việc
window.loadManagerReport = () => {
    const selectedMonth = reportMonthInput ? reportMonthInput.value : "";
    const selectedStaff = document.getElementById('selectStaff') ? document.getElementById('selectStaff').value : "";
    
    const taskListContainer = document.getElementById('managerTaskList');
    const tableBodyContainer = document.getElementById('managerTableBody');
    const badge = document.getElementById('taskCountBadge');
    
    if (!taskListContainer || !tableBodyContainer) return;
    
    taskListContainer.innerHTML = '';
    tableBodyContainer.innerHTML = '';

    let totalCv = 0;
    let totalTime = 0;
    let totalScore = 0;
    let scoredCount = 0;
    let photosCount = 0;
    let mapsCount = 0;
    let consultCount = 0;

    const filteredTasks = Object.entries(allKpiData).filter(([id, task]) => {
        if (!task.ngayThucHien) return false;
        let matchMonth = selectedMonth ? task.ngayThucHien.startsWith(selectedMonth) : true;
        let matchStaff = selectedStaff ? task.ktPhuTrach === selectedStaff : true;
        return matchMonth && matchStaff;
    }).reverse();

    if (badge) badge.textContent = `${filteredTasks.length} CV`;

    filteredTasks.forEach(([id, task]) => {
        totalCv++;
        totalTime += Number(task.thoiGian) || 0;

        const score = task.diemKpi !== undefined && task.diemKpi !== null ? Number(task.diemKpi) : 0;
        if (score > 0) {
            totalScore += score;
            scoredCount++;
        }

        if (task.chupAnh) photosCount++;
        if (task.danhGiaMaps) mapsCount++;
        if (task.coTuVanBanHang) consultCount++;

        const badgeColor = score > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
        const statusText = score > 0 ? `${score}đ` : 'Chờ chấm';

        let tuVanHtml = task.coTuVanBanHang ? `<div class="text-[11px] text-indigo-700 bg-indigo-50 p-2 rounded-xl mt-1 font-medium"><i class="fa-solid fa-comments mr-1"></i> <strong>Tư vấn:</strong> ${task.noiDungTuVan || 'Có'}</div>` : '';
        let danhGiaHtml = task.danhGiaAdmin ? `<div class="text-[11px] text-slate-600 bg-slate-100 p-2 rounded-xl mt-1 italic"><i class="fa-solid fa-user-tie mr-1 text-emerald-600"></i> ${task.danhGiaAdmin}</div>` : '<span class="text-slate-400 italic">Chưa nhận xét</span>';

        // Render dạng Bảng (Dành cho PC)
        tableBodyContainer.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
                <td class="p-3.5">
                    <div class="font-bold text-slate-800">${task.ngayThucHien ? task.ngayThucHien.split('-').reverse().join('/') : ''}</div>
                    <div class="text-emerald-600 font-extrabold mt-0.5">${task.ktPhuTrach || ''}</div>
                </td>
                <td class="p-3.5">
                    <div class="font-black text-blue-600">${task.sttCv || ''}</div>
                    <div class="font-bold text-slate-800 mt-0.5">${task.khachHang || ''}</div>
                </td>
                <td class="p-3.5 max-w-xs">
                    <div class="text-slate-700 leading-relaxed">${task.noiDung || ''}</div>
                    ${tuVanHtml}
                </td>
                <td class="p-3.5 text-center">
                    <div class="flex justify-center items-center gap-2">
                        <i class="fa-solid fa-camera ${task.chupAnh ? 'text-emerald-500':'text-slate-200'}" title="Ảnh"></i>
                        <i class="fa-solid fa-map ${task.danhGiaMaps ? 'text-blue-500':'text-slate-200'}" title="Maps"></i>
                    </div>
                </td>
                <td class="p-3.5 text-center font-extrabold text-slate-600">${task.thoiGian || 0}p</td>
                <td class="p-3.5 text-center">
                    <span class="px-2.5 py-1 rounded-full text-xs font-black ${badgeColor}">${statusText}</span>
                </td>
                <td class="p-3.5">${danhGiaHtml}</td>
            </tr>
        `;

        // Render dạng Thẻ Card (Dành cho Mobile)
        taskListContainer.innerHTML += `
            <div class="bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 text-xs space-y-2">
                <div class="flex justify-between items-start font-bold">
                    <div>
                        <span class="text-emerald-700 font-extrabold text-sm">${task.ktPhuTrach || 'Kỹ thuật'}</span>
                        <div class="text-[11px] text-slate-400 font-normal">${task.ngayThucHien ? task.ngayThucHien.split('-').reverse().join('/') : ''}</div>
                    </div>
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] ${badgeColor}">KPI: ${statusText}</span>
                </div>

                <div class="font-bold text-blue-600 text-xs">${task.sttCv || ''} - ${task.khachHang || ''}</div>
                <div class="text-slate-700 font-medium leading-relaxed">${task.noiDung || ''}</div>
                ${tuVanHtml}
                ${task.danhGiaAdmin ? `<div class="text-[11px] text-slate-600 bg-slate-100 p-2 rounded-xl italic"><i class="fa-solid fa-user-tie text-emerald-600 mr-1"></i> ${task.danhGiaAdmin}</div>` : ''}

                <div class="text-slate-400 text-[11px] pt-1 border-t border-slate-200/60 flex justify-between items-center">
                    <span>Thời gian: <strong class="text-slate-600">${task.thoiGian || 0} phút</strong></span>
                    <div class="flex gap-2">
                        <span>Ảnh: <i class="fa-solid fa-camera ${task.chupAnh ? 'text-emerald-500':'text-slate-300'}"></i></span>
                        <span>Maps: <i class="fa-solid fa-map ${task.danhGiaMaps ? 'text-blue-500':'text-slate-300'}"></i></span>
                    </div>
                </div>
            </div>
        `;
    });

    if (filteredTasks.length === 0) {
        const emptyMsg = '<p class="text-xs text-slate-400 text-center py-6 bg-white rounded-2xl border">Không có nhật ký công việc nào trong tháng này.</p>';
        taskListContainer.innerHTML = emptyMsg;
        tableBodyContainer.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-400 font-medium">Không có dữ liệu trong tháng này.</td></tr>`;
    }

    const avgScore = scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : 0;

    // Đổ dữ liệu tổng hợp lên các thẻ thống kê
    document.getElementById('repTotalCv').textContent = totalCv;
    document.getElementById('repTotalTime').textContent = `${totalTime}p`;
    document.getElementById('repTotalScore').textContent = totalScore;
    document.getElementById('repAvgScore').textContent = avgScore;
    document.getElementById('repPhotos').textContent = photosCount;
    document.getElementById('repMaps').textContent = mapsCount;
    document.getElementById('repConsult').textContent = consultCount;
};