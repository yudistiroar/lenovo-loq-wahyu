const cicilan = [
    985756, 985756, 985756, 985756,
    985756, 985756, 985756, 985756,
    985756, 985756, 985756, 985756,
    985756, 985756, 985756, 985762
  ];
  
  const tanggal = [
    "1 Juli 2026",
    "1 Agustus 2026",
    "1 September 2026",
    "1 Oktober 2026",
    "1 November 2026",
    "1 Desember 2026",
    "1 Januari 2027",
    "1 Februari 2027",
    "1 Maret 2027",
    "1 April 2027",
    "1 Mei 2027",
    "1 Juni 2027",
    "1 Juli 2027",
    "1 Agustus 2027",
    "1 September 2027",
    "1 Oktober 2027"
  ];
  
  // Menghitung TOTAL_HARGA secara otomatis menggunakan reduce()
  const TOTAL_HARGA = cicilan.reduce((acc, curr) => acc + curr, 0);
  
  // Model data nominal pembayaran
  let pembayaran = JSON.parse(localStorage.getItem("loq_wahyu"));
  if (!Array.isArray(pembayaran) || pembayaran.length !== cicilan.length) {
    pembayaran = new Array(cicilan.length).fill(0);
  }
  
  let pendingPayIndex = null;
  
  const BULAN = {
    "Januari": 0, "Februari": 1, "Maret": 2, "April": 3,
    "Mei": 4, "Juni": 5, "Juli": 6, "Agustus": 7,
    "September": 8, "Oktober": 9, "November": 10, "Desember": 11
  };
  
  // ==========================================
  // FUNGSI UTILITAS & PARSING
  // ==========================================
  
  function rupiah(n) {
    return "Rp " + n.toLocaleString("id-ID");
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
  
  function getNextUnpaidIndex() {
    for (let i = 0; i < cicilan.length; i++) {
      if (pembayaran[i] < cicilan[i]) {
        return i;
      }
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
  // FUNGSI LOGIKA BISNIS & TANGGUNG JAWAB TUNGGAL
  // ==========================================
  
  function validatePayment(nominal, index) {
    if (isNaN(nominal) || nominal <= 0) {
      alert("Masukkan nominal angka yang valid.");
      return false;
    }
    if (nominal < cicilan[index]) {
      alert("Gagal: Nominal pembayaran tidak boleh kurang dari target cicilan yaitu " + rupiah(cicilan[index]));
      return false;
    }
    return true;
  }
  
  function savePayment() {
    localStorage.setItem("loq_wahyu", JSON.stringify(pembayaran));
  }
  
  function cancelInstallment(index) {
    const konfirmasiBatal = confirm("Apakah Anda yakin ingin membatalkan pembayaran untuk Cicilan " + (index + 1) + "?");
    if (konfirmasiBatal) {
      pembayaran[index] = 0;
      savePayment();
      render();
    }
  }
  
  function payInstallment(index, nominal) {
    if (!validatePayment(nominal, index)) return;
  
    pembayaran[index] = nominal;
    savePayment();
    render();
  
    if (pembayaran[index] >= cicilan[index]) {
      showSuccessFeedback(index);
    }
  
    const semuaLunas = pembayaran.every((nom, idx) => nom >= cicilan[idx]);
    if (semuaLunas) {
      launchConfetti();
    }
  }
  
  // Menggantikan fungsi toggle lama
  function toggle(index) {
    const sudah = pembayaran[index] >= cicilan[index];
    if (sudah) {
      cancelInstallment(index);
    }
  }
  
  // ==========================================
  // MANAJEMEN MODAL INPUT NOMINAL (PENGGANTI PROMPT)
  // ==========================================
  
  function openAmountModal(index) {
    let amountModal = document.getElementById("amountModal");
    if (!amountModal) {
      amountModal = document.createElement("div");
      amountModal.id = "amountModal";
      amountModal.className = "modal"; 
      amountModal.style.position = "fixed";
      amountModal.style.zIndex = "1000";
      amountModal.style.left = "0";
      amountModal.style.top = "0";
      amountModal.style.width = "100%";
      amountModal.style.height = "100%";
      amountModal.style.backgroundColor = "rgba(0,0,0,0.5)";
      amountModal.style.display = "flex";
      amountModal.style.alignItems = "center";
      amountModal.style.justifyContent = "center";
      
      amountModal.innerHTML = `
        <div class="modal-content" style="background:#fff; padding:24px; border-radius:12px; width:90%; max-width:400px; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
          <h3 id="amountModalTitle" style="margin-top:0; margin-bottom:12px; font-size:1.2rem;">Input Nominal</h3>
          <p id="amountModalTarget" style="margin-bottom:16px; color:#666; font-size:0.9rem;"></p>
          <input type="number" id="amountModalInput" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; margin-bottom:20px; font-size:1rem; box-sizing:border-box;" />
          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button id="amountModalCancel" class="btn-pay btn-pay--cancel" style="padding:8px 16px;">Batal</button>
            <button id="amountModalSubmit" class="btn-pay" style="padding:8px 16px; background:#30a46c; color:#fff; border:none;">Simpan</button>
          </div>
        </div>
      `;
      document.body.appendChild(amountModal);
    }
  
    amountModal.style.display = "flex";
    
    const titleEl = document.getElementById("amountModalTitle");
    const targetEl = document.getElementById("amountModalTarget");
    const inputEl = document.getElementById("amountModalInput");
    
    titleEl.textContent = "Masukkan Nominal Cicilan " + (index + 1);
    targetEl.textContent = "Minimal target bulanan: " + rupiah(cicilan[index]);
    inputEl.value = cicilan[index];
    inputEl.focus();
    inputEl.select();
  
    document.getElementById("amountModalCancel").onclick = function() {
      amountModal.style.display = "none";
    };
  
    document.getElementById("amountModalSubmit").onclick = function() {
      const nominal = Number(inputEl.value);
      amountModal.style.display = "none";
      payInstallment(index, nominal);
    };
  }
  
  function handlePayClick(index) {
    pendingPayIndex = index;
    document.getElementById("confirmMessage").textContent =
      "Apakah Anda yakin ingin membayar Cicilan " + (index + 1) + " (" + tanggal[index] + ")?";
    const modal = document.getElementById("confirmModal");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("confirmOk").focus();
  }
  
  function closeConfirmModal() {
    pendingPayIndex = null;
    const modal = document.getElementById("confirmModal");
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }
  
  function executePayment() {
    if (pendingPayIndex === null) return;
    const index = pendingPayIndex;
    
    closeConfirmModal();
    openAmountModal(index);
  }
  
  // ==========================================
  // SUB-RENDER FUNCTIONS (DIDEFINISIKAN SEBELUM DIJALANKAN)
  // ==========================================
  
  function renderDateBar() {
    const todayEl = document.getElementById("todayDate");
    const countdownEl = document.getElementById("countdownText");
  
    if (!todayEl || !countdownEl) return;
  
    todayEl.textContent = new Date().toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  
    const nextIdx = getNextUnpaidIndex();
    countdownEl.classList.remove("ux-bar-value--overdue", "ux-bar-value--today", "ux-bar-value--complete");
  
    if (nextIdx === -1) {
      countdownEl.textContent = "Semua cicilan lunas";
      countdownEl.classList.add("ux-bar-value--complete");
      return;
    }
  
    countdownEl.textContent = getCountdownText(nextIdx) + " · " + tanggal[nextIdx];
  
    if (isOverdue(nextIdx)) {
      countdownEl.classList.add("ux-bar-value--overdue");
    } else if (startOfDay(parseTanggal(tanggal[nextIdx])).getTime() === startOfDay(new Date()).getTime()) {
      countdownEl.classList.add("ux-bar-value--today");
    }
  }
  
  function renderSummary(totalBayar) {
    const sudahBayarEl = document.getElementById("sudahBayar");
    const sisaHutangEl = document.getElementById("sisaHutang");
    
    if (sudahBayarEl) sudahBayarEl.innerHTML = rupiah(totalBayar);
    if (sisaHutangEl) sisaHutangEl.innerHTML = rupiah(TOTAL_HARGA - totalBayar);
  }
  
  function renderProgress() {
    const progressTextEl = document.getElementById("progressText");
    const progressBarEl = document.getElementById("progressBar");
    const progressPercentageEl = document.getElementById("progressPercentage");
  
    const cicilanLunas = pembayaran.filter((nominal, idx) => nominal >= cicilan[idx]).length;
    const totalCicilan = cicilan.length;
    
    if (progressTextEl) progressTextEl.innerHTML = cicilanLunas + " / " + totalCicilan + " Cicilan";
  
    const progressPct = (cicilanLunas / totalCicilan) * 100;
    if (progressBarEl) progressBarEl.style.width = progressPct + "%";
    if (progressPercentageEl) progressPercentageEl.textContent = Math.round(progressPct) + "%";
  }
  
  function renderInstallmentList(nextUnpaid) {
    const daftar = document.getElementById("daftarCicilan");
    if (!daftar) return 0;
    
    daftar.innerHTML = "";
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
  
      let badges = `<span class="status-badge ${sudah ? "status-badge--paid" : "status-badge--pending"}">${sudah ? "Sudah Dibayar" : "Belum Dibayar"}</span>`;
      if (overdue) badges += `<span class="status-badge status-badge--overdue">Terlambat</span>`;
      if (isNext) badges += `<span class="status-badge status-badge--next">Berikutnya</span>`;
  
      const payAction = sudah ? `toggle(${index})` : `handlePayClick(${index})`;
  
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
        <button class="btn-pay ${sudah ? "btn-pay--cancel" : ""}" onclick="${payAction}">
            ${sudah ? "Batalkan" : "Bayar"}
        </button>
      `;
  
      daftar.appendChild(card);
    });
  
    return totalBayar;
  }
  
  // Fungsi render utama yang memanggil sub-render di atas
  function render() {
    const nextUnpaid = getNextUnpaidIndex();
    const totalBayar = renderInstallmentList(nextUnpaid);
    renderSummary(totalBayar);
    renderProgress();
    renderDateBar(); // Sekarang fungsi ini sudah pasti terbaca di atas
  }
  
  // ==========================================
  // FEEDBACK & ANIMASI KEMBANG API
  // ==========================================
  
  function showSuccessFeedback(index) {
    const toast = document.getElementById("successToast");
    const toastText = document.getElementById("successToastText");
    if (!toast || !toastText) return;
  
    toastText.textContent = "Cicilan " + (index + 1) + " berhasil dicatat!";
    toast.classList.add("toast--visible");
  
    const card = document.querySelector('.cicilan[data-index="' + index + '"]');
    if (card) {
      card.classList.add("cicilan--success-flash");
      setTimeout(function () {
        card.classList.remove("cicilan--success-flash");
      }, 1400);
    }
  
    setTimeout(function () {
      toast.classList.remove("toast--visible");
    }, 3000);
  }
  
  function launchConfetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  
    const canvas = document.createElement("canvas");
    canvas.className = "confetti-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
  
    const ctx = canvas.getContext("2d");
    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
  
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
      pieces.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      frame++;
      if (frame < 200) {
        requestAnimationFrame(tick);
      } else {
        canvas.remove();
      }
    }
    requestAnimationFrame(tick);
  }
  
  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  
  const confirmCancelEl = document.getElementById("confirmCancel");
  const confirmOkEl = document.getElementById("confirmOk");
  const confirmModalEl = document.getElementById("confirmModal");
  
  if (confirmCancelEl) confirmCancelEl.addEventListener("click", closeConfirmModal);
  if (confirmOkEl) confirmOkEl.addEventListener("click", executePayment);
  if (confirmModalEl) {
    const backdrop = confirmModalEl.querySelector(".modal-backdrop");
    if (backdrop) backdrop.addEventListener("click", closeConfirmModal);
  }
  
  document.addEventListener("keydown", function (e) {
    if (confirmModalEl && confirmModalEl.hidden) return;
    if (e.key === "Escape") closeConfirmModal();
  });
  
  // Jalankan aplikasi pertama kali setelah semuanya siap
  render();