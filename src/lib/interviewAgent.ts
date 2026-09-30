import type { Experience } from "@/lib/types";
import type { InterviewGoal } from "@/lib/interview";

export type FactStatus = "confirmed" | "needs_confirmation";
export type FactTarget = "actions" | "tools" | "outcomes" | "verifiedFacts";

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

const TOOL_TERMS = [
  "Excel", "PowerPoint", "PPT", "Python", "C++", "C#", ".NET", "AutoCAD", "SolidWorks",
  "MATLAB", "Simulink", "SQL", "Java", "JavaScript", "TypeScript", "React", "Next.js", "Figma",
  "Photoshop", "PS", "SPSS", "Tableau", "Power BI", "Git", "GitHub", "Unity", "ANSYS",
];

const ACTION_TERMS = [
  "设计", "开发", "实现", "检查", "审核", "分析", "整理", "清洗", "调研", "撰写", "编写", "制作",
  "搭建", "优化", "测试", "验证", "协调", "策划", "运营", "排版", "发布", "建模", "仿真", "维护",
];

const RESULT_TERMS = [
  "完成", "输出", "交付", "上线", "发布", "获得", "获奖", "解决", "通过", "投入使用", "形成", "产出",
];

const OWNERSHIP_PATTERNS: Array<[RegExp, string]> = [
  [/独立(完成|负责|开发|设计|制作)/, "独立完成"],
  [/主要负责|主责/, "主要负责"],
  [/共同完成|一起完成|团队共同/, "共同完成"],
  [/参与(了|其中|开发|设计|制作)?/, "参与其中"],
  [/协助|辅助|配合/, "辅助支持"],
];

const UNCERTAIN_PATTERNS = [/大概/i, /好像/i, /可能/i, /差不多/i, /应该/i, /记不清/i, /不确定/i];
const NUMBER_PATTERN = /(约|大概|超过|累计|共)?\s*\d+(?:\.\d+)?\s*(?:\+|多|余)?\s*(?:张|份|篇|场|次|人|个|项|条|小时|天|周|月|年|%)/g;
const HAS_NUMBER_PATTERN = /(约|大概|超过|累计|共)?\s*\d+(?:\.\d+)?\s*(?:\+|多|余)?\s*(?:张|份|篇|场|次|人|个|项|条|小时|天|周|月|年|%)/;

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function makeId(goal: InterviewGoal, value: string, index: number): string {
  return `${goal}-${index}-${value.slice(0, 12)}`;
}

function containsUncertainty(text: string): boolean {
  return UNCERTAIN_PATTERNS.some((pattern) => pattern.test(text));
}

function findSentenceFragments(text: string, terms: string[]): string[] {
  const fragments = text.split(/[。！？!?；;\n]/).map((item) => item.trim()).filter(Boolean);
  return fragments.filter((fragment) => terms.some((term) => fragment.includes(term)));
}

function nextGoalFromExperience(experience: Experience): InterviewGoal | undefined {
  if (experience.actions.trim().length < 8) return "specificity";
  if (!experience.tools.trim()) return "tool";
  const allText = [experience.rawDescription, experience.actions, experience.outcomes, ...experience.verifiedFacts].join(" ");
  if (!HAS_NUMBER_PATTERN.test(allText)) return "scale";
  if (!experience.outcomes.trim()) return "result";
  if (!experience.verifiedFacts.some((fact) => fact.startsWith("个人贡献："))) return "ownership";
  if (!experience.verifiedFacts.some((fact) => fact.startsWith("难点："))) return "difficulty";
  if (!experience.verifiedFacts.some((fact) => fact.startsWith("证据："))) return "evidence";
  return undefined;
}

export function analyzeInterviewTurn(answer: string, experience: Experience): InterviewAgentAnalysis {
  const sourceText = answer.trim();
  const facts: Omit<ExtractedFact, "id">[] = [];
  const warnings: string[] = [];
  const uncertain = containsUncertainty(sourceText);

  const tools = unique(TOOL_TERMS.filter((tool) => sourceText.toLowerCase().includes(tool.toLowerCase())));
  if (tools.length) {
    facts.push({
      goal: "tool",
      target: "tools",
      value: tools.join("、"),
      status: "confirmed",
      confidence: 1,
      sourceText,
      reason: "工具名称由用户在本轮回答中明确说出。",
    });
  }

  const scales = sourceText.match(NUMBER_PATTERN) || [];
  scales.forEach((value) => {
    facts.push({
      goal: "scale",
      target: "verifiedFacts",
      value: `规模：${value.replace(/\s+/g, "")}`,
      status: uncertain ? "needs_confirmation" : "confirmed",
      confidence: uncertain ? 0.72 : 0.98,
      sourceText,
      reason: uncertain ? "回答包含‘大概/好像/可能’等不确定表达，建议确认后再作为精确事实。" : "数量或规模由用户明确陈述。",
    });
  });

  for (const [pattern, label] of OWNERSHIP_PATTERNS) {
    if (pattern.test(sourceText)) {
      facts.push({
        goal: "ownership",
        target: "verifiedFacts",
        value: `个人贡献：${label}`,
        status: "confirmed",
        confidence: 0.98,
        sourceText,
        reason: "个人贡献程度由用户明确陈述。",
      });
      break;
    }
  }

  const actionFragments = findSentenceFragments(sourceText, ACTION_TERMS);
  if (actionFragments.length) {
    facts.push({
      goal: "specificity",
      target: "actions",
      value: actionFragments.join("；"),
      status: "confirmed",
      confidence: 0.92,
      sourceText,
      reason: "回答中包含明确动作词，可作为个人行为证据。",
    });
  }

  const resultFragments = findSentenceFragments(sourceText, RESULT_TERMS);
  if (resultFragments.length) {
    facts.push({
      goal: "result",
      target: "outcomes",
      value: resultFragments.join("；"),
      status: uncertain ? "needs_confirmation" : "confirmed",
      confidence: uncertain ? 0.7 : 0.9,
      sourceText,
      reason: uncertain ? "结果描述带有不确定语气，建议确认后再进入正式事实层。" : "回答中出现了明确交付或结果描述。",
    });
  }

  if (/难|问题|卡住|错误|冲突|时间紧|不完整|第一次/.test(sourceText) && /解决|处理|调整|修改|查找|协调|学习|尝试/.test(sourceText)) {
    facts.push({
      goal: "difficulty",
      target: "verifiedFacts",
      value: `难点：${sourceText}`,
      status: "confirmed",
      confidence: 0.86,
      sourceText,
      reason: "用户同时描述了困难和处理方式。",
    });
  }

  if (/GitHub|代码|报告|PPT|作品|图片|证书|奖项|数据文件|链接/.test(sourceText)) {
    const evidenceFragment = findSentenceFragments(sourceText, ["GitHub", "代码", "报告", "PPT", "作品", "图片", "证书", "奖项", "数据文件", "链接"])[0];
    if (evidenceFragment) {
      facts.push({
        goal: "evidence",
        target: "verifiedFacts",
        value: `证据：${evidenceFragment}`,
        status: "confirmed",
        confidence: 0.88,
        sourceText,
        reason: "用户明确提到了可回溯的证明材料。",
      });
    }
  }

  if (facts.length === 0 && sourceText.length >= 4) {
    facts.push({
      goal: "specificity",
      target: "actions",
      value: sourceText,
      status: "needs_confirmation",
      confidence: 0.55,
      sourceText,
      reason: "这句话包含有用信息，但本地提取器无法可靠判断它应归入哪个事实类别，需要用户确认。",
    });
  }

  if (uncertain && scales.length > 0) {
    warnings.push("检测到不确定数量。CareerVault 不会把‘大概’自动改成精确数字。 ");
  }
  if (/负责/.test(sourceText) && !ACTION_TERMS.some((term) => sourceText.includes(term))) {
    warnings.push("‘负责…’仍偏岗位职责描述，后续需要继续追问你实际执行的动作。 ");
  }

  const extractedFacts = facts.map((fact, index) => ({ ...fact, id: makeId(fact.goal, fact.value, index) }));
  const confirmedGoals = new Set(extractedFacts.filter((fact) => fact.status === "confirmed").map((fact) => fact.goal));
  const previewExperience: Experience = {
    ...experience,
    actions: confirmedGoals.has("specificity") ? extractedFacts.filter((fact) => fact.goal === "specificity" && fact.status === "confirmed").map((fact) => fact.value).join("；") || experience.actions : experience.actions,
    tools: confirmedGoals.has("tool") ? unique([experience.tools, ...extractedFacts.filter((fact) => fact.goal === "tool" && fact.status === "confirmed").map((fact) => fact.value)].filter(Boolean)).join("；") : experience.tools,
    outcomes: confirmedGoals.has("result") ? extractedFacts.filter((fact) => fact.goal === "result" && fact.status === "confirmed").map((fact) => fact.value).join("；") || experience.outcomes : experience.outcomes,
    verifiedFacts: [
      ...experience.verifiedFacts,
      ...extractedFacts.filter((fact) => fact.target === "verifiedFacts" && fact.status === "confirmed").map((fact) => fact.value),
    ],
  };

  return {
    acknowledgement: extractedFacts.length > 1
      ? `这句话里我识别出了 ${extractedFacts.length} 个可用信息点，不需要你重复填写。`
      : "我先把这条信息拆成可用于简历的事实，再决定下一问。",
    extractedFacts,
    warnings,
    suggestedNextGoal: nextGoalFromExperience(previewExperience),
  };
}

function mergeText(existing: string, value: string): string {
  if (!value.trim()) return existing;
  if (!existing.trim()) return value.trim();
  if (existing.includes(value.trim())) return existing;
  return `${existing}；${value.trim()}`;
}

export function applyConfirmedAgentFacts(experience: Experience, analysis: InterviewAgentAnalysis): Experience {
  let next = { ...experience, verifiedFacts: [...experience.verifiedFacts] };
  for (const fact of analysis.extractedFacts.filter((item) => item.status === "confirmed")) {
    if (fact.target === "actions") next.actions = mergeText(next.actions, fact.value);
    if (fact.target === "tools") next.tools = mergeText(next.tools, fact.value);
    if (fact.target === "outcomes") next.outcomes = mergeText(next.outcomes, fact.value);
    if (fact.target === "verifiedFacts" && !next.verifiedFacts.includes(fact.value)) next.verifiedFacts.push(fact.value);
  }
  return next;
}
