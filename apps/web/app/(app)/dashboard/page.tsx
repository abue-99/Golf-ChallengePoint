"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

type Team = {
  id: string;
  shortName: string;
  updatedAt?: string;
  createdAt?: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export default function Dashboard() {
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setTeams(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const recentActivity = [...teams]
    .sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return tb - ta;
    })
    .slice(0, 3);

  return (
    <div className="space-y-8">

      {/* Header */}
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--golf-heading)]">
          Dashboard
        </h1>
      </header>

      {/* Players/Teams tile */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm hover:shadow-md transition-all border border-[var(--golf-muted)]">
          <CardHeader>
            <CardTitle className="text-sm text-[var(--golf-muted-text)]">
              Players/Teams
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold flex items-center gap-2 text-[var(--golf-heading)]">
            {teams.length} <Users className="h-6 w-6 text-[var(--golf-primary)]" />
          </CardContent>
        </Card>
      </section>

      {/* Recent Activity */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-[var(--golf-heading)]">
          Recent Activity
        </h2>

        <Card className="shadow-sm border border-[var(--golf-muted)]">
          <CardContent className="divide-y p-0">
            {recentActivity.length === 0 ? (
              <div className="p-4 text-sm text-[var(--golf-muted-text)]">No recent activity.</div>
            ) : (
              recentActivity.map((t) => {
                const ts = t.updatedAt ?? t.createdAt;
                return (
                  <div
                    key={t.id}
                    className="p-4 flex items-center justify-between text-[var(--golf-heading)]"
                  >
                    <span className="text-sm">Team &ldquo;{t.shortName}&rdquo; updated</span>
                    <span className="text-xs text-[var(--golf-muted-text)]">
                      {ts ? timeAgo(ts) : "—"}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>

    </div>
  );
}
