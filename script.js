// ==========================================
// KONSTANTA DATA APLIKASI
// ==========================================
const galleryImages = [
  { src: "Images/Foto1.jpeg", alt: "Lenovo LOQ Wahyu - Foto 1" },
  { src: "Images/Foto2.jpeg", alt: "Lenovo LOQ Wahyu - Foto 2" },
  { src: "Images/Foto3.jpeg", alt: "Lenovo LOQ Wahyu - Foto 3" },
  { src: "Images/Foto4.jpeg", alt: "Lenovo LOQ Wahyu - Foto 4" }
];

const API_BASE_URL = "https://lenovo-loq-backend.asrifyudistira.workers.dev";

// Single Source of Truth dari API Cloudflare D1
let cicilanMaster = []; 
let pendingPayIndex = null;

const BULAN = {
  "Januari": 0, "Februari": 1, "Maret": 2, "April": 3,
  "Mei": 4, "Juni": 5, "Juli": 6, "Agustus": 7,
  "September": 8, "Oktober": 9, "November": 10, "Desember": 11
};

// ==========================================
// CACHE DOM ELEMENTS
// ==========================================
const DOM = {
  todayDate: document.getElementById("todayDate"),
  countdownText: document.getElementById("countdownText"),
  sudahBayar: document.getElementById("sudahBayar"),
  sisaHutang: document.getElementById("sisaHutang"),
  progressText: document.getElementById("progressText"),
  progressBar: document.getElementById("progressBar"),
  progressPercentage: document.getElementById("progressPercentage"),
  daftarCicilan: document.getElementById("daftarCicilan"),
  photoGallery: document.getElementById("photoGallery"),
  riwayatPembayaran: document.getElementById("riwayatPembayaran"),
  
  // Confirm Modal
  confirmModal: document.getElementById("confirmModal"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmOk: document.getElementById("confirmOk"),
  confirmCancel: document.getElementById("confirmCancel"),
  
  // Amount Modal
  amountModal: document.getElementById("amountModal"),
  amountModalTitle: document.getElementById("amountModalTitle"),
  amountModalTarget: document.getElementById("amountModalTarget"),
  amountModalInput: document.getElementById("amountModalInput"),
  amountModalError: document.getElementById("amountModalError"),
  amountModalCancel: document.getElementById("amountModalCancel"),
  amountModalSubmit: document.getElementById("amountModalSubmit"),
  
  // Toast
  successToast: document.getElementById("successToast"),
  successToastText: document.getElementById("successToastText")
};

// ==========================================
// HELPER FUNCTIONS & FORMATTING LOGIC
// ==========================================
function rupiah(n) {
  const safeNumber = Number(n ?? 0);
  return "Rp " + safeNumber.toLocaleString("id-ID");
}

function formatRupiahLive(value) {
  const numberString = value.replace(/[^,\d]/g, "").toString();
  const split = numberString.split(",");
  const sisa = split[0].length % 3;
  let rupiahMat = split[0].substr(0, sisa);
  const ribuan = split[0].substr(sisa).match(/\d{3}/gi);

  if (ribuan) {
    const separator = sisa ? "." : "";
    rupiahMat += separator + ribuan.join(".");
  }

  rupiahMat = split[1] !== undefined ? rupiahMat + "," + split[1] : rupiahMat;
  return rupiahMat ? "Rp " + rupiahMat : "";
}

// Mengambil nilai angka murni string rupiah
function getRawValue(formattedValue) {
  return Number(formattedValue.replace(/[^0-9]/g, ""));
}

function parseTanggal(str) {
  if (!str) return new Date();
  const p = str.split(" ");
  if (p.length < 3) return new Date();
  return new Date(parseInt(p[2], 10), BULAN[p[1]] || 0, parseInt(p[0], 10));
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDueDate(dueDateStr) {
  return dueDateStr || "—";
}

function formatPaidAt(isoString) {
  if (!isoString) return "—";
  try {
    const dateObj = new Date(isoString);
    const dateStr = dateObj.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    const jam = String(dateObj.getHours()).padStart(2, '0');
    const menit = String(dateObj.getMinutes()).padStart(2, '0');
    return `${dateStr} • ${jam}:${menit} WIB`;
  } catch (e) {
    return isoString;
  }
}

function getNextUnpaidIndex() {
  for (let i = 0; i < cicilanMaster.length; i++) {
    const paid = cicilanMaster[i].paid_amount || 0;
    const target = cicilanMaster[i].nominal || 0;
    if (paid < target) return i;
  }
  return -1;
}

function isOverdue(index) {
  if (!cicilanMaster[index]) return false;
  const paid = cicilanMaster[index].paid_amount || 0;
  const target = cicilanMaster[index].nominal || 0;
  if (paid >= target) return false;
  const today = startOfDay(new Date());
  const due = startOfDay(parseTanggal(cicilanMaster[index].due_date));
  return today > due;
}

function getCountdownText(index) {
  if (!cicilanMaster[index]) return "—";
  const today = startOfDay(new Date());
  const due = startOfDay(parseTanggal(cicilanMaster[index].due_date));
  const diffDays = Math.round((due - today) / 86400000);

  if (diffDays < 0) {
    const late = Math.abs(diffDays);
    return late === 1 ? "Terlambat 1 hari" : "Terlambat " + late + " hari";
  }
  if (diffDays === 0) return "Jatuh tempo hari ini";
  if (diffDays === 1) return "1 hari lagi";
  return diffDays + " hari lagi";
}

// ==========================================
// LOGIKA SOURCE DATA (CLOUDFLARE API)
// ==========================================
async function loadHistory() {
  try {
    const response = await fetch(`${API_BASE_URL}/payments`);
    if (!response.ok) throw new Error("Gagal mengambil data dari server D1.");
    cicilanMaster = await response.json();
    cicilanMaster.sort((a, b) => a.id - b.id);
  } catch (e) {
    console.error("Error load data dari Cloudflare Worker:", e);
    cicilanMaster = [];
  }
}

function saveHistory() {}

// ==========================================
// BUSINESS & STATE LOGIC
// ==========================================
function validatePayment(nominal, index) {
  if (!cicilanMaster[index]) return { valid: false, message: "Data cicilan tidak ditemukan." };
  if (isNaN(nominal) || nominal <= 0) {
    return { valid: false, message: "Masukkan nominal angka yang valid." };
  }
  const target = cicilanMaster[index].nominal || 0;
  if (nominal < target) {
    return { valid: false, message: "Minimal pembayaran adalah " + rupiah(target) };
  }
  return { valid: true, message: "" };
}

async function cancelInstallment(index) {
  if (!cicilanMaster[index]) return;
  const paymentId = cicilanMaster[index].id;
  const konfirmasiBatal = confirm("Apakah Anda yakin ingin membatalkan pembayaran untuk Cicilan " + (index + 1) + "?");
  if (konfirmasiBatal) {
    try {
      const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/cancel`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Gagal membatalkan di server.");
      
      await loadHistory();
      render();
    } catch (e) {
      console.error("Gagal POST cancel:", e);
      alert("Gagal memproses pembatalan ke server.");
    }
  }
}

async function payInstallment(index, nominal) {
  const check = validatePayment(nominal, index);
  if (!check.valid) return;

  const paymentId = cicilanMaster[index].id;

  try {
    const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid_amount: nominal })
    });
    if (!response.ok) throw new Error("Gagal menyimpan ke server.");

    const target = cicilanMaster[index].nominal || 0;
    const wasPaidBefore = (cicilanMaster[index].paid_amount || 0) >= target;
    
    await loadHistory();
    render();

    if (!wasPaidBefore && (cicilanMaster[index].paid_amount || 0) >= cicilanMaster[index].nominal) {
      showSuccessFeedback(index);
    }

    if (cicilanMaster.every(item => (item.paid_amount || 0) >= (item.nominal || 0))) {
      launchConfetti();
    }
  } catch (e) {
    console.error("Gagal POST pay:", e);
    alert("Gagal menyimpan pembayaran ke server.");
  }
}

// ==========================================
// MODAL INTERACTION LOGIC
// ==========================================
function validateRealtime() {
  if (pendingPayIndex === null) return;
  
  const rawNominal = getRawValue(DOM.amountModalInput.value);
  const check = validatePayment(rawNominal, pendingPayIndex);

  if (check.valid) {
    DOM.amountModalSubmit.disabled = false;
    DOM.amountModalError.style.display = "none";
    DOM.amountModalError.textContent = "";
  } else {
    DOM.amountModalSubmit.disabled = true;
    DOM.amountModalError.textContent = check.message;
    DOM.amountModalError.style.display = "block";
  }
}

function openAmountModal(index) {
  if (!DOM.amountModal || !cicilanMaster[index]) return;
  DOM.amountModal.style.display = "flex"; 
  DOM.amountModalTitle.textContent = "Masukkan Nominal Cicilan " + (index + 1);
  const target = cicilanMaster[index].nominal || 0;
  DOM.amountModalTarget.textContent = "Target bulanan: " + rupiah(target);
  
  DOM.amountModalInput.value = formatRupiahLive(target.toString());
  validateRealtime();
  
  setTimeout(() => {
    DOM.amountModalInput.focus();
    DOM.amountModalInput.select();
  }, 50);
}

function handlePayClick(index) {
  if (!cicilanMaster[index]) return;
  pendingPayIndex = index;
  if (!DOM.confirmMessage || !DOM.confirmModal) return;
  DOM.confirmMessage.textContent = "Apakah Anda yakin ingin membayar Cicilan " + (index + 1) + " (" + cicilanMaster[index].due_date + ")?";
  DOM.confirmModal.hidden = false;
  DOM.confirmModal.setAttribute("aria-hidden", "false");
  DOM.confirmOk.focus();
}

function closeConfirmModal() {
  if (!DOM.confirmModal) return;
  DOM.confirmModal.hidden = true;
  DOM.confirmModal.setAttribute("aria-hidden", "true");
}

function processAmountSubmit() {
  if (pendingPayIndex === null || DOM.amountModalSubmit.disabled) return;
  
  const rawNominal = getRawValue(DOM.amountModalInput.value);
  DOM.amountModal.style.display = "none"; 
  payInstallment(pendingPayIndex, rawNominal);
  pendingPayIndex = null;
}

function executePayment() {
  if (pendingPayIndex === null) return;
  const index = pendingPayIndex;
  closeConfirmModal();
  openAmountModal(index);
}

// ==========================================
// SUB-RENDER MODULAR FUNCTIONS WITH PROTECTION
// ==========================================
function renderDateBar(nextIdx) {
  try {
    if (!DOM.todayDate || !DOM.countdownText) return;

    DOM.todayDate.textContent = new Date().toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });

    DOM.countdownText.classList.remove("ux-bar-value--overdue", "ux-bar-value--today", "ux-bar-value--complete");

    if (nextIdx === -1) {
      DOM.countdownText.textContent = "Semua cicilan lunas";
      DOM.countdownText.classList.add("ux-bar-value--complete");
      return;
    }

    DOM.countdownText.textContent = getCountdownText(nextIdx) + " · " + cicilanMaster[nextIdx].due_date;

    if (isOverdue(nextIdx)) {
      DOM.countdownText.classList.add("ux-bar-value--overdue");
    } else if (startOfDay(parseTanggal(cicilanMaster[nextIdx].due_date)).getTime() === startOfDay(new Date()).getTime()) {
      DOM.countdownText.classList.add("ux-bar-value--today");
    }
  } catch (err) {
    console.error("Gagal renderDateBar:", err);
  }
}

function renderSummary(totalBayar, totalHarga) {
  try {
    if (DOM.sudahBayar) DOM.sudahBayar.innerHTML = rupiah(totalBayar);
    if (DOM.sisaHutang) DOM.sisaHutang.innerHTML = rupiah(totalHarga - totalBayar);
  } catch (err) {
    console.error("Gagal renderSummary:", err);
  }
}

function renderProgress() {
  try {
    if (!DOM.progressText || !DOM.progressBar || !DOM.progressPercentage) return;
    
    const cicilanLunas = cicilanMaster.filter(item => (item.paid_amount || 0) >= (item.nominal || 0)).length;
    const totalCicilan = cicilanMaster.length;
    DOM.progressText.innerHTML = `${cicilanLunas} / ${totalCicilan} Cicilan`;

    const progressPct = totalCicilan > 0 ? (cicilanLunas / totalCicilan) * 100 : 0;
    DOM.progressBar.style.width = progressPct + "%";
    DOM.progressPercentage.textContent = Math.round(progressPct) + "%";
  } catch (err) {
    console.error("Gagal renderProgress:", err);
  }
}

function renderInstallmentList(nextUnpaid) {
  try {
    if (!DOM.daftarCicilan) return 0;
    DOM.daftarCicilan.innerHTML = "";
    let totalBayar = 0;

    cicilanMaster.forEach((item, index) => {
      const nominalBayar = item.paid_amount || 0;
      const targetAmount = item.nominal || 0;
      const sudah = nominalBayar >= targetAmount;
      totalBayar += nominalBayar;

      const overdue = !sudah && isOverdue(index);
      const isNext = index === nextUnpaid && !sudah;

      const card = document.createElement("div");
      card.className = sudah ? "cicilan cicilan--paid" : "cicilan cicilan--pending";
      if (isNext) card.classList.add("cicilan--next");
      if (overdue) card.classList.add("cicilan--overdue");
      
      card.dataset.index = index;
      card.dataset.status = sudah ? "paid" : "pending";

      let badges = `<span class="status-badge ${sudah ? "status-badge--paid" : "status-badge--pending"}">${sudah ? "Sudah Dibayar" : "Belum Dibayar"}</span>`;
      if (overdue) badges += `<span class="status-badge status-badge--overdue">Terlambat</span>`;
      if (isNext) badges += `<span class="status-badge status-badge--next">Berikutnya</span>`;

      card.innerHTML = `
        <div class="info">
            <div class="cicilan-header">
                <h4>Cicilan ${index + 1}</h4>
                ${badges}
            </div>
            <div class="cicilan-meta">
                <span class="meta-item">📅 ${item.due_date || "—"}</span>
                <span class="meta-item meta-item--amount">💰 Target: ${rupiah(targetAmount)}</span>
                <span class="meta-item">✅ Dibayar: ${rupiah(nominalBayar)}</span>
            </div>
        </div>
        <button class="btn-pay ${sudah ? "btn-pay--cancel" : ""}">${sudah ? "Batalkan" : "Bayar"}</button>
      `;

      DOM.daftarCicilan.appendChild(card);
    });

    return totalBayar;
  } catch (err) {
    console.error("Gagal renderInstallmentList:", err);
    return 0;
  }
}

function renderHistory() {
  try {
    if (!DOM.riwayatPembayaran) return;
    DOM.riwayatPembayaran.innerHTML = "";

    const riwayatAktif = cicilanMaster.filter(item => (item.paid_amount || 0) > 0);

    if (riwayatAktif.length === 0) {
      const emptyCard = document.createElement("div");
      emptyCard.className = "history-empty";
      emptyCard.textContent = "Belum ada riwayat pembayaran.";
      DOM.riwayatPembayaran.appendChild(emptyCard);
      return;
    }

    riwayatAktif.forEach(item => {
      const card = document.createElement("div");
      card.className = "history-card";

      card.innerHTML = `
        <div class="history-card__info">
            <div class="history-card__header">
                <h4>✓ Cicilan ${item.id}</h4>
            </div>
          <div class="history-card__content">
              <div class="history-card__row">
                  <span class="history-card__label">💰 Nominal</span>
                  <span class="history-card__value history-card__value--amount">${rupiah(item.paid_amount)}</span>
              </div>
              <div class="history-card__row">
                  <span class="history-card__label">📅 Jatuh Tempo</span>
                  <span class="history-card__value">${formatDueDate(item.due_date)}</span>
              </div>
              <div class="history-card__row">
                  <span class="history-card__label">🕒 Dibayar Pada</span>
                  <span class="history-card__value">${formatPaidAt(item.paid_at)}</span>
              </div>
          </div>
        </div>
      `;
      DOM.riwayatPembayaran.appendChild(card);
    });
  } catch (err) {
    console.error("Gagal renderHistory:", err);
  }
}

function renderGallery() {
  try {
    if (!DOM.photoGallery) return;
    DOM.photoGallery.innerHTML = "";

    galleryImages.forEach((imgData) => {
      const imgEl = document.createElement("img");
      imgEl.src = imgData.src;
      imgEl.alt = imgData.alt;
      imgEl.loading = "lazy";

      DOM.photoGallery.appendChild(imgEl);
    });
  } catch (err) {
    console.error("Gagal renderGallery:", err);
  }
}

function render() {
  const totalHargaMaster = cicilanMaster.reduce((acc, curr) => acc + (curr.nominal || 0), 0);
  const nextUnpaid = getNextUnpaidIndex();
  
  const totalBayar = renderInstallmentList(nextUnpaid);
  renderSummary(totalBayar, totalHargaMaster);
  renderProgress();
  renderDateBar(nextUnpaid);
  renderHistory(); 
}

// ==========================================
// ANIMATION & TOAST LOGIC
// ==========================================
function showSuccessFeedback(index) {
  if (!DOM.successToast || !DOM.successToastText) return;
  DOM.successToastText.textContent = "Cicilan " + (index + 1) + " berhasil dicatat!";
  DOM.successToast.classList.add("toast--visible");

  const card = document.querySelector(`.cicilan[data-index="${index}"]`);
  if (card) {
    card.classList.add("cicilan--success-flash");
    setTimeout(() => card.classList.remove("cicilan--success-flash"), 1400);
  }
  setTimeout(() => DOM.successToast.classList.remove("toast--visible"), 3000);
}

function launchConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let w = window.innerWidth, h = window.innerHeight;
  canvas.width = w; canvas.height = h;

  const palette = ["#30a46c", "#0071e3", "#ffd60a", "#ff375f", "#bf5af2", "#ffffff"];
  const pieces = [];
  for (let i = 0; i < 160; i++) {
    pieces.push({
      x: w * 0.5 + (Math.random() - 0.5) * w * 0.6,
      y: h * 0.35 + (Math.random() - 0.5) * 80,
      w: 5 + Math.random() * 7,
      h: 3 + Math.random() * 5,
      color: palette[Math.floor(Math.random() * palette.length)],
      vx: (Math.random() - 0.5) * 6,
      vy: -(4 + Math.random() * 6),
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 10,
      gravity: 0.12 + Math.random() * 0.08
    });
  }

  let frame = 0;
  function tick() {
    ctx.clearRect(0, 0, w, h);
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    });
    frame++;
    if (frame < 200) requestAnimationFrame(tick); else canvas.remove();
  }
  requestAnimationFrame(tick);
}

// ==========================================
// CENTRALIZED EVENT LISTENERS
// ==========================================
if (DOM.daftarCicilan) {
  DOM.daftarCicilan.addEventListener("click", (e) => {
    const button = e.target.closest(".btn-pay");
    if (!button) return;
    
    const card = button.closest(".cicilan");
    const index = parseInt(card.dataset.index, 10);
    const status = card.dataset.status;

    if (status === "paid") {
      cancelInstallment(index);
    } else {
      handlePayClick(index);
    }
  });
}

if (DOM.confirmCancel) {
  DOM.confirmCancel.addEventListener("click", () => {
    closeConfirmModal();
    pendingPayIndex = null;
  });
}
if (DOM.confirmOk) DOM.confirmOk.addEventListener("click", executePayment);
if (DOM.confirmModal) {
  const backdrop = DOM.confirmModal.querySelector(".modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", () => {
      closeConfirmModal();
      pendingPayIndex = null;
    });
  }
}

if (DOM.amountModalInput) {
  DOM.amountModalInput.addEventListener("input", (e) => {
    e.target.value = formatRupiahLive(e.target.value);
    validateRealtime();
  });

  DOM.amountModalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      processAmountSubmit();
    }
  });
}

if (DOM.amountModalCancel) {
  DOM.amountModalCancel.addEventListener("click", () => {
    DOM.amountModal.style.display = "none";
    pendingPayIndex = null;
  });
}

if (DOM.amountModalSubmit) {
  DOM.amountModalSubmit.addEventListener("click", processAmountSubmit);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeConfirmModal();
    if (DOM.amountModal) DOM.amountModal.style.display = "none";
    pendingPayIndex = null;
  }
});

// ==========================================
// INITIALIZE RUNTIME
// ==========================================
async function initialize() {
  await loadHistory();
  render();
  renderGallery();
}

initialize();
// ==========================================
// LOGIKA WORKER CLOUD SYNC STATUS
// ==========================================
let lastSyncedTime = null;
let syncTimerInterval = null;

const SyncStatus = {
  element: document.getElementById("cloudSyncStatus"),
  text: document.getElementById("syncText"),

  setSyncing() {
    if (!this.element) return;
    clearInterval(syncTimerInterval);
    this.element.className = "sync-status sync-status--syncing";
    this.text.textContent = "Syncing...";
  },

  setSynced() {
    if (!this.element) return;
    this.element.className = "sync-status sync-status--synced";
    lastSyncedTime = new Date();
    this.updateTimeAgo();
    
    clearInterval(syncTimerInterval);
    syncTimerInterval = setInterval(() => this.updateTimeAgo(), 60000); // Perbarui setiap menit
  },

  setOffline() {
    if (!this.element) return;
    clearInterval(syncTimerInterval);
    this.element.className = "sync-status sync-status--offline";
    this.text.textContent = "Offline";
  },

  updateTimeAgo() {
    if (!lastSyncedTime) return;
    const diffMs = new Date() - lastSyncedTime;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      this.text.textContent = "Synced: Just now";
    } else {
      this.text.textContent = `Synced: ${diffMins}m ago`;
    }
  }
};

// ==========================================
// SINKRONISASI PADA KODE ASLI (HOOKS)
// ==========================================

// 1. Pada fungsi pengambilan data utama (Contoh: fetchData atau initialize)
// Tambahkan pemicu di dalam blok try-catch Anda yang sudah ada:
async function fetchCicilanData() { // Sesuaikan nama fungsi fetch data asli Anda
  try {
    SyncStatus.setSyncing(); // <-- Taruh di baris paling atas saat fetch mulai berjalan
    
    const response = await fetch(`${API_BASE_URL}/payments`);
    const data = await response.json();
    
    // Logika render aplikasi bawaan Anda...
    // renderApp(data); 

    SyncStatus.setSynced(); // <-- Taruh di sini setelah data sukses diterima dan dirender
  } catch (error) {
    console.error(error);
    SyncStatus.setOffline(); // <-- Taruh di sini di dalam blok catch jika koneksi gagal
  }
}

// 2. Pada fungsi eksekusi pembayaran (Contoh: executePayment)
// Pastikan status kembali dipicu ketika transaksi memperbarui database Cloudflare:
async function executePayment() {
  try {
    SyncStatus.setSyncing(); // <-- Pasang saat tombol konfirmasi pembayaran ditekan dan request dikirim
    
    // Logika POST/PUT request pembayaran bawaan Anda...
    // const res = await fetch(`${API_BASE_URL}/payments/.../pay`, { method: 'POST' });
    
    // Setelah sukses update data di client side:
    SyncStatus.setSynced(); // <-- Pemicu otomatis terupdate menjadi "Just now" kembali
  } catch (error) {
    SyncStatus.setOffline();
  }
}