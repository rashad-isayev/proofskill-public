"use client";

import { useLayoutEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

// Native modal semantics provide keyboard trapping and restore the trigger's focus.
export function Dialog({
  open = true,
  title,
  children,
  busy = false,
  onClose,
  closeLabel = "Close dialog",
  size = "lg",
  bare = false,
}: {
  open?: boolean;
  title: string;
  children: React.ReactNode;
  busy?: boolean;
  onClose: () => void;
  closeLabel?: string;
  size?: "sm" | "md" | "lg" | "xl";
  bare?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open) {
      dialog.close();
      return;
    }
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      className={cn(
        "ui-dialog m-auto overflow-y-auto overscroll-contain bg-background p-0 text-foreground",
        {
          "max-w-md": size === "sm",
          "max-w-2xl": size === "md",
          "max-w-4xl": size === "lg",
          "max-w-6xl": size === "xl",
        },
      )}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="ui-dialog-header sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-background">
        <h2
          id={titleId}
          className="min-w-0 break-words text-lg font-semibold tracking-tight"
        >
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={closeLabel}
          disabled={busy}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </Button>
      </header>
      <div className={bare ? undefined : "ui-dialog-body"}>{children}</div>
    </dialog>
  );
}
