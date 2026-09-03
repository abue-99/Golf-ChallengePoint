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
  name: string;
  description: string | null;
  category: string | null;
  difficulty: JourneyTemplateDifficulty | null;
  coverImageUrl: string | null;
  lessons: JourneyTemplateLesson[];
  createdAt: string;
  updatedAt: string;
};
