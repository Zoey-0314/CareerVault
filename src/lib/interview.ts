import { hasStructuredGoal, normalizeExperienceV3 } from "@/lib/experienceModel";
import type { Experience } from "@/lib/types";

export type InterviewGoal =
  | "specificity"
  | "tool"
  | "scale"
  | "result"
  | "ownership"
  | "difficulty"
  | "evidence";

export interface InterviewQuestion {
  id: string;
  goal: InterviewGoal;
  question: string;
  why: string;
  options: string[];
  placeholder: string;
}

export interface ReadinessItem {
  key: InterviewGoal | "basic";
  label: string;
  complete: boolean;
}

function hasScale(experience: Experience): boolean {
  const normalized = normalizeExperienceV3(experience);
  const text = [normalized.rawDescription, normalized.actions, normalized.outcomes, ...normalized.evidence!.scale].join(" ");
  return normalized.evidence!.scale.length > 0 || /\d|多张|多次|多人|百余|数十|若干|余份|余篇|余场/.test(text);
}

export function getExperienceReadiness(experience: Experience): { score: number; items: ReadinessItem[]; label: string } {
  const normalized = normalizeExperienceV3(experience);
  const items: ReadinessItem[] = [
    { key: "basic", label: "基础信息", complete: Boolean(normalized.title.trim() && normalized.organization.trim() && normalized.rawDescription.trim()) },
    { key: "specificity", label: "具体动作", complete: normalized.actions.trim().length >= 8 },
    { key: "tool", label: "工具/方法", complete: Boolean(normalized.tools.trim()) },
    { key: "scale", label: "工作规模", complete: hasScale(normalized) },
    { key: "result", label: "结果/交付", complete: normalized.outcomes.trim().length >= 6 },
    { key: "ownership", label: "个人贡献", complete: hasStructuredGoal(normalized, "ownership") },
    { key: "difficulty", label: "难点/解决", complete: hasStructuredGoal(normalized, "difficulty") },
    { key: "evidence", label: "证明材料", complete: hasStructuredGoal(normalized, "evidence") },
  ];
  const weights: Record<string, number> = { basic: 20, specificity: 22, tool: 12, scale: 12, result: 18, ownership: 8, difficulty: 5, evidence: 3 };
  const score = items.reduce((sum, item) => sum + (item.complete ? weights[item.key] : 0), 0);
  const label = score >= 85 ? "强经历" : score >= 60 ? "可生成" : score >= 35 ? "继续补充" : "信息不足";
  return { score, items, label };
}
