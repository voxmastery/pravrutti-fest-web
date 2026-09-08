"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Explains a disabled control. A disabled button swallows pointer events, so
 * the trigger is a wrapping span; with no `text` the child renders bare.
 */
export function Hint({ text, children }: { text?: string | null; children: React.ReactNode }) {
  if (!text) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-royal-wine bg-cosmic-purple text-pearl-white">{text}</TooltipContent>
    </Tooltip>
  );
}
