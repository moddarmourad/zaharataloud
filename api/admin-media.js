const { randomUUID } = require("node:crypto");
const { isAuthenticated } = require("../lib/admin-auth");

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"]
]);

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

async function readUpload(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_FILE_BYTES) throw new Error("File exceeds the 4 MB upload limit.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { message: "Method not allowed." });
  }
  if (!sameOrigin(req)) return sendJson(res, 403, { message: "Request origin was not allowed." });
  if (!isAuthenticated(req)) return sendJson(res, 401, { message: "Please sign in to upload media." });

  const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  const extension = ALLOWED_TYPES.get(contentType);
  if (!extension) {
    return sendJson(res, 415, { message: "Upload a JPG, PNG, WebP, GIF, AVIF, MP4, or WebM file." });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return sendJson(res, 503, { message: "Direct uploads are not connected yet. Connect a Vercel Blob store to this project and redeploy." });
  }

  let file;
  try {
    file = await readUpload(req);
  } catch (error) {
    return sendJson(res, 413, { message: error.message });
  }
  if (!file.length) return sendJson(res, 400, { message: "Choose a non-empty media file." });

  const pathname = `zahrat/${Date.now()}-${randomUUID()}.${extension}`;
  try {
    const response = await fetch(`https://blob.vercel-storage.com/${pathname}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        "Content-Type": contentType,
        "x-api-version": "7",
        "x-content-type": contentType,
        "x-add-random-suffix": "0"
      },
      body: file,
      signal: AbortSignal.timeout(20000)
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("Vercel Blob returned an unreadable response.");
    }
    if (!response.ok || typeof result.url !== "string" || !result.url.startsWith("https://")) {
      console.error("Vercel Blob upload failed:", response.status, result.error || result.message || "Unknown error");
      return sendJson(res, 502, { message: "Vercel Blob could not save this file. Check the Blob store token and try again." });
    }
    return sendJson(res, 200, { url: result.url });
  } catch (error) {
    console.error("Could not upload media to Vercel Blob:", error);
    return sendJson(res, 502, { message: "Could not upload this file to Vercel Blob. Try again or use a hosted HTTPS URL." });
  }
};

module.exports.config = { api: { bodyParser: false } };
