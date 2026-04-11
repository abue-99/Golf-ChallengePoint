"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ClubSettingsSection({ role }: { role: string }) {
  const [club, setClub] = useState<any>(null);

  useEffect(() => {
    fetch("/api/club/me")
      .then(r => r.json())
      .then(setClub);
  }, []);

  const readOnly = role !== "SYSADMIN";
  if (!club) return null;

  async function save() {
    await fetch("/api/club/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(club),
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>
          {role === "SUPERADMIN" ? "Manage Club" : "Club Settings"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={club.name}
          onChange={(e) => setClub({ ...club, name: e.target.value })}
          disabled={readOnly}
        />
        <Input
          value={club.logo || ""}
          placeholder="Logo URL"
          onChange={(e) => setClub({ ...club, logo: e.target.value })}
          disabled={readOnly}
        />
        {!readOnly && (
          <Button onClick={save}>Save</Button>
        )}
      </CardContent>
    </Card>
  );
}