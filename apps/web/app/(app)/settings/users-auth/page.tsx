"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, SquarePen, Search, X } from "lucide-react";
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
import { fetchWithAuth } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "PLAYER" | "COACH" | "ADMIN" | "SYSADMIN";

type Club = { id: string; name: string };

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImage: string | null;
  role: Role;
  createdAt: string;
  lastLogin: string | null;
  userClubs: { clubId: string; club: Club }[];
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
  const assignedIds = new Set(user.userClubs.map((uc) => uc.clubId));
  const available = allClubs.filter((c) => !assignedIds.has(c.id));

  if (currentRole !== "SYSADMIN") {
    const names = user.userClubs.map((uc) => uc.club.name);
    return (
      <span className="text-gray-600 text-sm">
        {names.length > 0 ? names.join(", ") : "—"}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {user.userClubs.map((uc) => (
        <span
          key={uc.clubId}
          className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800"
        >
          {uc.club.name}
          <button
            type="button"
            aria-label={`Remove ${uc.club.name}`}
            onClick={() => onRemoveClub(user.id, uc.clubId)}
            className="ml-0.5 hover:text-red-600"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <Select
          value=""
          onValueChange={(val) => val && onAddClub(user.id, val)}
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
}: {
  open: boolean;
  user: User;
  onClose: () => void;
  onSaved: (updated: User) => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
      setError("");
    }
  }, [open, user]);

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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
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

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/users");
      if (res.ok) {
        setUsers(await res.json());
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
    const clubs = u.userClubs.map((uc) => uc.club.name).join(", ").toLowerCase();
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
    }
  }

  async function handleRemoveUserClub(userId: string, clubId: string) {
    const res = await fetchWithAuth(`/api/users/${userId}/clubs/${clubId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const updated: User = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
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
            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
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
                        <TableRow key={user.id}>
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
                            {user.lastLogin
                              ? new Date(user.lastLogin).toLocaleDateString()
                              : "—"}
                          </TableCell>

                          {/* Joined */}
                          <TableCell className="text-gray-500 text-sm">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>

                          {/* Edit + Delete */}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEdit(user)}
                                aria-label={`Edit ${user.email}`}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              >
                                <SquarePen className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openDelete(user)}
                                aria-label={`Delete ${user.email}`}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
          onSaved={(updated) =>
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
          }
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
