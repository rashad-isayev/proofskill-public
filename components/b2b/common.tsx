"use client";
import Link from "next/link";
import { ArrowLeft, CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
export function WorkspaceHeading({
  title,
  section,
  description,
  back,
  actions,
}: {
  title: React.ReactNode;
  section: string;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-border pb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-5 inline-flex min-h-9 items-center gap-2 rounded-lg text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <p className="text-xs text-muted-foreground">{section}</p>
      <div className="mt-3 flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex max-w-full shrink-0 flex-wrap gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
export function RecordStatus({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const color = ["selected", "completed", "reviewed", "published"].includes(
    status,
  )
    ? "bg-success/10 text-success"
    : ["rejected", "expired", "closed"].includes(status)
      ? "bg-destructive/10 text-destructive"
      : status === "in-progress"
        ? "bg-primary/10 text-primary"
        : ["follow-up-required", "deferred", "archived"].includes(status)
          ? "bg-warning/10 text-warning"
          : "bg-secondary text-muted-foreground";
  return (
    <span
      data-slot="status"
      className={
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium " +
        color
      }
    >
      <span
        className="size-1.5 shrink-0 rounded-full bg-current"
        aria-hidden="true"
      />
      <span>
        {label ??
          (status.charAt(0).toUpperCase() + status.slice(1)).replaceAll(
            "-",
            " ",
          )}
      </span>
    </span>
  );
}
export function Failure({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="my-5 flex flex-wrap items-center gap-3 rounded-xl bg-warning/10 p-4 text-sm leading-6 text-warning"
    >
      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{message}</span>
      {retry && (
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={retry}
        >
          Retry
        </Button>
      )}
    </div>
  );
}
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p
      role="status"
      className="my-8 flex items-center gap-2.5 text-sm text-muted-foreground"
    >
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </p>
  );
}
export function Demo({ demo }: { demo: boolean }) {
  return demo ? (
    <span className="inline-flex rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
      Demo
    </span>
  ) : null;
}
