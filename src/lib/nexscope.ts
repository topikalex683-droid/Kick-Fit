const BASE_URL = process.env.NEXSCOPE_BASE_URL || "https://api.nexscope.ai";

function getKey(): string {
  const key = process.env.NEXSCOPE_API_KEY || "";
  if (!key) throw new Error("NEXSCOPE_API_KEY is not set in .env.local");
  return key;
}

async function runSkill<T>(slug: string, body: Record<string, unknown>): Promise<T> {
  const url = `${BASE_URL}/api/skill-api/v1/skills/${slug}/run`;
  const bodyText = JSON.stringify(body);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
    },
    body: bodyText,
    signal: AbortSignal.timeout(120000),
  });
  const text = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Nexscope non-JSON response (${response.status}): ${text.slice(0, 300)}`);
  }
  if (!response.ok) {
    throw new Error(`Nexscope error ${response.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }
  console.log(`[nexscope] ${slug} -> errcode=${data?.errcode} total=${data?.total}`);
  return data as T;
}

export interface NexProduct {
  productId: string;
  title: string;
  imageUrl: string;
  price: string;
  consignPrice?: string;
  sales?: number | string;
  minOrderCount?: number;
  sellerName?: string;
  detailUrl?: string;
  marketplace: "1688";
}

function normalizeProduct(p: any): NexProduct {
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
    marketplace: "1688" as const,
  };
}

function extractList(raw: any): { results: NexProduct[]; total: number } {
  const list: any[] = Array.isArray(raw?.products)
    ? raw.products
    : Array.isArray(raw?.data?.products)
      ? raw.data.products
      : [];
  const total = Number(raw?.total ?? raw?.data?.total ?? list.length);
  const results = list.map(normalizeProduct).filter((p) => p.productId || p.title);
  return { results, total: Number.isNaN(total) ? results.length : total };
}

export async function search1688ByImageBase64(
  imageBase64: string,
  opts: { page?: number; pageSize?: number } = {}
): Promise<{ results: NexProduct[]; total: number }> {
  const raw = await runSkill<any>("1688-search-by-image", {
    imageBase64,
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 20,
  });
  return extractList(raw);
}

export async function search1688ByKeyword(
  keyWordZh: string,
  opts: { page?: number; pageSize?: number } = {}
): Promise<{ results: NexProduct[]; total: number }> {
  const raw = await runSkill<any>("1688-product-search", {
    keyWord: keyWordZh,
    searchType: 1,
    pageIndex: opts.page ?? 1,
    pageSize: opts.pageSize ?? 20,
  });
  return extractList(raw);
}

export async function get1688Product(productId: string): Promise<NexProduct> {
  const raw = await runSkill<any>("1688-product-search", {
    productIds: productId,
    pageIndex: 1,
    pageSize: 10,
  });
  const { results } = extractList(raw);
  if (results.length === 0) throw new Error(`Product ${productId} not found`);
  return results[0];
}

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

export async function translateRuToZh(text: string): Promise<string> {
  const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=ru|zh-CN`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Translate failed (${response.status})`);
  const data = await response.json();
  const translated = data?.responseData?.translatedText as string | undefined;
  if (!translated) throw new Error("Translate returned empty result");
  return translated;
}
