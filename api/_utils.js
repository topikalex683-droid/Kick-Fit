"use strict";

function env(name, fallback = "") {
  const v = process.env[name];
  return v === undefined || v === null ? fallback : v;
}

function jsonOrThrow(text, status, label) {
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${label} non-JSON response (${status}): ${text.slice(0, 300)}`);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`${label} error ${status}: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return data;
}

/* ---------------- Nexscope (1688) ---------------- */

const NEXSCOPE_BASE = env("NEXSCOPE_BASE_URL", "https://api.nexscope.ai");

function nexKey() {
  const k = env("NEXSCOPE_API_KEY");
  if (!k) throw new Error("NEXSCOPE_API_KEY не задан (Environment Variables в Vercel)");
  return k;
}

async function nexRun(slug, body) {
  const url = `${NEXSCOPE_BASE}/api/skill-api/v1/skills/${slug}/run`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${nexKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  const data = jsonOrThrow(await resp.text(), resp.status, "Nexscope");
  return data;
}

function nexNormalize(p) {
  const offerId = String(p.offerId ?? p.asin ?? p.productId ?? "");
  return {
    productId: offerId,
    title: String(p.title ?? ""),
    imageUrl: String(p.imageUrl ?? ""),
    price: String(p.price ?? ""),
    consignPrice: p.consignPrice !== undefined ? String(p.consignPrice) : undefined,
    sales: p.salesQuantity ?? p.sales,
    minOrderCount: p.quantityBegin ?? p.minOrderCount ?? 1,
    sellerName: p.sellerName ?? p.shopName ?? p.company ?? p.company_name ?? p.seller_nick,
    detailUrl: p.asinUrl ?? (offerId ? `https://detail.1688.com/offer/${offerId}.html` : undefined),
    marketplace: "1688",
  };
}

function nexExtract(raw) {
  const list = Array.isArray(raw?.products)
    ? raw.products
    : Array.isArray(raw?.data?.products)
      ? raw.data.products
      : [];
  const total = Number(raw?.total ?? raw?.data?.total ?? list.length);
  const results = list.map(nexNormalize).filter((p) => p.productId || p.title);
  return { results, total: Number.isNaN(total) ? results.length : total };
}

async function nexSearchKeyword(keyword, opts = {}) {
  return nexExtract(
    await nexRun("1688-product-search", {
      keyWord: keyword,
      searchType: 1,
      pageIndex: opts.page ?? 1,
      pageSize: opts.pageSize ?? 20,
    })
  );
}

async function nexSearchImage(base64, opts = {}) {
  return nexExtract(
    await nexRun("1688-search-by-image", {
      imageBase64: base64,
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 20,
    })
  );
}

async function nexGetProduct(id) {
  const { results } = nexExtract(
    await nexRun("1688-product-search", { productIds: id, pageIndex: 1, pageSize: 10 })
  );
  if (!results.length) throw new Error(`Product ${id} not found`);
  return results[0];
}

/* ---------------- Taobao (RapidAPI) ---------------- */

const RAPID_HOST = env("RAPIDAPI_TAOBAO_HOST", "taobao-tmall1.p.rapidapi.com");
const RAPID_BASE = `https://${RAPID_HOST}`;

function rapidKey() {
  const k = env("RAPIDAPI_KEY");
  if (!k) throw new Error("RAPIDAPI_KEY не задан (Environment Variables в Vercel)");
  return k;
}

async function rapidGet(path, params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
  }
  const url = `${RAPID_BASE}/${path}?${qs.toString()}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json", "x-rapidapi-host": RAPID_HOST, "x-rapidapi-key": rapidKey() },
    signal: AbortSignal.timeout(60000),
  });
  return jsonOrThrow(await resp.text(), resp.status, "Taobao API");
}

function taoId(p) {
  return String(p.Id ?? p.id ?? p.ItemId ?? p.itemId ?? p.item_id ?? p.Nid ?? p.nid ?? "");
}
function taoTitle(p) {
  const t = p.Title ?? p.title ?? p.ItemTitle;
  return typeof t === "string" ? t : String(t ?? "");
}
function taoImage(p) {
  const img = p.PictureUrl ?? p.pictureUrl ?? p.imageUrl ?? p.ImageUrl ?? p.PicUrl ?? p.pic_url;
  if (typeof img === "string") return img;
  if (Array.isArray(p.Pictures)) return String(p.Pictures[0] ?? "");
  return "";
}
function taoPrice(p) {
  const pr = p.Price ?? p.price ?? p.PriceWithDelivery;
  if (typeof pr === "string" || typeof pr === "number") return String(pr);
  return String(pr?.Price ?? pr?.DiscountPrice ?? "");
}
function taoNormalize(p) {
  const id = taoId(p);
  return {
    productId: id,
    title: taoTitle(p),
    imageUrl: taoImage(p),
    price: taoPrice(p),
    promoPrice:
      p.PromotionPrice !== undefined && p.PromotionPrice !== null ? String(p.PromotionPrice) : undefined,
    sales: p.Volume ?? p.volume ?? p.Sales ?? p.sales,
    sellerName: p.VendorName ?? p.vendorName ?? p.SellerNick ?? p.seller_nick,
    detailUrl: p.DetailUrl ?? (id ? `https://item.taobao.com/item.htm?id=${id}` : undefined),
    marketplace: "taobao",
  };
}
function taoExtract(raw) {
  const root = raw?.Result ?? raw?.result ?? raw;
  const frame = root?.Items ?? root?.items ?? root;
  const list = Array.isArray(frame)
    ? frame
    : Array.isArray(frame?.Content)
      ? frame.Content
      : Array.isArray(frame?.Item)
        ? frame.Item
        : Array.isArray(root?.products)
          ? root.products
          : [];
  const total = Number(root?.TotalCount ?? root?.totalCount ?? root?.total ?? list.length);
  const results = list.map(taoNormalize).filter((p) => p.productId || p.title);
  return { results, total: Number.isNaN(total) ? results.length : total };
}
function taoDetail(root) {
  const node = root?.Result?.Item ?? root?.Result ?? root?.result ?? root?.item ?? root;
  const p = Array.isArray(node) ? node[0] : node;
  return taoNormalize(p ?? {});
}

async function taoSearchKeyword(title, opts = {}) {
  return taoExtract(
    await rapidGet("BatchSearchItemsFrame", {
      language: "en",
      framePosition: opts.offset ?? 0,
      frameSize: opts.limit ?? 20,
      ItemTitle: title,
      IsComplete: true,
      IsStock: true,
      OrderBy: "Volume:Desc",
    })
  );
}

async function taoSearchImage(imageUrl, opts = {}) {
  return taoExtract(
    await rapidGet("BatchSearchItemsFrame", {
      language: "en",
      framePosition: opts.offset ?? 0,
      frameSize: opts.limit ?? 20,
      ImageUrl: imageUrl,
      IsComplete: true,
      IsStock: true,
    })
  );
}

async function taoGetItem(itemId) {
  const p = taoDetail(await rapidGet("BatchGetItemFullInfo", { language: "en", itemId }));
  if (!p.productId && !p.title) throw new Error(`Taobao item ${itemId} not found`);
  return p;
}

/* ---------------- TMAPI (1688, fallback provider) ---------------- */

const TMAPI_BASE = env("TMAPI_BASE_URL", "https://api.tmapi.top");

function tmapiToken() {
  const t = env("TMAPI_API_TOKEN");
  if (!t) throw new Error("TMAPI_API_TOKEN не задан (Environment Variables в Vercel)");
  return t;
}

async function tmapiGet(path, params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
  }
  const url = `${TMAPI_BASE}${path}?${qs.toString()}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: { apikey: tmapiToken() },
    signal: AbortSignal.timeout(90000),
  });
  return jsonOrThrow(await resp.text(), resp.status, "TMAPI");
}

function tmPickId(p) {
  return String(p.productId ?? p.product_id ?? p.offerId ?? p.num_iid ?? p.numIid ?? p.id ?? "");
}
function tmPickTitle(p) {
  const t = p.title ?? p.subject;
  if (typeof t === "string") return t;
  return String(t?.translated ?? t?.original ?? "");
}
function tmPickImage(p) {
  return String(p.imageUrl ?? p.image_url ?? p.pic_url ?? p.picUrl ?? p.image ?? p.img ?? "");
}
function tmPickPrice(p) {
  const pr = p.price;
  const base =
    typeof pr === "string" || typeof pr === "number" ? pr : (pr?.display_amount ?? pr?.original_amount ?? "");
  return String(base ?? p.promotion_price ?? p.promotionPrice ?? p.minPrice ?? "");
}
function tmPickSeller(p) {
  if (typeof p.seller === "string") return p.seller;
  if (typeof p.supplier === "string") return p.supplier;
  return p.sellerName ?? p.seller_name ?? p.seller?.name ?? p.seller_nick ?? p.supplier?.supplier_name ?? p.company_name;
}
function tmNormalize(p) {
  return {
    productId: tmPickId(p),
    title: tmPickTitle(p),
    imageUrl: tmPickImage(p),
    price: tmPickPrice(p),
    promoPrice: p.promotion_price ?? p.promotionPrice,
    sales: p.sales ?? p.sales30d ?? p.monthSales,
    minOrderCount: p.minOrderCount ?? p.min_order_count ?? p.min_order ?? p.moq ?? 1,
    sellerName: tmPickSeller(p),
    detailUrl: p.detailUrl ?? p.detail_url ?? p.detailPageUrl ?? p.source_url,
    marketplace: "1688",
  };
}
function tmExtract(raw) {
  const container =
    raw?.items && typeof raw.items === "object" && !Array.isArray(raw.items) ? raw.items : raw;
  const list = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(container?.item)
      ? container.item
      : Array.isArray(raw?.products)
        ? raw.products
        : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.data?.items)
            ? raw.data.items
            : Array.isArray(raw?.result?.product_list)
              ? raw.result.product_list
              : [];
  const total = Number(container?.total_results ?? raw?.total ?? raw?.total_results ?? raw?.data?.total ?? list.length);
  const results = list.map(tmNormalize).filter((p) => p.productId || p.title);
  if (results.length > 0 && results[0].similarity !== undefined) {
    results.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  }
  return { results, total: Number.isNaN(total) ? results.length : total };
}
function tmDetail(raw) {
  const node = raw?.item ?? raw?.data?.item ?? raw?.data ?? raw?.product ?? raw;
  const p = Array.isArray(node) ? node[0] : node;
  return tmNormalize(p ?? {});
}

async function tmSearchKeyword(keyword, opts = {}) {
  return tmExtract(
    await tmapiGet("/1688/global/search/keyword", {
      keyword,
      language: "ru",
      page: opts.page ?? 1,
      page_size: opts.pageSize ?? 20,
      sort: opts.sort ?? "default",
    })
  );
}

async function tmSearchImageUrl(imgUrl, opts = {}) {
  return tmExtract(
    await tmapiGet("/1688/global/search/image/v2", {
      img_url: imgUrl,
      language: "ru",
      page: opts.page ?? 1,
      page_size: opts.pageSize ?? 20,
      sort: opts.sort ?? "default",
    })
  );
}

async function tmGetDetail(productId) {
  return tmDetail(await tmapiGet("/1688/item_detail", { item_id: productId, language: "ru" }));
}

async function uploadToPublicHost(buf, mime) {
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const blob = new Blob([new Uint8Array(buf)], { type: mime });
  const fname = `kikfit-${Date.now()}.${ext}`;
  const errors = [];

  async function tryCatbox() {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", blob, fname);
    const resp = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    const text = (await resp.text()).trim();
    if (!resp.ok || !/^https:\/\//.test(text) || /ERROR/i.test(text.slice(0, 60))) {
      throw new Error(`catbox(${resp.status}): ${(text || "empty").slice(0, 140)}`);
    }
    return text;
  }

  async function tryTelegraph() {
    const form = new FormData();
    form.append("file", blob, fname);
    const resp = await fetch("https://telegra.ph/upload", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    const text = (await resp.text()).trim();
    let src = null;
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr) && arr[0]) src = arr[0].src;
    } catch {}
    if (!resp.ok || !src || !/^\/[^"]+$/.test(src)) {
      throw new Error(`telegra.ph(${resp.status}): ${(text || "empty").slice(0, 140)}`);
    }
    return `https://telegra.ph/${src.replace(/^\//, "")}`;
  }

  async function tryUguu() {
    const form = new FormData();
    form.append("files[]", blob, fname);
    const resp = await fetch("https://uguu.se/upload.php", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    const text = (await resp.text()).trim();
    let url = null;
    try {
      const data = JSON.parse(text);
      url = data && data.files && Array.isArray(data.files) && data.files[0] ? data.files[0].url : null;
    } catch {}
    if (!resp.ok || !url) {
      throw new Error(`uguu(${resp.status}): ${(text || "empty").slice(0, 140)}`);
    }
    return url;
  }

  const attempts = [tryCatbox, tryTelegraph, tryUguu];
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error(`Image host upload failed: ${errors.join(" | ")}`);
}

/* ---------------- Translation ---------------- */

async function translate(text, pair) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`Translate failed (${resp.status})`);
  const data = await resp.json();
  const t = data?.responseData?.translatedText;
  if (!t) throw new Error("Translate returned empty result");
  return t;
}

/* ---------------- Combined providers (1688 with fallback) ---------------- */

async function search1688Keyword(zh) {
  try {
    return (await nexSearchKeyword(zh)).results;
  } catch (e) {
    if (env("TMAPI_API_TOKEN")) {
      try {
        const t = await tmSearchKeyword(zh);
        if (t.results.length) return t.results;
      } catch {}
    }
    throw e;
  }
}

async function search1688Image(base64, mime) {
  try {
    return (await nexSearchImage(base64)).results;
  } catch (e) {
    if (env("TMAPI_API_TOKEN")) {
      try {
        const url = await uploadToPublicHost(Buffer.from(base64, "base64"), mime);
        const t = await tmSearchImageUrl(url);
        if (t.results.length) return t.results;
      } catch {}
    }
    throw e;
  }
}

async function get1688Detail(productId) {
  try {
    return await nexGetProduct(productId);
  } catch (e) {
    if (env("TMAPI_API_TOKEN")) {
      try {
        return await tmGetDetail(productId);
      } catch {}
    }
    throw e;
  }
}

function hasNexscope() {
  return !!env("NEXSCOPE_API_KEY");
}

module.exports = {
  env,
  translate,
  search1688Keyword,
  search1688Image,
  get1688Detail,
  hasNexscope,
  searchTaobaoKeyword: taoSearchKeyword,
  searchTaobaoImage: taoSearchImage,
  getTaobaoItem: taoGetItem,
  uploadToPublicHost,
};