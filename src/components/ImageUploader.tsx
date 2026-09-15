"use client";

import { useCallback, useRef, useState } from "react";
import type { Marketplace, SearchResult } from "@/types";

interface ImageUploaderProps {
  onImageResults: (results: SearchResult[]) => void;
  onKeyword: (keyword: string, marketplaces: Marketplace[]) => void;
  onError: (msg: string) => void;
  onLoading: (v: boolean) => void;
  loading: boolean;
}

export function MarketplaceTabs({
  value,
  onChange,
}: {
  value: Marketplace[];
  onChange: (v: Marketplace[]) => void;
}) {
  const toggle = (m: Marketplace) => {
    if (value.includes(m)) {
      if (value.length === 1) return;
      onChange(value.filter((x) => x !== m));
    } else {
      onChange([...value, m]);
    }
  };
  return (
    <div className="flex gap-2 mb-4">
      {(["1688", "taobao"] as Marketplace[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => toggle(m)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            value.includes(m)
              ? "bg-[#1C1917] text-white"
              : "bg-[#F5F5F4] text-[#78716C] hover:bg-[#E7E5E4]"
          }`}
        >
          {m === "1688" ? "1688" : "Taobao"}
        </button>
      ))}
    </div>
  );
}

export default function ImageUploader({ onImageResults, onKeyword, onError, onLoading, loading }: ImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>(["1688", "taobao"]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file || loading) return;
      if (file.size > 4 * 1024 * 1024) {
        onError("Фото слишком большое (максимум 4MB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        setPreview(reader.result as string);
        onLoading(true);
        onError("");
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("marketplaces", JSON.stringify(marketplaces));

          const res = await fetch("/api/recognize", {
            method: "POST",
            body: formData,
          });
          const json = await res.json();
          if (json.error) throw new Error(json.error);
          onImageResults(json.results || []);
        } catch (e: any) {
          onError(e.message || "Не удалось распознать фото");
        } finally {
          onLoading(false);
        }
      };
      reader.readAsDataURL(file);
    },
    [loading, marketplaces, onImageResults, onError, onLoading]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div>
      <MarketplaceTabs value={marketplaces} onChange={setMarketplaces} />
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? "border-[#E8622A] bg-[#FFF7ED]"
            : "border-[#E7E5E4] hover:border-[#E8622A]"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        {preview ? (
          <div className="space-y-4">
            <img
              src={preview}
              alt="Preview"
              className="mx-auto max-h-64 rounded-lg shadow-sm"
            />
            <p className="text-sm text-[#78716C]">
              {loading ? "Ищем аналоги..." : "Нажми или перетащи другое фото"}
            </p>
          </div>
        ) : (
          <div>
            <div className="text-4xl mb-3">📷</div>
            <p className="text-[#1C1917] font-medium mb-1">
              Перетащи фото одежды сюда или нажми для выбора
            </p>
            <p className="text-sm text-[#78716C]">
              PNG, JPG до 4MB
            </p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-[#1C1917] mb-2">
          Или введи название
        </label>
        <KeywordSearch
          onKeyword={(kw) => onKeyword(kw, marketplaces)}
          loading={loading}
        />
      </div>
    </div>
  );
}

function KeywordSearch({
  onKeyword,
  loading,
}: {
  onKeyword: (keyword: string) => void;
  loading: boolean;
}) {
  const [keyword, setKeyword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    onKeyword(keyword.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="Например: белые кроссовки"
        className="flex-1 px-4 py-2.5 rounded-lg border border-[#E7E5E4] bg-white text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#E8622A] focus:border-transparent text-sm"
      />
      <button
        type="submit"
        disabled={loading || !keyword.trim()}
        className="px-5 py-2.5 rounded-lg bg-[#E8622A] text-white font-medium hover:bg-[#D4561D] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
      >
        {loading ? "..." : "Искать"}
      </button>
    </form>
  );
}
