const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ==========================
    // CORS Preflight
    // ==========================
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    try {
      // ==========================
      // GET /
      // ==========================
      if (request.method === "GET" && url.pathname === "/") {
        return json({
          app: "Lenovo LOQ API",
          version: "2.0.0",
          status: "online"
        });
      }

      // ==========================
      // GET /health
      // ==========================
      if (request.method === "GET" && url.pathname === "/health") {
        return json({
          status: "healthy",
          timestamp: new Date().toISOString()
        });
      }

      // ==========================
      // GET /payments
      // ==========================
      if (request.method === "GET" && url.pathname === "/payments") {
        const { results } = await env.DB
          .prepare("SELECT * FROM payments ORDER BY installment ASC")
          .all();

        return json(results);
      }

      // ==========================
      // GET /payments/:id
      // ==========================
      const paymentMatch = url.pathname.match(/^\/payments\/(\d+)$/);

      if (request.method === "GET" && paymentMatch) {
        const id = Number(paymentMatch[1]);

        const payment = await env.DB
          .prepare("SELECT * FROM payments WHERE id = ?")
          .bind(id)
          .first();

        if (!payment) {
          return json(
            { error: "Payment not found" },
            404
          );
        }

        return json(payment);
      }

      // ==========================
      // POST /payments/:id/pay
      // ==========================
      const payMatch = url.pathname.match(/^\/payments\/(\d+)\/pay$/);

      if (request.method === "POST" && payMatch) {

        const id = Number(payMatch[1]);

        // Ambil data pembayaran
        const payment = await env.DB
          .prepare("SELECT * FROM payments WHERE id = ?")
          .bind(id)
          .first();

        if (!payment) {
          return json(
            { error: "Payment not found" },
            404
          );
        }

        if (payment.status === "paid") {
          return json(
            { error: "Payment already completed." },
            400
          );
        }

        let body = {};

        try {
          body = await request.json();
        } catch (_) {}

        const paidAmount = Number(body.paid_amount ?? payment.nominal);

        if (paidAmount < payment.nominal) {
          return json(
            {
              error: "Nominal pembayaran kurang dari tagihan."
            },
            400
          );
        }

        const paidAt = new Date().toISOString();

        await env.DB
          .prepare(`
            UPDATE payments
            SET
              status = 'paid',
              paid_amount = ?,
              paid_at = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(
            paidAmount,
            paidAt,
            id
          )
          .run();

        const updated = await env.DB
          .prepare("SELECT * FROM payments WHERE id = ?")
          .bind(id)
          .first();

        return json(updated);
      }

      // ==========================
      // POST /payments/:id/cancel
      // ==========================
      const cancelMatch = url.pathname.match(/^\/payments\/(\d+)\/cancel$/);

      if (request.method === "POST" && cancelMatch) {

        const id = Number(cancelMatch[1]);

        await env.DB
          .prepare(`
            UPDATE payments
            SET
              status='pending',
              paid_amount=NULL,
              paid_at=NULL,
              updated_at=CURRENT_TIMESTAMP
            WHERE id=?
          `)
          .bind(id)
          .run();

        const updated = await env.DB
          .prepare("SELECT * FROM payments WHERE id=?")
          .bind(id)
          .first();

        return json(updated);
      }

      return json(
        { error: "Route not found" },
        404
      );

    } catch (err) {

      return json(
        {
          error: err.message,
          stack: err.stack
        },
        500
      );

    }

    function json(data, status = 200) {
      return new Response(
        JSON.stringify(data),
        {
          status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

  }
};
