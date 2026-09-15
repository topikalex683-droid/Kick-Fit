import { NextRequest, NextResponse } from "next/server";
import { search1688ByKeyword, translateRuToZh } from "@/lib/nexscope";
import { searchTaobaoByKeyword } from "@/lib/taobao";
import type { Marketplace, SearchResult } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

async function translate(text: string, pair: string): Promise<string> {
  const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${pair}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Translate failed (${response.status})`);
  const data = await response.json();
  const translated = data?.responseData?.translatedText as string | undefined;
  if (!translated) throw new Error("Translate returned empty result");
  return translated;
}

export async function POST(request: NextRequest) {
  try {
    const { keyword, page, pageSize, marketplaces } = await request.json();

    if (!keyword) {
      return NextResponse.json({ error: "keyword is required" }, { status: 400 });
    }

    const mps: Marketplace[] =
      Array.isArray(marketplaces) && marketplaces.length > 0
        ? (marketplaces.filter((m) => m === "1688" || m === "taobao") as Marketplace[])
        : ["1688", "taobao"];

    const [zh, en] = await Promise.all([
      mps.includes("1688")
        ? translate(keyword, "ru|zh-CN").catch(() => keyword)
        : Promise.resolve(keyword),
      mps.includes("taobao")
        ? translate(keyword, "ru|en").catch(() => keyword)
        : Promise.resolve(keyword),
    ]);

    const tasks: Array<Promise<SearchResult[]>> = [
      mps.includes("1688")
        ? search1688ByKeyword(zh, { page: page || 1, pageSize: pageSize || 20 }).then((r) => r.results)
        : Promise.resolve([]),
      mps.includes("taobao")
        ? searchTaobaoByKeyword(en, { offset: 0, limit: pageSize || 20 }).then((r) => r.results)
        : Promise.resolve([]),
    ];

    const settled = await Promise.allSettled(tasks);
    const results: SearchResult[] = [];
    const errors: string[] = [];
    const names: Marketplace[] = ["1688", "taobao"];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") results.push(...s.value);
      else errors.push(`${names[i]}: ${s.reason?.message || s.reason}`);
    });

    return NextResponse.json({
      results,
      total: results.length,
      translatedKeyword: zh,
      translatedKeywordEn: en,
      errors,
    });
  } catch (error: any) {
    console.error("[search] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
