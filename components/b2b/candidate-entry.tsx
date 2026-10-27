"use client";
import type { ReactNode } from "react";
import { Clock3, MessageSquare, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function CandidateEntry({
  title,
  durationMinutes,
  ready,
  pending,
  onStart,
  error,
}: {
  title: string;
  durationMinutes: number;
  ready: boolean;
  pending: boolean;
  onStart: () => void;
  error?: ReactNode;
}) {
  const instructions = (
    <>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Work through a realistic company situation with an AI manager. Use the
        available data, explain your reasoning, and respond as you would at
        work.
      </p>
      <ul className="mt-5 space-y-3 text-sm">
        <li className="flex items-start gap-3">
          <Clock3
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span>
            <strong className="font-medium">{durationMinutes} minutes</strong>{" "}
            from the moment you start.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <MessageSquare
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span>
            Up to six response turns. New information may appear as you work.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <LockKeyhole
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span>
            No account required. Return using this private invitation link.
          </span>
        </li>
      </ul>
      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        AI assessment is advisory. The hiring team reviews your work and makes
        its own decisions.
      </p>
    </>
  );
  return (
    <>
      <section
        aria-labelledby="candidate-entry-title"
        className="order-first min-w-0 px-1 py-1 lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:py-4"
      >
        <p className="eyebrow text-muted-foreground">
          Your workplace simulation
        </p>
        <h1
          id="candidate-entry-title"
          className="mt-3 text-2xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-3xl"
        >
          {title}
        </h1>
        <div className="hidden lg:block">{instructions}</div>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground lg:hidden">
          <Clock3 className="size-4" aria-hidden="true" />
          {durationMinutes} minutes · Up to six turns
        </p>
        <details className="mt-2 text-sm lg:hidden">
          <summary className="w-fit cursor-pointer rounded py-1 text-muted-foreground hover:text-foreground">
            How the assessment works
          </summary>
          {instructions}
        </details>
      </section>
      <div className="order-last min-w-0 lg:col-start-2">
        <Card className="p-4 sm:p-5">
          <Button
            className="w-full"
            disabled={pending || !ready}
            onClick={onStart}
          >
            {pending ? "Preparing your workspace…" : "Start assessment"}
          </Button>
          <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
            {ready
              ? "Your timer starts only when you begin."
              : "Complete the checks above. Your timer has not started."}
          </p>
          {error && <div className="mt-3">{error}</div>}
        </Card>
      </div>
    </>
  );
}
