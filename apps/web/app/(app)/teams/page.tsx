"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  Trash2,
  SquarePen,
  Plus,
  Minus,
  UserPlus,
  X,
  Search,
  Route as RouteIcon,
  CalendarDays,
  BookOpen,
  MoreHorizontal,
} from "lucide-react";
import { DndLessonProvider } from "@/components/DndLessonProvider";
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
import { DevelopmentPlanManager } from "@/components/DevelopmentPlanManager";
import TeamTrainingWindowsView from "@/components/TeamTrainingWindowsView";
import AssignLessonModal from "@/components/AssignLessonModal";
import LessonLibrarySidebar from "@/components/LessonLibrarySidebar";
import type { TrainingLesson } from "@/lib/lesson-types";
import { api } from "@/lib/api";
import JourneyTemplateLibrarySidebar from "@/components/JourneyTemplateLibrarySidebar";
import type { JourneyTemplate } from "@/types/journey-template";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import CompactCoachPlayerCard from "@/components/CompactCoachPlayerCard";
import PlayerOverviewDialog from "@/components/PlayerOverviewDialog";
import TeamIcon from "@/components/TeamIcon";
import { subscribeLearningProgressChanges } from "@/lib/learning-progress-events";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Common icons represented as emoji for team assignment
const TEAM_ICONS = [
  "⛳",
  "🏌️",
  "🏆",
  "⭐",
  "🎯",
  "🔥",
  "💪",
  "🌟",
  "🦅",
  "🐯",
  "🦁",
  "🚀",
  "🎖️",
  "🥇",
  "⚡",
  "🌊",
  "🏅",
  "🎽",
  "🧠",
  "💎",
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
  coaches?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImage: string | null;
    email?: string;
  }[];
  pendingLessons?: number;
  learningProgress?: {
    lessons: {
      PENDING: number;
      ACCEPTED: number;
      ACTIVE: number;
      COMPLETED: number;
    };
    journeys: {
      PENDING: number;
      ACCEPTED: number;
      ACTIVE: number;
      COMPLETED: number;
    };
  };
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
  pendingLessons?: number;
};

type AssignmentTarget =
  | { kind: "player"; playerId: string; playerName: string }
  | { kind: "team"; teamId: string; teamName: string };

type AssignmentResult = {
  id?: string;
  lesson?: { name?: string | null };
  journeyTemplate?: { name?: string | null };
  assignmentsCreated?: number;
  assignments?: {
    id: string;
    playerId: string | null;
    lesson?: { name?: string | null };
  }[];
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

const TEAMS_COLLAPSED_STORAGE_KEY = "teamsCollapsed";
const PLAYERS_COLLAPSED_STORAGE_KEY = "playersCollapsed";

function loadCollapsedPreference(key: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(key) === "true";
}

function saveCollapsedPreference(key: string, value: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, String(value));
}

function initials(p: Player) {
  return (
    `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?"
  );
}

function queueCountLabel(count: number) {
  return count > 99 ? "99+" : String(count);
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  const resolvedLabel = count === 1 ? singular : plural;
  return `${queueCountLabel(count)} ${resolvedLabel}`;
}

function assignmentLessonName(result?: AssignmentResult) {
  return (
    result?.lesson?.name ?? result?.assignments?.[0]?.lesson?.name ?? "Lesson"
  );
}

function assignmentJourneyName(result?: AssignmentResult) {
  return result?.journeyTemplate?.name ?? "Journey";
}

function playerDisplayName(player: Player) {
  return (
    `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim() ||
    player.email ||
    "—"
  );
}

function DroppableTeamCard({
  team,
  teamJourneyCount,
  membersContent,
  footerContent,
  onOpen,
}: {
  team: Team;
  teamJourneyCount: number;
  membersContent: React.ReactNode;
  footerContent: React.ReactNode;
  onOpen: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `team:${team.id}`,
    data: { teamName: team.shortName },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[220px] w-[168px] min-w-[168px] cursor-pointer flex-col rounded-2xl border border-[var(--golf-muted)] bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-[176px] sm:min-w-[176px]",
        isOver && "border-emerald-400 bg-emerald-50 shadow-md ring-2 ring-emerald-400/60",
      )}
      onClick={onOpen}
      title={[team.shortName, team.description?.trim()].filter(Boolean).join(" — ")}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
          {team.icon ? (
            <TeamIcon icon={team.icon} size={18} />
          ) : (
            <span className="text-lg">⛳</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold text-[var(--golf-heading)]"
            title={team.shortName}
          >
            {team.shortName}
          </p>
          <p
            className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-slate-500"
            title={team.description ?? undefined}
          >
            {team.description?.trim() || "No description yet."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
          Members
        </div>
        <div className="mt-2 min-h-[2.25rem]">{membersContent}</div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span>{countLabel(team.members.length, "player")}</span>
            <span className="text-slate-300">•</span>
            <span>{countLabel(teamJourneyCount, "journey")}</span>
          </div>
          {isOver ? (
            <span className="block text-[11px] font-medium text-emerald-700">
              Assign to {team.shortName}
            </span>
          ) : null}
        </div>
        {footerContent}
      </div>
    </div>
  );
}

function DroppablePlayerCard({
  player,
  onOpen,
  onRemove,
}: {
  player: Player;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `player:${player.id}`,
    data: { playerName: playerDisplayName(player) },
  });
  const name = playerDisplayName(player);
  const playerInitials =
    `${player.firstName?.[0] ?? ""}${player.lastName?.[0] ?? ""}`.toUpperCase() ||
    "?";
  const isInactive = !player.lastLogin;

  return (
    <div
      ref={setNodeRef}
      className="relative group w-44 min-w-44 cursor-pointer select-none"
      onClick={onOpen}
      title="Click to view details"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
        aria-label="Remove player"
        title="Remove player"
      >
        <X size={10} />
      </button>
      <CompactCoachPlayerCard
        name={name}
        initials={playerInitials}
        profileImage={player.profileImage}
        progress={player.learningProgress}
        inactive={isInactive}
        className={cn(
          "h-full",
          isOver &&
            "border-emerald-400 bg-emerald-50 shadow-md ring-2 ring-emerald-400/60",
        )}
        contentClassName="gap-2 p-3"
        nameClassName="min-h-[2.2rem] text-[13px]"
        statusContent={isOver ? (
          <span className="text-[11px] font-medium text-emerald-700">
            {`Assign to ${name}`}
          </span>
        ) : undefined}
      />
    </div>
  );
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
  const [teamsCollapsed, setTeamsCollapsed] = useState(() =>
    loadCollapsedPreference(TEAMS_COLLAPSED_STORAGE_KEY),
  );
  const [playersCollapsed, setPlayersCollapsed] = useState(() =>
    loadCollapsedPreference(PLAYERS_COLLAPSED_STORAGE_KEY),
  );

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const [selectedMemberPlayerId, setSelectedMemberPlayerId] = useState<
    string | null
  >(null);
  const [journeyTeam, setJourneyTeam] = useState<Team | null>(null);
  const [trainingWindowsTeam, setTrainingWindowsTeam] = useState<Team | null>(
    null,
  );

  // Badge counts: teamId → count (loaded in background after teams are fetched)
  const [teamWindowCounts, setTeamWindowCounts] = useState<
    Record<string, number>
  >({});
  const [teamPlanCounts, setTeamPlanCounts] = useState<Record<string, number>>(
    {},
  );
  const [playerQueueById, setPlayerQueueById] = useState<
    Record<string, number>
  >({});
  const [assignLesson, setAssignLesson] = useState<TrainingLesson | null>(null);
  const [assignJourney, setAssignJourney] = useState<JourneyTemplate | null>(null);
  const [assignPlayerId, setAssignPlayerId] = useState<string | null>(null);
  const [assignTeamId, setAssignTeamId] = useState<string | null>(null);

  useEffect(() => {
    saveCollapsedPreference(TEAMS_COLLAPSED_STORAGE_KEY, teamsCollapsed);
  }, [teamsCollapsed]);

  useEffect(() => {
    saveCollapsedPreference(PLAYERS_COLLAPSED_STORAGE_KEY, playersCollapsed);
  }, [playersCollapsed]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setRole(data?.role ?? null));
  }, []);

  useEffect(() => {
    if (role !== "COACH" && role !== "ADMIN") return;
    Promise.all([
      fetch("/api/teams").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/teams/categories").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/teams/club-players").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/clubs/my").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/players/my").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([t, c, p, clubs, myP]) => {
        const loadedTeams: Team[] = Array.isArray(t) ? t : [];
        const linkedPlayers: Player[] = Array.isArray(myP)
          ? myP.filter(Boolean)
          : [];
        setTeams(loadedTeams);
        setCategories(Array.isArray(c) ? c : []);
        setAllPlayers(Array.isArray(p) ? p.filter(Boolean) : []);
        setMyPlayers(linkedPlayers);
        setPlayerQueueById(
          Object.fromEntries(
            linkedPlayers.map((player) => [
              player.id,
              player.pendingLessons ?? 0,
            ]),
          ),
        );
        // clubs/my returns UserClub[] with club embedded
        if (Array.isArray(clubs)) {
          setMyClubs(
            clubs.map((uc: { club: ClubOption }) => uc.club).filter(Boolean),
          );
        }
        setLoading(false);

        // Load badge counts for all teams in the background
        loadedTeams.forEach((team) => {
          Promise.allSettled([
            fetch(`/api/calendar/team-slots/${team.id}`, {
              cache: "no-store",
            }).then((r) => (r.ok ? r.json() : [])),
            fetch(`/api/development-plans/team/${team.id}`, {
              cache: "no-store",
            }).then((r) => (r.ok ? r.json() : [])),
          ]).then(([windowsResult, plansResult]) => {
            const windowCount =
              windowsResult.status === "fulfilled" &&
              Array.isArray(windowsResult.value)
                ? windowsResult.value.length
                : 0;
            const planCount =
              plansResult.status === "fulfilled" &&
              Array.isArray(plansResult.value)
                ? plansResult.value.length
                : 0;
            setTeamWindowCounts((prev) => ({
              ...prev,
              [team.id]: windowCount,
            }));
            setTeamPlanCounts((prev) => ({ ...prev, [team.id]: planCount }));
          });
        });
      })
      .catch(() => setLoading(false));
  }, [role]);

  function resolvedCategory() {
    return form.categoryInput.trim() || form.category;
  }

  /** Reload badge counts for a single team (called after dialog close or member change). */
  function refreshTeamBadgeCounts(teamId: string) {
    Promise.allSettled([
      fetch(`/api/calendar/team-slots/${teamId}`, { cache: "no-store" }).then(
        (r) => (r.ok ? r.json() : []),
      ),
      fetch(`/api/development-plans/team/${teamId}`, {
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : [])),
    ]).then(([windowsResult, plansResult]) => {
      const windowCount =
        windowsResult.status === "fulfilled" &&
        Array.isArray(windowsResult.value)
          ? windowsResult.value.length
          : 0;
      const planCount =
        plansResult.status === "fulfilled" && Array.isArray(plansResult.value)
          ? plansResult.value.length
          : 0;
      setTeamWindowCounts((prev) => ({ ...prev, [teamId]: windowCount }));
      setTeamPlanCounts((prev) => ({ ...prev, [teamId]: planCount }));
    });
  }

  const refreshLearningProgressData = useCallback(async () => {
    if (role !== "COACH" && role !== "ADMIN") return;
    try {
      const [teamsResponse, allPlayersResponse, myPlayersResponse] = await Promise.all([
        fetch("/api/teams", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/teams/club-players", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/players/my", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
      ]);

      const nextTeams: Team[] = Array.isArray(teamsResponse) ? teamsResponse : [];
      const nextAllPlayers: Player[] = Array.isArray(allPlayersResponse)
        ? allPlayersResponse.filter(Boolean)
        : [];
      const nextMyPlayers: Player[] = Array.isArray(myPlayersResponse)
        ? myPlayersResponse.filter(Boolean)
        : [];

      setTeams(nextTeams);
      setAllPlayers(nextAllPlayers);
      setMyPlayers(nextMyPlayers);
      setEditingTeam((prev) =>
        prev ? nextTeams.find((team) => team.id === prev.id) ?? null : prev,
      );
      setPlayerQueueById(
        Object.fromEntries(
          nextMyPlayers.map((player) => [player.id, player.pendingLessons ?? 0]),
        ),
      );
    } catch {}
  }, [role]);

  useEffect(() => {
    if (role !== "COACH" && role !== "ADMIN") return;
    return subscribeLearningProgressChanges(() => {
      void refreshLearningProgressData();
    });
  }, [refreshLearningProgressData, role]);

  const selectedMemberPlayer = selectedMemberPlayerId
    ? myPlayers.find((player) => player.id === selectedMemberPlayerId) ??
      allPlayers.find((player) => player.id === selectedMemberPlayerId) ??
      teams
        .flatMap((team) => team.members)
        .find((member) => member.user?.id === selectedMemberPlayerId)
        ?.user ??
      null
    : null;

  function applyOptimisticAssignment(
    target: AssignmentTarget,
    result?: AssignmentResult,
  ) {
    const affectedPlayerIds =
      target.kind === "player"
        ? [target.playerId]
        : (result?.assignments
            ?.map((assignment) => assignment.playerId)
            .filter((playerId): playerId is string => Boolean(playerId)) ??
          teams
            .find((team) => team.id === target.teamId)
            ?.members.map((member) => member.userId) ??
          []);

    setPlayerQueueById((prev) => {
      const next = { ...prev };
      affectedPlayerIds.forEach((playerId) => {
        next[playerId] = (next[playerId] ?? 0) + 1;
      });
      return next;
    });
  }

  function handleAssignmentSuccess(
    target: AssignmentTarget,
    result?: AssignmentResult,
  ) {
    applyOptimisticAssignment(target, result);
    void refreshLearningProgressData();
    const lessonName = assignmentLessonName(result);

    if (target.kind === "player") {
      toast.success(`${lessonName} assigned to ${target.playerName}`);
      return;
    }

    const assignmentsCreated =
      result?.assignmentsCreated ?? result?.assignments?.length ?? 0;
    toast.success(`${lessonName} assigned to ${target.teamName}`, {
      description: `${assignmentsCreated} queues updated`,
    });
  }

  function handleJourneyAssignmentSuccess(
    target: AssignmentTarget,
    result?: AssignmentResult,
  ) {
    applyOptimisticAssignment(target, result);
    void refreshLearningProgressData();
    const journeyName = assignmentJourneyName(result);

    if (target.kind === "player") {
      toast.success(`${journeyName} assigned to ${target.playerName}`);
      return;
    }

    const assignmentsCreated =
      result?.assignmentsCreated ?? result?.assignments?.length ?? 0;
    toast.success(`${journeyName} assigned to ${target.teamName}`, {
      description: `${assignmentsCreated} journeys queued`,
    });
  }

  function validateForm(): boolean {
    if (!form.shortName.trim()) {
      setFormError("Short name is required.");
      return false;
    }
    if (form.shortName.trim().length > 20) {
      setFormError("Short name must be ≤ 20 characters.");
      return false;
    }
    if (form.description.trim().length > 200) {
      setFormError("Description must be ≤ 200 characters.");
      return false;
    }
    const cat = resolvedCategory();
    if (cat.length > 50) {
      setFormError("Category must be ≤ 50 characters.");
      return false;
    }
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
    if (
      !window.confirm(
        "Are you sure you want to delete this team? This action cannot be undone.",
      )
    )
      return;
    const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    if (res.ok) {
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      setEditingTeam((prev) => (prev?.id === teamId ? null : prev));
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
      refreshTeamBadgeCounts(teamId);
    }
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    if (
      !window.confirm(
        "Remove this member from the team? Their team-assigned training windows and journeys will also be removed.",
      )
    )
      return;
    const res = await fetch(`/api/teams/${teamId}/members/${userId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const updated = await res.json();
      setTeams((prev) => prev.map((t) => (t.id === teamId ? updated : t)));
      setEditingTeam((prev) => (prev?.id === teamId ? updated : prev));
      refreshTeamBadgeCounts(teamId);
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
        <p className="text-sm text-gray-500">
          Only coaches and admins can manage teams.
        </p>
      </div>
    );
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <DndLessonProvider
      onAssigned={(target, result, sourceType) => {
        if (target.kind === "queue") return;
        if (sourceType === "journey") {
          handleJourneyAssignmentSuccess(
            target,
            result as AssignmentResult | undefined,
          );
          return;
        }
        handleAssignmentSuccess(target, result as AssignmentResult | undefined);
      }}
    >
      <div className="p-4 sm:p-6">
        <div className="mx-auto grid max-w-[1500px] gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-8">
            <section className="min-w-0 space-y-4">
              <button
                type="button"
                onClick={() => setTeamsCollapsed((value) => !value)}
                className="flex items-center gap-2 text-left"
                aria-expanded={!teamsCollapsed}
              >
                {teamsCollapsed ? (
                  <Plus className="h-4 w-4 text-slate-500" />
                ) : (
                  <Minus className="h-4 w-4 text-slate-500" />
                )}
                <h1 className="text-2xl font-bold">Teams</h1>
              </button>

              {!teamsCollapsed ? (
                <>
                  {showForm && (
                    <div className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
                      <h2 className="text-sm font-semibold text-gray-700">
                        New Team
                      </h2>

                      <div className="space-y-1">
                        <Label>
                          Icon{" "}
                          <span className="text-gray-400 text-xs">(optional)</span>
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

                      <div className="space-y-1">
                        <Label htmlFor="shortName">
                          Short Name{" "}
                          <span className="text-gray-400 text-xs">
                            (max 20 chars)
                          </span>
                        </Label>
                        <Input
                          id="shortName"
                          maxLength={20}
                          value={form.shortName}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, shortName: e.target.value }))
                          }
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
                          onChange={(e) =>
                            setForm((f) => ({ ...f, description: e.target.value }))
                          }
                          placeholder="Describe the team's purpose and goals…"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label>
                          Category{" "}
                          <span className="text-gray-400 text-xs">(optional)</span>
                        </Label>
                        {categories.length > 0 && !form.categoryInput && (
                          <Select
                            value={form.category}
                            onValueChange={(val) =>
                              setForm((f) => ({
                                ...f,
                                category: val,
                                categoryInput: "",
                              }))
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

                      {myClubs.length > 0 && (
                        <div className="space-y-1">
                          <Label>
                            Club{" "}
                            <span className="text-gray-400 text-xs">
                              (optional – limits member selection)
                            </span>
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

                      {formError ? (
                        <p className="text-sm text-red-600">{formError}</p>
                      ) : null}

                      <div className="flex gap-2">
                        <Button onClick={handleCreate} disabled={saving}>
                          {saving ? "Creating…" : "Create Team"}
                        </Button>
                        <Button variant="outline" onClick={() => setShowForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:max-w-xs">
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
                      className="whitespace-nowrap"
                      onClick={() => {
                        setShowForm((v) => !v);
                        setForm(EMPTY_FORM);
                        setFormError("");
                      }}
                    >
                      <Plus size={16} className="mr-1" />
                      <span className="sm:hidden">Team</span>
                      <span className="hidden sm:inline">New Team</span>
                    </Button>
                  </div>

                  {teams.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No teams yet. Create your first team above.
                    </p>
                  ) : filtered.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No matching teams found.
                    </p>
                  ) : (
                    <div className="max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2">
                      <div className="flex w-max gap-3 sm:gap-4">
                        {filtered.map((team) => {
                          const visibleMembers = team.members.slice(0, 5);
                          const extraMembers = Math.max(team.members.length - 5, 0);
                          const teamJourneyCount = teamPlanCounts[team.id] ?? 0;

                          const membersContent = (
                            <div className="flex max-w-[150px] flex-wrap gap-1.5">
                              {visibleMembers.length > 0 ? (
                                visibleMembers.map((member) => (
                                  <button
                                    key={member.userId}
                                    type="button"
                                    className="relative"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (member.user) {
                                        setSelectedMemberPlayerId(member.user.id);
                                      }
                                    }}
                                    title={member.user ? playerDisplayName(member.user) : member.userId}
                                  >
                                    <Avatar className="h-7 w-7 text-[11px]">
                                      {member.user?.profileImage ? (
                                        <AvatarImage
                                          src={member.user.profileImage}
                                          alt={member.user ? initials(member.user) : "?"}
                                        />
                                      ) : null}
                                      <AvatarFallback className="bg-blue-100 text-blue-700">
                                        {member.user ? initials(member.user) : "?"}
                                      </AvatarFallback>
                                    </Avatar>
                                    {(playerQueueById[member.userId] ?? 0) > 0 ? (
                                      <span
                                        className="absolute -bottom-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-bold leading-none text-white"
                                        title={`Queued lessons: ${playerQueueById[member.userId] ?? 0}`}
                                      >
                                        {queueCountLabel(playerQueueById[member.userId] ?? 0)}
                                      </span>
                                    ) : null}
                                  </button>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400">No members yet.</span>
                              )}
                              {extraMembers > 0 ? (
                                <span
                                  className="flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600"
                                  title={`${extraMembers} more members`}
                                >
                                  +{extraMembers}
                                </span>
                              ) : null}
                            </div>
                          );

                          const footerContent = (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="relative text-slate-500 hover:text-slate-700"
                                  onClick={(event) => event.stopPropagation()}
                                  aria-label="Team actions"
                                >
                                  <MoreHorizontal size={16} />
                                  {(teamPlanCounts[team.id] ?? 0) > 0 ? (
                                    <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                                      {teamPlanCounts[team.id]}
                                    </span>
                                  ) : null}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setAssignLesson(null);
                                    setAssignPlayerId(null);
                                    setAssignTeamId(team.id);
                                  }}
                                >
                                  <BookOpen size={16} />
                                  Lessons overview
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setJourneyTeam(team)}>
                                  <RouteIcon size={16} />
                                  Journeys overview
                                  {(teamPlanCounts[team.id] ?? 0) > 0
                                    ? ` (${teamPlanCounts[team.id]})`
                                    : ""}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setTrainingWindowsTeam(team)}
                                >
                                  <CalendarDays size={16} />
                                  Training window
                                  {(teamWindowCounts[team.id] ?? 0) > 0
                                    ? ` (${teamWindowCounts[team.id]})`
                                    : ""}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditingTeam(team)}>
                                  <SquarePen size={16} />
                                  Edit team
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => handleDelete(team.id)}
                                >
                                  <Trash2 size={16} />
                                  Delete team
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          );

                          return (
                            <DroppableTeamCard
                              key={team.id}
                              team={team}
                              teamJourneyCount={teamJourneyCount}
                              membersContent={membersContent}
                              footerContent={footerContent}
                              onOpen={() => setEditingTeam(team)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </section>

            <PlayersSection
              players={myPlayers}
              myClubs={myClubs}
              collapsed={playersCollapsed}
              onCollapsedChange={setPlayersCollapsed}
              onPlayerInvited={(newPlayer) => {
                setMyPlayers((prev) => {
                  const exists = prev.some((p) => p.id === newPlayer.id);
                  return exists ? prev : [...prev, newPlayer];
                });
                setPlayerQueueById((prev) => ({
                  ...prev,
                  [newPlayer.id]: newPlayer.pendingLessons ?? 0,
                }));
              }}
              onPlayerRemoved={(playerId) => {
                setMyPlayers((prev) => prev.filter((p) => p.id !== playerId));
                setPlayerQueueById((prev) => {
                  const next = { ...prev };
                  delete next[playerId];
                  return next;
                });
              }}
            />
          </div>

          <div className="order-last min-w-0 space-y-4 rounded-2xl border-t border-slate-200 bg-[#f7f8f7] p-4 xl:sticky xl:top-6 xl:self-start xl:border xl:border-slate-200 xl:bg-[#f5f7f5] xl:p-5">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-background max-h-[24rem] xl:max-h-[calc(42vh-2rem)]">
              <JourneyTemplateLibrarySidebar
                onJourneyClick={(journey) => {
                  if (myPlayers.length === 0 && teams.length === 0) {
                    toast.error("No player or team available for assignment.");
                    return;
                  }
                  setAssignJourney(journey);
                }}
              />
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-background max-h-[28rem] xl:max-h-[calc(50vh-2rem)]">
              <LessonLibrarySidebar
                inlineFullWidth
                onLessonClick={(lesson) => {
                  setAssignLesson(lesson);
                  setAssignPlayerId(null);
                  setAssignTeamId(null);
                }}
              />
            </div>
          </div>
        </div>

        {/* Edit Team Dialog */}
        {editingTeam && (
          <EditTeamDialog
            key={`${editingTeam.id}-${editingTeam.members.length}`}
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
            onClose={() => setSelectedMemberPlayerId(null)}
          />
        )}

        {/* Team Journey Dialog */}
        {journeyTeam && (
          <TeamJourneyDialog
            team={journeyTeam}
            onClose={() => {
              const id = journeyTeam.id;
              setJourneyTeam(null);
              refreshTeamBadgeCounts(id);
            }}
          />
        )}

        {/* Team Training Windows Dialog */}
        {trainingWindowsTeam && (
          <TeamTrainingWindowsDialog
            team={trainingWindowsTeam}
            onClose={() => {
              const id = trainingWindowsTeam.id;
              setTrainingWindowsTeam(null);
              refreshTeamBadgeCounts(id);
            }}
          />
        )}

        <AssignJourneyModal
          journey={assignJourney}
          players={myPlayers}
          teams={teams}
          onClose={() => setAssignJourney(null)}
          onAssigned={(target, result) => {
            handleJourneyAssignmentSuccess(target, result);
            setAssignJourney(null);
          }}
        />

        <AssignLessonModal
          open={Boolean(assignLesson || assignPlayerId || assignTeamId)}
          onClose={() => {
            setAssignLesson(null);
            setAssignPlayerId(null);
            setAssignTeamId(null);
          }}
          preselectedLesson={assignLesson}
          preselectedPlayerId={assignPlayerId}
          preselectedTeamId={assignTeamId}
          onAssigned={({ target, result }) => {
            const assignmentResult = result as AssignmentResult | undefined;
            if (target.kind === "player") {
              const player = myPlayers.find(
                (entry) => entry.id === target.playerId,
              );
              handleAssignmentSuccess(
                {
                  kind: "player",
                  playerId: target.playerId,
                  playerName: player ? playerDisplayName(player) : "player",
                },
                assignmentResult,
              );
            } else {
              handleAssignmentSuccess(
                {
                  kind: "team",
                  teamId: target.teamId,
                  teamName:
                    teams.find((team) => team.id === target.teamId)
                      ?.shortName ?? "team",
                },
                assignmentResult,
              );
            }
            setAssignLesson(null);
            setAssignPlayerId(null);
            setAssignTeamId(null);
          }}
        />
      </div>
    </DndLessonProvider>
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

function AssignJourneyModal({
  journey,
  players,
  teams,
  onClose,
  onAssigned,
}: {
  journey: JourneyTemplate | null;
  players: Player[];
  teams: Team[];
  onClose: () => void;
  onAssigned: (
    target: AssignmentTarget,
    result?: AssignmentResult,
  ) => void | Promise<void>;
}) {
  const [targetType, setTargetType] = useState<"player" | "team">("player");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!journey) return;
    if (players.length > 0) {
      setTargetType("player");
      setSelectedPlayerId(players[0]?.id ?? "");
      setSelectedTeamId("");
      return;
    }
    setTargetType("team");
    setSelectedPlayerId("");
    setSelectedTeamId(teams[0]?.id ?? "");
  }, [journey, players, teams]);

  async function handleSubmit() {
    if (!journey) return;
    if (targetType === "player") {
      const player = players.find((entry) => entry.id === selectedPlayerId);
      if (!player) {
        toast.error("Please select a player.");
        return;
      }
      setSubmitting(true);
      try {
        const result = await api.assignJourneyToPlayer(journey.id, player.id);
        await onAssigned(
          {
            kind: "player",
            playerId: player.id,
            playerName: playerDisplayName(player),
          },
          result as AssignmentResult,
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Journey assignment failed.",
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const team = teams.find((entry) => entry.id === selectedTeamId);
    if (!team) {
      toast.error("Please select a team.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.assignJourneyToTeam(journey.id, team.id);
      await onAssigned(
        { kind: "team", teamId: team.id, teamName: team.shortName },
        result as AssignmentResult,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Journey assignment failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={Boolean(journey)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Journey</DialogTitle>
        </DialogHeader>
        {journey ? (
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">{journey.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {journey.category ?? "Uncategorized"} ·{" "}
                {journey.lessons.length} lesson
                {journey.lessons.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Assign To</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={targetType === "player" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTargetType("player")}
                  disabled={players.length === 0}
                >
                  Player
                </Button>
                <Button
                  type="button"
                  variant={targetType === "team" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTargetType("team")}
                  disabled={teams.length === 0}
                >
                  Team
                </Button>
              </div>
            </div>

            {targetType === "player" ? (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Player</Label>
                <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select a player…" />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {playerDisplayName(player)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Team</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select a team…" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.shortName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Assigning…" : "Assign Journey"}
              </Button>
            </div>
          </div>
        ) : null}
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

function PlayersSection({
  players,
  myClubs,
  collapsed,
  onCollapsedChange,
  onPlayerInvited,
  onPlayerRemoved,
}: {
  players: Player[];
  myClubs: ClubOption[];
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onPlayerInvited: (player: Player) => void;
  onPlayerRemoved: (playerId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const selectedPlayer = selectedPlayerId
    ? players.find((player) => player.id === selectedPlayerId) ?? null
    : null;

  const filtered = players.filter((p) => {
    const q = search.toLowerCase();
    const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.toLowerCase();
    return name.includes(q) || p.id.toLowerCase().includes(q);
  });

  async function handleRemovePlayer(playerId: string, playerName: string) {
    if (!window.confirm(`Remove "${playerName}" from your players list?`))
      return;
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
    <div className="min-w-0 space-y-3">
      <button
        type="button"
        onClick={() => onCollapsedChange(!collapsed)}
        className="flex items-center gap-2 text-left"
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <Plus className="h-4 w-4 text-slate-500" />
        ) : (
          <Minus className="h-4 w-4 text-slate-500" />
        )}
        <h2 className="text-2xl font-bold">Players</h2>
      </button>

      {!collapsed ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-8"
                placeholder="Search players…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              onClick={() => setShowAddPlayer(true)}
              className="gap-2 whitespace-nowrap"
            >
              <Plus size={16} />
              <span className="sm:hidden">Player</span>
              <span className="hidden sm:inline">Add Player</span>
            </Button>
          </div>

          {players.length === 0 ? (
            <p className="text-sm text-gray-500">No players found.</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500">No matching players found.</p>
          ) : (
            <div className="max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2">
              <div className="flex w-max flex-nowrap gap-3">
                {filtered.map((p) => (
                  <DroppablePlayerCard
                    key={p.id}
                    player={p}
                    onOpen={() => setSelectedPlayerId(p.id)}
                    onRemove={() => handleRemovePlayer(p.id, playerDisplayName(p))}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}

      {selectedPlayer && (
        <PlayerDetailDialog
          player={selectedPlayer}
          onClose={() => setSelectedPlayerId(null)}
          onRemove={(playerId) => {
            onPlayerRemoved(playerId);
            setSelectedPlayerId(null);
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

function TeamTrainingWindowsDialog({
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
