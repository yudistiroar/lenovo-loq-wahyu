const TOTAL_HARGA = 15772102;

const cicilan = [
  985756,985756,985756,985756,
  985756,985756,985756,985756,
  985756,985756,985756,985756,
  985756,985756,985756,985762
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

let pembayaran =
JSON.parse(localStorage.getItem("loq_wahyu")) || [];

let pendingPayIndex = null;

const BULAN = {
"Januari":0,"Februari":1,"Maret":2,"April":3,
"Mei":4,"Juni":5,"Juli":6,"Agustus":7,
"September":8,"Oktober":9,"November":10,"Desember":11
};

function rupiah(n){
    return "Rp " + n.toLocaleString("id-ID");
}

function parseTanggal(str){
    const p = str.split(" ");
    return new Date(
        parseInt(p[2],10),
        BULAN[p[1]],
        parseInt(p[0],10)
    );
}

function startOfDay(d){
    const x = new Date(d);
    x.setHours(0,0,0,0);
    return x;
}

function getNextUnpaidIndex(){
    for(let i = 0; i < tanggal.length; i++){
        if(!pembayaran.includes(i)) return i;
    }
    return -1;
}

function isOverdue(index){
    if(pembayaran.includes(index)) return false;
    const today = startOfDay(new Date());
    const due = startOfDay(parseTanggal(tanggal[index]));
    return today > due;
}

function getCountdownText(index){
    const today = startOfDay(new Date());
    const due = startOfDay(parseTanggal(tanggal[index]));
    const diffDays = Math.round((due - today) / 86400000);

    if(diffDays < 0){
        const late = Math.abs(diffDays);
        return late === 1
        ? "Terlambat 1 hari"
        : "Terlambat "+late+" hari";
    }
    if(diffDays === 0) return "Jatuh tempo hari ini";
    if(diffDays === 1) return "1 hari lagi";
    return diffDays+" hari lagi";
}

function updateDateBar(){
    const todayEl = document.getElementById("todayDate");
    const countdownEl = document.getElementById("countdownText");

    todayEl.textContent = new Date().toLocaleDateString("id-ID",{
        weekday:"long",
        day:"numeric",
        month:"long",
        year:"numeric"
    });

    const nextIdx = getNextUnpaidIndex();

    countdownEl.classList.remove(
        "ux-bar-value--overdue",
        "ux-bar-value--today",
        "ux-bar-value--complete"
    );

    if(nextIdx === -1){
        countdownEl.textContent = "Semua cicilan lunas";
        countdownEl.classList.add("ux-bar-value--complete");
        return;
    }

    countdownEl.textContent =
    getCountdownText(nextIdx)+" · "+tanggal[nextIdx];

    if(isOverdue(nextIdx)){
        countdownEl.classList.add("ux-bar-value--overdue");
    }else if(
        startOfDay(parseTanggal(tanggal[nextIdx]))
        .getTime() === startOfDay(new Date()).getTime()
    ){
        countdownEl.classList.add("ux-bar-value--today");
    }
}

function render(){

    const daftar =
    document.getElementById("daftarCicilan");

    daftar.innerHTML = "";

    let totalBayar = 0;
    const nextUnpaid = getNextUnpaidIndex();

    tanggal.forEach((tgl,index)=>{

        const sudah =
        pembayaran.includes(index);

        if(sudah){
            totalBayar += cicilan[index];
        }

        const overdue = !sudah && isOverdue(index);
        const isNext = index === nextUnpaid && !sudah;

        const card =
        document.createElement("div");

        card.className = sudah
        ? "cicilan cicilan--paid"
        : "cicilan cicilan--pending";

        if(isNext) card.classList.add("cicilan--next");
        if(overdue) card.classList.add("cicilan--overdue");

        card.dataset.index = index;

        let badges = `
                <span class="status-badge ${sudah ? "status-badge--paid" : "status-badge--pending"}">
                ${sudah ? "Sudah Dibayar" : "Belum Dibayar"}
                </span>`;

        if(overdue){
            badges += `
                <span class="status-badge status-badge--overdue">Terlambat</span>`;
        }

        if(isNext){
            badges += `
                <span class="status-badge status-badge--next">Berikutnya</span>`;
        }

        const payAction = sudah
        ? `toggle(${index})`
        : `handlePayClick(${index})`;

        card.innerHTML=`

        <div class="info">

            <div class="cicilan-header">

                <h4>Cicilan ${index+1}</h4>

                ${badges}

            </div>

            <div class="cicilan-meta">

                <span class="meta-item">📅 ${tgl}</span>

                <span class="meta-item meta-item--amount">💰 ${rupiah(cicilan[index])}</span>

            </div>

        </div>

        <button class="btn-pay ${sudah ? "btn-pay--cancel" : ""}" onclick="${payAction}">

            ${sudah ? "Batalkan" : "Bayar"}

        </button>

        `;

        daftar.appendChild(card);

    });

    document.getElementById("sudahBayar")
    .innerHTML = rupiah(totalBayar);

    document.getElementById("sisaHutang")
    .innerHTML = rupiah(TOTAL_HARGA-totalBayar);

    document.getElementById("progressText")
    .innerHTML =
    pembayaran.length +
    " / 16 Cicilan";

    const progressPct =
    pembayaran.length/16*100;

    document.getElementById("progressBar")
    .style.width =
    progressPct+"%";

    document.getElementById("progressPercentage")
    .textContent =
    Math.round(progressPct)+"%";

    updateDateBar();

}

function toggle(index){

    if(pembayaran.includes(index)){

        pembayaran =
        pembayaran.filter(i=>i!==index);

    }else{

        pembayaran.push(index);

        pembayaran.sort((a,b)=>a-b);

    }

    localStorage.setItem(
        "loq_wahyu",
        JSON.stringify(pembayaran)
    );

    render();

}

function handlePayClick(index){
    pendingPayIndex = index;
    document.getElementById("confirmMessage").textContent =
    "Apakah Anda yakin ingin menandai Cicilan "+(index+1)+
    " ("+tanggal[index]+") sebesar "+rupiah(cicilan[index])+
    " sebagai sudah dibayar?";
    const modal = document.getElementById("confirmModal");
    modal.hidden = false;
    modal.setAttribute("aria-hidden","false");
    document.getElementById("confirmOk").focus();
}

function closeConfirmModal(){
    pendingPayIndex = null;
    const modal = document.getElementById("confirmModal");
    modal.hidden = true;
    modal.setAttribute("aria-hidden","true");
}

function executePayment(){
    if(pendingPayIndex === null) return;
    const index = pendingPayIndex;
    closeConfirmModal();
    toggle(index);
    showSuccessFeedback(index);
    if(pembayaran.length === 16){
        launchConfetti();
    }
}

function showSuccessFeedback(index){
    const toast = document.getElementById("successToast");
    const toastText = document.getElementById("successToastText");
    toastText.textContent =
    "Cicilan "+(index+1)+" berhasil dicatat!";
    toast.classList.add("toast--visible");

    const card = document.querySelector(
        '.cicilan[data-index="'+index+'"]'
    );
    if(card){
        card.classList.add("cicilan--success-flash");
        setTimeout(function(){
            card.classList.remove("cicilan--success-flash");
        },1400);
    }

    setTimeout(function(){
        toast.classList.remove("toast--visible");
    },3000);
}

function launchConfetti(){
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){
        return;
    }

    const canvas = document.createElement("canvas");
    canvas.className = "confetti-canvas";
    canvas.setAttribute("aria-hidden","true");
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const palette = ["#30a46c","#0071e3","#ffd60a","#ff375f","#bf5af2","#ffffff"];
    const pieces = [];

    for(let i = 0; i < 160; i++){
        pieces.push({
            x: w * 0.5 + (Math.random()-0.5) * w * 0.6,
            y: h * 0.35 + (Math.random()-0.5) * 80,
            w: 5 + Math.random() * 7,
            h: 3 + Math.random() * 5,
            color: palette[Math.floor(Math.random()*palette.length)],
            vx: (Math.random()-0.5) * 6,
            vy: -(4 + Math.random() * 6),
            rot: Math.random() * 360,
            vr: (Math.random()-0.5) * 10,
            gravity: 0.12 + Math.random() * 0.08
        });
    }

    let frame = 0;

    function tick(){
        ctx.clearRect(0,0,w,h);
        pieces.forEach(function(p){
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.rot += p.vr;
            ctx.save();
            ctx.translate(p.x,p.y);
            ctx.rotate(p.rot * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
            ctx.restore();
        });
        frame++;
        if(frame < 200){
            requestAnimationFrame(tick);
        }else{
            canvas.remove();
        }
    }

    requestAnimationFrame(tick);
}

document.getElementById("confirmCancel")
.addEventListener("click",closeConfirmModal);

document.getElementById("confirmOk")
.addEventListener("click",executePayment);

document.getElementById("confirmModal")
.querySelector(".modal-backdrop")
.addEventListener("click",closeConfirmModal);

document.addEventListener("keydown",function(e){
    const modal = document.getElementById("confirmModal");
    if(modal.hidden) return;
    if(e.key === "Escape") closeConfirmModal();
});

render();
