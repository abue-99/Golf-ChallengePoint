"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Users } from "lucide-react";

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
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [playerCount, setPlayerCount] = useState<number>(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((me) => { if (me?.role) setRole(me.role); });
  }, []);

  useEffect(() => {
    if (!role) return;
    if (role === "COACH" || role === "ADMIN") {
      Promise.all([
        fetch("/api/teams").then((r) => r.ok ? r.json() : []),
        fetch("/api/teams/club-players").then((r) => r.ok ? r.json() : []),
      ]).then(([t, p]) => {
        setTeams(Array.isArray(t) ? t : []);
        setPlayerCount(Array.isArray(p) ? p.length : 0);
      }).catch(() => {});
    }
  }, [role]);

  const recentActivity = [...teams]
    .sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return tb - ta;
    })
    .slice(0, 3);

  const isCoachOrAdmin = role === "COACH" || role === "ADMIN";

  return (
    <div className="space-y-8">

      {/* Header */}
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--golf-heading)]">
          Dashboard
        </h1>
      </header>

      {/* Role-specific tiles */}
      {isCoachOrAdmin && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Players/Teams tile – double-click navigates to /teams */}
          <Card
            className="shadow-sm hover:shadow-md transition-all border border-[var(--golf-muted)] cursor-pointer select-none"
            onClick={() => router.push("/teams")}
            onDoubleClick={() => router.push("/teams")}
            title="Click to open Players/Teams"
          >
            <CardHeader>
              <CardTitle className="text-sm text-[var(--golf-muted-text)]">
                Players / Teams
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-row gap-6">
              <div className="flex items-center gap-2 text-2xl font-semibold text-[var(--golf-heading)]">
                <User className="h-5 w-5 text-[var(--golf-primary)]" />
                <span>{playerCount}</span>
              </div>
              <div className="flex items-center gap-2 text-2xl font-semibold text-[var(--golf-heading)]">
                <Users className="h-5 w-5 text-[var(--golf-primary)]" />
                <span>{teams.length}</span>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Recent Activity (COACH / ADMIN only) */}
      {isCoachOrAdmin && (
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
      )}

      {/* Player dashboard */}
      {role === "PLAYER" && (
        <section className="space-y-3">
          <p className="text-sm text-[var(--golf-muted-text)]">
            Welcome! Use the navigation to manage your challenges and training sessions.
          </p>
        </section>
      )}

      {/* SysAdmin dashboard */}
      {role === "SYSADMIN" && (
        <section className="space-y-3">
          <p className="text-sm text-[var(--golf-muted-text)]">
            System administration overview. Use Settings to manage clubs and users.
          </p>
        </section>
      )}

    </div>
  );
}
