import { parseDescription } from "@/lib/event-description";
import { cn } from "@/lib/utils";

/**
 * An event's "About this event" copy.
 *
 * Renders a real <ul> when the coordinator wrote bullets, and a plain
 * paragraph when they wrote prose — so the twenty prose events look exactly as
 * they did, while the ones with bullets stop showing stray "●" characters
 * inside a run-on paragraph.
 */
export function EventDescription({
  description,
  className,
}: {
  description: string;
  className?: string;
}) {
  const { intro, bullets } = parseDescription(description);

  return (
    <div className={cn("space-y-3", className)}>
      {intro && <p className="leading-relaxed break-words whitespace-pre-line">{intro}</p>}
      {bullets.length > 0 && (
        <ul className="space-y-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2.5 leading-relaxed break-words">
              <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-cyber-pink" />
              <span className="min-w-0">{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
