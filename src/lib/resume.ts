import { detectLowSignalText, getExperienceEvidenceStrength } from "@/lib/hrRules";
import type { Experience, Profile } from "@/lib/types";

function compact(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join("；");
}

function cleanLowSignal(text: string): string {
  let result = text;
  for (const phrase of detectLowSignalText(text)) {
    result = result.replaceAll(phrase, "");
  }
  return result.replace(/[；，,]{2,}/g, "；").trim();
}

export interface ProfessionalBullet {
  text: string;
  rationale: string[];
  /** @deprecated UI compatibility alias. Prefer rationale in new code. */
  reasons: string[];
  warnings: string[];
}

export function buildProfessionalResumeBullet(experience: Experience): ProfessionalBullet {
  const facts = experience.verifiedFacts.filter(Boolean).slice(0, 2);
  const base = compact([
    cleanLowSignal(experience.actions || experience.rawDescription),
    experience.tools ? `使用 ${experience.tools}` : "",
    cleanLowSignal(experience.outcomes),
    facts.join("；"),
  ]);

  const rationale: string[] = [];
  const warnings: string[] = [];
  if (experience.actions) rationale.push("优先保留你的具体动作，而不是只写岗位职责");
  if (experience.tools) rationale.push("保留工具/方法，帮助 HR 判断能力是否可迁移");
  if (experience.outcomes) rationale.push("保留结果或交付，形成完整的行动→结果证据链");
  if (facts.length) rationale.push("使用已确认事实增强可信度");
  if (!experience.outcomes) warnings.push("缺少结果/交付，建议继续追问后再投递");
  if (!experience.verifiedFacts.length) warnings.push("缺少已确认事实，当前表述可读但证据偏弱");

  return {
    text: base || "这段经历信息不足，建议先补充具体动作和结果。",
    rationale,
    reasons: rationale,
    warnings,
  };
}

export function buildResumeBullet(experience: Experience): string {
  return buildProfessionalResumeBullet(experience).text;
}

export function buildSummary(profile: Profile, experiences: Experience[]): string {
  const strongest = [...experiences].sort((a, b) => getExperienceEvidenceStrength(b) - getExperienceEvidenceStrength(a));
  const tools = Array.from(
    new Set(
      strongest
        .flatMap((experience) => experience.tools.split(/[，,、/]/))
        .map((tool) => tool.trim())
        .filter(Boolean),
    ),
  ).slice(0, 4);

  const identity = [profile.school, profile.major, profile.degree].filter(Boolean).join(" · ");
  if (!tools.length) return identity ? `${identity}，具备可进一步挖掘的项目与实践经历。` : "请先补充教育背景和经历事实。";
  return `${identity ? `${identity}，` : ""}具备 ${tools.join("、")} 等实践经验；简历内容将按目标岗位相关性选择，不使用无证据的性格评价。`;
}
