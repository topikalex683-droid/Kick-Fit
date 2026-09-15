"use client";

import { useState } from "react";
import type { SearchResult } from "@/types";

interface PriceCalculatorProps {
  result: SearchResult;
}

export default function PriceCalculator({ result }: PriceCalculatorProps) {
  const [qty, setQty] = useState(1);

  const marketplacePrice = parseFloat(result.consignPrice || result.price) || 0;
  const minOrder = result.minOrderCount || 1;
  const orderQty = Math.max(qty, minOrder);
  
  const shippingRmb = 50;
  const markupPercent = 15;
  
  const subtotalCny = marketplacePrice * orderQty;
  const markupRmb = subtotalCny * (markupPercent / 100);
  const totalCny = subtotalCny + markupRmb + shippingRmb;
  const totalRmb = Math.round(totalCny * 11.5);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#78716C]">Цена за 1 шт.</span>
        <span className="font-medium text-[#1C1917]">{result.price} ₽</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#78716C]">Кол-во (мин. {minOrder})</span>
        <input
          type="number"
          min={minOrder}
          value={qty}
          onChange={(e) => setQty(parseInt(e.target.value) || 1)}
          className="w-16 px-2 py-1 border border-[#E7E5E4] rounded text-center text-[#1C1917] text-sm"
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#78716C]">Доставка</span>
        <span className="font-medium text-[#1C1917]">{shippingRmb} ₽</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#78716C]">Наценка (15%)</span>
        <span className="font-medium text-[#1C1917]">{markupRmb.toFixed(2)} ₽</span>
      </div>
      <div className="border-t border-[#E7E5E4] pt-3 flex items-center justify-between">
        <span className="font-semibold text-[#1C1917]">Итого</span>
        <span className="text-xl font-bold text-[#E8622A]">{totalRmb} ₽</span>
      </div>
    </div>
  );
}
