"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isExperience, routeExperience } from "@/lib/auth/experience";

// Recheck session on return from browser history, focus, and logout in another tab.
export function SessionMonitor({
  userId,
  children,
}: {
  userId?: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [unavailable, setUnavailable] = useState(false);
  const protectedPage = !!routeExperience(path);
  useEffect(() => {
    if (!protectedPage || !userId) return;
    let active = true;
    let checking = false;
    async function check() {
      if (checking || !active) return;
      checking = true;
      try {
        const response = await fetch("/api/auth/get-session", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Session unavailable");
        const session = await response.json();
        if (!active) return;
        if (
          !session ||
          session.user.id !== userId ||
          !isExperience(session.session.experience)
        ) {
          window.location.replace("/auth");
          return;
        }
        const required = routeExperience(path);
        if (required !== "either" && required !== session.session.experience) {
          window.location.replace("/auth?switch=1");
          return;
        }
        setUnavailable(false);
      } catch {
        if (active) setUnavailable(true);
      } finally {
        checking = false;
      }
    }
    const timer = window.setInterval(check, 30000);
    const channel = new BroadcastChannel("proofskill:auth");
    channel.addEventListener("message", check);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    return () => {
      active = false;
      window.clearInterval(timer);
      channel.close();
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
    };
  }, [path, protectedPage, userId]);
  if (unavailable && protectedPage)
    return (
      <div className="page-container py-20">
        <h1 className="text-2xl font-semibold">
          Your session could not be checked.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Check your connection, then sign in again to continue. Work saved to
          your workspace is kept.
        </p>
        <a href="/auth" className="mt-6 inline-block text-primary">
          Return to sign in
        </a>
      </div>
    );
  return children;
}
