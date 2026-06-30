// ==========================================
// KONSTANTA DATA APLIKASI
// ==========================================
const galleryImages = [
    { src: "Images/Foto1.jpeg", alt: "Lenovo LOQ Wahyu - Foto 1" },
    { src: "Images/Foto2.jpeg", alt: "Lenovo LOQ Wahyu - Foto 2" },
    { src: "Images/Foto3.jpeg", alt: "Lenovo LOQ Wahyu - Foto 3" },
    { src: "Images/Foto4.jpeg", alt: "Lenovo LOQ Wahyu - Foto 4" }
  ];
  
  const cicilan = [
    985756, 985756, 985756, 985756,
    985756, 985756, 985756, 985756,
    985756, 985756, 985756, 985756,
    985756, 985756, 985756, 985762
  ];
  
  const tanggal = [
    "1 Juli 2026", "1 Agustus 2026", "1 September 2026", "1 Oktober 2026",
    "1 November 2026", "1 Desember 2026", "1 Januari 2027", "1 Februari 2027",
    "1 Maret 2027", "1 April 2027", "1 Mei 2027", "1 Juni 2027",
    "1 Juli 2027", "1 Agustus 2027", "1 September 2027", "1 Oktober 2027"
  ];
  
  const TOTAL_HARGA = cicilan.reduce((acc, curr) => acc + curr, 0);
  
  let pembayaran = JSON.parse(localStorage.getItem("loq_wahyu"));
  if (!Array.isArray(pembayaran) || pembayaran.length !== cicilan.length) {
    pembayaran = new Array(cicilan.length).fill(0);
  }
  
  let riwayat = [];
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
    return "Rp " + n.toLocaleString("id-ID");
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
  
  function getRawValue(formattedValue) {
    return Number(formattedValue.replace(/[^0-9]/g, ""));
  }
  
  function parseTanggal(str) {
    const p = str.split(" ");
    return new Date(parseInt(p[2], 10), BULAN[p[1]], parseInt(p[0], 10));
  }
  
  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  
  // 1. Helper untuk format tanggal Jatuh Tempo (dueDate)
  function formatDueDate(dueDateStr) {
    return dueDateStr; // Mengembalikan string "1 November 2026" dari data array asli
  }
  
  // 2. Helper untuk parsing ISO string paidAt ke format lokalisasi Bahasa Indonesia
  function formatPaidAt(isoString) {
    if (!isoString) return "—";
    const dateObj = new Date(isoString);
    
    // Format Tanggal: 30 Oktober 2026
    const dateStr = dateObj.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  
    // Format Jam: 19:42
    const jam = String(dateObj.getHours()).padStart(2, '0');
    const menit = String(dateObj.getMinutes()).padStart(2, '0');
    
    return `${dateStr} • ${jam}:${menit} WIB`;
  }
  
  function getNextUnpaidIndex() {
    for (let i = 0; i < cicilan.length; i++) {
      if (pembayaran[i] < cicilan[i]) return i;
    }
    return -1;
  }
  
  function isOverdue(index) {
    if (pembayaran[index] >= cicilan[index]) return false;
    const today = startOfDay(new Date());
    const due = startOfDay(parseTanggal(tanggal[index]));
    return today > due;
  }
  
  function getCountdownText(index) {
    const today = startOfDay(new Date());
    const due = startOfDay(parseTanggal(tanggal[index]));
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
  // MODUL ARSITEKTUR RIWAYAT PEMBAYARAN
  // ==========================================
  function loadHistory() {
    try {
      const storedHistory = localStorage.getItem("loq_wahyu_history");
      riwayat = storedHistory ? JSON.parse(storedHistory) : [];
      if (!Array.isArray(riwayat)) riwayat = [];
    } catch (e) {
      riwayat = [];
    }
  }
  
  function saveHistory() {
    localStorage.setItem("loq_wahyu_history", JSON.stringify(riwayat));
  }
  
  function addHistory(index, nominal) {
    // PENGEMBANGAN STRUKTUR DATA: Menggunakan ISO String untuk stabilitas waktu riwayat
    const itemRiwayat = {
      installment: index + 1,
      nominal: nominal,
      dueDate: tanggal[index],          // Diambil dari master array jadwal cicilan
      paidAt: new Date().toISOString(), // Waktu aktual saat tombol simpan diklik
      method: "",
      note: "",
      receipt: ""
    };
  
    removeHistory(index); 
    riwayat.push(itemRiwayat);
    riwayat.sort((a, b) => a.installment - b.installment);
    saveHistory();
  }
  
  function removeHistory(index) {
    riwayat = riwayat.filter(item => item.installment !== (index + 1));
    saveHistory();
  }
  
  function renderHistory() {
    if (!DOM.riwayatPembayaran) return;
    DOM.riwayatPembayaran.innerHTML = "";
  
    if (riwayat.length === 0) {
      const emptyCard = document.createElement("div");
      emptyCard.className = "history-empty";
      emptyCard.textContent = "Belum ada riwayat pembayaran.";
      DOM.riwayatPembayaran.appendChild(emptyCard);
      return;
    }
  
    riwayat.forEach(item => {
      const card = document.createElement("div");
      card.className = "history-card";
  
      card.innerHTML = `
        <div class="history-card__header">
            <h4>✓ Cicilan ${item.installment}</h4>
        </div>
        <div class="history-card__content">
            <div class="history-card__row">
                <span class="history-card__label">💰 Nominal</span>
                <span class="history-card__value history-card__value--amount">${rupiah(item.nominal)}</span>
            </div>
            <div class="history-card__row">
                <span class="history-card__label">📅 Jatuh Tempo</span>
                <span class="history-card__value">${formatDueDate(item.dueDate)}</span>
            </div>
            <div class="history-card__row">
                <span class="history-card__label">🕒 Dibayar Pada</span>
                <span class="history-card__value">${formatPaidAt(item.paidAt)}</span>
            </div>
        </div>
      `;
      DOM.riwayatPembayaran.appendChild(card);
    });
  }
  
  // ==========================================
  // BUSINESS & STATE LOGIC
  // ==========================================
  function validatePayment(nominal, index) {
    if (isNaN(nominal) || nominal <= 0) {
      return { valid: false, message: "Masukkan nominal angka yang valid." };
    }
    if (nominal < cicilan[index]) {
      return { valid: false, message: "Minimal pembayaran adalah " + rupiah(cicilan[index]) };
    }
    return { valid: true, message: "" };
  }
  
  function savePayment() {
    localStorage.setItem("loq_wahyu", JSON.stringify(pembayaran));
  }
  
  function cancelInstallment(index) {
    const konfirmasiBatal = confirm("Apakah Anda yakin ingin membatalkan pembayaran untuk Cicilan " + (index + 1) + "?");
    if (konfirmasiBatal) {
      pembayaran[index] = 0;
      savePayment();
      removeHistory(index);
      render(); 
    }
  }
  
  function payInstallment(index, nominal) {
    const check = validatePayment(nominal, index);
    if (!check.valid) return;
  
    pembayaran[index] = nominal;
    savePayment();
    addHistory(index, nominal);
    render(); 
  
    if (pembayaran[index] >= cicilan[index]) {
      showSuccessFeedback(index);
    }
  
    if (pembayaran.every((nom, idx) => nom >= cicilan[idx])) {
      launchConfetti();
    }
  }
  
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
  
  // ==========================================
  // MODAL INTERACTION LOGIC
  // ==========================================
  function openAmountModal(index) {
    if (!DOM.amountModal) return;
    DOM.amountModal.style.display = "flex"; 
    DOM.amountModalTitle.textContent = "Masukkan Nominal Cicilan " + (index + 1);
    DOM.amountModalTarget.textContent = "Target bulanan: " + rupiah(cicilan[index]);
    
    DOM.amountModalInput.value = formatRupiahLive(cicilan[index].toString());
    validateRealtime();
    
    setTimeout(() => {
      DOM.amountModalInput.focus();
      DOM.amountModalInput.select();
    }, 50);
  }
  
  function handlePayClick(index) {
    pendingPayIndex = index;
    if (!DOM.confirmMessage || !DOM.confirmModal) return;
    DOM.confirmMessage.textContent = "Apakah Anda yakin ingin membayar Cicilan " + (index + 1) + " (" + tanggal[index] + ")?";
    DOM.confirmModal.hidden = false;
    DOM.confirmModal.setAttribute("aria-hidden", "false");
    DOM.confirmOk.focus();
  }
  
  function closeConfirmModal() {
    if (!DOM.confirmModal) return;
    DOM.confirmModal.hidden = true;
    DOM.confirmModal.setAttribute("aria-hidden", "true");
  }
  
  // Mengambil nilai angka murni string rupiah sebelum eksekusi pembayaran
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
  // SUB-RENDER MODULAR FUNCTIONS
  // ==========================================
  function renderDateBar(nextIdx) {
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
  
    DOM.countdownText.textContent = getCountdownText(nextIdx) + " · " + tanggal[nextIdx];
  
    if (isOverdue(nextIdx)) {
      DOM.countdownText.classList.add("ux-bar-value--overdue");
    } else if (startOfDay(parseTanggal(tanggal[nextIdx])).getTime() === startOfDay(new Date()).getTime()) {
      DOM.countdownText.classList.add("ux-bar-value--today");
    }
  }
  
  function renderSummary(totalBayar) {
    if (DOM.sudahBayar) DOM.sudahBayar.innerHTML = rupiah(totalBayar);
    if (DOM.sisaHutang) DOM.sisaHutang.innerHTML = rupiah(TOTAL_HARGA - totalBayar);
  }
  
  function renderProgress() {
    if (!DOM.progressText || !DOM.progressBar || !DOM.progressPercentage) return;
    
    const cicilanLunas = pembayaran.filter((nominal, idx) => nominal >= cicilan[idx]).length;
    const totalCicilan = cicilan.length;
    DOM.progressText.innerHTML = `${cicilanLunas} / ${totalCicilan} Cicilan`;
  
    const progressPct = (cicilanLunas / totalCicilan) * 100;
    DOM.progressBar.style.width = progressPct + "%";
    DOM.progressPercentage.textContent = Math.round(progressPct) + "%";
  }
  
  function renderInstallmentList(nextUnpaid) {
    if (!DOM.daftarCicilan) return 0;
    DOM.daftarCicilan.innerHTML = "";
    let totalBayar = 0;
  
    tanggal.forEach((tgl, index) => {
      const nominalBayar = pembayaran[index];
      const sudah = nominalBayar >= cicilan[index];
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
                <span class="meta-item">📅 ${tgl}</span>
                <span class="meta-item meta-item--amount">💰 Target: ${rupiah(cicilan[index])}</span>
                <span class="meta-item">✅ Dibayar: ${rupiah(nominalBayar)}</span>
            </div>
        </div>
        <button class="btn-pay ${sudah ? "btn-pay--cancel" : ""}">${sudah ? "Batalkan" : "Bayar"}</button>
      `;
  
      DOM.daftarCicilan.appendChild(card);
    });
  
    return totalBayar;
  }
  
  function renderGallery() {
    if (!DOM.photoGallery) return;
    DOM.photoGallery.innerHTML = "";
  
    galleryImages.forEach((imgData) => {
      const imgEl = document.createElement("img");
      imgEl.src = imgData.src;
      imgEl.alt = imgData.alt;
      imgEl.loading = "lazy";
  
      DOM.photoGallery.appendChild(imgEl);
    });
  }
  
  function render() {
    const nextUnpaid = getNextUnpaidIndex();
    const totalBayar = renderInstallmentList(nextUnpaid);
    renderSummary(totalBayar);
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
  function initialize() {
    loadHistory();
    render();
    renderGallery();
  }
  
  initialize();