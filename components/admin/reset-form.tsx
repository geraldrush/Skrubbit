"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_LENGTH = 12;

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  // Checked before the token is spent, so a mistyped confirmation costs a
  // keystroke rather than the whole link.
  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < MIN_LENGTH;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mismatch || password.length < MIN_LENGTH) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { error?: string; signedIn?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Could not set the password");
      setDone(true);
      setPassword("");
      setConfirm("");
      if (data.signedIn) {
        router.replace("/admin");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set the password");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm space-y-3 rounded-lg border p-6 text-center">
        <h2 className="font-display text-xl font-bold">Password updated</h2>
        <p className="text-sm text-muted-foreground">
          Any other sessions have been signed out. Taking you to the console…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4 rounded-lg border p-6">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-display text-xl font-bold">Choose a new password</h2>
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          At least {MIN_LENGTH} characters. Length is what matters — a long
          phrase beats a short one with punctuation in it.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {tooShort ? (
        <p className="text-sm text-muted-foreground">
          {MIN_LENGTH - password.length} more character
          {MIN_LENGTH - password.length === 1 ? "" : "s"} needed.
        </p>
      ) : null}
      {mismatch ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          Those don&apos;t match.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy || mismatch || password.length < MIN_LENGTH}
        className="w-full"
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
          </>
        ) : (
          "Set password"
        )}
      </Button>
    </form>
  );
}
