"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    profileImage: "",
  });

  async function handleSubmit() {
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);

    if (res.ok) {
      window.location.href = "/";
    } else {
      console.error("Signup failed", await res.json());
      alert("Signup failed — please check your input.");
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-muted/20">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-center">
            Create your Golf Challenge Point Account
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <Input
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <Input
            placeholder="First Name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />

          <Input
            placeholder="Last Name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />

          <Input
            placeholder="Profile Image URL (optional)"
            value={form.profileImage}
            onChange={(e) => setForm({ ...form, profileImage: e.target.value })}
          />

          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[var(--golf-primary)] hover:bg-[var(--golf-primary-light)] text-white"
          >
            {loading ? "Registering..." : "Create Account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
