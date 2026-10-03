"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronRight, Gauge } from "lucide-react";
import { getCareerReadiness } from "@/lib/careerReadiness";
import { credentialFieldCopy } from "@/lib/credentialFieldCopy";
import type { CredentialType, VaultState } from "@/lib/types";

const DB_NAME = "careervault";
const DB_VERSION = 2;
const STORE_NAME = "vault";
const STATE_KEY = "state-v2";

function readRawVaultState(): Promise<VaultState | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => resolve(null);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains("attachments")) db.createObjectStore("attachments");
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, "readonly");
      const get = tx.objectStore(STORE_NAME).get(STATE_KEY);
      get.onerror = () => resolve(null);
      get.onsuccess = () => resolve((get.result as VaultState | undefined) || null);
    };
  });
}

function nextActionTab(key: string) {
  if (key === "profile") return "个人档案";
  if (key === "experience") return "经历库";
  if (key === "target" || key === "interview") return "岗位库";
  return "一页简历";
}

function clickNav(label: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".navList button"))
    .find((item) => item.textContent?.trim() === label);
  button?.click();
}

function setTextIfChanged(element: HTMLElement | null, value: string) {
  if (element && element.textContent !== value) element.textContent = value;
}

function setPlaceholderIfChanged(element: HTMLInputElement | HTMLTextAreaElement | null, value: string) {
  if (element && element.placeholder !== value) element.placeholder = value;
}

function updateCredentialCopy() {
  const root = document.getElementById("credential-editor");
  if (!root) return;
  const select = root.querySelector<HTMLSelectElement>("select");
  if (!select) return;
  const type = select.value as CredentialType;
  const copy = credentialFieldCopy(type);
  const form = root.querySelector<HTMLElement>(".formPanel");
  if (!form) return;

  const labels = Array.from(form.querySelectorAll<HTMLLabelElement>("label"));
  for (const label of labels) {
    const span = label.querySelector<HTMLSpanElement>(":scope > span");
    const input = label.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    const text = span?.textContent || "";
    if (/颁发|主办|发证|认证机构|评选|聘任单位|出具/.test(text) && input) {
      setTextIfChanged(span, copy.issuerLabel);
    } else if (/奖级|名次|考试等级|认证.*等级|职位.*任期|荣誉称号/.test(text) && input) {
      setTextIfChanged(span, copy.rankLabel);
      setPlaceholderIfChanged(input, copy.rankPlaceholder);
    } else if (/为什么获得|对应了什么实际成果|证明了什么能力|参赛项目|任职.*成果/.test(text) && input) {
      setTextIfChanged(span, copy.descriptionLabel);
      setPlaceholderIfChanged(input, copy.descriptionPlaceholder);
    }
  }
}

export function P2UiEnhancements() {
  const [state, setState] = useState<VaultState | null>(null);
  const [overviewTarget, setOverviewTarget] = useState<Element | null>(null);

  useEffect(() => {
    let cancelled = false;
    let lastCredentialEditor: Element | null = null;

    const refresh = async () => {
      const value = await readRawVaultState();
      if (!cancelled) setState(value);
    };

    const syncMountedViews = () => {
      setOverviewTarget(document.querySelector(".heroPanel")?.closest(".sectionStack") || null);
      const credentialEditor = document.getElementById("credential-editor");
      if (credentialEditor !== lastCredentialEditor) {
        lastCredentialEditor = credentialEditor;
        if (credentialEditor) updateCredentialCopy();
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, 1800);
    const observer = new MutationObserver(syncMountedViews);
    observer.observe(document.body, { subtree: true, childList: true });
    syncMountedViews();

    const onChange = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest("#credential-editor")) updateCredentialCopy();
    };
    document.addEventListener("change", onChange, true);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("change", onChange, true);
    };
  }, []);

  const readiness = useMemo(() => state ? getCareerReadiness({
    profile: state.profile,
    experiences: state.experiences || [],
    credentials: state.credentials || [],
    jobTargets: state.jobTargets || [],
    resumeVersions: state.resumeVersions || [],
    activeJobTargetId: state.activeJobTargetId,
  }) : null, [state]);

  useEffect(() => {
    if (!readiness) return;
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".metricCard"));
    const card = cards.find((item) => /职业档案完整度|求职准备度/.test(item.textContent || ""));
    if (!card) return;
    const strong = card.querySelector("strong");
    const label = card.querySelector("span");
    if (strong && strong.textContent !== `${readiness.score}%`) strong.textContent = `${readiness.score}%`;
    if (label && label.textContent !== "求职准备度") label.textContent = "求职准备度";
  }, [readiness, overviewTarget]);

  if (!readiness || !overviewTarget) return null;

  return createPortal(
    <article className="panel careerReadinessPanel">
      <div className="panelHeading">
        <div><span className="eyebrow">JOB READINESS</span><h3>求职准备度 · {readiness.score}%</h3><p>不是“填了多少字段”，而是从基础档案、经历证据、目标岗位、定制简历和面试准备判断当前能否继续投递。</p></div>
        <Gauge size={20} />
      </div>
      <div className="readinessDimensionList">
        {readiness.dimensions.map((item) => <div className="readinessDimension" key={item.key}>
          <div><strong>{item.label}</strong><span>{item.detail}</span></div>
          <div className="readinessBar"><span style={{ width: `${item.maxScore ? (item.score / item.maxScore) * 100 : 0}%` }} /></div>
          <b>{item.score}/{item.maxScore}</b>
        </div>)}
      </div>
      <button className="readinessNextAction" onClick={() => clickNav(nextActionTab(readiness.nextAction.key))}>
        <CheckCircle2 size={17} /><div><strong>{readiness.nextAction.title}</strong><span>{readiness.nextAction.detail}</span></div><ChevronRight size={16} />
      </button>
    </article>,
    overviewTarget,
  );
}
