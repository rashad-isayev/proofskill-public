"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { SignOut } from "@/components/auth/sign-out";
import { dashboardFor, isExperience } from "@/lib/auth/experience";
import { marketingLinks } from "@/lib/marketing";
import { cn } from "@/lib/utils";

export function Header({
  viewer,
}: {
  viewer?: { name: string; experience?: string | null };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const experience =
    viewer && isExperience(viewer.experience) ? viewer.experience : null;
  const authPage = pathname === "/auth" || pathname.startsWith("/auth/");
  const links = authPage ? [] : marketingLinks;

  return (
    <header
      className="relative z-30 border-b border-border bg-background"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          document
            .querySelector<HTMLButtonElement>(
              'button[aria-controls="mobile-nav"]',
            )
            ?.focus();
        }
      }}
    >
      <div className="page-container flex h-18 items-center justify-between gap-3">
        <Logo />
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-1 lg:flex"
        >
          {links.map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-full px-4 text-sm transition-colors hover:bg-secondary hover:text-foreground",
                pathname === href
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {viewer ? (
            <>
              {!authPage && (
                <Link
                  href={
                    experience ? dashboardFor(experience) : "/auth?switch=1"
                  }
                  className="hidden text-xs text-muted-foreground hover:text-foreground lg:inline"
                >
                  Open dashboard
                </Link>
              )}
              <SignOut />
            </>
          ) : (
            !authPage && (
              <Button asChild size="sm">
                <Link href="/auth/sign-in">
                  <span className="sm:hidden">Sign in</span>
                  <span className="hidden sm:inline">
                    Open hiring workspace
                  </span>{" "}
                  <ArrowUpRight
                    aria-hidden="true"
                    className="hidden sm:block"
                  />
                </Link>
              </Button>
            )
          )}
          {!!links.length && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </Button>
          )}
        </div>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="page-container flex flex-col gap-1 pb-5 lg:hidden"
        >
          {links.map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {label}
            </Link>
          ))}
          {experience ? (
            <>
              <Button asChild>
                <Link
                  href={dashboardFor(experience)}
                  onClick={() => setOpen(false)}
                >
                  Open dashboard <ArrowUpRight />
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild>
              <Link href="/auth/sign-in" onClick={() => setOpen(false)}>
                Open hiring workspace <ArrowUpRight />
              </Link>
            </Button>
          )}
        </nav>
      )}
    </header>
  );
}
