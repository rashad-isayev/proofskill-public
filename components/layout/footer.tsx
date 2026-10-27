import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/layout/logo";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="page-container flex flex-col justify-between gap-5 py-8 sm:flex-row sm:items-center">
        <Logo />
        <p className="text-xs text-muted-foreground">
          Evidence over assumptions. Human judgment always matters.
        </p>
        <Link
          href="/how-it-works"
          className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm text-muted-foreground hover:text-foreground"
        >
          How it works <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </footer>
  );
}
