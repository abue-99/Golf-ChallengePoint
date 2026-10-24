"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Minus,
  MoreHorizontal,
  PanelRight,
  Plus,
  Route as RouteIcon,
  Search,
  SquarePen,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DndLessonProvider } from "@/components/DndLessonProvider";
import { createdIdsFromResult, hasCreatedIds, undoAssignments } from "@/lib/assign-undo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TeamIcon from "@/components/TeamIcon";
import PlayerSidePanel, { PlayerDetails } from "@/components/PlayerSidePanel";
import { subscribeLearningProgressChanges } from "@/lib/learning-progress-events";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  needsAttention,
  type RosterPlayer,
  type RosterResponse,
  type RosterTeam,
} from "@/lib/coach-roster";
import AssignLibrary, { type LibraryItem } from "@/components/teams/AssignLibrary";
import AssignBar, { type SelectionSummary } from "@/components/teams/AssignBar";
import TeamDetails from "@/components/teams/TeamDetails";
import { PlayerCard, TeamCard } from "@/components/teams/TeamCards";
import {
  EditTeamDialog,
  TeamJourneyDialog,
  TeamTrainingWindowsDialog,
} from "@/components/teams/TeamDialogs";
import { AddPlayerDialog } from "@/components/teams/PlayerDialogs";
import {
  EMPTY_FORM,
  TEAM_COLOR_CIRCLES,
  TEAM_ICONS,
  playerDisplayName,
  type ClubOption,
  type FormState,
  type Player,
  type Team,
} from "@/components/teams/shared";

const TEAMS_COLLAPSED_STORAGE_KEY = "teamsCollapsed";
const PLAYERS_COLLAPSED_STORAGE_KEY = "playersCollapsed";
const WORKSPACE_COLLAPSED_STORAGE_KEY = "teams.workspaceCollapsed";

function loadFlag(key: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function saveFlag(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage unavailable – the preference is not remembered.
  }
}

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

type Detail = { kind: "team" | "player"; id: string } | null;
type WorkspaceTab = "library" | "details";

const teamKey = (id: string) => `team:${id}`;
const playerKey = (id: string) => `player:${id}`;

export default function TeamsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [myPlayers, setMyPlayers] = useState<Player[]>([]);
  const [myClubs, setMyClubs] = useState<ClubOption[]>([]);
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [teamsCollapsed, setTeamsCollapsed] = useState(() => loadFlag(TEAMS_COLLAPSED_STORAGE_KEY));
  const [playersCollapsed, setPlayersCollapsed] = useState(() => loadFlag(PLAYERS_COLLAPSED_STORAGE_KEY));
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(() =>
    loadFlag(WORKSPACE_COLLAPSED_STORAGE_KEY),
  );
  const [isWide, setIsWide] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 1024px)").matches,
  );

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [journeyTeam, setJourneyTeam] = useState<Team | null>(null);
  const [trainingWindowsTeam, setTrainingWindowsTeam] = useState<Team | null>(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  // Selection mode
  const [armed, setArmed] = useState<LibraryItem | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  // Details (workspace tab on wide screens, sheet on narrow ones)
  const [detail, setDetail] = useState<Detail>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("library");

  const selecting = selectMode || armed !== null;

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsWide(mql.matches);
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setRole(data?.role ?? null))
      .catch(() => setRole(null));
  }, []);

  const loadAll = useCallback(async () => {
    const tz = browserTimeZone();
    let responses: unknown[];
    try {
      responses = await Promise.all([
      fetch("/api/teams", { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])),
      fetch("/api/teams/categories", { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])),
      fetch("/api/teams/club-players", { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])),
      fetch("/api/clubs/my", { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])),
      fetch("/api/players/my", { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])),
      fetch(`/api/coach/roster${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`, { cache: "no-store" }).then(
        (res) => (res.ok ? res.json() : null),
      ),
      ]);
    } catch {
      setLoading(false);
      toast.error("Teams could not be loaded.");
      return;
    }
    const [t, c, p, clubs, myP, rosterData] = responses as [
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      RosterResponse | null,
    ];
    const r = rosterData;
    const nextTeams: Team[] = Array.isArray(t) ? t : [];
    setTeams(nextTeams);
    setCategories(Array.isArray(c) ? c : []);
    setAllPlayers(Array.isArray(p) ? p.filter(Boolean) : []);
    setMyPlayers(Array.isArray(myP) ? myP.filter(Boolean) : []);
    if (Array.isArray(clubs)) {
      setMyClubs(clubs.map((uc: { club: ClubOption }) => uc.club).filter(Boolean));
    }
    setRoster(r && Array.isArray(r.players) ? (r as RosterResponse) : null);
    setEditingTeam((prev) => (prev ? nextTeams.find((team) => team.id === prev.id) ?? null : prev));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (role !== "COACH" && role !== "ADMIN") return;
    // Data fetching on mount; state is only set after the requests resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll();
    return subscribeLearningProgressChanges(() => {
      void loadAll();
    });
  }, [role, loadAll]);

  // Escape leaves the selection mode.
  useEffect(() => {
    if (!selecting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setArmed(null);
        setSelectMode(false);
        setSelected(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting]);

  const rosterPlayers = useMemo(
    () => new Map<string, RosterPlayer>((roster?.players ?? []).map((player) => [player.id, player])),
    [roster],
  );
  const rosterTeams = useMemo(
    () => new Map<string, RosterTeam>((roster?.teams ?? []).map((team) => [team.id, team])),
    [roster],
  );
  const attentionIds = useMemo(
    () => new Set((roster?.players ?? []).filter(needsAttention).map((player) => player.id)),
    [roster],
  );
  const queueById = useMemo(
    () => Object.fromEntries(myPlayers.map((player) => [player.id, player.pendingLessons ?? 0])),
    [myPlayers],
  );
  const timeZone = roster?.timeZone ?? "UTC";

  // ── Selection ────────────────────────────────────────────────────────

  function toggleSelected(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function cancelSelection() {
    setArmed(null);
    setSelectMode(false);
    setSelected(new Set());
  }

  function armItem(item: LibraryItem | null) {
    setArmed(item);
    if (item) setSelectMode(true);
  }

  function startAssignForTeam(teamId: string) {
    setSelected(new Set([teamKey(teamId)]));
    setSelectMode(true);
    setWorkspaceTab("library");
    setWorkspaceCollapsed(false);
    setDetail(null);
    if (!isWide) {
      toast.message("Team selected – pick a lesson or journey in the library below.");
    }
  }

  const summary: SelectionSummary = useMemo(() => {
    const teamIds = [...selected].filter((key) => key.startsWith("team:")).map((key) => key.slice(5));
    const playerIds = [...selected].filter((key) => key.startsWith("player:")).map((key) => key.slice(7));
    const memberIds = new Set<string>();
    teamIds.forEach((id) =>
      teams
        .find((team) => team.id === id)
        ?.members.filter((member) => !member.user?.role || member.user.role === "PLAYER")
        .forEach((member) => memberIds.add(member.userId)),
    );
    const peopleIds = new Set([...memberIds, ...playerIds]);
    const coveredPlayerIds = new Set(playerIds.filter((id) => memberIds.has(id)));
    const duplicateIds = new Set<string>();
    if (armed?.type === "journey") {
      peopleIds.forEach((id) => {
        if (rosterPlayers.get(id)?.openJourneyTemplateIds?.includes(armed.journey.id)) duplicateIds.add(id);
      });
    }
    return { teamIds, playerIds, peopleIds, coveredPlayerIds, duplicateIds };
  }, [selected, teams, armed, rosterPlayers]);

  function hasArmedJourney(playerId: string) {
    return (
      armed?.type === "journey" &&
      Boolean(rosterPlayers.get(playerId)?.openJourneyTemplateIds?.includes(armed.journey.id))
    );
  }

  function teamDuplicateHint(team: Team) {
    if (armed?.type !== "journey") return null;
    const total = team.members.length;
    const count = team.members.filter((member) => hasArmedJourney(member.userId)).length;
    return count > 0 ? `${count}/${total} have it` : null;
  }

  // ── Details ──────────────────────────────────────────────────────────

  function openDetail(next: NonNullable<Detail>) {
    setDetail(next);
    if (isWide) {
      setWorkspaceTab("details");
      setWorkspaceCollapsed(false);
    }
  }

  function onTeamCardClick(team: Team) {
    if (selecting) toggleSelected(teamKey(team.id));
    else openDetail({ kind: "team", id: team.id });
  }

  function onPlayerCardClick(player: Player) {
    if (selecting) toggleSelected(playerKey(player.id));
    else openDetail({ kind: "player", id: player.id });
  }

  const detailTeam = detail?.kind === "team" ? teams.find((team) => team.id === detail.id) ?? null : null;
  const detailPlayer = detail?.kind === "player" ? rosterPlayers.get(detail.id) ?? null : null;

  // ── Team CRUD (unchanged behaviour) ──────────────────────────────────

  function resolvedCategory() {
    return form.categoryInput.trim() || form.category;
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
    if (resolvedCategory().length > 50) {
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
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadAll();
    } else {
      setFormError("Failed to create team.");
    }
    setSaving(false);
  }

  async function handleDelete(teamId: string) {
    if (!window.confirm("Are you sure you want to delete this team? This action cannot be undone.")) return;
    const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    if (res.ok) {
      setDetail((prev) => (prev?.kind === "team" && prev.id === teamId ? null : prev));
      setEditingTeam((prev) => (prev?.id === teamId ? null : prev));
      await loadAll();
    } else {
      toast.error("Could not delete the team.");
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
      setEditingTeam((prev) => (prev?.id === teamId ? updated : prev));
      await loadAll();
    }
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    if (
      !window.confirm(
        "Remove this member from the team? Their team-assigned training windows and journeys will also be removed.",
      )
    )
      return;
    const res = await fetch(`/api/teams/${teamId}/members/${userId}`, { method: "DELETE" });
    if (res.ok) {
      const updated = await res.json();
      setEditingTeam((prev) => (prev?.id === teamId ? updated : prev));
      await loadAll();
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
      setEditingTeam(updated);
      await loadAll();
    }
    return res.ok;
  }

  async function handleRemovePlayer(playerId: string) {
    const res = await fetch(`/api/players/my/${encodeURIComponent(playerId)}`, { method: "DELETE" });
    if (res.ok) {
      setDetail((prev) => (prev?.kind === "player" && prev.id === playerId ? null : prev));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(playerKey(playerId));
        return next;
      });
      await loadAll();
    } else {
      toast.error("Failed to remove player. Please try again.");
    }
  }

  async function confirmRemovePlayer(player: Player) {
    if (!window.confirm(`Remove "${playerDisplayName(player)}" from your players list?`)) return;
    await handleRemovePlayer(player.id);
  }

  const filteredTeams = teams.filter((t) => {
    const q = search.toLowerCase();
    const club = myClubs.find((c) => c.id === t.clubId)?.name ?? "";
    return (
      t.shortName.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q) ||
      club.toLowerCase().includes(q)
    );
  });

  const filteredPlayers = myPlayers.filter((p) => {
    const q = playerSearch.toLowerCase();
    return `${p.firstName ?? ""} ${p.lastName ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q);
  });

  if (role && role !== "COACH" && role !== "ADMIN") {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Only coaches and admins can manage teams.</p>
      </div>
    );
  }

  if (loading) return <div className="p-6">Loading…</div>;

  function nextWindowLabel(teamId: string) {
    const next = rosterTeams.get(teamId)?.nextTrainingWindow;
    if (!next) return null;
    return formatDateTime(next.start, {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  function teamMenu(team: Team) {
    const rosterTeam = rosterTeams.get(team.id);
    const planCount = rosterTeam?.plans.length ?? 0;
    const windowCount = rosterTeam?.trainingWindowCount ?? 0;
    return (
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
            {planCount > 0 ? (
              <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                {planCount}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuItem onClick={() => startAssignForTeam(team.id)}>
            <BookOpen size={16} />
            Assign lesson or journey
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setJourneyTeam(team)}>
            <RouteIcon size={16} />
            Journeys overview{planCount > 0 ? ` (${planCount})` : ""}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTrainingWindowsTeam(team)}>
            <CalendarDays size={16} />
            Training window{windowCount > 0 ? ` (${windowCount})` : ""}
          </DropdownMenuItem>
          {team.isHeadCoach !== false ? (
            <>
              <DropdownMenuItem onClick={() => setEditingTeam(team)}>
                <SquarePen size={16} />
                Edit team
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => void handleDelete(team.id)}>
                <Trash2 size={16} />
                Delete team
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function teamDetails(team: Team) {
    const rosterTeam = rosterTeams.get(team.id);
    return (
      <TeamDetails
        team={team}
        rosterTeam={rosterTeam}
        rosterPlayers={rosterPlayers}
        timeZone={timeZone}
        planCount={rosterTeam?.plans.length ?? 0}
        windowCount={rosterTeam?.trainingWindowCount ?? 0}
        onAssign={() => startAssignForTeam(team.id)}
        onEdit={() => setEditingTeam(team)}
        onJourneys={() => setJourneyTeam(team)}
        onTrainingWindows={() => setTrainingWindowsTeam(team)}
        onDelete={() => void handleDelete(team.id)}
        onOpenPlayer={(playerId) => openDetail({ kind: "player", id: playerId })}
        onStaffChanged={() => void loadAll()}
      />
    );
  }

  const workspace = (
    <aside
      className={cn(
        "order-last min-w-0 rounded-2xl border border-slate-200 bg-[#f5f7f5]",
        "lg:sticky lg:top-0 lg:flex lg:max-h-[calc(100dvh-6rem)] lg:flex-col lg:self-start",
        workspaceCollapsed && isWide ? "lg:w-11" : "",
      )}
      aria-label="Workspace"
    >
      {workspaceCollapsed && isWide ? (
        <button
          type="button"
          onClick={() => {
            setWorkspaceCollapsed(false);
            saveFlag(WORKSPACE_COLLAPSED_STORAGE_KEY, false);
          }}
          className="flex h-full min-h-40 w-full flex-col items-center gap-2 py-3 text-slate-500 hover:text-slate-800"
          aria-label="Show workspace"
          title="Show library and details"
        >
          <ChevronLeft className="h-4 w-4" />
          <BookOpen className="h-4 w-4" />
          <PanelRight className="h-4 w-4" />
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-slate-200 p-2">
            <div className="grid flex-1 grid-cols-2 gap-1 rounded-lg bg-slate-200/60 p-1" role="tablist" aria-label="Workspace">
              {(
                [
                  { value: "library", label: "Library" },
                  { value: "details", label: "Details" },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={workspaceTab === value}
                  onClick={() => setWorkspaceTab(value)}
                  disabled={value === "details" && !detail}
                  className={cn(
                    "h-8 rounded-md text-sm font-medium disabled:opacity-40 pointer-coarse:h-10",
                    workspaceTab === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {isWide ? (
              <button
                type="button"
                onClick={() => {
                  setWorkspaceCollapsed(true);
                  saveFlag(WORKSPACE_COLLAPSED_STORAGE_KEY, true);
                }}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800 pointer-coarse:p-2.5"
                aria-label="Hide workspace"
                title="Hide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
            {workspaceTab === "details" && detail && isWide ? (
              detailTeam ? (
                teamDetails(detailTeam)
              ) : detailPlayer ? (
                <div className="-m-3">
                  <PlayerDetails
                    key={detailPlayer.id}
                    inline
                    player={detailPlayer}
                    teams={roster?.teams ?? []}
                    today={roster?.today ?? ""}
                    timeZone={timeZone}
                    onChanged={() => void loadAll()}
                    onRemove={detailPlayer.linked ? (id) => handleRemovePlayer(id) : undefined}
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-500">Nothing selected.</p>
              )
            ) : (
              <AssignLibrary armed={armed} onArm={armItem} />
            )}
          </div>
        </>
      )}
    </aside>
  );

  return (
    <DndLessonProvider
      onAssigned={(target, result, sourceType) => {
        if (target.kind === "queue") return;
        const who = target.kind === "player" ? target.playerName : target.teamName;
        // Same undo as the bulk assign bar, so a mis-drop is one tap away from fixed.
        const created = createdIdsFromResult(sourceType ?? "lesson", result);
        toast.success(`${sourceType === "journey" ? "Journey" : "Lesson"} assigned to ${who}`, {
          duration: 10000,
          action: hasCreatedIds(created)
            ? {
                label: "Undo",
                onClick: () => {
                  undoAssignments(created)
                    .then((removed) => {
                      const count = removed.lessonsRemoved + removed.journeysRemoved;
                      toast.success(count ? "Assignment undone." : "Nothing to undo any more.");
                      void loadAll();
                    })
                    .catch(() => toast.error("Undo failed."));
                },
              }
            : undefined,
        });
        void loadAll();
      }}
    >
      <div className={cn("p-4 sm:p-6", selecting && "pb-40")}>
        <div
          className={cn(
            "mx-auto grid max-w-[1600px] gap-6",
            workspaceCollapsed && isWide
              ? "lg:grid-cols-[minmax(0,1fr)_44px]"
              : "lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]",
          )}
        >
          <div className="min-w-0 space-y-8">
            <section className="min-w-0 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setTeamsCollapsed((value) => {
                      saveFlag(TEAMS_COLLAPSED_STORAGE_KEY, !value);
                      return !value;
                    })
                  }
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
                <Button
                  variant={selecting ? "default" : "outline"}
                  onClick={() => (selecting ? cancelSelection() : setSelectMode(true))}
                  className="h-9 gap-1.5 pointer-coarse:h-11"
                  aria-pressed={selecting}
                >
                  <ListChecks className="h-4 w-4" />
                  {selecting ? "Done selecting" : "Select"}
                </Button>
              </div>

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
                      className="whitespace-nowrap pointer-coarse:h-10"
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
                    <p className="text-sm text-gray-500">No teams yet. Create your first team above.</p>
                  ) : filteredTeams.length === 0 ? (
                    <p className="text-sm text-gray-500">No matching teams found.</p>
                  ) : (
                    <div className="max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2">
                      <div className="flex w-max gap-3 sm:gap-4">
                        {filteredTeams.map((team) => (
                          <TeamCard
                            key={team.id}
                            team={team}
                            teamJourneyCount={rosterTeams.get(team.id)?.plans.length ?? 0}
                            queueById={queueById}
                            attentionIds={attentionIds}
                            nextWindowLabel={nextWindowLabel(team.id)}
                            planName={rosterTeams.get(team.id)?.plans[0]?.name ?? null}
                            selecting={selecting}
                            selected={selected.has(teamKey(team.id))}
                            highlighted={detail?.kind === "team" && detail.id === team.id}
                            duplicateHint={teamDuplicateHint(team)}
                            footerContent={teamMenu(team)}
                            onCardClick={() => onTeamCardClick(team)}
                            onMemberClick={(playerId) => openDetail({ kind: "player", id: playerId })}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </section>

            <section className="min-w-0 space-y-3">
              <button
                type="button"
                onClick={() =>
                  setPlayersCollapsed((value) => {
                    saveFlag(PLAYERS_COLLAPSED_STORAGE_KEY, !value);
                    return !value;
                  })
                }
                className="flex items-center gap-2 text-left"
                aria-expanded={!playersCollapsed}
              >
                {playersCollapsed ? (
                  <Plus className="h-4 w-4 text-slate-500" />
                ) : (
                  <Minus className="h-4 w-4 text-slate-500" />
                )}
                <h2 className="text-2xl font-bold">Players</h2>
              </button>

              {!playersCollapsed ? (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:max-w-xs">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        className="pl-8"
                        placeholder="Search players…"
                        value={playerSearch}
                        onChange={(e) => setPlayerSearch(e.target.value)}
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowAddPlayer(true)}
                      className="gap-2 whitespace-nowrap pointer-coarse:h-10"
                    >
                      <Plus size={16} />
                      <span className="sm:hidden">Player</span>
                      <span className="hidden sm:inline">Add Player</span>
                    </Button>
                  </div>

                  {myPlayers.length === 0 ? (
                    <p className="text-sm text-gray-500">No players found.</p>
                  ) : filteredPlayers.length === 0 ? (
                    <p className="text-sm text-gray-500">No matching players found.</p>
                  ) : (
                    <div className="max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2">
                      <div className="flex w-max flex-nowrap gap-3">
                        {filteredPlayers.map((player) => (
                          <PlayerCard
                            key={player.id}
                            player={player}
                            attention={attentionIds.has(player.id)}
                            selecting={selecting}
                            selected={selected.has(playerKey(player.id))}
                            highlighted={detail?.kind === "player" && detail.id === player.id}
                            duplicateHint={hasArmedJourney(player.id) ? "Has this journey" : null}
                            onCardClick={() => onPlayerCardClick(player)}
                            onRemove={() => void confirmRemovePlayer(player)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </section>
          </div>

          {workspace}
        </div>

        {selecting ? (
          <AssignBar
            armed={armed}
            summary={summary}
            teamName={(id) => teams.find((team) => team.id === id)?.shortName ?? "team"}
            onClearArmed={() => setArmed(null)}
            onCancel={cancelSelection}
            onDone={() => {
              cancelSelection();
              void loadAll();
            }}
          />
        ) : null}

        {/* Narrow screens: details open in a sheet */}
        {!isWide && detailPlayer ? (
          <PlayerSidePanel
            key={detailPlayer.id}
            player={detailPlayer}
            teams={roster?.teams ?? []}
            today={roster?.today ?? ""}
            timeZone={timeZone}
            onClose={() => setDetail(null)}
            onChanged={() => void loadAll()}
            onRemove={detailPlayer.linked ? (id) => handleRemovePlayer(id) : undefined}
          />
        ) : null}
        {!isWide && detailTeam ? (
          <Sheet open onOpenChange={(open) => !open && setDetail(null)}>
            <SheetContent
              side="right"
              className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>{detailTeam.shortName}</SheetTitle>
                <SheetDescription>Team details</SheetDescription>
              </SheetHeader>
              <div className="p-5 pr-12">{teamDetails(detailTeam)}</div>
            </SheetContent>
          </Sheet>
        ) : null}

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

        {journeyTeam && (
          <TeamJourneyDialog
            team={journeyTeam}
            onClose={() => {
              setJourneyTeam(null);
              void loadAll();
            }}
          />
        )}

        {trainingWindowsTeam && (
          <TeamTrainingWindowsDialog
            team={trainingWindowsTeam}
            onClose={() => {
              setTrainingWindowsTeam(null);
              void loadAll();
            }}
          />
        )}

        {showAddPlayer && (
          <AddPlayerDialog
            clubs={myClubs}
            myPlayers={myPlayers}
            onClose={() => setShowAddPlayer(false)}
            onPlayerAdded={() => void loadAll()}
          />
        )}
      </div>
    </DndLessonProvider>
  );
}
