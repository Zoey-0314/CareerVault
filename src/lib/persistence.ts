import type { VaultState } from "@/lib/types";

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
    version: 2,
    profile: { name: "", email: "", phone: "", city: "", school: "", major: "", degree: "", graduation: "" },
    experiences: [],
    credentials: [],
    jd: "",
    updatedAt: new Date().toISOString(),
  };
}

function normalizeState(value: Partial<VaultState> | null | undefined): VaultState {
  const base = emptyState();
  return {
    ...base,
    ...value,
    version: 2,
    profile: { ...base.profile, ...(value?.profile || {}) },
    experiences: Array.isArray(value?.experiences) ? value!.experiences! : [],
    credentials: Array.isArray(value?.credentials) ? value!.credentials! : [],
    jd: typeof value?.jd === "string" ? value.jd : "",
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
  return JSON.stringify({ kind: "CAREERVAULT_BACKUP_V2", exportedAt: new Date().toISOString(), state: normalizeState(state) }, null, 2);
}

export function parseBackup(text: string): VaultState {
  const parsed = JSON.parse(text) as { kind?: string; state?: Partial<VaultState> } | Partial<VaultState>;
  if ("kind" in parsed && parsed.kind === "CAREERVAULT_BACKUP_V2" && parsed.state) return normalizeState(parsed.state);
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

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = raw;
  });
  const max = 1800;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}
