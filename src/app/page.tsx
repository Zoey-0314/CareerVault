"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Cloud,
  CloudOff,
  Copy,
  Database,
  Download,
  FileJson,
  FileText,
  FolderGit2,
  Gauge,
  ImagePlus,
  Layers3,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  UserRound,
  WandSparkles,
} from "lucide-react";
import { CoachTranscript, type CoachMessage } from "@/components/CoachTranscript";
import { ResumePanel } from "@/components/ResumePanel";
import { analyzeCredentialWithProvider, analyzeInterviewWithProvider, isRemoteAiConfigured } from "@/lib/aiClient";
import { getCloudUser, isCloudConfigured, loadVaultFromCloud, saveVaultToCloud, sendMagicLink, signOutCloud } from "@/lib/cloud";
import { assessCredentialLocally, credentialLevelLabel, sortCredentials } from "@/lib/credentials";
import { getExperienceEvidenceStrength, HR_RULES, reviewCandidateProfile } from "@/lib/hrRules";
import { getExperienceReadiness, getNextInterviewQuestion, type InterviewGoal } from "@/lib/interview";
import { applyConfirmedAgentFacts, type ExtractedFact } from "@/lib/interviewAgent";
import { matchExperiences } from "@/lib/matching";
import { createBackup, fileToCompressedDataUrl, loadVaultState, parseBackup, saveVaultState } from "@/lib/persistence";
import { buildProfessionalResumeBullet, buildSummary } from "@/lib/resume";
import type { Credential, CredentialType, Experience, ExperienceType, Profile, VaultState } from "@/lib/types";
import { buildWorkspaceImportPrompt, parseWorkspaceImport } from "@/lib/vibeImport";

type Tab = "overview" | "profile" | "experiences" | "credentials" | "job" | "resume";

const emptyProfile: Profile = { name: "", email: "", phone: "", city: "", school: "", major: "", degree: "", graduation: "" };
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
  source: "manual",
});
const emptyCredential = (): Credential => ({
  id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-credential`,
  type: "award",
  name: "",
  issuer: "",
  date: "",
  rank: "",
  description: "",
});

const experienceLabels: Record<ExperienceType, string> = {
  internship: "实习",
  work: "工作",
  project: "项目",
  campus: "校园",
  competition: "比赛",
  research: "科研",
  coursework: "课程设计",
  volunteer: "志愿",
};
const credentialLabels: Record<CredentialType, string> = {
  award: "奖项",
  certificate: "证书",
  honor: "荣誉",
  competition: "竞赛成绩",
  other: "其他",
};
const uncertainAnswers = ["不知道", "记不清", "没有统计", "不适用", "暂时没有明确结果", "暂时没有", "其他/不适用"];

function mergeText(existing: string, value: string) {
  const next = value.trim();
  if (!next) return existing;
  if (!existing.trim()) return next;
  if (existing.includes(next)) return existing;
  return `${existing}；${next}`;
}

function applyOneFact(experience: Experience, fact: ExtractedFact): Experience {
  if (fact.target === "actions") return { ...experience, actions: mergeText(experience.actions, fact.value) };
  if (fact.target === "tools") return { ...experience, tools: mergeText(experience.tools, fact.value) };
  if (fact.target === "outcomes") return { ...experience, outcomes: mergeText(experience.outcomes, fact.value) };
  if (experience.verifiedFacts.includes(fact.value)) return experience;
  return { ...experience, verifiedFacts: [...experience.verifiedFacts, fact.value] };
}

function message(role: CoachMessage["role"], text: string): CoachMessage {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, text };
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [jd, setJd] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const [draft, setDraft] = useState<Experience>(emptyExperience);
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [skippedGoals, setSkippedGoals] = useState<InterviewGoal[]>([]);
  const [pendingFacts, setPendingFacts] = useState<ExtractedFact[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [providerLabel, setProviderLabel] = useState("Local");
  const [conversation, setConversation] = useState<CoachMessage[]>([
    message("coach", "先不用想怎么写简历。告诉我真实做过什么，我会只追问最有价值、最能被证明的信息。"),
  ]);

  const [credentialDraft, setCredentialDraft] = useState<Credential>(emptyCredential);
  const [credentialAnalyzing, setCredentialAnalyzing] = useState(false);
  const [credentialProvider, setCredentialProvider] = useState("Local");

  const [workspaceImportText, setWorkspaceImportText] = useState("");
  const [workspaceQuestions, setWorkspaceQuestions] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudUserEmail, setCloudUserEmail] = useState("");
  const [cloudUserId, setCloudUserId] = useState("");
  const [cloudNote, setCloudNote] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const state = await loadVaultState();
      if (!mounted) return;
      setProfile(state.profile);
      setExperiences(state.experiences);
      setCredentials(state.credentials);
      setJd(state.jd);
      setProviderLabel(isRemoteAiConfigured() ? "GPT" : "Local");
      if (isCloudConfigured()) {
        const user = await getCloudUser().catch(() => null);
        if (user) {
          setCloudUserId(user.id);
          setCloudUserEmail(user.email || "已登录");
        }
      }
      setHydrated(true);
    })();
    return () => { mounted = false; };
  }, []);

  const vaultState = useMemo<VaultState>(() => ({
    version: 2,
    profile,
    experiences,
    credentials,
    jd,
    updatedAt: new Date().toISOString(),
  }), [profile, experiences, credentials, jd]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => saveVaultState(vaultState), 250);
    return () => window.clearTimeout(timer);
  }, [vaultState, hydrated]);

  const matches = useMemo(() => matchExperiences(jd, experiences), [jd, experiences]);
  const hrReview = useMemo(() => reviewCandidateProfile(profile, experiences), [profile, experiences]);
  const readiness = useMemo(() => getExperienceReadiness(draft), [draft]);
  const currentQuestion = useMemo(() => getNextInterviewQuestion(draft, skippedGoals), [draft, skippedGoals]);
  const sortedCredentials = useMemo(() => sortCredentials(credentials), [credentials]);
  const topCredentials = useMemo(() => sortedCredentials.filter((item) => (item.assessment?.score || 0) >= 45).slice(0, 3), [sortedCredentials]);
  const selectedExperiences = useMemo(() => {
    const rankedIds = matches.filter((item) => item.score > 0).slice(0, 3).map((item) => item.experienceId);
    const ids = rankedIds.length
      ? rankedIds
      : [...experiences].sort((a, b) => getExperienceEvidenceStrength(b) - getExperienceEvidenceStrength(a)).slice(0, 3).map((item) => item.id);
    return ids.map((id) => experiences.find((item) => item.id === id)).filter(Boolean) as Experience[];
  }, [matches, experiences]);

  const completion = Math.min(100, Math.round(
    ([profile.name, profile.email, profile.school, profile.major, profile.graduation].filter(Boolean).length / 5) * 30 +
    (Math.min(experiences.length, 3) / 3) * 40 +
    (Math.min(credentials.length, 2) / 2) * 10 +
    (jd.trim() ? 20 : 0),
  ));

  function pushConversation(...items: CoachMessage[]) {
    setConversation((current) => [...current, ...items].slice(-12));
  }

  function resetDraft() {
    setDraft(emptyExperience());
    setInterviewAnswer("");
    setSkippedGoals([]);
    setPendingFacts([]);
    setConversation([message("coach", "开始下一段经历。用最普通的话告诉我你做过什么就可以。")]);
  }

  function saveExperience() {
    if (!draft.title.trim() || !draft.organization.trim() || !draft.rawDescription.trim() || pendingFacts.length) return;
    setExperiences((current) => [{ ...draft }, ...current]);
    resetDraft();
  }

  async function submitInterviewAnswer() {
    if (!currentQuestion || isAnalyzing) return;
    const answer = interviewAnswer.trim();
    if (!answer) return;
    pushConversation(message("user", answer));
    if (uncertainAnswers.some((item) => answer.includes(item))) {
      setSkippedGoals((current) => Array.from(new Set([...current, currentQuestion.goal])));
      pushConversation(message("coach", "不知道就不编。我先跳过这一项，继续找能被证明的信息。"));
      setInterviewAnswer("");
      return;
    }
    setIsAnalyzing(true);
    try {
      const result = await analyzeInterviewWithProvider(answer, draft);
      setDraft(applyConfirmedAgentFacts(draft, result.analysis));
      const pending = result.analysis.extractedFacts.filter((fact) => fact.status === "needs_confirmation");
      setPendingFacts(pending);
      setProviderLabel(result.provider === "openai" ? `GPT${result.model ? ` · ${result.model}` : ""}` : "Local");
      pushConversation(message("coach", pending.length
        ? `${result.analysis.acknowledgement} 有 ${pending.length} 条内容需要你确认后我才会保存。`
        : `${result.analysis.acknowledgement} 已把能确认的事实写入经历卡。`));
      setInterviewAnswer("");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function chooseQuickOption(option: string) {
    if (uncertainAnswers.some((item) => option.includes(item))) {
      if (currentQuestion) setSkippedGoals((current) => Array.from(new Set([...current, currentQuestion.goal])));
      pushConversation(message("user", option), message("coach", "这项没有可靠信息就不写。"));
      return;
    }
    setInterviewAnswer((current) => current.trim() ? `${current}；${option}` : option);
  }

  function confirmPendingFact(id: string) {
    const fact = pendingFacts.find((item) => item.id === id);
    if (!fact?.value.trim()) return;
    setDraft((current) => applyOneFact(current, { ...fact, status: "confirmed", confidence: 1 }));
    setPendingFacts((current) => current.filter((item) => item.id !== id));
    pushConversation(message("coach", `已确认：“${fact.value}”。`));
  }

  async function analyzeCredential(candidate = credentialDraft) {
    setCredentialAnalyzing(true);
    try {
      const result = await analyzeCredentialWithProvider(candidate);
      const extracted = result.extracted || {};
      const next: Credential = {
        ...candidate,
        name: candidate.name || extracted.name || "",
        issuer: candidate.issuer || extracted.issuer || "",
        date: candidate.date || extracted.date || "",
        rank: candidate.rank || extracted.rank || "",
        description: candidate.description || extracted.description || "",
        type: candidate.type || extracted.type || "award",
        assessment: result.assessment,
      };
      setCredentialDraft(next);
      setCredentialProvider(result.provider === "openai" ? `GPT${result.model ? ` · ${result.model}` : ""}` : "Local");
    } finally {
      setCredentialAnalyzing(false);
    }
  }

  async function handleCredentialImage(file?: File) {
    if (!file) return;
    const imageDataUrl = await fileToCompressedDataUrl(file);
    const next = { ...credentialDraft, imageDataUrl };
    setCredentialDraft(next);
    await analyzeCredential(next);
  }

  function saveCredential() {
    if (!credentialDraft.name.trim()) return;
    const assessment = credentialDraft.assessment || assessCredentialLocally(credentialDraft);
    setCredentials((current) => [{ ...credentialDraft, assessment }, ...current]);
    setCredentialDraft(emptyCredential());
    setCredentialProvider(isRemoteAiConfigured() ? "GPT" : "Local");
  }

  async function reanalyzeCredentialFollowUp() {
    if (!credentialDraft.followUpAnswer?.trim()) return;
    await analyzeCredential(credentialDraft);
  }

  async function copyWorkspacePrompt() {
    await navigator.clipboard.writeText(buildWorkspaceImportPrompt());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function importWorkspaceResult() {
    try {
      const result = parseWorkspaceImport(workspaceImportText);
      setWorkspaceQuestions(result.questions);
      if (result.questions.length) {
        setDraft(result.experience);
        setPendingFacts([]);
        setSkippedGoals([]);
        setConversation([
          message("coach", `工作区已经提供了大量可验证事实。还剩 ${result.questions.length} 个无法从代码判断的问题，我们只补这些。`),
          ...result.questions.map((question) => message("coach", question)),
        ]);
      } else {
        setExperiences((current) => [result.experience, ...current]);
        setWorkspaceImportText("");
      }
    } catch (error) {
      setWorkspaceQuestions([error instanceof Error ? error.message : "无法识别导入内容，请确认粘贴的是完整 CareerVault JSON。"]);
    }
  }

  function downloadBackup() {
    const blob = new Blob([createBackup(vaultState)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CareerVault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restoreBackup(file?: File) {
    if (!file) return;
    const restored = parseBackup(await file.text());
    setProfile(restored.profile);
    setExperiences(restored.experiences);
    setCredentials(restored.credentials);
    setJd(restored.jd);
    await saveVaultState(restored);
  }

  async function sendLoginLink() {
    if (!cloudEmail.trim()) return;
    setCloudBusy(true);
    try {
      await sendMagicLink(cloudEmail.trim());
      setCloudNote("登录链接已发送到邮箱。打开邮件完成登录后回到这里即可同步。 ");
    } catch (error) {
      setCloudNote(error instanceof Error ? error.message : "发送失败");
    } finally { setCloudBusy(false); }
  }

  async function refreshCloudUser() {
    const user = await getCloudUser().catch(() => null);
    setCloudUserId(user?.id || "");
    setCloudUserEmail(user?.email || "");
    setCloudNote(user ? "已检测到登录账号。" : "尚未登录。 ");
  }

  async function pushCloud() {
    if (!cloudUserId) return;
    setCloudBusy(true);
    try {
      await saveVaultToCloud(cloudUserId, vaultState);
      setCloudNote("已同步到云端。换设备登录同一邮箱后可以恢复。 ");
    } catch (error) { setCloudNote(error instanceof Error ? error.message : "同步失败"); }
    finally { setCloudBusy(false); }
  }

  async function pullCloud() {
    if (!cloudUserId) return;
    setCloudBusy(true);
    try {
      const remote = await loadVaultFromCloud(cloudUserId);
      if (!remote) { setCloudNote("云端还没有备份。 "); return; }
      setProfile(remote.profile);
      setExperiences(remote.experiences);
      setCredentials(remote.credentials || []);
      setJd(remote.jd);
      await saveVaultState(remote);
      setCloudNote("已从云端恢复到当前设备。 ");
    } catch (error) { setCloudNote(error instanceof Error ? error.message : "恢复失败"); }
    finally { setCloudBusy(false); }
  }

  async function logoutCloud() {
    await signOutCloud();
    setCloudUserId("");
    setCloudUserEmail("");
    setCloudNote("已退出云同步账号。 ");
  }

  const nav = [
    ["overview", Layers3, "总览"],
    ["profile", UserRound, "个人档案"],
    ["experiences", BriefcaseBusiness, "经历库"],
    ["credentials", Award, "奖项证书"],
    ["job", Target, "岗位匹配"],
    ["resume", FileText, "一页简历"],
  ] as const;

  return (
    <div className="appFrame">
      <aside className="rail">
        <div className="brand"><div className="brandIcon"><Layers3 size={18} /></div><div><strong>CareerVault</strong><span>Career memory, refined.</span></div></div>
        <nav className="navList">{nav.map(([key, Icon, label]) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}><Icon size={17} /><span>{label}</span></button>
        ))}</nav>
        <div className="railFooter">
          <div className="miniStatus"><ShieldCheck size={15} /><span>Local-first</span></div>
          <p>IndexedDB 自动保存 · 可导出备份</p>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><span className="kicker">CAREER INTELLIGENCE</span><h1>{profile.name ? `${profile.name} 的 CareerVault` : "CareerVault"}</h1></div>
          <div className="topActions"><span className="statusPill"><Sparkles size={14} />{providerLabel}</span><span className="statusPill"><Gauge size={14} />{completion}%</span></div>
        </header>

        {tab === "overview" && (
          <section className="sectionStack">
            <div className="heroPanel">
              <div><span className="eyebrow">YOUR CAREER, AS STRUCTURED EVIDENCE</span><h2>把做过的事，变成可以反复复用的职业资产。</h2><p>经历只整理一次。CareerVault 保存事实、追问缺口，再针对岗位选择最有证明力的内容。</p></div>
              <button className="button primary" onClick={() => setTab("experiences")}><WandSparkles size={16} />添加经历</button>
            </div>
            <div className="metricGrid">
              <article className="metricCard"><BriefcaseBusiness size={18} /><strong>{experiences.length}</strong><span>经历资产</span></article>
              <article className="metricCard"><Award size={18} /><strong>{credentials.length}</strong><span>奖项与证书</span></article>
              <article className="metricCard"><Target size={18} /><strong>{jd.trim() ? "已设置" : "未设置"}</strong><span>目标岗位</span></article>
              <article className="metricCard"><ShieldCheck size={18} /><strong>{completion}%</strong><span>职业档案完整度</span></article>
            </div>
            <div className="splitGrid">
              <article className="panel">
                <div className="panelHeading"><div><span className="eyebrow">NEXT BEST ACTION</span><h3>下一步最值得补什么</h3></div></div>
                <div className="actionRows">
                  {!experiences.length && <button onClick={() => setTab("experiences")}><BriefcaseBusiness size={17} /><div><strong>录入第一段经历</strong><span>AI 会从事实开始追问，不要求你先会写简历。</span></div><ChevronRight size={16} /></button>}
                  {experiences.length > 0 && credentials.length === 0 && <button onClick={() => setTab("credentials")}><Award size={17} /><div><strong>补充奖项或证书</strong><span>上传图片也可以，系统会判断层级、含金量和证明力。</span></div><ChevronRight size={16} /></button>}
                  {!jd.trim() && <button onClick={() => setTab("job")}><Target size={17} /><div><strong>粘贴一个目标岗位</strong><span>让经历排序从“好看”变成“对这个岗位有用”。</span></div><ChevronRight size={16} /></button>}
                  {jd.trim() && <button onClick={() => setTab("resume")}><FileText size={17} /><div><strong>查看一页简历</strong><span>只选最相关、最能证明的事实。</span></div><ChevronRight size={16} /></button>}
                </div>
              </article>
              <article className="panel dataPanel">
                <div className="panelHeading"><div><span className="eyebrow">DATA SAFETY</span><h3>你的记录现在存在哪里</h3></div><Database size={20} /></div>
                <div className="safetyLine"><CheckCircle2 size={16} /><div><strong>当前设备：IndexedDB</strong><span>关闭浏览器后仍会保留；比 localStorage 更适合保存结构化数据和图片。</span></div></div>
                <div className="safetyLine"><CircleAlert size={16} /><div><strong>但它不是账号云盘</strong><span>清理网站数据、换浏览器或换设备仍可能丢失，所以建议定期备份或启用云同步。</span></div></div>
                <div className="buttonRow"><button className="button secondary" onClick={downloadBackup}><Download size={15} />导出备份</button><label className="button secondary fileButton"><Upload size={15} />恢复备份<input type="file" accept="application/json,.json" onChange={(e) => restoreBackup(e.target.files?.[0])} /></label></div>
              </article>
            </div>

            <article className="panel cloudPanel">
              <div className="panelHeading"><div><span className="eyebrow">OPTIONAL CLOUD SYNC</span><h3>跨设备同步</h3></div>{isCloudConfigured() ? <Cloud size={20} /> : <CloudOff size={20} />}</div>
              {!isCloudConfigured() ? (
                <p className="subtle">云同步代码已经准备好，但当前部署还没有配置 Supabase。未配置时不影响本地使用和备份。</p>
              ) : cloudUserId ? (
                <div className="cloudControls"><div><strong>{cloudUserEmail}</strong><span>已连接云端账号</span></div><div className="buttonRow"><button className="button secondary" disabled={cloudBusy} onClick={pushCloud}><Cloud size={15} />同步到云端</button><button className="button secondary" disabled={cloudBusy} onClick={pullCloud}><RefreshCw size={15} />从云端恢复</button><button className="iconButton" onClick={logoutCloud} aria-label="退出云端账号"><LogOut size={16} /></button></div></div>
              ) : (
                <div className="cloudControls"><input value={cloudEmail} onChange={(e) => setCloudEmail(e.target.value)} placeholder="输入邮箱，接收免密码登录链接" /><div className="buttonRow"><button className="button primary" disabled={cloudBusy || !cloudEmail.trim()} onClick={sendLoginLink}>发送登录链接</button><button className="button secondary" onClick={refreshCloudUser}><RefreshCw size={15} />检查登录状态</button></div></div>
              )}
              {cloudNote && <p className="inlineNote">{cloudNote}</p>}
            </article>
          </section>
        )}

        {tab === "profile" && (
          <section className="sectionStack narrow">
            <div className="sectionIntro"><span className="eyebrow">PERSONAL PROFILE</span><h2>只保留 HR 真正需要的基础信息</h2><p>默认不要求年龄、性别、详细住址、身高等低价值或敏感字段。</p></div>
            <article className="panel formPanel"><div className="formGrid">{([
              ["name", "姓名"], ["email", "邮箱"], ["phone", "电话"], ["city", "求职城市"], ["school", "学校"], ["major", "专业"], ["degree", "学历"], ["graduation", "毕业时间"],
            ] as const).map(([key, label]) => <label key={key}><span>{label}</span><input value={profile[key]} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} /></label>)}</div></article>
            <article className="panel"><div className="panelHeading"><div><span className="eyebrow">HR SCREENING</span><h3>初筛意见</h3></div></div><div className="reviewList">{hrReview.map((item) => <div className="reviewRow" key={item.title}>{item.type === "pass" ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}<div><strong>{item.title}</strong><span>{item.detail}</span></div></div>)}</div></article>
          </section>
        )}

        {tab === "experiences" && (
          <section className="sectionStack">
            <div className="sectionIntro"><span className="eyebrow">EXPERIENCE VAULT</span><h2>先说事实，简历语言交给专业 HR 规则。</h2><p>手动采访适合实习、校园和非代码经历；Vibe Coding 项目可以直接让原工作区生成可导入事实，省掉重复追问。</p></div>

            <article className="panel workspaceImport">
              <div className="panelHeading"><div><span className="eyebrow">WORKSPACE IMPORT</span><h3>Vibe Coding / AI Coding 项目一键提取</h3><p>让真正看得到仓库和 Git 历史的 AI 帮你整理事实，CareerVault 只补工作区无法判断的问题。</p></div><FolderGit2 size={20} /></div>
              <div className="buttonRow"><button className="button primary" onClick={copyWorkspacePrompt}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "已复制" : "复制工作区 Prompt"}</button></div>
              <textarea rows={6} value={workspaceImportText} onChange={(e) => setWorkspaceImportText(e.target.value)} placeholder="把工作区返回的 CAREERVAULT_IMPORT_V1 JSON 粘贴到这里…" />
              <div className="buttonRow"><button className="button secondary" disabled={!workspaceImportText.trim()} onClick={importWorkspaceResult}><FileJson size={15} />解析并导入</button></div>
              {workspaceQuestions.length > 0 && <div className="questionNotice"><CircleAlert size={16} /><div><strong>还有这些事实无法从工作区确认</strong>{workspaceQuestions.map((q) => <span key={q}>{q}</span>)}</div></div>}
            </article>

            <div className="interviewGrid">
              <article className="panel formPanel">
                <div className="panelHeading"><div><span className="eyebrow">NEW EXPERIENCE</span><h3>经历基础信息</h3></div></div>
                <div className="formGrid">
                  <label><span>类型</span><select value={draft.type} onChange={(e) => { setDraft({ ...draft, type: e.target.value as ExperienceType }); setSkippedGoals([]); }}>{Object.entries(experienceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span>岗位 / 项目</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
                  <label><span>公司 / 组织</span><input value={draft.organization} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} /></label>
                  <label><span>开始</span><input type="month" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></label>
                  <label><span>结束</span><input type="month" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} /></label>
                </div>
                <label><span>用自己的话说你做了什么</span><textarea rows={5} value={draft.rawDescription} onChange={(e) => setDraft({ ...draft, rawDescription: e.target.value })} placeholder="例如：暑假在机械部门实习，主要检查 CAD 图纸，有时也帮忙改图。" /></label>
                <details className="details"><summary>查看 / 手动修改已提取事实</summary><label><span>具体动作</span><textarea rows={3} value={draft.actions} onChange={(e) => setDraft({ ...draft, actions: e.target.value })} /></label><label><span>工具 / 技术</span><input value={draft.tools} onChange={(e) => setDraft({ ...draft, tools: e.target.value })} /></label><label><span>结果 / 交付</span><textarea rows={3} value={draft.outcomes} onChange={(e) => setDraft({ ...draft, outcomes: e.target.value })} /></label><label><span>已确认事实（每行一条）</span><textarea rows={4} value={draft.verifiedFacts.join("\n")} onChange={(e) => setDraft({ ...draft, verifiedFacts: e.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })} /></label></details>
              </article>

              <article className="panel coachPanel">
                <div className="coachTop"><div><span className="coachMark"><BriefcaseBusiness size={16} /></span><div><strong>CareerVault HR Coach</strong><span>{providerLabel} · 一次只问一个问题</span></div></div><div className="readiness">{readiness.score}%</div></div>
                <div className="progressTrack"><span style={{ width: `${readiness.score}%` }} /></div>
                <CoachTranscript messages={conversation} />
                {!draft.rawDescription.trim() ? <div className="emptyState">先在左侧写一句最原始的经历描述。</div> : pendingFacts.length ? (
                  <div className="pendingList"><div className="questionNotice"><ShieldCheck size={16} /><div><strong>这些内容不会自动进入事实库</strong><span>请确认或修改后再保存。</span></div></div>{pendingFacts.map((fact) => <div className="pendingCard" key={fact.id}><div className="pendingMeta"><span>{fact.goal}</span><span>{Math.round(fact.confidence * 100)}%</span></div><textarea rows={2} value={fact.value} onChange={(e) => setPendingFacts((current) => current.map((item) => item.id === fact.id ? { ...item, value: e.target.value } : item))} /><p>{fact.reason}</p><div className="buttonRow"><button className="button primary small" onClick={() => confirmPendingFact(fact.id)}><Check size={14} />确认</button><button className="button tertiary small" onClick={() => setPendingFacts((current) => current.filter((item) => item.id !== fact.id))}>不保存</button></div></div>)}</div>
                ) : currentQuestion ? (
                  <div className="questionBlock"><span className="eyebrow">NEXT QUESTION · {currentQuestion.goal}</span><h3>{currentQuestion.question}</h3>{currentQuestion.options.length > 0 && <div className="optionRow">{currentQuestion.options.map((option) => <button key={option} onClick={() => chooseQuickOption(option)}>{option}</button>)}</div>}<textarea rows={3} value={interviewAnswer} onChange={(e) => setInterviewAnswer(e.target.value)} placeholder={currentQuestion.placeholder} /><div className="buttonRow"><button className="button primary" disabled={!interviewAnswer.trim() || isAnalyzing} onClick={submitInterviewAnswer}>{isAnalyzing ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}{isAnalyzing ? "分析中" : "回答并继续"}</button><button className="button tertiary" onClick={() => { if (currentQuestion) setSkippedGoals((c) => Array.from(new Set([...c, currentQuestion.goal]))); }}>跳过</button></div><p className="whyText">为什么问：{currentQuestion.why}</p></div>
                ) : <div className="successState"><CheckCircle2 size={20} /><div><strong>这段经历已达到可用状态</strong><span>可以保存，也可以继续手动补充。</span></div></div>}
                <button className="button primary full" disabled={!draft.title.trim() || !draft.organization.trim() || !draft.rawDescription.trim() || pendingFacts.length > 0} onClick={saveExperience}>保存到经历库</button>
              </article>
            </div>

            <div className="libraryHeader"><div><span className="eyebrow">LIBRARY</span><h3>我的经历</h3></div><span>{experiences.length} 条</span></div>
            {experiences.length === 0 ? <div className="emptyState panel">还没有经历。没有实习也没关系，项目、比赛、课程设计和校园经历都可以成为证据。</div> : <div className="cardGrid">{experiences.map((item) => { const r = getExperienceReadiness(item); return <article className="assetCard" key={item.id}><div className="assetTop"><span className="softTag">{experienceLabels[item.type]}</span><button className="iconButton" onClick={() => setExperiences((current) => current.filter((x) => x.id !== item.id))} aria-label="删除经历"><Trash2 size={15} /></button></div><h4>{item.title}</h4><span className="metaLine">{item.organization} · {item.startDate || "?"} — {item.endDate || "至今"}</span><p>{item.rawDescription}</p><div className="assetFooter"><span>完整度 {r.score}%</span>{item.source === "workspace" && <span><FolderGit2 size={13} />工作区导入</span>}</div></article>; })}</div>}
          </section>
        )}

        {tab === "credentials" && (
          <section className="sectionStack">
            <div className="sectionIntro"><span className="eyebrow">CREDENTIALS</span><h2>奖项和证书不是越多越好，重要的是它到底证明什么。</h2><p>可以上传奖状/证书图片，也可以手动输入。系统会判断层级、主办方、名次与筛选性；信息不足时会继续追问。</p></div>
            <div className="splitGrid credentialGrid">
              <article className="panel formPanel">
                <div className="uploadZone"><ImagePlus size={22} /><div><strong>上传奖状 / 证书图片</strong><span>图片会先在浏览器压缩，再发送给 AI 识别；原图不会写入 GitHub。</span></div><label className="button secondary fileButton"><Upload size={15} />选择图片<input type="file" accept="image/*" onChange={(e) => handleCredentialImage(e.target.files?.[0])} /></label></div>
                {credentialDraft.imageDataUrl && <img className="credentialPreview" src={credentialDraft.imageDataUrl} alt="奖项或证书预览" />}
                <div className="formGrid">
                  <label><span>类型</span><select value={credentialDraft.type} onChange={(e) => setCredentialDraft({ ...credentialDraft, type: e.target.value as CredentialType })}>{Object.entries(credentialLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span>名称</span><input value={credentialDraft.name} onChange={(e) => setCredentialDraft({ ...credentialDraft, name: e.target.value })} /></label>
                  <label><span>颁发 / 主办方</span><input value={credentialDraft.issuer} onChange={(e) => setCredentialDraft({ ...credentialDraft, issuer: e.target.value })} /></label>
                  <label><span>日期</span><input type="month" value={credentialDraft.date} onChange={(e) => setCredentialDraft({ ...credentialDraft, date: e.target.value })} /></label>
                  <label><span>奖级 / 名次 / 等级</span><input value={credentialDraft.rank} onChange={(e) => setCredentialDraft({ ...credentialDraft, rank: e.target.value })} placeholder="一等奖 / Top 10% / 认证通过…" /></label>
                </div>
                <label><span>你为什么获得它 / 它对应了什么实际成果</span><textarea rows={4} value={credentialDraft.description} onChange={(e) => setCredentialDraft({ ...credentialDraft, description: e.target.value })} placeholder="例如：负责比赛中的控制模块，实现…；或通过某项认证考试。" /></label>
                <div className="buttonRow"><button className="button secondary" disabled={credentialAnalyzing || (!credentialDraft.name.trim() && !credentialDraft.imageDataUrl)} onClick={() => analyzeCredential()}>{credentialAnalyzing ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}{credentialAnalyzing ? "判断中" : "重新判断"}</button><button className="button primary" disabled={!credentialDraft.name.trim()} onClick={saveCredential}>保存证书 / 奖项</button></div>
              </article>

              <article className="panel assessmentPanel">
                <div className="panelHeading"><div><span className="eyebrow">CREDENTIAL REVIEW</span><h3>专业判断</h3></div><span className="statusPill"><Sparkles size={14} />{credentialProvider}</span></div>
                {!credentialDraft.assessment ? <div className="emptyState">上传图片或填写基本信息后，CareerVault 会判断它在简历中的价值。</div> : <>
                  <div className="credentialScore"><strong>{credentialDraft.assessment.score}</strong><div><span>{credentialDraft.assessment.tier}</span><small>{credentialLevelLabel(credentialDraft.assessment.level)}</small></div></div>
                  <div className="rationaleList">{credentialDraft.assessment.rationale.map((reason) => <div key={reason}><Check size={14} /><span>{reason}</span></div>)}</div>
                  <div className="proofBox"><span className="eyebrow">WHAT IT PROVES</span><p>{credentialDraft.assessment.whatItProves}</p></div>
                  {credentialDraft.assessment.followUpQuestion && <div className="followUp"><CircleAlert size={17} /><div><strong>还缺一个关键事实</strong><p>{credentialDraft.assessment.followUpQuestion}</p><textarea rows={3} value={credentialDraft.followUpAnswer || ""} onChange={(e) => setCredentialDraft({ ...credentialDraft, followUpAnswer: e.target.value })} placeholder="用自己的话回答即可…" /><button className="button secondary small" disabled={!credentialDraft.followUpAnswer?.trim() || credentialAnalyzing} onClick={reanalyzeCredentialFollowUp}>补充后重新判断</button></div></div>}
                </>}
              </article>
            </div>

            <div className="libraryHeader"><div><span className="eyebrow">CREDENTIAL VAULT</span><h3>已保存</h3></div><span>{credentials.length} 项</span></div>
            {credentials.length === 0 ? <div className="emptyState panel">还没有保存的奖项或证书。</div> : <div className="cardGrid">{sortedCredentials.map((item) => <article className="assetCard credentialCard" key={item.id}>{item.imageDataUrl && <img src={item.imageDataUrl} alt="证书缩略图" />}<div className="assetTop"><span className="softTag">{credentialLabels[item.type]}</span><button className="iconButton" onClick={() => setCredentials((current) => current.filter((x) => x.id !== item.id))}><Trash2 size={15} /></button></div><h4>{item.name}</h4><span className="metaLine">{item.issuer || "未知颁发方"}{item.rank ? ` · ${item.rank}` : ""}</span>{item.assessment && <div className="credentialMiniScore"><strong>{item.assessment.score}</strong><span>{item.assessment.tier} · {credentialLevelLabel(item.assessment.level)}</span></div>}<p>{item.assessment?.whatItProves || item.description}</p></article>)}</div>}
          </section>
        )}

        {tab === "job" && (
          <section className="sectionStack narrow">
            <div className="sectionIntro"><span className="eyebrow">TARGET ROLE</span><h2>岗位要求决定选材，而不是把人生全部塞进一页。</h2><p>这里的分数是证据覆盖，不是“ATS 玄学分”。</p></div>
            <article className="panel"><label><span>岗位 JD</span><textarea rows={14} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="粘贴岗位职责与任职要求…" /></label></article>
            <div className="matchList">{matches.map((match) => { const item = experiences.find((x) => x.id === match.experienceId); if (!item) return null; return <article className="matchCard" key={match.experienceId}><div><span className="softTag">{experienceLabels[item.type]}</span><h4>{item.title}</h4><span className="metaLine">{item.organization} · 证据强度 {getExperienceEvidenceStrength(item)}</span><div className="chipRow">{match.matchedKeywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div></div><div className="matchScore"><strong>{match.score}</strong><span>% 覆盖</span></div></article>; })}</div>
            {jd.trim() && <div className="buttonRow"><button className="button primary" onClick={() => setTab("resume")}><FileText size={15} />生成该岗位的一页简历</button></div>}
          </section>
        )}

        {tab === "resume" && <ResumePanel profile={profile} jd={jd} experiences={experiences} matches={matches} credentials={credentials} onGoToJob={() => setTab("job")} />}
      </main>
    </div>
  );
}