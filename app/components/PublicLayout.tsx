import type { ReactNode } from "react";
import styles from "./public.module.css";

export const SUPPORT_EMAIL = "support@newvora.in";

function Mark() {
  return (
    <svg viewBox="6 6 108 108" aria-hidden="true">
      <path d="M104 60 A44 44 0 1 1 82 21.9" fill="none" stroke="#2DD4BF" strokeWidth="10" strokeLinecap="round" />
      <circle cx="98.1" cy="38" r="7" fill="#F59E0B" />
      <path d="M44 82 V60 a16 16 0 0 1 32 0 V82" fill="none" stroke="#2DD4BF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <a className={styles.brand} href="/">
          <Mark />
          Cited
        </a>
        <nav className={styles.links} aria-label="Cited">
          <a href="/docs">Docs</a>
          <a href="/support">Support</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <span>Cited is made by Newvora, New Delhi, India · <a href="https://newvora.in">newvora.in</a></span>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </footer>
    </div>
  );
}

export { styles as publicStyles };
