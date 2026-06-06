"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

type ModalStackContextValue = {
  registerModal: () => () => void;
};

const ModalStackContext = createContext<ModalStackContextValue | null>(null);

function applyModalOpenState(count: number) {
  const open = count > 0;
  if (open) {
    document.documentElement.dataset.appModalOpen = "true";
    document.body.style.overflow = "hidden";
  } else {
    delete document.documentElement.dataset.appModalOpen;
    document.body.style.overflow = "";
  }
}

export function ModalStackProvider({ children }: { children: ReactNode }) {
  const countRef = useRef(0);

  const registerModal = useCallback(() => {
    countRef.current += 1;
    applyModalOpenState(countRef.current);
    return () => {
      countRef.current = Math.max(0, countRef.current - 1);
      applyModalOpenState(countRef.current);
    };
  }, []);

  const value = useMemo(() => ({ registerModal }), [registerModal]);

  useEffect(() => {
    return () => {
      countRef.current = 0;
      applyModalOpenState(0);
    };
  }, []);

  return <ModalStackContext.Provider value={value}>{children}</ModalStackContext.Provider>;
}

/** Registers an open modal for shell inset + body scroll lock. */
export function useModalStackRegister(open: boolean, enabled = true) {
  const registerModal = useContext(ModalStackContext)?.registerModal;

  useEffect(() => {
    if (!enabled || !open || !registerModal) return;
    return registerModal();
  }, [enabled, open, registerModal]);
}
