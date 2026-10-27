import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
export function MarketingPage({
  audience,
  title,
  description,
  sections,
  candidate = false,
}: {
  candidate?: boolean;
  audience: string;
  title: string;
  description: string;
  sections: readonly (readonly [string, string])[];
}) {
  return (
    <div className="hero-glow">
      <section className="page-container py-20 sm:py-28">
        <p className="eyebrow text-muted-foreground">{audience}</p>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {description}
        </p>
        {candidate ? (
          <p className="mt-8 max-w-2xl rounded-xl bg-card p-5 text-sm leading-6">
            To begin, open the private invitation link sent by your hiring team.
          </p>
        ) : (
          <Button asChild className="mt-8">
            <Link href="/auth?next=/enterprise/assessments/new">
              Create AI Assessment <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        )}
        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {sections.map(([heading, body], index) => (
            <article key={heading} className="rounded-xl bg-card p-6">
              <p className="eyebrow text-muted-foreground">0{index + 1}</p>
              <h2 className="mt-5 text-lg font-semibold">{heading}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
