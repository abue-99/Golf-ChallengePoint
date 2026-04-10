"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Tile = {
  title: string;
  links: { label: string; href: string; coachOnly?: boolean }[];
  adminOnly?: boolean;
};

const TILES: Tile[] = [
  {
    title: "Personal",
    links: [
      { label: "Profile", href: "/settings/profile" },
      { label: "Notifications", href: "/settings/notifications" },
      { label: "Teams", href: "/settings/teams", coachOnly: true },
    ],
  },
  {
    title: "Training & Tasks",
    links: [],
  },
  {
    title: "Clubs & Academies",
    links: [],
    adminOnly: true,
  },
  {
    title: "Users & Authorizations",
    links: [],
  },
];

export default function SettingsPage() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setRole(data?.role ?? null))
      .catch(() => {});
  }, []);

  const isAdmin = role === "ADMIN";
  const isCoach = role === "COACH";

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((tile) => {
          if (tile.adminOnly && !isAdmin) return null;
          const visibleLinks = tile.links.filter(
            (l) => !l.coachOnly || isCoach
          );
          return (
            <div
              key={tile.title}
              className="rounded-xl border bg-white p-5 shadow-sm space-y-3"
            >
              <h2 className="text-sm font-semibold text-gray-700">
                {tile.title}
              </h2>
              {visibleLinks.length > 0 && (
                <ul className="space-y-1">
                  {visibleLinks.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}