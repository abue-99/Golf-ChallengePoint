"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import AssignLessonModal from "@/components/AssignLessonModal";
import { toast } from "sonner";

export default function AssignLessonButton({ playerId }: { playerId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2"
        size="sm"
      >
        <BookOpen className="h-4 w-4" />
        + Assign Lesson
      </Button>
      <AssignLessonModal
        open={open}
        onClose={() => setOpen(false)}
        preselectedPlayerId={playerId}
        onAssigned={() => toast.success("Lesson assigned.")}
      />
    </>
  );
}
