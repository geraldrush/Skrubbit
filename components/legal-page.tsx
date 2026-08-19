import type { ReactNode } from "react";

/**
 * Shared chrome for the legal pages.
 *
 * One wrapper so privacy, terms and cookies read as one document set rather
 * than three pages written on different days.
 */
export function LegalPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <>
      <section className="border-b bg-secondary/40">
        <div className="container py-12 md:py-16">
          <h1 className="font-display text-4xl font-extrabold leading-tight">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{intro}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated {updated}
          </p>
        </div>
      </section>

      <section className="container py-12">
        <div className="max-w-2xl space-y-8 [&_a]:text-accent [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-extrabold [&_li]:text-muted-foreground [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </div>
      </section>
    </>
  );
}
