"use strict";

const {
  search1688Image,
  searchTaobaoImage,
  uploadToPublicHost,
} = require("./_utils");

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function parseBody(req) {
  let b = req.body;
  if (Buffer.isBuffer(b)) {
    try { return JSON.parse(b.toString("utf8")); } catch { return {}; }
  }
  if (typeof b === "string") {
    try { return JSON.parse(b); } catch { return {}; }
  }
  if (b && typeof b === "object") return b;
  return {};
}

function parseMarketplaces(value) {
  if (Array.isArray(value)) {
    const list = value.filter((v) => v === "1688" || v === "taobao");
    if (list.length > 0) return [...new Set(list)];
  }
  if (value === "1688" || value === "taobao") return [value];
  return ["1688", "taobao"];
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "POST only" }));
    return;
  }

  try {
    const body = parseBody(req);
    if (!body.image) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "No image provided" }));
      return;
    }

    const mime = typeof body.mime === "string" && body.mime ? body.mime : "image/jpeg";
    const base64 = body.image.replace(/^data:[^;]*;base64,/, "");
    const buf = Buffer.from(base64, "base64");
    if (buf.length > MAX_IMAGE_BYTES) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Image is too large (max 4MB)" }));
      return;
    }

    const marketplaces = parseMarketplaces(body.marketplaces);

    const settled = await Promise.allSettled([
      marketplaces.includes("1688")
        ? search1688Image(base64, mime)
        : Promise.resolve([]),
      marketplaces.includes("taobao")
        ? (async () => {
            const publicUrl = await uploadToPublicHost(buf, mime);
            return searchTaobaoImage(publicUrl);
          })()
        : Promise.resolve([]),
    ]);

    const results = [];
    const errors = [];
    const names = ["1688", "taobao"];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") results.push(...s.value);
      else errors.push(`${names[i]}: ${(s.reason && s.reason.message) || s.reason}`);
    });

    res.statusCode = 200;
    res.end(JSON.stringify({ results, total: results.length, errors }));
  } catch (e) {
    console.error("[recognize] Error:", e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
};