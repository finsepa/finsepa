"use client";

import { useEffect, useId, useRef, useState } from "react";

import { DropdownMenuLottieIcon } from "@/components/icons/dropdown-menu-lottie-icon";
import {
  dropdownMenuOverlayScrollbarClassName,
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { ClearableInput } from "@/components/layout/clearable-input";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { STOCK_OVERVIEW_SECTION_HEADING_CLASS } from "@/components/design-system/card-surface-styles";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalDangerButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import { Spinner } from "@/components/ui/spinner";
import {
  relativeThreadTimeLabel,
  threadTimeGroup,
  type ThreadTimeGroup,
} from "@/lib/agents/agent-thread-title";
import type { AgentThreadSummary } from "@/lib/agents/agent-thread-types";
import { ChevronDown, MoreHorizontal, Plus } from "@/lib/icons";
import { deleteMenuIconAnimation, renameMenuIconAnimation } from "@/lib/lottie/watchlist-menu-animations";
import { cn } from "@/lib/utils";

type ModalStep = "closed" | "rename" | "deleteConfirm";

const GROUP_ORDER: ThreadTimeGroup[] = ["Today", "Yesterday", "Last week", "Older"];

function groupThreads(threads: AgentThreadSummary[]) {
  const map = new Map<ThreadTimeGroup, AgentThreadSummary[]>();
  for (const t of threads) {
    const g = threadTimeGroup(t.updated_at);
    const list = map.get(g);
    if (list) list.push(t);
    else map.set(g, [t]);
  }
  return GROUP_ORDER.flatMap((label) => {
    const items = map.get(label);
    return items?.length ? [{ label, items }] : [];
  });
}

export function AgentChatHistoryHeader({
  title,
  threads,
  activeThreadId,
  threadsLoading,
  disabled,
  /** When false, hide the full title bar (empty / default Agent screen). */
  showBar = true,
  onNewChat,
  onSelectThread,
  onRenameThread,
  onDeleteThread,
}: {
  title: string;
  threads: AgentThreadSummary[];
  activeThreadId: string | null;
  threadsLoading?: boolean;
  disabled?: boolean;
  showBar?: boolean;
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  onRenameThread: (threadId: string, title: string) => Promise<void> | void;
  onDeleteThread: (threadId: string) => Promise<void> | void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [modalThread, setModalThread] = useState<AgentThreadSummary | null>(null);
  const [step, setStep] = useState<ModalStep>("closed");
  const [renameValue, setRenameValue] = useState("");
  const [renameIconPlaying, setRenameIconPlaying] = useState(false);
  const [deleteIconPlaying, setDeleteIconPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Avoid SSR/client mismatch for the empty-state history trigger. */
  const [chromeReady, setChromeReady] = useState(false);

  const chevronBtnRef = useRef<HTMLButtonElement>(null);
  const historyPortalRef = useRef<HTMLDivElement>(null);
  const headerMenuBtnRef = useRef<HTMLButtonElement>(null);
  const headerMenuPortalRef = useRef<HTMLDivElement>(null);
  const rowMenuBtnRef = useRef<HTMLButtonElement>(null);
  const rowMenuPortalRef = useRef<HTMLDivElement>(null);

  const renameTitleId = useId();
  const deleteTitleId = useId();

  const grouped = groupThreads(threads);
  const displayTitle = title.trim() || "New chat";
  const activeThread =
    (activeThreadId ? threads.find((t) => t.id === activeThreadId) : null) ??
    (activeThreadId
      ? ({
          id: activeThreadId,
          title: displayTitle,
          created_at: "",
          updated_at: "",
        } satisfies AgentThreadSummary)
      : null);
  const canManageActive = Boolean(activeThread);

  useEffect(() => {
    setChromeReady(true);
  }, []);

  useEffect(() => {
    if (step === "rename" && modalThread) setRenameValue(modalThread.title || displayTitle);
  }, [step, modalThread, displayTitle]);

  useEffect(() => {
    if (!historyOpen) setRowMenuId(null);
  }, [historyOpen]);

  useEffect(() => {
    if (!historyOpen && !headerMenuOpen && !rowMenuId) return;
    function onDocMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        chevronBtnRef.current?.contains(target) ||
        historyPortalRef.current?.contains(target) ||
        headerMenuBtnRef.current?.contains(target) ||
        headerMenuPortalRef.current?.contains(target) ||
        rowMenuBtnRef.current?.contains(target) ||
        rowMenuPortalRef.current?.contains(target)
      ) {
        return;
      }
      setHistoryOpen(false);
      setHeaderMenuOpen(false);
      setRowMenuId(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (rowMenuId) setRowMenuId(null);
      else if (headerMenuOpen) setHeaderMenuOpen(false);
      else setHistoryOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [historyOpen, headerMenuOpen, rowMenuId]);

  function closeModal() {
    setStep("closed");
    setModalThread(null);
    setSaving(false);
  }

  function openRename(thread: AgentThreadSummary) {
    setHeaderMenuOpen(false);
    setRowMenuId(null);
    setHistoryOpen(false);
    setModalThread(thread);
    setStep("rename");
  }

  function openDelete(thread: AgentThreadSummary) {
    setHeaderMenuOpen(false);
    setRowMenuId(null);
    setHistoryOpen(false);
    setModalThread(thread);
    setStep("deleteConfirm");
  }

  const renameEnabled = renameValue.trim().length > 0 && !saving;

  const ghostIconBtnClass = cn(
    "inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] text-[#71717A] transition-colors",
    "hover:bg-[#F4F4F5] hover:text-[#141414]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]/15",
  );

  const rowMenuThread = rowMenuId ? (threads.find((t) => t.id === rowMenuId) ?? null) : null;

  return (
    <>
      {showBar ? (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#EBEBEC] px-4 py-3 sm:px-9">
          <div className="flex min-w-0 max-w-[min(100%,28rem)] items-center gap-0.5">
            <h1 className={cn(STOCK_OVERVIEW_SECTION_HEADING_CLASS, "min-w-0 truncate")}>
              {displayTitle}
            </h1>
            <button
              ref={chevronBtnRef}
              type="button"
              disabled={disabled}
              aria-expanded={historyOpen}
              aria-haspopup="menu"
              aria-label="Chat history"
              onClick={() => {
                setHeaderMenuOpen(false);
                setHistoryOpen((o) => !o);
              }}
              className={cn(
                ghostIconBtnClass,
                historyOpen && "bg-[#F4F4F5] text-[#141414]",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <ChevronDown
                className={cn("size-4 transition-transform", historyOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            <button
              ref={headerMenuBtnRef}
              type="button"
              disabled={disabled || !canManageActive}
              aria-expanded={headerMenuOpen}
              aria-haspopup="menu"
              aria-label="Chat options"
              onClick={() => {
                setHistoryOpen(false);
                setRowMenuId(null);
                setHeaderMenuOpen((o) => !o);
              }}
              className={cn(
                ghostIconBtnClass,
                headerMenuOpen && "bg-[#F4F4F5] text-[#141414]",
                (disabled || !canManageActive) && "pointer-events-none opacity-40",
              )}
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </button>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setHistoryOpen(false);
              setHeaderMenuOpen(false);
              onNewChat();
            }}
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] text-[#141414] transition-colors",
              "hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]/15",
              disabled && "pointer-events-none opacity-60",
            )}
            aria-label="New chat"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </header>
      ) : chromeReady && threads.length > 0 ? (
        <div className="pointer-events-none absolute left-4 top-3 z-20 sm:left-9">
          <button
            ref={chevronBtnRef}
            type="button"
            disabled={disabled}
            aria-expanded={historyOpen}
            aria-haspopup="menu"
            aria-label="Chat history"
            onClick={() => {
              setHeaderMenuOpen(false);
              setHistoryOpen((o) => !o);
            }}
            className={cn(
              ghostIconBtnClass,
              "pointer-events-auto",
              historyOpen && "bg-[#F4F4F5] text-[#141414]",
              disabled && "pointer-events-none opacity-60",
            )}
          >
            <ChevronDown
              className={cn("size-4 transition-transform", historyOpen && "rotate-180")}
              aria-hidden
            />
          </button>
        </div>
      ) : null}

      <TopbarDropdownPortal
        open={historyOpen}
        anchorRef={chevronBtnRef}
        ref={historyPortalRef}
        align="leading"
        sheetTitle="Chats"
        onRequestClose={() => setHistoryOpen(false)}
        className="w-[min(calc(100vw-2rem),320px)]"
      >
        <div className={cn(dropdownMenuSurfaceClassName(), "overflow-hidden")}>
          <div className="p-1">
            <button
              type="button"
              role="menuitem"
              className={dropdownMenuPlainItemClassName()}
              onClick={() => {
                setHistoryOpen(false);
                onNewChat();
              }}
            >
              <Plus className="size-4 shrink-0 text-[#71717A]" aria-hidden />
              <span>New chat</span>
            </button>
          </div>

          <div
            className={cn(
              "max-h-[min(360px,50vh)] overflow-y-auto border-t border-[#F4F4F5] p-1",
              dropdownMenuOverlayScrollbarClassName,
            )}
          >
            {threadsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="size-5 text-[#71717A]" />
              </div>
            ) : grouped.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[#71717A]">No chats yet</p>
            ) : (
              grouped.map(({ label, items }) => (
                <div key={label} className="mb-1 last:mb-0">
                  <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-[#A1A1AA]">
                    {label}
                  </div>
                  {items.map((thread) => {
                    const selected = thread.id === activeThreadId;
                    const menuOpen = rowMenuId === thread.id;
                    return (
                      <div
                        key={thread.id}
                        className={cn(
                          "group relative flex items-center rounded-lg",
                          selected && "bg-[#F4F4F5]",
                          "hover:bg-[#F4F4F5]",
                        )}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className={cn(
                            "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm leading-5 text-[#141414]",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]/10",
                          )}
                          onClick={() => {
                            setHistoryOpen(false);
                            onSelectThread(thread.id);
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate">{thread.title || "New chat"}</span>
                          <span
                            className={cn(
                              "ml-auto hidden shrink-0 text-xs leading-5 text-[#A1A1AA] transition-opacity sm:inline",
                              "group-hover:opacity-0 group-focus-within:opacity-0",
                              menuOpen && "opacity-0",
                            )}
                          >
                            {relativeThreadTimeLabel(thread.updated_at)}
                          </span>
                          {/* Keep title clear of always-visible ⋯ on mobile */}
                          <span className="inline-block w-7 shrink-0 sm:hidden" aria-hidden />
                        </button>
                        <button
                          ref={menuOpen ? rowMenuBtnRef : undefined}
                          type="button"
                          aria-label={`Options for ${thread.title || "chat"}`}
                          className={cn(
                            "absolute right-1 top-1/2 inline-flex size-7 -translate-y-1/2 shrink-0 items-center justify-center rounded-md text-[#71717A]",
                            "opacity-100 transition-opacity sm:opacity-0",
                            "sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
                            "hover:bg-[#E4E4E7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]/15 focus-visible:opacity-100",
                            menuOpen && "bg-[#E4E4E7] !opacity-100",
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            setHeaderMenuOpen(false);
                            setRowMenuId((id) => (id === thread.id ? null : thread.id));
                          }}
                        >
                          <MoreHorizontal className="size-4" aria-hidden />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </TopbarDropdownPortal>

      <TopbarDropdownPortal
        open={headerMenuOpen}
        anchorRef={headerMenuBtnRef}
        ref={headerMenuPortalRef}
        align="leading"
        className="w-max min-w-[10rem]"
        onRequestClose={() => setHeaderMenuOpen(false)}
      >
        <div className={dropdownMenuPanelClassName()} role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={!activeThread}
            onMouseEnter={() => setRenameIconPlaying(true)}
            onMouseLeave={() => setRenameIconPlaying(false)}
            onFocus={() => setRenameIconPlaying(true)}
            onBlur={() => setRenameIconPlaying(false)}
            onClick={() => {
              if (!activeThread) return;
              openRename(activeThread);
            }}
            className={dropdownMenuPlainItemClassName()}
          >
            <DropdownMenuLottieIcon
              animationData={renameMenuIconAnimation}
              playing={renameIconPlaying}
            />
            <span>Rename</span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!activeThread}
            onMouseEnter={() => setDeleteIconPlaying(true)}
            onMouseLeave={() => setDeleteIconPlaying(false)}
            onFocus={() => setDeleteIconPlaying(true)}
            onBlur={() => setDeleteIconPlaying(false)}
            onClick={() => {
              if (!activeThread) return;
              openDelete(activeThread);
            }}
            className={cn(
              dropdownMenuPlainItemClassName(),
              "text-[#DC2626] hover:bg-[#FEE2E2] hover:text-[#B91C1C]",
            )}
          >
            <DropdownMenuLottieIcon
              animationData={deleteMenuIconAnimation}
              playing={deleteIconPlaying}
            />
            <span>Delete</span>
          </button>
        </div>
      </TopbarDropdownPortal>

      <TopbarDropdownPortal
        open={Boolean(rowMenuId)}
        anchorRef={rowMenuBtnRef}
        ref={rowMenuPortalRef}
        align="trailing"
        className="w-max min-w-[10rem]"
        onRequestClose={() => setRowMenuId(null)}
      >
        <div className={dropdownMenuPanelClassName()} role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={!rowMenuThread}
            onMouseEnter={() => setRenameIconPlaying(true)}
            onMouseLeave={() => setRenameIconPlaying(false)}
            onFocus={() => setRenameIconPlaying(true)}
            onBlur={() => setRenameIconPlaying(false)}
            onClick={() => {
              if (!rowMenuThread) return;
              openRename(rowMenuThread);
            }}
            className={dropdownMenuPlainItemClassName()}
          >
            <DropdownMenuLottieIcon
              animationData={renameMenuIconAnimation}
              playing={renameIconPlaying}
            />
            <span>Rename</span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!rowMenuThread}
            onMouseEnter={() => setDeleteIconPlaying(true)}
            onMouseLeave={() => setDeleteIconPlaying(false)}
            onFocus={() => setDeleteIconPlaying(true)}
            onBlur={() => setDeleteIconPlaying(false)}
            onClick={() => {
              if (!rowMenuThread) return;
              openDelete(rowMenuThread);
            }}
            className={cn(
              dropdownMenuPlainItemClassName(),
              "text-[#DC2626] hover:bg-[#FEE2E2] hover:text-[#B91C1C]",
            )}
          >
            <DropdownMenuLottieIcon
              animationData={deleteMenuIconAnimation}
              playing={deleteIconPlaying}
            />
            <span>Delete</span>
          </button>
        </div>
      </TopbarDropdownPortal>

      <AppModalOverlay open={step === "rename"} onClose={closeModal} zIndex={120}>
        <AppModalShell
          titleId={renameTitleId}
          title="Rename chat"
          onClose={closeModal}
          bodyClassName="px-5 pb-5 pt-5"
          footer={
            <AppModalFooter>
              <button type="button" onClick={closeModal} className={appModalCancelButtonClass}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!renameEnabled}
                onClick={() => {
                  const trimmed = renameValue.trim();
                  if (!trimmed || !modalThread) return;
                  setSaving(true);
                  void Promise.resolve(onRenameThread(modalThread.id, trimmed)).finally(() => {
                    closeModal();
                  });
                }}
                className={appModalPrimaryButtonClass(renameEnabled)}
              >
                Save
              </button>
            </AppModalFooter>
          }
        >
          <label className="flex w-full flex-col gap-2">
            <span className="text-sm font-medium leading-5 text-[#141414]">Chat name</span>
            <ClearableInput
              type="text"
              value={renameValue}
              onChange={setRenameValue}
              placeholder="Add a name"
              clearLabel="Clear name"
            />
          </label>
        </AppModalShell>
      </AppModalOverlay>

      <AppModalOverlay open={step === "deleteConfirm"} onClose={closeModal} zIndex={120}>
        <AppModalShell
          titleId={deleteTitleId}
          title="Delete chat"
          onClose={closeModal}
          bodyClassName="px-5 pb-2 pt-5"
          footer={
            <AppModalFooter>
              <button type="button" onClick={closeModal} className={appModalCancelButtonClass}>
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (!modalThread) return;
                  setSaving(true);
                  void Promise.resolve(onDeleteThread(modalThread.id)).finally(() => {
                    closeModal();
                  });
                }}
                className={appModalDangerButtonClass(!saving)}
              >
                Delete
              </button>
            </AppModalFooter>
          }
        >
          <p className="pb-3 text-sm leading-5 text-[#52525B]">
            Delete “{modalThread?.title || "New chat"}”? This can’t be undone.
          </p>
        </AppModalShell>
      </AppModalOverlay>
    </>
  );
}
