"use client";

import ImageUploader from "@/components/ImageUploader";
import SearchResults from "@/components/SearchResults";
import { useState } from "react";
import type { Marketplace, SearchResult } from "@/types";

export default function Home() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translatedKeyword, setTranslatedKeyword] = useState<string | null>(null);
  const [apiErrors, setApiErrors] = useState<string[]>([]);

  const handleImageResults = (items: SearchResult[]) => {
    setTranslatedKeyword(null);
    setResults(items);
    if (items.length === 0) {
      setError("Похожие товары не найдены, попробуй другое фото или поиск по названию");
    }
  };

  const handleKeyword = async (keyword: string, marketplaces: Marketplace[]) => {
    setLoading(true);
    setError(null);
    setApiErrors([]);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, marketplaces }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResults(json.results || []);
      setTranslatedKeyword(json.translatedKeyword || null);
      if (json.errors?.length) setApiErrors(json.errors);
      if ((json.results || []).length === 0) {
        setError("Ничего не найдено, попробуй другой запрос");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F5F4]">
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-[#1C1917] mb-2">kik FIT</h1>
        <p className="text-lg text-[#78716C] mb-8">
          Найди свой стиль с китайских маркетплейсов
        </p>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-sm border border-[#E7E5E4] p-6">
            <h2 className="text-xl font-semibold text-[#1C1917] mb-4">
              📷 Загрузи фото одежды
            </h2>
            <ImageUploader
              onImageResults={handleImageResults}
              onKeyword={handleKeyword}
              onError={setError}
              onLoading={setLoading}
              loading={loading}
            />
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-[#E7E5E4] p-6">
            <h2 className="text-xl font-semibold text-[#1C1917] mb-4">
              🛍️ Результаты
            </h2>
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E8622A]" />
              </div>
            )}
            {!loading && !error && results.length === 0 && (
              <div className="flex items-center justify-center py-12 text-[#78716C]">
                Загрузи фото, чтобы увидеть результаты
              </div>
            )}
            {apiErrors.length > 0 && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                {apiErrors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}
            <SearchResults results={results} />
            {translatedKeyword && (
              <a
                href={`https://mobile.yangkeduo.com/search_result.html?search_key=${encodeURIComponent(translatedKeyword)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block text-center px-4 py-2.5 rounded-lg border border-[#E8622A] text-[#E8622A] text-sm font-medium hover:bg-[#FFF7ED] transition-colors"
              >
                🔍 Этот же запрос на Pinduoduo →
              </a>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
