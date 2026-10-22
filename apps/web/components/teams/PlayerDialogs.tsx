"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, UserPlus } from "lucide-react";
import PlayerOverviewDialog from "@/components/PlayerOverviewDialog";
import type { ClubOption, Player } from "./shared";

export function PlayerDetailDialog({
  player,
  onClose,
  onRemove,
}: {
  player: Player;
  onClose: () => void;
  onRemove?: (playerId: string) => void;
}) {
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    const name =
      `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim() ||
      player.email ||
      "—";
    if (!window.confirm(`Remove "${name}" from your players list?`)) return;
    setRemoving(true);
    const res = await fetch(
      `/api/players/my/${encodeURIComponent(player.id)}`,
      { method: "DELETE" },
    );
    setRemoving(false);
    if (res.ok) {
      onRemove?.(player.id);
      onClose();
    } else {
      alert("Failed to remove player. Please try again.");
    }
  }

  return (
    <PlayerOverviewDialog
      player={player}
      onClose={onClose}
      removeDisabled={removing}
      removeLabel={removing ? "Removing…" : "Remove from My Players"}
      onRemove={onRemove ? async () => {
        if (removing) return;
        await handleRemove();
      } : undefined}
    />
  );
}

export function InvitePlayerDialog({
  clubs,
  onClose,
  onInvited,
}: {
  clubs: ClubOption[];
  onClose: () => void;
  onInvited: (player: Player) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [clubId, setClubId] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (!firstName.trim()) {
      setErrorMsg("First name is required.");
      return;
    }
    if (!lastName.trim()) {
      setErrorMsg("Last name is required.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg("A valid email is required.");
      return;
    }
    if (!clubId) {
      setErrorMsg("Please select a club.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/players/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          clubId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(
          data?.message ?? "Failed to invite player. Please try again.",
        );
      } else {
        onInvited(data as Player);
        onClose();
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite New Player</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label htmlFor="inv-firstName">First Name</Label>
            <Input
              id="inv-firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inv-lastName">Last Name</Label>
            <Input
              id="inv-lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inv-email">Email</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@example.com"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <Label>Club</Label>
            <Select value={clubId} onValueChange={setClubId} disabled={saving}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a club…" />
              </SelectTrigger>
              <SelectContent>
                {clubs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Sending…" : "Send Invitation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddPlayerDialog({
  clubs,
  myPlayers,
  onClose,
  onPlayerAdded,
}: {
  clubs: ClubOption[];
  myPlayers: Player[];
  onClose: () => void;
  onPlayerAdded: (player: Player) => void;
}) {
  const [mode, setMode] = useState<"existing" | "invite">("existing");
  const [clubId, setClubId] = useState(clubs[0]?.id ?? "");
  const [clubPlayers, setClubPlayers] = useState<Player[]>([]);
  const [loadingClubPlayers, setLoadingClubPlayers] = useState(false);
  const [search, setSearch] = useState("");
  const [linking, setLinking] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const myPlayerIds = new Set(myPlayers.map((p) => p.id));

  useEffect(() => {
    if (!clubId) return;
    setLoadingClubPlayers(true);
    fetch(`/api/teams/club-players?clubId=${encodeURIComponent(clubId)}`)
      .then((r) => r.json())
      .then((data) => {
        const players = Array.isArray(data)
          ? data.filter(Boolean).filter((p: Player) => p.role === "PLAYER")
          : [];
        setClubPlayers(players);
      })
      .catch(() => setClubPlayers([]))
      .finally(() => setLoadingClubPlayers(false));
  }, [clubId]);

  const availablePlayers = clubPlayers.filter((p) => !myPlayerIds.has(p.id));
  const filteredPlayers = availablePlayers.filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.toLowerCase();
    return name.includes(q) || (p.email ?? "").toLowerCase().includes(q);
  });

  async function handleLink(player: Player) {
    setLinking(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/players/my", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => []);
        const linkedPlayer = Array.isArray(data)
          ? (data.find((entry: Player) => entry.id === player.id) ?? player)
          : player;
        onPlayerAdded(linkedPlayer);
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data?.message ?? "Failed to add player.");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLinking(false);
    }
  }

  if (mode === "invite") {
    return (
      <InvitePlayerDialog
        clubs={clubs}
        onClose={onClose}
        onInvited={onPlayerAdded}
      />
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Player</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {clubs.length > 1 && (
            <div className="space-y-1">
              <Label>Filter by Club</Label>
              <Select value={clubId} onValueChange={setClubId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a club…" />
                </SelectTrigger>
                <SelectContent>
                  {clubs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Search existing players</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-8"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loadingClubPlayers ? (
            <p className="text-sm text-gray-400">Loading players…</p>
          ) : filteredPlayers.length === 0 ? (
            <p className="text-sm text-gray-500">
              {availablePlayers.length === 0
                ? "No unlinked players found in this club."
                : "No matching players found."}
            </p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-2">
              {filteredPlayers.map((p) => {
                const name =
                  `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() ||
                  p.email ||
                  "—";
                const playerInitials =
                  `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() ||
                  "?";
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-50"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      {p.profileImage && (
                        <AvatarImage src={p.profileImage} alt={name} />
                      )}
                      <AvatarFallback className="text-xs bg-gray-200 text-gray-600">
                        {playerInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{name}</div>
                      {p.email && (
                        <div className="text-xs text-gray-400 truncate">
                          {p.email}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      disabled={linking}
                      onClick={() => handleLink(p)}
                    >
                      <Plus size={12} className="mr-1" />
                      Add
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

          <div className="flex items-center justify-between pt-1 border-t">
            <Button size="sm" onClick={() => setMode("invite")}>
              <UserPlus size={14} className="mr-1" />
              Invite New Player
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

