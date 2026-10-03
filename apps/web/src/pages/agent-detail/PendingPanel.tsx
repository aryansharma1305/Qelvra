interface PendingPanelProps {
  icon: string;
  title: string;
  message: string;
  className?: string;
}

/** A profile panel whose feature does not exist yet: the design's frame, no invented data. */
export function PendingPanel({ icon, title, message, className = "" }: PendingPanelProps) {
  return (
    <section
      className={`${className} bg-surface-container-lowest rounded-xl p-space-md shadow-md flex flex-col gap-space-sm`}
      aria-label={title}
    >
      <h2 className="flex items-center gap-1.5 font-headline-sm text-headline-sm text-on-surface">
        <span className="material-symbols-outlined text-[18px] text-outline">{icon}</span>
        {title}
      </h2>
      <p className="font-body-sm text-body-sm text-outline">{message}</p>
    </section>
  );
}
