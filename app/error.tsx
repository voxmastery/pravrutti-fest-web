"use client";

import { useReloadOnce } from "@/components/reload-once";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const reloading = useReloadOnce();
  if (reloading) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-xl">This page couldn&rsquo;t load</h1>
      <p className="opacity-80">Reload to try again, or go back.</p>
      <div className="flex gap-3">
        <button className="px-4 py-2 rounded-md bg-white/90 text-black" onClick={() => window.location.reload()}>
          Reload
        </button>
        <button className="px-4 py-2 rounded-md border border-white/30" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}
