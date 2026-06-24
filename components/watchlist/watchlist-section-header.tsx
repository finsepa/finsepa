"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "@/lib/icons";

import { ClearableInput } from "@/components/layout/clearable-input";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import {
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
import { cn } from "@/lib/utils";
import type { WatchlistDropTarget } from "@/lib/watchlist/watchlist-drag";
import { readWatchlistDragData } from "@/lib/watchlist/watchlist-drag";

type ModalStep = "closed" | "rename" | "deleteConfirm";

export function WatchlistSectionHeader({
  sectionId,
  label,
  collapsed,
  onToggleCollapsed,
  onRename,
  onDelete,
  onDropItem,
}: {
  sectionId: string;
  label: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDropItem: (fromIndex: number, target: WatchlistDropTarget) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>("closed");
  const [renameValue, setRenameValue] = useState(label);
  const [dragOver, setDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const renameTitleId = useId();
  const deleteTitleId = useId();

  useEffect(() => {
    if (step === "rename") setRenameValue(label);
  }, [step, label]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuPortalRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const closeModal = () => setStep("closed");
  const renameEnabled = renameValue.trim().length > 0;

  return (
    <>
      <tr
        className={cn(
          "group border-b border-[#E4E4E7] transition-colors",
          dragOver && "bg-[#E4E4E7]",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const payload = readWatchlistDragData(event.dataTransfer);
          if (!payload) return;
          onDropItem(payload.globalIndex, { kind: "section", sectionId });
        }}
      >
        <td colSpan={9} className="bg-white px-4 py-2">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px] font-medium text-[#71717A] transition-colors hover:text-[#09090B]"
            >
              {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
              <span className="truncate">{label}</span>
            </button>

            <div ref={containerRef} className="relative shrink-0">
              <button
                type="button"
                aria-label={`${label} section options`}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((open) => !open)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-[8px] text-[#71717A] opacity-0 transition-opacity",
                  "hover:bg-[#F4F4F5] hover:text-[#09090B] group-hover:opacity-100 focus-visible:opacity-100",
                  menuOpen && "opacity-100 bg-[#F4F4F5] text-[#09090B]",
                )}
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>

              {menuOpen ? (
                <TopbarDropdownPortal
                  open={menuOpen}
                  anchorRef={containerRef}
                  ref={menuPortalRef}
                  align="trailing"
                  className="w-max min-w-[10rem]"
                >
                  <div className={dropdownMenuPanelClassName()} role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setStep("rename");
                      }}
                      className={dropdownMenuPlainItemClassName()}
                    >
                      <Pencil className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                      <span>Rename</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setStep("deleteConfirm");
                      }}
                      className={cn(
                        dropdownMenuPlainItemClassName(),
                        "text-[#DC2626] hover:bg-[#FEE2E2] hover:text-[#B91C1C]",
                      )}
                    >
                      <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                      <span>Delete</span>
                    </button>
                  </div>
                </TopbarDropdownPortal>
              ) : null}
            </div>
          </div>
        </td>
      </tr>

      <AppModalOverlay open={step === "rename"} onClose={closeModal} zIndex={120}>
        <AppModalShell
          titleId={renameTitleId}
          title="Rename section"
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
                  if (!trimmed) return;
                  onRename(trimmed);
                  closeModal();
                }}
                className={appModalPrimaryButtonClass(renameEnabled)}
              >
                Save
              </button>
            </AppModalFooter>
          }
        >
          <label className="flex w-full flex-col gap-2">
            <span className="text-sm font-medium leading-5 text-[#09090B]">Section name</span>
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
          title="Delete section"
          onClose={closeModal}
          bodyClassName="px-5 pb-2 pt-5"
          footer={
            <AppModalFooter>
              <button type="button" onClick={closeModal} className={appModalCancelButtonClass}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete();
                  closeModal();
                }}
                className={appModalDangerButtonClass(true)}
              >
                Delete
              </button>
            </AppModalFooter>
          }
        >
          <p className="text-sm leading-5 text-[#09090B]">Are you sure you want to delete this section?</p>
          <p className="mt-3 text-sm leading-5 text-[#71717A]">
            Assets in <span className="font-semibold text-[#09090B]">{label}</span> will move to the section above, or
            back to your main watchlist if this is the first section.
          </p>
        </AppModalShell>
      </AppModalOverlay>
    </>
  );
}
