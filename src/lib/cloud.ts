import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
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
    throw new Error("检测到云端版本比当前浏览器更新。为避免覆盖新数据，请先导出本地备份，再从云端恢复并核对后重新同步。");
  }

  const { error } = await supabase
    .from("career_vaults")
    .upsert({ user_id: userId, payload: state, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function loadVaultFromCloud(userId: string): Promise<VaultState | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("career_vaults").select("payload").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data?.payload as VaultState | undefined) || null;
}
