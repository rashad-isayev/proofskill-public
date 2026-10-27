import { randomUUID } from "node:crypto";
import { test, expect } from "../fixtures/auth";
import { publicBlueprint } from "../../lib/hiring/presentation";
import { demoBlueprint } from "../fixtures/hiring-data";

const origin = "http://127.0.0.1:3100";

test("security: anonymous routes fail closed even with middleware bypass headers", async ({
  playwright,
}) => {
  const client = await playwright.request.newContext({
    baseURL: origin,
    storageState: { cookies: [], origins: [] },
  });
  try {
    for (const path of [
      "/api/dashboard",
      "/api/assessments",
      "/api/candidates",
      "/api/reports/" + randomUUID(),
      "/api/recordings/" + randomUUID() + "/playback",
      "/api/future-private-route",
    ]) {
      for (const headers of [
        {},
        { "x-middleware-subrequest": "proxy:proxy:proxy:proxy:proxy" },
      ]) {
        const response = await client.get(path, {
          headers: headers as Record<string, string>,
        });
        expect(response.status(), path).toBe(401);
      }
    }
    expect((await client.get("/api/assessments/demo")).status()).toBe(404);
    expect((await client.get("/api/auth/admin/list-users")).status()).toBe(404);
    expect(
      (await client.get("/enterprise", { maxRedirects: 0 })).status(),
    ).toBe(307);
  } finally {
    await client.dispose();
  }
});

test("security: anti-framing and invitation privacy headers cover public and error responses", async ({
  playwright,
}) => {
  const client = await playwright.request.newContext({
    baseURL: origin,
    storageState: { cookies: [], origins: [] },
  });
  try {
    for (const path of [
      "/",
      "/auth/sign-in",
      "/invite/invalid",
      "/api/dashboard",
    ]) {
      const response = await client.get(path);
      expect(response.headers()["x-frame-options"]).toBe("DENY");
      expect(response.headers()["content-security-policy"]).toContain(
        "frame-ancestors 'none'",
      );
      expect(response.headers()["referrer-policy"]).toBe("no-referrer");
      expect(response.headers()["x-content-type-options"]).toBe("nosniff");
      expect(response.headers()["permissions-policy"]).toContain(
        "camera=(self)",
      );
      if (path.startsWith("/invite/")) {
        expect(response.headers()["cache-control"]).toContain("no-store");
        expect(response.headers()["x-robots-tag"]).toContain("noindex");
      }
    }
  } finally {
    await client.dispose();
  }
});

test("security: cross-origin mutations, forged bearer tokens and oversized JSON are rejected", async ({
  page,
}) => {
  const candidate = {
    name: "Synthetic boundary test",
    email: randomUUID() + "@example.test",
    position: "Test",
  };
  for (const headers of [
    {},
    { Origin: "https://attacker.invalid" },
    { Origin: "null" },
  ]) {
    expect(
      (
        await page.request.post("/api/candidates", {
          headers: headers as Record<string, string>,
          data: candidate,
        })
      ).status(),
    ).toBe(403);
  }
  expect(
    (
      await page.request.post("/api/auth/experience", {
        headers: { Origin: "https://attacker.invalid" },
        data: { experience: "enterprise" },
      })
    ).status(),
  ).toBe(403);
  const body = {
    sessionId: randomUUID(),
    message: "Synthetic response",
    requestId: randomUUID(),
  };
  expect(
    (
      await page.request.post("/api/simulations/respond", {
        headers: { Origin: origin, Authorization: "Bearer forged" },
        data: body,
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await page.request.post("/api/simulations/start", {
        headers: { Origin: origin },
        data: { token: "a".repeat(64), extra: "x".repeat(100001) },
      })
    ).status(),
  ).toBe(413);
  expect(
    (
      await page.request.post("/api/simulations/start", {
        headers: { Origin: origin, "Content-Type": "application/json" },
        data: "{",
      })
    ).status(),
  ).toBe(400);
});

test("security: second HR account and second invite cannot read or mutate the first assessment/session", async ({
  page,
  playwright,
}) => {
  const headers = { Origin: origin };
  const saved = await page.request.post("/api/assessments", {
    headers,
    data: {
      blueprint: publicBlueprint(demoBlueprint),
      status: "published",
      requestId: randomUUID(),
    },
  });
  expect(saved.ok(), await saved.text()).toBe(true);
  const { assessment } = await saved.json();
  const invite = async () => {
    const r = await page.request.post(
      `/api/assessments/${assessment.id}/invites`,
      {
        headers,
        data: {
          candidateName: "Synthetic security candidate",
          candidateEmail: randomUUID() + "@example.test",
          assessmentVersion: assessment.version,
          requestId: randomUUID(),
        },
      },
    );
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()).invite;
  };
  const first = await invite(),
    second = await invite();
  const anonymous = await playwright.request.newContext({
    baseURL: origin,
    storageState: { cookies: [], origins: [] },
  });
  const other = await playwright.request.newContext({
    baseURL: origin,
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: headers,
  });
  try {
    const started = await anonymous.post("/api/simulations/start", {
      headers,
      data: { token: first.token },
    });
    expect(started.ok(), await started.text()).toBe(true);
    const payload = await started.json();
    for (const field of [
      "hiddenFacts",
      "nextObjective",
      "evidence",
      "rubric",
      "seed",
      "blueprint",
    ])
      expect(JSON.stringify(payload)).not.toContain('"' + field + '"');
    const id = payload.session.id;
    expect(
      (
        await anonymous.get(`/api/simulations/${id}`, {
          headers: { Authorization: "Bearer " + second.token },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await anonymous.post("/api/simulations/draft", {
          headers: { ...headers, Authorization: "Bearer " + second.token },
          data: { sessionId: id, draft: "unauthorized edit", expectedTurns: 0 },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await anonymous.get("/api/dashboard", {
          headers: { Authorization: "Bearer " + first.token },
        })
      ).status(),
    ).toBe(401);
    const signup = await other.post("/api/auth/sign-up/email", {
      data: {
        name: "Other security owner",
        email: randomUUID() + "@example.test",
        password: "Synthetic-security-test-2026!",
      },
    });
    expect(signup.ok(), await signup.text()).toBe(true);
    expect(
      (
        await other.post("/api/auth/experience", {
          data: { experience: "enterprise" },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (await other.get(`/api/assessments/${assessment.id}`)).status(),
    ).toBe(404);
    expect(
      (
        await other.get(`/api/assessments/${assessment.id}/monitoring`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await other.post(`/api/assessments/${assessment.id}/invites`, {
          data: {
            candidateName: "Other",
            candidateEmail: "other@example.test",
            assessmentVersion: assessment.version,
            requestId: randomUUID(),
          },
        })
      ).status(),
    ).toBe(404);
    const restored = await anonymous.get(`/api/simulations/${id}`, {
      headers: { Authorization: "Bearer " + first.token },
    });
    expect(restored.ok()).toBe(true);
    expect((await restored.json()).session.draft).toBe("");
  } finally {
    await anonymous.dispose();
    await other.dispose();
  }
});

test("security: AI generation is owner-budgeted and returns retry guidance", async ({
  playwright,
}) => {
  test.setTimeout(60000);
  const client = await playwright.request.newContext({
    baseURL: origin,
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { Origin: origin },
  });
  try {
    expect(
      (
        await client.post("/api/auth/sign-up/email", {
          data: {
            name: "Synthetic budget owner",
            email: randomUUID() + "@example.test",
            password: "Synthetic-budget-test-2026!",
          },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await client.post("/api/auth/experience", {
          data: { experience: "enterprise" },
        })
      ).ok(),
    ).toBe(true);
    let limited = false;
    for (let attempt = 0; attempt < 21; attempt++) {
      const r = await client.post("/api/assessments/generate", {
        data: {
          jobTitle: "Synthetic security role",
          seniority: "Junior",
          jobDescription:
            "Investigate fictional business facts and explain a bounded decision.",
          durationMinutes: 15,
        },
      });
      if (r.status() === 429) {
        expect(Number(r.headers()["retry-after"])).toBeGreaterThan(0);
        expect(await r.text()).toContain("saved work is intact");
        limited = true;
        break;
      }
      expect(r.ok(), await r.text()).toBe(true);
    }
    expect(limited).toBe(true);
  } finally {
    await client.dispose();
  }
});
