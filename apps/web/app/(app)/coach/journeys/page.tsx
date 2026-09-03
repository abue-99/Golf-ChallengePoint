"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, Lock, Plus, Route as RouteIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { JourneyTemplate } from "@/types/journey-template";
import { toast } from "sonner";

function visibilityBadge(visibility: JourneyTemplate["visibility"]) {
  if (visibility === "PUBLIC") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        <Globe className="h-3 w-3" /> Public
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      <Lock className="h-3 w-3" /> Private
    </span>
  );
}

export default function CoachJourneysPage() {
  const router = useRouter();
  const [journeys, setJourneys] = useState<JourneyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("");
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((me) => {
        if (me?.id) setMyId(me.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await api.listJourneyTemplates(
          visibilityFilter ? { visibility: visibilityFilter } : undefined,
        );
        if (!ignore) setJourneys(Array.isArray(data) ? (data as JourneyTemplate[]) : []);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [visibilityFilter]);

  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return journeys.filter((journey) => {
      if (!q) return true;
      return (
        journey.name.toLowerCase().includes(lower) ||
        (journey.category ?? "").toLowerCase().includes(lower) ||
        (journey.description ?? "").toLowerCase().includes(lower)
      );
    });
  }, [journeys, q]);

  async function assignJourney(journey: JourneyTemplate) {
    try {
      const target = window.prompt("Assign journey to player or team (p:<playerId> or t:<teamId>):");
      if (!target) return;
      if (target.startsWith("p:")) {
        await api.assignJourneyToPlayer(journey.id, target.slice(2).trim());
        toast.success(`${journey.name} assigned to player.`);
        return;
      }
      if (target.startsWith("t:")) {
        await api.assignJourneyToTeam(journey.id, target.slice(2).trim());
        toast.success(`${journey.name} assigned to team.`);
        return;
      }
      toast.error("Use p:<playerId> or t:<teamId>.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Journey assignment failed.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Journey Library</h1>
          <p className="text-sm text-slate-500">Create reusable journeys and assign them to players or teams.</p>
        </div>
        <Link href="/coach/journeys/new">
          <Button className="bg-green-600 text-white hover:bg-green-500">
            <Plus className="mr-2 h-4 w-4" /> New Journey
          </Button>
        </Link>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search journeys…"
            className="pl-8"
          />
        </div>
        <select
          value={visibilityFilter}
          onChange={(event) => setVisibilityFilter(event.target.value)}
          className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none"
        >
          <option value="">All Visibility</option>
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading journeys…</p>
      ) : filtered.length === 0 ? (
        <Card className="border border-dashed">
          <CardContent className="p-10 text-center text-slate-500">
            {journeys.length === 0 ? "No journeys yet. Create your first journey!" : "No journeys match your filters."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((journey) => {
            const isOwner = myId && journey.coachId === myId;
            return (
              <Card
                key={journey.id}
                className="cursor-pointer border border-gray-200 bg-white shadow-[0_4px_16px_-4px_rgba(2,6,23,.1)] transition-shadow hover:shadow-[0_8px_24px_-6px_rgba(2,6,23,.15)]"
                onClick={() => router.push(`/coach/journeys/${journey.id}`)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
                        <RouteIcon className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{journey.name}</p>
                        <p className="text-xs text-slate-500">{journey.category ?? "Uncategorized"}</p>
                      </div>
                    </div>
                    {visibilityBadge(journey.visibility)}
                  </div>

                  {journey.description ? (
                    <p className="text-xs text-slate-600 line-clamp-3">{journey.description}</p>
                  ) : null}

                  <div className="text-xs text-slate-500">
                    {journey.lessons.length} lesson{journey.lessons.length === 1 ? "" : "s"}
                  </div>

                  <div className="flex items-center justify-between" onClick={(event) => event.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-300 text-green-700 hover:bg-green-50"
                      onClick={() => assignJourney(journey)}
                    >
                      Assign
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 text-white hover:bg-green-500"
                      onClick={() => router.push(`/coach/journeys/${journey.id}${isOwner ? "?mode=edit" : ""}`)}
                    >
                      {isOwner ? "Edit" : "Open"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
