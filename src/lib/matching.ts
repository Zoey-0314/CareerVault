import { detectLowSignalText, getExperienceEvidenceStrength } from "@/lib/hrRules";
import type { Experience, JobMatch } from "@/lib/types";

const STOP_WORDS = new Set([
  "and", "the", "with", "for", "you", "your", "our", "are", "will", "this", "that", "from",
  "工作", "岗位", "负责", "要求", "以及", "具有", "相关", "能够", "优先", "经验", "能力", "职位", "任职",
  "我们", "公司", "团队", "进行", "完成", "参与", "熟悉", "掌握", "具备", "以上", "以下", "良好", "较强",
]);

function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const ascii = lower.match(/[a-z0-9+#.]{2,}/g) || [];
  const chineseChunks = lower.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const chinese: string[] = [];

  for (const chunk of chineseChunks) {
    if (chunk.length <= 6) chinese.push(chunk);
    for (const size of [4, 3, 2]) {
      if (chunk.length < size) continue;
      for (let index = 0; index <= chunk.length - size; index += 1) {
        const token = chunk.slice(index, index + size);
        if (!STOP_WORDS.has(token)) chinese.push(token);
      }
    }
  }

  return Array.from(new Set([...ascii, ...chinese]))
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word))
    .sort((a, b) => b.length - a.length)
    .slice(0, 180);
}

function experienceText(experience: Experience): string {
  return [
    experience.title,
    experience.organization,
    experience.rawDescription,
    experience.actions,
    experience.tools,
    experience.outcomes,
    ...experience.verifiedFacts,
  ].join(" ");
}

export function matchExperiences(jd: string, experiences: Experience[]): JobMatch[] {
  const jdTokens = tokenize(jd);

  return experiences
    .map((experience) => {
      const text = experienceText(experience).toLowerCase();
      const matchedKeywords = jdTokens
        .filter((token) => text.includes(token))
        .sort((a, b) => b.length - a.length)
        .filter((token, index, all) => !all.slice(0, index).some((existing) => existing.includes(token)))
        .slice(0, 12);
      const keywordCoverage = jdTokens.length === 0 ? 0 : matchedKeywords.length / Math.min(jdTokens.length, 20);
      const evidenceStrength = getExperienceEvidenceStrength(experience) / 100;
      const score = jdTokens.length === 0
        ? Math.round(evidenceStrength * 35)
        : Math.min(100, Math.round(keywordCoverage * 72 + evidenceStrength * 28));
      return { experienceId: experience.id, score, matchedKeywords };
    })
    .sort((a, b) => b.score - a.score);
}

export function getFollowUpQuestions(experience: Experience): string[] {
  const questions: string[] = [];
  const combined = `${experience.rawDescription} ${experience.actions} ${experience.outcomes}`;
  const lowSignal = detectLowSignalText(combined);

  if (!experience.actions.trim()) {
    questions.push("如果我是 HR，我最想先知道：这件事里你本人具体做了什么？请用“设计、分析、开发、检查、策划、协调”等动作描述，而不是只写‘参与’。 ");
  }
  if (!experience.tools.trim()) {
    questions.push("你完成这项任务时具体用了什么工具、软件、方法或流程？这能帮助 HR 判断你的能力是否可迁移到目标岗位。");
  }
  if (!experience.outcomes.trim()) {
    questions.push("最后交付了什么、解决了什么问题，或产生了什么可验证变化？没有准确数字就不要猜，可以写成品、报告、上线功能、完成数量或流程变化。");
  }
  if (experience.verifiedFacts.length === 0) {
    questions.push("有没有一个你能确认、面试时也讲得清楚的事实？例如处理数量、项目范围、负责模块、最终交付物或被采用的成果。");
  }
  if (lowSignal.length > 0) {
    questions.push(`你用了“${lowSignal[0]}”这类 HR 很难验证的表述。能否换成一个具体行为或案例来证明它？`);
  }
  if (experience.rawDescription.trim().length < 30) {
    questions.push("这段经历里最难、最能体现你能力的一件事是什么？当时为什么难，你是怎么处理的？");
  }
  if (!/\d/.test(combined) && experience.verifiedFacts.every((fact) => !/\d/.test(fact))) {
    questions.push("这段经历有没有自然存在的规模信息？例如人数、数量、周期、覆盖范围。只有你确定的数据才写，不需要为了量化硬编数字。");
  }

  if (questions.length === 0) {
    questions.push("这段经历的事实已经比较完整。下一步我会根据目标 JD 判断哪些内容该放大、哪些该删掉，而不是继续堆信息。");
  }
  return questions.slice(0, 3);
}
