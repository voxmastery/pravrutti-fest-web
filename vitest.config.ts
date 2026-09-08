import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      /* Route handlers are server code, but Vite resolves the "browser"
         condition of the `server-only` package, whose whole job there is to
         throw. Point it at the empty module Next uses on the server so
         server-only files stay testable — the guard still holds in the build. */
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
});
