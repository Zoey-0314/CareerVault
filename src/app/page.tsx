"use client";

import { useEffect, useMemo, useState } from "react";
import { getFollowUpQuestions, matchExperiences } from "@/lib/matching";
import { buildProfessionalResumeBullet, buildSummary } from "@/lib/resume";
import { getExperienceEvidenceStrength, HR_RULES, reviewCandidateProfile } from "@/lib/hrRules";
import type { Experience, ExperienceType, Profile } from "@/lib/types";

const emptyProfile: Profile = {
  name: "", email: "", phone: "", city: "", school: "", major: "", degree: "", graduation: "",
};

const emptyExperience = (): Experience => ({
  id: typeof crypto !== "undefined" ? crypto.randomUUID() : Date.now().toString(),
  type: "internship",
  title: "",
  organization: "",
  startDate: "",
  endDate: "",
  rawDescription: "",
  actions: "",
  tools: "",
  outcomes: "",
  verifiedFacts: [],
});

const labels: Record<ExperienceType, string> = {
  internship: "实习经历",
  work: "工作经历",
  project: "项目经历",
  campus: "校园经历",
  competition: "比赛经历",
  research: "科研经历",
  coursework: "课程设计",
  volunteer: "志愿经历",
};

export default function Home() {
  const [tab, setTab] = useState<"profile" | "experiences" | "job" | "resume">("profile");
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [draft, setDraft] = useState<Experience>(emptyExperience);
  const [factsText, setFactsText] = useState("");
  const [jd, setJd] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("careervault-v1");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { profile?: Profile; experiences?: Experience[]; jd?: string };
        if (parsed.profile) setProfile({ ...emptyProfile, ...parsed.profile });
        if (parsed.experiences) setExperiences(parsed.experiences);
        if (parsed.jd) setJd(parsed.jd);
      } catch {
        // Ignore malformed local demo data.
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("careervault-v1", JSON.stringify({ profile, experiences, jd }));
  }, [profile, experiences, jd, hydrated]);

  const matches = useMemo(() => matchExperiences(jd, experiences), [jd, experiences]);
  const hrReview = useMemo(() => reviewCandidateProfile(profile, experiences), [profile, experiences]);
  const selectedExperiences = useMemo(() => {
    const rankedIds = matches.filter((match) => match.score > 0).slice(0, 3).map((match) => match.experienceId);
    const ids = rankedIds.length ? rankedIds : [...experiences]
      .sort((a, b) => getExperienceEvidenceStrength(b) - getExperienceEvidenceStrength(a))
      .slice(0, 3)
      .map((experience) => experience.id);
    return ids.map((id) => experiences.find((experience) => experience.id === id)).filter(Boolean) as Experience[];
  }, [matches, experiences]);

  const completion = Math.round(
    ([profile.name, profile.email, profile.school, profile.major, profile.graduation].filter(Boolean).length / 5) * 40 +
      Math.min(experiences.length, 3) / 3 * 40 +
      (jd.trim() ? 20 : 0),
  );

  function saveExperience() {
    if (!draft.title.trim() || !draft.organization.trim()) return;
    const item = {
      ...draft,
      verifiedFacts: factsText.split("\n").map((line) => line.trim()).filter(Boolean),
    };
    setExperiences((current) => [item, ...current]);
    setDraft(emptyExperience());
    setFactsText("");
  }

  function removeExperience(id: string) {
    setExperiences((current) => current.filter((item) => item.id !== id));
  }

  const followUps = getFollowUpQuestions({
    ...draft,
    verifiedFacts: factsText.split("\n").map((line) => line.trim()).filter(Boolean),
  });

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <div className="brandMark">CV</div>
          <h1>CareerVault</h1>
          <p className="muted">Professional HR mode.</p>
        </div>
        <nav>
          <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>01 个人档案</button>
          <button className={tab === "experiences" ? "active" : ""} onClick={() => setTab("experiences")}>02 经历库</button>
          <button className={tab === "job" ? "active" : ""} onClick={() => setTab("job")}>03 岗位匹配</button>
          <button className={tab === "resume" ? "active" : ""} onClick={() => setTab("resume")}>04 一页简历</button>
        </nav>
        <div className="progressCard">
          <div className="row"><span>档案完整度</span><strong>{completion}%</strong></div>
          <div className="progress"><span style={{ width: `${completion}%` }} /></div>
          <small>事实层保存在当前浏览器；AI 只能改表达，不能改事实。</small>
        </div>
      </aside>

      <section className="content">
        {tab === "profile" && (
          <section>
            <div className="eyebrow">PERSONAL PROFILE · HR MODE</div>
            <h2>先建立 HR 真正会看的基础档案</h2>
            <p className="lead">默认只收集简历必要信息，不要求年龄、性别、详细住址、身高等低价值或敏感字段。</p>
            <div className="card formGrid">
              {([
                ["name", "姓名"], ["email", "邮箱"], ["phone", "电话"], ["city", "求职城市"],
                ["school", "学校"], ["major", "专业"], ["degree", "学历"], ["graduation", "毕业时间"],
              ] as const).map(([key, label]) => (
                <label key={key}><span>{label}</span><input value={profile[key]} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} /></label>
              ))}
            </div>
            <div className="hrPanel">
              <div className="sectionTitle"><h3>HR 初筛意见</h3><span>不是普通 AI 夸奖</span></div>
              {hrReview.map((item) => <div className={`reviewItem ${item.type}`} key={item.title}><strong>{item.type === "pass" ? "✓" : item.type === "warn" ? "!" : "→"} {item.title}</strong><p>{item.detail}</p></div>)}
            </div>
            <div className="actions"><button className="primary" onClick={() => setTab("experiences")}>继续建立经历库 →</button></div>
          </section>
        )}

        {tab === "experiences" && (
          <section>
            <div className="eyebrow">EXPERIENCE VAULT · HR INTERVIEW</div>
            <h2>不是“润色”，而是先把有用事实问出来</h2>
            <p className="lead">CareerVault 会像改简历的人一样追问：你做了什么、用什么方法、难点是什么、交付什么、结果如何。没有准确数据就不编数字。</p>
            <div className="twoCol">
              <div className="card">
                <h3>添加一段经历</h3>
                <div className="formGrid compact">
                  <label><span>经历类型</span><select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as ExperienceType })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span>岗位 / 项目名称</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
                  <label><span>公司 / 组织</span><input value={draft.organization} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} /></label>
                  <label><span>开始时间</span><input type="month" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></label>
                  <label><span>结束时间</span><input type="month" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} /></label>
                </div>
                <label><span>先用你自己的话写，不需要像简历</span><textarea rows={4} value={draft.rawDescription} onChange={(e) => setDraft({ ...draft, rawDescription: e.target.value })} placeholder="例如：负责 CAD 图纸检查和修改。" /></label>
                <div className="interviewBox">
                  <strong>HR 追问</strong>
                  {followUps.map((question) => <p key={question}>→ {question}</p>)}
                </div>
                <label><span>你本人具体做了什么</span><textarea rows={3} value={draft.actions} onChange={(e) => setDraft({ ...draft, actions: e.target.value })} placeholder="优先写动作，不要只写‘参与’或‘协助’。" /></label>
                <label><span>工具 / 技术 / 方法</span><input value={draft.tools} onChange={(e) => setDraft({ ...draft, tools: e.target.value })} placeholder="AutoCAD, C#, Excel..." /></label>
                <label><span>结果 / 交付 / 变化</span><textarea rows={3} value={draft.outcomes} onChange={(e) => setDraft({ ...draft, outcomes: e.target.value })} /></label>
                <label><span>已确认事实（每行一条）</span><textarea rows={3} value={factsText} onChange={(e) => setFactsText(e.target.value)} placeholder="检查约 100 张工程图\n参与 AutoCAD 插件开发" /></label>
                <button className="primary full" onClick={saveExperience}>保存到经历库</button>
              </div>

              <div>
                <div className="sectionTitle"><h3>我的经历</h3><span>{experiences.length} 条</span></div>
                {experiences.length === 0 ? <div className="empty">没有实习也没关系：项目、比赛、科研、课程设计都可以先录入，HR 模式会按岗位价值排序。</div> : experiences.map((experience) => (
                  <article className="experienceCard" key={experience.id}>
                    <div className="row"><span className="tag">{labels[experience.type]}</span><span className="evidence">证据强度 {getExperienceEvidenceStrength(experience)}</span><button className="textButton" onClick={() => removeExperience(experience.id)}>删除</button></div>
                    <h4>{experience.title}</h4><p>{experience.organization} · {experience.startDate || "?"} — {experience.endDate || "至今"}</p>
                    <p>{experience.rawDescription}</p>
                    {experience.verifiedFacts.length > 0 && <div className="facts">{experience.verifiedFacts.map((fact) => <span key={fact}>✓ {fact}</span>)}</div>}
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {tab === "job" && (
          <section>
            <div className="eyebrow">JOB MATCH · EVIDENCE FIRST</div>
            <h2>岗位要求决定选材，不把所有经历都塞进去</h2>
            <p className="lead">匹配分数不是“ATS 玄学分”。它综合 JD 关键词覆盖与经历证据强度，用来帮助你判断哪段经历最值得写。</p>
            <div className="card"><label><span>岗位 JD</span><textarea rows={12} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="粘贴岗位职责与任职要求..." /></label></div>
            <div className="matchList">
              {matches.map((match) => {
                const experience = experiences.find((item) => item.id === match.experienceId);
                if (!experience) return null;
                return <div className="matchCard" key={match.experienceId}><div><strong>{experience.title}</strong><p>{experience.organization} · 证据强度 {getExperienceEvidenceStrength(experience)}</p><div className="keywords">{match.matchedKeywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div></div><div className="score">{match.score}<small>%</small><em>岗位覆盖</em></div></div>;
              })}
            </div>
            <div className="actions"><button className="primary" disabled={!experiences.length} onClick={() => setTab("resume")}>按 HR 规则生成一页简历 →</button></div>
          </section>
        )}

        {tab === "resume" && (
          <section>
            <div className="eyebrow">ONE-PAGE RESUME · HR REVIEWED</div>
            <h2>一页简历，不靠堆字取胜</h2>
            <p className="lead">默认上下结构、低饱和、教育背景简洁、经历按岗位价值排序。每条经历都告诉你“为什么这样写”，而不是只给一句 AI 润色结果。</p>
            <div className="ruleStrip">{HR_RULES.filter((rule) => rule.level === "must").slice(0, 5).map((rule) => <span key={rule.id}>✓ {rule.title}</span>)}</div>
            <article className="resumeSheet">
              <header><h3>{profile.name || "你的姓名"}</h3><p>{[profile.email, profile.phone, profile.city].filter(Boolean).join(" · ") || "邮箱 · 电话 · 求职城市"}</p></header>
              <section><h4>教育背景</h4><div className="resumeLine"><strong>{profile.school || "学校"}</strong><span>{profile.graduation || "毕业时间"}</span></div><p>{[profile.major, profile.degree].filter(Boolean).join(" · ") || "专业 · 学历"}</p></section>
              <section><h4>职业概述</h4><p>{buildSummary(profile, experiences)}</p></section>
              <section><h4>相关经历</h4>{selectedExperiences.length === 0 ? <p className="muted">请先添加经历。</p> : selectedExperiences.map((experience) => {
                const bullet = buildProfessionalResumeBullet(experience);
                return <div className="resumeExperience" key={experience.id}><div className="resumeLine"><strong>{experience.title} · {experience.organization}</strong><span>{experience.startDate} — {experience.endDate || "至今"}</span></div><p>• {bullet.text}</p><div className="whyBox"><strong>HR 为什么这样写</strong>{bullet.rationale.map((reason) => <span key={reason}>✓ {reason}</span>)}{bullet.warnings.map((warning) => <span className="warning" key={warning}>! {warning}</span>)}</div></div>;
              })}</section>
            </article>
          </section>
        )}
      </section>
    </main>
  );
}
