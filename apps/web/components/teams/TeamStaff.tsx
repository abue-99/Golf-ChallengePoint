"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Crown, LogOut, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  coachName,
  COACH_ROLE_LABEL,
  roleLabel,
  STAFF_ROLES,
  type CoachRole,
  type StaffMember,
} from "@/lib/coach-roles";
import { cn } from "@/lib/utils";

type StaffResponse = {
  teamId: string;
  isHeadCoach: boolean;
  myRole: CoachRole | null;
  staff: StaffMember[];
};

type Candidate = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" && data.message) ||
        `Request failed (${res.status})`,
    );
  }
  return data as T;
}

function initialsOf(member: { firstName?: string | null; lastName?: string | null }) {
  return (
    `${member.firstName?.[0] ?? ""}${member.lastName?.[0] ?? ""}`.toUpperCase() ||
    "C"
  );
}

/** Compact list of the coaching staff for the team details pane. */
export function StaffList({
  staff,
  isHeadCoach,
  onManage,
}: {
  staff: { coachId: string; firstName: string | null; lastName: string | null; role: CoachRole }[];
  isHeadCoach: boolean;
  onManage: () => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Coaching staff ({staff.length})
        </h3>
        <button
          type="button"
          onClick={onManage}
          className="min-h-9 rounded-md px-2 text-xs font-semibold text-[var(--golf-primary)] hover:bg-green-50 pointer-coarse:min-h-11"
        >
          {isHeadCoach ? "Manage" : "Details"}
        </button>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {staff.map((member) => (
          <li
            key={member.coachId}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs",
              member.role === "HEAD_COACH"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-slate-200 bg-white text-slate-700",
            )}
          >
            {member.role === "HEAD_COACH" ? <Crown className="h-3 w-3" /> : null}
            <span className="font-medium">{coachName(member)}</span>
            <span className="text-slate-500">· {roleLabel(member.role)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Head coach: add coaches, change roles, hand over. Staff: see and leave. */
export function StaffDialog({
  teamId,
  teamName,
  open,
  onClose,
  onChanged,
}: {
  teamId: string;
  teamName: string;
  open: boolean;
  onClose: () => void;
  /** Called after any change; `left` when the viewer left the team. */
  onChanged: (options?: { left?: boolean }) => void;
}) {
  const [data, setData] = useState<StaffResponse | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [newCoachId, setNewCoachId] = useState("");
  const [newRole, setNewRole] = useState<CoachRole>("ASSISTANT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmHandOver, setConfirmHandOver] = useState<string | null>(null);

  const base = `/api/teams/${encodeURIComponent(teamId)}/staff`;

  const load = useCallback(async () => {
    try {
      const staff = await call<StaffResponse>(base);
      setData(staff);
      setError(null);
      if (staff.isHeadCoach) {
        setCandidates(await call<Candidate[]>(`${base}/candidates`).catch(() => []));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Staff could not be loaded");
    }
  }, [base]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      toast.success(success);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Change not saved");
    } finally {
      setBusy(false);
    }
  };

  const isHead = Boolean(data?.isHeadCoach);
  const me = data?.staff.find((member) => member.isMe);

  // Portal: the details pane is sticky (own stacking context), so the dialog
  // must live on <body> to sit above the team and player cards.
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <DialogHeader>
              <DialogTitle>Coaching staff – {teamName}</DialogTitle>
            </DialogHeader>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 pointer-coarse:h-11 pointer-coarse:w-11"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm text-slate-500">
          All coaches of the team see its calendar, answers and players and can
          plan sessions and events. Only the head coach changes the team and its
          staff.
        </p>

        {!data && !error ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading…</p>
        ) : null}

        {data ? (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {data.staff.map((member) => (
              <li key={member.coachId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    member.isHead ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-700",
                  )}
                >
                  {initialsOf(member)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {coachName(member)}
                    {member.isMe ? <span className="text-slate-400"> (you)</span> : null}
                  </span>
                  <span className="block truncate text-xs text-slate-500">{member.email}</span>
                </span>
                {member.isHead ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
                    <Crown className="h-3 w-3" /> Head coach
                  </span>
                ) : isHead ? (
                  <span className="flex items-center gap-1">
                    <select
                      aria-label={`Role of ${coachName(member)}`}
                      className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm pointer-coarse:h-11"
                      value={member.role}
                      disabled={busy}
                      onChange={(event) =>
                        void run(
                          () =>
                            call(`${base}/${encodeURIComponent(member.coachId)}`, {
                              method: "PUT",
                              body: JSON.stringify({ role: event.target.value }),
                            }),
                          "Role changed",
                        )
                      }
                    >
                      {STAFF_ROLES.map((value) => (
                        <option key={value} value={value}>
                          {COACH_ROLE_LABEL[value]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      title="Make head coach"
                      aria-label={`Make ${coachName(member)} head coach`}
                      disabled={busy}
                      onClick={() => setConfirmHandOver(member.coachId)}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-amber-700 hover:bg-amber-50 pointer-coarse:h-11 pointer-coarse:w-11"
                    >
                      <Crown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Remove from staff"
                      aria-label={`Remove ${coachName(member)}`}
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            call(`${base}/${encodeURIComponent(member.coachId)}`, {
                              method: "DELETE",
                            }),
                          `${coachName(member)} removed`,
                        )
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-md text-rose-700 hover:bg-rose-50 pointer-coarse:h-11 pointer-coarse:w-11"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {roleLabel(member.role)}
                  </span>
                )}
                {confirmHandOver === member.coachId ? (
                  <div className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <span className="flex-1">
                      Make {coachName(member)} head coach? You stay on the staff as
                      assistant coach.
                    </span>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            call(`${base}/head`, {
                              method: "POST",
                              body: JSON.stringify({ coachId: member.coachId }),
                            }),
                          `${coachName(member)} is now head coach`,
                        ).then(() => setConfirmHandOver(null))
                      }
                    >
                      Hand over
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmHandOver(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {isHead ? (
          <div className="mt-4 space-y-2 rounded-xl border border-dashed border-slate-300 p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <UserPlus className="h-4 w-4" /> Add a coach
            </p>
            {candidates.length === 0 ? (
              <p className="text-xs text-slate-500">
                No further coaches in this club yet.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Coach"
                  className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm pointer-coarse:h-11"
                  value={newCoachId}
                  onChange={(event) => setNewCoachId(event.target.value)}
                >
                  <option value="">Select coach…</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {coachName(candidate)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Role"
                  className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm pointer-coarse:h-11"
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value as CoachRole)}
                >
                  {STAFF_ROLES.map((value) => (
                    <option key={value} value={value}>
                      {COACH_ROLE_LABEL[value]}
                    </option>
                  ))}
                </select>
                <Button
                  disabled={!newCoachId || busy}
                  onClick={() =>
                    void run(
                      () =>
                        call(base, {
                          method: "POST",
                          body: JSON.stringify({ coachId: newCoachId, role: newRole }),
                        }),
                      "Coach added",
                    ).then(() => setNewCoachId(""))
                  }
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        ) : me ? (
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await call(`${base}/${encodeURIComponent(me.coachId)}`, {
                    method: "DELETE",
                  });
                  toast.success(`You left ${teamName}`);
                  onChanged({ left: true });
                  onClose();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not leave");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <LogOut className="mr-1 h-4 w-4" /> Leave team
            </Button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
        ) : null}
      </DialogContent>
    </Dialog>,
    document.body,
  );
}
