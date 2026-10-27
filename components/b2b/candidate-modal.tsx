"use client";
import { Dialog } from "@/components/ui/dialog";
export function CandidateModal({
  title,
  children,
  onClose,
  busy = false,
  size = "lg",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  return (
    <Dialog title={title} busy={busy} onClose={onClose} size={size}>
      {children}
    </Dialog>
  );
}
