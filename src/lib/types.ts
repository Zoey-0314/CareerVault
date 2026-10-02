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

export interface ExperienceEvidence {
  scale: string[];
  ownership: string[];
  difficulties: string[];
  artifacts: string[];
}

export interface ExperienceAiContext {
  assisted: boolean | null;
  aiContribution: string[];
  userContribution: string[];
}

export interface ExperienceInterviewPrep {
  questions: string[];
  weakPoints: string[];
  topicsToReview: string[];
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
  evidence?: ExperienceEvidence;
  aiContext?: ExperienceAiContext;
  interviewPrep?: ExperienceInterviewPrep;
  schemaVersion?: 3;
  source?: "manual" | "workspace";
}

export type CredentialType = "award" | "certificate" | "honor" | "competition" | "other";
export type CredentialLevel = "international" | "national" | "provincial" | "city" | "school" | "organization" | "industry" | "unknown";

export interface CredentialAssessment {
  /** Resume value score. This is NOT OCR/recognition confidence. */
  score: number;
  tier: "旗舰" | "高价值" | "有效" | "补充" | "信息不足";
  level: CredentialLevel;
  rationale: string[];
  whatItProves: string;
  followUpQuestion?: string;
  needsConfirmation: boolean;
  /** Confidence that uploaded document fields were read correctly; undefined for manual-only entries. */
  recognitionConfidence?: number;
  recognitionLabel?: "高" | "中" | "低";
  recognitionNotes?: string[];
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
  attachmentDataUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
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
  version: 2 | 3;
  profile: Profile;
  experiences: Experience[];
  credentials: Credential[];
  jd: string;
  updatedAt: string;
}
