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

// 1. Lắng nghe dữ liệu KPI từ Firebase
onValue(ref(db, 'kpis'), (s) => { 
    allKpiData = s.exists() ? s.val() : {}; 
    window.triggerDataLoad(); 
});

// 2. Lắng nghe dữ liệu Nhân sự
onValue(ref(db, 'staffs'), (s) => {
    const tbody = document.getElementById('staffTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (s.exists()) {
        Object.entries(s.val()).forEach(([id, st]) => {
            tbody.innerHTML += `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-3.5 font-bold text-slate-800">${st.name || ''}</td>
                    <td class="p-3.5 text-slate-600 font-medium">${st.role || ''}</td>
                    <td class="p-3.5 text-emerald-600 font-bold">${st.username || ''}</td>
                    <td class="p-3.5 text-slate-400 font-mono">••••••</td>
                    <td class="p-3.5 text-center">
                        <button onclick="window.deleteStaff('${id}')" class="text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 p-2 rounded-xl transition" title="Xóa tài khoản">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-400 font-medium">Chưa có tài khoản kỹ thuật nào trong hệ thống.</td></tr>`;
    }
});

// 3. Trigger lọc dữ liệu KPI theo tháng
window.triggerDataLoad = () => {
    const monthInput = document.getElementById('filterMonth');
    if (!monthInput) return;
    const month = monthInput.value;
    const entries = Object.entries(allKpiData).filter(([id, d]) => d.ngayThucHien && d.ngayThucHien.startsWith(month)).reverse();
    renderKpiTable(entries);
    renderReport(entries);
};

// 4. Render Bảng Duyệt KPI (Đã cập nhật hiển thị Tư vấn bán hàng & tối ưu icon)
function renderKpiTable(entries) {
    const tbody = document.getElementById('adminKpiTable');
    if (!tbody) return;
    
    if (entries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-slate-400 font-medium">Không có dữ liệu công việc trong tháng này.</td></tr>`;
        return;
    }

    tbody.innerHTML = entries.map(([id, item]) => {
        const isChamped = item.diemKpi !== undefined && item.diemKpi !== null && Number(item.diemKpi) > 0;
        const rowBg = isChamped ? 'bg-white' : 'bg-emerald-50/20';

        // Hiển thị thông tin tư vấn bán hàng nếu nhân viên tích chọn
        let tuVanInfo = item.coTuVanBanHang ? `
            <div class="text-[11px] text-indigo-700 bg-indigo-50/80 p-2 rounded-xl mt-1.5 border border-indigo-100 font-medium">
                <i class="fa-solid fa-comments mr-1"></i> <strong>Tư vấn:</strong> ${item.noiDungTuVan || 'Có tư vấn bán hàng'}
            </div>` : '';

        return `
            <tr class="${rowBg} hover:bg-slate-50 transition-colors border-b border-slate-100">
                <td class="p-4">
                    <div class="text-xs font-black text-slate-700">${item.ngayThucHien ? item.ngayThucHien.split('-').reverse().join('/') : ''}</div>
                    <div class="text-xs font-bold text-emerald-600 mt-0.5">${item.ktPhuTrach || ''}</div>
                </td>
                <td class="p-4">
                    <div class="text-xs font-black text-blue-600">${item.sttCv || ''}</div>
                    <div class="text-xs font-bold text-slate-800 mt-0.5">${item.khachHang || ''}</div>
                </td>
                <td class="p-4 max-w-xs">
                    <div class="text-xs text-slate-600 font-medium leading-relaxed">${item.noiDung || ''}</div>
                    ${tuVanInfo}
                </td>
                <td class="p-4 text-center">
                    <div class="flex justify-center items-center gap-2 text-base">
                        <i class="fa-solid fa-camera ${item.chupAnh ? 'text-emerald-500' : 'text-slate-200'}" title="Chụp ảnh"></i>
                        <i class="fa-solid fa-map ${item.danhGiaMaps ? 'text-blue-500' : 'text-slate-200'}" title="Đánh giá Maps"></i>
                    </div>
                </td>
                <td class="p-4 text-center text-xs font-extrabold text-slate-600">${item.thoiGian || 0}p</td>
                
                <!-- Điểm KPI -->
                <td class="p-3 text-center bg-emerald-50/30">
                    <input type="number" step="0.5" id="diem_${id}" value="${item.diemKpi || 0}" class="w-16 border border-emerald-200 bg-white rounded-xl p-2 text-center font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm">
                </td>
                
                <!-- Ghi chú / Đánh giá từ Quản lý -->
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

// 5. Render Báo Cáo Tổng Hợp Tháng Theo Nhân Sự
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

// 6. Actions (Lưu đánh giá, Thêm/Xóa nhân sự, Chuyển tab)
window.saveReview = (id) => {
    const diemEl = document.getElementById(`diem_${id}`);
    const danhGiaEl = document.getElementById(`danhgia_${id}`);
    if (!diemEl || !danhGiaEl) return;
    
    update(ref(db, `kpis/${id}`), { 
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
    } else {
        alert("Vui lòng điền đầy đủ các thông tin bắt buộc!");
    }
};

window.deleteStaff = (id) => { 
    if (confirm("Bạn có chắc chắn muốn xóa tài khoản kỹ thuật này không?")) { 
        remove(ref(db, `staffs/${id}`)); 
    } 
};

window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(d => d.classList.add('hidden'));
    const targetTab = document.getElementById(tab);
    if (targetTab) targetTab.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('bg-emerald-50', 'text-emerald-700', 'font-extrabold');
        b.classList.add('text-slate-600', 'font-bold');
    });
    
    const activeBtn = document.getElementById('nav_' + tab);
    if (activeBtn) {
        activeBtn.classList.remove('text-slate-600', 'font-bold');
        activeBtn.classList.add('bg-emerald-50', 'text-emerald-700', 'font-extrabold');
    }
    
    const titles = { 
        'kpiTab': 'Duyệt & Chấm Điểm KPI', 
        'reportTab': 'Báo Cáo Tổng Hợp Hiệu Suất', 
        'staffTab': 'Quản Lý Nhân Sự & Tài Khoản' 
    };
    const titleEl = document.getElementById('headerTitle');
    if (titleEl) titleEl.textContent = titles[tab];
};