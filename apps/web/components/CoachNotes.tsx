"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, type CoachNote } from "@/lib/coach-roster";

/** Private notes the coach keeps about one player. Only the author sees them. */
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
      body: JSON.stringify({ body }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("The note could not be saved.");
      return;
    }
    const note: CoachNote = await res.json();
    setNotes((prev) => [note, ...(prev ?? [])]);
    setDraft("");
    onChanged?.();
  }

  async function saveEdit(id: string) {
    const body = editText.trim();
    if (!body) return;
    setSaving(true);
    const res = await fetch(`/api/coach/roster/notes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
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
        <Lock className="h-3 w-3" /> Only you can see these notes.
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
        <div className="flex justify-end">
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
            <li key={note.id} className="rounded-xl border border-slate-200 bg-amber-50/40 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  {formatDateTime(note.createdAt, {
                    timeZone,
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {note.updatedAt !== note.createdAt ? " · edited" : ""}
                </span>
                {editingId !== note.id ? (
                  <span className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(note.id);
                        setEditText(note.body);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                      aria-label="Edit note"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeNote(note.id)}
                      className="rounded p-1 text-slate-400 hover:bg-white hover:text-rose-600"
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
