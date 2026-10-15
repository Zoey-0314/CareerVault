import { applyStructuredFact, normalizeExperienceV3, type StructuredFactTarget } from "@/lib/experienceModel";
import type { Experience } from "@/lib/types";
import type { InterviewGoal } from "@/lib/interview";

export type FactStatus = "confirmed" | "needs_confirmation";
export type FactTarget = StructuredFactTarget;

export interface ExtractedFact {
  id: string;
  goal: InterviewGoal;
  target: FactTarget;
  value: string;
  status: FactStatus;
  confidence: number;
  sourceText: string;
  reason: string;
}

export interface InterviewAgentAnalysis {
  acknowledgement: string;
  extractedFacts: ExtractedFact[];
  warnings: string[];
  suggestedNextGoal?: InterviewGoal;
}

export function applyConfirmedAgentFacts(experience: Experience, analysis: InterviewAgentAnalysis): Experience {
  let next = normalizeExperienceV3(experience);
  for (const fact of analysis.extractedFacts.filter((item) => item.status === "confirmed")) {
    next = applyStructuredFact(next, fact.target, fact.value);
  }
  return next;
}
