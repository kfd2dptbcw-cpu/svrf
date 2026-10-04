import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="pt-10 pb-8 sm:pt-14">
      {eyebrow && <p className="text-sm font-semibold font-mono tracking-wide text-slate-600 uppercase dark:text-slate-400">{eyebrow}</p>}
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-balance sm:text-5xl">{title}</h1>
      {children && <div className="mt-4 max-w-3xl text-lg text-slate-600 dark:text-slate-300">{children}</div>}
    </header>
  );
}

export function Section({ title, description, children, id }: { title: string; description?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="mt-12" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="mb-5">
        <h2 id={id ? `${id}-title` : undefined} className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h2>
        {description && <p className="mt-1 text-slate-600 dark:text-slate-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-7xl px-4 sm:px-6 ${className}`}>{children}</div>;
}
