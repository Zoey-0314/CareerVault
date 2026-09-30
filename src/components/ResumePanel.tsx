"use client";

import { useMemo, useState } from "react";
import { Check, Download, FileText, Loader2, Target } from "lucide-react";
import { sortCredentials } from "@/lib/credentials";
import { buildTargetedResumeBullets, buildTargetedSummary, inferTargetRole } from "@/lib/resume";
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
  const targetRole = useMemo(() => inferTargetRole(jd), [jd]);

  const selectedMatches = useMemo(() => {
    if (!jd.trim()) return [];
    return matches.filter((item) => item.matchedKeywords.length > 0).slice(0, 3);
  }, [jd, matches]);

  const selectedExperiences = useMemo(() => selectedMatches
    .map((match) => experiences.find((item) => item.id === match.experienceId))
    .filter(Boolean) as Experience[], [selectedMatches, experiences]);

  const matchMap = useMemo(() => new Map(selectedMatches.map((item) => [item.experienceId, item])), [selectedMatches]);
  const keywords = useMemo(() => Array.from(new Set(selectedMatches.flatMap((item) => item.matchedKeywords))).slice(0, 10), [selectedMatches]);

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
      });
    } finally {
      setExporting(false);
    }
  }

  if (!jd.trim()) {
    return (
      <section className="sectionStack">
        <div className="sectionIntro"><span className="eyebrow">ONE-PAGE RESUME</span><h2>先有岗位，再生成简历。</h2><p>CareerVault 不生成“万能简历”。先粘贴目标岗位 JD，系统才会决定选哪些经历、强调哪些能力、删掉哪些无关信息。</p></div>
        <article className="resumeGate panel">
          <Target size={24} />
          <div><strong>还没有目标 JD</strong><span>输入 JD 后才会解锁岗位定制简历和 Word 导出。</span></div>
          <button className="button primary" onClick={onGoToJob}>去粘贴岗位 JD</button>
        </article>
      </section>
    );
  }

  if (!selectedExperiences.length) {
    return (
      <section className="sectionStack">
        <div className="sectionIntro"><span className="eyebrow">ONE-PAGE RESUME</span><h2>{targetRole} · 暂无足够匹配证据</h2><p>当前经历库里没有与 JD 直接命中的经历。CareerVault 不会为了填满一页而塞入不相关项目。</p></div>
        <article className="resumeGate panel">
          <FileText size={24} />
          <div><strong>需要补充或完善经历</strong><span>可以继续完善现有经历，让事实描述更具体；也可以录入与该岗位更相关的新经历。</span></div>
        </article>
      </section>
    );
  }

  return (
    <section className="sectionStack">
      <div className="resumeToolbar">
        <div className="sectionIntro"><span className="eyebrow">ONE-PAGE RESUME · JD TAILORED</span><h2>{targetRole}</h2><p>只使用经历库中的已知事实，并按当前 JD 重新选材。单段经历最多保留 3 条岗位相关证据。</p></div>
        <button className="button primary resumeExport" disabled={exporting} onClick={exportWord}>{exporting ? <Loader2 className="spin" size={16} /> : <Download size={16} />}{exporting ? "正在生成 Word" : "导出 Word"}</button>
      </div>

      <div className="ruleBar">
        <span><Check size={13} />必须先输入 JD</span>
        <span><Check size={13} />单段经历 1–3 条</span>
        <span><Check size={13} />删掉仓库日志与技术清单</span>
        <span><Check size={13} />Word 与网页同一套结构</span>
      </div>

      <article className="resumeSheet referenceResume">
        <header className="resumeHeaderGrid">
          <div className="resumeIdentity">
            <h2>{profile.name || "姓名"}</h2>
            <strong>求职意向：{targetRole}</strong>
            <p>{[profile.phone || "电话", profile.email || "邮箱", profile.city || "求职城市"].join("    ")}</p>
          </div>
          <div className="photoPlaceholder"><span>证件照</span></div>
        </header>

        <div className="resumeBand"><strong>教育背景</strong><em>Education</em></div>
        <section className="referenceRow">
          <div className="referenceMeta"><strong>{profile.graduation || "毕业时间"}</strong><span>{[profile.major, profile.degree].filter(Boolean).join(" / ") || "专业 / 学历"}</span></div>
          <div className="referenceContent"><strong>{profile.school || "学校"}</strong><p>教育背景仅展示个人档案中已填写的基础信息，不自动补写课程、绩点或排名。</p></div>
        </section>

        <div className="resumeBand"><strong>相关经历</strong><em>Experience</em></div>
        {selectedExperiences.map((item) => {
          const match = matchMap.get(item.id);
          const bullets = buildTargetedResumeBullets(item, match?.matchedKeywords || []);
          return (
            <section className="referenceRow referenceExperience" key={item.id}>
              <div className="referenceMeta"><strong>{item.startDate || "开始"} – {item.endDate || "至今"}</strong><span>{typeLabel[item.type]}</span><span>{item.title}</span></div>
              <div className="referenceContent"><strong>{item.organization}</strong><ul>{bullets.map((text) => <li key={text}>{text}</li>)}</ul></div>
            </section>
          );
        })}

        {resumeCredentials.length > 0 && <>
          <div className="resumeBand"><strong>荣誉奖励</strong><em>Award</em></div>
          {resumeCredentials.map((item) => <section className="referenceRow compactReferenceRow" key={item.id}><div className="referenceMeta"><strong>{item.date || ""}</strong><span>{item.rank || ""}</span></div><div className="referenceContent"><strong>{item.name}</strong><p>{[item.issuer, item.assessment?.whatItProves].filter(Boolean).join(" · ")}</p></div></section>)}
        </>}

        <div className="resumeBand"><strong>职业概述</strong><em>Profile</em></div>
        <section className="resumeSummary"><p>{summary}</p></section>
      </article>
    </section>
  );
}
