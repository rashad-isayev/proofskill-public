import Link from "next/link";
import {
  ArrowUpRight,
  Layers3,
  Fingerprint,
  FileCheck2,
  Users,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
const steps = [
  [
    "01",
    "Describe the role",
    "AI proposes four or five competencies, clear rubrics, and comparable scenario families.",
  ],
  [
    "02",
    "Invite candidates",
    "Each private link opens a realistic workplace with its own company, numbers, and evolving challenges.",
  ],
  [
    "03",
    "Review the evidence",
    "Inspect reasoning, actual responses, and uncertainty. Your team makes the hiring decision.",
  ],
];
export default function Home() {
  return (
    <>
      <section className="hero-glow relative overflow-hidden">
        <div className="page-container grid items-center gap-14 py-16 md:py-24 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="eyebrow text-muted-foreground">
              Workplace evidence for better human decisions
            </p>
            <h1 className="mt-7 text-[clamp(2.6rem,4.7vw,4.3rem)] font-semibold leading-[1.08] tracking-[-0.055em]">
              Don’t interview candidates.
              <br />
              <span className="text-foreground">
                See how they actually work.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground">
              Turn a job description into a realistic workplace assessment.
              Observe how candidates reason, use data, and navigate trade-offs.
              Review the evidence together.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/auth?next=/enterprise/assessments/new">
                  Create AI Assessment <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/how-it-works">How it works</Link>
              </Button>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Candidates join by invitation. No candidate account required.
            </p>
          </div>
          <div className="rounded-2xl bg-card p-7 md:p-9">
            <p className="eyebrow text-muted-foreground">
              The assessment workflow
            </p>
            <div className="mt-7 space-y-4">
              {[
                {
                  icon: Layers3,
                  title: "A blueprint you control",
                  body: "Competencies, weighted rubrics, and comparable scenario families.",
                },
                {
                  icon: Users,
                  title: "An adaptive workplace",
                  body: "Manager tasks, company data, and information revealed as work unfolds.",
                },
                {
                  icon: ScanLine,
                  title: "Evidence you can inspect",
                  body: "Response replay, verbatim quotes, coverage, and reviewer notes.",
                },
              ].map(({ icon: Icon, title, body }, i) => (
                <article
                  key={title}
                  className="flex gap-4 rounded-xl bg-background p-5"
                >
                  <Icon className="mt-1 size-5 shrink-0 text-foreground" />
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      0{i + 1}
                    </p>
                    <h2 className="mt-2 text-base font-semibold">{title}</h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-6 text-xs leading-6 text-muted-foreground">
              Workflow illustration. Assessment data appears after your team
              creates assessments.
            </p>
          </div>
        </div>
      </section>
      <section className="page-container py-16">
        <p className="eyebrow text-muted-foreground">From role to evidence</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">
          Practical work. Transparent review.
        </h2>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {steps.map(([number, title, body]) => (
            <article key={number} className="rounded-xl bg-card p-7">
              <span className="font-mono text-xs text-foreground">
                {number}
              </span>
              <h3 className="mt-6 text-lg font-semibold">{title}</h3>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                {body}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="page-container pb-20">
        <div className="grid gap-8 rounded-xl bg-card p-8 md:grid-cols-2 md:p-12">
          <div>
            <FileCheck2 className="size-7 text-foreground" />
            <h2 className="mt-5 text-2xl font-semibold">
              A score needs supporting work.
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Follow each judgment back to the candidate’s words. Missing
              evidence stays missing; coverage explains what was actually
              observed.
            </p>
          </div>
          <div>
            <Fingerprint className="size-7 text-foreground" />
            <h2 className="mt-5 text-2xl font-semibold">
              The decision stays with you.
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              AI assessment is advisory. Use notes and follow-up topics for an
              independent human review. Scores are not validated certifications
              or automatic hiring decisions.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
