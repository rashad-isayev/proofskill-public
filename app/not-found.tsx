import Link from "next/link";
import { ArrowLeft, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="page-container flex min-h-[65vh] flex-col items-center justify-center text-center">
      <ScanSearch className="mb-6 size-10 text-primary" />
      <p className="eyebrow text-primary">404 / Not found</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        This page isn’t here.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        The link may be incorrect or the page has been retired.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">
          <ArrowLeft /> Back to ProofSkill
        </Link>
      </Button>
    </div>
  );
}
