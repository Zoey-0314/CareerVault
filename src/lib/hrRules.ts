import type { Experience, ExperienceType, Profile } from "@/lib/types";

export type HrRuleLevel = "must" | "should" | "context";

export interface HrRule {
  id: string;
  title: string;
  level: HrRuleLevel;
  guidance: string;
}

export interface HrReviewItem {
  type: "pass" | "warn" | "improve";
  title: string;
  detail: string;
}

export const HR_RULES: HrRule[] = [
  {
    id: "one-page",
    title: "应届生优先一页",
    level: "must",
    guidance: "V1 默认生成一页简历，只保留对目标岗位最有证明力的信息，避免为了填满版面堆内容。",
  },
  {
    id: "clean-layout",
    title: "清爽可扫读",
    level: "must",
    guidance: "以黑白或低饱和配色、清晰上下结构和统一字体为默认，不依赖花哨模板获得注意力。",
  },
  {
    id: "minimal-personal-info",
    title: "个人信息从简",
    level: "must",
    guidance: "默认只保留姓名、电话、邮箱、城市/求职地与必要链接；年龄、性别、住址、身高等不主动写入。",
  },
  {
    id: "education-signal",
    title: "教育背景只留有效信号",
    level: "should",
    guidance: "学校、专业、学历与毕业时间优先；GPA/排名仅在有优势时展示，课程仅在与岗位高度相关时展示。",
  },
  {
    id: "experience-priority",
    title: "经历按岗位价值排序",
    level: "must",
    guidance: "岗位相关性优先，其次通常为实习/工作 > 项目/科研/比赛 > 校园/课程；不要机械按经历类型排序。",
  },
  {
    id: "star",
    title: "经历必须可追问、可证明",
    level: "must",
    guidance: "使用 STAR/CAR 思路压缩表达：交代必要背景，突出你的动作和结果；没有数据时描述可验证产出，不编造指标。",
  },
  {
    id: "specific-not-empty",
    title: "拒绝空话",
    level: "must",
    guidance: "避免“认真负责、沟通能力强、熟练掌握”等无证据形容词，用具体任务、工具、对象、规模、结果代替。",
  },
  {
    id: "jd-fit",
    title: "每一版都围绕 JD 选材",
    level: "must",
    guidance: "简历不是经历流水账。只把能证明岗位要求的事实放到前面，并解释为何保留或弱化某段经历。",
  },
  {
    id: "skills-proof",
    title: "技能要有证据",
    level: "should",
    guidance: "技能、证书按岗位相关性和含金量排序；尽量让核心技能能在经历中找到对应使用场景。",
  },
  {
    id: "self-evaluation",
    title: "自我评价不是必选项",
    level: "context",
    guidance: "默认不生成空泛自我评价；若岗位或用户明确需要，则只写能被经历支撑的能力总结。",
  },
  {
    id: "photo",
    title: "照片按场景判断",
    level: "context",
    guidance: "不把照片视为通用必选项；若当地招聘习惯或岗位明确要求，可使用正式证件照，避免生活自拍。",
  },
];

const LOW_SIGNAL_PHRASES = [
  "认真负责",
  "吃苦耐劳",
  "性格开朗",
  "沟通能力强",
  "学习能力强",
  "团队合作能力强",
  "熟练掌握",
  "精通",
];

const STRONG_ACTIONS = [
  "设计",
  "开发",
  "分析",
  "优化",
  "搭建",
  "实现",
  "调研",
  "验证",
  "协调",
  "策划",
  "运营",
  "测试",
  "检查",
  "整理",
  "撰写",
  "负责",
];

export const EXPERIENCE_TYPE_SIGNAL: Record<ExperienceType, number> = {
  work: 100,
  internship: 95,
  project: 80,
  research: 80,
  competition: 76,
  campus: 62,
  coursework: 58,
  volunteer: 52,
};

export function getExperienceEvidenceStrength(experience: Experience): number {
  let score = EXPERIENCE_TYPE_SIGNAL[experience.type] * 0.35;
  if (experience.actions.trim()) score += 18;
  if (experience.tools.trim()) score += 12;
  if (experience.outcomes.trim()) score += 16;
  score += Math.min(experience.verifiedFacts.length, 3) * 6;
  if (STRONG_ACTIONS.some((verb) => experience.actions.includes(verb) || experience.rawDescription.includes(verb))) score += 8;
  return Math.min(100, Math.round(score));
}

export function reviewCandidateProfile(profile: Profile, experiences: Experience[]): HrReviewItem[] {
  const items: HrReviewItem[] = [];
  if (profile.name && profile.email && profile.phone) {
    items.push({ type: "pass", title: "基础联系方式完整", detail: "姓名、邮箱和电话足以支撑简历首屏，不需要额外堆叠隐私信息。" });
  } else {
    items.push({ type: "warn", title: "基础联系方式不完整", detail: "至少补齐姓名、邮箱和电话，再生成正式投递版。" });
  }

  if (profile.school && profile.major && profile.degree) {
    items.push({ type: "pass", title: "教育背景信息够用", detail: "学校、专业和学历已具备。后续只在 GPA/排名确有优势时增加。" });
  }

  if (experiences.length === 0) {
    items.push({ type: "warn", title: "缺少经历证据", detail: "没有实习也没关系，可先录入项目、比赛、科研、课程设计或校园经历。" });
  } else {
    const strong = experiences.filter((experience) => getExperienceEvidenceStrength(experience) >= 70).length;
    items.push({
      type: strong > 0 ? "pass" : "improve",
      title: strong > 0 ? "已有可用核心经历" : "经历还需要挖深",
      detail: strong > 0 ? `当前有 ${strong} 段经历具备较强事实支撑，可参与岗位匹配。` : "已有经历偏概括，优先补动作、工具、结果和可核验事实。",
    });
  }

  return items;
}

export function detectLowSignalText(text: string): string[] {
  return LOW_SIGNAL_PHRASES.filter((phrase) => text.includes(phrase));
}
