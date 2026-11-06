const DEFAULT_CONFIG = require("../site-config.json");
const CONFIG_KEY = "zahrat:site-config";
const LEGACY_PRODUCT_IMAGES = {
  Drake: "IMG-20260701-WA0033.jpg",
  Vanguard: "IMG-20260701-WA0032.jpg",
  Eclipsed: "IMG-20260701-WA0035.jpg"
};

function redisUrl() {
  return process.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
}

function redisToken() {
  return process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
}

function hasRedisConfig() {
  return Boolean(redisUrl() && redisToken());
}

async function redisCommand(command) {
  if (!hasRedisConfig()) {
    throw new Error("Shared site storage is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel.");
  }

  const response = await fetch(redisUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000)
  });

  let result;
  try {
    result = await response.json();
  } catch (error) {
    console.error("Shared storage returned an unreadable response:", error);
    throw new Error("Shared storage returned an invalid response.");
  }

  if (!response.ok || result.error) {
    console.error("Shared storage command failed:", response.status, result.error || "Unknown error");
    throw new Error("Could not access shared site storage.");
  }
  return result.result;
}

async function readSiteConfig() {
  const stored = await redisCommand(["GET", CONFIG_KEY]);
  if (typeof stored !== "string") return structuredClone(DEFAULT_CONFIG);

  let saved;
  try {
    saved = JSON.parse(stored);
  } catch (error) {
    console.error("Stored site configuration is invalid JSON:", error);
    throw new Error("The saved site configuration is invalid.");
  }
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    throw new Error("The saved site configuration has an invalid structure.");
  }

  const savedProducts = Array.isArray(saved.products) ? saved.products : DEFAULT_CONFIG.products;
  const savedBanner = saved.media?.banner || {};
  const banner = { ...DEFAULT_CONFIG.media.banner, ...savedBanner };
  if (
    (!savedBanner.enabled && !savedBanner.src) ||
    (savedBanner.src === "/banner/zahrat-al-oud-logo.jpg" &&
      !savedBanner.title && !savedBanner.description && !savedBanner.arabicTitle &&
      !savedBanner.arabicDescription && !savedBanner.ctaLabel &&
      !savedBanner.arabicCtaLabel && !savedBanner.ctaUrl)
  ) {
    Object.assign(banner, DEFAULT_CONFIG.media.banner);
  }
  const products = savedProducts.map((savedProduct, index) => {
    const defaultProduct = DEFAULT_CONFIG.products.find((product) => product.name === savedProduct?.name) ||
      DEFAULT_CONFIG.products[index] || {};
    const merged = { ...defaultProduct, ...savedProduct };
    const legacyImage = LEGACY_PRODUCT_IMAGES[savedProduct?.name];
    if (legacyImage && savedProduct.image === legacyImage) merged.image = defaultProduct.image;
    const images = Array.isArray(savedProduct?.images) && savedProduct.images.length
      ? savedProduct.images
      : [merged.image].filter(Boolean);
    merged.images = images.map((image) => image === legacyImage ? defaultProduct.image : image);
    return merged;
  });
  products.forEach((product) => { product.image = product.image || product.images[0] || ""; });

  return {
    ...DEFAULT_CONFIG,
    ...saved,
    copy: { ...DEFAULT_CONFIG.copy, ...(saved.copy || {}) },
    arabicCopy: { ...DEFAULT_CONFIG.arabicCopy, ...(saved.arabicCopy || {}) },
    products,
    productPrice: saved.productPrice === 199
      ? DEFAULT_CONFIG.productPrice
      : saved.productPrice ?? DEFAULT_CONFIG.productPrice,
    whatsappNumber: saved.whatsappNumber === "971547973003"
      ? DEFAULT_CONFIG.whatsappNumber
      : saved.whatsappNumber || DEFAULT_CONFIG.whatsappNumber,
    media: {
      ...DEFAULT_CONFIG.media,
      ...(saved.media || {}),
      banner,
      heroSlides: Array.isArray(saved.media?.heroSlides) ? saved.media.heroSlides : []
    }
  };
}

async function writeSiteConfig(config) {
  const normalized = {
    ...DEFAULT_CONFIG,
    ...config,
    productPrice: config.productPrice ?? DEFAULT_CONFIG.productPrice,
    arabicCopy: { ...DEFAULT_CONFIG.arabicCopy, ...(config.arabicCopy || {}) },
    media: {
      ...DEFAULT_CONFIG.media,
      ...(config.media || {}),
      banner: { ...DEFAULT_CONFIG.media.banner, ...(config.media?.banner || {}) }
    }
  };
  await redisCommand(["SET", CONFIG_KEY, JSON.stringify(normalized)]);
}

module.exports = { DEFAULT_CONFIG, hasRedisConfig, redisCommand, readSiteConfig, writeSiteConfig };
