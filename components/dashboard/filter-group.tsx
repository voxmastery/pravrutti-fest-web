"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type FilterOption<T extends string> = { id: T; label: string };

/**
 * A single-choice filter row (status, sort). Radix ToggleGroup underneath, so
 * arrow keys move between options and the pressed one is announced.
 * `onChange` ignores the empty string Radix emits when the pressed item is
 * clicked again — a filter always has a value.
 */
export function FilterGroup<T extends string>({
  value,
  options,
  onChange,
  label,
  variant = "chip",
  className,
  itemClassName,
}: {
  value: T;
  options: FilterOption<T>[];
  onChange: (next: T) => void;
  label: string;
  /** chip: compact filter row. pill: larger, for switching between screens. */
  variant?: "chip" | "pill";
  className?: string;
  itemClassName?: string;
}) {
  const item =
    variant === "pill"
      ? "h-auto rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm text-white/70 hover:border-white/25 hover:bg-white/[0.06] hover:text-white data-[state=on]:border-cyber-pink data-[state=on]:bg-cyber-pink data-[state=on]:text-white"
      : "h-auto rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50 hover:bg-white/[0.06] hover:text-white/80 data-[state=on]:border-cyber-pink/50 data-[state=on]:bg-neon-purple/40 data-[state=on]:text-champagne-gold";
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.id}
          value={o.id}
          className={cn(item, itemClassName)}
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
