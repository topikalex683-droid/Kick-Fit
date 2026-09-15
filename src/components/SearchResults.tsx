"use client";

import { useState } from "react";
import PriceCalculator from "./PriceCalculator";
import type { SearchResult } from "@/types";

interface SearchResultsProps {
  results: SearchResult[];
}

export default function SearchResults({ results }: SearchResultsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  if (results.length === 0) return null;

  const keyOf = (r: SearchResult) => `${r.marketplace}:${r.productId}`;
  const selectedResult = results.find((r) => keyOf(r) === selected);

  return (
    <div className="space-y-3">
      {results.map((item) => (
        <div
          key={keyOf(item)}
          className={`flex gap-4 p-3 rounded-xl border cursor-pointer transition-all ${
            selected === keyOf(item)
              ? "border-[#E8622A] bg-[#FFF7ED]"
              : "border-[#E7E5E4] bg-white hover:border-[#E8622A]"
          }`}
          onClick={() => setSelected(selected === keyOf(item) ? null : keyOf(item))}
        >
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-20 h-20 object-cover rounded-lg"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                  item.marketplace === "taobao"
                    ? "bg-[#FF5000]/10 text-[#FF5000]"
                    : "bg-[#E8622A]/10 text-[#E8622A]"
                }`}
              >
                {item.marketplace === "taobao" ? "Taobao" : "1688"}
              </span>
              <h3 className="text-sm font-medium text-[#1C1917] truncate flex-1">
                {item.title}
              </h3>
            </div>
            {item.sellerName && (
              <p className="text-xs text-[#78716C]">{item.sellerName}</p>
            )}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-lg font-bold text-[#E8622A]">
                {item.price} ₽
              </span>
              {item.minOrderCount && item.minOrderCount > 1 && (
                <span className="text-xs text-[#78716C]">от {item.minOrderCount} шт.</span>
              )}
            </div>
          </div>
        </div>
      ))}

      {selectedResult && (
        <div className="mt-4 p-4 bg-[#F5F5F4] rounded-xl border border-[#E7E5E4]">
          <h4 className="font-semibold text-[#1C1917] mb-3">Расчёт цены</h4>
          <PriceCalculator result={selectedResult} />
          <button
            onClick={() => {
              fetch("/api/price", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  productId: selectedResult.productId,
                  marketplace: selectedResult.marketplace,
                  quantity: 1,
                }),
              })
                .then((r) => r.json())
                .then((j) => {
                  if (j.error) alert(j.error);
                  else
                    alert(
                      `Итого: ${j.pricing.totalRmb} ₽ (товар ${j.pricing.marketplacePriceCny}¥ + доставка ${j.pricing.shippingRmb} + наценка ${j.pricing.markupRmb})`
                    );
                })
                .catch((e) => alert(e.message));
            }}
            className="mt-3 block w-full text-center px-4 py-2 bg-[#1C1917] text-white rounded-lg text-sm font-medium hover:bg-black transition-colors"
          >
            💰 Точная цена с доставкой
          </button>
          <a
            href={
              selectedResult.detailUrl ||
              (selectedResult.marketplace === "taobao"
                ? `https://item.taobao.com/item.htm?id=${selectedResult.productId}`
                : `https://detail.1688.com/offer/${selectedResult.productId}.html`)
            }
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-center px-4 py-2 bg-[#E8622A] text-white rounded-lg text-sm font-medium hover:bg-[#D4561D] transition-colors"
          >
            Посмотреть на {selectedResult.marketplace === "taobao" ? "Taobao" : "1688"} →
          </a>
        </div>
      )}
    </div>
  );
}
