"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Search } from "lucide-react";
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

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImage: string | null;
  role: Role;
  createdAt: string;
  lastLogin: string | null;
};

type NewUserForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
};

const EMPTY_NEW_USER: NewUserForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "PLAYER",
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

// ── Role badge ────────────────────────────────────────────────────────────────

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

// ── Create user modal ─────────────────────────────────────────────────────────

function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
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
      const res = await fetchWithAuth("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          role: form.role,
        }),
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
            <Label>Role</Label>
            <Select
              value={form.role}
              onValueChange={(val) => setForm((f) => ({ ...f, role: val as Role }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PLAYER">Player</SelectItem>
                <SelectItem value="COACH">Coach</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SYSADMIN">Sysadmin</SelectItem>
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsersAuthPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [sectionOpen, setSectionOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // create modal
  const [createOpen, setCreateOpen] = useState(false);

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
  }, [fetchUsers]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase();
    return (
      name.includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
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
                      <TableHead className="font-semibold">Joined</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((user) => (
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
                              <SelectItem value="PLAYER">Player</SelectItem>
                              <SelectItem value="COACH">Coach</SelectItem>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                              <SelectItem value="SYSADMIN">Sysadmin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Joined */}
                        <TableCell className="text-gray-500 text-sm">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>

                        {/* Delete */}
                        <TableCell>
                          <button
                            onClick={() => openDelete(user)}
                            aria-label={`Delete ${user.email}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
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
