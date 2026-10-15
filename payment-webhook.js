async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.RAZORPAY_WEBHOOK_SECRET) return new Response("Webhook not configured", { status: 503 });
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const expected = await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, rawBody);
  if (!sameHex(signature, expected)) return new Response("Invalid signature", { status: 400 });
  let event;
  try { event = JSON.parse(rawBody); } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (event.event !== "payment.captured") return new Response("Event ignored", { status: 200 });
  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment?.order_id) return new Response("Invalid payment event", { status: 400 });

  const order = await env.DB.prepare(`SELECT id, amount_paise, currency, status, razorpay_payment_id
    FROM orders WHERE razorpay_order_id = ?`).bind(payment.order_id).first();
  if (!order) return new Response("Order not found", { status: 404 });
  if (payment.amount !== order.amount_paise || payment.currency !== order.currency || payment.status !== "captured") {
    return new Response("Payment does not match order", { status: 400 });
  }
  if (order.status === "paid" && order.razorpay_payment_id === payment.id) return new Response("Already processed", { status: 200 });

  const result = await env.DB.prepare(`UPDATE orders SET status = 'paid', razorpay_payment_id = ?, paid_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'pending'`).bind(payment.id, order.id).run();
  if (!result.meta?.changes) {
    const current = await env.DB.prepare("SELECT status, razorpay_payment_id FROM orders WHERE id = ?").bind(order.id).first();
    if (current?.status === "paid" && current.razorpay_payment_id === payment.id) return new Response("Already processed", { status: 200 });
    return new Response("Could not update order", { status: 500 });
  }
  return new Response("Payment recorded", { status: 200 });
}
