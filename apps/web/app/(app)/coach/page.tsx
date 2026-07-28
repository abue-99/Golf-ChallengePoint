"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Circle, Filter, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Player = {
  id: string;
  name: string;
  handicap?: number | null;
  status?: "active" | "rest" | "rehab";
  avatarUrl?: string | null;
};

export default function CoachHome() {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | Player["status"]>("all");
  const [loading, setLoading] = useState(true);

  // TODO: ersetze das durch deinen echten API‑Call
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        // Beispiel-Daten
        const data: Player[] = [
          { id: "p_1", name: "Alex Johnson", handicap: 2.4, status: "active" },
          { id: "p_2", name: "Sam Walker", handicap: 5.8, status: "rehab" },
          { id: "p_3", name: "Jamie Lee", handicap: 1.2, status: "rest" },
          { id: "p_4", name: "Taylor Cruz", handicap: 3.7, status: "active" }
        ];
        if (!ignore) setPlayers(data);
      } finally {
        setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!players) return [];
    return players.filter((p) => {
      const matchesQ = !q || p.name.toLowerCase().includes(q.toLowerCase());
      const matchesStatus = status === "all" || p.status === status;
      return matchesQ && matchesStatus;
    });
  }, [players, q, status]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coach</h1>
          <p className="text-sm text-slate-500">Select a player to open their calendar.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="text-slate-600 hover:text-blue-700 hover:bg-blue-50">
            <Filter className="mr-2 h-4 w-4" /> Filters
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Suche */}
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search players…"
            className="w-full rounded-lg border border-gray-200 bg-white px-8 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {/* Status-Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip label="All" active={status === "all"} onClick={() => setStatus("all")} />
          <FilterChip
            label="Active"
            dotClass="bg-emerald-500"
            active={status === "active"}
            onClick={() => setStatus("active")}
          />
          <FilterChip
            label="Rest"
            dotClass="bg-amber-500"
            active={status === "rest"}
            onClick={() => setStatus("rest")}
          />
          <FilterChip
            label="Rehab"
            dotClass="bg-rose-500"
            active={status === "rehab"}
            onClick={() => setStatus("rehab")}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <Card className="border border-dashed">
          <CardContent className="p-8 text-center text-slate-500">
            No players found. Try a different search or filter.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <PlayerCard key={p.id} player={p} />
          ))}
        </div>
      )}
    </div>
  );
}

/* === kleine, wiederverwendbare UI‑Bausteine === */

function FilterChip({
  label,
  active,
  onClick,
  dotClass
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  dotClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm",
        active
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-gray-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {dotClass ? <span className={cn("h-2.5 w-2.5 rounded-full", dotClass)} /> : null}
      {label}
    </button>
  );
}

function PlayerCard({ player }: { player: Player }) {
  const color =
    player.status === "active"
      ? "bg-emerald-500"
      : player.status === "rest"
      ? "bg-amber-500"
      : player.status === "rehab"
      ? "bg-rose-500"
      : "bg-slate-300";

  return (
    <Card className="group border border-gray-200 bg-white shadow-[0_10px_30px_-10px_rgba(2,6,23,.12)] transition-shadow hover:shadow-[0_16px_36px_-12px_rgba(2,6,23,.18)]">
      <CardContent className="p-4">
        {/* Kopfzeile */}
        <div className="mb-4 flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600" />
            <span className={cn("absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-2 ring-white", color)} />
          </div>
          <div>
            <div className="font-medium text-slate-800">{player.name}</div>
            <div className="text-xs text-slate-500">
              Handicap {player.handicap != null ? player.handicap.toFixed(1) : "—"}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={player.status} />
          <div className="flex gap-1.5">
            <Link href={`/coach/players/${player.id}/planning`}>
              <Button size="sm" className="bg-green-600 text-white hover:bg-green-500 text-xs">Planning</Button>
            </Link>
            <Link href={`/coach/players/${player.id}/calendar`}>
              <Button size="sm" variant="outline" className="text-xs">Calendar</Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status?: Player["status"] }) {
  const map: Record<NonNullable<Player["status"]>, { label: string; dot: string; tone: string }> = {
    active: { label: "Active", dot: "bg-emerald-500", tone: "text-emerald-700 bg-emerald-50 ring-emerald-200" },
    rest: { label: "Rest", dot: "bg-amber-500", tone: "text-amber-700 bg-amber-50 ring-amber-200" },
    rehab: { label: "Rehab", dot: "bg-rose-500", tone: "text-rose-700 bg-rose-50 ring-rose-200" }
  };

  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
        <Circle className="mr-1 h-3 w-3 text-slate-400" /> Unknown
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ring-inset",
        map[status].tone
      )}
    >
      <span className={cn("mr-1 h-2 w-2 rounded-full", map[status].dot)} />
      {map[status].label}
    </span>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="border border-gray-200 bg-white">
          <CardContent className="p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-2 w-20 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
            <div className="h-9 w-full animate-pulse rounded bg-slate-200" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}