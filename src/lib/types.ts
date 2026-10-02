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
  /** Natural scope/quantity facts the user can defend. */
  scale: string[];
  /** What the user personally owned, decided, reviewed, changed or delivered. */
  ownership: string[];
  /** Difficulties and how the user handled them. */
  difficulties: string[];
  /** Repositories, reports, files, demos, certificates or other traceable proof. */
  artifacts: string[];
}

export interface ExperienceAiContext {
  /** null means not discussed yet. */
  assisted: boolean | null;
  /** What AI generated or assisted with. Internal truth boundary; never a resume claim by itself. */
  aiContribution: string[];
  /** What the user personally decided, reviewed, modified, debugged, integrated, tested or validated. */
  userContribution: string[];
}

export interface ExperienceInterviewPrep {
  /** Concrete questions/topics the candidate should be ready to explain truthfully. */
  questions: string[];
  /** Known weak points or unclear areas to review before an interview. */
  weakPoints: string[];
  /** Technical/product topics worth reviewing; not invented answers. */
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
  /**
   * Legacy free-form fact list retained for backward compatibility with existing local/cloud backups.
   * New structured facts should be written to evidence/aiContext/interviewPrep instead.
   */
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
  /** Backward-compatible preview/source for image credentials. */
  imageDataUrl?: string;
  /** Generic uploaded source. Supports image data URLs and application/pdf data URLs. */
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
  version: 3;
  profile: Profile;
  experiences: Experience[];
  credentials: Credential[];
  jd: string;
  updatedAt: string;
}
