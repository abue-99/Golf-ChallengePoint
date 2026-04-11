// apps/web/src/app/(app)/coach/players/[playerId]/calendar/page.tsx

import { Suspense } from "react";
import Link from "next/link";
import { DraggableTaskList } from "@/components/draggable-task-list";
import PlayerCalendar from "@/components/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Plus } from "lucide-react";

// ✅ WICHTIG: Den *Projekt*-Typ importieren, den DraggableTaskList erwartet
import type { TaskTemplate } from "@/lib/types";

// ---- API-Shape (so wie sie aktuell zurückkommt) ----
type ApiTemplate = {
  id: string;
  title: string;
  schema: string;      // wird zu inputSchema gemappt
  category?: string;   // optional; wenn vorhanden, mappen wir auf die erlaubten Kategorien
};

// Hilfstypen aus dem Projekt-Typ extrahieren (Union-Werte)
type Category = TaskTemplate["category"];         // "APPROACH" | "OTT" | "ARG" | "PUTTING"
type InputSchema = TaskTemplate["inputSchema"];   // z. B. "numeric_success" | "numeric_score" | "text_reflection"

// 💡 Kategorisierung: heuristisch aus Title/optional category ableiten, sonst Default
function coerceCategory(title: string, raw?: string): Category {
  // 1) Versuche direkten Match (falls Backend bereits "APPROACH"/"PUTTING"/"OTT"/"ARG" liefert)
  const upper = raw?.toUpperCase();
  if (upper === "APPROACH" || upper === "PUTTING" || upper === "OTT" || upper === "ARG") {
    return upper as Category;
  }

  // 2) Heuristik aus dem Titel
  const t = title.toLowerCase();
  if (t.includes("putt")) return "PUTTING";
  if (t.includes("wedge") || t.includes("approach")) return "APPROACH";
  if (t.includes("tee") || t.includes("drive")) return "OTT";   // off the tee
  // 3) Fallback: z. B. ARG (Around the green)
  return "ARG";
}

// 💡 inputSchema-Guard: Nur erlaubte Werte durchlassen, sonst sinnvoller Default
function coerceInputSchema(schema: string): InputSchema {
  const allowed: InputSchema[] = ["numeric_success", "numeric_score", "text_reflection"];
  return (allowed as readonly string[]).includes(schema)
    ? (schema as InputSchema)
    : "numeric_success";
}

async function getTemplates(): Promise<TaskTemplate[]> {
  const url = `${process.env.API_URL || "http://golf_api:4000"}/task-templates`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];

    const data = (await res.json()) as ApiTemplate[];

  // ✅ Sauberes Mapping auf den *Projekt*-Typ TaskTemplate
  return data.map((t) => ({
    id: t.id,
    title: t.title,
    category: coerceCategory(t.title, t.category),
    inputSchema: coerceInputSchema(t.schema),
  }));
  } catch (err) {
    console.error("Failed to load task templates:", err);
    return [];
  }
}

export default async function PlayerCalendarPage({
  params,
}: {
  params: { playerId: string };
}) {
  const templates = await getTemplates();

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Player Calendar</h1>
          <p className="text-sm text-slate-500">
            Drag tasks from the left into the calendar to schedule a session.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/coach/players/${params.playerId}/tasks/new`}>
            <Button className="bg-blue-600 text-white hover:bg-blue-500">
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </Link>
          <Button variant="ghost" className="text-slate-600 hover:text-blue-700 hover:bg-blue-50">
            <CalendarIcon className="mr-2 h-4 w-4" />
            Today
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Draggable Templates */}
        <div className="lg:col-span-3">
          <Card className="border border-gray-200 bg-white shadow-[0_10px_30px_-10px_rgba(2,6,23,.12)]">
            <CardHeader>
              <CardTitle className="text-base">Templates</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {templates.length > 0 ? (
                <div className="p-3">
                  {/* ✅ Jetzt stimmt der Typ */}
                  <DraggableTaskList templates={templates} />
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-slate-500">
                  No templates yet.{" "}
                  <Link
                    href={`/coach/players/${params.playerId}/tasks/new`}
                    className="text-blue-700 hover:underline"
                  >
                    Create one
                  </Link>
                  .
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Calendar */}
        <div className="lg:col-span-9">
          <Card className="border border-gray-200 bg-white shadow-[0_10px_30px_-10px_rgba(2,6,23,.12)]">
            <CardHeader>
              <CardTitle className="text-base">Calendar</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <Suspense
                fallback={
                  <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-slate-500">
                    Loading calendar…
                  </div>
                }
              >
                <div className="min-h-[640px] rounded-lg bg-white">
                  <PlayerCalendar playerId={params.playerId} />
                </div>
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}