import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Settings</h1>

      {/* Personal tile */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-1">Personal</h2>
        <ul className="space-y-1 pt-1">
          <li>
            <Link href="/settings/profile" className="text-sm text-blue-600 hover:underline">
              Profile
            </Link>
          </li>
          <li>
            <Link href="/settings/notifications" className="text-sm text-blue-600 hover:underline">
              Notifications
            </Link>
          </li>
        </ul>
      </div>

      {/* Unknown tile */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-700 border-b pb-1">Unknown</h2>
      </div>
    </div>
  );
}