async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Invalid origin." }, 403);
  if (!env.DB || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return json({ error: "Checkout is not configured." }, 503);
  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const internalId = input.internalOrderId, paymentId = input.razorpay_payment_id;
  const returnedOrderId = input.razorpay_order_id, signature = input.razorpay_signature;
  if ([internalId, paymentId, returnedOrderId, signature].some(v => typeof v !== "string" || v.length > 200)) {
    return json({ error: "Invalid payment details." }, 400);
  }

  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(internalId).first();
  if (!order) return json({ error: "Order not found." }, 404);
  if (order.status === "paid" && order.razorpay_payment_id === paymentId) return json({ verified: true, status: "paid" });
  if (order.status !== "pending" || returnedOrderId !== order.razorpay_order_id) return json({ error: "Order does not match." }, 400);

  const expected = await hmacHex(env.RAZORPAY_KEY_SECRET, `${order.razorpay_order_id}|${paymentId}`);
  if (!sameHex(expected, signature)) return json({ error: "Payment signature invalid." }, 400);

  const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  let payment;
  try {
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `Basic ${auth}` } });
    if (!response.ok) return json({ error: "Could not verify payment status." }, 502);
    payment = await response.json();
  } catch { return json({ error: "Payment verification unavailable." }, 502); }

  if (payment.id !== paymentId || payment.order_id !== order.razorpay_order_id ||
      payment.amount !== order.amount_paise || payment.currency !== "INR" ||
      payment.status !== "captured") {
    return json({ verified: false, status: "pending", message: "Payment is not confirmed as captured yet." }, 409);
  }

  const result = await env.DB.prepare(`UPDATE orders SET status = 'paid', razorpay_payment_id = ?, paid_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'pending'`).bind(paymentId, internalId).run();
  if (!result.meta?.changes) {
    const current = await env.DB.prepare("SELECT status, razorpay_payment_id FROM orders WHERE id = ?").bind(internalId).first();
    if (current?.status === "paid" && current.razorpay_payment_id === paymentId) return json({ verified: true, status: "paid" });
    return json({ error: "Order status could not be updated." }, 409);
  }
  return json({ verified: true, status: "paid" });
}
