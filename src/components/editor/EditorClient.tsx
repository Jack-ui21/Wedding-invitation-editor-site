"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import {
  AlertCircle,
  ArrowLeft,
  BookmarkPlus,
  CheckCircle2,
  Code2,
  Download,
  Eye,
  FileUp,
  Globe2,
  ImageIcon,
  Layers3,
  Loader2,
  Redo2,
  Undo2,
} from "lucide-react";
import { Modal, StatusBadge } from "@/components/ui";
import { ContentPanel } from "./ContentPanel";
import { EventsPanel } from "./EventsPanel";
import { ImportPanel } from "./ImportPanel";
import { MediaPanel } from "./MediaPanel";
import { CodePanel } from "./CodePanel";
import { PreviewPane } from "./PreviewPane";
import { apiFetch } from "@/lib/client-fetch";
import { MAX_ASSET_BYTES } from "@/lib/config";
import { detectFileKind, mimeForPath, slugify } from "@/lib/data/path";
import type { FieldMappings, ProjectFile, ProjectRecord, WeddingDetails, WeddingEvent } from "@/lib/data/types";
import { buildStandaloneHtml } from "@/lib/editor/export";
import { applyMappingsToSource, buildPreviewDocument } from "@/lib/editor/source";
import type { ImportResult } from "@/lib/import/types";
import { deleteProjectFile, uploadProjectFile } from "@/lib/upload/client";

type Tab = "content" | "events" | "media" | "code" | "import" | "preview";
type SaveState = "saved" | "dirty" | "saving" | "error";

interface Snapshot {
  project: ProjectRecord;
  texts: Record<string, string>;
}

interface Props {
  project: ProjectRecord;
  initialTexts: Record<string, string>;
  fileUrls: Record<string, string>;
  isOwner: boolean;
}

const TABS: Array<{ id: Tab; label: string; icon: typeof Layers3 }> = [
  { id: "content", label: "Content", icon: Layers3 },
  { id: "events", label: "Events", icon: Globe2 },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "code", label: "Code", icon: Code2 },
  { id: "import", label: "Import", icon: FileUp },
  { id: "preview", label: "Preview", icon: Eye },
];

const TEXT_KINDS = new Set(["html", "css", "js", "other"]);
const URL_FIELDS = new Set(["mapsUrl", "musicUrl", "instagramUrl", "rsvpPhone", "mapUrl", "imageUrl"]);

function isTextFile(file: ProjectFile): boolean {
  return TEXT_KINDS.has(file.kind);
}

function emptyEvent(id = crypto.randomUUID()): WeddingEvent {
  return { id, name: "", date: "", time: "", location: "", description: "", imageUrl: "", mapUrl: "" };
}

function safeAssetName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "file";
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function EditorClient({ project: initialProject, initialTexts, fileUrls: initialFileUrls, isOwner }: Props) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [texts, setTexts] = useState<Record<string, string>>(initialTexts);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>(initialFileUrls);
  const [activeTab, setActiveTab] = useState<Tab>("content");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [selectMode, setSelectMode] = useState(false);
  const [pickKey, setPickKey] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState("");
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState(project.name);
  const [templateDescription, setTemplateDescription] = useState("");
  const [slugInput, setSlugInput] = useState(initialProject.slug ?? slugify(initialProject.name));
  const [publishError, setPublishError] = useState("");
  const [exportProgress, setExportProgress] = useState("");
  const [historyTick, setHistoryTick] = useState(0);

  const token = useRef(crypto.randomUUID()).current;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const historyRef = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const projectRef = useRef(project);
  const textsRef = useRef(texts);
  const fileUrlsRef = useRef(fileUrls);
  const lastEditRef = useRef<{ key: string; time: number } | null>(null);
  const pendingSavesRef = useRef(0);
  const projectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  useEffect(() => {
    textsRef.current = texts;
  }, [texts]);
  useEffect(() => {
    fileUrlsRef.current = fileUrls;
  }, [fileUrls]);

  const source = texts[project.mainFilePath] ?? "";
  const sourceSize = useMemo(() => new Blob([source]).size, [source]);
  const assets = project.files.filter((file) => !isTextFile(file));

  function snapshot(): Snapshot {
    return { project: structuredClone(projectRef.current), texts: { ...textsRef.current } };
  }

  function pushHistory(): void {
    const history = historyRef.current;
    history.past.push(snapshot());
    if (history.past.length > 5) history.past.shift();
    history.future = [];
    setHistoryTick((value) => value + 1);
  }

  function beginEdit(key: string): void {
    const now = Date.now();
    const previous = lastEditRef.current;
    if (!previous || previous.key !== key || now - previous.time > 1500) pushHistory();
    lastEditRef.current = { key, time: now };
  }

  function beginSave(): void {
    pendingSavesRef.current += 1;
    setSaveState("saving");
  }

  function endSave(error?: string): void {
    pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
    if (error) {
      setSaveState("error");
      setNotice(error);
    } else if (pendingSavesRef.current === 0) {
      setSaveState("saved");
    }
  }

  function urlFor(projectId: string, path: string): string {
    return fileUrlsRef.current[path] ?? `/api/files/${projectId}/${path.split("/").map(encodeURIComponent).join("/")}`;
  }

  async function persistProject(): Promise<void> {
    const current = projectRef.current;
    beginSave();
    try {
      const result = await apiFetch<{ project: ProjectRecord }>(`/api/projects/${current.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: current.name,
          wedding: current.wedding,
          events: current.events,
          fieldMappings: current.fieldMappings,
        }),
      });
      setProject((previous) => ({ ...previous, updatedAt: result.project.updatedAt }));
      endSave();
    } catch (caught) {
      endSave(caught instanceof Error ? caught.message : "Could not save project");
    }
  }

  async function persistFile(path: string): Promise<void> {
    const current = projectRef.current;
    const text = textsRef.current[path];
    if (text == null) return;
    beginSave();
    try {
      const bytes = new TextEncoder().encode(text);
      const uploaded = await uploadProjectFile(current.id, {
        path,
        name: path.split("/").pop() ?? path,
        kind: detectFileKind(path),
        mimeType: mimeForPath(path),
        size: bytes.byteLength,
        text,
      });
      if (uploaded.url) setFileUrls((previous) => ({ ...previous, [path]: uploaded.url }));
      endSave();
    } catch (caught) {
      endSave(caught instanceof Error ? caught.message : `Could not save ${path}`);
    }
  }

  function markDirty(): void {
    setSaveState("dirty");
    if (projectTimerRef.current) clearTimeout(projectTimerRef.current);
    projectTimerRef.current = setTimeout(() => void persistProject(), 900);
  }

  function scheduleFileSave(path: string): void {
    setSaveState("dirty");
    const timers = fileTimersRef.current;
    const existing = timers.get(path);
    if (existing) clearTimeout(existing);
    timers.set(
      path,
      setTimeout(() => {
        timers.delete(path);
        void persistFile(path);
      }, 900),
    );
  }

  /** Visual edits are written back into the real HTML source after typing settles. */
  function scheduleSourcePatch(): void {
    if (sourceTimerRef.current) clearTimeout(sourceTimerRef.current);
    sourceTimerRef.current = setTimeout(() => {
      const current = projectRef.current;
      const currentTexts = textsRef.current;
      const html = currentTexts[current.mainFilePath];
      if (!html || !Object.keys(current.fieldMappings).length) return;
      try {
        const patched = applyMappingsToSource(html, current.wedding, current.fieldMappings, current.events);
        if (patched !== html) {
          setTexts((previous) => ({ ...previous, [current.mainFilePath]: patched }));
          scheduleFileSave(current.mainFilePath);
        }
      } catch (caught) {
        setNotice(caught instanceof Error ? caught.message : "Could not update HTML source");
      }
    }, 750);
  }

  function persistAll(): void {
    void persistProject();
    const current = projectRef.current;
    for (const [path, text] of Object.entries(textsRef.current)) {
      if (current.files.some((file) => file.path === path && isTextFile(file)) && text != null) void persistFile(path);
    }
  }

  useEffect(() => {
    return () => {
      if (projectTimerRef.current) clearTimeout(projectTimerRef.current);
      if (sourceTimerRef.current) clearTimeout(sourceTimerRef.current);
      fileTimersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // Rebuild the sandboxed preview after edits settle instead of on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = projectRef.current;
      const html = texts[current.mainFilePath] ?? "";
      if (!html) {
        setPreviewDoc("<!DOCTYPE html><html><body style='font:14px sans-serif;color:#6b5b66;padding:32px'><h2>No page imported yet</h2><p>Open the Import tab to add an HTML file or ZIP project.</p></body></html>");
        setRevision((value) => value + 1);
        return;
      }
      try {
        const files = current.files.map((file) => ({
          path: file.path,
          text: isTextFile(file) ? texts[file.path] : undefined,
          url: urlFor(current.id, file.path),
        }));
        const doc = buildPreviewDocument({
          html,
          mainFilePath: current.mainFilePath,
          files,
          details: current.wedding,
          mappings: current.fieldMappings,
          events: current.events,
          token,
          selectMode,
        });
        setPreviewDoc(doc);
        setRevision((value) => value + 1);
      } catch (caught) {
        setNotice(caught instanceof Error ? `Preview error: ${caught.message}` : "Preview failed");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [texts, project.files, project.wedding, project.fieldMappings, project.events, project.mainFilePath, selectMode, token]);

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ wis: token, action: "select-mode", value: selectMode }, "*");
  }, [selectMode, revision, token]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { wis?: string; type?: string; selector?: string; text?: string } | null;
      if (!data || data.wis !== token || data.type !== "wis:selection" || !data.selector || !pickKey) return;
      beginEdit(`mapping-${pickKey}`);
      const key = pickKey;
      setProject((previous) => ({ ...previous, fieldMappings: { ...previous.fieldMappings, [key]: data.selector as string } }));
      markDirty();
      scheduleSourcePatch();
      setPickKey(null);
      setSelectMode(false);
      setNotice(`Mapped “${data.text || key}” to ${key}`);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pickKey, token]);

  function startPicking(key: string): void {
    setPickKey(key);
    setSelectMode(true);
    setActiveTab("preview");
    setNotice(`Tap the matching text in the preview to map ${key}.`);
  }

  function updateField(key: string, value: string): void {
    beginEdit(`field-${key}`);
    setProject((previous) => ({ ...previous, wedding: { ...previous.wedding, [key]: value } }));
    markDirty();
    scheduleSourcePatch();
  }

  function updateEvent(index: number, field: keyof WeddingEvent, value: string): void {
    beginEdit(`event-${index}-${field}`);
    setProject((previous) => {
      const events = previous.events.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item));
      return { ...previous, events };
    });
    markDirty();
    scheduleSourcePatch();
  }

  function addEvent(): void {
    beginEdit("add-event");
    setProject((previous) => ({ ...previous, events: [...previous.events, emptyEvent()] }));
    markDirty();
    scheduleSourcePatch();
  }

  function removeEvent(index: number): void {
    beginEdit("remove-event");
    setProject((previous) => {
      const removed = index + 1;
      const mappings: FieldMappings = {};
      for (const [key, selector] of Object.entries(previous.fieldMappings)) {
        const match = key.match(/^event\.(\d+)\.(.+)$/);
        if (!match) {
          mappings[key] = selector;
          continue;
        }
        const number = Number(match[1]);
        if (number === removed) continue;
        mappings[`event.${number > removed ? number - 1 : number}.${match[2]}`] = selector;
      }
      return { ...previous, events: previous.events.filter((_, itemIndex) => itemIndex !== index), fieldMappings: mappings };
    });
    markDirty();
    scheduleSourcePatch();
  }

  function updateCode(path: string, value: string): void {
    beginEdit(`code-${path}`);
    setTexts((previous) => ({ ...previous, [path]: value }));
    scheduleFileSave(path);
  }

  async function uploadFile(file: File, targetPath?: string): Promise<{ path: string; url: string; file: ProjectFile } | null> {
    if (file.size > MAX_ASSET_BYTES) {
      setNotice(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB; the per-file limit is ${MAX_ASSET_BYTES / 1024 / 1024} MB.`);
      return null;
    }
    const path = targetPath ?? `assets/${Date.now()}-${safeAssetName(file.name)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await uploadProjectFile(projectRef.current.id, {
      path,
      name: file.name,
      kind: detectFileKind(path),
      mimeType: file.type || mimeForPath(path),
      size: bytes.byteLength,
      bytes,
      isAsset: !TEXT_KINDS.has(detectFileKind(path)),
    });
    setFileUrls((previous) => ({ ...previous, [path]: uploaded.url }));
    if (TEXT_KINDS.has(uploaded.file.kind)) {
      setTexts((previous) => ({ ...previous, [path]: new TextDecoder("utf-8", { fatal: false }).decode(bytes) }));
    }
    return { path, url: uploaded.url, file: uploaded.file };
  }

  async function uploadMedia(file: File): Promise<void> {
    beginEdit(`upload-${file.name}`);
    setBusy(true);
    setNotice(`Uploading ${file.name}…`);
    try {
      const uploaded = await uploadFile(file);
      if (!uploaded) return;
      setProject((previous) => ({ ...previous, files: [...previous.files.filter((item) => item.path !== uploaded.path), uploaded.file] }));
      markDirty();
      setNotice(`${file.name} uploaded to this project.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadCodeFile(file: File): Promise<void> {
    beginEdit(`upload-code-${file.name}`);
    setBusy(true);
    setNotice(`Uploading ${file.name}…`);
    try {
      const uploaded = await uploadFile(file, `code/${safeAssetName(file.name)}`);
      if (!uploaded) return;
      setProject((previous) => ({ ...previous, files: [...previous.files.filter((item) => item.path !== uploaded.path), uploaded.file] }));
      markDirty();
      setNotice(`${file.name} is ready to edit.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeAsset(path: string): Promise<void> {
    beginEdit(`remove-${path}`);
    setBusy(true);
    try {
      await deleteProjectFile(projectRef.current.id, path);
      setProject((previous) => ({ ...previous, files: previous.files.filter((file) => file.path !== path) }));
      setTexts((previous) => {
        const next = { ...previous };
        delete next[path];
        return next;
      });
      markDirty();
      setNotice("File removed.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Could not remove file");
    } finally {
      setBusy(false);
    }
  }

  function useMedia(field: string, url: string): void {
    beginEdit(`use-${field}`);
    setProject((previous) => ({ ...previous, wedding: { ...previous.wedding, [field]: url } }));
    markDirty();
    scheduleSourcePatch();
    setNotice(`${field} updated.`);
  }

  async function applyImport(result: ImportResult): Promise<void> {
    beginEdit("import");
    setBusy(true);
    setNotice("Uploading imported files…");
    try {
      const files: ProjectFile[] = [];
      const urls: Record<string, string> = {};
      const importedTexts: Record<string, string> = {};
      for (let index = 0; index < result.files.length; index += 1) {
        const file = result.files[index];
        setNotice(`Uploading ${file.name} (${index + 1}/${result.files.length})…`);
        const uploaded = await uploadProjectFile(projectRef.current.id, file);
        files.push(uploaded.file);
        urls[file.path] = uploaded.url;
        if (file.text != null) importedTexts[file.path] = file.text;
      }

      const mappings: FieldMappings = { ...projectRef.current.fieldMappings };
      const wedding: WeddingDetails = { ...projectRef.current.wedding };
      const events: WeddingEvent[] = projectRef.current.events.length ? projectRef.current.events.map((event) => ({ ...event })) : [];
      for (const field of result.fields) {
        if (!mappings[field.key]) mappings[field.key] = field.selector;
        const eventMatch = field.key.match(/^event\.(\d+)\.(.+)$/);
        if (eventMatch) {
          const index = Number(eventMatch[1]) - 1;
          while (events.length <= index) events.push(emptyEvent());
          const key = eventMatch[2] as keyof WeddingEvent;
          if (!events[index][key]) (events[index] as unknown as Record<string, string>)[key] = field.text;
        } else if (!URL_FIELDS.has(field.key) && field.text && field.text.length <= 300 && !wedding[field.key]) {
          wedding[field.key] = field.text;
        }
      }

      const payload = {
        name: projectRef.current.name,
        wedding,
        events,
        fieldMappings: mappings,
        files,
        mainFilePath: result.mainFilePath,
      };
      const response = await apiFetch<{ project: ProjectRecord }>(`/api/projects/${projectRef.current.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setProject(response.project);
      projectRef.current = response.project;
      setTexts((previous) => ({ ...previous, ...importedTexts, [result.mainFilePath]: result.html }));
      setFileUrls((previous) => ({ ...previous, ...urls }));
      setSaveState("saved");
      setNotice(`Imported ${files.length} file(s) and detected ${result.fields.length} field(s).`);
      setActiveTab("content");
      router.refresh();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Import failed");
      setSaveState("error");
    } finally {
      setBusy(false);
    }
  }

  function restore(snapshotToRestore: Snapshot, label: string): void {
    setProject(snapshotToRestore.project);
    setTexts(snapshotToRestore.texts);
    projectRef.current = snapshotToRestore.project;
    textsRef.current = snapshotToRestore.texts;
    setNotice(label);
    persistAll();
  }

  function undo(): void {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    history.future.push(snapshot());
    setHistoryTick((value) => value + 1);
    restore(previous, "Change undone.");
  }

  function redo(): void {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    history.past.push(snapshot());
    setHistoryTick((value) => value + 1);
    restore(next, "Change redone.");
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyTick]);

  async function publish(publishNow: boolean): Promise<void> {
    setPublishError("");
    setBusy(true);
    try {
      const result = await apiFetch<{ project: ProjectRecord }>(`/api/projects/${project.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ publish: publishNow, slug: publishNow ? slugInput : undefined }),
      });
      setProject(result.project);
      setSlugInput(result.project.slug ?? slugInput);
      setPublishOpen(false);
      setNotice(publishNow ? `Published at ${result.project.publishedUrl}` : "Website unpublished.");
      router.refresh();
    } catch (caught) {
      setPublishError(caught instanceof Error ? caught.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveAsTemplate(): Promise<void> {
    if (!templateName.trim()) return;
    setBusy(true);
    try {
      await apiFetch("/api/templates", {
        method: "POST",
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim(),
          sourceProjectId: project.id,
        }),
      });
      setTemplateOpen(false);
      setTemplateDescription("");
      setNotice(`Saved “${templateName.trim()}” as a reusable template.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Could not save template");
    } finally {
      setBusy(false);
    }
  }

  async function exportZip(): Promise<void> {
    setBusy(true);
    setExportProgress("Preparing project files…");
    try {
      const zip = new JSZip();
      for (let index = 0; index < project.files.length; index += 1) {
        const file = project.files[index];
        setExportProgress(`Adding ${file.name} (${index + 1}/${project.files.length})…`);
        if (isTextFile(file)) {
          zip.file(file.path, texts[file.path] ?? "");
        } else {
          const response = await fetch(urlFor(project.id, file.path));
          if (!response.ok) throw new Error(`Could not read ${file.path}`);
          zip.file(file.path, await response.arrayBuffer());
        }
      }
      zip.file(
        "project.json",
        JSON.stringify(
          { name: project.name, wedding: project.wedding, events: project.events, fieldMappings: project.fieldMappings, mainFilePath: project.mainFilePath },
          null,
          2,
        ),
      );
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 4 } });
      downloadBlob(blob, `${slugify(project.name)}-project.zip`);
      setNotice("Project ZIP downloaded.");
      setExportOpen(false);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Export failed");
    } finally {
      setBusy(false);
      setExportProgress("");
    }
  }

  async function exportHtml(): Promise<void> {
    setBusy(true);
    setExportProgress("Inlining images and scripts…");
    try {
      const html = await buildStandaloneHtml({
        html: source,
        mainFilePath: project.mainFilePath,
        files: project.files,
        texts,
        details: project.wedding,
        mappings: project.fieldMappings,
        events: project.events,
        fetchAsset: async (path) => {
          const response = await fetch(urlFor(project.id, path));
          return response.ok ? response.arrayBuffer() : null;
        },
      });
      downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${slugify(project.name)}.html`);
      setNotice("Standalone HTML downloaded.");
      setExportOpen(false);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Export failed");
    } finally {
      setBusy(false);
      setExportProgress("");
    }
  }

  const saveLabel: Record<SaveState, string> = {
    saved: "All changes saved",
    dirty: "Unsaved changes",
    saving: "Saving…",
    error: "Save failed — check message",
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#f4e9e5_0%,transparent_40%)]">
      <header className="sticky top-0 z-30 border-b border-black/8 bg-ivory/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href={isOwner ? "/owner/projects" : "/dashboard"} className="grid size-10 shrink-0 place-items-center rounded-xl border border-black/10 bg-white" aria-label="Back to projects">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl text-plum sm:text-2xl">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-black/50">
              {saveState === "saving" || saveState === "dirty" ? <Loader2 className="animate-spin" size={12} /> : saveState === "error" ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
              {saveLabel[saveState]} · {(sourceSize / 1024 / 1024).toFixed(1)} MB source · {project.files.length} files
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="ws-btn-ghost min-h-10 px-2.5" onClick={undo} disabled={!historyRef.current.past.length} title="Undo (Ctrl/Cmd+Z)"><Undo2 size={16} /><span className="hidden sm:inline">Undo</span></button>
            <button className="ws-btn-ghost min-h-10 px-2.5" onClick={redo} disabled={!historyRef.current.future.length} title="Redo (Ctrl/Cmd+Shift+Z)"><Redo2 size={16} /><span className="hidden sm:inline">Redo</span></button>
            <button className="ws-btn-ghost min-h-10 px-3" onClick={() => setExportOpen(true)}><Download size={16} /> Export</button>
            {isOwner && (
              <button className="ws-btn-ghost min-h-10 px-3" disabled={!project.files.length} onClick={() => { setTemplateName(`${project.name} — Template`); setTemplateOpen(true); }} title="Reuse this website for future customers">
                <BookmarkPlus size={16} /> <span className="hidden sm:inline">Save as template</span>
              </button>
            )}
            {isOwner && (
              <button className="ws-btn-primary min-h-10 px-3" onClick={() => { setSlugInput(project.slug ?? slugify(project.name)); setPublishError(""); setPublishOpen(true); }}>
                <Globe2 size={16} /> {project.status === "published" ? "Manage site" : "Publish"}
              </button>
            )}
          </div>
        </div>
        <nav className="ws-scroll overflow-x-auto border-t border-black/8 bg-white/70">
          <div className="mx-auto flex max-w-[1600px] min-w-max gap-1 px-4 sm:px-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-12 items-center gap-2 border-b-2 px-3.5 text-sm font-medium ${activeTab === tab.id ? "border-plum text-plum" : "border-transparent text-black/55 hover:text-plum"}`}
              >
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {notice && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-plum/15 bg-white px-4 py-3 text-sm text-plum shadow-sm">
            <CheckCircle2 className="mt-0.5 shrink-0" size={15} />
            <span className="flex-1">{notice}</span>
            <button className="text-black/40 hover:text-plum" onClick={() => setNotice("")} aria-label="Dismiss message">×</button>
          </div>
        )}
        {pickKey && (
          <div className="mb-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-plum-deep">
            Selecting an element for <strong>{pickKey}</strong>. Tap the matching text in the preview, or <button className="font-semibold underline" onClick={() => { setPickKey(null); setSelectMode(false); }}>cancel</button>.
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <section className={`${activeTab === "preview" ? "hidden lg:block" : "block"}`}>
            <div className="ws-card min-h-[560px] p-4 sm:p-5">
              {activeTab === "content" && (
                <ContentPanel details={project.wedding} mappings={project.fieldMappings} onChange={updateField} onPick={startPicking} />
              )}
              {activeTab === "events" && (
                <EventsPanel
                  events={project.events}
                  mappings={project.fieldMappings}
                  onChange={updateEvent}
                  onAdd={addEvent}
                  onRemove={removeEvent}
                  onPick={startPicking}
                />
              )}
              {activeTab === "media" && (
                <MediaPanel
                  projectId={project.id}
                  assets={assets}
                  details={project.wedding}
                  busy={busy}
                  onUpload={(file) => void uploadMedia(file)}
                  onUse={useMedia}
                  onRemove={(path) => void removeAsset(path)}
                />
              )}
              {activeTab === "code" && (
                <CodePanel files={project.files} texts={texts} busy={busy} onEdit={updateCode} onUpload={(file) => void uploadCodeFile(file)} />
              )}
              {activeTab === "import" && <ImportPanel onApply={applyImport} busy={busy} />}
              {activeTab === "preview" && (
                <p className="p-6 text-center text-sm text-black/50">The live preview is shown alongside on larger screens.</p>
              )}
            </div>
          </section>

          <section className={`${activeTab === "preview" ? "block" : "hidden lg:block"} lg:sticky lg:top-[152px] lg:self-start`}>
            <PreviewPane
              srcDoc={previewDoc}
              device={device}
              selectMode={selectMode}
              revision={revision}
              frameRef={frameRef}
              onFrameLoad={() => frameRef.current?.contentWindow?.postMessage({ wis: token, action: "select-mode", value: selectMode }, "*")}
              onDevice={setDevice}
              onSelectMode={() => { setPickKey(null); setSelectMode(!selectMode); }}
              onRefresh={() => setRevision((value) => value + 1)}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-black/45">
              <span>Preview is sandboxed. Scripts cannot access the studio.</span>
              {project.publishedUrl && <a className="font-semibold text-plum underline" href={project.publishedUrl} target="_blank" rel="noreferrer">Open live site ↗</a>}
            </div>
          </section>
        </div>
      </main>

      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title={project.status === "published" ? "Published website" : "Publish invitation"}>
        <div className="space-y-4">
          {project.status === "published" && project.publishedUrl && (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              Live at <a className="font-semibold underline" href={project.publishedUrl} target="_blank" rel="noreferrer">{project.publishedUrl}</a>
            </div>
          )}
          <label className="block">
            <span className="ws-label">Website address</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-black/45">/w/</span>
              <input className="ws-input" value={slugInput} onChange={(event) => setSlugInput(event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))} disabled={busy} />
            </div>
          </label>
          {publishError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{publishError}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="ws-btn-primary flex-1" disabled={busy} onClick={() => void publish(true)}><Globe2 size={16} /> {project.status === "published" ? "Update site" : "Publish now"}</button>
            {project.status === "published" && <button className="ws-btn-ghost" disabled={busy} onClick={() => void publish(false)}>Unpublish</button>}
          </div>
        </div>
      </Modal>

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Export invitation">
        <div className="space-y-3">
          <button className="ws-btn-primary w-full justify-start" disabled={busy} onClick={() => void exportZip()}>
            <Download size={17} /> Project ZIP — all source files, media and data
          </button>
          <button className="ws-btn-ghost w-full justify-start" disabled={busy} onClick={() => void exportHtml()}>
            <Code2 size={17} /> Single HTML file — every asset inlined
          </button>
          <p className="text-xs text-black/50">
            Large templates may take a little longer. Nothing is sent to a third party; exports are generated in this browser.
          </p>
          {exportProgress && <p className="flex items-center gap-2 text-sm text-plum"><Loader2 className="animate-spin" size={15} /> {exportProgress}</p>}
        </div>
      </Modal>

      <Modal open={templateOpen} onClose={() => setTemplateOpen(false)} title="Save as reusable template">
        <div className="space-y-4">
          <label className="block">
            <span className="ws-label">Template name</span>
            <input className="ws-input" value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
          </label>
          <label className="block">
            <span className="ws-label">Description</span>
            <textarea className="ws-input min-h-24" value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} placeholder="e.g. Royal purple Indian wedding" />
          </label>
          <p className="text-xs text-black/50">All {project.files.length} source files, field mappings and events will be copied when this template is used for a new project.</p>
          <button className="ws-btn-primary w-full" disabled={busy || !templateName.trim()} onClick={() => void saveAsTemplate()}>
            <BookmarkPlus size={16} /> Save template
          </button>
        </div>
      </Modal>
    </div>
  );
}
