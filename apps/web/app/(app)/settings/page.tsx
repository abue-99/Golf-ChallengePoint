import { cookies } from "next/headers";
import Link from "next/link";
import { verifyJwt } from "@/lib/jwt";

type Tile = {
  title: string;
  links: { label: string; href: string }[];
};

async function getUserRole(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return "PLAYER";
  try {
    const payload = verifyJwt<{ role: string }>(token);
    return payload?.role ?? "PLAYER";
  } catch {
    return "PLAYER";
  }
}

export default async function SettingsPage() {
  const role = await getUserRole();
  const isSysAdmin = role === "SYSADMIN";
  const isAdminOrSysAdmin = role === "ADMIN" || role === "SYSADMIN";

  const TILES: Tile[] = [
    {
      title: "Personal",
      links: [
        { label: "Profile & Notifications", href: "/settings/personal" },
      ],
    },
    {
      title: "Training & Tasks",
      links: [],
    },
    ...(isSysAdmin
      ? [
          {
            title: "General data",
            links: [{ label: "Clubs/ Academies", href: "/settings/general-data" }],
          },
        ]
      : []),
    ...(isAdminOrSysAdmin
      ? [
          {
            title: "Users & Authorizations",
            links: [{ label: "Users", href: "/settings/users-auth" }],
          },
        ]
      : []),
  ];

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