"use client";

import { BriefcaseBusiness, CheckCircle2, FileText, ImagePlus, Link2, Loader2, Plus, Target, Trash2, Upload } from "lucide-react";
import { JOB_PRIORITY_LABELS, JOB_STATUS_LABELS, latestResumeVersionForTarget } from "@/lib/jobApplication";
import { getExperienceEvidenceStrength } from "@/lib/hrRules";
import type { Experience, JobMatch, JobTarget, JobTargetPriority, JobTargetStatus, ResumeVersion } from "@/lib/types";

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

function formatTime(value: string) {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function JobWorkspace(props: JobWorkspaceProps) {
  const {
    jobTargets, resumeVersions, activeJobTargetId, experiences, matches, jdImageAnalyzing, jdImageNote,
    onCreateTarget, onActivateTarget, onChangeTarget, onDeleteTarget, onJdFile, onGoResume, onMarkApplied,
  } = props;
  const active = jobTargets.find((item) => item.id === activeJobTargetId) || null;
  const versions = active ? resumeVersions.filter((item) => item.jobTargetId === active.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) : [];
  const latestVersion = active ? latestResumeVersionForTarget(resumeVersions, active.id) : undefined;

  return <section className="sectionStack">
    <div className="sectionIntro"><span className="eyebrow">APPLICATION CONTINUITY</span><h2>记住的不只是岗位，而是“当时到底投了什么”。</h2><p>保存 JD 原文、投递渠道和本次简历快照。岗位下架、主简历继续修改，也不会影响已经投出去的那一版。</p></div>

    <div className="jobWorkspaceGrid">
      <aside className="panel jobTargetRail">
        <div className="panelHeading"><div><span className="eyebrow">TARGETS</span><h3>岗位库</h3></div><button className="iconButton" onClick={onCreateTarget} aria-label="添加岗位"><Plus size={16} /></button></div>
        {!jobTargets.length ? <div className="emptyState">还没有岗位。先保存一个真正准备投递的目标，不需要先做复杂表格。</div> : <div className="jobTargetList">{jobTargets.map((item) => {
          const count = resumeVersions.filter((version) => version.jobTargetId === item.id).length;
          return <button key={item.id} className={`jobTargetItem ${item.id === activeJobTargetId ? "active" : ""}`} onClick={() => onActivateTarget(item.id)}>
            <span className="jobTargetStatus">{JOB_STATUS_LABELS[item.status]}</span>
            <strong>{item.company || "未填写公司"}</strong>
            <span>{item.role || "未填写岗位"}</span>
            <small>{count ? `${count} 个简历快照` : "还没有保存投递版"}</small>
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
      </div>}
    </div>
  </section>;
}
