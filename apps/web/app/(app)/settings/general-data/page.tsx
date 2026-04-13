"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, SquarePen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ────────────────────────────────────────────────────────────────────

type Club = {
  id: string;
  shortId: string | null;
  name: string;
  city: string | null;
  country: string | null;
};

type Country = { name: string; code: string };

type FormState = {
  shortId: string;
  name: string;
  city: string;
  country: string;
};

const EMPTY_FORM: FormState = { shortId: "", name: "", city: "", country: "" };

// ── Country list – fetched once from REST Countries API, with static fallback ─

const FALLBACK_COUNTRIES: Country[] = [
  { name: "Argentina", code: "AR" },
  { name: "Australia", code: "AU" },
  { name: "Austria", code: "AT" },
  { name: "Belgium", code: "BE" },
  { name: "Brazil", code: "BR" },
  { name: "Canada", code: "CA" },
  { name: "Chile", code: "CL" },
  { name: "China", code: "CN" },
  { name: "Colombia", code: "CO" },
  { name: "Czech Republic", code: "CZ" },
  { name: "Denmark", code: "DK" },
  { name: "Egypt", code: "EG" },
  { name: "Finland", code: "FI" },
  { name: "France", code: "FR" },
  { name: "Germany", code: "DE" },
  { name: "Greece", code: "GR" },
  { name: "Hungary", code: "HU" },
  { name: "India", code: "IN" },
  { name: "Ireland", code: "IE" },
  { name: "Italy", code: "IT" },
  { name: "Japan", code: "JP" },
  { name: "Malaysia", code: "MY" },
  { name: "Mexico", code: "MX" },
  { name: "Netherlands", code: "NL" },
  { name: "New Zealand", code: "NZ" },
  { name: "Norway", code: "NO" },
  { name: "Poland", code: "PL" },
  { name: "Portugal", code: "PT" },
  { name: "Saudi Arabia", code: "SA" },
  { name: "Singapore", code: "SG" },
  { name: "South Africa", code: "ZA" },
  { name: "South Korea", code: "KR" },
  { name: "Spain", code: "ES" },
  { name: "Sweden", code: "SE" },
  { name: "Switzerland", code: "CH" },
  { name: "Thailand", code: "TH" },
  { name: "Turkey", code: "TR" },
  { name: "United Arab Emirates", code: "AE" },
  { name: "United Kingdom", code: "GB" },
  { name: "United States", code: "US" },
];

async function loadCountries(): Promise<Country[]> {
  try {
    const res = await fetch(
      "https://restcountries.com/v3.1/all?fields=name,cca2"
    );
    if (!res.ok) throw new Error("failed");
    const data: { name: { common: string }; cca2: string }[] = await res.json();
    return data
      .map((c) => ({ name: c.name.common, code: c.cca2 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return FALLBACK_COUNTRIES;
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(form: FormState): string | null {
  if (!form.shortId.trim()) return "Short ID is required.";
  if (form.shortId.length > 12) return "Short ID must be at most 12 characters.";
  if (!/^[a-zA-Z0-9]+$/.test(form.shortId))
    return "Short ID may only contain letters and digits.";
  if (!form.name.trim()) return "Long name is required.";
  if (form.name.length > 50) return "Long name must be at most 50 characters.";
  return null;
}

// ── Club form modal ───────────────────────────────────────────────────────────

function ClubFormModal({
  open,
  onClose,
  initial,
  countries,
  onSave,
  title,
}: {
  open: boolean;
  onClose: () => void;
  initial: FormState;
  countries: Country[];
  onSave: (form: FormState) => Promise<void>;
  title: string;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial);
    setError("");
  }, [initial, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate(form);
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (ex: unknown) {
      setError(ex instanceof Error ? ex.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Short ID */}
          <div className="space-y-1">
            <Label htmlFor="shortId">
              Short ID <span className="text-gray-400 text-xs">(max 12 chars, letters &amp; digits)</span>
            </Label>
            <Input
              id="shortId"
              value={form.shortId}
              maxLength={12}
              onChange={(e) =>
                setForm((f) => ({ ...f, shortId: e.target.value }))
              }
              placeholder="e.g. GCC01"
            />
          </div>

          {/* Long name */}
          <div className="space-y-1">
            <Label htmlFor="name">
              Long Name <span className="text-gray-400 text-xs">(max 50 chars)</span>
            </Label>
            <Input
              id="name"
              value={form.name}
              maxLength={50}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. Golf Country Club"
            />
          </div>

          {/* City */}
          <div className="space-y-1">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) =>
                setForm((f) => ({ ...f, city: e.target.value }))
              }
              placeholder="e.g. Vienna"
            />
          </div>

          {/* Country */}
          <div className="space-y-1">
            <Label>Country</Label>
            <Select
              value={form.country || "__unset__"}
              onValueChange={(val) =>
                setForm((f) => ({
                  ...f,
                  country: val === "__unset__" ? "" : val,
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select country…" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="__unset__">— Select country —</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c.code} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteConfirmModal({
  open,
  clubName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  clubName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Club / Academy</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 mt-2">
          Are you sure you want to delete{" "}
          <span className="font-semibold">{clubName}</span>? This action cannot
          be undone.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GeneralDataPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [countries, setCountries] = useState<Country[]>(FALLBACK_COUNTRIES);
  const [search, setSearch] = useState("");
  const [sectionOpen, setSectionOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isSysAdmin, setIsSysAdmin] = useState(false);

  // form modal
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  // delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Club | null>(null);

  const fetchClubs = useCallback(async () => {
    try {
      const res = await fetch("/api/clubs");
      if (res.ok) setClubs(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClubs();
    loadCountries().then(setCountries);
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((u) => setIsSysAdmin(u?.role === "SYSADMIN"))
      .catch(() => setIsSysAdmin(false));
  }, [fetchClubs]);

  const filtered = clubs.filter((c) => {
    const q = search.toLowerCase();
    return (
      (c.shortId ?? "").toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.city ?? "").toLowerCase().includes(q) ||
      (c.country ?? "").toLowerCase().includes(q)
    );
  });

  function openAdd() {
    setEditingId(null);
    setFormInitial(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(club: Club) {
    setEditingId(club.id);
    setFormInitial({
      shortId: club.shortId ?? "",
      name: club.name,
      city: club.city ?? "",
      country: club.country ?? "",
    });
    setFormOpen(true);
  }

  async function handleSave(form: FormState) {
    const body = {
      shortId: form.shortId.trim() || null,
      name: form.name.trim(),
      city: form.city.trim() || null,
      country: form.country || null,
    };

    let res: Response;
    if (editingId) {
      res = await fetch(`/api/clubs/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message ?? "Failed to save club.");
    }

    await fetchClubs();
  }

  function openDelete(club: Club) {
    setDeleteTarget(club);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/clubs/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete club.");
    await fetchClubs();
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-semibold">General data</h1>

      {/* ── Clubs / Academies section ── */}
      <div className="rounded-xl border bg-white shadow-sm">
        {/* Collapsible header */}
        <button
          onClick={() => setSectionOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-base font-semibold text-gray-800">
            Clubs / Academies
          </span>
          {sectionOpen ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>

        {sectionOpen && (
          <div className="px-5 pb-5 space-y-4 border-t">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Search */}
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-8"
                  placeholder="Search clubs…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {/* Add button – SYSADMIN only */}
              {isSysAdmin && (
                <Button onClick={openAdd} className="shrink-0">
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              )}
            </div>

            {/* Table */}
            {loading ? (
              <p className="text-sm text-gray-500 py-4">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                {search ? "No matching clubs found." : "No clubs yet."}
              </p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Short ID</TableHead>
                      <TableHead className="font-semibold">Long Name</TableHead>
                      <TableHead className="font-semibold">City</TableHead>
                      <TableHead className="font-semibold">Country</TableHead>
                      {isSysAdmin && <TableHead className="w-24" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((club) => (
                      <TableRow
                        key={club.id}
                        className={isSysAdmin ? "cursor-pointer" : undefined}
                        onDoubleClick={isSysAdmin ? () => openEdit(club) : undefined}
                        title={isSysAdmin ? "Double-click to edit" : undefined}
                      >
                        <TableCell className="font-mono text-xs font-medium text-gray-700">
                          {club.shortId ?? "—"}
                        </TableCell>
                        <TableCell className="font-medium">{club.name}</TableCell>
                        <TableCell className="text-gray-600">
                          {club.city ?? "—"}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {club.country ?? "—"}
                        </TableCell>
                        {isSysAdmin && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(club);
                                }}
                                aria-label={`Edit ${club.name}`}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              >
                                <SquarePen className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDelete(club);
                                }}
                                aria-label={`Delete ${club.name}`}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form modal – SYSADMIN only */}
      {isSysAdmin && formOpen && (
        <ClubFormModal
          open={true}
          onClose={() => setFormOpen(false)}
          initial={formInitial}
          countries={countries}
          onSave={handleSave}
          title={editingId ? "Edit Club / Academy" : "Add Club / Academy"}
        />
      )}

      {/* Delete confirm modal – SYSADMIN only */}
      {isSysAdmin && deleteOpen && deleteTarget && (
        <DeleteConfirmModal
          open={true}
          clubName={deleteTarget.name}
          onClose={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
