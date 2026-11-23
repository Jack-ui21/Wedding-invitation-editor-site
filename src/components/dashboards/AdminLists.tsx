"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import type { CustomerRecord, SessionUser, TemplateRecord } from "@/lib/data/types";
import { apiFetch } from "@/lib/client-fetch";
import { Shell } from "@/components/Shell";
import { EmptyState, Field, Modal } from "@/components/ui";

export function CustomersPageClient({
  user,
  customers,
}: {
  user: SessionUser;
  customers: (CustomerRecord & { userName?: string; projectCount?: number })[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await apiFetch("/api/customers", {
        method: "POST",
        body: JSON.stringify({ name: data.get("name"), email: data.get("email"), phone: data.get("phone"), password: data.get("password") }),
      });
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add customer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell user={user} title="Customers" subtitle="Everyone who has an account in your studio." actions={<button className="ws-btn-primary" onClick={() => setOpen(true)}><UserPlus size={17} /> Add customer</button>}>
      {error && <p className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {customers.length === 0 ? <EmptyState title="No customers yet" detail="Add a customer to start creating invitation projects." /> : (
        <div className="ws-card overflow-hidden">
          <ul className="divide-y divide-black/6">
            {customers.map((customer) => (
              <li key={customer.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <span className="grid size-10 place-items-center rounded-full bg-plum/10 font-semibold text-plum">{customer.name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{customer.name}</p>
                  <p className="truncate text-xs text-black/50">{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}</p>
                </div>
                <span className="ws-badge bg-black/5 text-black/60">{customer.projectCount ?? 0} projects</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add a customer">
        <form className="space-y-4" onSubmit={create}>
          <Field label="Full name"><input className="ws-input" name="name" required minLength={2} /></Field>
          <Field label="Email"><input className="ws-input" name="email" type="email" required /></Field>
          <Field label="WhatsApp number"><input className="ws-input" name="phone" type="tel" /></Field>
          <Field label="Initial password"><input className="ws-input" name="password" type="password" required minLength={8} /></Field>
          <button className="ws-btn-primary w-full" disabled={busy}>Add customer</button>
        </form>
      </Modal>
    </Shell>
  );
}

export function TemplatesPageClient({ user, templates }: { user: SessionUser; templates: TemplateRecord[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await apiFetch("/api/templates", {
        method: "POST",
        body: JSON.stringify({ name: data.get("name"), description: data.get("description") }),
      });
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create template");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell user={user} title="Templates" subtitle="Reusable starting points for customer websites." actions={<button className="ws-btn-primary" onClick={() => setOpen(true)}><Plus size={17} /> New template</button>}>
      {error && <p className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {templates.length === 0 ? <EmptyState title="No templates saved" detail="Import a wedding website in a project, then save it as a template for future customers." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div key={template.id} className="ws-card p-5">
              <h2 className="text-lg text-plum">{template.name}</h2>
              <p className="mt-2 text-sm text-black/55">{template.description || "No description"}</p>
              <p className="mt-4 text-xs text-black/40">Added {new Date(template.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New template">
        <form className="space-y-4" onSubmit={create}>
          <Field label="Template name"><input className="ws-input" name="name" required /></Field>
          <Field label="Description"><textarea className="ws-input min-h-24" name="description" /></Field>
          <button className="ws-btn-primary w-full" disabled={busy}>Save template</button>
        </form>
      </Modal>
    </Shell>
  );
}
