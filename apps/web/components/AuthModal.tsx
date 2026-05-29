"use client";

import { useState, useRef, useEffect } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

function isValidEmail(value: string): boolean {
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(value);
}

type Tab = "login" | "signup";

interface Club {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: Tab;
}

export default function AuthModal({ isOpen, onClose, defaultTab = "login" }: AuthModalProps) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup state
  const [signupForm, setSignupForm] = useState({ email: "", password: "", firstName: "", lastName: "", clubId: "" });
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  // Clubs for signup dropdown
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);

  const loginEmailRef = useRef<HTMLInputElement>(null);
  const signupFirstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (tab === "login") loginEmailRef.current?.focus();
        else signupFirstRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, tab]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Sync tab when defaultTab changes (e.g. parent switches between login/signup)
  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  // Load clubs when the signup tab is first shown
  useEffect(() => {
    if (tab === "signup" && clubs.length === 0 && !clubsLoading) {
      setClubsLoading(true);
      fetch("/api/clubs/public")
        .then((r) => (r.ok ? r.json() : []))
        .then((data: Club[]) => setClubs(data))
        .catch(() => setClubs([]))
        .finally(() => setClubsLoading(false));
    }
  }, [tab, clubs.length, clubsLoading]);

  if (!isOpen) return null;

  function validateLogin(): boolean {
    let valid = true;
    if (!email) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    } else {
      setEmailError(null);
    }
    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      valid = false;
    } else {
      setPasswordError(null);
    }
    return valid;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    if (!validateLogin()) return;
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(res.status === 401 ? "Invalid email or password." : data.error || "Login failed.");
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setLoginError("Network error. Please check your connection.");
    } finally {
      setLoginLoading(false);
    }
  }

  function validateSignup(): boolean {
    if (!signupForm.email || !isValidEmail(signupForm.email)) {
      setSignupError("Please enter a valid email address.");
      return false;
    }
    if (!signupForm.password || signupForm.password.length < 6) {
      setSignupError("Password must be at least 6 characters.");
      return false;
    }
    return true;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);
    if (!validateSignup()) return;
    setSignupLoading(true);
    try {
      const payload: Record<string, string> = {
        email: signupForm.email,
        password: signupForm.password,
        firstName: signupForm.firstName,
        lastName: signupForm.lastName,
      };
      if (signupForm.clubId) payload.clubId = signupForm.clubId;

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const data = await res.json();
        const msg = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message || data.error || "Signup failed. Please check your input.";
        setSignupError(msg);
      }
    } catch {
      setSignupError("Network error. Please check your connection.");
    } finally {
      setSignupLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-sm bg-white sm:rounded-xl rounded-t-2xl shadow-2xl overflow-hidden mx-0 sm:mx-4">
        {/* iOS home-indicator spacer is handled by global body padding */}
        {/* Drag handle for mobile sheet */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 focus:outline-none"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setTab("login")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === "login"
                ? "border-b-2 border-[var(--golf-primary)] text-[var(--golf-primary)]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setTab("signup")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === "signup"
                ? "border-b-2 border-[var(--golf-primary)] text-[var(--golf-primary)]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Sign Up
          </button>
        </div>

        <div className="p-6">
          {tab === "login" ? (
            <form onSubmit={handleLogin} noValidate className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="modal-email">Email</Label>
                <Input
                  id="modal-email"
                  ref={loginEmailRef}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loginLoading}
                  aria-invalid={!!emailError}
                />
                {emailError && (
                  <p className="text-xs text-red-500" role="alert">{emailError}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="modal-password">Password</Label>
                <div className="relative">
                  <Input
                    id="modal-password"
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loginLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs text-red-500" role="alert">{passwordError}</p>
                )}
              </div>

              <div className="flex justify-end text-xs">
                <Link
                  href="/forgot-password"
                  className="text-[var(--golf-primary)] hover:underline"
                  onClick={onClose}
                >
                  Forgot password?
                </Link>
              </div>

              {loginError && (
                <p className="text-sm text-red-500" role="alert">{loginError}</p>
              )}

              <Button
                type="submit"
                className="w-full bg-[var(--golf-primary)] hover:bg-[var(--golf-primary-light)] text-white"
                disabled={loginLoading}
              >
                {loginLoading ? "Logging in…" : "Login"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignup} noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="modal-firstname">First Name</Label>
                  <Input
                    id="modal-firstname"
                    ref={signupFirstRef}
                    placeholder="Max"
                    value={signupForm.firstName}
                    onChange={(e) => setSignupForm({ ...signupForm, firstName: e.target.value })}
                    disabled={signupLoading}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="modal-lastname">Last Name</Label>
                  <Input
                    id="modal-lastname"
                    placeholder="Mustermann"
                    value={signupForm.lastName}
                    onChange={(e) => setSignupForm({ ...signupForm, lastName: e.target.value })}
                    disabled={signupLoading}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="modal-signup-email">Email</Label>
                <Input
                  id="modal-signup-email"
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  value={signupForm.email}
                  onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                  disabled={signupLoading}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="modal-signup-password">Password</Label>
                <Input
                  id="modal-signup-password"
                  placeholder="Min. 6 characters"
                  type="password"
                  autoComplete="new-password"
                  value={signupForm.password}
                  onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                  disabled={signupLoading}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="modal-club">Club <span className="text-gray-400 text-xs">(optional)</span></Label>
                <Select
                  value={signupForm.clubId}
                  onValueChange={(val) => setSignupForm({ ...signupForm, clubId: val })}
                  disabled={signupLoading || clubsLoading}
                >
                  <SelectTrigger id="modal-club" className="w-full">
                    <SelectValue placeholder={clubsLoading ? "Loading clubs…" : "Select your club"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clubs.map((club) => (
                      <SelectItem key={club.id} value={club.id}>
                        {club.name}{club.city ? ` · ${club.city}` : ""}
                      </SelectItem>
                    ))}
                    {!clubsLoading && clubs.length === 0 && (
                      <SelectItem value="__none__" disabled>No clubs available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {signupError && (
                <p className="text-sm text-red-500" role="alert">{signupError}</p>
              )}

              <Button
                type="submit"
                className="w-full bg-[var(--golf-primary)] hover:bg-[var(--golf-primary-light)] text-white"
                disabled={signupLoading}
              >
                {signupLoading ? "Creating Account…" : "Create Account"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

