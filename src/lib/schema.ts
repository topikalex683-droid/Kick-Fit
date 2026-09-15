import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  marketplace: text("marketplace").notNull(),
  offerId: text("offer_id").notNull(),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  priceCny: real("price_cny").notNull(),
  priceMin: real("price_min"),
  priceMax: real("price_max"),
  minOrderCount: integer("min_order_count").default(1),
  category: text("category"),
  sellerName: text("seller_name"),
  detailUrl: text("detail_url"),
  shippingCostRmb: real("shipping_cost_rmb").default(0),
  lastUpdated: integer("last_updated").notNull(),
});

export const searchResults = sqliteTable("search_results", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  originalImageBase64: text("original_image_base64"),
  recognizedCategory: text("recognized_category"),
  recognizedColor: text("recognized_color"),
  createdAt: integer("created_at").notNull(),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  productId: text("product_id").notNull(),
  marketplace: text("marketplace").notNull(),
  quantity: integer("quantity").default(1),
  unitPriceRmb: real("unit_price_rmb").notNull(),
  shippingRmb: real("shipping_rmb").notNull(),
  markupRmb: real("markup_rmb").notNull(),
  totalRmb: real("total_rmb").notNull(),
  status: text("status").default("pending"),
  createdAt: integer("created_at").notNull(),
});

export const cache = sqliteTable("cache", {
  key: text("key").primaryKey(),
  result: text("result").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});
