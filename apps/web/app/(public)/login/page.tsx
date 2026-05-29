"use client";

import { useRouter } from "next/navigation";
import AuthModal from "@/components/AuthModal";

export default function LoginPage() {
  const router = useRouter();
  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <AuthModal isOpen={true} onClose={() => router.push("/")} defaultTab="login" />
    </div>
  );
}
