"use client";

import { useEffect, useState, useRef } from "react";
import { Trash2, Plus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Player = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImage: string | null;
};

type TeamMember = {
  id: string;
  userId: string;
  user: Player;
};

type Team = {
  id: string;
  shortName: string;
  description: string;
  category: string;
  members: TeamMember[];
};

type FormState = {
  shortName: string;
  description: string;
  category: string;
  categoryInput: string;
};

const EMPTY_FORM: FormState = {
  shortName: "",
  description: "",
  category: "",
  categoryInput: "",
};

function initials(p: Player) {
  return `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function TeamsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setRole(data?.role ?? null));
  }, []);

  useEffect(() => {
    if (role !== "COACH") return;
    Promise.all([
      fetch("/api/teams").then((r) => r.json()),
      fetch("/api/teams/categories").then((r) => r.json()),
      fetch("/api/teams/club-players").then((r) => r.json()),
    ]).then(([t, c, p]) => {
      setTeams(Array.isArray(t) ? t : []);
      setCategories(Array.isArray(c) ? c : []);
      setPlayers(Array.isArray(p) ? p : []);
      setLoading(false);
    });
  }, [role]);

  function resolvedCategory() {
    return form.categoryInput.trim() || form.category;
  }

  function validateForm(): boolean {
    if (!form.shortName.trim()) { setFormError("Short name is required."); return false; }
    if (form.shortName.trim().length > 15) { setFormError("Short name must be ≤ 15 characters."); return false; }
    if (!form.description.trim()) { setFormError("Description is required."); return false; }
    if (form.description.trim().length < 100) { setFormError("Description must be at least 100 characters."); return false; }
    if (form.description.trim().length > 200) { setFormError("Description must be ≤ 200 characters."); return false; }
    const cat = resolvedCategory();
    if (!cat) { setFormError("Category is required."); return false; }
    if (cat.length > 15) { setFormError("Category must be ≤ 15 characters."); return false; }
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
        shortName: form.shortName.trim(),
        description: form.description.trim(),
        category: resolvedCategory(),
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
    const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    if (res.ok) setTeams((prev) => prev.filter((t) => t.id !== teamId));
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
    }
    setAddMemberTeamId(null);
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    const res = await fetch(`/api/teams/${teamId}/members/${userId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const updated = await res.json();
      setTeams((prev) => prev.map((t) => (t.id === teamId ? updated : t)));
    }
  }

  if (role && role !== "COACH") {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Only coaches can manage teams.</p>
      </div>
    );
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
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

          <div className="space-y-1">
            <Label htmlFor="shortName">Short Name <span className="text-gray-400 text-xs">(max 15 chars)</span></Label>
            <Input
              id="shortName"
              maxLength={15}
              value={form.shortName}
              onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
              placeholder="e.g. Team Alpha"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">
              Description{" "}
              <span className="text-gray-400 text-xs">
                (100–200 chars, {form.description.length}/200)
              </span>
            </Label>
            <Textarea
              id="description"
              maxLength={200}
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the team's purpose and goals…"
            />
          </div>

          <div className="space-y-1">
            <Label>Category <span className="text-gray-400 text-xs">(max 15 chars)</span></Label>
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
              maxLength={15}
              value={form.categoryInput}
              onChange={(e) => setForm((f) => ({ ...f, categoryInput: e.target.value, category: "" }))}
              placeholder={categories.length > 0 ? "Or type a new category…" : "Type a category…"}
            />
          </div>

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
      {teams.length === 0 ? (
        <p className="text-sm text-gray-500">No teams yet. Create your first team above.</p>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Members</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {teams.map((team) => {
                const teamPlayerIds = new Set(team.members.map((m) => m.userId));
                const availablePlayers = players.filter((p) => !teamPlayerIds.has(p.id));
                return (
                  <tr key={team.id} className="align-top">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{team.shortName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{team.category}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">{team.description}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {team.members.map((m) => (
                          <div key={m.userId} className="relative group">
                            <Avatar className="h-7 w-7 text-xs" title={`${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim()}>
                              {m.user.profileImage && <AvatarImage src={m.user.profileImage} alt={initials(m.user)} />}
                              <AvatarFallback className="bg-blue-100 text-blue-700">{initials(m.user)}</AvatarFallback>
                            </Avatar>
                            <button
                              onClick={() => handleRemoveMember(team.id, m.userId)}
                              className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white"
                              aria-label="Remove member"
                            >
                              <X size={8} />
                            </button>
                          </div>
                        ))}
                        {availablePlayers.length > 0 && (
                          addMemberTeamId === team.id ? (
                            <div className="flex items-center gap-1">
                              <Select onValueChange={(userId) => handleAddMember(team.id, userId)}>
                                <SelectTrigger className="h-7 text-xs w-40">
                                  <SelectValue placeholder="Select player…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availablePlayers.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.id}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setAddMemberTeamId(null)}
                              >
                                <X size={12} />
                              </Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAddMemberTeamId(team.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500"
                              aria-label="Add member"
                            >
                              <UserPlus size={12} />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(team.id)}
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
    </div>
  );
}
