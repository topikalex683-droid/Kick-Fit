const HOST = process.env.RAPIDAPI_TAOBAO_HOST || "taobao-tmall1.p.rapidapi.com";
const BASE_URL = `https://${HOST}`;

function getKey(): string {
  const key = process.env.RAPIDAPI_KEY || "";
  if (!key) throw new Error("RAPIDAPI_KEY is not set in .env.local");
  return key;
}

async function rapidGet<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
  }
  const url = `${BASE_URL}/${path}?${qs.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": HOST,
      "x-rapidapi-key": getKey(),
    },
    signal: AbortSignal.timeout(60000),
  });
  const text = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Taobao API non-JSON response (${response.status}): ${text.slice(0, 300)}`);
  }
  if (!response.ok) {
    throw new Error(`Taobao API error ${response.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return data as T;
}

export interface TaoProduct {
  productId: string;
  title: string;
  imageUrl: string;
  price: string;
  promoPrice?: string;
  sales?: number | string;
  sellerName?: string;
  detailUrl?: string;
  marketplace: "taobao";
}

function pickId(p: any): string {
  return String(p.Id ?? p.id ?? p.ItemId ?? p.itemId ?? p.item_id ?? p.Nid ?? p.nid ?? "");
}

function pickTitle(p: any): string {
  const t = p.Title ?? p.title ?? p.ItemTitle;
  return typeof t === "string" ? t : String(t ?? "");
}

function pickImage(p: any): string {
  const img = p.PictureUrl ?? p.pictureUrl ?? p.imageUrl ?? p.ImageUrl ?? p.PicUrl ?? p.pic_url;
  if (typeof img === "string") return img;
  if (Array.isArray(p.Pictures)) return String(p.Pictures[0] ?? "");
  return "";
}

function pickPrice(p: any): string {
  const pr = p.Price ?? p.price ?? p.PriceWithDelivery;
  if (typeof pr === "string" || typeof pr === "number") return String(pr);
  return String(pr?.Price ?? pr?.DiscountPrice ?? "");
}

function normalizeProduct(p: any): TaoProduct {
  const id = pickId(p);
  return {
    productId: id,
    title: pickTitle(p),
    imageUrl: pickImage(p),
    price: pickPrice(p),
    promoPrice:
      p.PromotionPrice !== undefined && p.PromotionPrice !== null
        ? String(p.PromotionPrice)
        : undefined,
    sales: p.Volume ?? p.volume ?? p.Sales ?? p.sales,
    sellerName: p.VendorName ?? p.vendorName ?? p.SellerNick ?? p.seller_nick,
    detailUrl: p.DetailUrl ?? (id ? `https://item.taobao.com/item.htm?id=${id}` : undefined),
    marketplace: "taobao",
  };
}

function extractList(raw: any): { results: TaoProduct[]; total: number } {
  const root = raw?.Result ?? raw?.result ?? raw;
  const frame = root?.Items ?? root?.items ?? root;
  const list: any[] = Array.isArray(frame)
    ? frame
    : Array.isArray(frame?.Content)
      ? frame.Content
      : Array.isArray(frame?.Item)
        ? frame.Item
        : Array.isArray(root?.products)
          ? root.products
          : [];
  const total = Number(root?.TotalCount ?? root?.totalCount ?? root?.total ?? list.length);
  const results = list.map(normalizeProduct).filter((p) => p.productId || p.title);
  return { results, total: Number.isNaN(total) ? results.length : total };
}

function extractDetail(raw: any): TaoProduct {
  const node = raw?.Result?.Item ?? raw?.Result ?? raw?.result ?? raw?.item ?? raw;
  const p = Array.isArray(node) ? node[0] : node;
  return normalizeProduct(p ?? {});
}

export async function searchTaobaoByKeyword(
  title: string,
  opts: { offset?: number; limit?: number } = {}
): Promise<{ results: TaoProduct[]; total: number }> {
  const raw = await rapidGet<any>("BatchSearchItemsFrame", {
    language: "en",
    framePosition: opts.offset ?? 0,
    frameSize: opts.limit ?? 20,
    ItemTitle: title,
    IsComplete: true,
    IsStock: true,
    OrderBy: "Volume:Desc",
  });
  return extractList(raw);
}

export async function searchTaobaoByImageUrl(
  imageUrl: string,
  opts: { offset?: number; limit?: number } = {}
): Promise<{ results: TaoProduct[]; total: number }> {
  const raw = await rapidGet<any>("BatchSearchItemsFrame", {
    language: "en",
    framePosition: opts.offset ?? 0,
    frameSize: opts.limit ?? 20,
    ImageUrl: imageUrl,
    IsComplete: true,
    IsStock: true,
  });
  return extractList(raw);
}

export async function getTaobaoItem(itemId: string): Promise<TaoProduct> {
  const raw = await rapidGet<any>("BatchGetItemFullInfo", {
    language: "en",
    itemId,
  });
  const product = extractDetail(raw);
  if (!product.productId && !product.title) throw new Error(`Taobao item ${itemId} not found`);
  return product;
}
