// ==========================================
// CONFIGURATION & STATE
// ==========================================
const API_URL = "https://your-cloudflare-worker.workers.dev/api/installments"; // Sesuaikan dengan URL Cloudflare Worker Anda

let cicilanMaster = [];

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    fetchData();
    setupEventListeners();
});

// ==========================================
// API FETCH & DATA UTILITIES
// ==========================================
async function fetchData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Gagal mengambil data dari server");
        
        cicilanMaster = await response.json();
        
        // Memastikan data berbentuk array jika backend mengembalikan single object atau wrap
        if (!Array.isArray(cicilanMaster)) {
            cicilanMaster = cicilanMaster ? [cicilanMaster] : [];
        }

        renderApp();
    } catch (error) {
        console.error("Error fetching data:", error);
        alert("Gagal memuat data dari cloud server.");
    }
}

async function updateInstallmentOnServer(id, data) {
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error("Gagal mengupdate data di server");
        return await response.json();
    } catch (error) {
        console.error("Error updating data:", error);
        alert("Gagal menyimpan perubahan ke server.");
        return null;
    }
}

function rupiah(number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0
    }).format(number);
}

// ==========================================
// CORE RENDERERS
// ==========================================
function renderApp() {
    renderSummary();
    renderProgress();
    renderDaftarCicilan();
    renderRiwayatPembayaran();
}

function renderSummary() {
    const totalHargaEl = document.getElementById("totalHarga");
    const totalDibayarEl = document.getElementById("totalDibayar");
    const sisaTagihanEl = document.getElementById("sisaTagihan");

    const totalHarga = cicilanMaster.reduce((acc, curr) => acc + (curr.nominal || 0), 0);
    const totalDibayar = cicilanMaster.reduce((acc, curr) => acc + (curr.paid_amount ?? 0), 0);
    const sisaTagihan = totalHarga - totalDibayar;

    if (totalHargaEl) totalHargaEl.textContent = rupiah(totalHarga);
    if (totalDibayarEl) totalDibayarEl.textContent = rupiah(totalDibayar);
    if (sisaTagihanEl) sisaTagihanEl.textContent = rupiah(sisaTagihan);
}

function renderProgress() {
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");

    if (!cicilanMaster.length) return;

    const totalCicilan = cicilanMaster.length;
    const cicilanLunas = cicilanMaster.filter(item => item.status === "paid" || (item.paid_amount >= item.nominal)).length;
    const percentage = Math.round((cicilanLunas / totalCicilan) * 100) || 0;

    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (progressText) progressText.textContent = `${percentage}% Terbuka (${cicilanLunas}/${totalCicilan})`;
}

function renderDaftarCicilan() {
    const container = document.getElementById("daftarCicilanContainer");
    if (!container) return;

    container.innerHTML = "";

    cicilanMaster.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "cicilan-item"; // Menjaga UI/Class tetap sama

        const isPaid = item.status === "paid";
        const paidAmount = item.paid_amount ?? 0;

        row.innerHTML = `
            <div class="cicilan-info">
                <span class="cicilan-title">Cicilan ke-${item.installment}</span>
                <span class="cicilan-target">Target: ${rupiah(item.nominal)}</span>
                <span class="cicilan-paid">Dibayar: ${rupiah(paidAmount)}</span>
                <span class="cicilan-date">Jatuh Tempo: ${item.due_date || "-"}</span>
            </div>
            <div class="cicilan-action">
                ${isPaid 
                    ? `<span class="badge badge-success">Lunas</span>` 
                    : `<button class="btn btn-primary" onclick="openBayarModal(${index})">Bayar</button>`
                }
            </div>
        `;
        container.appendChild(row);
    });
}

function renderRiwayatPembayaran() {
    const container = document.getElementById("riwayatPembayaranContainer");
    if (!container) return;

    container.innerHTML = "";

    const riwayatSelesai = cicilanMaster.filter(item => item.status === "paid");

    if (riwayatSelesai.length === 0) {
        container.innerHTML = `<p class="empty-state">Belum ada riwayat pembayaran.</p>`;
        return;
    }

    riwayatSelesai.forEach(item => {
        const row = document.createElement("div");
        row.className = "riwayat-item";

        row.innerHTML = `
            <div class="riwayat-info">
                <span class="riwayat-title">Pembayaran Cicilan ke-${item.installment}</span>
                <span class="riwayat-date">Tanggal: ${item.paid_at || "-"}</span>
                ${item.note ? `<span class="riwayat-note">Catatan: ${item.note}</span>` : ""}
            </div>
            <div class="riwayat-amount">
                <span class="text-success">+ ${rupiah(item.paid_amount ?? 0)}</span>
            </div>
        `;
        container.appendChild(row);
    });
}

// ==========================================
// MODAL & ACTIONS
// ==========================================
let activeIndex = null;

window.openBayarModal = function(index) {
    activeIndex = index;
    const item = cicilanMaster[index];
    
    const modalInputAmount = document.getElementById("modalInputAmount");
    const modalTargetAmountText = document.getElementById("modalTargetAmountText");
    const modalNote = document.getElementById("modalNote");

    if (modalTargetAmountText) {
        modalTargetAmountText.textContent = rupiah(cicilanMaster[index].nominal);
    }
    if (modalInputAmount) {
        modalInputAmount.value = cicilanMaster[index].nominal;
    }
    if (modalNote) {
        modalNote.value = "";
    }

    // Tampilkan modal sesuai framework/UI bawaan tanpa modifikasi DOM/Class structure
    const modal = document.getElementById("bayarModal");
    if (modal) modal.classList.add("show");
};

window.closeBayarModal = function() {
    activeIndex = null;
    const modal = document.getElementById("bayarModal");
    if (modal) modal.classList.remove("show");
};

async function handleProsesPembayaran() {
    if (activeIndex === null) return;

    const inputAmountEl = document.getElementById("modalInputAmount");
    const noteEl = document.getElementById("modalNote");

    const nominalBayar = parseFloat(inputAmountEl.value) || 0;
    const catatan = noteEl ? noteEl.value : "";

    if (nominalBayar <= 0) {
        alert("Masukkan nominal pembayaran yang valid.");
        return;
    }

    if (nominalBayar < cicilanMaster[activeIndex].nominal) {
        alert(`Nominal pembayaran kurang dari target tagihan (${rupiah(cicilanMaster[activeIndex].nominal)})`);
        return;
    }

    const currentItem = cicilanMaster[activeIndex];
    
    // Siapkan payload data untuk Cloudflare API sesuai struktur backend baru
    const updatedPayload = {
        ...currentItem,
        paid_amount: nominalBayar,
        paid_at: new Date().toISOString().split('T')[0],
        status: "paid",
        note: catatan
    };

    const successData = await updateInstallmentOnServer(currentItem.id, updatedPayload);

    if (successData) {
        // Update local state setelah server sukses menerima data
        cicilanMaster[activeIndex] = successData;
        closeBayarModal();
        renderApp();
    }
}

// ==========================================
// EVENT LISTENERS SETUP
// ==========================================
function setupEventListeners() {
    const btnSubmitBayar = document.getElementById("btnSubmitBayar");
    const btnCloseModal = document.getElementById("btnCloseModal");

    if (btnSubmitBayar) {
        btnSubmitBayar.addEventListener("click", handleProsesPembayaran);
    }
    if (btnCloseModal) {
        btnCloseModal.addEventListener("click", closeBayarModal);
    }
}