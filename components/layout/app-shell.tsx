"use client";
import { usePathname } from "next/navigation";
import { Header } from "./header";
import { Footer } from "./footer";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { isExperience, routeExperience } from "@/lib/auth/experience";
export function AppShell({
  viewer,
  children,
}: {
  viewer?: { name: string; experience?: string | null };
  children: React.ReactNode;
}) {
  const path = usePathname();
  if (path.startsWith("/invite/"))
    return (
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
    );
  const workspace =
    !!routeExperience(path) && viewer && isExperience(viewer.experience);
  if (workspace)
    return (
      <div className="workspace-shell min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <WorkspaceSidebar
          key={path}
          name={viewer.name}
          experience={viewer.experience as "job-seeker" | "enterprise"}
        />
        <main id="main-content" tabIndex={-1} className="min-w-0">
          {children}
        </main>
      </div>
    );
  return (
    <>
      <Header viewer={viewer} />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      {path !== "/auth" && !path.startsWith("/auth/") && <Footer />}
    </>
  );
}
