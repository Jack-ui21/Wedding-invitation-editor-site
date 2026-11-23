"use client";

import { X } from "lucide-react";
import type { ProjectStatus } from "@/lib/data/types";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl text-ink">{title}</h2>
          <button className="grid size-10 place-items-center rounded-full hover:bg-black/5" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<ProjectStatus, string> = {
  draft: "bg-black/8 text-black/60",
  in_progress: "bg-amber-100 text-amber-800",
  awaiting_customer: "bg-sky-100 text-sky-800",
  ready_for_review: "bg-violet-100 text-violet-800",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-black/10 text-black/50",
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Draft",
  in_progress: "In progress",
  awaiting_customer: "Awaiting customer",
  ready_for_review: "Ready for review",
  published: "Published",
  archived: "Archived",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`ws-badge ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-white/60 px-6 py-14 text-center">
      <p className="text-lg text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-black/55">{detail}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="ws-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-black/45">{hint}</span>}
    </label>
  );
}
