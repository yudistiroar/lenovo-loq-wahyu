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

function rupiah(n){
    return "Rp " + n.toLocaleString("id-ID");
}

function render(){

    const daftar =
    document.getElementById("daftarCicilan");

    daftar.innerHTML = "";

    let totalBayar = 0;

    tanggal.forEach((tgl,index)=>{

        const sudah =
        pembayaran.includes(index);

        if(sudah){
            totalBayar += cicilan[index];
        }

        const card =
        document.createElement("div");

        card.className="cicilan";

        card.innerHTML=`

        <div class="info">

            <h4>Cicilan ${index+1}</h4>

            <div>📅 ${tgl}</div>

            <div>💰 ${rupiah(cicilan[index])}</div>

            <div>
            ${sudah
            ? "🟢 Sudah Dibayar"
            : "⚪ Belum Dibayar"}
            </div>

        </div>

        <button onclick="toggle(${index})">

            ${sudah
            ? "Batalkan"
            : "Bayar"}

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

    document.getElementById("progressBar")
    .style.width =
    (pembayaran.length/16*100)+"%";

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

render();