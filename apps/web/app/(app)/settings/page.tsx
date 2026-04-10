"use client";

import Link from "next/link";

type Tile = {
  title: string;
  links: { label: string; href: string }[];
};

const TILES: Tile[] = [
  {
    title: "Personal",
    links: [
      { label: "Profile", href: "/settings/profile" },
      { label: "Notifications", href: "/settings/notifications" },
    ],
  },
  {
    title: "Training & Tasks",
    links: [],
  },
  {
    title: "General data",
    links: [
      { label: "Clubs/ Academies", href: "/settings/general-data" },
    ],
  },
  {
    title: "Users & Authorizations",
    links: [
      { label: "Users", href: "/settings/users-auth" },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((tile) => (
          <div
            key={tile.title}
            className="rounded-xl border bg-white p-5 shadow-sm space-y-3"
          >
            <h2 className="text-sm font-semibold text-gray-700">
              {tile.title}
            </h2>
            {tile.links.length > 0 && (
              <ul className="space-y-1">
                {tile.links.map((link) => (
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
        ))}
      </div>
    </div>
  );
}