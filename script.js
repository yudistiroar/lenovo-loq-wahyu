// ==========================================
// KONSTANTA DATA BULANAN & GALERI
// ==========================================
const galleryImages = [
  { src: "Images/Foto1.jpeg", alt: "Lenovo LOQ Wahyu - Foto 1" },
  { src: "Images/Foto2.jpeg", alt: "Lenovo LOQ Wahyu - Foto 2" },
  { src: "Images/Foto3.jpeg", alt: "Lenovo LOQ Wahyu - Foto 3" },
  { src: "Images/Foto4.jpeg", alt: "Lenovo LOQ Wahyu - Foto 4" }
];

const API_BASE_URL = "https://lenovo-loq-backend.asrifyudistira.workers.dev";

let cicilanMaster = []; 
let pendingPayIndex = null;
let isCancelOperation = false; // Flag pelacak jenis operasi
let currentTotalHargaVal = 0;
let currentSudahBayarVal = 0;
let currentSisaHutangVal = 0;

const BULAN = {
  "Januari": 0, "Februari": 1, "Maret": 2, "April": 3,
  "Mei": 4, "Juni": 5, "Juli": 6, "Agustus": 7,
  "September": 8, "Oktober": 9, "November": 10, "Desember": 11
};

// ==========================================
// CENTRALIZED CACHE DOM ELEMENTS
// ==========================================
const DOM = {
  todayDate: document.getElementById("todayDate"),
  countdownText: document.getElementById("countdownText"),
  sudahBayar: document.getElementById("sudahBayar"),
  sisaHutang: document.getElementById("sisaHutang"),
  progressText: document.getElementById("progressText"),
  progressPercent: document.getElementById("progressPercent"),
  progressBar: document.getElementById("progressBar"),
  progressTitle: document.getElementById("progressTitle"),
  progressSub: document.getElementById("progressSub"),
  progressPanel: document.getElementById("progressPanel"),
  totalHarga: document.getElementById("totalHarga"),
  daftarCicilan: document.getElementById("daftarCicilan"),
  riwayatPembayaran: document.getElementById("riwayatPembayaran"),
  photoGallery: document.getElementById("photoGallery"),
  
  // Konfirmasi Modal Nodes
  confirmModal: document.getElementById("confirmModal"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmCancel: document.getElementById("confirmCancel"),
  confirmOk: document.getElementById("confirmOk"),
  
  // Toast Node
  successToast: document.getElementById("successToast"),
  successToastText: document.getElementById("successToastText"),
  
  // Custom Amount Modal Nodes
  amountModal: document.getElementById("amountModal"),
  amountModalTitle: document.getElementById("amountModalTitle"),
  amountModalTarget: document.getElementById("amountModalTarget"),
  amountModalInput: document.getElementById("amountModalInput"),
  amountModalError: document.getElementById("amountModalError"),
  amountModalCancel: document.getElementById("amountModalCancel"),
  amountModalSubmit: document.getElementById("amountModalSubmit")
};

// ==========================================
// CORE INFRASTRUCTURE DATA SYNCHRONIZATION
// ==========================================
function updateSyncState(state, text) {
  if (window.updateCloudSyncVisualState) {
    let stateClass = `sync-status--${state}`;
    window.updateCloudSyncVisualState(stateClass, text);
  }
}

// ==========================================
// CORE UTILITIES & TRANSITIONS
// ==========================================
function animateNumber(element, start, end, duration = 600) {
  if (!element) return;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Cubic Ease-Out Transition Formula
    const easeProgress = progress * (2 - progress);
    const currentVal = Math.floor(start + (end - start) * easeProgress);
    
    element.textContent = formatRupiah(currentVal);
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = formatRupiah(end);
    }
  }
  requestAnimationFrame(update);
}

function formatRupiah(angka) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(angka);
}

function parseRupiah(str) {
  return parseInt(str.replace(/[^0-9]/g, ""), 10) || 0;
}

function formatRupiahLive(value) {
  const clean = value.replace(/[^0-9]/g, "");
  if (!clean) return "";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(clean).replace(/,00$/, "");
}

function parseDateISO(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

function getNextUnpaidIndex() {
  for (let i = 0; i < cicilanMaster.length; i++) {
    const paidAmount = cicilanMaster[i].paid_amount ?? 0;
    const nominal = cicilanMaster[i].nominal ?? 0;
    if (cicilanMaster[i].status !== "paid" && paidAmount < nominal) {
      return i;
    }
  }
  return -1;
}

// ==========================================
// INITIALIZATION LIFE-CYCLE
// ==========================================
async function initialize() {
  try {
    updateSyncState("syncing", "Syncing...");
    setStaticDates();
    renderGallery();
    await fetchCicilan();
    updateSyncState("synced", "Synced just now");
  } catch (err) {
    console.error("Initialization Failed:", err);
    updateSyncState("offline", "Offline");
  }
}

function setStaticDates() {
  if (DOM.todayDate) {
    DOM.todayDate.textContent = new Date().toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric"
    });
  }
}

async function fetchCicilan() {
  try {
    const response = await fetch(`${API_BASE_URL}/payments`);
    if (!response.ok) throw new Error("Gagal mengambil data dari server.");
    cicilanMaster = await response.json();
    
    if (!Array.isArray(cicilanMaster)) {
      cicilanMaster = cicilanMaster ? [cicilanMaster] : [];
    }
    
    // Sort array by installment incremental counter
    cicilanMaster.sort((a, b) => (a.installment ?? 0) - (b.installment ?? 0));
    renderAll();
  } catch (error) {
    console.error("Fetch API Error:", error);
    throw error;
  }
}

// ==========================================
// GRAPHICAL INTERFACE RENDERING ENGINE
// ==========================================
function renderAll() {
  renderSummaryData();
  renderProgressPanel();
  renderDaftarCicilan();
  renderRiwayatPembayaran();
}

function renderSummaryData() {
  const totalHargaVal = cicilanMaster.reduce((acc, curr) => acc + (curr.nominal ?? 0), 0);
  const sudahBayarVal = cicilanMaster.reduce((acc, curr) => acc + (curr.paid_amount ?? 0), 0);
  const sisaHutangVal = Math.max(0, totalHargaVal - sudahBayarVal);

  animateNumber(DOM.totalHarga, currentTotalHargaVal, totalHargaVal);
  animateNumber(DOM.sudahBayar, currentSudahBayarVal, sudahBayarVal);
  animateNumber(DOM.sisaHutang, currentSisaHutangVal, sisaHutangVal);

  currentTotalHargaVal = totalHargaVal;
  currentSudahBayarVal = sudahBayarVal;
  currentSisaHutangVal = sisaHutangVal;
}

function renderProgressPanel() {
  if (cicilanMaster.length === 0) return;
  if (DOM.progressPanel) DOM.progressPanel.hidden = false;
  
  const totalCount = cicilanMaster.length;
  const lunasCount = cicilanMaster.filter(c => c.status === "paid" || (c.paid_amount >= c.nominal)).length;
  const percent = Math.round((lunasCount / totalCount) * 100);

  if (DOM.progressPercent) DOM.progressPercent.textContent = `${percent}%`;
  if (DOM.progressBar) {
    DOM.progressBar.style.width = `${percent}%`;
    DOM.progressBar.setAttribute("aria-valuenow", percent);
  }
  
  if (DOM.progressText) {
    DOM.progressText.textContent = `${percent}% Cicilan Terbuka (${lunasCount} dari ${totalCount} Bulan Lunas)`;
  }

  if (percent === 100) {
    if (DOM.progressTitle) DOM.progressTitle.textContent = "Status Pelunasan Selesai 🎉";
    if (DOM.progressSub) DOM.progressSub.textContent = "Selamat! Laptop Anda telah sepenuhnya terlunasi tanpa tunggakan.";
  } else {
    const nextIdx = getNextUnpaidIndex();
    if (nextIdx !== -1) {
      if (DOM.progressTitle) DOM.progressTitle.textContent = `Cicilan Bulan Ke-${cicilanMaster[nextIdx].installment || (nextIdx + 1)} Aktif`;
      if (DOM.progressSub) DOM.progressSub.textContent = `Selesaikan tagihan sebelum tenggat waktu demi menjaga histori finansial.`;
    }
  }
}

function renderDaftarCicilan() {
  if (!DOM.daftarCicilan) return;
  DOM.daftarCicilan.innerHTML = "";

  const nextUnpaidIdx = getNextUnpaidIndex();

  cicilanMaster.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "cicilan";
    card.style.animationDelay = `${index * 30}ms`;

    const paidAmount = item.paid_amount ?? 0;
    const nominal = item.nominal ?? 0;
    const isLunas = item.status === "paid" || paidAmount >= nominal;

    let statusLabel = "Pending";
    let statusClass = "pending";
    let badgeAttributes = "";

    if (isLunas) {
      statusLabel = "Lunas";
      statusClass = "paid";
      card.classList.add("cicilan--paid");
      badgeAttributes = `onclick="window.triggerCancelFlow(${index})" role="button" tabindex="0" title="Klik untuk membatalkan pelunasan"`;
    } else if (index === nextUnpaidIdx) {
      statusLabel = "Berikutnya";
      statusClass = "next";
      card.classList.add("cicilan--next");
      
      if (DOM.countdownText) DOM.countdownText.textContent = item.due_date || "—";
    } else {
      const dueDate = parseDateISO(item.due_date);
      if (dueDate && dueDate < new Date()) {
        statusLabel = "Terlambat";
        statusClass = "overdue";
        card.classList.add("cicilan--overdue");
      }
    }

    // TASK 2: Merubah teks string tombol di dalam template literal menjadi "Bayar Sekarang"
    card.innerHTML = `
      <div class="info">
        <div class="cicilan-header">
          <h4>Cicilan Ke-${item.installment}</h4>
          <span class="status-badge status-badge--${statusClass}" ${badgeAttributes}>${statusLabel}</span>
        </div>
        <div class="cicilan-meta">
          <span class="meta-item">Target: <strong class="meta-item--amount">${formatRupiah(nominal)}</strong></span>
          <span class="meta-item">Dibayar: <strong class="meta-item--amount">${formatRupiah(paidAmount)}</strong></span>
          <span class="meta-item">Jatuh Tempo: <strong>${item.due_date || "—"}</strong></span>
        </div>
      </div>
      ${isLunas ? "" : `<button type="button" class="btn-pay" onclick="triggerPaymentFlow(${index})">Bayar Sekarang</button>`}
    `;
    DOM.daftarCicilan.appendChild(card);
  });
}

function renderRiwayatPembayaran() {
  if (!DOM.riwayatPembayaran) return;
  DOM.riwayatPembayaran.innerHTML = "";

  const paidHistory = cicilanMaster.filter(c => (c.paid_amount ?? 0) > 0);
  if (paidHistory.length === 0) {
    DOM.riwayatPembayaran.innerHTML = `<div class="history-empty">Belum ada riwayat aktivitas transfer tersimpan.</div>`;
    return;
  }

  // Sorting history: most recent paid transaction pops up first
  const sortedHistory = [...paidHistory].sort((a, b) => new Date(b.paid_at || 0) - new Date(a.paid_at || 0));

  sortedHistory.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "history-card";
    card.style.animationDelay = `${index * 40}ms`;

    card.innerHTML = `
      <div class="history-card__header">
        <h4>Transaksi Sukses</h4>
      </div>
      <div class="history-card__content">
        <div class="history-card__row">
          <span class="history-card__label">Instansi</span>
          <span class="history-card__value">Cicilan Ke-${item.installment}</span>
        </div>
        <div class="history-card__row">
          <span class="history-card__label">Jumlah Transfer</span>
          <span class="history-card__value history-card__value--amount">${formatRupiah(item.paid_amount ?? 0)}</span>
        </div>
        <div class="history-card__row">
          <span class="history-card__label">Tanggal Masuk</span>
          <span class="history-card__value">${item.paid_at || "—"}</span>
        </div>
      </div>
    `;
    DOM.riwayatPembayaran.appendChild(card);
  });
}

function renderGallery() {
  if (!DOM.photoGallery) return;
  DOM.photoGallery.innerHTML = "";
  galleryImages.forEach(img => {
    const el = document.createElement("img");
    el.src = img.src;
    el.alt = img.alt;
    DOM.photoGallery.appendChild(el);
  });
}

// ==========================================
// DYNAMIC MUTATION INTERACTION WORKFLOWS
// ==========================================
window.triggerPaymentFlow = function(index) {
  pendingPayIndex = index;
  isCancelOperation = false;
  const item = cicilanMaster[index];
  const paidAmount = item.paid_amount ?? 0;
  const nominal = item.nominal ?? 0;

  // Partial Payment Detection Flow Switcher
  if (paidAmount > 0 && paidAmount < nominal) {
    if (DOM.amountModalTitle) DOM.amountModalTitle.textContent = `Selesaikan Cicilan Ke-${item.installment}`;
    if (DOM.amountModalTarget) DOM.amountModalTarget.textContent = `Kekurangan tagihan: ${formatRupiah(nominal - paidAmount)}`;
    if (DOM.amountModalInput) DOM.amountModalInput.value = formatRupiahLive(String(nominal - paidAmount));
    if (DOM.amountModal) DOM.amountModal.style.display = "flex";
    validateRealtime();
  } else {
    openConfirmModal(`Apakah Anda yakin ingin membayar penuh untuk Cicilan Ke-${item.installment} sejumlah ${formatRupiah(nominal)}?`);
  }
};

window.triggerCancelFlow = function(index) {
  pendingPayIndex = index;
  isCancelOperation = true;
  openConfirmModal("Batalkan pembayaran ini?");
};

function openConfirmModal(message) {
  if (DOM.confirmMessage) DOM.confirmMessage.textContent = message;
  if (DOM.confirmModal) {
    DOM.confirmModal.hidden = false;
    DOM.confirmModal.style.display = "flex";
  }
}

function closeConfirmModal() {
  if (DOM.confirmModal) {
    DOM.confirmModal.hidden = true;
    DOM.confirmModal.style.display = "none";
  }
}

function validateRealtime() {
  if (!DOM.amountModalInput || !DOM.amountModalError || !DOM.amountModalSubmit || pendingPayIndex === null) return;
  
  const item = cicilanMaster[pendingPayIndex];
  const inputVal = parseRupiah(DOM.amountModalInput.value);
  const remainingDebt = (item.nominal ?? 0) - (item.paid_amount ?? 0);

  if (inputVal < remainingDebt) {
    DOM.amountModalError.textContent = `Nominal tidak boleh kurang dari sisa hutang bulan ini (${formatRupiah(remainingDebt)})`;
    DOM.amountModalError.style.display = "block";
    DOM.amountModalSubmit.disabled = true;
  } else {
    DOM.amountModalError.textContent = "";
    DOM.amountModalError.style.display = "none";
    DOM.amountModalSubmit.disabled = false;
  }
}

function processAmountSubmit() {
  if (pendingPayIndex === null || !DOM.amountModalSubmit || DOM.amountModalSubmit.disabled) return;
  const amount = parseRupiah(DOM.amountModalInput.value);
  
  if (DOM.amountModal) DOM.amountModal.style.display = "none";
  openConfirmModal(`Konfirmasi pembayaran khusus sebesar ${formatRupiah(amount)} untuk Cicilan Ke-${cicilanMaster[pendingPayIndex].installment}?`);
}

async function executePayment() {
  if (pendingPayIndex === null) return;
  const originalBtnContent = DOM.confirmOk.innerHTML;
  
  try {
    if (DOM.confirmOk) {
      DOM.confirmOk.disabled = true;
      DOM.confirmOk.innerHTML = `<span class="spinner"></span> Menyimpan...`;
    }
    if (DOM.confirmCancel) DOM.confirmCancel.disabled = true;
    
    updateSyncState("syncing", "Syncing...");
    
    const item = cicilanMaster[pendingPayIndex];
    
    let requestUrl = `${API_BASE_URL}/payments/${item.id}/pay`;
    let fetchOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    };

    if (isCancelOperation) {
      requestUrl = `${API_BASE_URL}/payments/${item.id}/cancel`;
    } else {
      let payValue = item.nominal ?? 0;
      if (DOM.amountModalInput && DOM.amountModalInput.value) {
        const customAmount = parseRupiah(DOM.amountModalInput.value);
        if (customAmount > 0) payValue = customAmount;
      }
      fetchOptions.body = JSON.stringify({ paid_amount: payValue });
    }

    const response = await fetch(requestUrl, fetchOptions);

    if (!response.ok) throw new Error("API Jaringan Error!");

    if (isCancelOperation) {
      showToast(`Pembayaran Cicilan Ke-${item.installment} berhasil dibatalkan.`);
    } else {
      showToast(`Pembayaran Cicilan Ke-${item.installment} berhasil diproses!`);
    }
    
    closeConfirmModal();
    
    await fetchCicilan();
    updateSyncState("synced", "Synced just now");
    
    setTimeout(() => {
      const cards = DOM.daftarCicilan.querySelectorAll(".cicilan");
      if (cards && cards[pendingPayIndex]) {
        cards[pendingPayIndex].classList.add("cicilan--success-flash");
      }
      pendingPayIndex = null;
      isCancelOperation = false;
    }, 150);

  } catch (error) {
    console.error("Payment Operation Failed:", error);
    alert("Gagal memperbarui status data ke server Cloudflare D1.");
    updateSyncState("offline", "Offline");
  } finally {
    if (DOM.confirmOk) {
      DOM.confirmOk.disabled = false;
      DOM.confirmOk.innerHTML = originalBtnContent;
    }
    if (DOM.confirmCancel) DOM.confirmCancel.disabled = false;
    if (DOM.amountModalInput) DOM.amountModalInput.value = "";
  }
}

function showToast(msg) {
  if (!DOM.successToast) return;
  if (DOM.successToastText) DOM.successToastText.textContent = msg;
  DOM.successToast.classList.add("toast--visible");
  setTimeout(() => {
    DOM.successToast.classList.remove("toast--visible");
  }, 4000);
}

// ==========================================
// REGISTRASI EVENT LISTENERS
// ==========================================
if (DOM.confirmCancel) {
  DOM.confirmCancel.addEventListener("click", () => {
    closeConfirmModal();
    pendingPayIndex = null;
    isCancelOperation = false;
  });
}
if (DOM.confirmOk) DOM.confirmOk.addEventListener("click", executePayment);
if (DOM.confirmModal) {
  const backdrop = DOM.confirmModal.querySelector(".modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", () => {
      closeConfirmModal();
      pendingPayIndex = null;
      isCancelOperation = false;
    });
  }
}

if (DOM.amountModalInput) {
  DOM.amountModalInput.addEventListener("input", (e) => {
    e.target.value = formatRupiahLive(e.target.value);
    validateRealtime();
  });
  DOM.amountModalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") processAmountSubmit();
  });
}

if (DOM.amountModalCancel) {
  DOM.amountModalCancel.addEventListener("click", () => {
    if (DOM.amountModal) DOM.amountModal.style.display = "none";
    pendingPayIndex = null;
    isCancelOperation = false;
  });
}
if (DOM.amountModalSubmit) DOM.amountModalSubmit.addEventListener("click", processAmountSubmit);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeConfirmModal();
    if (DOM.amountModal) DOM.amountModal.style.display = "none";
    isCancelOperation = false;
  }
});

// Task 4: Helper Function
function formatTanggalIndo(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split('-');
  const bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", 
                 "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${d} ${bulan[parseInt(m) - 1]} ${y}`;
}

// Task 2: Perbarui fungsi renderProgressPanel
function renderProgressPanel() {
  // ... logika sebelumnya ...
  const sisaBulan = cicilanMaster.filter(c => c.status !== 'paid').length;
  
  // Tambahkan elemen ini di DOM HTML Anda: <div id="sisaBulanText"></div>
  const el = document.getElementById("sisaBulanText");
  if(el) el.textContent = `${sisaBulan} Bulan Tersisa`;
}

// Task 4: Update renderDaftarCicilan
// Gunakan: formatTanggalIndo(item.due_date) di bagian Jatuh Tempo.

initialize();
