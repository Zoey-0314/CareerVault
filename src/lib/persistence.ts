import { normalizeExperienceV3 } from "@/lib/experienceModel";
import { legacyTargetFromJd, normalizeJobTarget } from "@/lib/jobApplication";
import type { Credential, ResumeVersion, VaultState } from "@/lib/types";

const DB_NAME = "careervault";
const DB_VERSION = 2;
const STORE_NAME = "vault";
const ATTACHMENT_STORE_NAME = "attachments";
const STATE_KEY = "state-v2";
const LEGACY_KEY = "careervault-v1";

type StoredAttachment = {
  blob: Blob;
  name: string;
  type: string;
  updatedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(ATTACHMENT_STORE_NAME)) db.createObjectStore(ATTACHMENT_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function emptyState(): VaultState {
  return {
    version: 4,
    profile: { name: "", email: "", phone: "", city: "", school: "", major: "", degree: "", graduation: "" },
    experiences: [],
    credentials: [],
    jd: "",
    jobTargets: [],
    resumeVersions: [],
    activeJobTargetId: "",
    updatedAt: new Date().toISOString(),
  };
}

function normalizeResumeVersion(value: ResumeVersion): ResumeVersion | null {
  if (!value || typeof value !== "object" || !value.id || !value.jobTargetId) return null;
  return {
    ...value,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    label: typeof value.label === "string" ? value.label : "投递版简历",
    targetRole: typeof value.targetRole === "string" ? value.targetRole : "目标岗位",
    summary: typeof value.summary === "string" ? value.summary : "",
    selectedExperienceIds: Array.isArray(value.selectedExperienceIds) ? value.selectedExperienceIds : [],
    experienceBullets: Array.isArray(value.experienceBullets) ? value.experienceBullets : [],
    credentialIds: Array.isArray(value.credentialIds) ? value.credentialIds : [],
    provider: value.provider === "openai" || value.provider === "deepseek" ? value.provider : "deterministic",
    jdSnapshot: typeof value.jdSnapshot === "string" ? value.jdSnapshot : "",
  };
}

function normalizeState(value: Partial<VaultState> | null | undefined): VaultState {
  const base = emptyState();
  const experiences = Array.isArray(value?.experiences)
    ? value!.experiences!.map((experience) => normalizeExperienceV3(experience))
    : [];
  const legacyJd = typeof value?.jd === "string" ? value.jd : "";
  const jobTargets = Array.isArray(value?.jobTargets)
    ? value!.jobTargets!.map((target) => normalizeJobTarget(target))
    : legacyJd.trim()
      ? [legacyTargetFromJd(legacyJd)]
      : [];
  const requestedActive = typeof value?.activeJobTargetId === "string" ? value.activeJobTargetId : "";
  const activeJobTargetId = jobTargets.some((target) => target.id === requestedActive)
    ? requestedActive
    : jobTargets[0]?.id || "";
  const activeTarget = jobTargets.find((target) => target.id === activeJobTargetId);
  const resumeVersions = Array.isArray(value?.resumeVersions)
    ? value!.resumeVersions!.map((item) => normalizeResumeVersion(item)).filter(Boolean) as ResumeVersion[]
    : [];

  return {
    ...base,
    ...value,
    version: 4,
    profile: { ...base.profile, ...(value?.profile || {}) },
    experiences,
    credentials: Array.isArray(value?.credentials) ? value!.credentials! : [],
    jd: activeTarget?.jd || legacyJd,
    jobTargets,
    resumeVersions,
    activeJobTargetId,
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}

function attachmentIdFor(credential: Credential): string {
  return credential.attachmentId || `credential:${credential.id}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, payload = ""] = dataUrl.split(",", 2);
  const mime = /data:([^;]+)/.exec(meta)?.[1] || "application/octet-stream";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function putAttachment(id: string, record: StoredAttachment): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE_NAME, "readwrite");
    tx.objectStore(ATTACHMENT_STORE_NAME).put(record, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAttachment(id: string): Promise<StoredAttachment | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE_NAME, "readonly");
    const request = tx.objectStore(ATTACHMENT_STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as StoredAttachment | undefined) || null);
    request.onerror = () => reject(request.error);
  });
}

async function externalizeCredentialAttachments(state: VaultState): Promise<VaultState> {
  if (typeof indexedDB === "undefined") return state;
  const credentials: Credential[] = [];
  for (const credential of state.credentials) {
    const source = credential.attachmentDataUrl || credential.imageDataUrl;
    if (!source?.startsWith("data:")) {
      credentials.push(credential);
      continue;
    }
    const attachmentId = attachmentIdFor(credential);
    try {
      const blob = dataUrlToBlob(source);
      await putAttachment(attachmentId, {
        blob,
        name: credential.attachmentName || "credential",
        type: credential.attachmentType || blob.type || "application/octet-stream",
        updatedAt: new Date().toISOString(),
      });
      credentials.push({ ...credential, attachmentId });
    } catch {
      credentials.push(credential);
    }
  }
  return { ...state, credentials };
}

function stripRuntimeAttachmentData(state: VaultState): VaultState {
  return {
    ...state,
    credentials: state.credentials.map((credential) => {
      const hasExternalAttachment = Boolean(credential.attachmentId || credential.attachmentDataUrl || credential.imageDataUrl);
      if (!hasExternalAttachment) return credential;
      const attachmentId = attachmentIdFor(credential);
      return {
        ...credential,
        attachmentId,
        imageDataUrl: undefined,
        attachmentDataUrl: undefined,
      };
    }),
  };
}

async function hydrateCredentialAttachments(state: VaultState): Promise<VaultState> {
  if (typeof indexedDB === "undefined") return state;
  const credentials: Credential[] = [];
  for (const credential of state.credentials) {
    if (credential.attachmentDataUrl || credential.imageDataUrl || !credential.attachmentId) {
      credentials.push(credential);
      continue;
    }
    try {
      const record = await getAttachment(credential.attachmentId);
      if (!record) {
        credentials.push(credential);
        continue;
      }
      const dataUrl = await blobToDataUrl(record.blob);
      credentials.push({
        ...credential,
        attachmentDataUrl: dataUrl,
        imageDataUrl: record.type.startsWith("image/") ? dataUrl : undefined,
        attachmentName: credential.attachmentName || record.name,
        attachmentType: credential.attachmentType || record.type,
      });
    } catch {
      credentials.push(credential);
    }
  }
  return { ...state, credentials };
}

async function pruneUnusedAttachments(state: VaultState): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const referenced = new Set(state.credentials
    .filter((credential) => credential.attachmentId || credential.attachmentDataUrl || credential.imageDataUrl)
    .map((credential) => attachmentIdFor(credential)));
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE_NAME, "readwrite");
    const store = tx.objectStore(ATTACHMENT_STORE_NAME);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      for (const key of request.result) {
        const id = String(key);
        if (!referenced.has(id)) store.delete(key);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetRaw(): Promise<VaultState | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve(request.result ? request.result as VaultState : null);
    request.onerror = () => reject(request.error);
  });
}

async function idbSetRaw(state: VaultState): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(stripRuntimeAttachmentData(normalizeState(state)), STATE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function prepareLocalState(value: Partial<VaultState>): Promise<VaultState> {
  const normalized = normalizeState(value);
  const externalized = await externalizeCredentialAttachments(normalized);
  await idbSetRaw(externalized).catch(() => undefined);
  await pruneUnusedAttachments(externalized).catch(() => undefined);
  return hydrateCredentialAttachments(externalized);
}

export async function loadVaultState(): Promise<VaultState> {
  try {
    const current = await idbGetRaw();
    if (current) return await prepareLocalState(current);
  } catch {
    // Fall through to migration/local fallback.
  }

  if (typeof localStorage !== "undefined") {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy) as Partial<VaultState>;
        return await prepareLocalState(parsed);
      } catch {
        // Ignore malformed legacy data.
      }
    }
  }
  return emptyState();
}

export async function saveVaultState(state: VaultState): Promise<void> {
  const next = normalizeState({ ...state, updatedAt: new Date().toISOString() });
  try {
    const externalized = await externalizeCredentialAttachments(next);
    await idbSetRaw(externalized);
    await pruneUnusedAttachments(externalized).catch(() => undefined);
  } catch {
    if (typeof localStorage !== "undefined") localStorage.setItem(LEGACY_KEY, JSON.stringify(stripRuntimeAttachmentData(next)));
  }
}

export function createBackup(state: VaultState): string {
  return JSON.stringify({ kind: "CAREERVAULT_BACKUP_V4", exportedAt: new Date().toISOString(), state: normalizeState(state) }, null, 2);
}

export function parseBackup(text: string): VaultState {
  const parsed = JSON.parse(text) as { kind?: string; state?: Partial<VaultState> } | Partial<VaultState>;
  if ("kind" in parsed && ["CAREERVAULT_BACKUP_V4", "CAREERVAULT_BACKUP_V3", "CAREERVAULT_BACKUP_V2"].includes(parsed.kind || "") && parsed.state) {
    return normalizeState(parsed.state);
  }
  return normalizeState(parsed as Partial<VaultState>);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  const raw = await fileToDataUrl(file);
  if (!file.type.startsWith("image/")) return raw;

  // Preserve original pixels for ordinary document photos. Small text, seals and
  // dates are much less reliable after aggressive 1800px downscaling.
  // 2.6 MB stays below a typical serverless request limit after base64 expansion.
  if (file.size <= 2.6 * 1024 * 1024) return raw;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = raw;
  });
  const max = 2400;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.93);
}
