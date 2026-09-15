"use strict";

const { search1688Keyword, searchTaobaoKeyword, translate } = require("./_utils");

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

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "POST only" }));
    return;
  }

  try {
    const { keyword, page, pageSize, marketplaces } = parseBody(req);
    if (!keyword) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "keyword is required" }));
      return;
    }

    let mps = [];
    if (Array.isArray(marketplaces) && marketplaces.length > 0) {
      mps = marketplaces.filter((m) => m === "1688" || m === "taobao");
    } else {
      mps = ["1688", "taobao"];
    }

    const [zh, en] = await Promise.all([
      mps.includes("1688") ? translate(keyword, "ru|zh-CN").catch(() => keyword) : Promise.resolve(keyword),
      mps.includes("taobao") ? translate(keyword, "ru|en").catch(() => keyword) : Promise.resolve(keyword),
    ]);

    const p = page || 1;
    const ps = pageSize || 20;

    const settled = await Promise.allSettled([
      mps.includes("1688") ? search1688Keyword(zh) : Promise.resolve([]),
      mps.includes("taobao") ? searchTaobaoKeyword(en, { offset: 0, limit: ps }) : Promise.resolve([]),
    ]);

    const results = [];
    const errors = [];
    const names = ["1688", "taobao"];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") results.push(...s.value);
      else errors.push(`${names[i]}: ${(s.reason && s.reason.message) || s.reason}`);
    });

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        results,
        total: results.length,
        translatedKeyword: zh,
        translatedKeywordEn: en,
        errors,
      })
    );
  } catch (e) {
    console.error("[search] Error:", e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
};