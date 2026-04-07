"use client";

import { useRouter } from "next/navigation";
import AuthModal from "@/components/AuthModal";

export default function SignupPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-50">
      <AuthModal isOpen={true} onClose={() => router.push("/")} defaultTab="signup" />
    </div>
  );
}
