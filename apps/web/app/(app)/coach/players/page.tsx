"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ExternalLink, Trash2, UserPlus } from "lucide-react";
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
import { PlayerCapabilitiesRadarCard } from "@/components/player-capabilities-widget";
import AssignLessonModal from "@/components/AssignLessonModal";
import DroppableZone from "@/components/DroppableZone";
import { DndLessonProvider } from "@/components/DndLessonProvider";
import { toast } from "sonner";

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
  userClubs?: { clubId: string; club: Club | null }[];
};

function playerInitials(p: Player) {
  return `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function playerName(p: Player) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email || "—";
}

/** Modal shown when clicking a player card. */
function PlayerDetailDialog({
  player,
  onClose,
  onRemove,
}: {
  player: Player;
  onClose: () => void;
  onRemove?: (playerId: string) => void;
}) {
  const isInactive = !player.lastLogin;
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    if (!window.confirm(`Remove "${playerName(player)}" from your players list?`)) return;
    setRemoving(true);
    const res = await fetch(`/api/players/my/${encodeURIComponent(player.id)}`, { method: "DELETE" });
    setRemoving(false);
    if (res.ok) {
      onRemove?.(player.id);
      onClose();
    } else {
      alert("Failed to remove player. Please try again.");
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Player Overview</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 pt-2 lg:grid-cols-2">
          <div className="flex flex-col items-center gap-4">
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
                    {player.userClubs.map((uc) => uc.club?.name ?? "").filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>

          <PlayerCapabilitiesRadarCard
            playerId={player.id}
            title="Skill Radar"
            journeyLabel="Goto Journey"
            journeyHref={`/coach/players/${player.id}`}
          />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Button asChild variant="outline" className="w-full">
            <Link href={`/coach/players/${player.id}`} className="flex items-center justify-center gap-2">
              <ExternalLink size={16} />
              Goto/Open Player
            </Link>
          </Button>

          {onRemove && (
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={handleRemove}
              disabled={removing}
            >
              <Trash2 size={16} />
              {removing ? "Removing…" : "Delete Player"}
            </Button>
          )}
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
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErrorMsg("A valid email is required."); return; }
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

  // Assign lesson modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetPlayerId, setAssignTargetPlayerId] = useState<string | null>(null);

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
      setPlayers(Array.isArray(p) ? p.filter(Boolean) : []);
      if (Array.isArray(clubs)) {
        setMyClubs(clubs.map((uc: { club: Club }) => uc.club).filter(Boolean));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [role]);

  const isCoachOrAdmin = role === "COACH" || role === "ADMIN";

  if (loading) return <div className="p-4">Loading…</div>;

  return (
    <DndLessonProvider
      onAssigned={(target) => {
        if (target.kind === "player") {
          toast.success(`Lesson assigned to ${target.playerName}.`);
        }
      }}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[var(--golf-heading)]">Players</h1>
          {isCoachOrAdmin && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAssignTargetPlayerId(null);
                  setAssignModalOpen(true);
                }}
                className="gap-2"
              >
                <BookOpen size={16} />
                Assign Lesson
              </Button>
              <Button
                onClick={() => setShowInvite(true)}
                className="gap-2"
              >
                <UserPlus size={16} />
                Add User
              </Button>
            </div>
          )}
        </div>

        {players.length === 0 ? (
          <p className="text-sm text-[var(--golf-muted-text)]">No players found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {players.map((player) => {
                  const isInactive = !player.lastLogin;

              return (
                <DroppableZone
                  key={player.id}
                  id={`player:${player.id}:${playerName(player)}`}
                  className="rounded-xl"
                  activeClassName="ring-2 ring-primary ring-offset-1 bg-primary/5"
                >
                  <div
                    className="flex flex-col items-center gap-2 rounded-xl border border-[var(--golf-muted)] bg-white p-4 shadow-sm hover:shadow-md transition-all cursor-pointer select-none"
                    onClick={() => setSelectedPlayer(player)}
                    title="Click to view details"
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
                    {/* Quick-assign button for touch / non-DnD */}
                    {isCoachOrAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs gap-1 px-2 opacity-60 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignTargetPlayerId(player.id);
                          setAssignModalOpen(true);
                        }}
                        title="Assign lesson to this player"
                      >
                        <BookOpen className="h-3 w-3" />
                        Assign
                      </Button>
                    )}
                  </div>
                </DroppableZone>
              );
            })}
          </div>
        )}

        {selectedPlayer && (
          <PlayerDetailDialog
            player={selectedPlayer}
            onClose={() => setSelectedPlayer(null)}
            onRemove={(playerId) => {
              setPlayers((prev) => prev.filter((p) => p.id !== playerId));
              setSelectedPlayer(null);
            }}
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

        <AssignLessonModal
          open={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setAssignTargetPlayerId(null);
          }}
          preselectedPlayerId={assignTargetPlayerId}
          onAssigned={() => toast.success("Lesson assigned successfully.")}
        />
      </div>
    </DndLessonProvider>
  );
}
