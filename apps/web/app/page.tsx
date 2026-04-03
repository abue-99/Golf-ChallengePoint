import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/jwt";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? null;

  if (!token || !verifyJwt(token)) {
    redirect("/login");
  }

  redirect("/dashboard");
}