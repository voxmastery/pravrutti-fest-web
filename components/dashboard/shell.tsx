import { Navigation } from "@/components/landing/navigation";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Page frame shared by every desk: nav, measure, title. */
export function DashboardShell({
  title,
  eyebrow,
  wide = false,
  children,
}: {
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <main className="relative min-h-screen bg-transparent text-pearl-white">
        <Navigation />
        <div className={cn("relative z-10 mx-auto w-full px-6 py-28", wide ? "max-w-[1100px]" : "max-w-[900px]")}>
          {eyebrow}
          {title && <h1 className="mb-6 font-display text-3xl font-black">{title}</h1>}
          {children}
        </div>
      </main>
    </TooltipProvider>
  );
}

/** A centred message card: sign-in required, wrong role, load failure. */
export function Notice({ title, tone = "neutral", children }: { title: string; tone?: "neutral" | "danger" | "warning"; children: React.ReactNode }) {
  const centred = tone === "neutral";
  const border =
    tone === "danger" ? "border-danger/30 bg-danger/[0.06]" : tone === "warning" ? "border-soft-gold/35 bg-soft-gold/[0.08]" : "border-white/[0.08] bg-white/[0.04]";
  return (
    <Card className={cn("mb-5 gap-1.5 rounded-2xl shadow-none", centred ? "p-8 text-center" : "px-5 py-4", border)}>
      <p className="font-semibold">{title}</p>
      <p className={cn("text-sm", centred ? "text-white/50" : "text-white/70")}>{children}</p>
    </Card>
  );
}

/** Placeholder rows while a list loads — same height as the real rows. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="divide-y divide-royal-wine/50">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40 bg-white/[0.08]" />
            <Skeleton className="h-3 w-56 bg-white/[0.05]" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full bg-white/[0.06]" />
          <Skeleton className="h-5 w-20 rounded-full bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}
