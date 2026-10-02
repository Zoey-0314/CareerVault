import { applyStructuredFact, hasStructuredGoal, normalizeExperienceV3 } from "@/lib/experienceModel";
import type { Experience, ExperienceType } from "@/lib/types";
import { analyzeInterviewTurn, applyConfirmedAgentFacts } from "@/lib/interviewAgent";

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

const typePrompts: Record<ExperienceType, Partial<Record<InterviewGoal, Omit<InterviewQuestion, "id" | "goal">>>> = {
  internship: {
    specificity: { question: "你在这段实习里最常做的具体任务是什么？不要写‘负责某某’，直接告诉我你实际做了什么。", why: "HR 更关心你亲手执行过什么，而不是岗位职责说明。", options: ["检查/审核", "设计/制图", "数据整理", "开发/自动化", "沟通协调", "其他"], placeholder: "例如：逐张检查机械工程图中的 BOM、标准件和图号" },
    scale: { question: "这项工作大概覆盖了多少对象或多少次？记不清准确数字也可以给范围。", why: "规模能帮助 HR 判断你的实际参与深度。", options: ["少于20", "20–50", "50–100", "100+", "没有统计"], placeholder: "例如：累计检查约100+张工程图" },
  },
  work: { specificity: { question: "你这份工作里最能代表你能力的一项实际任务是什么？", why: "先找到最有证明力的工作内容，再决定简历怎么写。", options: ["项目执行", "客户/用户", "数据分析", "流程优化", "团队协作", "其他"], placeholder: "写一个你真实做过的具体任务" } },
  project: {
    specificity: { question: "这个项目最终要解决什么问题？你本人具体负责哪一块？", why: "项目经历最容易把团队成果写成个人成果，必须先分清你的贡献。", options: ["前端/界面", "后端/接口", "算法/模型", "测试/验证", "设计/方案", "其他"], placeholder: "例如：负责测试执行模块与结果验证" },
    ownership: { question: "这一块工作你承担到什么程度？", why: "‘主导、负责、参与、协助’代表完全不同的贡献程度，CareerVault 不会替你夸大。", options: ["独立完成", "主要负责", "共同完成", "参与其中", "辅助支持"], placeholder: "也可以具体说明你与队友如何分工" },
  },
  campus: {
    specificity: { question: "这段校园经历里，你真正做了哪些事情？先别写‘锻炼了沟通能力’。", why: "软能力必须用具体行为证明，空泛评价对 HR 的信息量很低。", options: ["活动策划", "公众号/内容", "组织协调", "招新/培训", "宣传设计", "其他"], placeholder: "例如：负责公众号文案、排版和发布" },
    scale: { question: "这件事持续多久、做了多少次，或者影响了多少人？", why: "校园经历如果有明确规模，会比‘参加了某活动’更有说服力。", options: ["1次活动", "3–5次", "10+次", "持续1学期", "持续1年", "没有统计"], placeholder: "例如：一年内累计发布30+篇内容" },
  },
  competition: { specificity: { question: "比赛中你个人负责哪一部分？", why: "奖项是团队结果，HR 仍然需要知道你能独立说明和承担什么。", options: ["方案设计", "技术实现", "数据分析", "答辩展示", "材料撰写", "其他"], placeholder: "写清楚你的个人分工" } },
  research: { specificity: { question: "这项研究具体在研究什么？你负责哪一步？", why: "科研经历要体现研究问题、方法和个人贡献，而不是只写课题名称。", options: ["文献调研", "实验设计", "数据处理", "建模/仿真", "论文撰写", "其他"], placeholder: "例如：负责实验数据清洗和统计分析" } },
  coursework: { specificity: { question: "这门课程设计最终交付了什么？你具体完成了哪些部分？", why: "课程项目也可以有价值，但要写成可验证的专业实践，而不是‘完成课程作业’。", options: ["设计方案", "建模", "编程", "实验", "报告", "其他"], placeholder: "例如：完成六杆机构建模、运动分析与报告" } },
  volunteer: { specificity: { question: "你在这段志愿经历里具体提供了什么服务或承担什么任务？", why: "志愿经历同样要用行动与结果呈现，而不是只写参与。", options: ["现场执行", "组织协调", "宣传", "培训", "服务支持", "其他"], placeholder: "写一个具体任务" } },
};

const generic: Record<InterviewGoal, Omit<InterviewQuestion, "id" | "goal">> = {
  specificity: { question: "你本人具体做了什么？", why: "具体动作是经历最核心的事实证据。", options: [], placeholder: "用‘分析、设计、开发、检查、协调、策划……’这样的动作来回答" },
  tool: { question: "你完成这些工作时，实际用了哪些工具、软件、技术或方法？", why: "工具只有和实际任务绑定，才能成为可信的技能证据。", options: ["Excel", "PPT", "Python", "C/C++", "C#/.NET", "AutoCAD", "SolidWorks", "其他/不适用"], placeholder: "例如：AutoCAD、C#/.NET Framework、Excel" },
  scale: { question: "这件事有没有可以描述的工作规模？", why: "数量、频次、覆盖范围等信息能帮助 HR 判断经历深度；不知道就不要编。", options: ["有准确数字", "只有大概范围", "没有统计", "不适用"], placeholder: "例如：处理约180份问卷 / 支持5场活动" },
  result: { question: "最后交付了什么，或者产生了什么可验证的结果？", why: "结果不一定是百分比，也可以是报告、系统、图纸、活动、上线功能或问题解决。", options: ["完成交付物", "上线/投入使用", "获得奖项", "解决问题", "有数据结果", "暂时没有明确结果"], placeholder: "例如：输出调研报告并用于后续活动方案" },
  ownership: { question: "这部分工作你承担到什么程度？", why: "这是为了避免 AI 把‘参与’自动包装成‘主导’。", options: ["独立完成", "主要负责", "共同完成", "参与其中", "辅助支持"], placeholder: "说明你和其他人的分工也可以" },
  difficulty: { question: "过程中最难的一点是什么？你是怎么处理的？", why: "难点与解决方式通常比‘认真负责、学习能力强’更能证明能力。", options: ["技术问题", "时间紧", "信息不完整", "跨团队沟通", "第一次接触", "没有明显难点"], placeholder: "用‘遇到什么 → 怎么处理’回答" },
  evidence: { question: "这段经历有没有可以证明或帮助你回忆的材料？", why: "证据能帮助后续生成更可信的简历，也方便面试前复盘。", options: ["GitHub/代码", "报告/PPT", "作品/图片", "证书/奖项", "数据文件", "暂时没有"], placeholder: "这里只记录证据类型或说明，不需要上传文件" },
};

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

export function getNextInterviewQuestion(experience: Experience, skipped: InterviewGoal[] = []): InterviewQuestion | null {
  const readiness = getExperienceReadiness(experience);
  const incomplete = readiness.items.filter((item) => item.key !== "basic" && !item.complete).map((item) => item.key as InterviewGoal);
  const priorityByType: Record<ExperienceType, InterviewGoal[]> = {
    internship: ["specificity", "scale", "tool", "result", "ownership", "difficulty", "evidence"],
    work: ["specificity", "result", "scale", "ownership", "tool", "difficulty", "evidence"],
    project: ["specificity", "ownership", "tool", "difficulty", "result", "scale", "evidence"],
    campus: ["specificity", "scale", "result", "ownership", "tool", "difficulty", "evidence"],
    competition: ["specificity", "ownership", "result", "tool", "difficulty", "scale", "evidence"],
    research: ["specificity", "tool", "result", "ownership", "difficulty", "scale", "evidence"],
    coursework: ["specificity", "tool", "result", "ownership", "difficulty", "scale", "evidence"],
    volunteer: ["specificity", "scale", "result", "ownership", "difficulty", "tool", "evidence"],
  };
  const goal = priorityByType[experience.type].find((candidate) => incomplete.includes(candidate) && !skipped.includes(candidate));
  if (!goal) return null;
  const prompt = typePrompts[experience.type][goal] || generic[goal];
  return { id: `${experience.type}-${goal}`, goal, ...prompt };
}

function mergeText(existing: string, answer: string): string {
  const value = answer.trim();
  if (!value) return existing;
  if (!existing.trim()) return value;
  if (existing.includes(value)) return existing;
  return `${existing}；${value}`;
}

function applyQuestionFallback(experience: Experience, question: InterviewQuestion, value: string): Experience {
  if (question.goal === "specificity") return { ...experience, actions: mergeText(experience.actions, value) };
  if (question.goal === "tool") return { ...experience, tools: mergeText(experience.tools, value) };
  if (question.goal === "result") return { ...experience, outcomes: mergeText(experience.outcomes, value) };
  if (question.goal === "scale") return applyStructuredFact(experience, "scale", value);
  if (question.goal === "ownership") return applyStructuredFact(experience, "ownership", value);
  if (question.goal === "difficulty") return applyStructuredFact(experience, "difficulty", value);
  return applyStructuredFact(experience, "evidence", value);
}

export function applyInterviewAnswer(experience: Experience, question: InterviewQuestion, answer: string): Experience {
  const value = answer.trim();
  if (!value) return experience;

  const analysis = analyzeInterviewTurn(value, experience);
  const next = applyConfirmedAgentFacts(experience, analysis);
  const currentGoalFacts = analysis.extractedFacts.filter((fact) => fact.goal === question.goal);
  if (currentGoalFacts.some((fact) => fact.status === "confirmed")) return next;
  if (currentGoalFacts.some((fact) => fact.status === "needs_confirmation")) return next;
  return applyQuestionFallback(next, question, value);
}
