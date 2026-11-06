const { hasRedisConfig, readSiteConfig } = require("../lib/site-data");
const { createOrder, updateOrderNotifications } = require("../lib/orders");
const ORDER_EMAIL = "aloudzahrat@gmail.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Zahrat al Oud <orders@zahrataloud.ae>";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OFFER_QUANTITY = 3;
const OFFER_PRICE = 330;

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function isText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function money(amount) {
  return `AED ${amount.toFixed(2)}`;
}

async function deliverEmail(email, apiKey) {
  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(email),
      signal: AbortSignal.timeout(10000)
    });
  } catch (error) {
    console.error("Resend request could not be completed:", error);
    return { ok: false, message: "The email provider could not be reached. Please try again." };
  }

  if (!response.ok) {
    let providerError;
    try {
      providerError = await response.json();
    } catch (error) {
      console.error("Resend rejected email delivery:", response.status, "with an unreadable error response.");
      return { ok: false, message: "The email provider rejected the request. Please check your Resend account and sending domain." };
    }
    const message = typeof providerError.message === "string" ? providerError.message : "The email provider rejected the request.";
    console.error("Resend rejected email delivery:", response.status, providerError.name || "ProviderError", message);
    return { ok: false, message };
  }

  return { ok: true };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { message: "Method not allowed." });
  }

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || JSON.stringify(body).length > 12000) {
    return sendJson(res, 400, { message: "Please check the submitted information and try again." });
  }

  if (body.website) {
    return sendJson(res, 200, { ok: true });
  }

  // 1. HANDLE CONTACT FORM MESSAGES
  if (body.type === "contact") {
    if (
      !isText(body.name, 120) ||
      !isText(body.email, 254) ||
      !EMAIL_PATTERN.test(body.email) ||
      !isText(body.message, 5000)
    ) {
      return sendJson(res, 400, { message: "Please enter a valid name, email address, and message." });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("RESEND_API_KEY is not configured in the Vercel project.");
      return sendJson(res, 503, { message: "Email is not set up yet. Please contact Zahrat al Oud on WhatsApp for now." });
    }
    if (!/^[\x21-\x7E]+$/.test(apiKey)) {
      console.error("RESEND_API_KEY contains unsupported characters. Replace it with the raw API key copied from Resend.");
      return sendJson(res, 503, { message: "The saved email key is not valid. Replace it with the full API key copied from Resend, without quotes, spaces, or ellipses." });
    }

    const name = escapeHtml(body.name.trim());
    const email = escapeHtml(body.email.trim());
    const message = escapeHtml(body.message.trim()).replace(/\n/g, "<br>");
    
    const delivery = await deliverEmail({
      from: FROM_EMAIL,
      to: [ORDER_EMAIL],
      reply_to: body.email.trim(),
      subject: `Website message from ${body.name.trim().slice(0, 100)}`,
      html: `<h2>Website message</h2><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p>${message}</p>`
    }, apiKey);

    if (!delivery.ok) {
      return sendJson(res, 502, { message: `We couldn't send your message: ${delivery.message}` });
    }
    return sendJson(res, 200, { ok: true });
  }

  // 2. HANDLE PRODUCT ORDERS
  if (body.type !== "order") {
    return sendJson(res, 400, { message: "Invalid request." });
  }
  if (!hasRedisConfig()) {
    return sendJson(res, 503, { message: "Order tracking is unavailable right now. Please try again shortly or contact us on WhatsApp." });
  }

  const order = body.order;
  if (
    !order ||
    typeof body.requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)
  ) {
    return sendJson(res, 400, { message: "The order request is invalid. Please refresh the checkout and try again." });
  }
  let siteConfig;
  try {
    siteConfig = await readSiteConfig();
  } catch (error) {
    console.error("Could not load current prices for order:", error);
    return sendJson(res, 503, { message: "We couldn't verify current product prices. Please try again shortly." });
  }
  const productNames = new Set(siteConfig.products.map((product) => product.name));
  if (
    !order ||
    !isText(order.name, 120) ||
    !isText(order.phone, 40) ||
    !isText(order.email, 254) ||
    !EMAIL_PATTERN.test(order.email) ||
    !isText(order.emirate, 40) ||
    !isText(order.address, 500) ||
    !["Cash on Delivery", "Card on Delivery"].includes(order.payment) ||
    !Array.isArray(order.items) ||
    order.items.length < 1 ||
    order.items.length > productNames.size
  ) {
    return sendJson(res, 400, { message: "Please check your delivery details and bag, then try again." });
  }

  const seenProducts = new Set();
  const items = [];
  for (const item of order.items) {
    if (
      !item ||
      !productNames.has(item.name) ||
      seenProducts.has(item.name) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 12
    ) {
      return sendJson(res, 400, { message: "Please check your bag quantities and try again." });
    }
    seenProducts.add(item.name);
    items.push({ name: item.name, quantity: item.quantity, lineTotal: item.quantity * siteConfig.productPrice });
  }

  const quantity = items.reduce((total, item) => total + item.quantity, 0);
  const regularSubtotal = quantity * siteConfig.productPrice;
  const offerBundles = siteConfig.productPrice * OFFER_QUANTITY > OFFER_PRICE
    ? Math.floor(quantity / OFFER_QUANTITY)
    : 0;
  const discountAmount = offerBundles * (siteConfig.productPrice * OFFER_QUANTITY - OFFER_PRICE);
  const subtotal = regularSubtotal - discountAmount;
  const total = subtotal + siteConfig.deliveryFee;
  const language = body.language === "ar" ? "ar" : "en";
  const createdAt = new Date().toISOString();
  const orderRecord = {
    id: body.requestId.toLowerCase(),
    orderNumber: `ZAO-${createdAt.slice(0, 10).replaceAll("-", "")}-${body.requestId.slice(0, 6).toUpperCase()}`,
    createdAt,
    updatedAt: createdAt,
    status: "new",
    customer: {
      name: order.name.trim(),
      phone: order.phone.trim(),
      email: order.email.trim().toLowerCase(),
      address: order.address.trim(),
      emirate: order.emirate.trim()
    },
    items,
    quantity,
    unitPrice: siteConfig.productPrice,
    regularSubtotal,
    offerBundles,
    discountAmount,
    subtotal,
    deliveryFee: siteConfig.deliveryFee,
    total,
    payment: order.payment,
    language,
    notifications: { store: "pending", customer: "pending" }
  };
  let savedOrder;
  let isNewOrder;
  try {
    ({ order: savedOrder, created: isNewOrder } = await createOrder(orderRecord));
  } catch (error) {
    console.error("Could not save the customer order:", error);
    return sendJson(res, 503, { message: "We couldn't securely save your order. Please try again shortly." });
  }
  if (!isNewOrder) {
    return sendJson(res, 200, {
      ok: true,
      orderNumber: savedOrder.orderNumber,
      alreadyReceived: true,
      notificationSent: savedOrder.notifications.store === "sent",
      receiptSent: savedOrder.notifications.customer === "sent"
    });
  }

  const itemLines = items.map((item) => `<li>${escapeHtml(item.name)} × ${item.quantity} — ${money(item.lineTotal)}</li>`).join("");
  const customerName = escapeHtml(order.name.trim());
  const customerEmail = escapeHtml(order.email.trim());
  const address = escapeHtml(`${order.address.trim()}, ${order.emirate.trim()}`);
  const phone = escapeHtml(order.phone.trim());
  const payment = escapeHtml(order.payment);
  const orderSummary = language === "ar"
    ? `<p><strong>رقم الطلب: ${escapeHtml(savedOrder.orderNumber)}</strong></p><ul>${itemLines}</ul><p>قيمة العطور: ${money(regularSubtotal)}${discountAmount ? `<br>خصم عرض الثلاثة عطور: −${money(discountAmount)}` : ""}<br>المجموع بعد الخصم: ${money(subtotal)}<br>التوصيل: ${money(siteConfig.deliveryFee)}<br><strong>الإجمالي: ${money(total)}</strong><br>طريقة الدفع: ${payment === "Cash on Delivery" ? "الدفع نقداً" : "بطاقة عند الاستلام"}</p>`
    : `<p><strong>Order reference: ${escapeHtml(savedOrder.orderNumber)}</strong></p><ul>${itemLines}</ul><p>Perfumes subtotal: ${money(regularSubtotal)}${discountAmount ? `<br>Three-perfume offer discount: −${money(discountAmount)}` : ""}<br>Subtotal after offer: ${money(subtotal)}<br>Delivery: ${money(siteConfig.deliveryFee)}<br><strong>Total: ${money(total)}</strong><br>Payment: ${payment}</p>`;
  const notifications = {};
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !/^[\x21-\x7E]+$/.test(apiKey)) {
    console.error("The order was saved, but the Resend API key is not configured correctly.");
    notifications.store = "not_configured";
    notifications.customer = "not_configured";
  } else {
    const delivery = await deliverEmail({
      from: FROM_EMAIL,
      to: [ORDER_EMAIL],
      reply_to: order.email.trim(),
      subject: language === "ar"
        ? `طلب جديد ${savedOrder.orderNumber} من ${order.name.trim().slice(0, 100)}`
        : `New order ${savedOrder.orderNumber} from ${order.name.trim().slice(0, 100)}`,
      html: language === "ar"
        ? `<div dir="rtl" lang="ar"><h2>طلب عطر جديد</h2>${orderSummary}<h3>بيانات العميل</h3><p>الاسم: ${customerName}<br>البريد الإلكتروني: ${customerEmail}<br>الهاتف: ${phone}<br>عنوان التوصيل: ${address}</p></div>`
        : `<h2>New perfume order</h2>${orderSummary}<h3>Customer details</h3><p>Name: ${customerName}<br>Email: ${customerEmail}<br>Phone: ${phone}<br>Delivery address: ${address}</p>`
    }, apiKey);
    notifications.store = delivery.ok ? "sent" : "failed";
    if (!delivery.ok) console.error("Order saved, but the store email notification failed:", delivery.message);

    const receipt = await deliverEmail({
      from: FROM_EMAIL,
      to: [order.email.trim()],
      subject: language === "ar"
        ? `تم استلام طلبك ${savedOrder.orderNumber} — Zahrat al Oud`
        : `Order ${savedOrder.orderNumber} received — Zahrat al Oud`,
      html: language === "ar"
        ? `<div dir="rtl" lang="ar"><h2>شكراً لطلبك، ${customerName}.</h2><p>استلمنا طلبك وسنتواصل معك قريباً لترتيب التوصيل.</p>${orderSummary}<p>التوصيل إلى: ${address}<br>سنتواصل معك على الرقم ${phone}.</p></div>`
        : `<h2>Thank you, ${customerName}.</h2><p>We have received your order and will contact you shortly to arrange delivery.</p>${orderSummary}<p>Delivery to: ${address}<br>We will contact you at ${phone}.</p>`
    }, apiKey);
    notifications.customer = receipt.ok ? "sent" : "failed";
    if (!receipt.ok) console.error("Order saved, but the customer receipt failed:", receipt.message);
  }

  try {
    await updateOrderNotifications(savedOrder.id, notifications);
  } catch (error) {
    console.error("Order was saved, but its email notification status could not be updated:", error);
  }
  return sendJson(res, 200, {
    ok: true,
    orderNumber: savedOrder.orderNumber,
    notificationSent: notifications.store === "sent",
    receiptSent: notifications.customer === "sent"
  });
};