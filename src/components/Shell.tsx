"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Crown, Heart, LayoutDashboard, LogOut, Menu, Settings2, Users, X } from "lucide-react";
import type { SessionUser } from "@/lib/data/types";

const OWNER_LINKS = [
  { href: "/owner", label: "Overview", icon: LayoutDashboard },
  { href: "/owner/projects", label: "Projects", icon: Settings2 },
  { href: "/owner/customers", label: "Customers", icon: Users },
];

export function Shell({
  user,
  title,
  subtitle,
  actions,
  children,
}: {
  user: SessionUser;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = user.role === "owner" ? OWNER_LINKS : [{ href: "/dashboard", label: "My invitations", icon: Heart }];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#f4e9e5_0%,transparent_40%)]">
      <header className="sticky top-0 z-30 border-b border-black/8 bg-ivory/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button className="grid size-10 place-items-center rounded-xl hover:bg-black/5 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link href={user.role === "owner" ? "/owner" : "/dashboard"} className="flex items-center gap-2 font-semibold text-plum">
            <span className="grid size-9 place-items-center rounded-xl bg-plum text-white"><Heart size={17} /></span>
            <span className="hidden sm:inline">Wedding Invitation Studio</span>
            <span className="sm:hidden">Studio</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {user.role === "owner" && <span className="ws-badge hidden bg-gold/20 text-plum-deep sm:inline-flex"><Crown size={12} className="mr-1" />Owner</span>}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{user.name}</p>
              <p className="text-xs text-black/50">{user.email}</p>
            </div>
            <button className="grid size-10 place-items-center rounded-xl border border-black/10 bg-white hover:bg-black/5" onClick={logout} aria-label="Sign out" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className={`${menuOpen ? "block" : "hidden"} border-t border-black/8 bg-white px-4 py-2 md:hidden`}>
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-plum hover:bg-plum/5">
                <link.icon size={17} /> {link.label}
              </Link>
            ))}
          </nav>
        )}
        <nav className="hidden border-t border-black/8 bg-white/60 md:block">
          <div className="mx-auto flex max-w-7xl gap-1 px-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium ${pathname === link.href ? "border-plum text-plum" : "border-transparent text-black/55 hover:text-plum"}`}
              >
                <link.icon size={16} /> {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl text-ink sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-black/55">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
