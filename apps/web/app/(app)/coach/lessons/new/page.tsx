"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import LessonForm from "@/components/LessonForm";

export default function NewLessonPage() {
  return (
    <div className="space-y-5">
      <header>
        <Link
          href="/coach/lessons"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Lessons
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create Training Lesson
        </h1>
        <p className="text-sm text-slate-500">
          Fill in the details below. Fields marked <span className="text-red-500">*</span> are required.
        </p>
      </header>

      <LessonForm />
    </div>
  );
}
