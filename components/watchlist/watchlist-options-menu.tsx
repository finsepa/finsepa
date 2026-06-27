"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "@/lib/icons";

import { DropdownMenuLottieIcon } from "@/components/icons/dropdown-menu-lottie-icon";

import {
  ChevronsUpDownIcon,
  type ChevronsUpDownIconHandle,
} from "@/components/chevrons-up-down-icon";
import { ClearableInput } from "@/components/layout/clearable-input";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import {
  dropdownMenuCompositeRowClassName,
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  AppModalFooter,
  AppModalShell,
  appModalCancelButtonClass,
  appModalDangerButtonClass,
  appModalPrimaryButtonClass,
} from "@/components/ui/app-modal-shell";
import type { WatchlistCollection } from "@/lib/watchlist/collections";
import {
  addSectionMenuIconAnimation,
  addWatchlistMenuIconAnimation,
  deleteMenuIconAnimation,
  renameMenuIconAnimation,
} from "@/lib/lottie/watchlist-menu-animations";
import { cn } from "@/lib/utils";

const titleGhostTriggerClass =
  "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2";

type ModalStep = "closed" | "create" | "createSection" | "rename" | "deleteConfirm";

export type WatchlistOptionsMenuProps = {
  name: string;
  watchlists: WatchlistCollection[];
  activeWatchlistId: string;
  onCreate: (name: string) => void;
  onCreateSection?: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void | Promise<void>;
  onSwitch: (id: string) => void;
  /** `page-icon` = chevrons button beside page title; `rail-title` = rail header label + chevron down. */
  variant: "page-icon" | "rail-title";
  className?: string;
  /** When false, menu toggle is ignored (avoids SSR/localStorage races without `disabled` on the button). */
  ready?: boolean;
};

export function WatchlistOptionsMenu({
  name,
  watchlists,
  activeWatchlistId,
  onCreate,
  onCreateSection,
  onRename,
  onDelete,
  onSwitch,
  variant,
  className,
  ready = true,
}: WatchlistOptionsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [addWatchlistIconPlaying, setAddWatchlistIconPlaying] = useState(false);
  const [addSectionIconPlaying, setAddSectionIconPlaying] = useState(false);
  const [renameIconPlaying, setRenameIconPlaying] = useState(false);
  const [deleteIconPlaying, setDeleteIconPlaying] = useState(false);
  const [step, setStep] = useState<ModalStep>("closed");
  const [renameValue, setRenameValue] = useState(name);
  const [createValue, setCreateValue] = useState("");
  const [createSectionValue, setCreateSectionValue] = useState("");
  const [clearing, setClearing] = useState(false);
  const [pendingDeleteName, setPendingDeleteName] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const chevronsRef = useRef<ChevronsUpDownIconHandle>(null);
  const createTitleId = useId();
  const createSectionTitleId = useId();
  const renameTitleId = useId();
  const deleteTitleId = useId();

  useEffect(() => {
    if (menuOpen && variant === "page-icon") chevronsRef.current?.startAnimation();
    else chevronsRef.current?.stopAnimation();
  }, [menuOpen, variant]);

  useEffect(() => {
    if (!menuOpen) {
      setAddWatchlistIconPlaying(false);
      setAddSectionIconPlaying(false);
      setRenameIconPlaying(false);
      setDeleteIconPlaying(false);
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || menuPortalRef.current?.contains(t)) return;
      setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (step === "rename") setRenameValue(name);
    if (step === "create") setCreateValue("");
    if (step === "createSection") setCreateSectionValue("");
  }, [step, name]);

  const closeModal = () => {
    setStep("closed");
    setPendingDeleteName(null);
  };

  const openCreate = () => {
    setMenuOpen(false);
    setStep("create");
  };

  const openCreateSection = () => {
    setMenuOpen(false);
    setStep("createSection");
  };

  const openRename = () => {
    setMenuOpen(false);
    setStep("rename");
  };

  const openDeleteConfirm = () => {
    setMenuOpen(false);
    setPendingDeleteName(name);
    setStep("deleteConfirm");
  };

  const confirmRename = () => {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    onRename(trimmed);
    closeModal();
  };

  const confirmCreate = () => {
    const trimmed = createValue.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    closeModal();
  };

  const confirmCreateSection = () => {
    const trimmed = createSectionValue.trim();
    if (!trimmed) return;
    onCreateSection?.(trimmed);
    closeModal();
  };

  const confirmDelete = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      await onDelete();
      closeModal();
    } finally {
      setClearing(false);
    }
  };

  const renameEnabled = renameValue.trim().length > 0;
  const createEnabled = createValue.trim().length > 0;
  const createSectionEnabled = createSectionValue.trim().length > 0;

  const toggleMenu = () => {
    if (!ready) return;
    setMenuOpen((v) => !v);
  };

  return (
    <>
      <div ref={containerRef} className={cn("relative flex shrink-0", className)}>
        {variant === "page-icon" ? (
          <button
            type="button"
            aria-label="Watchlist options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={toggleMenu}
            className={titleGhostTriggerClass}
          >
            <ChevronsUpDownIcon ref={chevronsRef} className="h-5 w-5 shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Watchlist options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={toggleMenu}
            className="flex min-w-0 flex-1 items-center gap-0.5 truncate pl-1 text-sm font-semibold leading-5 text-[#52525B] transition-colors hover:text-[#09090B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:rounded-[6px]"
          >
            <span className="truncate" suppressHydrationWarning>
              {name}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-150",
                menuOpen && "rotate-180",
              )}
              strokeWidth={2}
              aria-hidden
            />
          </button>
        )}
        {menuOpen ? (
          <TopbarDropdownPortal
            open={menuOpen}
            anchorRef={containerRef}
            ref={menuPortalRef}
            align="leading"
            className="w-max min-w-[13rem]"
          >
            <div className={dropdownMenuPanelClassName()} role="menu">
              {watchlists.map((list) => (
                <div
                  key={list.id}
                  className={cn(
                    dropdownMenuCompositeRowClassName,
                    list.id === activeWatchlistId && "bg-[#F4F4F5]",
                  )}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSwitch(list.id);
                      setMenuOpen(false);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 pr-2 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-[#09090B]">
                      {list.name}
                    </span>
                    {list.id === activeWatchlistId ? (
                      <Check className="h-4 w-4 shrink-0 text-[#09090B]" strokeWidth={2} aria-hidden />
                    ) : (
                      <span className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                  </button>
                </div>
              ))}
              <div role="separator" aria-hidden className="-mx-1 my-0.5 h-px shrink-0 bg-[#E4E4E7]" />
              <button
                type="button"
                role="menuitem"
                onMouseEnter={() => setAddWatchlistIconPlaying(true)}
                onMouseLeave={() => setAddWatchlistIconPlaying(false)}
                onFocus={() => setAddWatchlistIconPlaying(true)}
                onBlur={() => setAddWatchlistIconPlaying(false)}
                onClick={openCreate}
                className={dropdownMenuPlainItemClassName()}
              >
                <DropdownMenuLottieIcon
                  animationData={addWatchlistMenuIconAnimation}
                  playing={addWatchlistIconPlaying}
                />
                <span>Add New Watchlist</span>
              </button>
              {onCreateSection ? (
                <button
                  type="button"
                  role="menuitem"
                  onMouseEnter={() => setAddSectionIconPlaying(true)}
                  onMouseLeave={() => setAddSectionIconPlaying(false)}
                  onFocus={() => setAddSectionIconPlaying(true)}
                  onBlur={() => setAddSectionIconPlaying(false)}
                  onClick={openCreateSection}
                  className={dropdownMenuPlainItemClassName()}
                >
                  <DropdownMenuLottieIcon
                    animationData={addSectionMenuIconAnimation}
                    playing={addSectionIconPlaying}
                  />
                  <span>Add New Section</span>
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onMouseEnter={() => setRenameIconPlaying(true)}
                onMouseLeave={() => setRenameIconPlaying(false)}
                onFocus={() => setRenameIconPlaying(true)}
                onBlur={() => setRenameIconPlaying(false)}
                onClick={openRename}
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
                onMouseEnter={() => setDeleteIconPlaying(true)}
                onMouseLeave={() => setDeleteIconPlaying(false)}
                onFocus={() => setDeleteIconPlaying(true)}
                onBlur={() => setDeleteIconPlaying(false)}
                onClick={openDeleteConfirm}
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
        ) : null}
      </div>

      <AppModalOverlay open={step === "create"} onClose={closeModal} zIndex={120}>
        <AppModalShell
          titleId={createTitleId}
          title="Add new watchlist"
          onClose={closeModal}
          bodyClassName="px-5 pb-5 pt-5"
          footer={
            <AppModalFooter>
              <button type="button" onClick={closeModal} className={appModalCancelButtonClass}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!createEnabled}
                onClick={confirmCreate}
                className={appModalPrimaryButtonClass(createEnabled)}
              >
                Create
              </button>
            </AppModalFooter>
          }
        >
          <label className="flex w-full flex-col gap-2">
            <span className="text-sm font-medium leading-5 text-[#09090B]">Watchlist name</span>
            <ClearableInput
              type="text"
              value={createValue}
              onChange={setCreateValue}
              placeholder="Add a name"
              clearLabel="Clear name"
            />
          </label>
        </AppModalShell>
      </AppModalOverlay>

      <AppModalOverlay open={step === "createSection"} onClose={closeModal} zIndex={120}>
        <AppModalShell
          titleId={createSectionTitleId}
          title="Add new section"
          onClose={closeModal}
          bodyClassName="px-5 pb-5 pt-5"
          footer={
            <AppModalFooter>
              <button type="button" onClick={closeModal} className={appModalCancelButtonClass}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!createSectionEnabled}
                onClick={confirmCreateSection}
                className={appModalPrimaryButtonClass(createSectionEnabled)}
              >
                Create
              </button>
            </AppModalFooter>
          }
        >
          <label className="flex w-full flex-col gap-2">
            <span className="text-sm font-medium leading-5 text-[#09090B]">Section name</span>
            <ClearableInput
              type="text"
              value={createSectionValue}
              onChange={setCreateSectionValue}
              placeholder="Add a name"
              clearLabel="Clear name"
            />
          </label>
        </AppModalShell>
      </AppModalOverlay>

      <AppModalOverlay open={step === "rename"} onClose={closeModal} zIndex={120}>
        <AppModalShell
          titleId={renameTitleId}
          title="Rename watchlist"
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
                onClick={confirmRename}
                className={appModalPrimaryButtonClass(renameEnabled)}
              >
                Save
              </button>
            </AppModalFooter>
          }
        >
          <label className="flex w-full flex-col gap-2">
            <span className="text-sm font-medium leading-5 text-[#09090B]">Watchlist name</span>
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
          title="Delete watchlist"
          onClose={closeModal}
          bodyClassName="px-5 pb-2 pt-5"
          footer={
            <AppModalFooter>
              <button type="button" onClick={closeModal} className={appModalCancelButtonClass} disabled={clearing}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={clearing}
                className={appModalDangerButtonClass(!clearing)}
              >
                Delete
              </button>
            </AppModalFooter>
          }
        >
          <p className="text-sm leading-5 text-[#09090B]">Are you sure to delete?</p>
          <p className="mt-3 text-sm leading-5 text-[#71717A]">
            <span className="font-semibold text-[#09090B]">{pendingDeleteName ?? name}</span> and all of its
            symbols will be removed.
          </p>
        </AppModalShell>
      </AppModalOverlay>
    </>
  );
}
