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
import { X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { DevelopmentPlanManager } from "@/components/DevelopmentPlanManager";
import TeamTrainingWindowsView from "@/components/TeamTrainingWindowsView";
import TeamIcon from "@/components/TeamIcon";
import {
  TEAM_COLOR_CIRCLES,
  TEAM_ICONS,
  initials,
  type ClubOption,
  type FormState,
  type Player,
  type Team,
} from "./shared";
// ── Edit Team Dialog ──────────────────────────────────────────────────────────

export function EditTeamDialog({
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

  const [editPlayers, setEditPlayers] = useState<Player[]>(allPlayers);

  // Load club-filtered players when clubId changes
  useEffect(() => {
    if (!team.clubId) {
      return;
    }
    fetch(`/api/teams/club-players?clubId=${encodeURIComponent(team.clubId)}`)
      .then((r) => r.json())
      .then((data) =>
        setEditPlayers(Array.isArray(data) ? data.filter(Boolean) : []),
      )
      .catch(() => setEditPlayers(allPlayers));
  }, [team.clubId, allPlayers]);

  function resolvedCategory() {
    return form.categoryInput.trim() || form.category;
  }

  async function handleSave() {
    if (!form.shortName.trim()) {
      setFormError("Short name is required.");
      return;
    }
    if (form.shortName.trim().length > 20) {
      setFormError("Short name must be ≤ 20 characters.");
      return;
    }
    if (form.description.trim().length > 200) {
      setFormError("Description must be ≤ 200 characters.");
      return;
    }
    const cat = resolvedCategory();
    setFormError("");
    setSaving(true);
    const ok = await onUpdate(team.id, {
      ...form,
      category: cat,
      categoryInput: "",
    });
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
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Icon picker */}
          <div className="space-y-1">
            <Label>
              Icon <span className="text-gray-400 text-xs">(optional)</span>
            </Label>
            <div className="flex flex-wrap gap-1">
              {TEAM_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      icon: f.icon === emoji ? "" : emoji,
                    }))
                  }
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
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      icon: f.icon === value ? "" : value,
                    }))
                  }
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
            <Label htmlFor="edit-shortName">
              Short Name{" "}
              <span className="text-gray-400 text-xs">(max 20 chars)</span>
            </Label>
            <Input
              id="edit-shortName"
              maxLength={20}
              value={form.shortName}
              onChange={(e) =>
                setForm((f) => ({ ...f, shortName: e.target.value }))
              }
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
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>

          {/* Category */}
          <div className="space-y-1">
            <Label>
              Category <span className="text-gray-400 text-xs">(optional)</span>
            </Label>
            {categories.length > 0 && !form.categoryInput && (
              <Select
                value={form.category}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, category: val, categoryInput: "" }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select existing or type new below" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              value={form.categoryInput}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  categoryInput: e.target.value,
                  category: "",
                }))
              }
              placeholder={
                categories.length > 0
                  ? "Or type a new category…"
                  : "Type a category…"
              }
            />
          </div>

          {/* Club */}
          {myClubs.length > 0 && (
            <div className="space-y-1">
              <Label>
                Club <span className="text-gray-400 text-xs">(optional)</span>
              </Label>
              <Select
                value={form.clubId || "__none__"}
                onValueChange={(val) =>
                  setForm((f) => ({
                    ...f,
                    clubId: val === "__none__" ? "" : val,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All clubs (no restriction)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    All clubs (no restriction)
                  </SelectItem>
                  {myClubs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
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
                      {m.user?.profileImage && (
                        <AvatarImage
                          src={m.user.profileImage}
                          alt={initials(m.user)}
                        />
                      )}
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-[8px]">
                        {m.user ? initials(m.user) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    {m.user
                      ? `${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim() ||
                        m.userId
                      : m.userId}
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
            {availablePlayers.length > 0 ? (
              <Select onValueChange={(userId) => onAddMember(team.id, userId)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Add a member…" />
                </SelectTrigger>
                <SelectContent>
                  {availablePlayers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() ||
                        p.id}
                      {p.role && p.role !== "PLAYER" && (
                        <span className="ml-1 text-gray-400 text-xs">
                          ({p.role})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Team Journey Dialog ───────────────────────────────────────────────────────

export function TeamJourneyDialog({
  team,
  onClose,
}: {
  team: Team;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              {team.icon && <TeamIcon icon={team.icon} size={18} />}
              Journeys — {team.shortName}
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

export function TeamTrainingWindowsDialog({
  team,
  onClose,
}: {
  team: Team;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
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

