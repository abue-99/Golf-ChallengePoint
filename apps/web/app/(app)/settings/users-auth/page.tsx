"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, SquarePen, Search, X, Hourglass, Send } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchWithAuth } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "PLAYER" | "COACH" | "ADMIN" | "SYSADMIN";

type Club = { id: string; name: string };

type CoachUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImage: string | null;
  email: string;
  userClubs?: { clubId: string; club: { id: string; name: string } | null }[];
};

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImage: string | null;
  role: Role;
  createdAt: string;
  lastLogin: string | null;
  userClubs: { clubId: string; club: Club | null }[];
};

type NewUserForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  clubId: string;
};

const EMPTY_NEW_USER: NewUserForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  clubId: "",
};

// ── Avatar helper ─────────────────────────────────────────────────────────────

function UserAvatar({ user }: { user: User }) {
  const initials =
    [user.firstName, user.lastName]
      .filter(Boolean)
      .map((n) => n![0].toUpperCase())
      .join("") || user.email[0].toUpperCase();

  if (user.profileImage) {
    return (
      <Image
        src={user.profileImage}
        alt={initials}
        width={32}
        height={32}
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--golf-primary)] text-white text-xs font-semibold shrink-0">
      {initials}
    </div>
  );
}

const ROLE_LABELS: Record<Role, string> = {
  PLAYER: "Player",
  COACH: "Coach",
  ADMIN: "Admin",
  SYSADMIN: "Sysadmin",
};


const ROLE_COLORS: Record<Role, string> = {
  SYSADMIN: "bg-red-100 text-red-700",
  ADMIN: "bg-purple-100 text-purple-700",
  COACH: "bg-blue-100 text-blue-700",
  PLAYER: "bg-green-100 text-green-700",
};

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role]}`}
    >
      {role}
    </span>
  );
}

// ── Club cell (SYSADMIN can add/remove clubs) ─────────────────────────────────

function ClubCell({
  user,
  currentRole,
  allClubs,
  onAddClub,
  onRemoveClub,
}: {
  user: User;
  currentRole: Role | null;
  allClubs: Club[];
  onAddClub: (userId: string, clubId: string) => Promise<void>;
  onRemoveClub: (userId: string, clubId: string) => Promise<void>;
}) {
  const [selectKey, setSelectKey] = useState(0);
  const assignedIds = new Set(user.userClubs.map((uc) => uc.clubId));
  const available = allClubs.filter((c) => !assignedIds.has(c.id));

  if (currentRole !== "SYSADMIN") {
    const names = user.userClubs.map((uc) => uc.club?.name ?? "").filter(Boolean);
    return (
      <span className="text-gray-600 text-sm">
        {names.length > 0 ? names.join(", ") : "—"}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {user.userClubs.filter((uc) => uc.club).map((uc) => (
        <span
          key={uc.clubId}
          className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800"
        >
          {uc.club!.name}
          <button
            type="button"
            aria-label={`Remove ${uc.club!.name}`}
            onClick={() => onRemoveClub(user.id, uc.clubId)}
            className="ml-0.5 hover:text-red-600"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <Select
          key={selectKey}
          onValueChange={(val) => {
            if (val) {
              setSelectKey((k) => k + 1);
              onAddClub(user.id, val);
            }
          }}
        >
          <SelectTrigger className="h-6 w-6 p-0 border-dashed rounded shrink-0" aria-label="Add club">
            <Plus className="h-3 w-3 mx-auto" />
          </SelectTrigger>
          <SelectContent>
            {available.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// ── Create user modal ─────────────────────────────────────────────────────────

function CreateUserModal({
  open,
  onClose,
  onCreated,
  allClubs,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  allClubs: Club[];
}) {
  const [form, setForm] = useState<NewUserForm>(EMPTY_NEW_USER);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_NEW_USER);
      setError("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim()) { setError("Email is required."); return; }
    if (!form.password || form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string | undefined> = {
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
      };
      if (form.clubId) body.clubId = form.clubId;

      const res = await fetchWithAuth("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message || data.error || "Failed to create user.";
        setError(msg);
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cu-firstname">First Name</Label>
              <Input
                id="cu-firstname"
                placeholder="Max"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cu-lastname">Last Name</Label>
              <Input
                id="cu-lastname"
                placeholder="Mustermann"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cu-email">Email</Label>
            <Input
              id="cu-email"
              type="email"
              placeholder="user@example.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              disabled={saving}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="cu-password">
              Password <span className="text-gray-400 text-xs">(min 6 characters)</span>
            </Label>
            <Input
              id="cu-password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              disabled={saving}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="cu-club">
              Club <span className="text-gray-400 text-xs">(optional)</span>
            </Label>
            <Select
              value={form.clubId}
              onValueChange={(val) => setForm((f) => ({ ...f, clubId: val }))}
              disabled={saving}
            >
              <SelectTrigger id="cu-club" className="w-full">
                <SelectValue placeholder="Select a club" />
              </SelectTrigger>
              <SelectContent>
                {allClubs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
                {allClubs.length === 0 && (
                  <SelectItem value="__none__" disabled>No clubs available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteUserModal({
  open,
  userName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  userName: string;
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
          <DialogTitle>Delete User</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 mt-2">
          Are you sure you want to delete{" "}
          <span className="font-semibold">{userName}</span>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit user modal ───────────────────────────────────────────────────────────

function EditUserModal({
  open,
  user,
  onClose,
  onSaved,
  currentRole,
  allClubs,
  onAddClub,
  onRemoveClub,
}: {
  open: boolean;
  user: User;
  onClose: () => void;
  onSaved: (updated: User) => void;
  currentRole: Role | null;
  allClubs: Club[];
  onAddClub: (userId: string, clubId: string) => Promise<void>;
  onRemoveClub: (userId: string, clubId: string) => Promise<void>;
}) {
  const isSysadmin = currentRole === "SYSADMIN";

  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Coaches state (SYSADMIN only)
  const [coaches, setCoaches] = useState<CoachUser[]>([]);
  const [availableCoaches, setAvailableCoaches] = useState<CoachUser[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [coachSaving, setCoachSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
      setError("");
    }
  }, [open, user]);

  useEffect(() => {
    if (!open || !isSysadmin) return;
    setCoachesLoading(true);
    Promise.all([
      fetchWithAuth(`/api/users/${user.id}/coaches`).then((r) => r.ok ? r.json() : []),
      fetchWithAuth(`/api/users/${user.id}/available-coaches`).then((r) => r.ok ? r.json() : []),
    ]).then(([linked, available]) => {
      setCoaches(Array.isArray(linked) ? linked.filter(Boolean) : []);
      setAvailableCoaches(Array.isArray(available) ? available.filter(Boolean) : []);
    }).catch(() => {}).finally(() => setCoachesLoading(false));
  }, [open, isSysadmin, user.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Failed to save.");
        return;
      }
      const updated: User = await res.json();
      onSaved(updated);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCoach(coachId: string) {
    setCoachSaving(true);
    try {
      const res = await fetchWithAuth(`/api/users/${user.id}/coaches/${coachId}`, { method: "POST" });
      if (res.ok) {
        const updated: CoachUser[] = await res.json();
        setCoaches(Array.isArray(updated) ? updated.filter(Boolean) : []);
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = Array.isArray(data.message) ? data.message.join(", ") : data.message || data.error || "Failed to add coach.";
        alert(msg);
      }
    } finally {
      setCoachSaving(false);
    }
  }

  async function handleRemoveCoach(coachId: string) {
    setCoachSaving(true);
    try {
      const res = await fetchWithAuth(`/api/users/${user.id}/coaches/${coachId}`, { method: "DELETE" });
      if (res.ok) {
        const updated: CoachUser[] = await res.json();
        setCoaches(Array.isArray(updated) ? updated.filter(Boolean) : []);
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = Array.isArray(data.message) ? data.message.join(", ") : data.message || data.error || "Failed to remove coach.";
        alert(msg);
      }
    } finally {
      setCoachSaving(false);
    }
  }

  const assignedClubIds = new Set(user.userClubs.map((uc) => uc.clubId));
  const availableClubs = allClubs.filter((c) => !assignedClubIds.has(c.id));
  const linkedCoachIds = new Set(coaches.map((c) => c.id));
  const selectableCoaches = availableCoaches.filter((c) => !linkedCoachIds.has(c.id));

  function coachName(c: CoachUser) {
    return [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={isSysadmin ? "max-w-lg max-h-[90vh] overflow-y-auto" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="eu-firstname">First Name</Label>
              <Input
                id="eu-firstname"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="eu-lastname">Last Name</Label>
              <Input
                id="eu-lastname"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={user.email} disabled />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>

        {/* Clubs & Coaches management for SYSADMIN */}
        {isSysadmin && (
          <div className="space-y-5 border-t pt-4 mt-2">
            {/* Clubs */}
            <div className="space-y-2">
              <Label>Clubs &amp; Academies</Label>
              {user.userClubs.filter((uc) => uc.club).length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-gray-50">
                  {user.userClubs.filter((uc) => uc.club).map((uc) => (
                    <span
                      key={uc.clubId}
                      className="inline-flex items-center gap-1 rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-800"
                    >
                      {uc.club!.name}
                      <button
                        type="button"
                        aria-label={`Remove ${uc.club!.name}`}
                        onClick={() => onRemoveClub(user.id, uc.clubId)}
                        className="ml-0.5 hover:text-red-600"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {availableClubs.length > 0 && (
                <Select
                  value=""
                  onValueChange={(val) => val && onAddClub(user.id, val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Add a Club or Academy…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClubs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {user.userClubs.length === 0 && availableClubs.length === 0 && (
                <p className="text-xs text-gray-500">No clubs available.</p>
              )}
            </div>

            {/* Coaches */}
            <div className="space-y-2">
              <Label>Coaches</Label>
              {coachesLoading ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : (
                <>
                  {coaches.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {coaches.map((coach) => (
                        <div
                          key={coach.id}
                          className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-sm"
                        >
                          <Avatar className="h-7 w-7">
                            {coach.profileImage && (
                              <AvatarImage src={coach.profileImage} alt={coachName(coach)} />
                            )}
                            <AvatarFallback className="text-xs bg-gray-200 text-gray-600">
                              {`${coach.firstName?.[0] ?? ""}${coach.lastName?.[0] ?? ""}`.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{coachName(coach)}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${coachName(coach)}`}
                            onClick={() => handleRemoveCoach(coach.id)}
                            disabled={coachSaving}
                            className="ml-1 hover:text-red-600 text-gray-400"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectableCoaches.length > 0 && (
                    <Select
                      value=""
                      onValueChange={(val) => val && handleAddCoach(val)}
                      disabled={coachSaving}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Add a coach…" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableCoaches.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {coachName(c)}
                            {c.userClubs && c.userClubs.length > 0 &&
                              ` (${c.userClubs.map((uc) => uc.club?.name ?? "").filter(Boolean).join(", ")})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {coaches.length === 0 && selectableCoaches.length === 0 && (
                    <p className="text-xs text-gray-500">
                      No coaches available. Add the user to a club to see coaches.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsersAuthPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [sectionOpen, setSectionOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [allClubs, setAllClubs] = useState<Club[]>([]);

  // create modal
  const [createOpen, setCreateOpen] = useState(false);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);

  // delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  // resend invite
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data.filter(Boolean) : []);
        setFetchError(null);
      } else {
        const data = await res.json().catch(() => ({}));
        const msg: string =
          Array.isArray(data.message)
            ? data.message.join(", ")
            : data.message || data.error || `Error ${res.status}`;
        setFetchError(msg);
      }
    } catch {
      setFetchError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchWithAuth("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((me) => {
        if (me?.role) {
          setCurrentRole(me.role as Role);
          if (me.role === "SYSADMIN" || me.role === "ADMIN") {
            fetchWithAuth("/api/clubs")
              .then((r) => r.ok ? r.json() : [])
              .then((clubs: Club[]) => setAllClubs(clubs))
              .catch(() => {});
          }
        }
      })
      .catch((err) => { console.error("Failed to fetch current user role:", err); });
  }, [fetchUsers]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase();
    const clubs = u.userClubs.map((uc) => uc.club?.name ?? "").filter(Boolean).join(", ").toLowerCase();
    return (
      name.includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      clubs.includes(q)
    );
  });

  async function handleRoleChange(userId: string, role: Role) {
    const res = await fetchWithAuth(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      const updated: User = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    }
  }

  async function handleAddUserClub(userId: string, clubId: string) {
    const res = await fetchWithAuth(`/api/users/${userId}/clubs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId }),
    });
    if (res.ok) {
      const updated: User = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditTarget((prev) => (prev?.id === updated.id ? updated : prev));
    } else {
      const data = await res.json().catch(() => ({}));
      const msg = Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || data.error || "Failed to add club.";
      alert(msg);
    }
  }

  async function handleRemoveUserClub(userId: string, clubId: string) {
    const res = await fetchWithAuth(`/api/users/${userId}/clubs/${clubId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const updated: User = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditTarget((prev) => (prev?.id === updated.id ? updated : prev));
    } else {
      const data = await res.json().catch(() => ({}));
      const msg = Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || data.error || "Failed to remove club.";
      alert(msg);
    }
  }

  function openEdit(user: User) {
    setEditTarget(user);
    setEditOpen(true);
  }

  function openDelete(user: User) {
    setDeleteTarget(user);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetchWithAuth(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message ?? "Failed to delete user.");
    }
    await fetchUsers();
  }

  async function handleResendInvite(userId: string) {
    setResendingId(userId);
    setResendMsg(null);
    try {
      const res = await fetchWithAuth(`/api/users/${userId}/resend-invite`, { method: "POST" });
      if (res.ok) {
        setResendMsg({ id: userId, ok: true, text: "Invitation sent." });
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = Array.isArray(data.message) ? data.message.join(", ") : data.message || data.error || "Failed to resend invitation.";
        setResendMsg({ id: userId, ok: false, text: msg });
      }
    } catch {
      setResendMsg({ id: userId, ok: false, text: "Network error. Please try again." });
    } finally {
      setResendingId(null);
    }
  }

  // Role options available to the current admin in the table row dropdown
  function getRoleOptions(userRole: Role): Role[] {
    if (currentRole === "SYSADMIN") {
      return ["PLAYER", "COACH", "ADMIN", "SYSADMIN"];
    }
    // ADMIN: can only assign COACH or ADMIN
    return ["COACH", "ADMIN"];
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Users &amp; Authorizations</h1>

      {/* ── Users section ── */}
      <div className="rounded-xl border bg-white shadow-sm">
        {/* Collapsible header */}
        <button
          onClick={() => setSectionOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-base font-semibold text-gray-800">Users</span>
          {sectionOpen ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>

        {sectionOpen && (
          <div className="px-5 pb-5 space-y-4 border-t">
            {/* Toolbar */}
            <div className="flex items-center gap-2 pt-4">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-8"
                  placeholder="Search users…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button onClick={() => setCreateOpen(true)} className="shrink-0">
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </div>

            {/* Table */}
            {loading ? (
              <p className="text-sm text-gray-500 py-4">Loading…</p>
            ) : fetchError ? (
              <p className="text-sm text-red-600 py-4">{fetchError}</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                {search ? "No matching users found." : "No users yet."}
              </p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-10 font-semibold" />
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">Email</TableHead>
                      <TableHead className="font-semibold">Role</TableHead>
                      <TableHead className="font-semibold">Clubs</TableHead>
                      <TableHead className="font-semibold">Last Login</TableHead>
                      <TableHead className="font-semibold">Joined</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((user) => {
                      const isSysadminRow = user.role === "SYSADMIN";
                      const canEditRole =
                        currentRole === "SYSADMIN" ||
                        (currentRole === "ADMIN" && !isSysadminRow);
                      const roleOptions = getRoleOptions(user.role);

                      return (
                        <TableRow key={user.id} onDoubleClick={() => openEdit(user)} className="cursor-pointer">
                          {/* Avatar */}
                          <TableCell>
                            <UserAvatar user={user} />
                          </TableCell>

                          {/* Name */}
                          <TableCell className="font-medium">
                            {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                          </TableCell>

                          {/* Email */}
                          <TableCell className="text-gray-600 text-sm">
                            {user.email}
                          </TableCell>

                          {/* Role selector */}
                          <TableCell>
                            {canEditRole ? (
                              <Select
                                value={user.role}
                                onValueChange={(val) =>
                                  handleRoleChange(user.id, val as Role)
                                }
                              >
                                <SelectTrigger className="h-8 w-32 text-xs">
                                  <SelectValue>
                                    <RoleBadge role={user.role} />
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {roleOptions.map((r) => (
                                    <SelectItem key={r} value={r}>
                                      {ROLE_LABELS[r]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <RoleBadge role={user.role} />
                            )}
                          </TableCell>

                          {/* Clubs */}
                          <TableCell>
                            <ClubCell
                              user={user}
                              currentRole={currentRole}
                              allClubs={allClubs}
                              onAddClub={handleAddUserClub}
                              onRemoveClub={handleRemoveUserClub}
                            />
                          </TableCell>

                          {/* Last Login */}
                          <TableCell className="text-gray-500 text-sm">
                            <span className="inline-flex items-center gap-1.5">
                              {user.lastLogin
                                ? new Date(user.lastLogin).toLocaleDateString()
                                : "—"}
                              {!user.lastLogin && (
                                <span title="Invitation pending – user has not logged in yet">
                                  <Hourglass
                                    className="h-3.5 w-3.5 text-amber-500 shrink-0"
                                    aria-label="Invitation pending"
                                  />
                                </span>
                              )}
                            </span>
                          </TableCell>

                          {/* Joined */}
                          <TableCell className="text-gray-500 text-sm">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>

                          {/* Edit + Delete */}
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1">
                                {!user.lastLogin && (
                                  <button
                                    onClick={() => handleResendInvite(user.id)}
                                    disabled={resendingId === user.id}
                                    aria-label={`Resend invitation to ${user.email}`}
                                    title="Resend invitation email"
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors disabled:opacity-50"
                                  >
                                    <Send className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => openEdit(user)}
                                  aria-label={`Edit ${user.email}`}
                                  title="Edit user"
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                >
                                  <SquarePen className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openDelete(user)}
                                  aria-label={`Delete ${user.email}`}
                                  title="Delete user"
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              {resendMsg?.id === user.id && (
                                <span className={`text-xs ${resendMsg.ok ? "text-green-600" : "text-red-600"}`}>
                                  {resendMsg.text}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create user modal */}
      {createOpen && (
        <CreateUserModal
          open={true}
          onClose={() => setCreateOpen(false)}
          onCreated={fetchUsers}
          allClubs={allClubs}
        />
      )}

      {/* Edit user modal */}
      {editOpen && editTarget && (
        <EditUserModal
          open={true}
          user={editTarget}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
            setEditTarget(updated);
          }}
          currentRole={currentRole}
          allClubs={allClubs}
          onAddClub={handleAddUserClub}
          onRemoveClub={handleRemoveUserClub}
        />
      )}

      {/* Delete confirm modal */}
      {deleteOpen && deleteTarget && (
        <DeleteUserModal
          open={true}
          userName={
            [deleteTarget.firstName, deleteTarget.lastName].filter(Boolean).join(" ") ||
            deleteTarget.email
          }
          onClose={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
