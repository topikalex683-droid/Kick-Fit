import { NextRequest, NextResponse } from "next/server";
import { get1688Product } from "@/lib/nexscope";
import { getTaobaoItem } from "@/lib/taobao";
import type { Marketplace } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { productId, quantity, marketplace } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const mp: Marketplace = marketplace === "taobao" ? "taobao" : "1688";
    const detail =
      mp === "taobao" ? await getTaobaoItem(productId) : await get1688Product(productId);

    const unitCny =
      parseFloat((detail as any).consignPrice || detail.price) || 0;
    const shippingRmb = 50;
    const markupPercent = 15;

    const subtotalCny = unitCny * (quantity || 1);
    const markupRmb = Math.round(subtotalCny * (markupPercent / 100) * 100) / 100;
    const totalCny = Math.round((subtotalCny + markupRmb + shippingRmb) * 100) / 100;
    const totalRmb = Math.round(totalCny * 11.5);

    return NextResponse.json({
      product: detail,
      pricing: {
        marketplacePriceCny: unitCny,
        quantity: quantity || 1,
        shippingRmb,
        markupRmb,
        totalCny,
        totalRmb,
      },
    });
  } catch (error: any) {
    console.error("[price] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
