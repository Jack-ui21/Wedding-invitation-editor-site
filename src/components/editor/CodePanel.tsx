"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { FileCode2, Upload } from "lucide-react";
import type { ProjectFile } from "@/lib/data/types";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-black/50">Loading code editor…</div>,
});

export function CodePanel({
  files,
  texts,
  busy,
  onEdit,
  onUpload,
}: {
  files: ProjectFile[];
  texts: Record<string, string>;
  busy: boolean;
  onEdit: (path: string, text: string) => void;
  onUpload: (file: File) => void;
}) {
  const codeFiles = files.filter((file) => ["html", "css", "js", "other"].includes(file.kind));
  const [active, setActive] = useState(codeFiles[0]?.path ?? "");
  const [simple, setSimple] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.innerWidth < 768) setSimple(true);
    if (!active && codeFiles[0]) setActive(codeFiles[0].path);
  }, [active, codeFiles]);

  if (!codeFiles.length) {
    return <p className="rounded-xl bg-black/5 p-4 text-sm text-black/55">Import an HTML file or upload CSS/JS files to edit code.</p>;
  }

  const language = active.endsWith(".css") ? "css" : active.endsWith(".js") ? "javascript" : active.endsWith(".html") || active.endsWith(".htm") ? "html" : "plaintext";
  const value = texts[active] ?? "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="ws-scroll flex max-w-full gap-1 overflow-x-auto rounded-xl bg-black/5 p-1">
          {codeFiles.map((file) => (
            <button
              key={file.path}
              className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-medium ${active === file.path ? "bg-white text-plum shadow-sm" : "text-black/55"}`}
              onClick={() => setActive(file.path)}
            >
              {file.path}
            </button>
          ))}
        </div>
        <button className="ws-btn-ghost min-h-9 px-2.5 text-xs" onClick={() => setSimple(!simple)}>{simple ? "Use Monaco" : "Simple editor"}</button>
        <input ref={inputRef} type="file" accept=".html,.htm,.css,.js,.json" className="hidden" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = "";
        }} />
        <button className="ws-btn-ghost min-h-9 px-2.5 text-xs" disabled={busy} onClick={() => inputRef.current?.click()}><Upload size={14} /> Upload code file</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
        {simple ? (
          <textarea
            className="min-h-[520px] w-full resize-y p-4 font-mono text-[13px] leading-6 outline-none"
            spellCheck={false}
            value={value}
            onChange={(event) => onEdit(active, event.target.value)}
            aria-label={`Code for ${active}`}
          />
        ) : (
          <div className="h-[520px]">
            <Monaco
              height="100%"
              language={language}
              value={value}
              theme="vs-light"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
              }}
              onChange={(next) => onEdit(active, next ?? "")}
            />
          </div>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-black/45"><FileCode2 size={13} /> Changes update the live preview and are saved with the project.</p>
    </div>
  );
}
