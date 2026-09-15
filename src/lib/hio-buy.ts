export const hioBuyConfig = {
  apiKey: process.env.KIKFIT_API_KEY || "",
  apiSecret: process.env.KIKFIT_API_SECRET || "",
  baseUrl: process.env.KIKFIT_BASE_URL || "https://api.hiobuy.com/v1",
};

export function getAuthHeader(): Record<string, string> {
  return {
    Authorization: `Bearer ${hioBuyConfig.apiKey}`,
    "Content-Type": "application/json",
  };
}

export async function hioBuyRequest<T>(
  endpoint: string,
  method: string = "POST",
  body?: unknown
): Promise<T> {
  const url = `${hioBuyConfig.baseUrl}${endpoint}`;
  console.log(`[HIOBuy] ${method} ${url}`);
  const response = await fetch(url, {
    method,
    headers: getAuthHeader(),
    body: body ? JSON.stringify(body) : undefined,
  });
  console.log(`[HIOBuy] Response: ${response.status}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error(`[HIOBuy] Error:`, err);
    throw new Error(`HIOBuy API error: ${response.status} - ${JSON.stringify(err)}`);
  }
  return response.json() as Promise<T>;
}

export async function searchProducts(
  channel: "1688" | "taobao",
  keyword: string,
  page: number = 1,
  pageSize: number = 20
) {
  return hioBuyRequest<{
    data: Array<{
      productId: string;
      title: string;
      imageUrl: string;
      price: string;
      minPrice?: string;
      maxPrice?: string;
      minOrderCount?: number;
      sellerName?: string;
      detailUrl?: string;
    }>;
    total: number;
    page: number;
  }>("/products/search", "POST", { channel, keyword, page, page_size: pageSize, language: "en" });
}

export function extractImageId(raw: any): string {
  const id =
    raw?.data?.image_id ??
    raw?.image_id ??
    raw?.data?.imageId ??
    raw?.imageId ??
    raw?.data?.data?.image_id;
  if (!id) throw new Error(`HIOBuy upload-image: no image id in response ${JSON.stringify(raw).slice(0, 300)}`);
  return String(id);
}

export async function uploadImage(
  imageBase64: string,
  channel: "1688" | "taobao" = "1688"
): Promise<string> {
  const raw = await hioBuyRequest<any>("/products/upload-image", "POST", {
    channel,
    image_base64: imageBase64,
  });
  return extractImageId(raw);
}

export function extractProductList(raw: any): Array<{
  productId: string;
  title: string;
  imageUrl: string;
  price: string;
  minPrice?: string;
  maxPrice?: string;
  minOrderCount?: number;
  sellerName?: string;
  detailUrl?: string;
}> {
  const list = Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw?.data?.products)
      ? raw.data.products
      : Array.isArray(raw?.products)
        ? raw.products
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.data?.items)
            ? raw.data.items
            : [];
  const total = raw?.total ?? raw?.data?.total ?? list.length;
  return list.map((p: any) => ({
    productId: String(p.productId ?? p.product_id ?? p.offerId ?? p.source_product_id ?? p.id ?? ""),
    title: String(
      typeof p.title === "string"
        ? p.title
        : (p.title?.translated ?? p.title?.original ?? p.subject ?? "")
    ),
    imageUrl: String(p.imageUrl ?? p.image_url ?? p.picUrl ?? p.image ?? p.img ?? ""),
    price: String(
      p.price?.display_amount ?? p.price?.original_amount ?? (typeof p.price === "string" || typeof p.price === "number" ? p.price : "") ?? p.salePrice ?? p.minPrice ?? ""
    ),
    minPrice: p.minPrice ?? p.min_price,
    maxPrice: p.maxPrice ?? p.max_price,
    minOrderCount: p.minOrderCount ?? p.min_order_count ?? 1,
    sellerName: typeof p.seller === "string" ? p.seller : (p.sellerName ?? p.seller_name ?? p.seller?.name),
    detailUrl: p.detailUrl ?? p.detail_url ?? p.source_url,
  })) as any;
}

export function extractTotal(raw: any, fallback: number): number {
  return Number(raw?.total ?? raw?.data?.total ?? fallback);
}

export async function searchByImage(
  channel: "1688" | "taobao",
  imageId: string,
  page: number = 1,
  pageSize: number = 20
) {
  return hioBuyRequest<{
    data: Array<{
      productId: string;
      title: string;
      imageUrl: string;
      price: string;
      minPrice?: string;
      maxPrice?: string;
      minOrderCount?: number;
      sellerName?: string;
      detailUrl?: string;
    }>;
    total: number;
    page: number;
  }>("/products/search-by-image", "POST", { channel, image_id: imageId, page, page_size: pageSize, language: "en" });
}

export function extractProductDetail(raw: any): {
  productId: string;
  title: string;
  imageUrl: string;
  price: string;
  minPrice?: string;
  maxPrice?: string;
  minOrderCount?: number;
  sellerName?: string;
  detailUrl?: string;
} {
  const p = raw?.data?.product ?? raw?.data ?? raw?.product ?? raw;
  const priceVal =
    p.price?.display_amount ??
    p.price?.original_amount ??
    (typeof p.price === "string" || typeof p.price === "number" ? p.price : undefined) ??
    p.salePrice ??
    p.minPrice ??
    "";
  return {
    productId: String(p.productId ?? p.product_id ?? p.offerId ?? p.source_product_id ?? p.id ?? ""),
    title: String(
      typeof p.title === "string" ? p.title : (p.title?.translated ?? p.title?.original ?? p.subject ?? "")
    ),
    imageUrl: String(p.imageUrl ?? p.image_url ?? p.picUrl ?? p.image ?? p.img ?? ""),
    price: String(priceVal),
    minPrice: p.minPrice ?? p.min_price,
    maxPrice: p.maxPrice ?? p.max_price,
    minOrderCount: p.minOrderCount ?? p.min_order_count ?? 1,
    sellerName: typeof p.seller === "string" ? p.seller : (p.sellerName ?? p.seller_name ?? p.seller?.name),
    detailUrl: p.detailUrl ?? p.detail_url ?? p.source_url,
  };
}

export async function getProductDetail(
  channel: "1688" | "taobao",
  productId: string
) {
  return hioBuyRequest<{
    productId: string;
    title: string;
    imageUrl: string;
    price: string;
    minPrice?: string;
    maxPrice?: string;
    minOrderCount?: number;
    sellerName?: string;
    detailUrl?: string;
    skuInfo?: Array<{
      skuId: string;
      price: string;
      stock: number;
    }>;
    shipping?: {
      cost?: string;
      toRussia?: string;
    };
  }>("/products/detail", "POST", { channel, product_id: productId, language: "en" });
}
