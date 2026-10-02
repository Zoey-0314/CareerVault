import { normalizeExperienceV3 } from "@/lib/experienceModel";
import { legacyTargetFromJd, normalizeJobTarget } from "@/lib/jobApplication";
import type { ResumeVersion, VaultState } from "@/lib/types";

const DB_NAME = "careervault";
const STORE_NAME = "vault";
const STATE_KEY = "state-v2";
const LEGACY_KEY = "careervault-v1";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
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

async function idbGet(): Promise<VaultState | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve(request.result ? normalizeState(request.result as VaultState) : null);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(state: VaultState): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(normalizeState(state), STATE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadVaultState(): Promise<VaultState> {
  try {
    const current = await idbGet();
    if (current) return current;
  } catch {
    // Fall through to migration/local fallback.
  }

  if (typeof localStorage !== "undefined") {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy) as Partial<VaultState>;
        const migrated = normalizeState(parsed);
        await idbSet(migrated).catch(() => undefined);
        return migrated;
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
    await idbSet(next);
  } catch {
    if (typeof localStorage !== "undefined") localStorage.setItem(LEGACY_KEY, JSON.stringify(next));
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
