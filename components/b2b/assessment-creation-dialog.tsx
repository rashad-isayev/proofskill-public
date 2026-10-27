"use client";
import { useState } from "react";
import type { Assessment } from "@/lib/contracts";
import { Dialog } from "@/components/ui/dialog";
import { CreateAssessment } from "./create-assessment";
export function AssessmentCreationDialog({
  open,
  from,
  onClose,
  onSaved,
}: {
  open: boolean;
  from?: string;
  onClose: () => void;
  onSaved: (assessment: Assessment) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      title={from ? "Edit assessment" : "Create assessment"}
      busy={busy}
      onClose={onClose}
      closeLabel="Close assessment dialog"
      size="xl"
      bare
    >
      <CreateAssessment
        from={from}
        embedded
        onSaved={onSaved}
        onBusyChange={setBusy}
      />
    </Dialog>
  );
}
