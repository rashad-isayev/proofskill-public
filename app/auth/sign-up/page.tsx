import type { Metadata } from "next";
import { AuthPageContent } from "@/components/auth/auth-page-content";

export const metadata: Metadata = { title: "Create account" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AuthPageContent mode="sign-up" searchParams={searchParams} />;
}
