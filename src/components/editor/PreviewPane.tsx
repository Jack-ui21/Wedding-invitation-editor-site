"use client";

import { Monitor, MousePointer2, RefreshCw, Smartphone } from "lucide-react";

export function PreviewPane({
  srcDoc,
  device,
  selectMode,
  revision,
  frameRef,
  onFrameLoad,
  onDevice,
  onSelectMode,
  onRefresh,
}: {
  srcDoc: string;
  device: "desktop" | "mobile";
  selectMode: boolean;
  revision: number;
  frameRef?: React.RefObject<HTMLIFrameElement | null>;
  onFrameLoad?: () => void;
  onDevice: (device: "desktop" | "mobile") => void;
  onSelectMode: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-2 border-b border-black/8 bg-white/80 px-3 py-2">
        <span className="mr-auto text-xs font-semibold tracking-wide text-black/50 uppercase">Live preview</span>
        <button className={`ws-btn min-h-9 px-2.5 text-xs ${selectMode ? "bg-gold text-plum-deep" : "ws-btn-ghost"}`} onClick={onSelectMode} title="Pick an element in the preview to map a field">
          <MousePointer2 size={15} /> Pick element
        </button>
        <div className="flex overflow-hidden rounded-lg border border-black/10">
          <button className={`grid size-9 place-items-center ${device === "desktop" ? "bg-plum text-white" : "bg-white"}`} onClick={() => onDevice("desktop")} aria-label="Desktop preview"><Monitor size={15} /></button>
          <button className={`grid size-9 place-items-center ${device === "mobile" ? "bg-plum text-white" : "bg-white"}`} onClick={() => onDevice("mobile")} aria-label="Mobile preview"><Smartphone size={15} /></button>
        </div>
        <button className="ws-btn-ghost min-h-9 px-2.5 text-xs" onClick={onRefresh}><RefreshCw size={15} /> Refresh</button>
      </header>
      <div className="flex flex-1 justify-center overflow-auto bg-black/5 p-3 ws-scroll">
        <div className={`${device === "mobile" ? "w-[390px] max-w-full" : "w-full"} overflow-hidden rounded-xl bg-white shadow-lg transition-all`}>
          <iframe
            key={revision}
            ref={frameRef}
            onLoad={onFrameLoad}
            title="Wedding website live preview"
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox"
            className="h-[640px] w-full border-0 bg-white"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
      {selectMode && <p className="border-t border-gold/30 bg-gold/10 px-4 py-2 text-center text-xs text-plum">Tap any text in the preview, then choose which field it should control.</p>}
    </section>
  );
}
