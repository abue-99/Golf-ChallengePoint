"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDateTime, type CoachNote, type NoteVisibility } from "@/lib/coach-roster";

function authorName(note: CoachNote) {
  return [note.author.firstName, note.author.lastName].filter(Boolean).join(" ") || "Another coach";
}

/** Two-way switch: keep a note to yourself or share it with the coaching team. */
function VisibilityToggle({
  value,
  onChange,
  disabled,
}: {
  value: NoteVisibility;
  onChange: (value: NoteVisibility) => void;
  disabled?: boolean;
}) {
  const options: { value: NoteVisibility; label: string; icon: typeof Lock }[] = [
    { value: "PRIVATE", label: "Only me", icon: Lock },
    { value: "SHARED", label: "Coaching team", icon: Users },
  ];
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="radiogroup" aria-label="Who can see this note">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors pointer-coarse:min-h-10 pointer-coarse:px-3",
            value === option.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
          )}
        >
          <option.icon className="h-3 w-3" />
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Coach notes about one player: private by default, or shared with every
 * other coach who works with the player (handover, observations).
 */
export default function CoachNotes({
  playerId,
  timeZone,
  onChanged,
}: {
  playerId: string;
  timeZone: string;
  onChanged?: () => void;
}) {
  const [notes, setNotes] = useState<CoachNote[] | null>(null);
  const [draft, setDraft] = useState("");
  const [draftVisibility, setDraftVisibility] = useState<NoteVisibility>("PRIVATE");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const base = `/api/coach/roster/players/${encodeURIComponent(playerId)}/notes`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch {
      setNotes([]);
      toast.error("Notes could not be loaded.");
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addNote() {
    const body = draft.trim();
    if (!body) return;
    setSaving(true);
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, visibility: draftVisibility }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("The note could not be saved.");
      return;
    }
    const note: CoachNote = await res.json();
    setNotes((prev) => [note, ...(prev ?? [])]);
    if (draftVisibility === "SHARED") toast.success("Shared with the coaching team.");
    setDraft("");
    onChanged?.();
  }

  async function saveEdit(id: string) {
    const body = editText.trim();
    if (!body) return;
    await patchNote(id, { body });
  }

  async function patchNote(id: string, changes: { body?: string; visibility?: NoteVisibility }) {
    setSaving(true);
    const res = await fetch(`/api/coach/roster/notes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("The note could not be saved.");
      return;
    }
    const note: CoachNote = await res.json();
    setNotes((prev) => (prev ?? []).map((entry) => (entry.id === id ? note : entry)));
    setEditingId(null);
  }

  async function removeNote(id: string) {
    if (!window.confirm("Delete this note?")) return;
    const res = await fetch(`/api/coach/roster/notes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("The note could not be deleted.");
      return;
    }
    setNotes((prev) => (prev ?? []).filter((entry) => entry.id !== id));
    onChanged?.();
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Lock className="h-3 w-3" /> Private notes only you see. Shared notes are visible to every coach of this player.
      </p>
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void addNote();
            }
          }}
          placeholder="Add a note, e.g. observations from today's session"
          rows={3}
          maxLength={5000}
          aria-label="New note"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <VisibilityToggle value={draftVisibility} onChange={setDraftVisibility} disabled={saving} />
          <Button size="sm" onClick={() => void addNote()} disabled={saving || !draft.trim()}>
            {saving && !editingId ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Add note
          </Button>
        </div>
      </div>

      {notes === null ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : notes.length === 0 ? null : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className={cn(
                "rounded-xl border p-3",
                note.visibility === "SHARED"
                  ? "border-sky-200 bg-sky-50/50"
                  : "border-slate-200 bg-amber-50/40",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                  {note.visibility === "SHARED" ? (
                    <span className="inline-flex items-center gap-1 font-medium text-sky-700">
                      <Users className="h-3 w-3" />
                      {note.mine ? "Shared by you" : authorName(note)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Only you
                    </span>
                  )}
                  <span>·</span>
                  {formatDateTime(note.createdAt, {
                    timeZone,
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {note.updatedAt !== note.createdAt ? " · edited" : ""}
                </span>
                {editingId !== note.id && note.mine ? (
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        void patchNote(note.id, {
                          visibility: note.visibility === "SHARED" ? "PRIVATE" : "SHARED",
                        })
                      }
                      className="rounded p-1 text-slate-400 hover:bg-white hover:text-sky-700 pointer-coarse:p-2"
                      aria-label={note.visibility === "SHARED" ? "Make private" : "Share with coaching team"}
                      title={note.visibility === "SHARED" ? "Make private" : "Share with coaching team"}
                    >
                      {note.visibility === "SHARED" ? <Lock className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(note.id);
                        setEditText(note.body);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 pointer-coarse:p-2"
                      aria-label="Edit note"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeNote(note.id)}
                      className="rounded p-1 text-slate-400 hover:bg-white hover:text-rose-600 pointer-coarse:p-2"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : null}
              </div>
              {editingId === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                    rows={3}
                    maxLength={5000}
                    aria-label="Edit note"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void saveEdit(note.id)}
                      disabled={saving || !editText.trim()}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-line text-sm text-slate-800">{note.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
