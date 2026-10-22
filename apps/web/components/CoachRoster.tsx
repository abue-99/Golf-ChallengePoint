"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  LayoutList,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PlayerOverviewDialog from "@/components/PlayerOverviewDialog";
import TeamIcon from "@/components/TeamIcon";
import type { LearningProgressSummary } from "@/components/LearningProgress";
import { subscribeLearningProgressChanges } from "@/lib/learning-progress-events";
import { cn } from "@/lib/utils";

type LinkedPlayer = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  profileImage?: string | null;
  phoneNumber?: string | null;
  timezone?: string | null;
  lastLogin?: string | null;
  userClubs?: { clubId: string; club: { id: string; name: string } | null }[];
  coaches?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
  }[];
  learningProgress?: LearningProgressSummary | null;
};

type TeamMember = {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
    role?: string | null;
  } | null;
};

type Team = {
  id: string;
  icon?: string | null;
  shortName: string;
  description?: string | null;
  members?: TeamMember[];
  pendingLessons?: number;
};

type RosterPlayer = LinkedPlayer & {
  /** True when the player is linked to the coach ("My Players"). */
  linked: boolean;
  teamIds: string[];
};

type GroupMode = "none" | "team";
type FilterMode = "all" | "attention" | "inactive";
type SortMode = "name" | "activity";

const GROUP_STORAGE_KEY = "coachRoster.groupMode";
const INACTIVE_AFTER_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function readStoredGroupMode(): GroupMode | null {
  try {
    const value = window.localStorage.getItem(GROUP_STORAGE_KEY);
    return value === "none" || value === "team" ? value : null;
  } catch {
    return null;
  }
}

function storeGroupMode(value: GroupMode) {
  try {
    window.localStorage.setItem(GROUP_STORAGE_KEY, value);
  } catch {
    // Storage unavailable (private mode etc.) – the default is used next time.
  }
}

function nameOf(player: Pick<LinkedPlayer, "firstName" | "lastName" | "email">) {
  return (
    [player.firstName, player.lastName].filter(Boolean).join(" ") ||
    player.email ||
    "—"
  );
}

function initialsOf(player: Pick<LinkedPlayer, "firstName" | "lastName" | "email">) {
  const parts = nameOf(player).split(" ").filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

function daysSince(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / DAY_MS));
}

function lastSeenLabel(value?: string | null) {
  const days = daysSince(value);
  if (days === null) return "Never logged in";
  if (days === 0) return "Seen today";
  if (days === 1) return "Seen yesterday";
  if (days < 60) return `Seen ${days} days ago`;
  return `Seen ${Math.floor(days / 30)} months ago`;
}

function isInactive(player: RosterPlayer) {
  if (!player.linked) return false;
  const days = daysSince(player.lastLogin);
  return days === null || days >= INACTIVE_AFTER_DAYS;
}

function pendingCount(player: RosterPlayer) {
  return (
    (player.learningProgress?.lessons?.PENDING ?? 0) +
    (player.learningProgress?.journeys?.PENDING ?? 0)
  );
}

function needsAttention(player: RosterPlayer) {
  return pendingCount(player) > 0 || isInactive(player);
}

/** Short text describing what the player is currently working on. */
function workSummary(player: RosterPlayer) {
  const progress = player.learningProgress;
  if (!progress) return null;
  const journeysOpen =
    (progress.journeys?.ACCEPTED ?? 0) + (progress.journeys?.ACTIVE ?? 0);
  const lessonsOpen =
    (progress.lessons?.ACCEPTED ?? 0) + (progress.lessons?.ACTIVE ?? 0);
  const parts: string[] = [];
  if (journeysOpen > 0) {
    parts.push(`${journeysOpen} journey${journeysOpen === 1 ? "" : "s"}`);
  }
  if (lessonsOpen > 0) {
    parts.push(`${lessonsOpen} lesson${lessonsOpen === 1 ? "" : "s"}`);
  }
  return parts.length > 0 ? `Working on ${parts.join(" · ")}` : null;
}

function TeamChip({
  team,
  onRemove,
  onSelect,
}: {
  team: Team;
  onRemove?: () => void;
  onSelect?: () => void;
}) {
  return (
    <span className="inline-flex max-w-[10rem] items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-1.5 pr-1 text-xs text-slate-700">
      <button
        type="button"
        onClick={onSelect}
        className="inline-flex min-w-0 items-center gap-1 hover:text-[var(--golf-primary)]"
        title={onSelect ? `Show only ${team.shortName}` : team.shortName}
      >
        {team.icon ? <TeamIcon icon={team.icon} size={12} /> : null}
        <span className="truncate">{team.shortName}</span>
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          aria-label={`Remove from ${team.shortName}`}
          title={`Remove from ${team.shortName}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}

function PlayerRow({
  player,
  teams,
  chipTeamIds,
  chipPrefix,
  onOpen,
  onAddToTeam,
  onRemoveFromTeam,
  onSelectTeam,
}: {
  player: RosterPlayer;
  teams: Team[];
  chipTeamIds: string[];
  chipPrefix?: string;
  onOpen: () => void;
  onAddToTeam: (teamId: string) => void;
  onRemoveFromTeam: (teamId: string) => void;
  onSelectTeam: (teamId: string) => void;
}) {
  const name = nameOf(player);
  const pending = pendingCount(player);
  const inactive = isInactive(player);
  const summary = workSummary(player);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const addableTeams = teams.filter((team) => !player.teamIds.includes(team.id));

  return (
    <li className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Avatar className="h-10 w-10 shrink-0">
          {player.profileImage ? (
            <AvatarImage src={player.profileImage} alt={name} />
          ) : null}
          <AvatarFallback className="bg-gray-200 text-sm text-gray-600">
            {initialsOf(player)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block truncate font-medium text-[var(--golf-heading)]">
            {name}
          </span>
          <span className="block truncate text-xs text-[var(--golf-muted-text)]">
            {player.linked
              ? [summary, lastSeenLabel(player.lastLogin)].filter(Boolean).join(" · ")
              : "Team member · not in My Players"}
          </span>
        </span>
      </button>

      <div className="flex flex-wrap items-center gap-1.5 pl-[3.25rem] sm:pl-0">
        {pending > 0 ? (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
            {pending} awaiting acceptance
          </span>
        ) : null}
        {inactive ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            {player.lastLogin ? `No login ${INACTIVE_AFTER_DAYS}+ days` : "Not activated"}
          </span>
        ) : null}

        {chipPrefix && chipTeamIds.length > 0 ? (
          <span className="text-xs text-slate-400">{chipPrefix}</span>
        ) : null}
        {chipTeamIds.map((teamId) => {
          const team = teamsById.get(teamId);
          if (!team) return null;
          return (
            <TeamChip
              key={teamId}
              team={team}
              onSelect={() => onSelectTeam(teamId)}
              onRemove={() => onRemoveFromTeam(teamId)}
            />
          );
        })}

        {addableTeams.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700"
                aria-label={`Add ${name} to a team`}
              >
                <Plus className="h-3 w-3" />
                Team
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Add to team</DropdownMenuLabel>
              {addableTeams.map((team) => (
                <DropdownMenuItem key={team.id} onSelect={() => onAddToTeam(team.id)}>
                  {team.icon ? <TeamIcon icon={team.icon} size={14} /> : null}
                  {team.shortName}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label={`Actions for ${name}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/coach/players/${player.id}`}>
                <ExternalLink className="h-4 w-4" /> Open player
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/coach/players/${player.id}/planning`}>
                <LayoutList className="h-4 w-4" /> Planning
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/coach/players/${player.id}/calendar`}>
                <CalendarDays className="h-4 w-4" /> Calendar
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

export default function CoachRoster() {
  const [loading, setLoading] = useState(true);
  const [linkedPlayers, setLinkedPlayers] = useState<LinkedPlayer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sort, setSort] = useState<SortMode>("name");
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [storedGroup, setStoredGroup] = useState<GroupMode | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setStoredGroup(readStoredGroupMode());
  }, []);

  const load = useCallback(async () => {
    try {
      const [playersRes, teamsRes] = await Promise.all([
        fetch("/api/players/my", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/teams", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
      ]);
      setLinkedPlayers(Array.isArray(playersRes) ? playersRes.filter(Boolean) : []);
      setTeams(Array.isArray(teamsRes) ? teamsRes : []);
    } catch {
      // Keep the previous state; the list simply stays as it was.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribeLearningProgressChanges(() => {
      void load();
    });
  }, [load]);

  const hasTeams = teams.length > 0;
  // Coaches without teams never see the toggle; with teams, default to team view.
  const groupMode: GroupMode = hasTeams ? storedGroup ?? "team" : "none";

  function changeGroupMode(value: GroupMode) {
    setStoredGroup(value);
    storeGroupMode(value);
  }

  const roster = useMemo(() => {
    const byId = new Map<string, RosterPlayer>();
    for (const player of linkedPlayers) {
      byId.set(player.id, { ...player, linked: true, teamIds: [] });
    }
    for (const team of teams) {
      for (const member of team.members ?? []) {
        let entry = byId.get(member.userId);
        if (!entry) {
          if (member.user?.role && member.user.role !== "PLAYER") continue;
          entry = {
            id: member.userId,
            firstName: member.user?.firstName ?? null,
            lastName: member.user?.lastName ?? null,
            profileImage: member.user?.profileImage ?? null,
            linked: false,
            teamIds: [],
          };
          byId.set(member.userId, entry);
        }
        if (!entry.teamIds.includes(team.id)) entry.teamIds.push(team.id);
      }
    }
    return [...byId.values()];
  }, [linkedPlayers, teams]);

  const visiblePlayers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = roster.filter((player) => {
      if (needle) {
        const haystack = `${nameOf(player)} ${player.email ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (teamFilter && !player.teamIds.includes(teamFilter)) return false;
      if (filter === "attention" && !needsAttention(player)) return false;
      if (filter === "inactive" && !isInactive(player)) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "activity") {
        const aTime = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
        const bTime = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;
      }
      return nameOf(a).localeCompare(nameOf(b));
    });
  }, [roster, query, teamFilter, filter, sort]);

  const attentionCount = useMemo(() => roster.filter(needsAttention).length, [roster]);
  const inactiveCount = useMemo(() => roster.filter(isInactive).length, [roster]);

  const selectedPlayer = selectedPlayerId
    ? roster.find((player) => player.id === selectedPlayerId) ?? null
    : null;

  async function addToTeam(playerId: string, teamId: string) {
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: playerId }),
    });
    if (!res.ok) {
      toast.error("Could not add the player to the team.");
      return;
    }
    const updated: Team = await res.json();
    setTeams((prev) =>
      prev.map((team) => (team.id === teamId ? { ...team, ...updated } : team)),
    );
  }

  async function removeFromTeam(playerId: string, teamId: string) {
    const team = teams.find((entry) => entry.id === teamId);
    if (
      !window.confirm(
        `Remove this player from ${team?.shortName ?? "the team"}? Their team-assigned training windows and journeys will also be removed.`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/teams/${teamId}/members/${playerId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not remove the player from the team.");
      return;
    }
    const updated: Team = await res.json();
    setTeams((prev) =>
      prev.map((entry) => (entry.id === teamId ? { ...entry, ...updated } : entry)),
    );
  }

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderRow(player: RosterPlayer, context: { teamId?: string }) {
    // In team view the current team is implied, so only the other teams are shown.
    const chipTeamIds = context.teamId
      ? player.teamIds.filter((id) => id !== context.teamId)
      : player.teamIds;
    return (
      <PlayerRow
        key={`${context.teamId ?? "all"}-${player.id}`}
        player={player}
        teams={teams}
        chipTeamIds={chipTeamIds}
        chipPrefix={context.teamId ? "Also in" : undefined}
        onOpen={() => setSelectedPlayerId(player.id)}
        onAddToTeam={(teamId) => void addToTeam(player.id, teamId)}
        onRemoveFromTeam={(teamId) => void removeFromTeam(player.id, teamId)}
        onSelectTeam={(teamId) => setTeamFilter(teamId)}
      />
    );
  }

  const filterButtons: { value: FilterMode; label: string; count?: number }[] = [
    { value: "all", label: "All", count: roster.length },
    { value: "attention", label: "Needs attention", count: attentionCount },
    { value: "inactive", label: "Inactive", count: inactiveCount },
  ];

  const isFiltered = Boolean(query.trim() || teamFilter || filter !== "all");

  function renderGroups() {
    if (groupMode === "none") {
      return (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {visiblePlayers.map((player) => renderRow(player, {}))}
        </ul>
      );
    }

    const visibleIds = new Set(visiblePlayers.map((player) => player.id));
    const groups = teams
      .filter((team) => !teamFilter || team.id === teamFilter)
      .map((team) => ({
        key: team.id,
        team,
        players: visiblePlayers.filter((player) => player.teamIds.includes(team.id)),
        total: (team.members ?? []).length,
      }));
    const withoutTeam = visiblePlayers.filter(
      (player) => player.teamIds.length === 0 && visibleIds.has(player.id),
    );

    return (
      <div className="space-y-4">
        {groups.map(({ key, team, players, total }) => {
          if (isFiltered && players.length === 0) return null;
          const isCollapsed = collapsed.has(key);
          return (
            <section key={key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <header className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-3 py-2 sm:px-4">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(key)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-expanded={!isCollapsed}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                  )}
                  {team.icon ? <TeamIcon icon={team.icon} size={16} /> : null}
                  <span className="truncate font-semibold text-[var(--golf-heading)]">
                    {team.shortName}
                  </span>
                  <span className="shrink-0 text-sm text-slate-500">
                    {isFiltered ? `${players.length} of ${total}` : total}
                  </span>
                  {team.description ? (
                    <span className="hidden truncate text-sm text-slate-400 md:inline">
                      · {team.description}
                    </span>
                  ) : null}
                </button>
                {team.pendingLessons ? (
                  <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                    {team.pendingLessons} pending
                  </span>
                ) : null}
                <Link
                  href="/teams"
                  className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  title="Manage team, plans and training windows"
                  aria-label={`Manage ${team.shortName}`}
                >
                  <Settings2 className="h-4 w-4" />
                </Link>
              </header>
              {!isCollapsed ? (
                players.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {players.map((player) => renderRow(player, { teamId: team.id }))}
                  </ul>
                ) : (
                  <p className="px-4 py-3 text-sm text-[var(--golf-muted-text)]">
                    No players in this team yet.
                  </p>
                )
              ) : null}
            </section>
          );
        })}

        {!teamFilter && withoutTeam.length > 0 ? (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <header className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2 sm:px-4">
              <button
                type="button"
                onClick={() => toggleCollapsed("__none__")}
                className="flex flex-1 items-center gap-2 text-left"
                aria-expanded={!collapsed.has("__none__")}
              >
                {collapsed.has("__none__") ? (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
                <span className="font-semibold text-[var(--golf-heading)]">No team</span>
                <span className="text-sm text-slate-500">{withoutTeam.length}</span>
              </button>
            </header>
            {!collapsed.has("__none__") ? (
              <ul className="divide-y divide-slate-100">
                {withoutTeam.map((player) => renderRow(player, {}))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
    );
  }

  const activeTeam = teamFilter ? teams.find((team) => team.id === teamFilter) : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search players"
            className="bg-white pl-9"
            aria-label="Search players"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Filter players">
            {filterButtons.map(({ value, label, count }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={cn(
                  "rounded-md px-2.5 py-1 text-sm transition-colors",
                  filter === value
                    ? "bg-[var(--golf-primary)] text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {label}
                {typeof count === "number" ? (
                  <span className={cn("ml-1 text-xs", filter === value ? "text-white/80" : "text-slate-400")}>
                    {count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {hasTeams ? (
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Group players">
              <span className="px-2 text-xs text-slate-500">Group</span>
              {(
                [
                  { value: "team", label: "By team", icon: Users },
                  { value: "none", label: "List", icon: LayoutList },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeGroupMode(value)}
                  aria-pressed={groupMode === value}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm transition-colors",
                    groupMode === value
                      ? "bg-slate-800 text-white"
                      : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-600"
            aria-label="Sort players"
          >
            <option value="name">Sort: Name</option>
            <option value="activity">Sort: Last seen</option>
          </select>
        </div>

        <Link
          href="/teams"
          className="text-sm font-medium text-[var(--golf-primary)] hover:underline lg:ml-auto"
        >
          {hasTeams ? "Manage teams & invite players" : "+ Create a team or invite players"}
        </Link>
      </div>

      {activeTeam ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>Showing team</span>
          <TeamChip team={activeTeam} onRemove={() => setTeamFilter(null)} />
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--golf-muted-text)]">Loading players…</p>
      ) : roster.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--golf-muted)] bg-white p-6 text-sm text-[var(--golf-muted-text)]">
          You don&apos;t have any players yet.{" "}
          <Link href="/teams" className="font-medium text-[var(--golf-primary)] hover:underline">
            Invite your first player
          </Link>
          .
        </div>
      ) : visiblePlayers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--golf-muted)] bg-white p-6 text-sm text-[var(--golf-muted-text)]">
          No players match the current filters.
        </div>
      ) : (
        renderGroups()
      )}

      {selectedPlayer ? (
        <PlayerOverviewDialog
          player={selectedPlayer}
          onClose={() => setSelectedPlayerId(null)}
        />
      ) : null}
    </section>
  );
}
