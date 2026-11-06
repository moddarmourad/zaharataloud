const { createHash, createHmac, timingSafeEqual } = require("node:crypto");
const { DEFAULT_CONFIG, hasRedisConfig, readSiteConfig, redisCommand, writeSiteConfig } = require("../lib/site-data");
const { clearSessionCookie, isAuthenticated, setSessionCookie } = require("../lib/admin-auth");
const { ORDER_STATUS_VALUES, listOrders, updateOrderStatus } = require("../lib/orders");

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function validImagePath(value) {
  if (typeof value !== "string" || value.length > 1000 || value.startsWith("//") || value.includes("\\") || /^\s*(javascript|data|vbscript):/i.test(value)) return false;
  if (value.startsWith("/")) return true;
  if (/^https:\/\//i.test(value)) {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }
  return /^[\w .()/-]+$/.test(value);
}

function validMediaUrl(value, { optional = false, video = false } = {}) {
  if (optional && value === "") return true;
  if (!validImagePath(value)) return false;
  if (!video) return true;
  return /\.(mp4|webm)(?:[?#].*)?$/i.test(value);
}

function validateConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return false;
  if (!config.copy || typeof config.copy !== "object" || Array.isArray(config.copy)) return false;
  const allowedCopyKeys = Object.keys(DEFAULT_CONFIG.copy);
  if (
    Object.keys(config.copy).length !== allowedCopyKeys.length ||
    allowedCopyKeys.some((key) => typeof config.copy[key] !== "string" || config.copy[key].length > 4000)
  ) return false;
  if (
    !config.arabicCopy ||
    typeof config.arabicCopy !== "object" ||
    Array.isArray(config.arabicCopy) ||
    Object.keys(config.arabicCopy).length !== allowedCopyKeys.length ||
    allowedCopyKeys.some((key) => typeof config.arabicCopy[key] !== "string" || config.arabicCopy[key].length > 4000)
  ) return false;

  if (!Array.isArray(config.products) || config.products.length < 1 || config.products.length > 24) return false;
  const seenNames = new Set();
  for (const product of config.products) {
    if (
      !product ||
      typeof product.name !== "string" || !product.name.trim() || product.name.length > 80 ||
      seenNames.has(product.name.trim().toLowerCase()) ||
      !validImagePath(product.image) ||
      !Array.isArray(product.images) || product.images.length < 1 || product.images.length > 12 ||
      product.images.some((image) => !validImagePath(image)) ||
      typeof product.inspiration !== "string" || product.inspiration.length > 100 ||
      typeof product.inspiredBy !== "string" || product.inspiredBy.length > 100 ||
      !validImagePath(product.referenceImage) ||
      !Array.isArray(product.notes) || product.notes.length > 40 ||
      product.notes.some((note) => typeof note !== "string" || !note.trim() || note.length > 80)
    ) return false;
    seenNames.add(product.name.trim().toLowerCase());
  }

  if (
    !config.media || typeof config.media !== "object" || Array.isArray(config.media) ||
    !Array.isArray(config.media.heroSlides) || config.media.heroSlides.length > 8 ||
    config.media.heroSlides.some((url) => !validImagePath(url))
  ) return false;
  const banner = config.media.banner;
  if (
    !banner || typeof banner !== "object" || Array.isArray(banner) ||
    typeof banner.enabled !== "boolean" ||
    !["image", "video"].includes(banner.type) ||
    typeof banner.src !== "string" || !validMediaUrl(banner.src, { optional: true, video: banner.type === "video" }) ||
    (banner.enabled && !banner.src) ||
    typeof banner.poster !== "string" || !validMediaUrl(banner.poster, { optional: true }) ||
    ["title", "description", "arabicTitle", "arabicDescription", "ctaLabel", "arabicCtaLabel"].some((key) => typeof banner[key] !== "string" || banner[key].length > 300) ||
    typeof banner.ctaUrl !== "string" || banner.ctaUrl.length > 500 ||
    (banner.ctaUrl && !banner.ctaUrl.startsWith("#") && !validImagePath(banner.ctaUrl))
  ) return false;

  let instagramUrl;
  try {
    instagramUrl = new URL(config.instagramUrl);
  } catch {
    return false;
  }
  return Number.isFinite(config.productPrice) &&
    config.productPrice >= 1 && config.productPrice <= 100000 &&
    Number.isFinite(config.deliveryFee) &&
    config.deliveryFee >= 0 && config.deliveryFee <= 10000 &&
    typeof config.instagramUrl === "string" &&
    instagramUrl.protocol === "https:" &&
    ["instagram.com", "www.instagram.com"].includes(instagramUrl.hostname.toLowerCase()) &&
    config.instagramUrl.length <= 500 &&
    typeof config.whatsappNumber === "string" &&
    /^\d{8,15}$/.test(config.whatsappNumber);
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const config = hasRedisConfig() ? await readSiteConfig() : DEFAULT_CONFIG;
      const authenticated = isAuthenticated(req);
      return sendJson(res, 200, {
        config,
        authenticated,
        storageReady: hasRedisConfig(),
        ...(authenticated ? { orders: await listOrders() } : {})
      });
    } catch (error) {
      console.error("Could not load site configuration:", error);
      return sendJson(res, 503, { message: "Could not load shared site settings." });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { message: "Method not allowed." });
  }
  if (!sameOrigin(req)) return sendJson(res, 403, { message: "Request origin was not allowed." });

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || JSON.stringify(body).length > 200000) {
    return sendJson(res, 400, { message: "Invalid admin request." });
  }

  if (body.action === "login") {
    const password = process.env.ZAHRAT_ADMIN_PASSWORD;
    if (!password || password.length < 12) {
      return sendJson(res, 503, { message: "Admin access is not configured. Set a unique admin password of at least 12 characters in Vercel." });
    }
    if (!hasRedisConfig()) {
      return sendJson(res, 503, { message: "Shared storage is not configured. Add the Upstash Redis environment variables in Vercel first." });
    }
    const clientAddress = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
    const attemptKey = `zahrat:admin-login:${createHash("sha256").update(clientAddress).digest("hex")}`;
    try {
      const attempts = Number(await redisCommand(["INCR", attemptKey]));
      if (attempts === 1) await redisCommand(["EXPIRE", attemptKey, 900]);
      if (attempts > 12) {
        return sendJson(res, 429, { message: "Too many sign-in attempts. Wait 15 minutes and try again." });
      }
    } catch (error) {
      console.error("Could not check admin sign-in rate limit:", error);
      return sendJson(res, 503, { message: "Could not verify admin access. Please try again later." });
    }
    if (typeof body.password !== "string" || body.password.length > 256) {
      return sendJson(res, 401, { message: "Incorrect admin password." });
    }
    const actual = createHmac("sha256", "zahrat-admin-login").update(body.password).digest();
    const expected = createHmac("sha256", "zahrat-admin-login").update(password).digest();
    if (!timingSafeEqual(actual, expected)) return sendJson(res, 401, { message: "Incorrect admin password." });
    try {
      await redisCommand(["DEL", attemptKey]);
      const config = await readSiteConfig();
      const orders = await listOrders();
      setSessionCookie(res);
      return sendJson(res, 200, { ok: true, config, orders });
    } catch (error) {
      console.error("Admin sign-in could not load shared site settings:", error);
      return sendJson(res, 503, { message: "Could not load shared site storage. Check the Upstash variables in Vercel." });
    }
  }

  if (body.action === "logout") {
    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  }

  if (!isAuthenticated(req)) {
    return sendJson(res, 401, { message: "Please sign in to save admin changes." });
  }
  if (body.action === "list_orders") {
    try {
      return sendJson(res, 200, { orders: await listOrders() });
    } catch (error) {
      console.error("Could not load customer orders:", error);
      return sendJson(res, 503, { message: "Could not load saved customer orders." });
    }
  }
  if (body.action === "update_order_status") {
    if (
      typeof body.orderId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.orderId) ||
      !ORDER_STATUS_VALUES.includes(body.status)
    ) {
      return sendJson(res, 400, { message: "Choose a valid order and status." });
    }
    try {
      const order = await updateOrderStatus(body.orderId, body.status);
      return order
        ? sendJson(res, 200, { order })
        : sendJson(res, 404, { message: "That order could not be found." });
    } catch (error) {
      console.error("Could not update order status:", error);
      return sendJson(res, 503, { message: "Could not update that order. Please try again." });
    }
  }
  if (body.action !== "save") {
    return sendJson(res, 400, { message: "Invalid admin action." });
  }
  if (!validateConfig(body.config)) {
    return sendJson(res, 400, { message: "Some settings are invalid. Check product names, image URLs, media, prices, notes, and contact links." });
  }

  try {
    await writeSiteConfig(body.config);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("Could not save site configuration:", error);
    return sendJson(res, 503, { message: "Could not save the live site settings. Check the Upstash Redis configuration in Vercel." });
  }
};
