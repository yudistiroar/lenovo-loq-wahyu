import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from './worker.mjs';
import { detectImage, readImage } from './receipts.mjs';

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE payments(id INTEGER PRIMARY KEY, installment INTEGER, nominal INTEGER, paid_amount INTEGER, paid_at TEXT, status TEXT, updated_at TEXT);
    INSERT INTO payments VALUES(1,1,100,100,'2026-08-01','paid',NULL),(2,2,100,NULL,NULL,'pending',NULL);`);
  function prepare(sql) {
    let args = [];
    const obj = {
      bind(...values) { args = values; return obj; },
      async first() { return db.prepare(sql).get(...args) || null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { return { meta: { changes: db.prepare(sql).run(...args).changes } }; },
    }; return obj;
  }
  return { prepare, async batch(statements) {
    db.exec('BEGIN');
    try { const output = []; for (const s of statements) output.push(await s.run()); db.exec('COMMIT'); return output; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  }, raw: db };
}
const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
function request(path, method = 'GET', body, revision='none', type='image/png') {
  return new Request(`https://worker.test${path}`, { method, ...(body ? {body} : {}), headers: {'Content-Type':type,'If-Match':revision} });
}
test('signatures reject SVG, fake JPG, empty file; accept PNG/JPEG/WebP', async () => {
  assert.equal(detectImage(png),'image/png');
  assert.equal(detectImage(new Uint8Array([255,216,255,...new Array(9).fill(0)])),'image/jpeg');
  assert.equal(detectImage(new TextEncoder().encode('RIFF0000WEBP')),'image/webp');
  await assert.rejects(readImage(request('/', 'POST', '<svg/>')), {status:415});
  await assert.rejects(readImage(request('/', 'POST', png,'none','image/jpeg')), {status:415});
  await assert.rejects(readImage(request('/', 'POST', new Uint8Array(0))), {status:415});
});
test('size limit is enforced on actual stream, including without content length', async () => {
  const atLimit = new Uint8Array(10*1024*1024); atLimit.set(png);
  assert.equal((await readImage(request('/', 'POST', atLimit))).bytes.length,atLimit.length);
  await assert.rejects(readImage(request('/', 'POST', new Uint8Array(atLimit.length+1))), {status:413});
  const declared = request('/', 'POST', png); declared.headers.set('Content-Length',String(atLimit.length+1));
  await assert.rejects(readImage(declared), {status:413});
});
test('full API lifecycle, conflicts, failure handling and payment isolation', async () => {
  const env={ DB:d1(), SUPABASE_SERVICE_ROLE_KEY:'test-secret' };
  const objects = new Map(); const realFetch = globalThis.fetch; let failUpload=false, failDelete=false;
  globalThis.fetch = async (url, opts) => {
    assert.equal(opts.headers.Authorization,'Bearer test-secret');
    assert.ok(String(url).startsWith('https://qilqujynotdwaolpzbcd.supabase.co/storage/v1/object/bukti-transaksi'));
    if (opts.method === 'POST') {
      if (failUpload) return new Response('{}',{status:500});
      objects.set(String(url).split('/bukti-transaksi/')[1],opts.body); return new Response('{}',{status:200});
    }
    if (failDelete) return new Response('{}',{status:500});
    for(const p of JSON.parse(opts.body).prefixes) objects.delete(p);
    return new Response('[]');
  };
  const call = (req) => worker.fetch(req,env,{});
  const resetRate = () => env.DB.raw.exec('UPDATE receipt_locks SET last_upload=0');
  try {
    assert.equal((await call(request('/payments'))).status,200);
    assert.equal((await worker.fetch(request('/receipts'),{DB:env.DB},{})).status,503);
    assert.deepEqual(await (await call(request('/receipts'))).json(),[]);
    assert.equal((await call(request('/payments/2/receipt','POST',png))).status,409);
    assert.equal((await call(request('/payments/999/receipt','POST',png))).status,404);
    assert.equal((await call(request('/payments/1/receipt','POST',png))).status,201);
    const first=(await (await call(request('/receipts'))).json())[0];
    assert.equal(objects.size,1);
    assert.equal((await call(request('/payments/1/receipt','POST',png))).status,409);
    assert.equal((await call(request('/payments/1/receipt','POST',png,first.revision))).status,429);
    resetRate(); failUpload=true;
    assert.equal((await call(request('/payments/1/receipt','POST',png,first.revision))).status,502);
    assert.equal((await (await call(request('/receipts'))).json())[0].revision,first.revision);
    resetRate(); failUpload=false;
    const replaced = await call(request('/payments/1/receipt','POST',png,first.revision));
    assert.equal(replaced.status,201); const second=await replaced.json();
    assert.notEqual(second.revision,first.revision); assert.equal(objects.size,1);
    failDelete=true;
    assert.equal((await call(request('/payments/1/receipt','DELETE',undefined,second.revision))).status,502);
    assert.equal((await (await call(request('/receipts'))).json()).length,1);
    failDelete=false;
    assert.equal((await call(request('/payments/1/receipt','DELETE',undefined,first.revision))).status,409);
    assert.equal((await call(request('/payments/1/receipt','DELETE',undefined,second.revision))).status,200);
    assert.equal(objects.size,0);
    const p=await (await call(request('/payments/1'))).json(); assert.equal(p.paid_amount,100); assert.equal(p.status,'paid');
    resetRate(); await call(request('/payments/1/receipt','POST',png));
    await call(request('/payments/1/cancel','POST'));
    assert.deepEqual(await (await call(request('/receipts'))).json(),[]);
    assert.equal((await call(request('/payments/1/receipt','POST',png))).status,409);
    await call(request('/payments/1/pay','POST',JSON.stringify({paid_amount:100}),'none','application/json'));
    assert.deepEqual(await (await call(request('/receipts'))).json(),[]);
    assert.equal((await call(request('/payments/1/receipt','OPTIONS'))).headers.get('Access-Control-Allow-Methods'),'GET, POST, DELETE, OPTIONS');
    env.DB.raw.exec(`UPDATE receipt_locks SET token='other',expires=9999999999999 WHERE payment_id=1`);
    assert.equal((await call(request('/payments/1/receipt','POST',png))).status,409);
    assert.equal(env.DB.raw.prepare('SELECT token FROM receipt_locks WHERE payment_id=1').get().token,'other');
  } finally { globalThis.fetch=realFetch; }
});
