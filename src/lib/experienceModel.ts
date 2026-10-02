import type { Experience, ExperienceAiContext, ExperienceEvidence, ExperienceInterviewPrep } from "@/lib/types";

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function emptyEvidence(): ExperienceEvidence {
  return { scale: [], ownership: [], difficulties: [], artifacts: [] };
}

function emptyAiContext(): ExperienceAiContext {
  return { assisted: null, aiContribution: [], userContribution: [] };
}

function emptyInterviewPrep(): ExperienceInterviewPrep {
  return { questions: [], weakPoints: [], topicsToReview: [] };
}

function legacyPayload(fact: string, prefix: string): string {
  return fact.replace(new RegExp(`^\\s*${prefix}\\s*[：:]\\s*`), "").trim();
}

export function normalizeExperienceV3(experience: Experience): Experience {
  const evidence = { ...emptyEvidence(), ...(experience.evidence || {}) };
  evidence.scale = unique(evidence.scale || []);
  evidence.ownership = unique(evidence.ownership || []);
  evidence.difficulties = unique(evidence.difficulties || []);
  evidence.artifacts = unique(evidence.artifacts || []);

  const aiContext = { ...emptyAiContext(), ...(experience.aiContext || {}) };
  aiContext.aiContribution = unique(aiContext.aiContribution || []);
  aiContext.userContribution = unique(aiContext.userContribution || []);

  const interviewPrep = { ...emptyInterviewPrep(), ...(experience.interviewPrep || {}) };
  interviewPrep.questions = unique(interviewPrep.questions || []);
  interviewPrep.weakPoints = unique(interviewPrep.weakPoints || []);
  interviewPrep.topicsToReview = unique(interviewPrep.topicsToReview || []);

  for (const fact of Array.isArray(experience.verifiedFacts) ? experience.verifiedFacts : []) {
    if (/^\s*规模\s*[：:]/.test(fact)) evidence.scale.push(legacyPayload(fact, "规模"));
    else if (/^\s*个人贡献\s*[：:]/.test(fact)) evidence.ownership.push(legacyPayload(fact, "个人贡献"));
    else if (/^\s*难点\s*[：:]/.test(fact)) evidence.difficulties.push(legacyPayload(fact, "难点"));
    else if (/^\s*证据\s*[：:]/.test(fact)) evidence.artifacts.push(legacyPayload(fact, "证据"));
    else if (/^\s*AI参与\s*[：:]/.test(fact)) {
      aiContext.assisted = true;
      aiContext.aiContribution.push(legacyPayload(fact, "AI参与"));
    } else if (/^\s*面试准备\s*[：:]/.test(fact)) {
      interviewPrep.questions.push(legacyPayload(fact, "面试准备"));
    }
  }

  evidence.scale = unique(evidence.scale);
  evidence.ownership = unique(evidence.ownership);
  evidence.difficulties = unique(evidence.difficulties);
  evidence.artifacts = unique(evidence.artifacts);
  aiContext.aiContribution = unique(aiContext.aiContribution);
  aiContext.userContribution = unique(aiContext.userContribution);
  interviewPrep.questions = unique(interviewPrep.questions);

  return {
    ...experience,
    verifiedFacts: Array.isArray(experience.verifiedFacts) ? experience.verifiedFacts : [],
    evidence,
    aiContext,
    interviewPrep,
    schemaVersion: 3,
  };
}

export function getResumeEvidenceFacts(experience: Experience): string[] {
  const normalized = normalizeExperienceV3(experience);
  const legacySafe = normalized.verifiedFacts.filter((fact) => !/^\s*(AI参与|面试准备|规模|个人贡献|难点|证据)\s*[：:]/.test(fact));
  return unique([
    ...legacySafe,
    ...normalized.evidence!.scale,
    ...normalized.evidence!.ownership,
    ...normalized.evidence!.difficulties,
    ...normalized.evidence!.artifacts,
    ...normalized.aiContext!.userContribution,
  ]);
}

export function getInterviewPrepItems(experience: Experience): string[] {
  const normalized = normalizeExperienceV3(experience);
  return unique([
    ...normalized.interviewPrep!.questions,
    ...normalized.interviewPrep!.weakPoints,
    ...normalized.interviewPrep!.topicsToReview,
  ]);
}

export function hasStructuredGoal(experience: Experience, goal: "scale" | "ownership" | "difficulty" | "evidence"): boolean {
  const normalized = normalizeExperienceV3(experience);
  if (goal === "scale") return normalized.evidence!.scale.length > 0;
  if (goal === "ownership") return normalized.evidence!.ownership.length > 0 || normalized.aiContext!.userContribution.length > 0;
  if (goal === "difficulty") return normalized.evidence!.difficulties.length > 0;
  return normalized.evidence!.artifacts.length > 0;
}

export type StructuredFactTarget =
  | "actions"
  | "tools"
  | "outcomes"
  | "scale"
  | "ownership"
  | "difficulty"
  | "evidence"
  | "aiContribution"
  | "userContribution"
  | "interviewPrep";

function mergeText(existing: string, value: string): string {
  if (!value.trim()) return existing;
  if (!existing.trim()) return value.trim();
  if (existing.includes(value.trim())) return existing;
  return `${existing}；${value.trim()}`;
}

export function applyStructuredFact(experience: Experience, target: StructuredFactTarget, value: string): Experience {
  const next = normalizeExperienceV3(experience);
  const clean = value.trim();
  if (!clean) return next;

  if (target === "actions") next.actions = mergeText(next.actions, clean);
  else if (target === "tools") next.tools = mergeText(next.tools, clean);
  else if (target === "outcomes") next.outcomes = mergeText(next.outcomes, clean);
  else if (target === "scale") next.evidence!.scale = unique([...next.evidence!.scale, clean]);
  else if (target === "ownership") next.evidence!.ownership = unique([...next.evidence!.ownership, clean]);
  else if (target === "difficulty") next.evidence!.difficulties = unique([...next.evidence!.difficulties, clean]);
  else if (target === "evidence") next.evidence!.artifacts = unique([...next.evidence!.artifacts, clean]);
  else if (target === "aiContribution") {
    next.aiContext!.assisted = true;
    next.aiContext!.aiContribution = unique([...next.aiContext!.aiContribution, clean]);
  } else if (target === "userContribution") {
    next.aiContext!.userContribution = unique([...next.aiContext!.userContribution, clean]);
  } else if (target === "interviewPrep") {
    next.interviewPrep!.questions = unique([...next.interviewPrep!.questions, clean]);
  }
  return next;
}
