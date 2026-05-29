"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Plus, X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogDialog } from "@/components/log-dialog";
import { PlayerCapabilitiesWidget } from "@/components/player-capabilities-widget";

type Schema = "numeric_success" | "numeric_score" | "text_reflection";

type TodayTask = {
  eventId: string;
  title: string;
  schema: Schema;
  status?: "open" | "done";
  tag?: string;
};

const todayTasks: TodayTask[] = [
  { eventId: "evt_1", title: "Putting 3m drill", schema: "numeric_success", tag: "Putting", status: "open" },
  { eventId: "evt_2", title: "Approach wedge", schema: "numeric_score", tag: "Wedge", status: "open" },
  { eventId: "evt_3", title: "Reflection", schema: "text_reflection", tag: "Mindset", status: "open" }
];

export default function PlayerToday() {
  const [playerId, setPlayerId] = useState("local-player");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (me?.id) setPlayerId(String(me.id));
      })
      .catch(() => {});
  }, []);

  const completed = useMemo(() => todayTasks.filter(t => t.status === "done").length, []);
  const total = todayTasks.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="text-sm text-muted-foreground">Your plan for the day at a glance</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/tasks/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </Link>

          <Button variant="outline">Quick Start</Button>
        </div>
      </header>

      <PlayerCapabilitiesWidget playerId={playerId} />

      {/* Progress */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Progress</CardTitle>
          <span className="text-sm text-muted-foreground">{progress}%</span>
        </CardHeader>
        <CardContent>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {completed} of {total} tasks completed
          </p>
        </CardContent>
      </Card>

      {/* Task Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {todayTasks.map((t) => (
          <Card key={t.eventId} className="border bg-card shadow-sm transition-all hover:shadow-md">
            <CardContent className="p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="font-medium text-foreground">{t.title}</div>

                  {t.tag && (
                    <div className="mt-1">
                      <Badge variant="outline" className="text-xs">
                        {t.tag}
                      </Badge>
                    </div>
                  )}
                </div>

                <span
                  className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${
                    t.status === "done" ? "bg-success" : "bg-primary"
                  }`}
                />
              </div>

              <div className="flex items-center gap-2">
                <LogDialog eventId={t.eventId} schema={t.schema} />

                <Button size="icon" variant="ghost" className="text-green-600 hover:bg-green-50">
                  <Check className="h-4 w-4" />
                </Button>

                <Button size="icon" variant="ghost" className="text-muted-foreground hover:bg-muted">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {todayTasks.length === 0 && (
        <Card className="border border-dashed">
          <CardContent className="p-6 text-center text-muted-foreground">
            No tasks for today.{" "}
            <Link href="/tasks/new">
              Create one
            </Link>
            .
          </CardContent>
        </Card>
      )}

    </div>
  );
}