/**
 * Deploy the site to Hostinger, then purge the cache.
 *
 * The purge is not optional. Hostinger's CDN caches the HTML with
 * `s-maxage=31536000` while Next.js renames its JS chunks on every build, so a
 * deploy without a purge leaves visitors holding stale HTML that points at
 * chunks which now 404. React then never hydrates, and because the intro
 * overlay is server-rendered, they sit on the splash screen forever. That is
 * exactly what happened on 2026-09-10.
 *
 * Run: node scripts/deploy-hostinger.mjs
 */
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

const USERNAME = "u456915230";
const DOMAIN = "pravrutti.tech";
const ARCHIVE = "/tmp/pravrutti-src.tar.gz";
/* An unreferenced 82 MB video, duplicated in both places, takes the archive
   from 26 MB to 128 MB. Nothing imports it. */
const EXCLUDE = /^images\/|^public\/images\/video\.mp4$/;

/**
 * How the Hostinger MCP server is started, and where its token comes from.
 *
 * On a laptop the whole server definition — command, args and token — is
 * already sitting in ~/.claude.json, so there is nothing to configure. CI has
 * no such file and no business reading one, so HOSTINGER_API_TOKEN in the
 * environment is enough on its own: the command is the published package and
 * the token is the only part that varies.
 *
 * The environment wins where both exist, which is what lets a run be pointed
 * at a different account without editing anything.
 */
function hostingerServer(server) {
  const fromEnv = process.env.HOSTINGER_API_TOKEN;
  let srv = null;
  try {
    const cfg = JSON.parse(fs.readFileSync(os.homedir() + "/.claude.json", "utf8"));
    srv = cfg.mcpServers?.[server] ?? null;
  } catch {
    /* No Claude config here — CI, or a fresh checkout. The token alone will do. */
  }
  if (fromEnv) {
    return {
      command: srv?.command ?? "npx",
      /* Pinned, not @latest. 2.0.0 (2026-09-28) dropped every tool this
         script calls — hosting_deployJsApplication, hosting_listJsDeployments,
         hosting_clearWebsiteCacheV1, hosting_getNodeJSBuildLogsV1 — and the
         first deploy after it failed with "Tool not found". Moving past 1.63.4
         means porting the calls below to the new tool names first. */
      args: srv?.args ?? ["--package=hostinger-api-mcp@1.63.4", `${server}-mcp`],
      env: { ...(srv?.env ?? {}), HOSTINGER_API_TOKEN: fromEnv },
    };
  }
  if (!srv) {
    throw new Error(
      `No Hostinger credentials. Set HOSTINGER_API_TOKEN, or configure the "${server}" MCP server in ~/.claude.json.`,
    );
  }
  return srv;
}

function mcp(server) {
  const srv = hostingerServer(server);
  const child = spawn(srv.command, srv.args, { env: { ...process.env, ...srv.env }, stdio: ["pipe", "pipe", "pipe"] });
  let buf = ""; const waiting = new Map();
  child.stdout.on("data", (d) => {
    buf += d; let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    }
  });
  let id = 0;
  const send = (method, params = {}, notify = false) => new Promise((res) => {
    const myId = notify ? null : ++id;
    if (myId) waiting.set(myId, res);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...(myId ? { id: myId } : {}), method, params }) + "\n");
    if (notify) res();
  });
  const call = async (name, args) => {
    const r = await send("tools/call", { name, arguments: args });
    return r.result?.content?.map((c) => c.text).join("") ?? JSON.stringify(r.error);
  };
  const ready = (async () => {
    await send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "deploy", version: "1" } });
    await send("notifications/initialized", {}, true);
  })();
  return { ready, call, close: () => child.kill() };
}

const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter((f) => f && !EXCLUDE.test(f));
fs.writeFileSync("/tmp/pravrutti-files.txt", files.join("\n"));
execSync(`tar -czf ${ARCHIVE} -T /tmp/pravrutti-files.txt`);
console.log(`archive: ${files.length} files, ${(fs.statSync(ARCHIVE).size / 1e6).toFixed(1)} MB`);

const h = mcp("hostinger-hosting");
await h.ready;

const out = await h.call("hosting_deployJsApplication", { domain: DOMAIN, archivePath: ARCHIVE, removeArchive: true });
const uuid = out.match(/"uuid":"([^"]+)"/)?.[1];

/**
 * No uuid means the archive never landed.
 *
 * This used to log the error and carry on. The poll below then read "the
 * most recent deployment", which was the PREVIOUS one sitting at completed,
 * so the script purged the cache, checked the old build's chunks, and exited
 * zero. A deploy that uploaded nothing reported success — which is worse than
 * failing, because nobody goes looking. Seen for real on 2026-09-24, when a
 * GitHub runner could not reach the upload endpoint.
 */
if (!uuid) {
  console.error("deploy failed — the archive did not upload:");
  console.error(out.slice(0, 500));
  h.close();
  process.exit(1);
}
console.log("build:", uuid);

/* Watch THIS build, not whatever is newest. Polling the top of the list
   cannot tell our deployment from the one before it. */
let state = "pending";
for (let i = 0; i < 20 && state !== "completed" && state !== "failed"; i++) {
  await new Promise((r) => setTimeout(r, 20000));
  const t = await h.call("hosting_listJsDeployments", { domain: DOMAIN, perPage: 5 });
  try {
    const mine = JSON.parse(t).deployments.data.find((d) => d.uuid === uuid);
    if (mine) state = mine.state;
  } catch { /* keep polling */ }
  process.stdout.write(`  ${state}\r`);
}
console.log("\nbuild state:", state);

if (state !== "completed") {
  console.error(`deploy did not complete (state: ${state}) — not purging the cache.`);
  if (state === "failed") console.error(await h.call("hosting_getNodeJSBuildLogsV1", { username: USERNAME, domain: DOMAIN, uuid }));
  h.close();
  process.exit(1);
}

console.log("cache:", await h.call("hosting_clearWebsiteCacheV1", { username: USERNAME, domain: DOMAIN }));
h.close();

// Prove the served HTML points only at chunks that exist — the failure this
// whole script exists to prevent.
await new Promise((r) => setTimeout(r, 5000));
const html = await (await fetch(`https://${DOMAIN}/?cb=${Date.now()}`)).text();
const chunks = [...new Set([...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1]))];
let missing = 0;
for (const c of chunks) {
  const res = await fetch(`https://${DOMAIN}${c}`, { method: "HEAD" });
  if (!res.ok) { missing++; console.error("  MISSING", res.status, c); }
}
console.log(`chunks: ${chunks.length - missing}/${chunks.length} resolve`);
process.exitCode = missing ? 1 : 0;
