const BASE_URL = process.env.TMAPI_BASE_URL || "https://api.tmapi.top";

function getToken(): string {
  const token = process.env.TMAPI_API_TOKEN || "";
  if (!token) throw new Error("TMAPI_API_TOKEN is not set in .env.local");
  return token;
}

export async function tmapiGet<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
  }
  const url = `${BASE_URL}${path}?${qs.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { apikey: getToken() },
    signal: AbortSignal.timeout(90000),
  });
  const text = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`TMAPI non-JSON response (${response.status}): ${text.slice(0, 300)}`);
  }
  if (!response.ok) {
    throw new Error(`TMAPI error ${response.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return data as T;
}

export interface TmapiProduct {
  productId: string;
  title: string;
  imageUrl: string;
  price: string;
  promoPrice?: string;
  sales?: number | string;
  similarity?: number;
  minOrderCount?: number;
  sellerName?: string;
  detailUrl?: string;
}

function pickProductId(p: any): string {
  return String(p.productId ?? p.product_id ?? p.offerId ?? p.num_iid ?? p.numIid ?? p.id ?? "");
}

function pickTitle(p: any): string {
  const t = p.title ?? p.subject;
  if (typeof t === "string") return t;
  return String(t?.translated ?? t?.original ?? "");
}

function pickImage(p: any): string {
  return String(p.imageUrl ?? p.image_url ?? p.pic_url ?? p.picUrl ?? p.image ?? p.img ?? "");
}

function pickPrice(p: any): string {
  const pr = p.price;
  const base =
    typeof pr === "string" || typeof pr === "number"
      ? pr
      : (pr?.display_amount ?? pr?.original_amount ?? "");
  return String(base ?? p.promotion_price ?? p.promotionPrice ?? p.minPrice ?? "");
}

function pickSimilarity(p: any): number | undefined {
  const s = p.similarity ?? p.similar_score ?? p.similarScore ?? p.match_rate ?? p.matchRate;
  const n = typeof s === "string" ? parseFloat(s) : s;
  return typeof n === "number" && !Number.isNaN(n) ? n : undefined;
}

function pickSeller(p: any): string | undefined {
  if (typeof p.seller === "string") return p.seller;
  if (typeof p.supplier === "string") return p.supplier;
  return p.sellerName ?? p.seller_name ?? p.seller?.name ?? p.seller_nick ?? p.supplier?.supplier_name ?? p.company_name;
}

function normalizeProduct(p: any): TmapiProduct {
  return {
    productId: pickProductId(p),
    title: pickTitle(p),
    imageUrl: pickImage(p),
    price: pickPrice(p),
    promoPrice: p.promotion_price ?? p.promotionPrice,
    sales: p.sales ?? p.sales30d ?? p.monthSales,
    similarity: pickSimilarity(p),
    minOrderCount: p.minOrderCount ?? p.min_order_count ?? p.min_order ?? p.moq ?? 1,
    sellerName: pickSeller(p),
    detailUrl: p.detailUrl ?? p.detail_url ?? p.detailPageUrl ?? p.source_url,
  };
}

export function extractTmapiList(raw: any): { results: TmapiProduct[]; total: number } {
  const container =
    raw?.items && typeof raw.items === "object" && !Array.isArray(raw.items) ? raw.items : raw;
  const list: any[] = Array.isArray(raw?.items)
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
  const total = Number(
    container?.total_results ?? raw?.total ?? raw?.total_results ?? raw?.data?.total ?? list.length
  );
  const results = list
    .map(normalizeProduct)
    .filter((p) => p.productId || p.title);
  if (results.length > 0 && results[0].similarity !== undefined) {
    results.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  }
  return { results, total: Number.isNaN(total) ? results.length : total };
}

export function extractTmapiDetail(raw: any): TmapiProduct {
  const node = raw?.item ?? raw?.data?.item ?? raw?.data ?? raw?.product ?? raw;
  const p = Array.isArray(node) ? node[0] : node;
  return normalizeProduct(p ?? {});
}

export async function search1688ByKeyword(
  keyword: string,
  opts: { page?: number; pageSize?: number; sort?: string } = {}
): Promise<{ results: TmapiProduct[]; total: number }> {
  const raw = await tmapiGet<any>("/1688/global/search/keyword", {
    keyword,
    language: "ru",
    page: opts.page ?? 1,
    page_size: opts.pageSize ?? 20,
    sort: opts.sort ?? "default",
  });
  return extractTmapiList(raw);
}

export async function search1688ByImageUrl(
  imgUrl: string,
  opts: { page?: number; pageSize?: number; sort?: string } = {}
): Promise<{ results: TmapiProduct[]; total: number }> {
  const raw = await tmapiGet<any>("/1688/global/search/image/v2", {
    img_url: imgUrl,
    language: "ru",
    page: opts.page ?? 1,
    page_size: opts.pageSize ?? 20,
    sort: opts.sort ?? "default",
  });
  return extractTmapiList(raw);
}

export async function get1688ItemDetail(productId: string): Promise<TmapiProduct> {
  const raw = await tmapiGet<any>("/1688/item_detail", {
    item_id: productId,
    language: "ru",
  });
  return extractTmapiDetail(raw);
}

export async function uploadToPublicHost(buf: Buffer, mime: string): Promise<string> {
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buf)], { type: mime }), `kikfit.${ext}`);
  const response = await fetch("https://0x0.st", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const text = (await response.text()).trim();
  if (!response.ok || !text.startsWith("http")) {
    throw new Error(`Image host upload failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return text;
}

export async function search1688ByImageBuffer(
  buf: Buffer,
  mime: string
): Promise<{ results: TmapiProduct[]; total: number; sourceImageUrl: string }> {
  const sourceImageUrl = await uploadToPublicHost(buf, mime);
  const { results, total } = await search1688ByImageUrl(sourceImageUrl);
  return { results, total, sourceImageUrl };
}
