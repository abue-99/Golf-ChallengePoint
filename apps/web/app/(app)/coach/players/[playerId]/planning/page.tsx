import { redirect } from "next/navigation";

export default async function CoachPlanningPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  redirect(`/coach/players/${playerId}/calendar`);
}
