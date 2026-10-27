"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { type Experience } from "@/lib/auth/experience";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthInterface({
  mode,
  signedIn,
  next,
  unavailable,
}: {
  mode: "sign-in" | "sign-up";
  signedIn: boolean;
  next?: string;
  unavailable: boolean;
}) {
  const experience: Experience = "enterprise";
  const alternatePath = mode === "sign-in" ? "/auth/sign-up" : "/auth/sign-in";
  const alternateHref = next
    ? `${alternatePath}?${new URLSearchParams({ next })}`
    : alternatePath;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function openWorkspace(selected: Experience) {
    const response = await fetch("/api/auth/experience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experience: selected, next }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.message ??
          "Your workspace could not be opened. Please try again.",
      );
    // A full navigation discards the previous account's React and router caches.
    window.location.assign(result.destination);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!experience || pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      if (!signedIn) {
        const email = String(data.get("email") ?? "").trim();
        const password = String(data.get("password") ?? "");
        const result =
          mode === "sign-up"
            ? await authClient.signUp.email({
                name: String(data.get("name") ?? "").trim(),
                email,
                password,
              })
            : await authClient.signIn.email({ email, password });
        if (result.error) {
          const message =
            result.error.status === 429
              ? "Too many attempts. Wait a minute and try again."
              : result.error.status >= 500
                ? "Sign-in is temporarily unavailable. Please try again."
                : mode === "sign-in"
                  ? "We could not sign you in. Check your email and password."
                  : "We could not create this account. Check your details or try signing in.";
          throw new Error(message);
        }
      }
      await openWorkspace(experience);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not connect. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <div className="page-container flex min-h-[calc(100dvh-72px)] items-center justify-center py-12 sm:py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            {signedIn
              ? "Continue to your hiring workspace."
              : mode === "sign-in"
                ? "Sign in to ProofSkill."
                : "Create your ProofSkill account."}
          </h1>
        </div>
        {unavailable && (
          <p
            role="alert"
            className="mt-6 rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
          >
            Sign-in is temporarily unavailable. Please try again shortly.
          </p>
        )}
        {experience && (
          <div className="mt-8">
            <form onSubmit={submit} className="space-y-5">
              {!signedIn && (
                <>
                  {mode === "sign-up" && (
                    <div>
                      <label
                        className="mb-2 block text-sm font-medium"
                        htmlFor="auth-name"
                      >
                        Your name
                      </label>
                      <Input
                        id="auth-name"
                        name="name"
                        autoComplete="name"
                        minLength={2}
                        maxLength={100}
                        required
                        disabled={pending}
                      />
                    </div>
                  )}
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium"
                      htmlFor="auth-email"
                    >
                      Email address
                    </label>
                    <Input
                      id="auth-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      required
                      disabled={pending}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium"
                      htmlFor="auth-password"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Input
                        className="pr-12"
                        aria-describedby={
                          mode === "sign-up" ? "password-guidance" : undefined
                        }
                        id="auth-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          mode === "sign-up"
                            ? "new-password"
                            : "current-password"
                        }
                        minLength={mode === "sign-up" ? 12 : 1}
                        maxLength={128}
                        required
                        disabled={pending}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0"
                        disabled={pending}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff aria-hidden="true" />
                        ) : (
                          <Eye aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                    {mode === "sign-up" && (
                      <p
                        id="password-guidance"
                        className="mt-2 text-xs text-muted-foreground"
                      >
                        Use at least 12 characters.
                      </p>
                    )}
                  </div>
                </>
              )}
              {error && (
                <p
                  id="auth-error"
                  role="alert"
                  className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={pending}
                aria-describedby={error ? "auth-error" : undefined}
              >
                {pending ? (
                  <>
                    <LoaderCircle aria-hidden="true" className="animate-spin" />{" "}
                    Opening your workspace…
                  </>
                ) : (
                  <>
                    {signedIn
                      ? "Open hiring workspace"
                      : mode === "sign-in"
                        ? "Sign in"
                        : "Create account"}{" "}
                    <ArrowRight aria-hidden="true" />
                  </>
                )}
              </Button>
            </form>
            {!signedIn && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "sign-in"
                  ? "New to ProofSkill? "
                  : "Already have an account? "}
                <Link
                  href={alternateHref}
                  className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
                >
                  {mode === "sign-in" ? "Create account" : "Sign in"}
                </Link>
              </p>
            )}
          </div>
        )}
        <p className="mt-8 text-center text-xs leading-6 text-muted-foreground">
          Candidates join with a private invitation link. No account needed.
        </p>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link className="hover:text-foreground" href="/">
            Back to ProofSkill
          </Link>
        </p>
      </div>
    </div>
  );
}
