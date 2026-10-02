"use client";

import { useEffect, useState } from "react";
import { Brain, BriefcaseBusiness, CheckCircle2, ClipboardPen, FileText, ImagePlus, Link2, Loader2, Plus, RefreshCw, Target, Trash2, Upload } from "lucide-react";
import { getExperienceEvidenceStrength } from "@/lib/hrRules";
import { generateInterviewPrep } from "@/lib/interviewPrepAi";
import { JOB_PRIORITY_LABELS, JOB_STATUS_LABELS, latestResumeVersionForTarget, newInterviewDebriefId } from "@/lib/jobApplication";
import type { Experience, InterviewDebrief, JobMatch, JobTarget, JobTargetPriority, JobTargetStatus, ResumeVersion } from "@/lib/types";

interface JobWorkspaceProps {
  jobTargets: JobTarget[];
  resumeVersions: ResumeVersion[];
  activeJobTargetId: string;
  experiences: Experience[];
  matches: JobMatch[];
  jdImageAnalyzing: boolean;
  jdImageNote: string;
  onCreateTarget: () => void;
  onActivateTarget: (id: string) => void;
  onChangeTarget: (id: string, patch: Partial<JobTarget>) => void;
  onDeleteTarget: (id: string) => void;
  onJdFile: (file?: File) => void;
  onGoResume: () => void;
  onMarkApplied: (id: string) => void;
}

const experienceLabels: Record<Experience["type"], string> = {
  internship: "实习", work: "工作", project: "项目", campus: "校园", competition: "比赛", research: "科研", coursework: "课程设计", volunteer: "志愿",
};
const prepCategoryLabels = { resume_claim: "简历追问", jd_requirement: "岗位要求", technical_depth: "技术/业务深挖", behavioral: "决策与协作" } as const;

function formatTime(value: string) {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function lines(value: string) { return value.split(/\n+/).map((item) => item.trim()).filter(Boolean); }

export function JobWorkspace(props: JobWorkspaceProps) {
  const {
    jobTargets, resumeVersions, activeJobTargetId, experiences, matches, jdImageAnalyzing, jdImageNote,
    onCreateTarget, onActivateTarget, onChangeTarget, onDeleteTarget, onJdFile, onGoResume, onMarkApplied,
  } = props;
  const active = jobTargets.find((item) => item.id === activeJobTargetId) || null;
  const versions = active ? resumeVersions.filter((item) => item.jobTargetId === active.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) : [];
  const latestVersion = active ? latestResumeVersionForTarget(resumeVersions, active.id) : undefined;
  const submittedVersion = active?.submittedResumeVersionId ? resumeVersions.find((item) => item.id === active.submittedResumeVersionId) : undefined;
  const [prepBusy, setPrepBusy] = useState(false);
  const [prepError, setPrepError] = useState("");
  const [debrief, setDebrief] = useState({ round: "一面", occurredAt: "", questions: "", stumbles: "", wentWell: "", followUps: "", notes: "" });

  useEffect(() => {
    setPrepError("");
    setDebrief({ round: "一面", occurredAt: "", questions: "", stumbles: "", wentWell: "", followUps: "", notes: "" });
  }, [activeJobTargetId]);

  async function buildInterviewPrep() {
    if (!active || !submittedVersion || prepBusy) return;
    setPrepBusy(true); setPrepError("");
    try {
      const plan = await generateInterviewPrep(submittedVersion, experiences);
      onChangeTarget(active.id, { interviewPrep: plan, status: active.status === "applied" ? "interview" : active.status });
    } catch (error) {
      setPrepError(error instanceof Error ? error.message : "面试准备生成失败。");
    } finally { setPrepBusy(false); }
  }

  function saveDebrief() {
    if (!active) return;
    const record: InterviewDebrief = {
      id: newInterviewDebriefId(),
      round: debrief.round.trim() || "面试",
      occurredAt: debrief.occurredAt,
      questionsAsked: lines(debrief.questions),
      stumbles: lines(debrief.stumbles),
      whatWentWell: lines(debrief.wentWell),
      followUps: lines(debrief.followUps),
      notes: debrief.notes.trim(),
      createdAt: new Date().toISOString(),
    };
    const hasContent = record.questionsAsked.length || record.stumbles.length || record.whatWentWell.length || record.followUps.length || record.notes;
    if (!hasContent) return;
    onChangeTarget(active.id, { interviewDebriefs: [record, ...(active.interviewDebriefs || [])] });
    setDebrief({ round: "下一轮", occurredAt: "", questions: "", stumbles: "", wentWell: "", followUps: "", notes: "" });
  }

  return <section className="sectionStack">
    <div className="sectionIntro"><span className="eyebrow">APPLICATION CONTINUITY</span><h2>记住的不只是岗位，而是“当时到底投了什么”。</h2><p>保存 JD 原文、投递渠道和本次简历快照。收到面试后，再用对方真正看到的那一版做准备和复盘。</p></div>

    <div className="jobWorkspaceGrid">
      <aside className="panel jobTargetRail">
        <div className="panelHeading"><div><span className="eyebrow">TARGETS</span><h3>岗位库</h3></div><button className="iconButton" onClick={onCreateTarget} aria-label="添加岗位"><Plus size={16} /></button></div>
        {!jobTargets.length ? <div className="emptyState">还没有岗位。先保存一个真正准备投递的目标，不需要先做复杂表格。</div> : <div className="jobTargetList">{jobTargets.map((item) => {
          const count = resumeVersions.filter((version) => version.jobTargetId === item.id).length;
          return <button key={item.id} className={`jobTargetItem ${item.id === activeJobTargetId ? "active" : ""}`} onClick={() => onActivateTarget(item.id)}>
            <span className="jobTargetStatus">{JOB_STATUS_LABELS[item.status]}</span>
            <strong>{item.company || "未填写公司"}</strong><span>{item.role || "未填写岗位"}</span>
            <small>{item.submittedResumeVersionId ? `已锁定投递版 · ${(item.interviewDebriefs || []).length} 次复盘` : count ? `${count} 个简历快照` : "还没有保存投递版"}</small>
          </button>;
        })}</div>}
      </aside>

      {!active ? <article className="panel resumeGate"><Target size={24} /><div><strong>先添加一个目标岗位</strong><span>CareerVault 会把 JD、投递版本和后续面试准备绑在同一条记录上。</span></div><button className="button primary" onClick={onCreateTarget}><Plus size={15} />添加岗位</button></article> : <div className="sectionStack jobTargetDetail">
        <article className="panel formPanel">
          <div className="panelHeading"><div><span className="eyebrow">{JOB_STATUS_LABELS[active.status]} · {JOB_PRIORITY_LABELS[active.priority]}</span><h3>{active.company || "目标公司"} · {active.role || "目标岗位"}</h3></div>{active.status === "saved" || active.status === "ready" ? <button className="iconButton" onClick={() => onDeleteTarget(active.id)} aria-label="删除岗位"><Trash2 size={16} /></button> : null}</div>
          <div className="formGrid">
            <label><span>公司</span><input value={active.company} onChange={(e) => onChangeTarget(active.id, { company: e.target.value })} placeholder="例如：某科技公司" /></label>
            <label><span>岗位名称</span><input value={active.role} onChange={(e) => onChangeTarget(active.id, { role: e.target.value })} placeholder="使用招聘公告原词" /></label>
            <label><span>投递渠道</span><input value={active.channel} onChange={(e) => onChangeTarget(active.id, { channel: e.target.value })} placeholder="官网 / 内推 / 邮箱 / 招聘平台" /></label>
            <label><span>优先级</span><select value={active.priority} onChange={(e) => onChangeTarget(active.id, { priority: e.target.value as JobTargetPriority })}>{Object.entries(JOB_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>当前阶段</span><select value={active.status} onChange={(e) => onChangeTarget(active.id, { status: e.target.value as JobTargetStatus })}>{Object.entries(JOB_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>岗位链接</span><div className="inputWithIcon"><Link2 size={14} /><input value={active.sourceUrl} onChange={(e) => onChangeTarget(active.id, { sourceUrl: e.target.value })} placeholder="链接可能失效，所以 JD 仍会单独保存" /></div></label>
          </div>
          <label><span>下一步</span><input value={active.nextAction} onChange={(e) => onChangeTarget(active.id, { nextAction: e.target.value })} placeholder="例如：10/08 一面；补准备项目安全保存机制" /></label>
          <label><span>备注（保持一两行即可）</span><textarea rows={2} value={active.notes} onChange={(e) => onChangeTarget(active.id, { notes: e.target.value })} placeholder="例如：项目二提前；内推人已确认收到" /></label>
        </article>

        <article className="panel formPanel">
          <div className="uploadZone"><ImagePlus size={22} /><div><strong>保存岗位 JD 快照</strong><span>不要只留链接。岗位关闭后链接可能失效，面试前仍应能看到当时的职责和要求。</span></div><label className="button secondary fileButton"><Upload size={15} />{jdImageAnalyzing ? "识别中…" : "上传图片 / PDF"}<input type="file" accept="image/*,application/pdf,.pdf" disabled={jdImageAnalyzing} onChange={(e) => onJdFile(e.target.files?.[0])} /></label></div>
          {jdImageAnalyzing && <div className="questionNotice"><Loader2 className="spin" size={16} /><div><strong>正在读取岗位文件</strong><span>完成后会写入当前岗位的 JD 快照。</span></div></div>}
          {jdImageNote && <p className="inlineNote">{jdImageNote}</p>}
          <label><span>JD 原文</span><textarea rows={13} value={active.jd} onChange={(e) => onChangeTarget(active.id, { jd: e.target.value })} placeholder="粘贴岗位职责和任职要求，或上传岗位图片 / PDF" /></label>
          <div className="buttonRow"><button className="button primary" disabled={!active.jd.trim()} onClick={onGoResume}><FileText size={15} />为这个岗位准备简历</button></div>
        </article>

        {active.jd.trim() && <article className="panel"><div className="panelHeading"><div><span className="eyebrow">EVIDENCE MATCH</span><h3>现有经历与 JD 的直接证据</h3></div></div><div className="matchList">{matches.slice(0, 5).map((match) => { const item = experiences.find((x) => x.id === match.experienceId); if (!item) return null; return <article className="matchCard" key={match.experienceId}><div><span className="softTag">{experienceLabels[item.type]}</span><h4>{item.title}</h4><span className="metaLine">{item.organization} · 证据强度 {getExperienceEvidenceStrength(item)}</span><div className="chipRow">{match.matchedKeywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div></div><div className="matchScore"><strong>{match.score}</strong><span>% 覆盖</span></div></article>; })}</div></article>}

        <article className="panel">
          <div className="panelHeading"><div><span className="eyebrow">RESUME SNAPSHOTS</span><h3>这个岗位实际用过的简历</h3><p>保存后即作为历史快照，不会随着经历库或 AI 改写继续变化。</p></div><BriefcaseBusiness size={20} /></div>
          {!versions.length ? <div className="questionNotice"><FileText size={16} /><div><strong>还没有投递版快照</strong><span>先去“一页简历”生成并保存一版。标记“已投递”前，CareerVault 会要求先留下这份记录。</span></div></div> : <div className="versionList">{versions.map((version) => <div className="versionRow" key={version.id}><div><strong>{version.label}</strong><span>{formatTime(version.createdAt)} · {version.provider === "deterministic" ? "规则版" : `${version.provider}${version.model ? ` · ${version.model}` : ""}`}</span></div>{active.submittedResumeVersionId === version.id ? <span className="softTag"><CheckCircle2 size={12} />实际投递版</span> : null}</div>)}</div>}
          <div className="buttonRow"><button className="button primary" disabled={!latestVersion || Boolean(active.submittedResumeVersionId)} onClick={() => onMarkApplied(active.id)}><CheckCircle2 size={15} />{active.submittedResumeVersionId ? "已锁定投递版" : latestVersion ? "用最新快照标记已投递" : "先保存简历快照"}</button>{active.appliedAt && <span className="inlineNote">投递日期：{active.appliedAt}</span>}</div>
        </article>

        {submittedVersion && <article className="panel interviewPrepPanel">
          <div className="panelHeading"><div><span className="eyebrow">INTERVIEW PREP</span><h3>按“对方手里的简历”准备</h3><p>AI 只生成追问和复习重点，不生成虚构的标准答案。来源固定为实际投递版简历、当时的 JD 和已保存事实。</p></div><Brain size={20} /></div>
          {!active.interviewPrep ? <div className="questionNotice"><Brain size={16} /><div><strong>还没有这份投递的面试准备包</strong><span>生成后会重点检查简历 claim、JD 要求、技术/业务深挖，以及 AI 辅助项目中你本人真正能解释的边界。</span></div></div> : <>
            <div className="prepQuestions">{active.interviewPrep.questions.map((item, index) => <div className="prepQuestion" key={item.id}><span>{index + 1}</span><div><small>{prepCategoryLabels[item.category]}</small><strong>{item.question}</strong><p>{item.why}</p></div></div>)}</div>
            <div className="prepGrid"><div><span className="eyebrow">REVIEW BEFORE INTERVIEW</span>{active.interviewPrep.reviewTopics.length ? <ul>{active.interviewPrep.reviewTopics.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="subtle">暂无额外复习项。</p>}</div><div><span className="eyebrow">EVIDENCE GAPS</span>{active.interviewPrep.evidenceGaps.length ? <ul>{active.interviewPrep.evidenceGaps.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="subtle">当前没有明显证据缺口。</p>}</div></div>
            <p className="inlineNote">基于实际投递版：{submittedVersion.label} · 生成于 {formatTime(active.interviewPrep.generatedAt)}</p>
          </>}
          {prepError && <p className="inlineNote">{prepError}</p>}
          <div className="buttonRow"><button className="button secondary" disabled={prepBusy} onClick={buildInterviewPrep}>{prepBusy ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}{prepBusy ? "正在生成" : active.interviewPrep ? "重新生成准备包" : "生成面试准备包"}</button></div>
        </article>}

        {submittedVersion && <article className="panel debriefPanel">
          <div className="panelHeading"><div><span className="eyebrow">INTERVIEW DEBRIEF</span><h3>每轮面试后，只记以后真正用得上的东西</h3><p>重点不是写面试日记，而是留下“问了什么、哪里卡住、下次补什么”。</p></div><ClipboardPen size={20} /></div>
          <div className="formGrid"><label><span>轮次</span><input value={debrief.round} onChange={(e) => setDebrief({ ...debrief, round: e.target.value })} placeholder="一面 / 二面 / HR面" /></label><label><span>日期</span><input type="date" value={debrief.occurredAt} onChange={(e) => setDebrief({ ...debrief, occurredAt: e.target.value })} /></label></div>
          <label><span>实际被问到的问题（每行一条）</span><textarea rows={4} value={debrief.questions} onChange={(e) => setDebrief({ ...debrief, questions: e.target.value })} placeholder="例如：为什么要做安全保存机制？\n这个项目的上下游是谁？" /></label>
          <div className="formGrid"><label><span>卡住 / 答得不好的点</span><textarea rows={4} value={debrief.stumbles} onChange={(e) => setDebrief({ ...debrief, stumbles: e.target.value })} placeholder="每行一个，写事实，不写情绪" /></label><label><span>这轮讲清楚的点</span><textarea rows={4} value={debrief.wentWell} onChange={(e) => setDebrief({ ...debrief, wentWell: e.target.value })} placeholder="哪些项目细节已经能稳定解释" /></label></div>
          <label><span>下一轮要补的内容（每行一条）</span><textarea rows={3} value={debrief.followUps} onChange={(e) => setDebrief({ ...debrief, followUps: e.target.value })} placeholder="例如：补清楚故障恢复流程；复习事务边界" /></label>
          <label><span>其他备注</span><textarea rows={2} value={debrief.notes} onChange={(e) => setDebrief({ ...debrief, notes: e.target.value })} /></label>
          <div className="buttonRow"><button className="button primary" onClick={saveDebrief}><ClipboardPen size={15} />保存本轮复盘</button></div>
          {(active.interviewDebriefs || []).length > 0 && <div className="debriefHistory">{(active.interviewDebriefs || []).map((item) => <div className="debriefRecord" key={item.id}><div><strong>{item.round}</strong><span>{item.occurredAt || formatTime(item.createdAt)}</span></div>{item.stumbles.length > 0 && <p><b>卡点：</b>{item.stumbles.join("；")}</p>}{item.followUps.length > 0 && <p><b>下次补：</b>{item.followUps.join("；")}</p>}</div>)}</div>}
        </article>}
      </div>}
    </div>
  </section>;
}
