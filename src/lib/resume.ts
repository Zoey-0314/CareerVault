import { detectLowSignalText, getExperienceEvidenceStrength } from "@/lib/hrRules";
import type { Experience, Profile } from "@/lib/types";

function cleanLowSignal(text: string): string {
  let result = text;
  for (const phrase of detectLowSignalText(text)) result = result.replaceAll(phrase, "");
  return result.replace(/[；，,]{2,}/g, "；").replace(/^[-•\s]+/, "").trim();
}

function clauses(text: string): string[] {
  return text
    .split(/[。；;\n]+/)
    .map((item) => cleanLowSignal(item))
    .map((item) => item.replace(/^\d+[、.．]\s*/, "").trim())
    .filter((item) => item.length >= 6);
}

function isInternalInterviewFact(text: string): boolean {
  return /^\s*(AI参与|面试准备)\s*[：:]/.test(text);
}

function unique(items: string[]): string[] {
  const result: string[] = [];
  for (const item of items) {
    if (!result.some((existing) => existing.includes(item) || item.includes(existing))) result.push(item);
  }
  return result;
}

function trimBullet(text: string): string {
  const normalized = text.replace(/\s+/g, " ").replace(/[，；;]+$/, "").trim();
  if (normalized.length <= 92) return normalized;
  const preferredCut = Math.max(normalized.lastIndexOf("，", 88), normalized.lastIndexOf(",", 88));
  if (preferredCut >= 36) return normalized.slice(0, preferredCut);
  return `${normalized.slice(0, 88)}…`;
}

export interface ProfessionalBullet {
  text: string;
  rationale: string[];
  /** @deprecated UI compatibility alias. Prefer rationale in new code. */
  reasons: string[];
  warnings: string[];
}

export function buildTargetedResumeBullets(experience: Experience, matchedKeywords: string[]): string[] {
  const keywordSet = matchedKeywords.map((item) => item.toLowerCase()).filter(Boolean);
  const resumeFacts = experience.verifiedFacts.filter((fact) => !isInternalInterviewFact(fact));
  const candidates = unique([
    ...clauses(experience.actions),
    ...clauses(experience.outcomes),
    ...resumeFacts.flatMap(clauses),
    ...clauses(experience.rawDescription),
  ]).filter((item) => !isInternalInterviewFact(item));

  const ranked = candidates
    .map((text, index) => {
      const lower = text.toLowerCase();
      const keywordHits = keywordSet.filter((keyword) => lower.includes(keyword)).length;
      const hasResultSignal = /完成|交付|上线|修复|降低|提升|通过|负责|设计|开发|分析|检查|策划|协调|生成|部署|验证|实现|优化/.test(text);
      const hasEvidence = /\d/.test(text) || resumeFacts.some((fact) => fact.includes(text) || text.includes(fact));
      return { text, score: keywordHits * 6 + (hasResultSignal ? 2 : 0) + (hasEvidence ? 2 : 0) - index * 0.05 };
    })
    .sort((a, b) => b.score - a.score);

  const matched = ranked.filter((item) => item.score >= 5);
  const pool = matched.length ? matched : ranked.filter((item) => item.score >= 2);
  const bullets = pool.slice(0, 3).map((item) => trimBullet(item.text));

  if (!bullets.length) {
    const fallback = trimBullet(cleanLowSignal(experience.actions || experience.outcomes || experience.rawDescription));
    return fallback && !isInternalInterviewFact(fallback) ? [fallback] : [];
  }
  return bullets;
}

export function buildProfessionalResumeBullet(experience: Experience): ProfessionalBullet {
  const text = buildTargetedResumeBullets(experience, []).join("；");
  const rationale: string[] = [];
  const warnings: string[] = [];
  if (experience.actions) rationale.push("优先保留具体动作，而不是岗位职责堆叠");
  if (experience.outcomes) rationale.push("保留可验证结果或交付");
  if (experience.verifiedFacts.some((fact) => !isInternalInterviewFact(fact))) rationale.push("优先使用已确认事实");
  if (experience.verifiedFacts.some((fact) => /^\s*AI参与\s*[：:]/.test(fact))) warnings.push("AI 参与信息仅用于真实性边界与面试准备，不会自动写入简历正文");
  if (!experience.outcomes) warnings.push("缺少结果/交付，建议继续追问后再投递");
  return { text: text || "这段经历信息不足，建议先补充具体动作和结果。", rationale, reasons: rationale, warnings };
}

export function buildResumeBullet(experience: Experience): string {
  return buildProfessionalResumeBullet(experience).text;
}

export function inferTargetRole(jd: string): string {
  const lines = jd.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    const match = line.match(/(?:岗位|职位|招聘岗位|职位名称|岗位名称)\s*[：:]\s*(.+)/);
    if (match?.[1]) return match[1].trim().slice(0, 36);
  }
  const first = lines[0] || "";
  if (first.length >= 2 && first.length <= 28 && !/[。；]/.test(first)) return first;
  return "目标岗位";
}

export function buildTargetedSummary(profile: Profile, experiences: Experience[], matchedKeywords: string[]): string {
  const strongest = [...experiences].sort((a, b) => getExperienceEvidenceStrength(b) - getExperienceEvidenceStrength(a));
  const identity = [profile.school, profile.major, profile.degree].filter(Boolean).join(" · ");
  const evidenceTools = Array.from(new Set(strongest.flatMap((item) => item.tools.split(/[，,、/]/)).map((item) => item.trim()).filter(Boolean)));
  const relevantTerms = Array.from(new Set([...matchedKeywords, ...evidenceTools])).slice(0, 4);
  if (!relevantTerms.length) return identity ? `${identity}；已按目标岗位筛选相关经历。` : "已按目标岗位筛选可验证经历。";
  return `${identity ? `${identity}；` : ""}具备 ${relevantTerms.join("、")} 相关实践，以下内容仅保留与目标岗位直接相关且可核验的经历证据。`;
}

export function buildSummary(profile: Profile, experiences: Experience[]): string {
  return buildTargetedSummary(profile, experiences, []);
}
