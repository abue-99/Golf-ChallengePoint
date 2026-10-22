"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    if (!token) {
      setError("This reset link is invalid. Please request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        body: JSON.stringify({ token, password }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Invalid or expired reset link. Please request a new one.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {success ? (
          <div className="space-y-3">
            <p className="text-green-600">Password has been reset!</p>
            <Link href="/login" className="text-sm underline">
              Go to login
            </Link>
          </div>
        ) : (
          <>
            <Input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <Button
              onClick={submit}
              disabled={submitting}
              className="w-full bg-[var(--golf-primary)] hover:bg-[var(--golf-primary-light)] text-white"
            >
              {submitting ? "Resetting…" : "Reset Password"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-muted/20 px-4 py-8">
      <Suspense fallback={<div>Loading…</div>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}