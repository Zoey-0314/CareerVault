"use client";

import type { Experience } from "@/lib/types";
import { normalizeExperienceV3 } from "@/lib/experienceModel";

interface Props {
  value: Experience;
  onChange: (next: Experience) => void;
  open?: boolean;
}

function parseLines(value: string): string[] {
  return Array.from(new Set(value.split(/\n+/).map((item) => item.trim()).filter(Boolean)));
}

function toLines(values: string[] | undefined): string {
  return (values || []).join("\n");
}

export function ExperienceStructuredEditor({ value, onChange, open = false }: Props) {
  const experience = normalizeExperienceV3(value);

  function updateEvidence(key: keyof NonNullable<Experience["evidence"]>, raw: string) {
    onChange({
      ...experience,
      evidence: { ...experience.evidence!, [key]: parseLines(raw) },
    });
  }

  function updateAiContext(key: "aiContribution" | "userContribution", raw: string) {
    onChange({
      ...experience,
      aiContext: { ...experience.aiContext!, [key]: parseLines(raw) },
    });
  }

  function updateInterviewPrep(key: keyof NonNullable<Experience["interviewPrep"]>, raw: string) {
    onChange({
      ...experience,
      interviewPrep: { ...experience.interviewPrep!, [key]: parseLines(raw) },
    });
  }

  return (
    <details className="details structuredExperienceDetails" open={open}>
      <summary>查看 / 手动修改结构化事实</summary>

      <div className="structuredFactSection">
        <div className="structuredFactHeading">
          <strong>简历事实</strong>
          <span>这些内容可以参与 JD 匹配和简历生成，但仍需保持真实、可解释。</span>
        </div>
        <label><span>具体动作</span><textarea rows={3} value={experience.actions} onChange={(e) => onChange({ ...experience, actions: e.target.value })} /></label>
        <label><span>工具 / 技术</span><input value={experience.tools} onChange={(e) => onChange({ ...experience, tools: e.target.value })} /></label>
        <label><span>结果 / 交付</span><textarea rows={3} value={experience.outcomes} onChange={(e) => onChange({ ...experience, outcomes: e.target.value })} /></label>
        <div className="formGrid">
          <label><span>规模 / 范围（每行一条）</span><textarea rows={4} value={toLines(experience.evidence?.scale)} onChange={(e) => updateEvidence("scale", e.target.value)} /></label>
          <label><span>个人贡献 / ownership（每行一条）</span><textarea rows={4} value={toLines(experience.evidence?.ownership)} onChange={(e) => updateEvidence("ownership", e.target.value)} /></label>
          <label><span>难点与处理（每行一条）</span><textarea rows={4} value={toLines(experience.evidence?.difficulties)} onChange={(e) => updateEvidence("difficulties", e.target.value)} /></label>
          <label><span>证据 / 可追溯材料（每行一条）</span><textarea rows={4} value={toLines(experience.evidence?.artifacts)} onChange={(e) => updateEvidence("artifacts", e.target.value)} /></label>
        </div>
      </div>

      <div className="structuredFactSection internalOnlySection">
        <div className="structuredFactHeading">
          <strong>AI 参与边界</strong>
          <span>这是内部真实性记录。不会因为写在这里就自动进入简历。</span>
        </div>
        <label><span>这个项目是否使用过 AI 辅助</span><select value={experience.aiContext?.assisted === null ? "unknown" : experience.aiContext?.assisted ? "yes" : "no"} onChange={(e) => onChange({ ...experience, aiContext: { ...experience.aiContext!, assisted: e.target.value === "unknown" ? null : e.target.value === "yes" } })}><option value="unknown">还没讨论</option><option value="yes">有 AI 辅助</option><option value="no">没有 AI 辅助</option></select></label>
        {experience.aiContext?.assisted !== false && <div className="formGrid">
          <label><span>AI 做了什么（每行一条）</span><textarea rows={4} value={toLines(experience.aiContext?.aiContribution)} onChange={(e) => updateAiContext("aiContribution", e.target.value)} /></label>
          <label><span>我本人做了什么（每行一条）</span><textarea rows={4} value={toLines(experience.aiContext?.userContribution)} onChange={(e) => updateAiContext("userContribution", e.target.value)} /></label>
        </div>}
      </div>

      <div className="structuredFactSection internalOnlySection">
        <div className="structuredFactHeading">
          <strong>面试准备</strong>
          <span>只用于提醒你正式面试要讲清楚什么，不会直接写进简历。</span>
        </div>
        <div className="formGrid">
          <label><span>可能被追问的问题（每行一条）</span><textarea rows={4} value={toLines(experience.interviewPrep?.questions)} onChange={(e) => updateInterviewPrep("questions", e.target.value)} /></label>
          <label><span>目前薄弱 / 解释不清的点（每行一条）</span><textarea rows={4} value={toLines(experience.interviewPrep?.weakPoints)} onChange={(e) => updateInterviewPrep("weakPoints", e.target.value)} /></label>
        </div>
        <label><span>投递前要复习的主题（每行一条）</span><textarea rows={3} value={toLines(experience.interviewPrep?.topicsToReview)} onChange={(e) => updateInterviewPrep("topicsToReview", e.target.value)} /></label>
      </div>

      {experience.verifiedFacts.length > 0 && <details className="legacyFacts"><summary>兼容旧版已确认事实</summary><textarea rows={4} value={experience.verifiedFacts.join("\n")} onChange={(e) => onChange({ ...experience, verifiedFacts: parseLines(e.target.value) })} /></details>}
    </details>
  );
}
