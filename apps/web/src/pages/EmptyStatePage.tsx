import type { ReactNode } from "react";

interface EmptyStatePageProps {
  title: string;
  icon: string;
  description: string;
  /** Small caption under the description; defaults to "Not built yet". Pass null to hide. */
  label?: string | null;
  action?: ReactNode;
}

// Stand-in for sidebar sections that have no approved design yet. Uses only existing
// design tokens and the card treatment from the Stitch screens; replace when designed.
export function EmptyStatePage({
  title,
  icon,
  description,
  label = "Not built yet",
  action,
}: EmptyStatePageProps) {
  return (
    <main className="relative pt-12 min-h-screen bg-background w-full">
      <div className="w-full max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
        <div className="mt-6 rounded-xl border border-outline-variant/30 bg-surface-container-low p-8 flex flex-col items-center gap-3 text-center">
          <span className="material-symbols-outlined text-[28px] text-outline">{icon}</span>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
            {description}
          </p>
          {label && (
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
              {label}
            </span>
          )}
          {action}
        </div>
      </div>
    </main>
  );
}
