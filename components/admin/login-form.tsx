"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Turnstile, turnstileEnabled } from "@/components/admin/turnstile";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [token, setToken] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // The forgot-password panel lives in this component so the two states share
  // the card, rather than being a second page the admin has to navigate back
  // from with the username retyped.
  const [mode, setMode] = React.useState<"signin" | "forgot">("signin");
  const [sent, setSent] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, turnstileToken: token }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Sign in failed");
      setPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      // The token is single-use, so a retry after any failure needs a new one.
      setToken("");
      window.turnstile?.reset();
    } finally {
      setBusy(false);
    }
  }

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/admin/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username }),
      });
      // The endpoint answers the same way whether or not that address is the
      // admin's, and so does this. Saying "no such user" here would undo it.
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "forgot") {
    return (
      <form
        onSubmit={requestReset}
        className="mx-auto max-w-sm space-y-4 rounded-lg border p-6"
      >
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-xl font-bold">Reset password</h2>
        </div>

        {sent ? (
          <>
            <p className="text-sm text-muted-foreground">
              If that address belongs to the admin, a reset link is on its way.
              It works once and expires in an hour.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setMode("signin");
                setSent(false);
              }}
            >
              Back to sign in
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Enter the admin email address and we&apos;ll send a link to set a
              new password.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reset-username">Email</Label>
              <Input
                id="reset-username"
                type="email"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode("signin")}
            >
              Back to sign in
            </button>
          </>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4 rounded-lg border p-6">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-display text-xl font-bold">Admin sign in</h2>
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Email</Label>
        <Input
          id="username"
          type="email"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Turnstile onToken={setToken} />
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy || (turnstileEnabled && !token)}
        className="w-full"
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
      <button
        type="button"
        className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => {
          setMode("forgot");
          setError(null);
        }}
      >
        Forgot password?
      </button>
    </form>
  );
}
