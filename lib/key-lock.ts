const chains = new Map<string, Promise<unknown>>();

/**
 * Serialises async work that touches one key inside this process.
 *
 * Hostinger runs more than one Node process, so this is not the check-in
 * lock — MySQL `SELECT … FOR UPDATE` is. It only keeps the filesystem and
 * in-memory stores, which have no row lock, from applying two stamps at once.
 */
export function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const settled = run.then(
    () => undefined,
    () => undefined
  );
  chains.set(key, settled);
  settled.then(() => {
    if (chains.get(key) === settled) chains.delete(key);
  });
  return run;
}
