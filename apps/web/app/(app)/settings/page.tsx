"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import UserSettingsSection from "./user-settings-section";
import ClubSettingsSection from "./club-settings-section";
import ClubAdminsSection from "./club-admins-section";

export default function SettingsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setRole(data?.role ?? null);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-6">Loading settings...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Settings</h1>

      {/* Personal section */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-1">Personal</h2>
        <ul className="space-y-1 pt-1">
          <li>
            <Link
              href="/settings/profile"
              className="text-sm text-blue-600 hover:underline"
            >
              Profile
            </Link>
          </li>
        </ul>
      </div>

      <Tabs defaultValue="user" className="space-y-6">

        {/* Tabs Navigation */}
        <TabsList>
          <TabsTrigger value="user">My Profile</TabsTrigger>

          {(role === "COACH" || role === "CLUBADMIN" || role === "SUPERADMIN") && (
            <TabsTrigger value="club">Club Settings</TabsTrigger>
          )}

          {(role === "CLUBADMIN" || role === "SUPERADMIN") && (
            <TabsTrigger value="admins">Club Admins</TabsTrigger>
          )}
        </TabsList>

        {/* User Settings */}
        <TabsContent value="user">
          <UserSettingsSection />
        </TabsContent>

        {/* Club Settings */}
        {(role === "COACH" || role === "CLUBADMIN" || role === "SUPERADMIN") && (
          <TabsContent value="club">
            <ClubSettingsSection role={role!} />
          </TabsContent>
        )}

        {/* Club Admin Management */}
        {(role === "CLUBADMIN" || role === "SUPERADMIN") && (
          <TabsContent value="admins">
            <ClubAdminsSection />
          </TabsContent>
        )}

      </Tabs>
    </div>
  );
}