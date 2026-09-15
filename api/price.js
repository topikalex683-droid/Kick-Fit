"use strict";

const { get1688Detail, getTaobaoItem, env } = require("./_utils");

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

function parseNum(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fb;
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "POST only" }));
    return;
  }

  try {
    const { productId, quantity, marketplace } = parseBody(req);
    if (!productId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "productId is required" }));
      return;
    }

    const mp = marketplace === "taobao" ? "taobao" : "1688";
    const detail = mp === "taobao" ? await getTaobaoItem(productId) : await get1688Detail(productId);

    const unitCny = parseFloat(detail.consignPrice || detail.price) || 0;
    const shippingRmb = parseNum(env("SHIPPING_CNY"), 50);
    const markupPercent = parseNum(env("MARKUP_PERCENTAGE"), 15);
    const rateRmb = parseNum(env("SHIPPING_RATE_RUB"), 11.5);

    const qty = quantity || 1;
    const subtotalCny = unitCny * qty;
    const markupRmb = Math.round(subtotalCny * (markupPercent / 100) * 100) / 100;
    const totalCny = Math.round((subtotalCny + markupRmb + shippingRmb) * 100) / 100;
    const totalRmb = Math.round(totalCny * rateRmb);

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        product: detail,
        pricing: {
          marketplacePriceCny: unitCny,
          quantity: qty,
          shippingRmb,
          markupPercent,
          markupRmb,
          totalCny,
          totalRmb,
        },
      })
    );
  } catch (e) {
    console.error("[price] Error:", e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
};