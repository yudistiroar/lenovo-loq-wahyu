// --- Konfigurasi & Data ---
const cicilan = [985756, 985756, 985756, 985756, 985756, 985756, 985756, 985756, 985756, 985756, 985756, 985756, 985756, 985756, 985756, 985762];
const TOTAL_HARGA = cicilan.reduce((acc, curr) => acc + curr, 0);

const tanggal = ["1 Juli 2026", "1 Agustus 2026", "1 September 2026", "1 Oktober 2026", "1 November 2026", "1 Desember 2026", "1 Januari 2027", "1 Februari 2027", "1 Maret 2027", "1 April 2027", "1 Mei 2027", "1 Juni 2027", "1 Juli 2027", "1 Agustus 2027", "1 September 2027", "1 Oktober 2027"];

let pembayaran = JSON.parse(localStorage.getItem("loq_wahyu")) || new Array(cicilan.length).fill(0);

// --- State Management ---
function savePayment() {
    localStorage.setItem("loq_wahyu", JSON.stringify(pembayaran));
    render();
}

function validatePayment(index, nominal) {
    if (isNaN(nominal) || nominal < cicilan[index]) {
        alert("Nominal tidak valid atau kurang dari target: " + rupiah(cicilan[index]));
        return false;
    }
    return true;
}

// --- Logika Bisnis ---
function payInstallment(index, nominal) {
    if (validatePayment(index, nominal)) {
        pembayaran[index] = nominal;
        savePayment();
        showSuccessFeedback(index);
        checkCompletion();
    }
}

function cancelInstallment(index) {
    if (confirm("Batalkan pembayaran cicilan ini?")) {
        pembayaran[index] = 0;
        savePayment();
    }
}

function checkCompletion() {
    if (pembayaran.every((n, i) => n >= cicilan[i])) launchConfetti();
}

// --- Rendering Modules ---
function renderSummary(totalBayar) {
    document.getElementById("sudahBayar").textContent = rupiah(totalBayar);
    document.getElementById("sisaHutang").textContent = rupiah(TOTAL_HARGA - totalBayar);
}

function renderProgress() {
    const lunas = pembayaran.filter((n, i) => n >= cicilan[i]).length;
    const pct = (lunas / cicilan.length) * 100;
    document.getElementById("progressText").textContent = `${lunas} / ${cicilan.length} Cicilan`;
    document.getElementById("progressBar").style.width = `${pct}%`;
    document.getElementById("progressPercentage").textContent = `${Math.round(pct)}%`;
}

function renderInstallmentList(nextIdx) {
    const container = document.getElementById("daftarCicilan");
    container.innerHTML = "";
    
    cicilan.forEach((target, i) => {
        const paid = pembayaran[i];
        const isPaid = paid >= target;
        const card = document.createElement("div");
        card.className = `cicilan ${isPaid ? "cicilan--paid" : "cicilan--pending"}`;
        // ... (sisipkan logika pembuatan card seperti script lama Anda)
        container.appendChild(card);
    });
}

function render() {
    const totalBayar = pembayaran.reduce((a, b) => a + b, 0);
    renderSummary(totalBayar);
    renderProgress();
    renderInstallmentList(getNextUnpaidIndex());
    updateDateBar();
}

// --- Helpers ---
function rupiah(n) { return "Rp " + n.toLocaleString("id-ID"); }
function getNextUnpaidIndex() { return pembayaran.findIndex((p, i) => p < cicilan[i]); }

// --- Event Handlers untuk Modal ---
// Tambahkan event listener pada tombol "Konfirmasi" di modal Anda untuk memanggil payInstallment
document.getElementById("confirmOk").addEventListener("click", () => {
    const val = Number(document.getElementById("paymentInput").value);
    payInstallment(pendingPayIndex, val);
    closeConfirmModal();
});

render();