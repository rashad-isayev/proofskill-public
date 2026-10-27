import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={href === "/" ? "ProofSkill home" : "ProofSkill dashboard"}
      className={cn(
        "inline-flex shrink-0 items-center gap-2.5 rounded-lg",
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
        <ArrowUpRight className="size-5 stroke-[2.5]" aria-hidden="true" />
      </span>
      <span className="text-lg font-semibold tracking-[-0.6px]">
        proof<span className="text-muted-foreground">skill</span>
        <span>.</span>
      </span>
    </Link>
  );
}
