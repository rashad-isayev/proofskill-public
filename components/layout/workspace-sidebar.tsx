"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  UserRound,
  ClipboardList,
  Columns2,
  ArrowUpRight,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "./logo";
import { SignOut } from "@/components/auth/sign-out";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dashboardFor, type Experience } from "@/lib/auth/experience";
export function WorkspaceSidebar({
  name,
  experience,
}: {
  name: string;
  experience: Experience;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const links = [
    {
      href: dashboardFor(experience),
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/enterprise/assessments",
      label: "Assessments",
      icon: ClipboardList,
    },
    { href: "/enterprise/candidates", label: "Candidates", icon: UserRound },
    { href: "/enterprise/reports", label: "Reports", icon: FileText },
    { href: "/enterprise/compare", label: "Compare", icon: Columns2 },
  ];
  return (
    <aside
      aria-label="Workspace sidebar"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          document
            .querySelector<HTMLButtonElement>(
              'button[aria-controls="workspace-menu"]',
            )
            ?.focus();
        }
      }}
      className="border-b border-border lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0 lg:overflow-y-auto"
      style={{ background: "var(--workspace-sidebar, var(--card))" }}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <Logo href={dashboardFor(experience)} />
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={
            open ? "Close workspace navigation" : "Open workspace navigation"
          }
          aria-expanded={open}
          aria-controls="workspace-menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      <div
        id="workspace-menu"
        className={cn(
          "px-3 pb-4 lg:flex lg:min-h-[calc(100dvh-64px)] lg:flex-col",
          open ? "flex flex-col" : "hidden",
        )}
      >
        <p className="px-3 pb-3 pt-3 text-[11px] font-medium text-muted-foreground">
          Hiring workspace
        </p>
        <nav
          aria-label="Workspace navigation"
          className="flex flex-col gap-0.5"
        >
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === dashboardFor(experience)
                ? path === href
                : path === href || path.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 min-h-11 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 space-y-3 border-t border-border px-2 pt-4 lg:mt-auto">
          <div className="flex items-center gap-2.5 px-1">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-medium"
              aria-hidden="true"
            >
              {name.trim().slice(0, 1).toUpperCase() || "U"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium" title={name}>
                {name}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Signed in
              </p>
            </div>
          </div>
          <SignOut />
          <Link
            href="/"
            className="flex items-center justify-between rounded-lg px-2 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Public website{" "}
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
