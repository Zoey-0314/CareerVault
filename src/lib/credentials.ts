import type { Credential, CredentialAssessment, CredentialLevel } from "@/lib/types";

const levelRules: Array<{ pattern: RegExp; level: CredentialLevel; points: number; label: string }> = [
  { pattern: /国际|世界|global|international/i, level: "international", points: 35, label: "国际/全球层级" },
  { pattern: /国家级|全国|教育部|人社部|national/i, level: "national", points: 30, label: "国家/全国层级" },
  { pattern: /省级|省赛|省政府|provincial/i, level: "provincial", points: 22, label: "省级层级" },
  { pattern: /市级|市赛|市政府|city/i, level: "city", points: 16, label: "市级层级" },
  { pattern: /校级|学校|大学|学院|school/i, level: "school", points: 10, label: "校级/院校层级" },
  { pattern: /协会|学会|行业|认证|certified|professional/i, level: "industry", points: 16, label: "行业/专业认证" },
  { pattern: /公司|企业|部门|organization/i, level: "organization", points: 8, label: "组织内部认可" },
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tierFor(score: number, clear: boolean): CredentialAssessment["tier"] {
  if (!clear) return "信息不足";
  if (score >= 82) return "旗舰";
  if (score >= 65) return "高价值";
  if (score >= 45) return "有效";
  return "补充";
}

export function assessCredentialLocally(credential: Credential): CredentialAssessment {
  const text = [credential.name, credential.issuer, credential.rank, credential.description, credential.followUpAnswer].filter(Boolean).join(" ");
  let score = 12;
  const rationale: string[] = [];
  let level: CredentialLevel = "unknown";

  for (const rule of levelRules) {
    if (rule.pattern.test(text)) {
      if (level === "unknown" || rule.points > (levelRules.find((item) => item.level === level)?.points || 0)) level = rule.level;
      score += rule.points;
      rationale.push(rule.label);
      break;
    }
  }

  if (/特等奖|冠军|金奖|一等奖|第一名|top\s*1|winner/i.test(text)) {
    score += 22;
    rationale.push("名次/奖级较高");
  } else if (/二等奖|银奖|第二名|top\s*3/i.test(text)) {
    score += 15;
    rationale.push("名次具有区分度");
  } else if (/三等奖|铜奖|优秀奖|入围|finalist/i.test(text)) {
    score += 8;
    rationale.push("具备一定筛选性");
  }

  if (/教育部|人力资源和社会保障|IEEE|ACM|ASME|国家级协会|政府|委员会|组委会/i.test(text)) {
    score += 15;
    rationale.push("颁发/主办方识别度较高");
  }

  if (/\d+\s*%|前\s*\d+|top\s*\d+|从\s*\d+|参赛.*\d+|报名.*\d+/i.test(text)) {
    score += 10;
    rationale.push("有明确竞争规模或筛选比例");
  }

  const proves = credential.description.trim() || credential.followUpAnswer?.trim() || "";
  const clearContribution = proves.length >= 16 && /(负责|完成|开发|设计|研究|组织|策划|实现|获得|通过|主导|参与|解决)/.test(proves);
  if (clearContribution) {
    score += 8;
    rationale.push("能说明获奖背后的实际能力/贡献");
  }

  const clear = Boolean(credential.name.trim() && credential.issuer.trim() && (credential.rank.trim() || level !== "unknown"));
  let followUpQuestion: string | undefined;
  if (!credential.issuer.trim()) followUpQuestion = "这个奖项/证书由谁颁发或主办？主办方往往决定它的认可范围。";
  else if (level === "unknown") followUpQuestion = "这个奖项大概是什么层级（国际/全国/省市/校级/企业或行业）？如果不知道，可以告诉我参赛/评选范围。";
  else if (!credential.rank.trim()) followUpQuestion = "你拿到的具体奖级、名次或认证等级是什么？例如一等奖、Top 10%、通过认证等。";
  else if (!clearContribution) followUpQuestion = "这个奖项为什么会颁给你？你具体做了什么、解决了什么问题，或凭什么成绩获得它？";

  const finalScore = clamp(score);
  return {
    score: finalScore,
    tier: tierFor(finalScore, clear),
    level,
    rationale: rationale.slice(0, 4),
    whatItProves: clearContribution ? proves : "尚不足以判断它具体证明了哪项能力",
    followUpQuestion,
    needsConfirmation: Boolean(followUpQuestion),
  };
}

export function sortCredentials(credentials: Credential[]): Credential[] {
  return [...credentials].sort((a, b) => (b.assessment?.score || 0) - (a.assessment?.score || 0));
}

export function credentialLevelLabel(level: CredentialLevel): string {
  return ({
    international: "国际级",
    national: "国家/全国级",
    provincial: "省级",
    city: "市级",
    school: "校级",
    organization: "组织级",
    industry: "行业认证",
    unknown: "待判断",
  } as const)[level];
}
