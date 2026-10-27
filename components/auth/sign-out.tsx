"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
export function SignOut() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function signOut() {
    setPending(true);
    setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed");
      const channel = new BroadcastChannel("proofskill:auth");
      channel.postMessage("signed-out");
      channel.close();
      // Clear the previous account's router and component caches on logout.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/auth");
    } catch {
      setPending(false);
      setError(true);
    }
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={signOut} disabled={pending}>
        <LogOut aria-hidden="true" />
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Could not sign out. Please try again.
        </p>
      )}
    </div>
  );
}
