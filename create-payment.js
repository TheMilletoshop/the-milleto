const PRODUCTS = {
  cranberry: { name: "Cranberry Pistachio", price: 14900 },
  chocolate: { name: "Chocolate Millet Cookies", price: 12900 },
  coconut: { name: "Coconut Cookies", price: 11900 },
  cardamom: { name: "Cashew Cardamom", price: 14900 }
};
const SHIPPING_PAISE = 8000; // Sample ₹80 fee; update catalogue and courier policy before launch.

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Invalid origin." }, 403);
  if (!env.DB || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return json({ error: "Checkout is not configured. Add the D1 binding and Razorpay secrets." }, 503);
  }

  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const customer = input.customer || {};
  const name = cleanText(customer.name, 100);
  const phone = cleanText(customer.phone, 20);
  const address = cleanText(customer.address, 1000);
  const notes = cleanText(customer.notes, 500);
  if (!name || !/^[0-9+\-\s()]{8,20}$/.test(phone) || !address) {
    return json({ error: "Check your name, phone and address." }, 400);
  }
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 10) {
    return json({ error: "Invalid basket." }, 400);
  }

  const quantities = {};
  for (const item of input.items) {
    if (!item || typeof item.id !== "string" || !PRODUCTS[item.id] ||
        !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 20) {
      return json({ error: "Invalid product or quantity." }, 400);
    }
    quantities[item.id] = (quantities[item.id] || 0) + item.qty;
    if (quantities[item.id] > 20) return json({ error: "Quantity limit exceeded." }, 400);
  }

  const items = Object.entries(quantities).map(([id, qty]) => ({
    id, name: PRODUCTS[id].name, qty, unitPricePaise: PRODUCTS[id].price
  }));
  const subtotal = items.reduce((sum, item) => sum + item.unitPricePaise * item.qty, 0);
  const amount = subtotal + SHIPPING_PAISE;
  if (!Number.isSafeInteger(amount) || amount <= 0) return json({ error: "Invalid order amount." }, 400);

  const id = crypto.randomUUID();
  const receipt = "milleto_" + id.replaceAll("-", "").slice(0, 30);
  const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  let paymentOrder;
  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount, currency: "INR", receipt, notes: { store: "THE MILLETO India", internal_order: id } })
    });
    paymentOrder = await response.json();
    if (!response.ok || !paymentOrder.id || paymentOrder.amount !== amount || paymentOrder.currency !== "INR") {
      return json({ error: "Could not create payment order. Check Razorpay test-mode credentials." }, 502);
    }
  } catch { return json({ error: "Payment service unavailable." }, 502); }

  try {
    await env.DB.prepare(`INSERT INTO orders
      (id, razorpay_order_id, customer_name, phone, address, notes, items_json, amount_paise, currency, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'pending')`)
      .bind(id, paymentOrder.id, name, phone, address, notes, JSON.stringify(items), amount).run();
  } catch {
    // If the DB write fails after Razorpay order creation, the payment order is not exposed to the browser.
    return json({ error: "Could not save the order. Please retry later; contact support if this repeats." }, 500);
  }

  return json({ internalOrderId: id, razorpayOrderId: paymentOrder.id, keyId: env.RAZORPAY_KEY_ID, amount, currency: "INR", subtotal, shipping: SHIPPING_PAISE });
}
