const { createHmac, timingSafeEqual } = require("node:crypto");

const COOKIE_NAME = "zahrat_admin_v2";
const SESSION_SECONDS = 8 * 60 * 60;

function signSession(expiresAt, password) {
  return createHmac("sha256", password).update(`zahrat-admin:${expiresAt}`).digest("hex");
}

function cookieValue(req) {
  const cookies = (req.headers.cookie || "").split(";").map((part) => part.trim());
  const entry = cookies.find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return entry ? entry.slice(COOKIE_NAME.length + 1) : "";
}

function isAuthenticated(req) {
  const password = process.env.ZAHRAT_ADMIN_PASSWORD;
  if (!password) return false;
  const [expiry, signature] = cookieValue(req).split(".");
  const expiresAt = Number(expiry);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000) || !signature) return false;
  const expected = signSession(expiresAt, password);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

function setSessionCookie(res) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const signature = signSession(expiresAt, process.env.ZAHRAT_ADMIN_PASSWORD);
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${expiresAt}.${signature}; Max-Age=${SESSION_SECONDS}; Path=/api; HttpOnly; Secure; SameSite=Strict`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Max-Age=0; Path=/api; HttpOnly; Secure; SameSite=Strict`);
}

module.exports = { clearSessionCookie, isAuthenticated, setSessionCookie };
