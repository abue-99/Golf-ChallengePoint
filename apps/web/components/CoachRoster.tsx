"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  LayoutList,
  Route as RouteIcon,
  Trophy,
  Gauge,
  MessageCircle,
  MoreHorizontal,
  MessageSquare,
  Inbox,
  CalendarX,
  Moon,
  UserX,
  StickyNote,
  PanelRight,
  Rows3,
  Rows4,
  ClipboardPlus,
  CircleHelp,
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
import PlayerSidePanel from "@/components/PlayerSidePanel";
import { useUnreadMessages } from "@/lib/messages";
import {
  loadWarning,
  refreshPlayerLoad,
  usePlayerLoad,
  type PlayerLoad,
} from "@/lib/player-load";
import FeedbackSheet from "@/components/FeedbackList";
import CoachToday, { GettingStarted } from "@/components/CoachToday";
import { QuickAssignSheet, type AssignTarget } from "@/components/QuickAssign";
import TeamIcon from "@/components/TeamIcon";
import ActivityStrip, { ActivityLegend } from "@/components/ActivityStrip";
import { subscribeLearningProgressChanges } from "@/lib/learning-progress-events";
import { cn } from "@/lib/utils";
import {
  daysUntil,
  formatDateTime,
  initialsOf,
  INACTIVE_AFTER_DAYS,
  isInactive,
  lastActiveLabel,
  missedCount,
  nameOf,
  needsAttention,
  pendingCount,
  greetingFor,
  relativeDays,
  teamColor,
  workSummary,
  type RosterPlayer,
  type RosterResponse,
  type RosterTeam,
} from "@/lib/coach-roster";

type Team = RosterTeam;
type GroupMode = "none" | "team";
type FilterMode = "all" | "attention" | "inactive";
type SortMode = "name" | "activity";

const GROUP_STORAGE_KEY = "coachRoster.groupMode";
const DENSITY_STORAGE_KEY = "coachRoster.density";
const GETTING_STARTED_KEY = "coachRoster.gettingStartedHidden";

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable – the setting just isn't remembered.
  }
}

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

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function TeamChip({
  team,
  prefix,
  onRemove,
  onSelect,
}: {
  team: Team;
  /** e.g. "Also in" – shown as a tooltip and to screen readers. */
  prefix?: string;
  onRemove?: () => void;
  onSelect?: () => void;
}) {
  return (
    <span className="inline-flex max-w-[10rem] items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-1.5 pr-1 text-xs text-slate-700">
      <button
        type="button"
        onClick={onSelect}
        className="inline-flex min-w-0 items-center gap-1 hover:text-[var(--golf-primary)]"
        title={
          prefix
            ? `${prefix} ${team.shortName} – click to show only this team`
            : onSelect
              ? `Show only ${team.shortName}`
              : team.shortName
        }
        aria-label={prefix ? `${prefix} ${team.shortName}` : undefined}
      >
        {team.icon ? <TeamIcon icon={team.icon} size={12} /> : null}
        <span className="truncate">{team.shortName}</span>
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 pointer-coarse:p-1.5"
          aria-label={`Remove from ${team.shortName}`}
          title={`Remove from ${team.shortName}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}

type Density = "comfortable" | "compact";

function Indicator({
  icon: Icon,
  label,
  tone,
  children,
}: {
  icon: typeof Trophy;
  label: string;
  tone: "rose" | "amber" | "blue" | "slate";
  children?: React.ReactNode;
}) {
  const tones = {
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-sky-50 text-sky-700",
    slate: "bg-slate-100 text-slate-600",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-1.5 text-xs font-medium tabular-nums",
        tones[tone],
      )}
      title={label}
      aria-label={label}
      role="img"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

function PlayerRow({
  player,
  teams,
  today,
  timeZone,
  density,
  chipTeamIds,
  chipPrefix,
  onOpen,
  onAssign,
  onAddToTeam,
  onRemoveFromTeam,
  onSelectTeam,
  load,
  unreadMessages = 0,
}: {
  load?: PlayerLoad;
  unreadMessages?: number;
  player: RosterPlayer;
  teams: Team[];
  today: string;
  timeZone: string;
  density: Density;
  chipTeamIds: string[];
  chipPrefix?: string;
  onOpen: () => void;
  onAssign: () => void;
  onAddToTeam: (teamId: string) => void;
  onRemoveFromTeam: (teamId: string) => void;
  onSelectTeam: (teamId: string) => void;
}) {
  const name = nameOf(player);
  const pending = pendingCount(player);
  const missed = missedCount(player);
  const inactive = isInactive(player);
  const attention = needsAttention(player);
  const summary = workSummary(player);
  const compact = density === "compact";
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const addableTeams = teams.filter((team) => !player.teamIds.includes(team.id));
  const tournamentSoon =
    player.nextTournament &&
    (daysUntil(player.nextTournament.startTime) ?? Infinity) <= 14
      ? player.nextTournament
      : null;
  const tournamentDays = tournamentSoon ? Math.max(0, daysUntil(tournamentSoon.startTime) ?? 0) : 0;
  const loadHint = loadWarning(load);

  return (
    <li
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-3 sm:px-4 lg:grid-cols-[minmax(15rem,1fr)_auto_minmax(18rem,1.3fr)]",
        compact ? "py-1.5" : "py-3",
      )}
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-3 text-left">
        <span className="relative shrink-0">
          <Avatar className={compact ? "h-8 w-8" : "h-10 w-10"}>
            {player.profileImage ? <AvatarImage src={player.profileImage} alt={name} /> : null}
            <AvatarFallback className={cn("bg-gray-200 text-gray-600", compact ? "text-xs" : "text-sm")}>
              {initialsOf(player)}
            </AvatarFallback>
          </Avatar>
          {attention ? (
            <span
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500"
              aria-label="Needs attention"
              role="img"
            />
          ) : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-[var(--golf-heading)]">{name}</span>
          {!compact ? (
            <span className="flex min-w-0 items-center gap-1 truncate text-xs text-[var(--golf-muted-text)]">
              {player.currentJourney ? (
                <RouteIcon className="h-3 w-3 shrink-0 text-[var(--golf-primary)]" />
              ) : null}
              <span className="truncate">
                {player.linked
                  ? [summary, lastActiveLabel(player)].filter(Boolean).join(" · ")
                  : [summary, "Team member · not in My Players"].filter(Boolean).join(" · ")}
              </span>
            </span>
          ) : null}
        </span>
      </button>

      <ActivityStrip days={player.days} today={today} className="justify-self-end lg:col-start-2" />

      <div
        className={cn(
          "col-span-2 flex flex-wrap items-center gap-1.5 lg:col-span-1 lg:col-start-3 lg:pl-0",
          compact ? "pl-11" : "pl-[3.25rem]",
        )}
      >
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-wrap items-center gap-1.5 rounded-full empty:hidden"
          aria-label={`Show details for ${name}`}
        >
        {unreadMessages > 0 ? (
          <Indicator
            icon={MessageCircle}
            tone="rose"
            label={`${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}`}
          >
            {unreadMessages}
          </Indicator>
        ) : null}
        {player.feedbackCount > 0 ? (
          <Indicator
            icon={MessageSquare}
            tone="blue"
            label={`${player.feedbackCount} completed lesson${player.feedbackCount === 1 ? "" : "s"} awaiting your feedback`}
          >
            {player.feedbackCount}
          </Indicator>
        ) : null}
        {pending > 0 ? (
          <Indicator icon={Inbox} tone="rose" label={`${pending} awaiting acceptance`}>
            {pending}
          </Indicator>
        ) : null}
        {missed > 0 ? (
          <Indicator icon={CalendarX} tone="rose" label={`${missed} missed day${missed === 1 ? "" : "s"} this week`}>
            {missed}
          </Indicator>
        ) : null}
        {inactive ? (
          player.lastLogin ? (
            <Indicator icon={Moon} tone="amber" label={`Inactive for ${INACTIVE_AFTER_DAYS}+ days`} />
          ) : (
            <Indicator icon={UserX} tone="amber" label="Account not activated yet" />
          )
        ) : null}
        {tournamentSoon ? (
          <Indicator
            icon={Trophy}
            tone="amber"
            label={`${tournamentSoon.title} · ${formatDateTime(tournamentSoon.startTime, {
              timeZone,
              weekday: "short",
              day: "numeric",
              month: "short",
            })} (${relativeDays(tournamentSoon.startTime)})`}
          >
            {tournamentDays === 0 ? "today" : `${tournamentDays}d`}
          </Indicator>
        ) : null}
        {loadHint ? (
          <Indicator icon={Gauge} tone={loadHint.tone} label={loadHint.text} />
        ) : null}
        {player.noteCount > 0 ? (
          <Indicator
            icon={StickyNote}
            tone="slate"
            label={`${player.noteCount} private note${player.noteCount === 1 ? "" : "s"}`}
          />
        ) : null}
        </button>

        {chipTeamIds.map((teamId) => {
          const team = teamsById.get(teamId);
          if (!team) return null;
          return (
            <TeamChip
              key={teamId}
              team={team}
              prefix={chipPrefix}
              onSelect={() => onSelectTeam(teamId)}
              onRemove={() => onRemoveFromTeam(teamId)}
            />
          );
        })}

        <span className="ml-auto flex items-center gap-1">
          {player.linked ? (
            <button
              type="button"
              onClick={onAssign}
              className="rounded-md p-1 text-[var(--golf-primary)] hover:bg-green-50 pointer-coarse:p-2.5"
              aria-label={`Assign a lesson or journey to ${name}`}
              title="Assign a lesson or journey"
            >
              <ClipboardPlus className="h-4 w-4" />
            </button>
          ) : null}
          {addableTeams.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700 pointer-coarse:px-3 pointer-coarse:py-1.5"
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
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 pointer-coarse:p-2.5"
                aria-label={`Actions for ${name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {player.linked ? (
                <DropdownMenuItem onSelect={onAssign}>
                  <ClipboardPlus className="h-4 w-4" /> Assign lesson or journey
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={onOpen}>
                <PanelRight className="h-4 w-4" /> Details & notes
              </DropdownMenuItem>
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
        </span>
      </div>
    </li>
  );
}

function TeamHeaderInfo({ team, timeZone }: { team: Team; timeZone: string }) {
  const plan = team.plans[0];
  const next = team.nextTrainingWindow;
  if (!plan && !next) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pb-2 pl-9 text-xs text-slate-500 sm:px-4 sm:pl-10">
      {plan ? (
        <span className="inline-flex min-w-0 items-center gap-1">
          <RouteIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">
            Plan: <span className="text-slate-700">{plan.name}</span>
            {team.plans.length > 1 ? ` +${team.plans.length - 1}` : ""}
          </span>
        </span>
      ) : null}
      {next ? (
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3 shrink-0" />
          Next window:{" "}
          <span className="text-slate-700">
            {formatDateTime(next.start, {
              timeZone,
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </span>
          {team.trainingWindowCount > 1 ? (
            <span>· {team.trainingWindowCount} windows</span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

export default function CoachRoster({ firstName }: { firstName?: string }) {
  const [loading, setLoading] = useState(true);
  const [density, setDensity] = useState<Density>("comfortable");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [panelAssign, setPanelAssign] = useState(false);
  const [teamAssign, setTeamAssign] = useState<AssignTarget | null>(null);
  const [gettingStartedHidden, setGettingStartedHidden] = useState(true);
  const [greeting, setGreeting] = useState<{ text: string; date: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState<RosterResponse | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sort, setSort] = useState<SortMode>("name");
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [storedGroup, setStoredGroup] = useState<GroupMode | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setStoredGroup(readStoredGroupMode());
    setDensity(readStorage(DENSITY_STORAGE_KEY) === "compact" ? "compact" : "comfortable");
    setGettingStartedHidden(readStorage(GETTING_STARTED_KEY) === "true");
    const now = new Date();
    setGreeting({
      text: greetingFor(now.getHours()),
      date: new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(now),
    });
  }, []);

  function openPlayer(playerId: string, assign = false) {
    setPanelAssign(assign);
    setSelectedPlayerId(playerId);
  }

  function changeDensity(value: Density) {
    setDensity(value);
    writeStorage(DENSITY_STORAGE_KEY, value);
  }

  function hideGettingStarted() {
    setGettingStartedHidden(true);
    writeStorage(GETTING_STARTED_KEY, "true");
  }

  const load = useCallback(async () => {
    try {
      const tz = browserTimeZone();
      const res = await fetch(
        `/api/coach/roster${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(String(res.status));
      const next: RosterResponse = await res.json();
      setData(next);
      void refreshPlayerLoad();
      setFailed(false);
    } catch {
      setFailed(true);
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

  const unread = useUnreadMessages();
  const loadData = usePlayerLoad();
  const loadByPlayer = useMemo(
    () => new Map((loadData?.players ?? []).map((entry) => [entry.playerId, entry])),
    [loadData],
  );
  const teams = useMemo(() => data?.teams ?? [], [data]);
  const roster = useMemo(() => data?.players ?? [], [data]);
  const today = data?.today ?? "";
  const timeZone = data?.timeZone ?? "UTC";

  const hasTeams = teams.length > 0;
  // Coaches without teams never see the toggle; with teams, default to team view.
  const groupMode: GroupMode = hasTeams ? storedGroup ?? "team" : "none";

  function changeGroupMode(value: GroupMode) {
    setStoredGroup(value);
    storeGroupMode(value);
  }

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
        const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
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
    await load();
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
    await load();
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
        today={today}
        timeZone={timeZone}
        density={density}
        chipTeamIds={chipTeamIds}
        chipPrefix={context.teamId ? "Also in" : undefined}
        onOpen={() => openPlayer(player.id)}
        onAssign={() => openPlayer(player.id, true)}
        onAddToTeam={(teamId) => void addToTeam(player.id, teamId)}
        onRemoveFromTeam={(teamId) => void removeFromTeam(player.id, teamId)}
        onSelectTeam={(teamId) => setTeamFilter(teamId)}
        load={loadByPlayer.get(player.id)}
        unreadMessages={unread?.byUser[player.id] ?? 0}
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

    const groups = teams
      .filter((team) => !teamFilter || team.id === teamFilter)
      .map((team) => ({
        key: team.id,
        team,
        players: visiblePlayers.filter((player) => player.teamIds.includes(team.id)),
        total: team.memberIds.length,
      }));
    const withoutTeam = visiblePlayers.filter((player) => player.teamIds.length === 0);

    return (
      <div className="space-y-4">
        {groups.map(({ key, team, players, total }) => {
          if (isFiltered && players.length === 0) return null;
          const isCollapsed = collapsed.has(key);
          return (
            <section
              key={key}
              className="overflow-hidden rounded-xl border border-l-4 border-slate-200 bg-white"
              style={{ borderLeftColor: teamColor(team.icon) }}
            >
              <header className="border-b border-slate-100 bg-slate-50/70">
                <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
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
                  <button
                    type="button"
                    onClick={() => setTeamAssign({ kind: "team", id: team.id, name: team.shortName })}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--golf-primary)] hover:bg-green-50 pointer-coarse:px-3 pointer-coarse:py-2"
                    aria-label={`Assign a lesson or journey to ${team.shortName}`}
                  >
                    <ClipboardPlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Assign to team</span>
                  </button>
                  <Link
                    href="/teams"
                    className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 pointer-coarse:p-2.5"
                    title="Manage team, plans and training windows"
                    aria-label={`Manage ${team.shortName}`}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Link>
                </div>
                <TeamHeaderInfo team={team} timeZone={timeZone} />
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
          <section className="overflow-hidden rounded-xl border border-l-4 border-slate-200 border-l-slate-300 bg-white">
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
    <section className="space-y-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--golf-heading)]">
          {greeting ? `${greeting.text}${firstName ? `, ${firstName}` : ""}` : "Home"}
        </h1>
        {greeting ? (
          <p className="text-sm text-[var(--golf-muted-text)]">{greeting.date}</p>
        ) : null}
      </header>

      {data && !gettingStartedHidden ? (
        <GettingStarted data={data} onDismiss={hideGettingStarted} />
      ) : null}

      {data && data.players.length > 0 ? (
        <CoachToday
          data={data}
          onOpenFeedback={() => setFeedbackOpen(true)}
          onOpenPlayer={(playerId) => openPlayer(playerId)}
        />
      ) : null}

      <div className="flex items-baseline justify-between pt-1">
        <h2 className="text-lg font-semibold text-[var(--golf-heading)]">My Players</h2>
        <Link
          href="/teams"
          className="text-sm font-medium text-[var(--golf-primary)] hover:underline pointer-coarse:py-2"
        >
          {hasTeams ? "Manage teams & invite players" : "+ Create a team or invite players"}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full md:w-64 lg:w-72">
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
                  "rounded-md px-2.5 py-1 text-sm transition-colors pointer-coarse:py-2",
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
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm transition-colors pointer-coarse:py-2",
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

          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Row density">
            {(
              [
                { value: "comfortable", label: "Comfortable rows", icon: Rows3 },
                { value: "compact", label: "Compact rows", icon: Rows4 },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => changeDensity(value)}
                aria-pressed={density === value}
                aria-label={label}
                title={label}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  density === value ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-600"
            aria-label="Sort players"
          >
            <option value="name">Sort: Name</option>
            <option value="activity">Sort: Last active</option>
          </select>
        </div>

      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {activeTeam ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Showing team</span>
            <TeamChip team={activeTeam} onRemove={() => setTeamFilter(null)} />
          </div>
        ) : (
          <span />
        )}
        {roster.length > 0 ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="hidden sm:inline">Past week · next week:</span>
            <ActivityLegend />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 pointer-coarse:px-2.5 pointer-coarse:py-2"
                >
                  <CircleHelp className="h-3.5 w-3.5" /> Icons
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>What the icons mean</DropdownMenuLabel>
                {[
                  { icon: MessageSquare, text: "Completed lessons awaiting your feedback", cls: "text-sky-700" },
                  { icon: Inbox, text: "Assigned, not accepted yet", cls: "text-rose-700" },
                  { icon: CalendarX, text: "Missed days in the past week", cls: "text-rose-700" },
                  { icon: Moon, text: `No activity for ${INACTIVE_AFTER_DAYS}+ days`, cls: "text-amber-700" },
                  { icon: UserX, text: "Account not activated yet", cls: "text-amber-700" },
                  { icon: Trophy, text: "Tournament within 14 days", cls: "text-amber-700" },
                  { icon: MessageCircle, text: "Unread messages from the player", cls: "text-rose-700" },
                  { icon: Gauge, text: "Training load near or above the weekly limit, or the same lesson from two coaches", cls: "text-amber-700" },
                  { icon: StickyNote, text: "You have private notes", cls: "text-slate-600" },
                  { icon: ClipboardPlus, text: "Assign a lesson or journey", cls: "text-[var(--golf-primary)]" },
                ].map(({ icon: Icon, text, cls }) => (
                  <div key={text} className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700">
                    <Icon className={cn("h-4 w-4 shrink-0", cls)} />
                    {text}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--golf-muted-text)]">Loading players…</p>
      ) : failed && !data ? (
        <div className="rounded-xl border border-dashed border-rose-200 bg-white p-6 text-sm text-rose-700">
          Players could not be loaded.{" "}
          <button type="button" onClick={() => void load()} className="font-medium underline">
            Try again
          </button>
        </div>
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
        <PlayerSidePanel
          key={`${selectedPlayer.id}-${panelAssign ? "assign" : "view"}`}
          initialAssign={panelAssign}
          player={selectedPlayer}
          teams={teams}
          today={today}
          timeZone={timeZone}
          onClose={() => setSelectedPlayerId(null)}
          onChanged={() => void load()}
        />
      ) : null}

      {teamAssign ? (
        <QuickAssignSheet
          target={teamAssign}
          onClose={() => setTeamAssign(null)}
          onAssigned={() => void load()}
        />
      ) : null}

      {feedbackOpen ? (
        <FeedbackSheet
          timeZone={timeZone}
          onClose={() => setFeedbackOpen(false)}
          onChanged={() => void load()}
        />
      ) : null}
    </section>
  );
}
