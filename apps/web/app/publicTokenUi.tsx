import type { ReactNode } from "react";

export function PublicStatusMessage({ children }: { children: ReactNode }) {
  return (
    <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
      {children}
    </p>
  );
}

export function PublicTokenShell({
  children,
  title,
  eyebrow,
  icon,
  badge,
}: {
  children: ReactNode;
  title: string;
  eyebrow: string;
  icon: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <main className="public-form-shell">
      <section className="public-form-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          {badge ?? icon}
        </div>
        {children}
      </section>
    </main>
  );
}
