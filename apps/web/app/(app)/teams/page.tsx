"use client";

import { useEffect, useState } from "react";
import { Trash2, SquarePen, Plus, UserPlus, X, Search } from "lucide-react";
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
  role?: string;
};

type TeamMember = {
  id: string;
  userId: string;
  user: Player;
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

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setRole(data?.role ?? null));
  }, []);

  useEffect(() => {
    if (role !== "COACH" && role !== "ADMIN") return;
    Promise.all([
      fetch("/api/teams").then((r) => r.json()),
      fetch("/api/teams/categories").then((r) => r.json()),
      fetch("/api/teams/club-players").then((r) => r.json()),
      fetch("/api/clubs/my").then((r) => r.json()),
    ]).then(([t, c, p, clubs]) => {
      setTeams(Array.isArray(t) ? t : []);
      setCategories(Array.isArray(c) ? c : []);
      setAllPlayers(Array.isArray(p) ? p : []);
      // clubs/my returns UserClub[] with club embedded
      if (Array.isArray(clubs)) {
        setMyClubs(clubs.map((uc: { club: ClubOption }) => uc.club).filter(Boolean));
      }
      setLoading(false);
    });
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
      setTeamPlayers(Array.isArray(data) ? data : []);
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
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Teams</h1>
        <Button
          size="sm"
          onClick={() => { setShowForm((v) => !v); setForm(EMPTY_FORM); setFormError(""); }}
        >
          <Plus size={16} className="mr-1" /> New Team
        </Button>
      </div>

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
                  className={`text-xl p-1 rounded border transition-colors ${
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
                  <TeamIcon icon={value} size={22} />
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
      {/* Search bar */}
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          className="pl-8"
          placeholder="Search teams…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Club</th>
                <th className="px-4 py-2 text-left">Members</th>
                <th className="px-4 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((team) => {
                const teamMemberIds = new Set(team.members.map((m) => m.userId));
                const isAddingToThisTeam = addMemberTeamId === team.id;
                const availablePlayers = (isAddingToThisTeam ? teamPlayers : allPlayers)
                  .filter((p) => !teamMemberIds.has(p.id));
                const club = myClubs.find((c) => c.id === team.clubId);
                const clubDisplayName = club ? (club.shortId || club.name) : null;
                const clubFullName = club?.name;
                return (
                  <tr
                    key={team.id}
                    className="align-top cursor-pointer hover:bg-gray-50"
                    onDoubleClick={() => setEditingTeam(team)}
                    title="Double-click to edit"
                  >
                    <td className="px-4 py-1.5 font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        {team.icon && <TeamIcon icon={team.icon} size={18} />}
                        {team.shortName}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-gray-600 max-w-xs">
                      {team.description || <span className="text-gray-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-1.5 whitespace-nowrap text-gray-500">{team.category}</td>
                    <td className="px-4 py-1.5 whitespace-nowrap text-gray-500">
                      {clubDisplayName
                        ? <span title={clubFullName}>{clubDisplayName}</span>
                        : <span className="text-gray-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-1.5 min-w-[160px]">
                      <div className="flex flex-wrap items-center gap-1">
                        {team.members.map((m) => (
                          <div key={m.userId} className="relative group">
                            <Avatar className="h-7 w-7 text-xs" title={`${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim()}>
                              {m.user.profileImage && <AvatarImage src={m.user.profileImage} alt={initials(m.user)} />}
                              <AvatarFallback className="bg-blue-100 text-blue-700">{initials(m.user)}</AvatarFallback>
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
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-500 hover:text-blue-600"
                        onClick={(e) => { e.stopPropagation(); setEditingTeam(team); }}
                        aria-label="Edit team"
                      >
                        <SquarePen size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-gray-600"
                        onClick={(e) => { e.stopPropagation(); handleDelete(team.id); }}
                        aria-label="Delete team"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
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

      {/* ── Players Section ── */}
      <PlayersSection players={allPlayers} />
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
  const [savedMsg, setSavedMsg] = useState("");

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
      .then((data) => setEditPlayers(Array.isArray(data) ? data : []))
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
      setSavedMsg("Saved.");
      setTimeout(() => setSavedMsg(""), 2000);
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
                  className={`text-xl p-1 rounded border transition-colors ${
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
                  <TeamIcon icon={value} size={22} />
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
                      {m.user.profileImage && <AvatarImage src={m.user.profileImage} alt={initials(m.user)} />}
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-[8px]">{initials(m.user)}</AvatarFallback>
                    </Avatar>
                    {`${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim() || m.userId}
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
          {savedMsg && <p className="text-sm text-green-600">{savedMsg}</p>}

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

function PlayersSection({
  players,
}: {
  players: Player[];
}) {
  const [search, setSearch] = useState("");

  const filtered = players.filter((p) => {
    const q = search.toLowerCase();
    const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.toLowerCase();
    return name.includes(q) || p.id.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Players</h2>

      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          className="pl-8"
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {players.length === 0 ? (
        <p className="text-sm text-gray-500">No players found.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No matching players found.</p>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left w-10"></th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Club</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => {
                const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "—";
                const playerInitials = `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?";
                return (
                  <tr key={p.id} className="align-middle hover:bg-gray-50">
                    <td className="px-4 py-1">
                      <Avatar className="h-7 w-7 text-xs">
                        {p.profileImage && <AvatarImage src={p.profileImage} alt={playerInitials} />}
                        <AvatarFallback className="bg-blue-100 text-blue-700">{playerInitials}</AvatarFallback>
                      </Avatar>
                    </td>
                    <td className="px-4 py-1 font-medium whitespace-nowrap">{name}</td>
                    <td className="px-4 py-1 text-gray-500">
                      <span className="italic text-gray-400">—</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
