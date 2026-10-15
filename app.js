/* THE MILLETO India storefront.
   Demo catalogue/prices and sample shipping. Confirm all values before launch. */
const PRODUCTS = [
  { id: "cranberry", name: "Cranberry Pistachio", price: 149, description: "A fruity little treat with a nutty crunch.", art: "Cranberry<br>& Pistachio", kicker: "A little tang, a little crunch", bg: "#ead5bd", colour: "#6c4736" },
  { id: "chocolate", name: "Chocolate Millet Cookies", price: 129, description: "A chocolatey companion for your everyday cravings.", art: "Chocolate<br>Moments", kicker: "For the chocolate lover", bg: "#d9c2a9", colour: "#593d31" },
  { id: "coconut", name: "Coconut Cookies", price: 119, description: "A familiar coconut note in a buttery bake.", art: "Coconut<br>& Comfort", kicker: "A taste of familiarity", bg: "#e7dfc9", colour: "#526344" },
  { id: "cardamom", name: "Cashew Cardamom", price: 149, description: "Cashew richness with a hint of cardamom.", art: "Cashew<br>& Elaichi", kicker: "A fragrant favourite", bg: "#d7d9bd", colour: "#354c37" }
];
const SHIPPING_RUPEES = 80; // Must match SHIPPING_PAISE in create-payment.js.
const cart = Object.create(null);
const money = n => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

function renderProducts() {
  const host = document.getElementById("products");
  host.innerHTML = "";
  PRODUCTS.forEach(p => {
    const card = document.createElement("article");
    card.className = "product-card";
    const art = document.createElement("div");
    art.className = "product-art";
    art.style.setProperty("--art-bg", p.bg);
    art.style.color = p.colour;
    const symbol = document.createElement("div");
    symbol.className = "product-symbol";
    symbol.innerHTML = p.art; // Static, developer-authored catalogue strings only.
    art.appendChild(symbol);
    const kicker = document.createElement("div");
    kicker.className = "product-kicker";
    kicker.textContent = p.kicker;
    const title = document.createElement("h3");
    title.textContent = p.name;
    const desc = document.createElement("p");
    desc.className = "product-description";
    desc.textContent = p.description;
    const bottom = document.createElement("div");
    bottom.className = "product-bottom";
    const price = document.createElement("span");
    price.className = "product-price";
    price.textContent = `₹${money(p.price)}`;
    const add = document.createElement("button");
    add.type = "button";
    add.className = "add-button";
    add.textContent = "Add +";
    add.addEventListener("click", () => {
      cart[p.id] = Math.min(20, (cart[p.id] || 0) + 1);
      renderCart();
    });
    bottom.append(price, add);
    card.append(art, kicker, title, desc, bottom);
    host.appendChild(card);
  });
}

function renderCart() {
  const host = document.getElementById("cart-items");
  host.replaceChildren();
  const chosen = PRODUCTS.filter(p => cart[p.id] > 0);
  const count = chosen.reduce((n, p) => n + cart[p.id], 0);
  const subtotal = chosen.reduce((n, p) => n + p.price * cart[p.id], 0);
  const shipping = subtotal > 0 ? SHIPPING_RUPEES : 0;
  document.getElementById("count").textContent = count;
  document.getElementById("subtotal").textContent = money(subtotal);
  document.getElementById("shipping").textContent = money(shipping);
  document.getElementById("total").textContent = money(subtotal + shipping);

  if (!chosen.length) {
    const empty = document.createElement("p");
    empty.className = "empty-cart";
    empty.textContent = "Your basket is waiting for something delicious.";
    host.appendChild(empty);
  } else {
    chosen.forEach(p => {
      const row = document.createElement("div");
      row.className = "cart-row";
      const details = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = p.name;
      const sub = document.createElement("small");
      sub.textContent = `₹${money(p.price)} each · ₹${money(p.price * cart[p.id])}`;
      details.append(name, sub);
      const controls = document.createElement("div");
      controls.className = "qty-controls";
      const minus = document.createElement("button");
      minus.type = "button"; minus.textContent = "−"; minus.setAttribute("aria-label", `Remove one ${p.name}`);
      minus.addEventListener("click", () => { cart[p.id]--; if (cart[p.id] <= 0) delete cart[p.id]; renderCart(); });
      const qty = document.createElement("span"); qty.textContent = cart[p.id];
      const plus = document.createElement("button");
      plus.type = "button"; plus.textContent = "+"; plus.setAttribute("aria-label", `Add one ${p.name}`);
      plus.addEventListener("click", () => { cart[p.id] = Math.min(20, cart[p.id] + 1); renderCart(); });
      controls.append(minus, qty, plus);
      row.append(details, controls);
      host.appendChild(row);
    });
  }
}

document.getElementById("year").textContent = new Date().getFullYear();

document.getElementById("order-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById("checkout-button");
  const message = document.getElementById("order-message");
  const items = PRODUCTS.filter(p => cart[p.id] > 0).map(p => ({ id: p.id, qty: cart[p.id] }));
  if (!items.length) { message.textContent = "Please add at least one product to your basket."; return; }
  if (typeof window.Razorpay !== "function") {
    message.textContent = "Razorpay Checkout did not load. Check your connection and try again.";
    return;
  }

  const customer = {
    name: document.getElementById("customer-name").value.trim(),
    phone: document.getElementById("customer-phone").value.trim(),
    address: document.getElementById("customer-address").value.trim(),
    notes: document.getElementById("customer-notes").value.trim()
  };
  button.disabled = true;
  message.textContent = "Preparing secure checkout…";

  try {
    const response = await fetch("/api/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer, items })
    });
    const order = await response.json();
    if (!response.ok) throw new Error(order.error || "Could not start checkout.");

    const checkout = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "THE MILLETO",
      description: "Millet bakes — India",
      order_id: order.razorpayOrderId,
      prefill: { name: customer.name, contact: customer.phone },
      theme: { color: "#9f4937" },
      handler: async payment => {
        message.textContent = "Verifying payment securely…";
        try {
          const res = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              internalOrderId: order.internalOrderId,
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature
            })
          });
          const result = await res.json();
          if (!res.ok || result.verified !== true || result.status !== "paid") {
            message.textContent = `Payment is not yet confirmed. Save order reference ${order.internalOrderId} and contact support. Do not pay again until checked.`;
            return;
          }
          message.textContent = `Payment verified. Your order reference is ${order.internalOrderId}. Save it for your records.`;
          Object.keys(cart).forEach(id => delete cart[id]);
          renderCart();
          form.reset();
        } catch {
          message.textContent = `We could not confirm payment status. Save order reference ${order.internalOrderId} and contact support. Do not pay again until checked.`;
        } finally { button.disabled = false; }
      },
      modal: { ondismiss: () => {
        message.textContent = "Checkout closed. If you completed payment, check its status before trying again.";
        button.disabled = false;
      }}
    });
    checkout.on("payment.failed", () => {
      message.textContent = "Payment was not completed. Check payment status before retrying.";
      button.disabled = false;
    });
    checkout.open();
  } catch (error) {
    message.textContent = error.message || "Checkout could not start.";
    button.disabled = false;
  }
});

renderProducts();
renderCart();
