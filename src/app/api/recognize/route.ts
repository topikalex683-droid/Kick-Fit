import { NextRequest, NextResponse } from "next/server";
import { search1688ByImageBase64 } from "@/lib/nexscope";
import { searchTaobaoByImageUrl } from "@/lib/taobao";
import { uploadToPublicHost } from "@/lib/tmapi";
import type { Marketplace, SearchResult } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function parseMarketplaces(value: unknown): Marketplace[] {
  if (Array.isArray(value)) {
    const list = value.filter((v) => v === "1688" || v === "taobao") as Marketplace[];
    if (list.length > 0) return [...new Set(list)];
  }
  if (value === "1688" || value === "taobao") return [value];
  return ["1688", "taobao"];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image is too large (max 4MB)" }, { status: 400 });
    }

    let marketplaces: Marketplace[] = ["1688", "taobao"];
    const rawMp = formData.get("marketplaces");
    if (typeof rawMp === "string") {
      try {
        marketplaces = parseMarketplaces(JSON.parse(rawMp));
      } catch {
        marketplaces = parseMarketplaces(rawMp);
      }
    }

    const bytes = await file.arrayBuffer();
    const buf = Buffer.from(bytes);
    const mime = file.type || "image/jpeg";

    const tasks: Array<Promise<SearchResult[]>> = [];
    if (marketplaces.includes("1688")) {
      tasks.push(
        search1688ByImageBase64(buf.toString("base64")).then((r) => r.results)
      );
    } else {
      tasks.push(Promise.resolve([]));
    }
    if (marketplaces.includes("taobao")) {
      tasks.push(
        (async () => {
          const publicUrl = await uploadToPublicHost(buf, mime);
          const r = await searchTaobaoByImageUrl(publicUrl);
          return r.results;
        })()
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    const settled = await Promise.allSettled(tasks);
    const results: SearchResult[] = [];
    const errors: string[] = [];
    const names: Marketplace[] = ["1688", "taobao"];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") results.push(...s.value);
      else errors.push(`${names[i]}: ${s.reason?.message || s.reason}`);
    });

    return NextResponse.json({ results, total: results.length, errors });
  } catch (error: any) {
    console.error("[recognize] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
