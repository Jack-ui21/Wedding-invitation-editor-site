"use client";

import { useRef, useState } from "react";
import { FileArchive, FileCode2, Loader2, UploadCloud } from "lucide-react";
import { ALLOWED_IMPORT_EXTENSIONS, MAX_IMPORT_BYTES } from "@/lib/config";
import { importHtml } from "@/lib/import/html";
import { importZip } from "@/lib/import/zip";
import type { ImportResult } from "@/lib/import/types";

async function readFileWithProgress(file: File, onProgress: (percent: number) => void): Promise<ArrayBuffer> {
  if (!file.stream) return file.arrayBuffer();
  const reader = file.stream().getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress(Math.min(95, Math.round((received / Math.max(file.size, 1)) * 95)));
  }
  const output = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output.buffer;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ImportPanel({
  onApply,
  busy,
}: {
  onApply: (result: ImportResult) => Promise<void>;
  busy?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [selectedMain, setSelectedMain] = useState("");

  async function analyse(file: File, preferredMain = "") {
    setWorking(true);
    setError("");
    setResult(null);
    setProgress(0);
    setPhase("Reading file");
    try {
      const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
      if (!ALLOWED_IMPORT_EXTENSIONS.includes(ext as (typeof ALLOWED_IMPORT_EXTENSIONS)[number])) {
        throw new Error(`Unsupported file type ${ext || "(none)"}. Allowed: ${ALLOWED_IMPORT_EXTENSIONS.join(", ")}`);
      }
      if (file.size > MAX_IMPORT_BYTES) throw new Error(`File is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_IMPORT_BYTES)}.`);
      if (/\.zip$/i.test(file.name)) {
        setSourceFile(file);
        const parsed = await importZip(file, (percent, label) => {
          setProgress(percent);
          setPhase(label);
        }, preferredMain || undefined);
        setSelectedMain(parsed.mainFilePath);
        setResult(parsed);
      } else if (/\.html?$/i.test(file.name)) {
        setSourceFile(null);
        setPhase("Parsing HTML");
        const buffer = await readFileWithProgress(file, setProgress);
        const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
        setResult(importHtml(file.name, text));
      } else {
        setSourceFile(null);
        setError("CSS, JS and media files can be uploaded from the Code and Media tabs. Choose an HTML file or ZIP here.");
      }
      setProgress(100);
      setPhase("Ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed");
    } finally {
      setWorking(false);
    }
  }

  async function chooseMain(path: string) {
    setSelectedMain(path);
    if (sourceFile) await analyse(sourceFile, path);
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border-2 border-dashed border-plum/20 bg-plum/[0.03] p-6 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file) void analyse(file);
        }}
      >
        <UploadCloud className="mx-auto text-plum" size={30} />
        <p className="mt-3 font-semibold text-plum">Import a wedding website</p>
        <p className="mt-1 text-xs text-black/55">HTML file, ZIP project, CSS or JS. Files stay in your project.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".html,.htm,.zip,.css,.js,.png,.jpg,.jpeg,.webp,.gif,.mp3"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void analyse(file);
            event.target.value = "";
          }}
        />
        <button className="ws-btn-primary mt-4" onClick={() => inputRef.current?.click()} disabled={working || busy}>
          {working ? <Loader2 className="animate-spin" size={16} /> : <FileArchive size={16} />}
          Choose file
        </button>
      </div>

      {working && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-black/10">
            <div className="h-full bg-plum transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-black/55">{phase}… {progress}%</p>
        </div>
      )}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

      {result && (
        <div className="ws-card space-y-3 p-4">
          <div className="flex items-start gap-3">
            <FileCode2 className="mt-1 shrink-0 text-gold" size={19} />
            <div>
              <p className="font-semibold">Website analysed</p>
              <p className="text-xs text-black/55">
                {result.files.length} files · {result.fields.length} editable fields detected · {result.dataUriCount} embedded images
              </p>
            </div>
          </div>
          {result.htmlCandidates.length > 1 && (
            <label className="block text-xs">
              <span className="ws-label">Main HTML file</span>
              <select className="ws-input" value={selectedMain} onChange={(event) => void chooseMain(event.target.value)}>
                {result.htmlCandidates.map((path) => <option key={path} value={path}>{path}</option>)}
              </select>
            </label>
          )}
          {result.warnings.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              {result.warnings.slice(0, 8).map((warning) => <li key={warning}>• {warning}</li>)}
            </ul>
          )}
          <div className="max-h-32 overflow-auto rounded-xl bg-black/5 p-3 text-xs ws-scroll">
            {result.fields.slice(0, 20).map((field) => (
              <p key={field.key}><strong>{field.key}</strong> → <span className="text-black/55">{field.text.slice(0, 80)}</span></p>
            ))}
          </div>
          <button className="ws-btn-primary w-full" disabled={working || busy} onClick={() => void onApply(result)}>
            Apply to this project
          </button>
        </div>
      )}
    </div>
  );
}
