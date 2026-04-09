"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function ProfilePage() {
  const router = useRouter();
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

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
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
      });
  }, []);

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
    await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    setSavedMsg("Profile saved.");
    setTimeout(() => setSavedMsg(""), 3000);
  }

  const initials =
    `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase() || "?";

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* Avatar */}
      <div className="space-y-3">
        <div className="relative w-fit">
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
          value={profile.gender ?? ""}
          onValueChange={(val) =>
            setProfile((p) => ({ ...p, gender: val === "" ? null : val }))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Prefer not to say" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Prefer not to say</SelectItem>
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
          value={profile.timezone ?? ""}
          onValueChange={(val) =>
            setProfile((p) => ({ ...p, timezone: val === "" ? null : val }))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">— Select timezone —</SelectItem>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
      </div>
    </div>
  );
}
