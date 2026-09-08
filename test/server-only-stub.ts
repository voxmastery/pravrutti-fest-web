/* Stands in for the `server-only` package under Vitest. The real package throws
   when resolved through the browser condition, which is exactly what we want in
   a client bundle and exactly what we don't want in a Node test run. */
export {};
