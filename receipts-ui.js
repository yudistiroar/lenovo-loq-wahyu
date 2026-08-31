(() => {
  'use strict';
  const MAX_BYTES = 10 * 1024 * 1024;
  const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const blocks = new Map();
  let receipts = new Map();
  let loaded = false;
  let loadPromise;
  const busy = new Set();

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, signal: AbortSignal.timeout(120000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Gagal menghubungi penyimpanan bukti.');
    return data;
  }
  async function refresh() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      try {
        const data = await api('/receipts');
        if (!Array.isArray(data)) throw new Error('Respons penyimpanan tidak valid.');
        receipts = new Map(data.map(row => [String(row.payment_id), row]));
        loaded = true;
        for (const block of blocks.values()) paint(block);
      } catch (error) {
        loaded = false;
        for (const block of blocks.values()) paint(block, error.message);
      } finally { loadPromise = null; }
    })();
    return loadPromise;
  }
  function button(text, action, danger = false) {
    const element = document.createElement('button');
    element.type = 'button'; element.className = `receipt-button${danger ? ' receipt-button--danger' : ''}`;
    element.textContent = text; element.addEventListener('click', action);
    return element;
  }
  function safeImageUrl(raw) {
    try {
      const url = new URL(raw);
      return url.origin === 'https://qilqujynotdwaolpzbcd.supabase.co' && url.pathname.startsWith('/storage/v1/object/public/bukti-transaksi/') ? url.href : null;
    } catch { return null; }
  }
  function paint(block, error = '') {
    const { root, item } = block;
    root.replaceChildren();
    const status = document.createElement('p'); status.className = 'receipt-status'; status.setAttribute('role','status');
    const key = String(item.id); const receipt = receipts.get(key);
    const badge = root.closest('.history-card')?.querySelector('.history-success');
    if (badge) {
      badge.textContent = loaded && receipt ? 'Berhasil + Bukti' : 'Berhasil';
      badge.title = loaded ? (receipt ? 'Pembayaran berhasil dan bukti sudah terlampir' : 'Pembayaran berhasil, belum ada bukti') : 'Pembayaran berhasil; status bukti belum diketahui';
    }
    if (busy.has(key)) { status.textContent = 'Memproses bukti, mohon tunggu…'; root.append(status); return; }
    if (!loaded) {
      status.textContent = error || 'Memuat bukti…'; root.append(status);
      if (error) root.append(button('Coba lagi', refresh));
      return;
    }
    const imageUrl = receipt && safeImageUrl(receipt.url);
    const input = document.createElement('input'); input.type = 'file'; input.accept = TYPES.join(','); input.hidden = true;
    input.addEventListener('change', () => { const file = input.files[0]; if (file) upload(block, file); });
    const actions = document.createElement('div'); actions.className = 'receipt-actions';
    root.append(input, actions);
    if (imageUrl) {
      const viewer = document.createElement('details'); viewer.className = 'receipt-viewer';
      const summary = document.createElement('summary'); summary.textContent = 'Lihat bukti';
      summary.setAttribute('aria-label', `Lihat bukti cicilan ke-${item.installment}`);
      const link = document.createElement('a'); link.href = imageUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.className = 'receipt-preview'; link.setAttribute('aria-label', `Lihat bukti cicilan ke-${item.installment} ukuran penuh`);
      const img = document.createElement('img'); img.alt = `Bukti cicilan ke-${item.installment}`; img.loading = 'lazy';
      img.addEventListener('error', () => { status.textContent = 'Gambar belum dapat ditampilkan. Coba muat ulang.'; });
      viewer.addEventListener('toggle', () => { if (viewer.open && !img.getAttribute('src')) img.src = imageUrl; });
      const caption = document.createElement('p'); caption.className = 'receipt-note'; caption.textContent = 'Klik gambar untuk membuka ukuran penuh.';
      link.append(img); viewer.append(summary, link, caption); actions.append(viewer);
    } else if (!receipt) {
      actions.append(button('Tambah bukti', () => input.click()));
    } else { status.textContent = 'Tautan bukti tidak valid. Ganti bukti melalui menu lainnya.'; }
    if (receipt) {
      const menu = document.createElement('details'); menu.className = 'receipt-menu';
      const summary = document.createElement('summary'); summary.textContent = '⋯'; summary.title = 'Pilihan bukti';
      summary.setAttribute('aria-label', `Pilihan bukti cicilan ke-${item.installment}`);
      const options = document.createElement('div'); options.className = 'receipt-menu-options';
      options.append(button('Ganti bukti', () => { menu.open = false; input.click(); }), button('Hapus bukti', () => { menu.open = false; remove(block); }, true));
      menu.append(summary, options); actions.append(menu);
    }
    if (error) status.textContent = error;
    root.append(status);
  }
  async function run(block, operation, success) {
    const key = String(block.item.id);
    if (busy.has(key)) return;
    busy.add(key); paint(block);
    let error = '';
    try { await operation(); showToast(success); }
    catch (err) { error = err.name === 'TimeoutError' ? 'Waktu tunggu habis. Muat ulang untuk memeriksa hasilnya.' : err.message; }
    finally {
      busy.delete(key);
      await refresh();
      const current = blocks.get(key);
      if (current && error) paint(current, error);
    }
  }
  async function upload(block, file) {
    if (!file.size) return paint(block, 'File kosong. Pilih gambar lain.');
    if (file.size > MAX_BYTES) return paint(block, 'File terlalu besar. Maksimal 10 MB.');
    if (!TYPES.includes(file.type)) return paint(block, 'Gunakan gambar JPG, PNG, atau WebP.');
    // Decode locally before sending to reject broken images; the backend also checks signatures.
    try { const bitmap = await createImageBitmap(file); bitmap.close(); }
    catch { return paint(block, 'File tidak dapat dibaca sebagai gambar.'); }
    const existing = receipts.get(String(block.item.id));
    if (!window.confirm(existing ? 'Ganti bukti lama dengan gambar ini? Gambar baru dapat dilihat publik.' : 'Upload gambar ini sebagai bukti publik? Jangan sertakan informasi sensitif.')) return;
    await run(block, async () => {
      await api(`/payments/${encodeURIComponent(block.item.id)}/receipt`, { method:'POST', headers:{ 'Content-Type':file.type, 'If-Match':existing?.revision || 'none' }, body:file });
    }, 'Bukti transaksi berhasil disimpan.');
  }
  async function remove(block) {
    const existing = receipts.get(String(block.item.id));
    if (!existing || !window.confirm('Hapus bukti transaksi ini? File akan dihapus, tetapi data pembayaran tetap ada.')) return;
    await run(block, () => api(`/payments/${encodeURIComponent(block.item.id)}/receipt`, { method:'DELETE', headers:{ 'If-Match':existing.revision } }), 'Bukti dihapus. Data pembayaran tidak berubah.');
  }
  window.paymentReceipts = {
    beginRender() { blocks.clear(); loaded = false; },
    attach(card, item) {
      const root = document.createElement('section'); root.className = 'receipt-block';
      const block = { root, item }; blocks.set(String(item.id), block); card.append(root); paint(block);
    },
    refresh,
  };
  document.addEventListener('click', event => {
    for (const menu of document.querySelectorAll('.receipt-menu[open]')) {
      if (!menu.contains(event.target)) menu.open = false;
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    for (const menu of document.querySelectorAll('.receipt-menu[open]')) {
      menu.open = false; menu.querySelector('summary').focus();
    }
  });
})();
