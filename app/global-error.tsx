"use client";

import { useReloadOnce } from "@/components/reload-once";

/* Replaces the root layout when it fails, so it brings its own html and body. */
export default function GlobalError() {
  const reloading = useReloadOnce();

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", background: "#120a18", color: "#eee", fontFamily: "system-ui, sans-serif" }}>
        {!reloading && (
          <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
            <h1 style={{ fontSize: 22, margin: 0 }}>This page couldn&rsquo;t load</h1>
            <p style={{ opacity: 0.8, margin: 0 }}>Reload to try again.</p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "8px 16px", borderRadius: 6, border: 0, background: "#eee", color: "#000", fontSize: 16 }}
            >
              Reload
            </button>
          </div>
        )}
      </body>
    </html>
  );
}
