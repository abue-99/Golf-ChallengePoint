import { Building2, Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type LibraryVisibility = "PRIVATE" | "CLUB" | "PUBLIC";

export const LIBRARY_VISIBILITY_OPTIONS: {
  value: LibraryVisibility;
  label: string;
  hint: string;
}[] = [
  { value: "PRIVATE", label: "Private", hint: "Only you" },
  {
    value: "CLUB",
    label: "Club",
    hint: "Coaches of your club",
  },
  { value: "PUBLIC", label: "Public", hint: "All coaches" },
];

/** Private / Club / Public chip for lessons and journeys. */
export default function LibraryVisibilityBadge({
  visibility,
  className,
}: {
  visibility: string;
  className?: string;
}) {
  const config =
    visibility === "PUBLIC"
      ? { icon: Globe, label: "Public", tone: "bg-green-50 text-green-700" }
      : visibility === "CLUB"
        ? { icon: Building2, label: "Club", tone: "bg-sky-50 text-sky-700" }
        : { icon: Lock, label: "Private", tone: "bg-slate-100 text-slate-600" };
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
        config.tone,
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  );
}

/** Copies a club or public lesson into the coach's own library. */
export async function copyLessonToMyLibrary(id: string) {
  const res = await fetch(`/api/lessons/${encodeURIComponent(id)}/copy`, {
    method: "POST",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" && data.message) ||
        "The lesson could not be copied.",
    );
  }
  return data as { id: string; name: string };
}
