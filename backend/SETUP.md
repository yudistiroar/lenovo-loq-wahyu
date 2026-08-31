# Bukti transaksi Lenovo LOQ

## Deployment

1. Supabase project: `qilqujynotdwaolpzbcd` (`lenovo-loq-bukti`). Bucket `bukti-transaksi` must be public, maximum 10 MB, MIME types image/jpeg, image/png, image/webp. Do not add anonymous write policies.
2. Store this project's legacy service_role key ONLY as an encrypted Cloudflare Worker secret named `SUPABASE_SERVICE_ROLE_KEY`. Never commit it or put it in the browser. The existing `DB` D1 binding remains unchanged.
3. Deploy `worker.mjs` to `lenovo-loq-backend`. This is a single-file bundle containing the previous payment API plus receipt routes. On first relevant request it creates only three new tables: payment_receipts, receipt_locks, receipt_cleanup. Existing payment records are not migrated or overwritten.
4. Deploy index.html, script.js, style.css, receipts-ui.js together to the existing frontend host.
5. Verify GET /payments still works and GET /receipts returns an array; test a sample non-sensitive image on a paid transaction, reload, replace and delete with authorization. Do not change payment status for this test.

## Behaviour and limitations

- One active receipt per installment payment, keyed to its paid_at timestamp. Cancellation hides that receipt from history; repaying does not reuse the old receipt. The old public file is retained until replaced or manually removed.
- Public read and unauthenticated mutations are intentional user requirements. Anyone can remove/replace evidence. This is not an authenticated audit trail.
- Mutations pass through the Worker, which checks paid status, signature/MIME, actual byte length, an optimistic revision, a per-payment lock and a 15-second upload cooldown. Supabase independently enforces its bucket size/MIME restrictions. Browser additionally decodes images.
- Upload/delete actions do not alter payment amounts or status.
- Failed replacement keeps the old receipt. Superseded files are queued for removal; failed uploads are eligible for cleanup after five minutes, on a later successful upload. Inspect receipt_cleanup for leftovers after outages. No automatic background job has been provisioned.
- A Supabase service-role key is powerful; use only the dedicated new project and encrypted Worker secrets. Supabase Free may pause for inactivity and its storage/egress quotas are shared at organization level. Public access is not unlimited traffic protection.
- Public/CDN/browser cached copies may remain after deletion. Do not upload sensitive information.

## Tests

Run `node --test receipts.test.mjs`. It uses in-memory SQLite and mocked Supabase responses; no production data is changed. `node preview.mjs` serves a local UI preview with sample payments only.

## Rollback

Restore the previous frontend revision and `worker-original.mjs` as the Worker code. Keep receipt tables and bucket files for recovery; do not delete them during rollback.
