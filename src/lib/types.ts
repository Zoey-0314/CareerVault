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
  source?: "manual" | "workspace";
}

export type CredentialType = "award" | "certificate" | "honor" | "competition" | "other";
export type CredentialLevel = "international" | "national" | "provincial" | "city" | "school" | "organization" | "industry" | "unknown";

export interface CredentialAssessment {
  score: number;
  tier: "旗舰" | "高价值" | "有效" | "补充" | "信息不足";
  level: CredentialLevel;
  rationale: string[];
  whatItProves: string;
  followUpQuestion?: string;
  needsConfirmation: boolean;
}

export interface Credential {
  id: string;
  type: CredentialType;
  name: string;
  issuer: string;
  date: string;
  rank: string;
  description: string;
  imageDataUrl?: string;
  assessment?: CredentialAssessment;
  followUpAnswer?: string;
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

export interface VaultState {
  version: 2;
  profile: Profile;
  experiences: Experience[];
  credentials: Credential[];
  jd: string;
  updatedAt: string;
}
