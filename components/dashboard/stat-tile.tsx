import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A labelled number. The only way a count is shown on any desk. */
export function StatTile({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card className={cn("gap-0 rounded-2xl border-royal-wine bg-cosmic-purple/60 px-4 py-3 shadow-none", className)}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-1 font-display text-xl font-black tabular-nums text-champagne-gold">
        {value.toLocaleString("en-IN")}
      </p>
    </Card>
  );
}

/** Inline label/number pair for a row of secondary counts. */
export function StatInline({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <span className="block text-xs text-white/40">{label}</span>
      <span className="block font-semibold tabular-nums text-pearl-white">{value.toLocaleString("en-IN")}</span>
    </span>
  );
}
