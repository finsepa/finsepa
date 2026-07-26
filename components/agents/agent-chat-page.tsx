"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { AgentChatHistoryHeader } from "@/components/agents/agent-chat-history-header";
import { AgentMessageContent } from "@/components/agents/agent-message-content";
import { secondaryOutlineButtonClassName } from "@/components/design-system";
import { MOBILE_PANEL_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import { Spinner } from "@/components/ui/spinner";
import { deriveAgentThreadTitle } from "@/lib/agents/agent-thread-title";
import type { AgentThreadSummary } from "@/lib/agents/agent-thread-types";
import { ArrowDown, MessageCircle, Send, StopSolid } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ChatRole = "user" | "assistant";
type ChatMessage = { id: string; role: ChatRole; content: string };
type QueuedRequest = { id: string; text: string };

const MAX_QUEUED_REQUESTS = 5;

/** Keep in sync with `AGENT_USAGE_LIMIT_MESSAGE` in lib/agents/agent-caps.ts */
const AGENT_USAGE_LIMIT_MESSAGE =
  "You've reached your Agent usage limit. Please try again later.";

const EMPTY_SUGGESTIONS = [
  "What can you help with?",
  "Show my watchlist",
  "Summarize my portfolio",
] as const;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ThinkingLabel() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % 4);
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="inline-flex text-[16px] font-normal leading-6 text-[#141414]" aria-live="polite">
      Thinking
      <span className="inline-block w-[1.25em] text-left" aria-hidden>
        {".".repeat(step)}
      </span>
    </span>
  );
}

export function AgentChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinUserMessageId, setPinUserMessageId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedRequest[]>([]);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const [threads, setThreads] = useState<AgentThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadTitle, setThreadTitle] = useState("New chat");
  const [loadingThread, setLoadingThread] = useState(false);
  const [usageBlocked, setUsageBlocked] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const threadIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const loadingThreadRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const queueRef = useRef<QueuedRequest[]>([]);
  const threadTitleRef = useRef(threadTitle);
  const inputRef = useRef(input);

  useEffect(() => {
    threadIdRef.current = threadId;
  }, [threadId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    threadTitleRef.current = threadTitle;
  }, [threadTitle]);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    loadingThreadRef.current = loadingThread;
  }, [loadingThread]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function refreshThreads(): Promise<AgentThreadSummary[]> {
    try {
      const res = await fetch("/api/agents/threads");
      if (!res.ok) return threads;
      const data = (await res.json()) as { threads?: AgentThreadSummary[] };
      const next = Array.isArray(data.threads) ? data.threads : [];
      setThreads(next);
      return next;
    } catch {
      return threads;
    } finally {
      setThreadsLoading(false);
    }
  }

  useEffect(() => {
    void refreshThreads();
    void (async () => {
      try {
        const res = await fetch("/api/agents/usage");
        if (!res.ok) return;
        const data = (await res.json()) as { blocked?: boolean; message?: string | null };
        if (data.blocked) {
          setUsageBlocked(true);
          setError(data.message?.trim() || AGENT_USAGE_LIMIT_MESSAGE);
        }
      } catch {
        /* ignore — chat API still enforces */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  /** Linear-style: pin the latest user question near the top of the transcript viewport. */
  useLayoutEffect(() => {
    if (!pinUserMessageId) return;
    const scroller = scrollRef.current;
    const spacer = spacerRef.current;
    const el = scroller?.querySelector(
      `[data-message-id="${CSS.escape(pinUserMessageId)}"]`,
    ) as HTMLElement | null;
    if (!scroller || !el || !spacer) return;

    spacer.style.minHeight = `${Math.max(0, scroller.clientHeight - el.offsetHeight - 16)}px`;

    const scrollerRect = scroller.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    scroller.scrollTop += elRect.top - scrollerRect.top;
  }, [pinUserMessageId, messages.length]);

  /** Show “Latest” when the newest message is scrolled out of view. */
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    function updateJumpVisibility() {
      const root = scrollRef.current;
      if (!root) return;
      const nodes = root.querySelectorAll<HTMLElement>("[data-message-id]");
      const last = nodes[nodes.length - 1];
      if (!last) {
        setShowJumpToLatest(false);
        return;
      }
      const rootRect = root.getBoundingClientRect();
      const lastRect = last.getBoundingClientRect();
      const visible =
        lastRect.bottom > rootRect.top + 12 && lastRect.top < rootRect.bottom - 12;
      setShowJumpToLatest(!visible);
    }

    updateJumpVisibility();
    scroller.addEventListener("scroll", updateJumpVisibility, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateJumpVisibility) : null;
    ro?.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", updateJumpVisibility);
      ro?.disconnect();
    };
  }, [messages.length, loadingThread, pinUserMessageId]);

  function scrollToLatest() {
    const scroller = scrollRef.current;
    if (!scroller) return;
    setPinUserMessageId(null);
    if (spacerRef.current) spacerRef.current.style.minHeight = "0px";
    const nodes = scroller.querySelectorAll<HTMLElement>("[data-message-id]");
    const last = nodes[nodes.length - 1];
    if (last) {
      last.scrollIntoView({ block: "end", behavior: "smooth" });
    } else {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    }
  }

  function clearQueue() {
    queueRef.current = [];
    setQueue([]);
  }

  function resetToNewChat() {
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setBusy(false);
    messagesRef.current = [];
    setMessages([]);
    setInput("");
    setError(null);
    setPinUserMessageId(null);
    setShowJumpToLatest(false);
    clearQueue();
    threadIdRef.current = null;
    setThreadId(null);
    threadTitleRef.current = "New chat";
    setThreadTitle("New chat");
    loadingThreadRef.current = false;
    setLoadingThread(false);
  }

  async function createAgentThread(): Promise<string | null> {
    try {
      const res = await fetch("/api/agents/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New chat" }),
      });
      if (!res.ok) {
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) return Promise.reject(new Error(data.error));
        } catch {
          /* ignore parse */
        }
        return null;
      }
      const data = (await res.json()) as { thread?: AgentThreadSummary };
      if (!data.thread?.id) return null;
      threadIdRef.current = data.thread.id;
      setThreadId(data.thread.id);
      threadTitleRef.current = data.thread.title || "New chat";
      setThreadTitle(data.thread.title || "New chat");
      setThreads((prev) => [data.thread!, ...prev.filter((t) => t.id !== data.thread!.id)]);
      return data.thread.id;
    } catch (e) {
      if (e instanceof Error && e.message) throw e;
      return null;
    }
  }

  async function ensureThreadId(forceNew = false): Promise<string | null> {
    if (!forceNew && threadIdRef.current) return threadIdRef.current;
    return createAgentThread();
  }

  async function selectThread(id: string) {
    if (id === threadIdRef.current && messages.length > 0) return;
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setBusy(false);
    setError(null);
    setPinUserMessageId(null);
    setInput("");
    clearQueue();
    setLoadingThread(true);
    setThreadId(id);
    threadIdRef.current = id;

    try {
      const res = await fetch(`/api/agents/threads/${id}/messages`);
      if (!res.ok) {
        setError("Could not load chat.");
        setMessages([]);
        return;
      }
      const data = (await res.json()) as {
        thread?: AgentThreadSummary;
        messages?: Array<{ id: string; role: ChatRole; content: string }>;
      };
      setThreadTitle(data.thread?.title?.trim() || "New chat");
      setMessages(
        (data.messages ?? [])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id || newId(),
            role: m.role,
            content: m.content,
          })),
      );
    } catch {
      setError("Could not load chat.");
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }

  async function renameThread(id: string, title: string) {
    const res = await fetch(`/api/agents/threads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      toast.error("Couldn’t rename chat.");
      return;
    }
    const data = (await res.json()) as { thread?: AgentThreadSummary };
    const nextTitle = data.thread?.title?.trim() || title;
    setThreads((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: nextTitle, updated_at: data.thread?.updated_at ?? t.updated_at } : t)),
    );
    if (threadIdRef.current === id) setThreadTitle(nextTitle);
    toast.success("Chat renamed.");
  }

  async function deleteThread(id: string) {
    const res = await fetch(`/api/agents/threads/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Couldn’t delete chat.");
      return;
    }
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (threadIdRef.current === id) resetToNewChat();
    toast.success("Chat deleted.");
  }

  function enqueueRequest(text: string): boolean {
    if (queueRef.current.length >= MAX_QUEUED_REQUESTS) {
      setError(`You can stack up to ${MAX_QUEUED_REQUESTS} requests.`);
      return false;
    }
    const item: QueuedRequest = { id: newId(), text };
    const next = [...queueRef.current, item];
    queueRef.current = next;
    setQueue(next);
    setError(null);
    return true;
  }

  function removeQueuedRequest(id: string) {
    const next = queueRef.current.filter((q) => q.id !== id);
    queueRef.current = next;
    setQueue(next);
    setError(null);
  }

  function drainNextQueuedRequest() {
    const [next, ...rest] = queueRef.current;
    if (!next) return;
    queueRef.current = rest;
    setQueue(rest);
    void runTurn(next.text);
  }

  /** Public entry: send now, or stack while a turn is in flight. */
  async function send(overrideText?: string) {
    const text = (overrideText ?? inputRef.current).trim();
    if (!text || loadingThreadRef.current || usageBlocked) return;

    if (busyRef.current) {
      if (!enqueueRequest(text)) return;
      if (overrideText == null) setInput("");
      return;
    }

    setInput("");
    await runTurn(text, false);
  }

  /** Default empty screen: always create a brand-new thread, then send. */
  async function startChatFromEmpty(overrideText?: string) {
    const text = (overrideText ?? inputRef.current).trim();
    if (!text || usageBlocked) return;

    // Clear any stuck in-flight / queued state from a prior turn.
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setBusy(false);
    clearQueue();
    setError(null);
    setShowJumpToLatest(false);
    setPinUserMessageId(null);
    setInput("");
    inputRef.current = "";

    threadIdRef.current = null;
    setThreadId(null);
    threadTitleRef.current = "New chat";
    setThreadTitle("New chat");
    messagesRef.current = [];
    setMessages([]);

    await runTurn(text, true);
  }

  async function runTurn(text: string, forceNewThread = false) {
    if (!forceNewThread && (busyRef.current || loadingThreadRef.current)) return;
    if (forceNewThread) {
      busyRef.current = false;
    }

    setError(null);

    let activeThreadId: string | null = null;
    try {
      activeThreadId = await ensureThreadId(forceNewThread);
    } catch (e) {
      const message = e instanceof Error && e.message ? e.message : "Could not start a chat. Try again.";
      setError(message);
      toast.error(message);
      setInput(text);
      inputRef.current = text;
      return;
    }
    if (!activeThreadId) {
      const message = "Could not start a chat. Try again.";
      setError(message);
      toast.error(message);
      setInput(text);
      inputRef.current = text;
      return;
    }

    const prior = messagesRef.current;
    // Optimistic title from first user message
    if (prior.length === 0 || threadTitleRef.current === "New chat") {
      const nextTitle = deriveAgentThreadTitle(text);
      setThreadTitle(nextTitle);
      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeThreadId
            ? { ...t, title: nextTitle, updated_at: new Date().toISOString() }
            : t,
        ),
      );
    }

    const userMsg: ChatMessage = { id: newId(), role: "user", content: text };
    const assistantId = newId();
    const nextMessages = [...prior, userMsg];
    messagesRef.current = [...nextMessages, { id: assistantId, role: "assistant", content: "" }];
    setMessages(messagesRef.current);
    setPinUserMessageId(userMsg.id);
    busyRef.current = true;
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: activeThreadId,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let message = "Something went wrong. Try again.";
        let code: string | undefined;
        try {
          const data = (await res.json()) as { error?: string; code?: string };
          if (data.error) message = data.error;
          code = data.code;
        } catch {
          /* ignore */
        }
        if (code === "MONTHLY_LIMIT") {
          setUsageBlocked(true);
          message = AGENT_USAGE_LIMIT_MESSAGE;
        }
        setError(message);
        const rolled = messagesRef.current.filter((m) => m.id !== assistantId && m.id !== userMsg.id);
        messagesRef.current = rolled;
        setMessages(rolled);
        return;
      }

      if (!res.body) {
        setError("Empty response from Agent.");
        const rolled = messagesRef.current.filter((m) => m.id !== assistantId && m.id !== userMsg.id);
        messagesRef.current = rolled;
        setMessages(rolled);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const snapshot = acc;
        messagesRef.current = messagesRef.current.map((m) =>
          m.id === assistantId ? { ...m, content: snapshot } : m,
        );
        setMessages(messagesRef.current);
      }

      void refreshThreads().then((list) => {
        const t = list.find((x) => x.id === activeThreadId);
        if (t?.title) setThreadTitle(t.title);
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        const next = messagesRef.current.filter((m) => !(m.id === assistantId && !m.content.trim()));
        messagesRef.current = next;
        setMessages(next);
        return;
      }
      setError("Network error. Try again.");
      const rolled = messagesRef.current.filter((m) => m.id !== assistantId && m.id !== userMsg.id);
      messagesRef.current = rolled;
      setMessages(rolled);
    } finally {
      busyRef.current = false;
      setBusy(false);
      abortRef.current = null;
      drainNextQueuedRequest();
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const isDefaultEmpty = !loadingThread && messages.length === 0;
  const recentThreads = threads.slice(0, 5);

  function renderComposer(opts?: { fromEmpty?: boolean }) {
    const fromEmpty = Boolean(opts?.fromEmpty);
    return (
      <form
        className={cn(MOBILE_PANEL_CARD_CLASS, "relative z-10 p-2")}
        onSubmit={(e) => {
          e.preventDefault();
          if (usageBlocked) return;
          if (fromEmpty) void startChatFromEmpty();
          else void send();
        }}
      >
        <textarea
          value={input}
          onChange={(e) => {
            inputRef.current = e.target.value;
            setInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.stopPropagation();
              if (usageBlocked) return;
              if (fromEmpty) void startChatFromEmpty();
              else void send();
            }
          }}
          rows={2}
          placeholder={
            usageBlocked
              ? "Agent usage limit reached"
              : busy
                ? "Stack a follow-up…"
                : "Ask Finsepa…"
          }
          disabled={loadingThread || usageBlocked}
          className="w-full resize-none bg-transparent px-2 py-2 text-[16px] font-normal leading-6 text-[#141414] outline-none placeholder:text-[#A1A1AA] disabled:opacity-60"
        />
        <div className="flex items-center justify-end gap-2 px-1 pb-1">
          {busy ? (
            <>
              {input.trim() ? (
                <button
                  type="submit"
                  className="inline-flex size-9 items-center justify-center rounded-full bg-[#141414] text-white"
                  aria-label="Stack request"
                >
                  <Send className="size-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={stop}
                className="inline-flex size-9 items-center justify-center rounded-full bg-[#141414] text-white"
                aria-label="Stop"
              >
                <StopSolid className="size-4" />
              </button>
            </>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || loadingThread || usageBlocked}
              className="inline-flex size-9 items-center justify-center rounded-full bg-[#141414] text-white disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="size-4" />
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col bg-[#FCFCFD]",
        "h-[calc(var(--app-vh)-var(--mobile-topbar-offset,0px)-var(--mobile-bottom-nav-main-clearance,0px))] max-md:min-h-0",
        "md:h-full md:min-h-0",
      )}
    >
      <AgentChatHistoryHeader
        title={threadTitle}
        threads={threads}
        activeThreadId={threadId}
        threadsLoading={threadsLoading}
        disabled={busy}
        showBar={!isDefaultEmpty}
        onNewChat={resetToNewChat}
        onSelectThread={(id) => void selectThread(id)}
        onRenameThread={(id, title) => renameThread(id, title)}
        onDeleteThread={(id) => deleteThread(id)}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        {isDefaultEmpty ? (
          <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-4 sm:px-6">
            <div className="w-full max-w-[820px]">
              {error ? (
                <div
                  role="alert"
                  className={cn(
                    MOBILE_PANEL_CARD_CLASS,
                    "mb-3 border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#991B1B]",
                  )}
                >
                  {error}
                </div>
              ) : null}
              {renderComposer({ fromEmpty: true })}
              <div className="relative z-10 mt-3 flex flex-wrap justify-center gap-2">
                {EMPTY_SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={secondaryOutlineButtonClassName}
                    disabled={usageBlocked}
                    onClick={() => void startChatFromEmpty(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>

              {recentThreads.length > 0 ? (
                <div className="mx-auto mt-10 w-full max-w-[420px]">
                  <p className="mb-2 text-[13px] font-medium leading-5 text-[#A1A1AA]">Recents</p>
                  <ul className="flex flex-col gap-0.5">
                    {recentThreads.map((thread) => (
                      <li key={thread.id}>
                        <button
                          type="button"
                          onClick={() => void selectThread(thread.id)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm leading-5 text-[#52525B] transition-colors hover:bg-[#F4F4F5] hover:text-[#141414]"
                        >
                          <MessageCircle className="size-4 shrink-0 text-[#A1A1AA]" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">
                            {thread.title.trim() || "New chat"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
            >
              <div className="mx-auto flex min-h-full w-full max-w-[820px] flex-col gap-4 px-4 py-6 pb-8 sm:px-6">
                {loadingThread ? (
                  <div className="flex flex-1 items-center justify-center">
                    <Spinner className="size-5 text-[#71717A]" />
                  </div>
                ) : (
                  <>
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        data-message-id={m.id}
                        className={cn(
                          "flex",
                          m.role === "user" ? "justify-end" : "justify-start",
                          m.id === pinUserMessageId && "pt-6",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[85%]",
                            m.role === "user"
                              ? "inline-flex min-h-10 items-center whitespace-pre-wrap rounded-lg bg-[#F1F1F2] px-3 py-2 text-[16px] font-normal leading-5 text-[#141414]"
                              : null,
                          )}
                        >
                          {m.role === "user" ? (
                            m.content
                          ) : m.content ? (
                            <AgentMessageContent content={m.content} />
                          ) : busy ? (
                            <ThinkingLabel />
                          ) : (
                            ""
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={spacerRef} aria-hidden className="shrink-0" />
                  </>
                )}
              </div>
            </div>

            <div className="relative shrink-0 bg-[#FCFCFD]">
              <div
                className={cn(
                  "pointer-events-none absolute inset-x-0 bottom-full h-10 bg-gradient-to-t from-[#FCFCFD] to-transparent transition-opacity duration-150",
                  showJumpToLatest ? "opacity-100" : "opacity-0",
                )}
                aria-hidden
              />
              {showJumpToLatest ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-full z-10 mb-2 flex justify-center">
                  <button
                    type="button"
                    onClick={scrollToLatest}
                    className={cn(
                      secondaryOutlineButtonClassName,
                      "pointer-events-auto h-8 gap-1.5 rounded-full px-3 text-[13px] font-medium shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)]",
                    )}
                  >
                    <ArrowDown className="size-3.5" aria-hidden />
                    Latest
                  </button>
                </div>
              ) : null}

              <div className="pb-4 pt-3">
                <div className="mx-auto w-full max-w-[820px] px-4 sm:px-6">
                  {error ? (
                    <div
                      role="alert"
                      className={cn(
                        MOBILE_PANEL_CARD_CLASS,
                        "mb-3 border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#991B1B]",
                      )}
                    >
                      {error}
                    </div>
                  ) : null}

                  {queue.length > 0 ? (
                    <div
                      className="mb-2 rounded-2xl bg-[#F1F1F2] px-3 py-2"
                      aria-label={`${queue.length} stacked ${queue.length === 1 ? "request" : "requests"}`}
                    >
                      <ul className="flex flex-col gap-1">
                        {queue.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => removeQueuedRequest(item.id)}
                              className="flex w-full items-start gap-2 rounded-lg px-1 py-0.5 text-left text-[13px] leading-5 text-[#71717A] transition-colors hover:bg-[#E4E4E7]/70 hover:text-[#141414]"
                              title="Remove from queue"
                            >
                              <span className="shrink-0 select-none text-[#A1A1AA]" aria-hidden>
                                ↳
                              </span>
                              <span className="min-w-0 flex-1 truncate">{item.text}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {renderComposer()}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
