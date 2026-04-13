"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, TrendingUp, Trophy } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="space-y-8">

      {/* Header */}
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--golf-heading)]">
            Golf Challenge Point
          </h1>
          <p className="text-[var(--golf-muted-text)]">
            Overview of your training, progress and performance
          </p>
        </div>

        <Button 
          className="gap-2 bg-[var(--golf-primary)] hover:bg-[var(--golf-primary-light)] text-white"
        >
          Go to Today
          <ArrowRight className="h-4 w-4" />
        </Button>
      </header>

      {/* KPI Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm hover:shadow-md transition-all border border-[var(--golf-muted)]">
          <CardHeader>
            <CardTitle className="text-sm text-[var(--golf-muted-text)]">
              Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold flex items-center gap-2 text-[var(--golf-heading)]">
            3 <CheckCircle2 className="h-6 w-6 text-[var(--golf-primary)]" />
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-all border border-[var(--golf-muted)]">
          <CardHeader>
            <CardTitle className="text-sm text-[var(--golf-muted-text)]">
              Weekly Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold flex items-center gap-2 text-[var(--golf-heading)]">
            8 <TrendingUp className="h-6 w-6 text-[var(--golf-primary-light)]" />
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-all border border-[var(--golf-muted)]">
          <CardHeader>
            <CardTitle className="text-sm text-[var(--golf-muted-text)]">
              Average Score
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-[var(--golf-heading)]">
            72.4
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-all border border-[var(--golf-muted)]">
          <CardHeader>
            <CardTitle className="text-sm text-[var(--golf-muted-text)]">
              Season Rank
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold flex items-center gap-2 text-[var(--golf-heading)]">
            #12 <Trophy className="h-6 w-6 text-yellow-500" />
          </CardContent>
        </Card>
      </section>

      {/* Today's Plan */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--golf-heading)]">
            Today’s Plan
          </h2>
          <Button variant="ghost" size="sm" className="text-[var(--golf-primary)] hover:bg-[var(--golf-accent)]">
            View all
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Putting 3m drill", tag: "Putting" },
            { title: "Approach Wedge", tag: "Wedge" },
            { title: "Mindset Reflection", tag: "Mindset" }
          ].map((t, i) => (
            <Card 
              key={i} 
              className="shadow-sm hover:shadow-md transition-all border border-[var(--golf-muted)]"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-[var(--golf-heading)]">
                      {t.title}
                    </div>

                    <Badge 
                      variant="outline" 
                      className="mt-2 border-[var(--golf-primary)] text-[var(--golf-primary)]"
                    >
                      {t.tag}
                    </Badge>
                  </div>

                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--golf-primary)] mt-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--golf-heading)]">
            Recent Activity
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--golf-primary)] hover:bg-[var(--golf-accent)]"
          >
            See more
          </Button>
        </div>

        <Card className="shadow-sm border border-[var(--golf-muted)]">
          <CardContent className="divide-y p-0">
            {[
              { msg: "Completed Putting 3m drill", time: "2 hours ago" },
              { msg: "Logged reflection", time: "5 hours ago" },
              { msg: "Finished Approach Wedge", time: "Yesterday" }
            ].map((a, i) => (
              <div
                key={i}
                className="p-4 flex items-center justify-between text-[var(--golf-heading)]"
              >
                <span className="text-sm">{a.msg}</span>
                <span className="text-xs text-[var(--golf-muted-text)]">{a.time}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

    </div>
  );
}