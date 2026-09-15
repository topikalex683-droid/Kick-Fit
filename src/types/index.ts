export type Marketplace = "1688" | "taobao";

export interface SearchResult {
  productId: string;
  title: string;
  imageUrl: string;
  price: string;
  minPrice?: string;
  maxPrice?: string;
  minOrderCount?: number;
  sellerName?: string;
  detailUrl?: string;
  category?: string;
  consignPrice?: string;
  similarity?: number;
  marketplace: Marketplace;
}

export interface PriceBreakdown {
  marketplacePriceCny: number;
  shippingRmb: number;
  markupRmb: number;
  totalRmb: number;
}

export interface RecognizedItem {
  category: string;
  color: string;
  style: string;
}
