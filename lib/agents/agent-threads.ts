import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { deriveAgentThreadTitle } from "@/lib/agents/agent-thread-title";
import type {
  AgentStoredMessage,
  AgentThreadSummary,
} from "@/lib/agents/agent-thread-types";

export type AgentThreadRow = AgentThreadSummary;
export type AgentMessageRow = AgentStoredMessage;

const TITLE_MAX = 80;

export function sanitizeAgentThreadTitle(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return "New chat";
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1)}…` : t;
}

export async function listAgentThreads(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<AgentThreadRow[]> {
  const { data, error } = await supabase
    .from("agent_threads")
    .select("id,title,created_at,updated_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentThreadRow[];
}

export async function createAgentThread(
  supabase: SupabaseClient,
  userId: string,
  title = "New chat",
): Promise<AgentThreadRow> {
  const { data, error } = await supabase
    .from("agent_threads")
    .insert({
      user_id: userId,
      title: sanitizeAgentThreadTitle(title),
    })
    .select("id,title,created_at,updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data as AgentThreadRow;
}

export async function getAgentThread(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
): Promise<AgentThreadRow | null> {
  const { data, error } = await supabase
    .from("agent_threads")
    .select("id,title,created_at,updated_at")
    .eq("user_id", userId)
    .eq("id", threadId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AgentThreadRow | null) ?? null;
}

export async function renameAgentThread(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  title: string,
): Promise<AgentThreadRow> {
  const { data, error } = await supabase
    .from("agent_threads")
    .update({
      title: sanitizeAgentThreadTitle(title),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", threadId)
    .is("deleted_at", null)
    .select("id,title,created_at,updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data as AgentThreadRow;
}

export async function softDeleteAgentThread(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("agent_threads")
    .update({ deleted_at: now, updated_at: now })
    .eq("user_id", userId)
    .eq("id", threadId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
}

export async function listAgentMessages(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
): Promise<AgentMessageRow[]> {
  const thread = await getAgentThread(supabase, userId, threadId);
  if (!thread) return [];

  const { data, error } = await supabase
    .from("agent_messages")
    .select("id,thread_id,role,content,created_at,seq")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("seq", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentMessageRow[];
}

export async function appendAgentMessages(
  supabase: SupabaseClient,
  args: {
    userId: string;
    threadId: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    /** When true and thread still has default title, set from first user message. */
    autoTitleFromFirstUserMessage?: boolean;
  },
): Promise<void> {
  if (args.messages.length === 0) return;

  const thread = await getAgentThread(supabase, args.userId, args.threadId);
  if (!thread) throw new Error("Thread not found.");

  const { data: lastRows, error: lastErr } = await supabase
    .from("agent_messages")
    .select("seq")
    .eq("thread_id", args.threadId)
    .order("seq", { ascending: false })
    .limit(1);
  if (lastErr) throw new Error(lastErr.message);
  let seq = (lastRows?.[0]?.seq ?? 0) + 1;

  const rows = args.messages.map((m) => {
    const row = {
      thread_id: args.threadId,
      user_id: args.userId,
      role: m.role,
      content: m.content,
      seq,
    };
    seq += 1;
    return row;
  });

  const { error: insertErr } = await supabase.from("agent_messages").insert(rows);
  if (insertErr) throw new Error(insertErr.message);

  const patch: { updated_at: string; title?: string } = {
    updated_at: new Date().toISOString(),
  };

  if (args.autoTitleFromFirstUserMessage) {
    const firstUser = args.messages.find((m) => m.role === "user" && m.content.trim());
    const isDefaultTitle =
      !thread.title.trim() ||
      thread.title === "New chat" ||
      /^new chat$/i.test(thread.title);
    if (firstUser && isDefaultTitle) {
      patch.title = deriveAgentThreadTitle(firstUser.content);
    }
  }

  const { error: updErr } = await supabase
    .from("agent_threads")
    .update(patch)
    .eq("id", args.threadId)
    .eq("user_id", args.userId);
  if (updErr) throw new Error(updErr.message);
}
