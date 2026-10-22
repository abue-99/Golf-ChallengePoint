import { redirect } from "next/navigation";

// The former coach home duplicated the dashboard; coaches now start on the
// player roster at /dashboard.
export default function CoachHome() {
  redirect("/dashboard");
}
