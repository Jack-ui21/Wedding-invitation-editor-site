"use client";

import Link from "next/link";
import { ExternalLink, Heart, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ProjectRecord, SessionUser } from "@/lib/data/types";
import { Shell } from "@/components/Shell";
import { EmptyState, StatusBadge } from "@/components/ui";

export function CustomerDashboard({ user, projects }: { user: SessionUser; projects: ProjectRecord[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => projects.filter((project) => project.name.toLowerCase().includes(query.trim().toLowerCase())), [projects, query]);

  return (
    <Shell user={user} title="My invitations" subtitle="Your wedding websites and their current status.">
      <div className="relative mb-6 max-w-md">
        <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-black/35" size={17} />
        <input className="ws-input pl-10" placeholder="Search my projects…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title={projects.length ? "No matching projects" : "No invitations yet"}
          detail={projects.length ? "Try another search." : "Your studio will share a project with you once your invitation is ready to customise."}
          action={<span className="text-plum"><Heart size={22} /></span>}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <li key={project.id} className="ws-card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg text-plum">{project.name}</h2>
                <StatusBadge status={project.status} />
              </div>
              <p className="mt-3 text-xs text-black/50">Last updated {new Date(project.updatedAt).toLocaleString()}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link className="ws-btn-primary" href={`/projects/${project.id}/edit`}>Edit details</Link>
                <Link className="ws-btn-ghost" href={`/projects/${project.id}/edit?tab=preview`}><ExternalLink size={15} /> Preview</Link>
                {project.publishedUrl && <a className="ws-btn-ghost" href={project.publishedUrl} target="_blank" rel="noreferrer">Live website</a>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
