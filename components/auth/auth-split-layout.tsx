import type { ReactNode } from "react";

import styles from "./auth-split-layout.module.css";

/**
 * Figma auth shell (node 8882:68795): #E4E4E7 frame, white form column + light aside.
 * Aside is omitted below `md`. Styles live in a CSS module so SSR, client, and HMR stay aligned.
 */
export function AuthSplitLayout({
  form,
  aside,
  footer,
}: {
  form: ReactNode;
  aside: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className={styles.shell}>
      <div className={styles.inner}>
        <section className={styles.form}>
          <div className="flex w-full flex-1 flex-col items-center justify-center">{form}</div>
          {footer != null ? (
            <footer className="mt-auto w-full max-w-[384px] shrink-0 pt-8 text-center">{footer}</footer>
          ) : null}
        </section>
        <section className={styles.aside}>{aside}</section>
      </div>
    </main>
  );
}
