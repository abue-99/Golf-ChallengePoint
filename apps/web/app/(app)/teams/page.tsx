"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, SquarePen, Plus, UserPlus, X, Search, ExternalLink, Route as RouteIcon, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { PlayerCapabilitiesRadarCard } from "@/components/player-capabilities-widget";
import { DevelopmentPlanManager } from "@/components/DevelopmentPlanManager";
import TeamTrainingWindowsView from "@/components/TeamTrainingWindowsView";

// Common icons represented as emoji for team assignment
const TEAM_ICONS = [
  "⛳", "🏌️", "🏆", "⭐", "🎯", "🔥", "💪", "🌟", "🦅", "🐯",
  "🦁", "🚀", "🎖️", "🥇", "⚡", "🌊", "🏅", "🎽", "🧠", "💎",
];

// Colored circle icons stored as "circle:#hex"
const TEAM_COLOR_CIRCLES: { value: string; label: string }[] = [
  { value: "circle:#ef4444", label: "Red" },
  { value: "circle:#f97316", label: "Orange" },
  { value: "circle:#f59e0b", label: "Amber" },
  { value: "circle:#eab308", label: "Yellow" },
  { value: "circle:#84cc16", label: "Lime" },
  { value: "circle:#22c55e", label: "Green" },
  { value: "circle:#10b981", label: "Emerald" },
  { value: "circle:#14b8a6", label: "Teal" },
  { value: "circle:#06b6d4", label: "Cyan" },
  { value: "circle:#3b82f6", label: "Blue" },
  { value: "circle:#6366f1", label: "Indigo" },
  { value: "circle:#8b5cf6", label: "Violet" },
  { value: "circle:#ec4899", label: "Pink" },
  { value: "circle:#f43f5e", label: "Rose" },
  { value: "circle:#64748b", label: "Slate" },
];

/** Renders a team icon – either a coloured circle SVG or an emoji string. */
function TeamIcon({
  icon,
  size = 22,
  className = "",
}: {
  icon: string;
  size?: number;
  className?: string;
}) {
  if (icon.startsWith("circle:")) {
    const color = icon.slice(7);
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 22 22"
        className={className}
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="10" fill={color} />
      </svg>
    );
  }
  return <span className={`text-[${size}px] leading-none ${className}`}>{icon}</span>;
}

type ClubOption = { id: string; shortId?: string | null; name: string };

type Player = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImage: string | null;
  email?: string;
  phoneNumber?: string | null;
  timezone?: string | null;
  lastLogin?: string | null;
  role?: string;
  userClubs?: { clubId: string; club: { id: string; name: string } | null }[];
  coaches?: { id: string; firstName: string | null; lastName: string | null; profileImage: string | null; email?: string }[];
};

type TeamMember = {
  id: string;
  userId: string;
  user: Player | null;
};

type Team = {
  id: string;
  icon: string | null;
  shortName: string;
  description: string | null;
  category: string;
  clubId: string | null;
  members: TeamMember[];
};

type FormState = {
  icon: string;
  shortName: string;
  description: string;
  category: string;
  categoryInput: string;
  clubId: string;
};

const EMPTY_FORM: FormState = {
  icon: "",
  shortName: "",
  description: "",
  category: "",
  categoryInput: "",
  clubId: "",
};

function initials(p: Player) {
  return `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function TeamsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [myPlayers, setMyPlayers] = useState<Player[]>([]);
  const [myClubs, setMyClubs] = useState<ClubOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  // Players filtered for the "add member" dropdown of a specific team
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [teamPlayersLoading, setTeamPlayersLoading] = useState(false);

  const [selectedMemberPlayer, setSelectedMemberPlayer] = useState<Player | null>(null);
  const [journeyTeam, setJourneyTeam] = useState<Team | null>(null);
  const [trainingWindowsTeam, setTrainingWindowsTeam] = useState<Team | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setRole(data?.role ?? null));
  }, []);

  useEffect(() => {
    if (role !== "COACH" && role !== "ADMIN") return;
    Promise.all([
      fetch("/api/teams").then((r) => r.ok ? r.json() : []),
      fetch("/api/teams/categories").then((r) => r.ok ? r.json() : []),
      fetch("/api/teams/club-players").then((r) => r.ok ? r.json() : []),
      fetch("/api/clubs/my").then((r) => r.ok ? r.json() : []),
      fetch("/api/players/my").then((r) => r.ok ? r.json() : []),
    ]).then(([t, c, p, clubs, myP]) => {
      setTeams(Array.isArray(t) ? t : []);
      setCategories(Array.isArray(c) ? c : []);
      setAllPlayers(Array.isArray(p) ? p.filter(Boolean) : []);
      setMyPlayers(Array.isArray(myP) ? myP.filter(Boolean) : []);
      // clubs/my returns UserClub[] with club embedded
      if (Array.isArray(clubs)) {
        setMyClubs(clubs.map((uc: { club: ClubOption }) => uc.club).filter(Boolean));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [role]);

  function resolvedCategory() {
    return form.categoryInput.trim() || form.category;
  }

  function validateForm(): boolean {
    if (!form.shortName.trim()) { setFormError("Short name is required."); return false; }
    if (form.shortName.trim().length > 20) { setFormError("Short name must be ≤ 20 characters."); return false; }
    if (form.description.trim().length > 200) { setFormError("Description must be ≤ 200 characters."); return false; }
    const cat = resolvedCategory();
    if (cat.length > 50) { setFormError("Category must be ≤ 50 characters."); return false; }
    setFormError("");
    return true;
  }

  async function handleCreate() {
    if (!validateForm()) return;
    setSaving(true);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        icon: form.icon || null,
        shortName: form.shortName.trim(),
        description: form.description.trim() || null,
        category: resolvedCategory(),
        clubId: form.clubId || null,
      }),
    });
    if (res.ok) {
      const newTeam = await res.json();
      setTeams((prev) => [...prev, newTeam]);
      const cat = resolvedCategory();
      if (!categories.includes(cat)) setCategories((prev) => [...prev, cat]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } else {
      setFormError("Failed to create team.");
    }
    setSaving(false);
  }

  async function handleDelete(teamId: string) {
    if (!window.confirm("Are you sure you want to delete this team? This action cannot be undone.")) return;
    const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    if (res.ok) {
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      setEditingTeam((prev) => (prev?.id === teamId ? null : prev));
    }
  }

  async function openAddMember(team: Team) {
    setAddMemberTeamId(team.id);
    setTeamPlayersLoading(true);
    try {
      const url = team.clubId
        ? `/api/teams/club-players?clubId=${encodeURIComponent(team.clubId)}`
        : "/api/teams/club-players";
      const res = await fetch(url);
      const data = await res.json();
      setTeamPlayers(Array.isArray(data) ? data.filter(Boolean) : []);
    } finally {
      setTeamPlayersLoading(false);
    }
  }

  async function handleAddMember(teamId: string, userId: string) {
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTeams((prev) => prev.map((t) => (t.id === teamId ? updated : t)));
      setEditingTeam((prev) => (prev?.id === teamId ? updated : prev));
    }
    setAddMemberTeamId(null);
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    if (!window.confirm("Remove this member from the team?")) return;
    const res = await fetch(`/api/teams/${teamId}/members/${userId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const updated = await res.json();
      setTeams((prev) => prev.map((t) => (t.id === teamId ? updated : t)));
      setEditingTeam((prev) => (prev?.id === teamId ? updated : prev));
    }
  }

  async function handleUpdate(teamId: string, data: Partial<FormState>) {
    const res = await fetch(`/api/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        icon: data.icon ?? null,
        shortName: data.shortName?.trim(),
        description: data.description?.trim() || null,
        category: data.categoryInput?.trim() || data.category,
        clubId: data.clubId || null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTeams((prev) => prev.map((t) => (t.id === teamId ? updated : t)));
      setEditingTeam(updated);
    }
    return res.ok;
  }

  const filtered = teams.filter((t) => {
    const q = search.toLowerCase();
    const club = myClubs.find((c) => c.id === t.clubId)?.name ?? "";
    return (
      t.shortName.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q) ||
      club.toLowerCase().includes(q)
    );
  });

  if (role && role !== "COACH" && role !== "ADMIN") {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Only coaches and admins can manage teams.</p>
      </div>
    );
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-3 max-w-6xl">
      <h1 className="text-2xl font-bold">Teams</h1>

      {/* New Team Form */}
      {showForm && (
        <div className="rounded-xl border bg-white p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700">New Team</h2>

          {/* Icon picker */}
          <div className="space-y-1">
            <Label>Icon <span className="text-gray-400 text-xs">(optional)</span></Label>
            {/* Emoji icons + colored circles in one row */}
            <div className="flex flex-wrap gap-1">
              {TEAM_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, icon: f.icon === emoji ? "" : emoji }))}
                  className={`text-base p-1 rounded border transition-colors ${
                    form.icon === emoji
                      ? "border-blue-500 bg-blue-50"
                      : "border-transparent hover:border-gray-300"
                  }`}
                  aria-label={`Select icon ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              {TEAM_COLOR_CIRCLES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, icon: f.icon === value ? "" : value }))}
                  className={`p-1 rounded-full border transition-colors ${
                    form.icon === value
                      ? "border-blue-500 ring-2 ring-blue-300"
                      : "border-transparent hover:border-gray-400"
                  }`}
                  aria-label={`Select ${label} circle`}
                  title={label}
                >
                  <TeamIcon icon={value} size={18} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="shortName">Short Name <span className="text-gray-400 text-xs">(max 20 chars)</span></Label>
            <Input
              id="shortName"
              maxLength={20}
              value={form.shortName}
              onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
              placeholder="e.g. Team Alpha"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">
              Description{" "}
              <span className="text-gray-400 text-xs">
                (optional, max 200 chars — {form.description.length}/200)
              </span>
            </Label>
            <Textarea
              id="description"
              maxLength={200}
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the team's purpose and goals…"
            />
          </div>

          <div className="space-y-1">
            <Label>Category <span className="text-gray-400 text-xs">(optional)</span></Label>
            {categories.length > 0 && !form.categoryInput && (
              <Select
                value={form.category}
                onValueChange={(val) => setForm((f) => ({ ...f, category: val, categoryInput: "" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select existing or type new below" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              value={form.categoryInput}
              onChange={(e) => setForm((f) => ({ ...f, categoryInput: e.target.value, category: "" }))}
              placeholder={categories.length > 0 ? "Or type a new category…" : "Type a category…"}
            />
          </div>

          {myClubs.length > 0 && (
            <div className="space-y-1">
              <Label>Club <span className="text-gray-400 text-xs">(optional – limits member selection)</span></Label>
              <Select
                value={form.clubId || "__none__"}
                onValueChange={(val) => setForm((f) => ({ ...f, clubId: val === "__none__" ? "" : val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All clubs (no restriction)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All clubs (no restriction)</SelectItem>
                  {myClubs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create Team"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Teams Table */}
      {/* Search bar + New Team button in one row directly above the table */}
      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-8"
            placeholder="Search teams…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          onClick={() => { setShowForm((v) => !v); setForm(EMPTY_FORM); setFormError(""); }}
        >
          <Plus size={16} className="mr-1" /> New Team
        </Button>
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-gray-500">No teams yet. Create your first team above.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No matching teams found.</p>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">Team</th>
                <th className="hidden sm:table-cell px-4 py-2 text-left">Description</th>
                <th className="hidden sm:table-cell px-4 py-2 text-left">Category</th>
                <th className="hidden sm:table-cell px-4 py-2 text-left">Club</th>
                <th className="hidden sm:table-cell px-4 py-2 text-left">Members</th>
                <th className="hidden sm:table-cell px-4 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((team) => {
                const teamMemberIds = new Set(team.members.map((m) => m.userId));
                const isAddingToThisTeam = addMemberTeamId === team.id;
                const availablePlayers = (isAddingToThisTeam ? teamPlayers : allPlayers)
                  .filter((p) => !teamMemberIds.has(p.id));
                const club = myClubs.find((c) => c.id === team.clubId);
                const clubDisplayName = club ? (club.shortId || club.name) : null;
                const clubFullName = club?.name;

                const membersContent = (
                  <div className="flex flex-wrap items-center gap-1">
                    {team.members.map((m) => (
                      <div key={m.userId} className="relative group">
                        <Avatar
                          className="h-7 w-7 text-xs cursor-pointer"
                          title={`${m.user?.firstName ?? ""} ${m.user?.lastName ?? ""}`.trim()}
                          onClick={(e) => { e.stopPropagation(); if (m.user) setSelectedMemberPlayer(m.user); }}
                        >
                          {m.user?.profileImage && <AvatarImage src={m.user.profileImage} alt={initials(m.user)} />}
                          <AvatarFallback className="bg-blue-100 text-blue-700">{m.user ? initials(m.user) : "?"}</AvatarFallback>
                        </Avatar>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveMember(team.id, m.userId); }}
                          className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white"
                          aria-label="Remove member"
                        >
                          <X size={8} />
                        </button>
                      </div>
                    ))}
                    {isAddingToThisTeam ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {teamPlayersLoading ? (
                          <span className="text-xs text-gray-400">Loading…</span>
                        ) : availablePlayers.length > 0 ? (
                          <Select onValueChange={(userId) => handleAddMember(team.id, userId)}>
                            <SelectTrigger className="h-7 text-xs w-44">
                              <SelectValue placeholder="Select member…" />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePlayers.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.id}
                                  {p.role && p.role !== "PLAYER" && (
                                    <span className="ml-1 text-gray-400 text-xs">({p.role})</span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-gray-400">No available members</span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); setAddMemberTeamId(null); }}
                        >
                          <X size={12} />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); openAddMember(team); }}
                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500"
                        aria-label="Add member"
                      >
                        <UserPlus size={12} />
                      </button>
                    )}
                  </div>
                );

                const actionsContent = (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-500 hover:text-emerald-600"
                      onClick={(e) => { e.stopPropagation(); setJourneyTeam(team); }}
                      aria-label="Team Journey"
                      title="Journey"
                    >
                      <RouteIcon size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-500 hover:text-blue-600"
                      onClick={(e) => { e.stopPropagation(); setTrainingWindowsTeam(team); }}
                      aria-label="Team Training Windows"
                      title="Training Windows"
                    >
                      <CalendarDays size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-500 hover:text-blue-600"
                      onClick={(e) => { e.stopPropagation(); setEditingTeam(team); }}
                      aria-label="Edit team"
                      title="Edit team"
                    >
                      <SquarePen size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-gray-600"
                      onClick={(e) => { e.stopPropagation(); handleDelete(team.id); }}
                      aria-label="Delete team"
                      title="Delete team"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                );

                return (
                  <React.Fragment key={team.id}>
                    <tr
                      className="align-top cursor-pointer hover:bg-gray-50 sm:border-b sm:border-gray-200"
                      onDoubleClick={() => setEditingTeam(team)}
                      title="Double-click to edit"
                    >
                      <td className="px-4 py-1.5 font-medium">
                        <div className="flex items-center gap-1.5">
                          {team.icon && <TeamIcon icon={team.icon} size={14} />}
                          <span className="whitespace-nowrap">{team.shortName}</span>
                          {(team.category || team.description) && (
                            <span className="sm:hidden flex items-center gap-1 min-w-0">
                              {team.category && (
                                <span className="text-xs font-normal text-gray-500 whitespace-nowrap">· {team.category}</span>
                              )}
                              {team.description && (
                                <span className="text-xs font-normal text-gray-400 truncate max-w-[100px]">
                                  · {team.description.slice(0, 50)}{team.description.length > 50 ? "…" : ""}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-1.5 text-gray-600 max-w-xs">
                       {team.description
                         ? `${team.description.slice(0, 50)}${team.description.length > 50 ? "…" : ""}`
                         : <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-1.5 whitespace-nowrap text-gray-500">{team.category}</td>
                      <td className="hidden sm:table-cell px-4 py-1.5 whitespace-nowrap text-gray-500">
                        {clubDisplayName
                          ? <span title={clubFullName}>{clubDisplayName}</span>
                          : <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-1.5 min-w-[160px]">
                        {membersContent}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-1.5 text-right">
                        {actionsContent}
                      </td>
                    </tr>
                    {/* Mobile-only second row: members + action buttons */}
                    <tr className="sm:hidden border-b border-gray-200">
                      <td colSpan={1} className="px-4 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          {membersContent}
                          {actionsContent}
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Team Dialog */}
      {editingTeam && (
        <EditTeamDialog
          team={editingTeam}
          categories={categories}
          myClubs={myClubs}
          allPlayers={allPlayers}
          onClose={() => setEditingTeam(null)}
          onUpdate={handleUpdate}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
        />
      )}

      {/* Member Detail Dialog */}
      {selectedMemberPlayer && (
        <PlayerDetailDialog
          player={selectedMemberPlayer}
          onClose={() => setSelectedMemberPlayer(null)}
        />
      )}

      {/* Team Journey Dialog */}
      {journeyTeam && (
        <TeamJourneyDialog
          team={journeyTeam}
          onClose={() => setJourneyTeam(null)}
        />
      )}

      {/* Team Training Windows Dialog */}
      {trainingWindowsTeam && (
        <TeamTrainingWindowsDialog
          team={trainingWindowsTeam}
          onClose={() => setTrainingWindowsTeam(null)}
        />
      )}

      {/* ── Players Section ── */}
      <div className="mt-10">
      <PlayersSection
        players={myPlayers}
        myClubs={myClubs}
        onPlayerInvited={(newPlayer) =>
          setMyPlayers((prev) => {
            const exists = prev.some((p) => p.id === newPlayer.id);
            return exists ? prev : [...prev, newPlayer];
          })
        }
        onPlayerRemoved={(playerId) =>
          setMyPlayers((prev) => prev.filter((p) => p.id !== playerId))
        }
      />
      </div>
    </div>
  );
}

// ── Edit Team Dialog ──────────────────────────────────────────────────────────

function EditTeamDialog({
  team,
  categories,
  myClubs,
  allPlayers,
  onClose,
  onUpdate,
  onAddMember,
  onRemoveMember,
}: {
  team: Team;
  categories: string[];
  myClubs: ClubOption[];
  allPlayers: Player[];
  onClose: () => void;
  onUpdate: (teamId: string, data: Partial<FormState>) => Promise<boolean>;
  onAddMember: (teamId: string, userId: string) => Promise<void>;
  onRemoveMember: (teamId: string, userId: string) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>({
    icon: team.icon ?? "",
    shortName: team.shortName,
    description: team.description ?? "",
    category: team.category,
    categoryInput: "",
    clubId: team.clubId ?? "",
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editPlayersLoading, setEditPlayersLoading] = useState(false);
  const [editPlayers, setEditPlayers] = useState<Player[]>(allPlayers);

  // Re-sync form when the team prop changes (e.g. after member add/remove)
  useEffect(() => {
    setForm({
      icon: team.icon ?? "",
      shortName: team.shortName,
      description: team.description ?? "",
      category: team.category,
      categoryInput: "",
      clubId: team.clubId ?? "",
    });
  }, [team]);

  // Load club-filtered players when clubId changes
  useEffect(() => {
    if (!team.clubId) {
      setEditPlayers(allPlayers);
      return;
    }
    setEditPlayersLoading(true);
    fetch(`/api/teams/club-players?clubId=${encodeURIComponent(team.clubId)}`)
      .then((r) => r.json())
      .then((data) => setEditPlayers(Array.isArray(data) ? data.filter(Boolean) : []))
      .catch(() => setEditPlayers(allPlayers))
      .finally(() => setEditPlayersLoading(false));
  }, [team.clubId, allPlayers]);

  function resolvedCategory() {
    return form.categoryInput.trim() || form.category;
  }

  async function handleSave() {
    if (!form.shortName.trim()) { setFormError("Short name is required."); return; }
    if (form.shortName.trim().length > 20) { setFormError("Short name must be ≤ 20 characters."); return; }
    if (form.description.trim().length > 200) { setFormError("Description must be ≤ 200 characters."); return; }
    const cat = resolvedCategory();
    setFormError("");
    setSaving(true);
    const ok = await onUpdate(team.id, { ...form, category: cat, categoryInput: "" });
    setSaving(false);
    if (ok) {
      onClose();
    } else {
      setFormError("Failed to save.");
    }
  }

  const memberIds = new Set(team.members.map((m) => m.userId));
  const availablePlayers = editPlayers.filter((p) => !memberIds.has(p.id));

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Icon picker */}
          <div className="space-y-1">
            <Label>Icon <span className="text-gray-400 text-xs">(optional)</span></Label>
            <div className="flex flex-wrap gap-1">
              {TEAM_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, icon: f.icon === emoji ? "" : emoji }))}
                  className={`text-base p-1 rounded border transition-colors ${
                    form.icon === emoji
                      ? "border-blue-500 bg-blue-50"
                      : "border-transparent hover:border-gray-300"
                  }`}
                  aria-label={`Select icon ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              {TEAM_COLOR_CIRCLES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, icon: f.icon === value ? "" : value }))}
                  className={`p-1 rounded-full border transition-colors ${
                    form.icon === value
                      ? "border-blue-500 ring-2 ring-blue-300"
                      : "border-transparent hover:border-gray-400"
                  }`}
                  aria-label={`Select ${label} circle`}
                  title={label}
                >
                  <TeamIcon icon={value} size={18} />
                </button>
              ))}
            </div>
          </div>

          {/* Short Name */}
          <div className="space-y-1">
            <Label htmlFor="edit-shortName">Short Name <span className="text-gray-400 text-xs">(max 20 chars)</span></Label>
            <Input
              id="edit-shortName"
              maxLength={20}
              value={form.shortName}
              onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="edit-description">
              Description{" "}
              <span className="text-gray-400 text-xs">
                (optional, max 200 chars — {form.description.length}/200)
              </span>
            </Label>
            <Textarea
              id="edit-description"
              maxLength={200}
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Category */}
          <div className="space-y-1">
            <Label>Category <span className="text-gray-400 text-xs">(optional)</span></Label>
            {categories.length > 0 && !form.categoryInput && (
              <Select
                value={form.category}
                onValueChange={(val) => setForm((f) => ({ ...f, category: val, categoryInput: "" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select existing or type new below" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              value={form.categoryInput}
              onChange={(e) => setForm((f) => ({ ...f, categoryInput: e.target.value, category: "" }))}
              placeholder={categories.length > 0 ? "Or type a new category…" : "Type a category…"}
            />
          </div>

          {/* Club */}
          {myClubs.length > 0 && (
            <div className="space-y-1">
              <Label>Club <span className="text-gray-400 text-xs">(optional)</span></Label>
              <Select
                value={form.clubId || "__none__"}
                onValueChange={(val) => setForm((f) => ({ ...f, clubId: val === "__none__" ? "" : val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All clubs (no restriction)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All clubs (no restriction)</SelectItem>
                  {myClubs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Members */}
          <div className="space-y-2">
            <Label>Members</Label>
            {team.members.length > 0 ? (
              <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-gray-50">
                {team.members.map((m) => (
                  <span
                    key={m.userId}
                    className="inline-flex items-center gap-1 rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-800"
                  >
                    <Avatar className="h-4 w-4 text-[8px]">
                      {m.user?.profileImage && <AvatarImage src={m.user.profileImage} alt={initials(m.user)} />}
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-[8px]">{m.user ? initials(m.user) : "?"}</AvatarFallback>
                    </Avatar>
                    {m.user ? (`${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim() || m.userId) : m.userId}
                    <button
                      type="button"
                      aria-label="Remove member"
                      onClick={() => onRemoveMember(team.id, m.userId)}
                      className="ml-0.5 hover:text-red-600"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No members yet.</p>
            )}
            {editPlayersLoading ? (
              <p className="text-xs text-gray-400">Loading players…</p>
            ) : availablePlayers.length > 0 ? (
              <Select onValueChange={(userId) => onAddMember(team.id, userId)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Add a member…" />
                </SelectTrigger>
                <SelectContent>
                  {availablePlayers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.id}
                      {p.role && p.role !== "PLAYER" && (
                        <span className="ml-1 text-gray-400 text-xs">({p.role})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Players Section ───────────────────────────────────────────────────────────

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
  const name = `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim() || player.email || "—";
  const playerInitials = `${player.firstName?.[0] ?? ""}${player.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    if (!window.confirm(`Remove "${name}" from your players list?`)) return;
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
                <AvatarImage src={player.profileImage} alt={name} />
              )}
              <AvatarFallback className="text-2xl bg-gray-200 text-gray-600">
                {playerInitials}
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
                <span>{name}</span>
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
              {player.coaches && player.coaches.length > 0 && (
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-gray-500 shrink-0">Coaches</span>
                  <span className="text-right">
                    {player.coaches
                      .map((c) => `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.email || "")
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              )}
            </div>

            <Button asChild variant="outline" className="w-full mt-2">
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

          <div>
            <PlayerCapabilitiesRadarCard
              playerId={player.id}
              title="Skill Radar"
              journeyLabel="Goto Development Plan"
              journeyHref={`/coach/players/${player.id}`}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InvitePlayerDialog({
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
    if (!firstName.trim()) { setErrorMsg("First name is required."); return; }
    if (!lastName.trim()) { setErrorMsg("Last name is required."); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg("A valid email is required.");
      return;
    }
    if (!clubId) { setErrorMsg("Please select a club."); return; }

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
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
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

function AddPlayerDialog({
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
        onPlayerAdded(player);
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
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
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
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
                const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email || "—";
                const playerInitials = `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?";
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-50"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      {p.profileImage && <AvatarImage src={p.profileImage} alt={name} />}
                      <AvatarFallback className="text-xs bg-gray-200 text-gray-600">{playerInitials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{name}</div>
                      {p.email && <div className="text-xs text-gray-400 truncate">{p.email}</div>}
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
            <Button
              size="sm"
              onClick={() => setMode("invite")}
            >
              <UserPlus size={14} className="mr-1" />
              Invite New Player
            </Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlayersSection({
  players,
  myClubs,
  onPlayerInvited,
  onPlayerRemoved,
}: {
  players: Player[];
  myClubs: ClubOption[];
  onPlayerInvited: (player: Player) => void;
  onPlayerRemoved: (playerId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  const filtered = players.filter((p) => {
    const q = search.toLowerCase();
    const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.toLowerCase();
    return name.includes(q) || p.id.toLowerCase().includes(q);
  });

  async function handleRemovePlayer(playerId: string, playerName: string) {
    if (!window.confirm(`Remove "${playerName}" from your players list?`)) return;
    const res = await fetch(`/api/players/my/${encodeURIComponent(playerId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onPlayerRemoved(playerId);
    } else {
      alert("Failed to remove player. Please try again.");
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-bold">Players</h2>

      {/* Search bar + Add Player button in one row directly above the grid */}
      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-8"
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={() => setShowAddPlayer(true)} className="gap-2">
          <UserPlus size={16} />
          Add Player
        </Button>
      </div>

      {players.length === 0 ? (
        <p className="text-sm text-gray-500">No players found.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No matching players found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((p) => {
            const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email || "—";
            const playerInitials = `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?";
            const isInactive = !p.lastLogin;

            return (
              <div
                key={p.id}
                className="relative flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-all cursor-pointer select-none group"
                onClick={() => setSelectedPlayer(p)}
                title="Click to view details"
              >
                <button
                 onClick={(e) => { e.stopPropagation(); handleRemovePlayer(p.id, name); }}
                  className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                  aria-label="Remove player"
                  title="Remove player"
                >
                  <X size={10} />
                </button>
                <div className="relative">
                  <Avatar className="h-16 w-16">
                    {p.profileImage && (
                      <AvatarImage src={p.profileImage} alt={name} />
                    )}
                    <AvatarFallback className="text-xl bg-gray-200 text-gray-600">
                      {playerInitials}
                    </AvatarFallback>
                  </Avatar>
                  {isInactive && (
                    <span
                      className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 border-2 border-white"
                      title="Inactive"
                    />
                  )}
                </div>
                <span className="text-sm font-medium text-center text-gray-800 leading-snug">
                  {name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {selectedPlayer && (
        <PlayerDetailDialog
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          onRemove={(playerId) => {
            onPlayerRemoved(playerId);
            setSelectedPlayer(null);
          }}
        />
      )}

      {showAddPlayer && (
        <AddPlayerDialog
          clubs={myClubs}
          myPlayers={players}
          onClose={() => setShowAddPlayer(false)}
          onPlayerAdded={(newPlayer) => {
            onPlayerInvited(newPlayer);
          }}
        />
      )}
    </div>
  );
}

// ── Team Journey Dialog ───────────────────────────────────────────────────────

function TeamJourneyDialog({
  team,
  onClose,
}: {
  team: Team;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              {team.icon && <TeamIcon icon={team.icon} size={18} />}
              Development Plan — {team.shortName}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="pt-2">
          <DevelopmentPlanManager teamId={team.id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Team Training Windows Dialog ──────────────────────────────────────────────

function TeamTrainingWindowsDialog({
  team,
  onClose,
}: {
  team: Team;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              {team.icon && <TeamIcon icon={team.icon} size={18} />}
              Training Windows — {team.shortName}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="pt-2">
          <TeamTrainingWindowsView teamId={team.id} teamName={team.shortName} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
