"use client";

import { useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Club = { id: string; name: string };

type Player = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImage: string | null;
  email?: string;
  phoneNumber?: string | null;
  timezone?: string | null;
  role?: string;
  lastLogin?: string | null;
  userClubs?: { clubId: string; club: Club }[];
};

function playerInitials(p: Player) {
  return `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function playerName(p: Player) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email || "—";
}

/** Modal shown when double-clicking a player card. */
function PlayerDetailDialog({
  player,
  onClose,
}: {
  player: Player;
  onClose: () => void;
}) {
  const isInactive = !player.lastLogin;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Player Details</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 pt-2">
          <Avatar className="h-24 w-24">
            {player.profileImage && (
              <AvatarImage src={player.profileImage} alt={playerName(player)} />
            )}
            <AvatarFallback className="text-2xl bg-gray-200 text-gray-600">
              {playerInitials(player)}
            </AvatarFallback>
          </Avatar>

          {isInactive && (
            <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-700">
              Inactive (pending activation)
            </span>
          )}

          <div className="w-full space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium text-gray-500">Name</span>
              <span>{playerName(player)}</span>
            </div>
            {player.email && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">Email</span>
                <span className="break-all">{player.email}</span>
              </div>
            )}
            {player.phoneNumber && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">Phone</span>
                <span>{player.phoneNumber}</span>
              </div>
            )}
            {player.timezone && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">Timezone</span>
                <span>{player.timezone.replace(/_/g, " ")}</span>
              </div>
            )}
            {player.userClubs && player.userClubs.length > 0 && (
              <div className="flex justify-between gap-2">
                <span className="font-medium text-gray-500 shrink-0">Clubs</span>
                <span className="text-right">
                  {player.userClubs.map((uc) => uc.club.name).join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog for inviting a new player. */
function InvitePlayerDialog({
  clubs,
  onClose,
  onInvited,
}: {
  clubs: Club[];
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
    if (!firstName.trim()) { setErrorMsg("First name is required."); return; }
    if (!lastName.trim()) { setErrorMsg("Last name is required."); return; }
    if (!email.trim() || !email.includes("@")) { setErrorMsg("A valid email is required."); return; }
    if (!clubId) { setErrorMsg("Please select a club."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/players/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), clubId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data?.message ?? "Failed to invite player. Please try again.");
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
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Player</DialogTitle>
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
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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

export default function PlayersPage() {
  const [role, setRole] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((me) => { if (me?.role) setRole(me.role); });
  }, []);

  useEffect(() => {
    if (!role) return;

    Promise.all([
      fetch("/api/teams/club-players").then((r) => r.ok ? r.json() : []),
      fetch("/api/clubs/my").then((r) => r.ok ? r.json() : []),
    ]).then(([p, clubs]) => {
      setPlayers(Array.isArray(p) ? p : []);
      if (Array.isArray(clubs)) {
        setMyClubs(clubs.map((uc: { club: Club }) => uc.club).filter(Boolean));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [role]);

  const isCoachOrAdmin = role === "COACH" || role === "ADMIN";

  if (loading) return <div className="p-4">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--golf-heading)]">Players</h1>
        {isCoachOrAdmin && (
          <Button
            onClick={() => setShowInvite(true)}
            className="gap-2"
          >
            <UserPlus size={16} />
            Add User
          </Button>
        )}
      </div>

      {players.length === 0 ? (
        <p className="text-sm text-[var(--golf-muted-text)]">No players found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {players.map((player) => {
            const clubs = player.userClubs?.map((uc) => uc.club.name) ?? [];
            const isInactive = player.lastLogin === null || player.lastLogin === undefined;

            return (
              <div
                key={player.id}
                className="flex flex-col items-center gap-2 rounded-xl border border-[var(--golf-muted)] bg-white p-4 shadow-sm hover:shadow-md transition-all cursor-pointer select-none"
                onDoubleClick={() => setSelectedPlayer(player)}
                title="Double-click to view details"
              >
                <div className="relative">
                  <Avatar className="h-16 w-16">
                    {player.profileImage && (
                      <AvatarImage src={player.profileImage} alt={playerName(player)} />
                    )}
                    <AvatarFallback className="text-xl bg-gray-200 text-gray-600">
                      {playerInitials(player)}
                    </AvatarFallback>
                  </Avatar>
                  {isInactive && (
                    <span
                      className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 border-2 border-white"
                      title="Inactive"
                    />
                  )}
                </div>
                <span className="text-sm font-medium text-center text-[var(--golf-heading)] leading-snug">
                  {playerName(player)}
                </span>
                {clubs.length > 0 && (
                  <span className="text-xs text-center text-[var(--golf-muted-text)] leading-snug">
                    {clubs.join(", ")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedPlayer && (
        <PlayerDetailDialog
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      {showInvite && (
        <InvitePlayerDialog
          clubs={myClubs}
          onClose={() => setShowInvite(false)}
          onInvited={(newPlayer) => {
            setPlayers((prev) => {
              const exists = prev.some((p) => p.id === newPlayer.id);
              return exists ? prev : [...prev, newPlayer];
            });
          }}
        />
      )}
    </div>
  );
}

