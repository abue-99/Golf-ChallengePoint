"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, KeyRound, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const TIMEZONES = [
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "America/Anchorage",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Chicago",
  "America/Denver",
  "America/Halifax",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Phoenix",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/Toronto",
  "America/Vancouver",
  "Asia/Baghdad",
  "Asia/Bangkok",
  "Asia/Colombo",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Manila",
  "Asia/Riyadh",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Taipei",
  "Asia/Tehran",
  "Asia/Tokyo",
  "Atlantic/Reykjavik",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Budapest",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Prague",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Vienna",
  "Europe/Warsaw",
  "Europe/Zurich",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Honolulu",
  "UTC",
];

type UserProfile = {
  firstName: string;
  lastName: string;
  profileImage: string | null;
  gender: string | null;
  phoneNumber: string | null;
  timezone: string | null;
};

type Club = { id: string; name: string };
type UserClub = { id: string; clubId: string; club: Club };

// ── Change Password Dialog ────────────────────────────────────────────────────

function ChangePasswordDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSaving(false);
    setSuccessMsg("");
    setErrorMsg("");
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      reset();
      onClose();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (newPassword.length < 8) {
      setErrorMsg("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("New passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message || data.error || "Failed to change password.";
        setErrorMsg(msg);
      } else {
        setSuccessMsg("Password changed successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
        </DialogHeader>

        {successMsg ? (
          <p className="text-sm text-green-600 mt-2">{successMsg}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label htmlFor="cp-current">Current Password</Label>
              <Input
                id="cp-current"
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={saving}
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cp-new">
                New Password{" "}
                <span className="text-gray-400 text-xs">(min 8 characters)</span>
              </Label>
              <Input
                id="cp-new"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={saving}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cp-confirm">Confirm New Password</Label>
              <Input
                id="cp-confirm"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={saving}
                autoComplete="new-password"
              />
            </div>

            {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Change Password"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-base font-semibold text-gray-800">{title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}
      </button>
      {open && <div className="px-5 pb-5 border-t pt-4">{children}</div>}
    </div>
  );
}

function ProfileSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile>({
    firstName: "",
    lastName: "",
    profileImage: null,
    gender: null,
    phoneNumber: null,
    timezone: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [fileSizeError, setFileSizeError] = useState("");
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [myClubs, setMyClubs] = useState<UserClub[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load profile");
        return r.json();
      })
      .then((data) => {
        if (data) {
          setProfile({
            firstName: data.firstName ?? "",
            lastName: data.lastName ?? "",
            profileImage: data.profileImage ?? null,
            gender: data.gender ?? null,
            phoneNumber: data.phoneNumber ?? null,
            timezone: data.timezone ?? null,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    Promise.all([
      fetch("/api/clubs").then((r) => r.json()),
      fetch("/api/clubs/my").then((r) => r.json()),
    ]).then(([clubs, myClubsData]) => {
      setAllClubs(Array.isArray(clubs) ? clubs : []);
      setMyClubs(Array.isArray(myClubsData) ? myClubsData : []);
    });
  }, []);

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE_MB = 2;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileSizeError(`Image must be smaller than ${MAX_SIZE_MB} MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFileSizeError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      setProfile((p) => ({ ...p, profileImage: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  }

  function handleDeleteAvatar() {
    setProfile((p) => ({ ...p, profileImage: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    setSaving(true);
    setSavedMsg("");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data?.message ?? "Failed to save profile. Please try again.");
      } else {
        setSavedMsg("Profile saved.");
        setTimeout(() => setSavedMsg(""), 3000);
      }
    } catch {
      setErrorMsg("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddClub(clubId: string) {
    setClubsLoading(true);
    try {
      const res = await fetch("/api/clubs/my", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMyClubs(Array.isArray(updated) ? updated : []);
      }
    } finally {
      setClubsLoading(false);
    }
  }

  async function handleRemoveClub(clubId: string) {
    setClubsLoading(true);
    try {
      const res = await fetch(`/api/clubs/my/${clubId}`, { method: "DELETE" });
      if (res.ok) {
        const updated = await res.json();
        setMyClubs(Array.isArray(updated) ? updated : []);
      }
    } finally {
      setClubsLoading(false);
    }
  }

  const initials =
    `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase() || "?";

  const myClubIds = new Set(myClubs.map((uc) => uc.clubId));
  const availableClubs = allClubs.filter((c) => !myClubIds.has(c.id));

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-5 max-w-lg">
      {/* Avatar row */}
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <Avatar className="h-24 w-24">
            {profile.profileImage && (
              <AvatarImage src={profile.profileImage} alt="Avatar" />
            )}
            <AvatarFallback className="text-2xl bg-gray-200 text-gray-600">
              {initials}
            </AvatarFallback>
          </Avatar>
          {profile.profileImage && (
            <button
              onClick={handleDeleteAvatar}
              aria-label="Remove avatar"
              className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-white hover:bg-orange-700 shadow"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Upload New Avatar
          </Button>
          {fileSizeError && (
            <p className="text-sm text-red-600">{fileSizeError}</p>
          )}
        </div>
      </div>

      {/* First Name */}
      <div className="space-y-1">
        <Label htmlFor="firstName">First Name</Label>
        <Input
          id="firstName"
          value={profile.firstName}
          onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
          placeholder="First Name"
        />
      </div>

      {/* Last Name */}
      <div className="space-y-1">
        <Label htmlFor="lastName">Last Name</Label>
        <Input
          id="lastName"
          value={profile.lastName}
          onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
          placeholder="Last Name"
        />
      </div>

      {/* Gender */}
      <div className="space-y-1">
        <Label>Gender</Label>
        <Select
          value={profile.gender ?? "__unset__"}
          onValueChange={(val) =>
            setProfile((p) => ({ ...p, gender: val === "__unset__" ? null : val }))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Prefer not to say" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unset__">Prefer not to say</SelectItem>
            <SelectItem value="Male">Male</SelectItem>
            <SelectItem value="Female">Female</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Phone Number */}
      <div className="space-y-1">
        <Label htmlFor="phoneNumber">Phone Number</Label>
        <Input
          id="phoneNumber"
          type="tel"
          value={profile.phoneNumber ?? ""}
          onChange={(e) =>
            setProfile((p) => ({ ...p, phoneNumber: e.target.value || null }))
          }
          placeholder="+1 555 000 0000"
        />
      </div>

      {/* Timezone */}
      <div className="space-y-1">
        <Label>Timezone</Label>
        <Select
          value={profile.timezone ?? "__unset__"}
          onValueChange={(val) =>
            setProfile((p) => ({ ...p, timezone: val === "__unset__" ? null : val }))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unset__">— Select timezone —</SelectItem>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clubs & Academies */}
      <div className="space-y-2">
        <Label>Clubs &amp; Academies</Label>
        {myClubs.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-gray-50">
            {myClubs.map((uc) => (
              <span
                key={uc.clubId}
                className="inline-flex items-center gap-1 rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-800"
              >
                {uc.club.name}
                <button
                  type="button"
                  aria-label={`Remove ${uc.club.name}`}
                  onClick={() => handleRemoveClub(uc.clubId)}
                  disabled={clubsLoading}
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
            onValueChange={(val) => val && handleAddClub(val)}
            disabled={clubsLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Add a Club or Academy…" />
            </SelectTrigger>
            <SelectContent>
              {availableClubs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {myClubs.length === 0 && availableClubs.length === 0 && (
          <p className="text-xs text-gray-500">No clubs available.</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
        {errorMsg && (
          <span className="text-sm text-red-600">{errorMsg}</span>
        )}
      </div>

      <div className="pt-2 border-t">
        <Button
          variant="outline"
          onClick={() => setChangePasswordOpen(true)}
          className="gap-2"
        >
          <KeyRound size={15} />
          Change Password
        </Button>
      </div>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  );
}

function NotificationsSection() {
  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-gray-500">Notification settings coming soon.</p>
    </div>
  );
}

export default function PersonalPage() {
  const searchParams = useSearchParams();
  const section = searchParams.get("section");

  // Open the profile section by default unless a specific other section is requested.
  const profileDefaultOpen = section === null || section === "profile";

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-semibold">Personal</h1>

      <CollapsibleSection title="Profile" defaultOpen={profileDefaultOpen}>
        <ProfileSection />
      </CollapsibleSection>

      <CollapsibleSection title="Notifications" defaultOpen={section === "notifications"}>
        <NotificationsSection />
      </CollapsibleSection>
    </div>
  );
}
