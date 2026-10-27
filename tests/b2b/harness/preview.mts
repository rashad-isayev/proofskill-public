// Isolated UI preview: HR records are read-only; monitoring acknowledgments are simulated. Never imported into the Next.js application.
import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import { candidate, secondCandidate } from "../candidate-fixtures";
import {
  assessment,
  invite,
  report,
  candidate as simulationCandidate,
} from "../fixtures";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { readFileSync, existsSync, readdirSync } from "node:fs";
const base = process.cwd();
const bundle = await build({
  entryPoints: [resolve(base, "tests/b2b/harness/entry.tsx")],
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [
    {
      name: "test-next-stubs",
      setup(build) {
        build.onResolve({ filter: /^@\/components\/auth\/sign-out$/ }, () => ({
          path: resolve(base, "tests/b2b/harness/preview-sign-out.tsx"),
        }));
        build.onResolve({ filter: /^next\/(link|navigation)$/ }, (args) => ({
          path: resolve(
            base,
            "tests/b2b/harness/" +
              (args.path.endsWith("link") ? "link.tsx" : "navigation.ts"),
          ),
        }));
      },
    },
  ],
});
function cssFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? cssFiles(resolve(dir, e.name))
      : e.name.endsWith(".css")
        ? [resolve(dir, e.name)]
        : [],
  );
}
const styles = cssFiles(resolve(base, ".next/static"))
  .map((p) => readFileSync(p, "utf8"))
  .join("\n");
// Preview-only, per-browser fixture counters. Never persisted or used by the Next.js app.
const monitoringStates = new Map<
  string,
  {
    fullscreenWarnings: number;
    disqualified: boolean;
    events: Set<string>;
    session: ReturnType<typeof simulationCandidate> | null;
  }
>();
const server = createServer(async (req, res) => {
  const existing = /(?:^|; )proofskill_preview=([a-f0-9-]{36})(?:;|$)/.exec(
    req.headers.cookie || "",
  )?.[1];
  const key = existing || randomUUID();
  if (!existing)
    res.setHeader(
      "Set-Cookie",
      "proofskill_preview=" + key + "; Path=/; HttpOnly; SameSite=Strict",
    );
  if (!monitoringStates.has(key))
    monitoringStates.set(key, {
      fullscreenWarnings: 0,
      disqualified: false,
      events: new Set(),
      session: null,
    });
  const state = monitoringStates.get(key)!;
  const publicState = () => ({
    fullscreenWarnings: state.fullscreenWarnings,
    disqualified: state.disqualified,
  });
  if (req.url === "/") {
    res.writeHead(302, { Location: "http://localhost:3000" });
    res.end();
  } else if (req.url === "/bundle.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle.outputFiles[0].text);
  } else if (req.url === "/styles.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(styles);
  } else if (req.url?.startsWith("/api/")) {
    const path = new URL(req.url, "http://localhost:3201").pathname;
    const secondInvite = {
      ...invite,
      id: "i2",
      candidateName: "Demo Sam",
      candidateEmail: "sam@example.test",
      reportId: "r2",
      status: "reviewed",
    };
    const secondReport = {
      ...report,
      id: "r2",
      candidateName: "Demo Sam",
      reviewed: true,
      humanDecision: "hold",
    };
    let payload;
    const monitoringPolicy = {
      version: 1,
      enabled: true,
      restrictClipboard: true,
      notice:
        "Fictional monitoring preview: camera, Entire Screen capture and fullscreen are required. Three fullscreen exits close this attempt. API responses and temporary warning counters are simulated; no video is recorded or uploaded.",
    };
    if (
      req.method === "POST" &&
      path === "/api/invites/private-token/monitoring/ready"
    )
      payload = { saved: true, state: publicState() };
    if (
      req.method === "POST" &&
      path === "/api/invites/private-token/monitoring/consent"
    )
      payload = { saved: true };
    if (
      req.method === "POST" &&
      path === "/api/simulations/s1/monitoring/events"
    ) {
      try {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 65536) throw new Error("Oversized fixture request");
        }
        const events = JSON.parse(raw).events;
        if (!Array.isArray(events) || events.length > 30)
          throw new Error("Invalid fixture events");
        for (const event of events)
          if (typeof event.id === "string" && !state.events.has(event.id)) {
            state.events.add(event.id);
            if (event.kind === "fullscreen-exit")
              state.fullscreenWarnings = Math.min(
                3,
                state.fullscreenWarnings + 1,
              );
          }
        state.disqualified = state.fullscreenWarnings >= 3;
        payload = { saved: true, state: publicState() };
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: { message: "Invalid preview fixture request" },
          }),
        );
        return;
      }
    }
    if (
      req.method === "POST" &&
      path === "/api/simulations/start" &&
      !state.disqualified
    ) {
      state.session ||= simulationCandidate();
      payload = { session: state.session };
    }

    if (req.method === "GET") {
      if (path === "/api/invites/private-token")
        payload = {
          roleTitle: assessment.blueprint.roleTitle,
          durationMinutes: 15,
          demo: true,
          status: state.session ? "in-progress" : "invited",
          sessionId: state.session ? "s1" : null,
        };
      else if (path === "/api/simulations/s1" && state.session)
        payload = { session: state.session };
      else if (path === "/api/invites/private-token/monitoring")
        payload = { policy: monitoringPolicy, state: publicState() };
      else if (path === "/api/assessments/a1/monitoring")
        payload = { policy: monitoringPolicy };
      else if (path === "/api/dashboard")
        payload = {
          counts: {
            activePositions: 1,
            publishedAssessments: 1,
            invitedCandidates: 2,
            completedSimulations: 2,
            awaitingReview: 1,
          },
          activity: [
            {
              id: "preview1",
              title: "Demo assessment published",
              createdAt: assessment.createdAt,
              demo: true,
              assessmentId: assessment.id,
            },
            {
              id: "preview2",
              title: "Two fictional candidate reports available",
              createdAt: report.createdAt,
              demo: true,
              assessmentId: assessment.id,
            },
          ],
          demo: true,
        };
      else if (path === "/api/candidates")
        payload = { candidates: [candidate, secondCandidate] };
      else if (path === "/api/assessments")
        payload = { assessments: [assessment] };
      else if (path === "/api/assessments/a1")
        payload = { assessment, invites: [invite, secondInvite] };
      else if (path === "/api/reports/r1") payload = { report };
      else if (path === "/api/reports/r2") payload = { report: secondReport };
    }
    res.writeHead(payload ? 200 : 501, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(
      JSON.stringify(
        payload || {
          error: {
            message:
              "This is a read-only frontend preview. Live generation, invitations, and saving require the configured backend and database.",
          },
        },
      ),
    );
  } else {
    const banner = req.url?.startsWith("/monitoring-")
      ? "Monitoring UI preview · Temporary fictional warning counts · No video recorded or uploaded"
      : "UI preview · Fictional Demo data · Read-only · No login required";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body data-preview="true"><div class="border-b border-border bg-secondary px-4 py-2 text-center text-[11px] text-muted-foreground">' +
        banner +
        '</div><div id="root"></div><script src="/bundle.js"></script></body></html>',
    );
  }
});
server.listen(3201, "127.0.0.1", () =>
  console.log("Read-only frontend preview: http://localhost:3201/enterprise"),
);
