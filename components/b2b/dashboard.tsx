"use client";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  Plus,
  ClipboardList,
  FileText,
  Users,
  ShieldCheck,
} from "lucide-react";
import { dashboardSchema } from "@/lib/contracts";
import { useResource } from "@/lib/b2b/use-resource";
import { Button } from "@/components/ui/button";
import { Demo, Failure, Loading, WorkspaceHeading } from "./common";
const metrics = [
  ["Active hiring positions", "activePositions"],
  ["Published assessments", "publishedAssessments"],
  ["Invited candidates", "invitedCandidates"],
  ["Completed simulations", "completedSimulations"],
  ["Reports awaiting review", "awaitingReview"],
] as const;
const workflow = [
  {
    title: "Create an assessment",
    description: "Define the role and review its blueprint.",
    href: "/enterprise/assessments?create=1",
    icon: ClipboardList,
  },
  {
    title: "Invite candidates",
    description: "Assign assessments and share private links.",
    href: "/enterprise/candidates",
    icon: Users,
  },
  {
    title: "Review the evidence",
    description: "Read responses and make your own decision.",
    href: "/enterprise/reports",
    icon: FileText,
  },
];
export function HRDashboard() {
  const { data, error, loading, reload } = useResource(
    "/api/dashboard",
    dashboardSchema,
  );
  return (
    <div className="workspace-shell min-h-screen bg-background">
      <div className="workspace-page page-container">
        <WorkspaceHeading
          section="Hiring workspace"
          title={<>Hiring overview {data && <Demo demo={data.demo} />}</>}
          actions={
            <Button asChild>
              <Link href="/enterprise/assessments?create=1">
                <Plus aria-hidden="true" />
                Create AI Assessment
              </Link>
            </Button>
          }
        />
        {error && <Failure message={error} retry={reload} />}
        {loading && <Loading />}
        {data && (
          <>
            <section className="mt-8" aria-label="Hiring metrics">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {metrics.map(([label, key]) => (
                  <div key={key} className={"min-w-0 rounded-xl bg-card p-5"}>
                    <dt className="min-h-10 text-xs leading-5 text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="mt-2 text-[30px] font-medium leading-none tracking-tight tabular-nums">
                      {data.counts[key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
              <section
                className="min-w-0 overflow-hidden rounded-xl bg-card"
                aria-labelledby="activity-heading"
              >
                <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
                  <h2 id="activity-heading" className="text-sm font-semibold">
                    Recent activity
                  </h2>
                  <Link
                    href="/enterprise/assessments"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    View assessments
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
                {data.activity.length ? (
                  <ol className="divide-y divide-border">
                    {[...data.activity]
                      .sort(
                        (a, b) =>
                          Date.parse(b.createdAt) - Date.parse(a.createdAt),
                      )
                      .map((a) => (
                        <li
                          key={a.id}
                          className="flex items-start gap-3 px-5 py-5"
                        >
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                            <FileText
                              className="size-3.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] leading-6">
                              {a.title} <Demo demo={a.demo} />
                            </p>
                            <time
                              dateTime={a.createdAt}
                              className="mt-1 block text-xs text-muted-foreground"
                            >
                              {new Date(a.createdAt).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </time>
                          </div>
                          {a.assessmentId && (
                            <Link
                              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                              href={
                                "/enterprise/assessments/" +
                                encodeURIComponent(a.assessmentId)
                              }
                              aria-label={"Open assessment: " + a.title}
                            >
                              <ArrowRight
                                className="size-4"
                                aria-hidden="true"
                              />
                            </Link>
                          )}
                        </li>
                      ))}
                  </ol>
                ) : (
                  <div className="flex min-h-64 flex-col items-center justify-center px-5 py-9 text-center">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-secondary">
                      <ClipboardList
                        className="size-5 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </span>
                    <h3 className="mt-4 text-sm font-medium">
                      Start with the role you’re hiring for.
                    </h3>
                    <p className="mt-2 max-w-xs text-xs leading-6 text-muted-foreground">
                      Assessment and candidate activity will appear here as your
                      team works.
                    </p>
                    <Link
                      href="/enterprise/assessments?create=1"
                      className="mt-4 flex items-center gap-1.5 text-xs font-medium text-foreground"
                    >
                      Create your first assessment{" "}
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </section>
              <section
                className="rounded-xl bg-card p-6"
                aria-labelledby="review-heading"
              >
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Human review
                </p>
                <h2
                  id="review-heading"
                  className="mt-4 text-base font-semibold tracking-tight"
                >
                  {data.counts.awaitingReview
                    ? `${data.counts.awaitingReview} ${data.counts.awaitingReview === 1 ? "report" : "reports"} ready for review`
                    : "You’re all caught up."}
                </h2>
                <p className="mt-3 text-xs leading-6 text-muted-foreground">
                  {data.counts.awaitingReview
                    ? "Inspect the responses and supporting evidence before recording your decision."
                    : "Completed candidate reports will appear in your review queue."}
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-5 w-full justify-between rounded-lg bg-transparent"
                >
                  <Link href="/enterprise/reports">
                    Open reports <ArrowRight />
                  </Link>
                </Button>
              </section>
            </div>
            <section className="mt-9" aria-labelledby="workflow-heading">
              <h2 id="workflow-heading" className="text-sm font-semibold">
                Assessment workflow
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {workflow.map(({ title, description, href, icon: Icon }) => (
                  <Link
                    key={title}
                    href={href}
                    className="group rounded-xl bg-card p-6 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center justify-between">
                      <Icon
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <ArrowRight
                        className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </div>
                    <h3 className="mt-4 text-[13px] font-medium">{title}</h3>
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">
                      {description}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
        <footer className="mt-9 flex items-start gap-2 border-t border-border pt-5 text-[11px] leading-6 text-muted-foreground">
          <ShieldCheck className="mt-1 size-3.5 shrink-0" aria-hidden="true" />
          <p>
            AI assessment is advisory. Hiring decisions are made by reviewers.
          </p>
        </footer>
      </div>
    </div>
  );
}
