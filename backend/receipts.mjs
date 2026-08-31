// Supabase credentials belong only in the Worker's encrypted secrets.
const STORAGE_URL = 'https://qilqujynotdwaolpzbcd.supabase.co';
const BUCKET = 'bukti-transaksi';
const MAX_BYTES = 10 * 1024 * 1024;
const RECEIPT_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, If-Match',
  'Cache-Control': 'no-store',
};
function receiptJson(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...RECEIPT_CORS, 'Content-Type': 'application/json' } });
}
function failure(message, status) { return Object.assign(new Error(message), { status }); }
export function detectImage(bytes) {
  if (bytes.length < 12) return null;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)) return 'image/png';
  if (String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'image/webp';
  return null;
}
export async function readImage(request) {
  if (Number(request.headers.get('content-length')) > MAX_BYTES) throw failure('Maksimal 10 MB per file.', 413);
  const declared = (request.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (!['image/jpeg','image/png','image/webp'].includes(declared)) throw failure('Gunakan gambar JPG, PNG, atau WebP.', 415);
  if (!request.body) throw failure('File kosong.', 400);
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw failure('Maksimal 10 MB per file.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const mime = detectImage(bytes);
  if (!mime || mime !== declared) throw failure('Isi file tidak sesuai format gambar.', 415);
  return { bytes, mime };
}
async function schema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS payment_receipts (payment_id INTEGER PRIMARY KEY, paid_at TEXT NOT NULL, path TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, revision TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS receipt_locks (payment_id INTEGER PRIMARY KEY, token TEXT, expires INTEGER NOT NULL DEFAULT 0, last_upload INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS receipt_cleanup (path TEXT PRIMARY KEY, created_at INTEGER NOT NULL DEFAULT (unixepoch()))`),
  ]);
}
async function storage(env, suffix, options = {}) {
  const response = await fetch(`${STORAGE_URL}/storage/v1/object/${BUCKET}${suffix}`, {
    ...options,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, ...options.headers },
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw failure('Penyimpanan gambar sedang tidak tersedia. Coba lagi.', 502);
  return response;
}
async function removeFile(env, path) {
  await storage(env, '', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }) });
}
async function clean(env) {
  const { results } = await env.DB.prepare('SELECT path FROM receipt_cleanup WHERE created_at < unixepoch() - 300 LIMIT 5').all();
  for (const { path } of results) {
    // Never delete an object that is currently referenced, including after an uncertain DB response.
    const current = await env.DB.prepare('SELECT payment_id FROM payment_receipts WHERE path = ?').bind(path).first();
    if (current) continue;
    try {
      await removeFile(env, path);
      await env.DB.prepare('DELETE FROM receipt_cleanup WHERE path = ?').bind(path).run();
    } catch { break; }
  }
}
function receiptView(row) {
  return { payment_id: row.payment_id, url: `${STORAGE_URL}/storage/v1/object/public/${BUCKET}/${row.path}`, size: row.size, revision: row.revision, updated_at: row.updated_at };
}
export async function receiptsFetch(request, env, ctx, originalFetch) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/payments\/(\d+)\/(receipt|pay|cancel)$/);
  const isReceipt = url.pathname === '/receipts' || match?.[2] === 'receipt';
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: RECEIPT_CORS });
  if (!isReceipt && !(match && request.method === 'POST')) return originalFetch(request, env, ctx);
  let token, id;
  try {
    if (isReceipt && !env.SUPABASE_SERVICE_ROLE_KEY) return receiptJson({ error: 'Penyimpanan bukti belum dikonfigurasi.' }, 503);
    await schema(env.DB);
    if (url.pathname === '/receipts') {
      if (request.method !== 'GET') return receiptJson({ error: 'Metode tidak didukung.' }, 405);
      const { results } = await env.DB.prepare(`SELECT r.* FROM payment_receipts r JOIN payments p ON p.id=r.payment_id AND p.paid_at=r.paid_at WHERE p.paid_amount > 0`).all();
      return receiptJson(results.map(receiptView));
    }
    if (!['POST','DELETE'].includes(request.method) || (!isReceipt && request.method !== 'POST')) return receiptJson({ error: 'Metode tidak didukung.' }, 405);
    id = Number(match[1]);
    if (!Number.isSafeInteger(id) || id < 1) return receiptJson({ error: 'Transaksi tidak valid.' }, 400);
    token = crypto.randomUUID();
    const now = Date.now();
    const lock = await env.DB.prepare(`INSERT INTO receipt_locks (payment_id, token, expires) VALUES (?, ?, ?) ON CONFLICT(payment_id) DO UPDATE SET token=excluded.token, expires=excluded.expires WHERE receipt_locks.expires < ?`).bind(id, token, now + 180000, now).run();
    if (!lock.meta.changes) return receiptJson({ error: 'Transaksi sedang diproses. Coba beberapa saat lagi.' }, 409);
    if (!isReceipt) return await originalFetch(request, env, ctx);
    const payment = await env.DB.prepare('SELECT * FROM payments WHERE id = ?').bind(id).first();
    if (!payment) return receiptJson({ error: 'Transaksi tidak ditemukan.' }, 404);
    if (!(payment.paid_amount > 0) || !payment.paid_at) return receiptJson({ error: 'Bukti hanya untuk transaksi yang sudah berhasil.' }, 409);
    const old = await env.DB.prepare('SELECT * FROM payment_receipts WHERE payment_id = ?').bind(id).first();
    const active = old?.paid_at === payment.paid_at ? old : null;
    if (request.headers.get('if-match') !== (active?.revision || 'none')) return receiptJson({ error: 'Bukti telah berubah. Muat ulang lalu coba lagi.' }, 409);
    if (request.method === 'DELETE') {
      if (!active) return receiptJson({ error: 'Belum ada bukti.' }, 404);
      // Delete the object first. If storage fails, keep the database reference for retry.
      await removeFile(env, active.path);
      await env.DB.prepare('DELETE FROM payment_receipts WHERE payment_id = ? AND revision = ?').bind(id, active.revision).run();
      return receiptJson({ deleted: true });
    }
    const rate = await env.DB.prepare('SELECT last_upload FROM receipt_locks WHERE payment_id = ?').bind(id).first();
    if (now - rate.last_upload < 15000) return receiptJson({ error: 'Tunggu 15 detik sebelum mengunggah lagi.' }, 429);
    await env.DB.prepare('UPDATE receipt_locks SET last_upload=? WHERE payment_id=? AND token=?').bind(now, id, token).run();
    const { bytes, mime } = await readImage(request);
    const revision = crypto.randomUUID();
    const path = `${id}/${revision}.${ { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' }[mime] }`;
    const updated = new Date().toISOString();
    // Queue uncommitted uploads so failures do not permanently orphan them.
    await env.DB.prepare('INSERT OR IGNORE INTO receipt_cleanup (path) VALUES (?)').bind(path).run();
    await storage(env, `/${path}`, { method: 'POST', headers: { 'Content-Type': mime, 'Cache-Control': 'max-age=0', 'x-upsert': 'false' }, body: bytes });
    const currentLock = await env.DB.prepare('SELECT token FROM receipt_locks WHERE payment_id=? AND expires>?').bind(id, Date.now()).first();
    if (currentLock?.token !== token) throw failure('Waktu unggah habis. Muat ulang dan coba lagi.', 409);
    const writes = [
      env.DB.prepare(`INSERT INTO payment_receipts (payment_id, paid_at, path, mime, size, revision, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(payment_id) DO UPDATE SET paid_at=excluded.paid_at, path=excluded.path, mime=excluded.mime, size=excluded.size, revision=excluded.revision, updated_at=excluded.updated_at`).bind(id, payment.paid_at, path, mime, bytes.length, revision, updated),
      env.DB.prepare('DELETE FROM receipt_cleanup WHERE path=?').bind(path),
      env.DB.prepare('UPDATE receipt_locks SET last_upload=? WHERE payment_id=? AND token=?').bind(now, id, token),
    ];
    if (old) writes.push(env.DB.prepare('INSERT OR IGNORE INTO receipt_cleanup (path, created_at) VALUES (?, 0)').bind(old.path));
    await env.DB.batch(writes);
    // Await cleanup under the lock, preventing another request from deleting a pending upload.
    await clean(env);
    return receiptJson(receiptView({ payment_id: id, path, size: bytes.length, revision, updated_at: updated }), 201);
  } catch (error) {
    return receiptJson({ error: error.status ? error.message : 'Gagal menyimpan bukti. Muat ulang dan coba lagi.' }, error.status || 500);
  } finally {
    if (token && id) await env.DB.prepare('UPDATE receipt_locks SET token=NULL, expires=0 WHERE payment_id=? AND token=?').bind(id, token).run().catch(() => {});
  }
}
