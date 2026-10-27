import { test, expect } from "@playwright/test";

test("separate HR account pages preserve the destination through signup and login", async ({
  page,
}) => {
  await page.goto("/auth?next=/enterprise/assessments");
  await expect(page).toHaveURL(/\/auth\/sign-in\?next=/);
  await expect(
    page.getByRole("heading", { name: "Sign in to ProofSkill." }),
  ).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link"),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/sign-up\?next=/);
  await expect(
    page.getByRole("heading", { name: "Create your ProofSkill account." }),
  ).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?next=/);
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  await page.getByRole("link", { name: "Create account", exact: true }).click();
  const email = `auth-pages-${Date.now()}@example.test`;
  const password = "Testing-only-password-2026!";
  await page.getByLabel("Your name").fill("Test Hiring Team");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/enterprise\/assessments$/, {
    timeout: 20000,
  });
  await page.goto("/auth/sign-up");
  await expect(page).toHaveURL(/\/enterprise$/);
  const signedOut = await page.request.post("/api/auth/sign-out", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: {},
  });
  expect(signedOut.ok()).toBe(true);
  await page.goto("/enterprise/assessments");
  await expect(page).toHaveURL(/\/auth\/sign-in\?next=/);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/enterprise\/assessments$/, {
    timeout: 20000,
  });
});
