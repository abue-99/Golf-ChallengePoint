"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSent(true);
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-muted/20 px-4 py-8">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Forgot Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {sent ? (
            <p className="text-sm text-green-600">
              If an account exists with this email, a reset link has been sent.
            </p>
          ) : (
            <>
              <Input
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Button
                onClick={submit}
                className="w-full bg-[var(--golf-primary)] hover:bg-[var(--golf-primary-light)] text-white"
              >
                Send Reset Link
              </Button>


<div className="text-center text-sm text-muted-foreground">
<Link href="/loginBack">
  <Button>Back to Login</Button>
</Link>
</div>
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}