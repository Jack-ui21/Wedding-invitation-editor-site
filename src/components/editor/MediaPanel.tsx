"use client";

import { useRef, useState } from "react";
import { ImagePlus, Music2, Trash2 } from "lucide-react";
import type { ProjectFile, WeddingDetails } from "@/lib/data/types";

const IMAGE_TARGETS = [
  ["brideImageUrl", "Bride photo"],
  ["groomImageUrl", "Groom photo"],
  ["coupleImageUrl", "Couple photo"],
  ["galleryImageUrl", "Gallery photo"],
  ["backgroundImageUrl", "Background image"],
] as const;

export function MediaPanel({
  projectId,
  assets,
  details,
  busy,
  onUpload,
  onUse,
  onRemove,
}: {
  projectId: string;
  assets: ProjectFile[];
  details: WeddingDetails;
  busy: boolean;
  onUpload: (file: File) => void;
  onUse: (field: string, url: string) => void;
  onRemove: (path: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string>("brideImageUrl");
  const images = assets.filter((asset) => asset.kind === "image");
  const audio = assets.filter((asset) => asset.kind === "audio");
  const urlFor = (path: string) => `/api/files/${projectId}/${path.split("/").map(encodeURIComponent).join("/")}`;

  return (
    <div className="space-y-6">
      <section className="ws-card p-4">
        <h3 className="text-lg text-plum">Upload media</h3>
        <p className="mt-1 text-xs text-black/55">Images and music are stored inside this project only.</p>
        <input
          ref={ref}
          type="file"
          multiple
          accept="image/*,audio/*"
          className="hidden"
          onChange={(event) => {
            Array.from(event.target.files ?? []).forEach(onUpload);
            event.target.value = "";
          }}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="ws-btn-primary" disabled={busy} onClick={() => ref.current?.click()}><ImagePlus size={16} /> Choose images / audio</button>
          <select className="ws-input w-auto min-w-44" value={target} onChange={(event) => setTarget(event.target.value)} aria-label="Apply uploaded image to">
            {IMAGE_TARGETS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-bold tracking-[0.18em] text-gold uppercase">Images ({images.length})</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((asset) => (
            <div key={asset.path} className="ws-card overflow-hidden">
              {/* URL comes from the project's own signed/private asset route. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlFor(asset.path)} alt={asset.name} className="aspect-square w-full object-cover" />
              <div className="space-y-2 p-2">
                <p className="truncate text-[11px] text-black/55" title={asset.path}>{asset.name}</p>
                <div className="flex gap-1">
                  <button className="ws-btn-ghost min-h-8 flex-1 px-1 text-[11px]" onClick={() => onUse(target, urlFor(asset.path))}>Use as {IMAGE_TARGETS.find(([key]) => key === target)?.[1]}</button>
                  <button className="ws-btn-ghost min-h-8 px-2 text-red-700" onClick={() => onRemove(asset.path)}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {images.length === 0 && <p className="text-sm text-black/50">No images uploaded yet.</p>}
      </section>

      <section>
        <h3 className="mb-3 text-xs font-bold tracking-[0.18em] text-gold uppercase">Music ({audio.length})</h3>
        {audio.map((asset) => (
          <div key={asset.path} className="ws-card mb-2 flex flex-wrap items-center gap-3 p-3">
            <Music2 className="text-plum" size={18} />
            <span className="min-w-0 flex-1 truncate text-sm">{asset.name}</span>
            <button className="ws-btn-ghost min-h-9 px-3 text-xs" onClick={() => onUse("musicUrl", urlFor(asset.path))}>Use as wedding music</button>
            <button className="ws-btn-ghost min-h-9 px-2 text-red-700" onClick={() => onRemove(asset.path)}><Trash2 size={14} /></button>
          </div>
        ))}
        {audio.length === 0 && <p className="text-sm text-black/50">No music uploaded yet. Browser autoplay is blocked on mobile, so guests get a play button.</p>}
        {details.musicUrl && <p className="mt-2 text-xs text-emerald-700">Music connected: {details.musicUrl.slice(0, 90)}</p>}
      </section>
    </div>
  );
}
