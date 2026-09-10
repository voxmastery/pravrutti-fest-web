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

function mcp(server) {
  const cfg = JSON.parse(fs.readFileSync(os.homedir() + "/.claude.json", "utf8"));
  const srv = cfg.mcpServers[server];
  if (!srv) throw new Error(`MCP server ${server} is not configured`);
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
console.log("build:", uuid ?? out.slice(0, 200));

let state = "pending";
for (let i = 0; i < 20 && state !== "completed" && state !== "failed"; i++) {
  await new Promise((r) => setTimeout(r, 20000));
  const t = await h.call("hosting_listJsDeployments", { domain: DOMAIN, perPage: 1 });
  try { state = JSON.parse(t).deployments.data[0].state; } catch { /* keep polling */ }
  process.stdout.write(`  ${state}\r`);
}
console.log("\nbuild state:", state);

if (state === "failed") {
  console.error(await h.call("hosting_getNodeJSBuildLogsV1", { username: USERNAME, domain: DOMAIN, uuid }));
  h.close(); process.exit(1);
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
