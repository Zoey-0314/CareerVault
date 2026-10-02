"use client";

import { useMemo, useState } from "react";
import { Check, Download, FileText, Loader2, Sparkles, Target } from "lucide-react";
import { sortCredentials } from "@/lib/credentials";
import { buildTargetedResumeBullets, buildTargetedSummary, inferTargetRole } from "@/lib/resume";
import { generateGroundedResumeDraft, type GroundedResumeDraft } from "@/lib/resumeAi";
import { downloadResumeDocx } from "@/lib/resumeDocx";
import type { Credential, Experience, JobMatch, Profile } from "@/lib/types";

interface ResumePanelProps {
  profile: Profile;
  jd: string;
  experiences: Experience[];
  matches: JobMatch[];
  credentials: Credential[];
  onGoToJob: () => void;
}

const typeLabel: Record<Experience["type"], string> = {
  internship: "实习经历",
  work: "工作经历",
  project: "项目经历",
  campus: "校园经历",
  competition: "竞赛经历",
  research: "科研经历",
  coursework: "课程设计",
  volunteer: "志愿经历",
};

export function ResumePanel({ profile, jd, experiences, matches, credentials, onGoToJob }: ResumePanelProps) {
  const [exporting, setExporting] = useState(false);
  const [aiDraft, setAiDraft] = useState<GroundedResumeDraft | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  const deterministicMatches = useMemo(() => {
    if (!jd.trim()) return [];
    return matches.filter((item) => item.matchedKeywords.length > 0).slice(0, 3);
  }, [jd, matches]);

  const selectedExperiences = useMemo(() => {
    const ids = aiDraft ? aiDraft.selected.map((item) => item.experienceId) : deterministicMatches.map((item) => item.experienceId);
    return ids.map((id) => experiences.find((item) => item.id === id)).filter(Boolean) as Experience[];
  }, [aiDraft, deterministicMatches, experiences]);

  const selectedMatches = useMemo<JobMatch[]>(() => {
    if (!aiDraft) return deterministicMatches;
    return aiDraft.selected.map((selection) => matches.find((item) => item.experienceId === selection.experienceId) || {
      experienceId: selection.experienceId,
      score: Math.round(selection.relevanceScore),
      matchedKeywords: [],
    });
  }, [aiDraft, deterministicMatches, matches]);

  const matchMap = useMemo(() => new Map(selectedMatches.map((item) => [item.experienceId, item])), [selectedMatches]);
  const aiSelectionMap = useMemo(() => new Map((aiDraft?.selected || []).map((item) => [item.experienceId, item])), [aiDraft]);
  const generatedBullets = useMemo(() => Object.fromEntries((aiDraft?.selected || []).map((item) => [item.experienceId, item.bullets.map((bullet) => bullet.text)])), [aiDraft]);
  const keywords = useMemo(() => Array.from(new Set(selectedMatches.flatMap((item) => item.matchedKeywords))).slice(0, 10), [selectedMatches]);
  const targetRole = aiDraft?.targetRole || inferTargetRole(jd);

  const resumeCredentials = useMemo(() => {
    if (!keywords.length) return [];
    return sortCredentials(credentials)
      .filter((item) => (item.assessment?.score || 0) >= 45)
      .filter((item) => {
        const text = [item.name, item.issuer, item.rank, item.description, item.assessment?.whatItProves].filter(Boolean).join(" ").toLowerCase();
        return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
      })
      .slice(0, 3);
  }, [credentials, keywords]);

  const summary = useMemo(() => buildTargetedSummary(profile, selectedExperiences, keywords), [profile, selectedExperiences, keywords]);

  async function runAiTailoring() {
    if (!jd.trim() || !experiences.length || aiGenerating) return;
    setAiGenerating(true);
    setAiError("");
    try {
      const result = await generateGroundedResumeDraft(jd, experiences);
      setAiDraft(result);
      if (!result.selected.length) setAiError("AI 做了语义匹配，但没有找到足够相关且可由现有事实支撑的经历。CareerVault 不会为了填满简历强行选材。 ");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI 定制简历失败。");
    } finally {
      setAiGenerating(false);
    }
  }

  async function exportWord() {
    if (!jd.trim() || !selectedExperiences.length || exporting) return;
    setExporting(true);
    try {
      await downloadResumeDocx({
        profile,
        jd,
        experiences: selectedExperiences,
        matches: selectedMatches,
        credentials: resumeCredentials,
        generatedBullets: aiDraft ? generatedBullets : undefined,
        targetRoleOverride: aiDraft?.targetRole || undefined,
      });
    } finally {
      setExporting(false);
    }
  }

  if (!jd.trim()) {
    return (
      <section className="sectionStack">
        <div className="sectionIntro"><span className="eyebrow">ONE-PAGE RESUME</span><h2>先有岗位，再生成简历。</h2><p>CareerVault 不生成“万能简历”。先粘贴目标岗位 JD，系统才会决定选哪些经历、强调哪些能力、删掉哪些无关信息。</p></div>
        <article className="resumeGate panel"><Target size={24} /><div><strong>还没有目标 JD</strong><span>输入 JD 后才会解锁岗位定制简历和 Word 导出。</span></div><button className="button primary" onClick={onGoToJob}>去粘贴岗位 JD</button></article>
      </section>
    );
  }

  if (!experiences.length) {
    return <section className="sectionStack"><div className="sectionIntro"><span className="eyebrow">ONE-PAGE RESUME</span><h2>{targetRole} · 还没有经历资产</h2></div><article className="resumeGate panel"><FileText size={24} /><div><strong>先录入至少一段经历</strong><span>CareerVault 只从你真实保存的经历事实中生成简历。</span></div></article></section>;
  }

  if (!selectedExperiences.length) {
    return (
      <section className="sectionStack">
        <div className="sectionIntro"><span className="eyebrow">ONE-PAGE RESUME</span><h2>{targetRole} · 暂无足够匹配证据</h2><p>{aiDraft ? "AI 已完成语义匹配，但没有找到足够相关且可验证的经历。" : "关键词匹配没有直接命中，可以让 AI 再做一次语义匹配。"}</p></div>
        <article className="resumeGate panel"><Sparkles size={24} /><div><strong>{aiDraft ? "不强行填满简历" : "尝试 AI 语义匹配"}</strong><span>{aiDraft ? "补充相关经历或完善现有事实后再生成。" : "DeepSeek 会理解 JD 与经历的语义关系，不要求文字完全相同；仍然只能使用已保存事实。"}</span></div><button className="button primary" disabled={aiGenerating} onClick={runAiTailoring}>{aiGenerating ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}{aiGenerating ? "正在匹配" : aiDraft ? "重新匹配" : "AI 语义匹配"}</button></article>
        {aiError && <p className="inlineNote">{aiError}</p>}
      </section>
    );
  }

  return (
    <section className="sectionStack">
      <div className="resumeToolbar">
        <div className="sectionIntro"><span className="eyebrow">ONE-PAGE RESUME · JD TAILORED</span><h2>{targetRole}</h2><p>{aiDraft ? "AI 已按 JD 做语义选材和事实约束改写；每条 bullet 都必须引用 CareerVault 中真实存在的事实。" : "当前先使用确定性规则选材；可运行 AI 定制进行语义匹配和专业改写。"}</p></div>
        <div className="buttonRow"><button className="button secondary" disabled={aiGenerating} onClick={runAiTailoring}>{aiGenerating ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}{aiGenerating ? "AI 定制中" : aiDraft ? "重新 AI 定制" : "AI 定制简历"}</button><button className="button primary resumeExport" disabled={exporting} onClick={exportWord}>{exporting ? <Loader2 className="spin" size={16} /> : <Download size={16} />}{exporting ? "正在生成 Word" : "导出 Word"}</button></div>
      </div>

      <div className="ruleBar">
        <span><Check size={13} />必须先输入 JD</span><span><Check size={13} />单段经历 1–3 条</span><span><Check size={13} />AI bullet 必须引用事实</span><span><Check size={13} />Word 与网页同一套内容</span>
      </div>
      {aiDraft && <p className="inlineNote"><Sparkles size={13} /> {aiDraft.provider === "deepseek" ? "DeepSeek" : "OpenAI"}{aiDraft.model ? ` · ${aiDraft.model}` : ""} · 已通过事实引用、数字和 ownership 基础校验</p>}
      {aiError && <p className="inlineNote">{aiError}</p>}

      <article className="resumeSheet referenceResume">
        <header className="resumeHeaderGrid"><div className="resumeIdentity"><h2>{profile.name || "姓名"}</h2><strong>求职意向：{targetRole}</strong><p>{[profile.phone || "电话", profile.email || "邮箱", profile.city || "求职城市"].join("    ")}</p></div><div className="photoPlaceholder"><span>证件照</span></div></header>

        <div className="resumeBand"><strong>教育背景</strong><em>Education</em></div>
        <section className="referenceRow"><div className="referenceMeta"><strong>{profile.graduation || "毕业时间"}</strong><span>{[profile.major, profile.degree].filter(Boolean).join(" / ") || "专业 / 学历"}</span></div><div className="referenceContent"><strong>{profile.school || "学校"}</strong><p>教育背景仅展示个人档案中已填写的基础信息，不自动补写课程、绩点或排名。</p></div></section>

        <div className="resumeBand"><strong>相关经历</strong><em>Experience</em></div>
        {selectedExperiences.map((item) => {
          const match = matchMap.get(item.id);
          const aiSelection = aiSelectionMap.get(item.id);
          const bullets = aiSelection?.bullets.map((bullet) => bullet.text) || buildTargetedResumeBullets(item, match?.matchedKeywords || []);
          return <section className="referenceRow referenceExperience" key={item.id}><div className="referenceMeta"><strong>{item.startDate || "开始"} – {item.endDate || "至今"}</strong><span>{typeLabel[item.type]}</span><span>{item.title}</span></div><div className="referenceContent"><strong>{item.organization}</strong>{aiSelection?.matchReasons?.length ? <p>{aiSelection.matchReasons.slice(0, 2).join(" · ")}</p> : null}<ul>{bullets.map((text) => <li key={text}>{text}</li>)}</ul></div></section>;
        })}

        {resumeCredentials.length > 0 && <><div className="resumeBand"><strong>荣誉奖励</strong><em>Award</em></div>{resumeCredentials.map((item) => <section className="referenceRow compactReferenceRow" key={item.id}><div className="referenceMeta"><strong>{item.date || ""}</strong><span>{item.rank || ""}</span></div><div className="referenceContent"><strong>{item.name}</strong><p>{[item.issuer, item.assessment?.whatItProves].filter(Boolean).join(" · ")}</p></div></section>)}</>}

        <div className="resumeBand"><strong>职业概述</strong><em>Profile</em></div><section className="resumeSummary"><p>{summary}</p></section>
      </article>
    </section>
  );
}
