import { ViewerProvider } from "@/components/auth/viewer-provider";
import { isExperience } from "@/lib/auth/experience";
import { currentSession } from "@/lib/auth/server";
import { SessionMonitor } from "@/components/auth/session-monitor";
import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ProofSkill — See how candidates actually work.",
    template: "%s | ProofSkill",
  },
  description:
    "Create adaptive workplace assessments and review candidate evidence with independent human judgment.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let session = null;
  try {
    session = await currentSession();
  } catch {
    /* Protected routes handle auth failures without exposing content. */
  }
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body
        data-account-scope={session?.user.id}
        className="flex min-h-screen flex-col"
      >
        <ViewerProvider
          experience={
            isExperience(session?.session.experience)
              ? session.session.experience
              : null
          }
        >
          <a
            href="#main-content"
            className="sr-only z-50 rounded-lg bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Skip to content
          </a>
          <AppShell
            viewer={
              session
                ? {
                    name: session.user.name,
                    experience: session.session.experience,
                  }
                : undefined
            }
          >
            <SessionMonitor userId={session?.user.id}>
              {children}
            </SessionMonitor>
          </AppShell>
        </ViewerProvider>
      </body>
    </html>
  );
}
