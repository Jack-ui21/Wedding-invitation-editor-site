"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, FolderPlus, Plus, Search, Trash2, UserPlus } from "lucide-react";
import type { CustomerRecord, ProjectRecord, SessionUser, TemplateRecord } from "@/lib/data/types";
import { PROJECT_STATUSES } from "@/lib/data/types";
import { apiFetch } from "@/lib/client-fetch";
import { Shell } from "@/components/Shell";
import { EmptyState, Field, Modal, StatusBadge } from "@/components/ui";

interface Props {
  user: SessionUser;
  projects: ProjectRecord[];
  customers: CustomerRecord[];
  templates: TemplateRecord[];
}

export function OwnerDashboard({ user, projects, customers, templates }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [projectModal, setProjectModal] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return projects.filter((project) => {
      const customer = customers.find((item) => item.id === project.customerId);
      const matchesTerm = !term || [project.name, customer?.name ?? "", customer?.email ?? ""].some((value) => value.toLowerCase().includes(term));
      return matchesTerm && (status === "all" || project.status === status);
    });
  }, [projects, customers, query, status]);

  const stats = [
    { label: "Customers", value: customers.length },
    { label: "Projects", value: projects.length },
    { label: "Active", value: projects.filter((p) => ["in_progress", "awaiting_customer", "ready_for_review"].includes(p.status)).length },
    { label: "Published", value: projects.filter((p) => p.status === "published").length },
    { label: "Drafts", value: projects.filter((p) => p.status === "draft").length },
  ];

  async function action(label: string, run: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await run();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : label);
    } finally {
      setBusy(false);
    }
  }

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await action("Could not create project", async () => {
      const result = await apiFetch<{ project: ProjectRecord }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          customerId: data.get("customerId"),
          name: data.get("name"),
          templateId: data.get("templateId") || null,
        }),
      });
      setProjectModal(false);
      router.push(`/projects/${result.project.id}/edit`);
    });
  }

  async function createCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await action("Could not add customer", async () => {
      await apiFetch("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          password: data.get("password"),
        }),
      });
      setCustomerModal(false);
    });
  }

  return (
    <Shell
      user={user}
      title="Studio overview"
      subtitle="Everything you need to manage invitation projects at a glance."
      actions={
        <div className="flex flex-wrap gap-2">
          <button className="ws-btn-ghost" onClick={() => setCustomerModal(true)}><UserPlus size={17} /> Add customer</button>
          <button className="ws-btn-primary" onClick={() => setProjectModal(true)}><FolderPlus size={17} /> New project</button>
        </div>
      }
    >
      {error && <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((item) => (
          <div key={item.label} className="ws-card p-4 sm:p-5">
            <p className="text-xs font-medium tracking-wide text-black/50 uppercase">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold text-plum">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 ws-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-black/8 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-black/35" size={17} />
            <input className="ws-input pl-10" placeholder="Search projects or customers…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <select className="ws-input sm:w-52" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
            <option value="all">All statuses</option>
            {PROJECT_STATUSES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={projects.length ? "No matching projects" : "No projects yet"}
              detail={projects.length ? "Try a different search or status filter." : "Add a customer, then create their first invitation project."}
              action={!projects.length ? <button className="ws-btn-primary" onClick={() => setProjectModal(true)}><Plus size={16} /> New project</button> : undefined}
            />
          </div>
        ) : (
          <ul className="divide-y divide-black/6">
            {filtered.map((project) => {
              const customer = customers.find((item) => item.id === project.customerId);
              return (
                <li key={project.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/projects/${project.id}/edit`} className="font-semibold text-plum hover:underline">{project.name}</Link>
                      <StatusBadge status={project.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-black/50">
                      {customer?.name ?? "Unknown customer"} · {customer?.email ?? ""} · updated {new Date(project.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="ws-input min-h-10 w-auto py-1 text-xs"
                      value={project.status}
                      disabled={busy}
                      onChange={(event) => void action("Status update failed", async () => {
                        await apiFetch(`/api/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ status: event.target.value }) });
                      })}
                      aria-label={`Status for ${project.name}`}
                    >
                      {PROJECT_STATUSES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}
                    </select>
                    <Link className="ws-btn-ghost min-h-10 px-3" href={`/projects/${project.id}/edit`}><ExternalLink size={15} /> Open</Link>
                    <button className="ws-btn-ghost min-h-10 px-3" disabled={busy} onClick={() => void action("Duplicate failed", async () => {
                      await apiFetch(`/api/projects/${project.id}/duplicate`, { method: "POST", body: JSON.stringify({}) });
                    })}><Copy size={15} /> <span className="hidden sm:inline">Duplicate</span></button>
                    <button className="ws-btn-ghost min-h-10 px-3 text-red-700" disabled={busy} onClick={() => {
                      if (confirm(`Delete "${project.name}" and all its files? This cannot be undone.`)) {
                        void action("Delete failed", async () => {
                          await apiFetch(`/api/projects/${project.id}`, { method: "DELETE" });
                        });
                      }
                    }}><Trash2 size={15} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal open={projectModal} onClose={() => setProjectModal(false)} title="Create a project">
        <form onSubmit={createProject} className="space-y-4">
          <Field label="Project name"><input className="ws-input" name="name" required placeholder="e.g. Rahul & Priya — Wedding" /></Field>
          <Field label="Customer">
            <select className="ws-input" name="customerId" required>
              <option value="">Select a customer…</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} — {customer.email}</option>)}
            </select>
          </Field>
          <Field label="Template" hint="Optional. You can import a website after creating the project.">
            <select className="ws-input" name="templateId">
              <option value="">No template yet</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </Field>
          <button className="ws-btn-primary w-full" disabled={busy}>Create and open editor</button>
        </form>
      </Modal>

      <Modal open={customerModal} onClose={() => setCustomerModal(false)} title="Add a customer">
        <form onSubmit={createCustomer} className="space-y-4">
          <Field label="Full name"><input className="ws-input" name="name" required minLength={2} /></Field>
          <Field label="Email"><input className="ws-input" name="email" type="email" required /></Field>
          <Field label="WhatsApp number"><input className="ws-input" name="phone" type="tel" placeholder="919876543210" /></Field>
          <Field label="Initial password" hint="Share this securely with the customer."><input className="ws-input" name="password" type="password" required minLength={8} /></Field>
          <button className="ws-btn-primary w-full" disabled={busy}>Add customer</button>
        </form>
      </Modal>
    </Shell>
  );
}
