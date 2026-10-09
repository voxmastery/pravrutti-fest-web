import { cn } from "@/lib/utils";

/** The line that sits under a prize figure. Amounts are unchanged; this only
    says they already include GST. */
export const PRIZE_GST_NOTE = "*Prize pool inclusive of GST";

export function PrizeGstNote({ className }: { className?: string }) {
  return (
    <p className={cn("font-sans text-[10px] font-normal leading-snug tracking-normal text-pearl-white/40", className)}>
      {PRIZE_GST_NOTE}
    </p>
  );
}
