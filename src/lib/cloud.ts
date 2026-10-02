import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { loadVaultState } from "@/lib/persistence";
import type { VaultState } from "@/lib/types";

let client: SupabaseClient | null | undefined;

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return { url, key };
}

export function isCloudConfigured(): boolean {
  const { url, key } = getConfig();
  return Boolean(url && key);
}

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const { url, key } = getConfig();
  client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
  return client;
}

export async function getCloudUser(): Promise<User | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

export async function sendMagicLink(email: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("云同步尚未配置");
  const redirectTo = typeof window !== "undefined" ? window.location.href.split("#")[0].split("?")[0] : undefined;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (error) throw error;
}

export async function signOutCloud(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

function formatTime(value: string | null | undefined): string {
  const parsed = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return "未知时间";
  return new Date(parsed).toLocaleString();
}

export async function saveVaultToCloud(userId: string, state: VaultState): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("云同步尚未配置");

  const { data: existing, error: readError } = await supabase
    .from("career_vaults")
    .select("updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;

  const remoteTime = existing?.updated_at ? Date.parse(existing.updated_at) : Number.NaN;
  const localTime = state.updatedAt ? Date.parse(state.updatedAt) : Number.NaN;
  if (Number.isFinite(remoteTime) && Number.isFinite(localTime) && remoteTime > localTime + 1000) {
    throw new Error(`检测到云端版本比当前浏览器更新（云端：${formatTime(existing?.updated_at)}；本地：${formatTime(state.updatedAt)}）。为避免覆盖新数据，请先从云端恢复并核对。`);
  }

  const { error } = await supabase
    .from("career_vaults")
    .upsert({ user_id: userId, payload: state, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function loadVaultFromCloud(userId: string): Promise<VaultState | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("career_vaults")
    .select("payload, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  const remote = (data?.payload as VaultState | undefined) || null;
  if (!remote) return null;

  const local = await loadVaultState().catch(() => null);
  const remoteTimestamp = data?.updated_at || remote.updatedAt;
  const remoteTime = remoteTimestamp ? Date.parse(remoteTimestamp) : Number.NaN;
  const localTime = local?.updatedAt ? Date.parse(local.updatedAt) : Number.NaN;

  if (typeof window !== "undefined" && Number.isFinite(remoteTime) && Number.isFinite(localTime)) {
    if (localTime > remoteTime + 1000) {
      const confirmed = window.confirm(
        `当前浏览器的数据比云端更新。\n\n本地：${formatTime(local?.updatedAt)}\n云端：${formatTime(remoteTimestamp)}\n\n继续恢复会用较旧的云端版本覆盖本地新数据。建议先导出本地备份。仍要继续吗？`,
      );
      if (!confirmed) throw new Error("已取消云端恢复：本地版本更新，没有覆盖任何数据。");
    } else if (remoteTime > localTime + 1000) {
      const confirmed = window.confirm(
        `云端数据比当前浏览器更新。\n\n云端：${formatTime(remoteTimestamp)}\n本地：${formatTime(local?.updatedAt)}\n\n恢复后会用云端新版本替换当前本地版本。是否继续？`,
      );
      if (!confirmed) throw new Error("已取消云端恢复，没有覆盖任何数据。");
    } else {
      const confirmed = window.confirm("本地与云端更新时间接近。恢复仍会覆盖当前浏览器中的档案、经历、证书和 JD。确定继续吗？");
      if (!confirmed) throw new Error("已取消云端恢复，没有覆盖任何数据。");
    }
  }

  return remote;
}
