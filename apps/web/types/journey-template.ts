export type JourneyTemplateDifficulty =
  | "BEGINNER"
  | "INTERMEDIATE"
  | "ADVANCED";

export type JourneyTemplateLesson = {
  id: string;
  lessonId: string;
  sortOrder: number;
  isRequired: boolean;
  lesson: {
    id: string;
    name: string;
    focusArea: string;
    durationMinutes: number;
  };
};

export type JourneyTemplate = {
  id: string;
  coachId: string;
  visibility: "PUBLIC" | "PRIVATE";
  name: string;
  description: string | null;
  category: string | null;
  difficulty: JourneyTemplateDifficulty | null;
  coverImageUrl: string | null;
  lessons: JourneyTemplateLesson[];
  coach?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};
