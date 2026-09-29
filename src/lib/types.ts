export type ExperienceType =
  | "internship"
  | "work"
  | "project"
  | "campus"
  | "competition"
  | "research"
  | "coursework"
  | "volunteer";

export interface Profile {
  name: string;
  email: string;
  phone: string;
  city: string;
  school: string;
  major: string;
  degree: string;
  graduation: string;
}

export interface Experience {
  id: string;
  type: ExperienceType;
  title: string;
  organization: string;
  startDate: string;
  endDate: string;
  rawDescription: string;
  actions: string;
  tools: string;
  outcomes: string;
  verifiedFacts: string[];
}

export interface JobMatch {
  experienceId: string;
  score: number;
  matchedKeywords: string[];
}

export interface ResumeDraft {
  summary: string;
  selectedExperienceIds: string[];
}
