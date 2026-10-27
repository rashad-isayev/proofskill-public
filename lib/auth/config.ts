import { betterAuth } from "better-auth";
import { Pool } from "pg";

export function createAuth() {
  const connectionString = process.env.AUTH_DATABASE_URL;
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!connectionString || !secret || secret.length < 32 || !baseURL) {
    throw new Error("Authentication is not configured.");
  }
  const origin = new URL(baseURL).origin;
  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://")) {
    throw new Error("Production authentication requires HTTPS.");
  }
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
  const auth = betterAuth({
    appName: "ProofSkill",
    baseURL: origin,
    secret,
    database: pool,
    trustedOrigins: [origin],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    user: { modelName: "proofskill_auth_user" },
    account: { modelName: "proofskill_auth_account" },
    verification: { modelName: "proofskill_auth_verification" },
    session: {
      modelName: "proofskill_auth_session",
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
      additionalFields: {
        experience: {
          type: ["job-seeker", "enterprise"],
          required: false,
          input: false,
        },
      },
    },
    advanced: {
      cookiePrefix: "proofskill",
      useSecureCookies: origin.startsWith("https://"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "proofskill_auth_rate_limit",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 10 },
      },
    },
  });
  return { auth, pool };
}
