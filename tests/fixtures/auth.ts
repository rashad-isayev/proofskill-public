import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  test as base,
  expect,
  request as apiRequest,
  type Page,
} from "@playwright/test";
import type { Experience } from "../../lib/auth/experience";

const password = "Testing-only-password-2026!";
const origin = "http://127.0.0.1:3100";

type Sessions = Record<
  Experience,
  {
    state: Awaited<
      ReturnType<import("@playwright/test").APIRequestContext["storageState"]>
    >;
    email: string;
    password: string;
  }
>;
export const test = base.extend<
  { experience: Experience },
  { accountSessions: Sessions }
>({
  experience: ["enterprise", { option: true }],
  accountSessions: [
    async ({}, provide, workerInfo) => {
      const fixturePath = `test-results/auth-worker-${workerInfo.parallelIndex}.json`;
      const saved = await readFile(fixturePath, "utf8").catch(() => null);
      if (saved) {
        await provide(JSON.parse(saved) as Sessions);
        return;
      }
      const accounts = {} as Sessions;
      for (const experience of ["enterprise"] as const) {
        const api = await apiRequest.newContext({
          baseURL: origin,
          extraHTTPHeaders: { Origin: origin },
        });
        const email = `${experience}-${Date.now()}-${workerInfo.workerIndex}@example.test`;
        const created = await api.post("/api/auth/sign-up/email", {
          data: { name: `Test ${experience}`, email, password },
        });
        expect(created.ok(), await created.text()).toBe(true);
        const selected = await api.post("/api/auth/experience", {
          data: { experience },
        });
        expect(selected.ok(), await selected.text()).toBe(true);
        accounts[experience] = {
          state: await api.storageState(),
          email,
          password,
        };
        await api.dispose();
      }
      await mkdir("test-results", { recursive: true });
      await writeFile(fixturePath, JSON.stringify(accounts), { mode: 0o600 });
      await provide(accounts);
    },
    { scope: "worker" },
  ],
  storageState: async ({ accountSessions, experience }, provide) => {
    const api = await apiRequest.newContext({
      baseURL: origin,
      storageState: accountSessions[experience].state,
      extraHTTPHeaders: { Origin: origin },
    });
    const selected = await api.post("/api/auth/experience", {
      data: { experience },
    });
    expect(selected.ok(), await selected.text()).toBe(true);
    await provide(await api.storageState());
    await api.dispose();
  },
});
export { expect };
export type { Page };

export async function switchExperience(page: Page, experience: Experience) {
  const response = await page.request.post("/api/auth/experience", {
    headers: { Origin: origin },
    data: { experience },
  });
  expect(response.ok()).toBe(true);
}
