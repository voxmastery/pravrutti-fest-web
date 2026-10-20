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

const API = "https://developers.hostinger.com";
const REPO = "voxmastery/pravrutti-fest-web";

async function api(method, pathname, body) {
  const res = await fetch(API + pathname, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.HOSTINGER_API_TOKEN}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch { /* plain text */ }
  return { status: res.status, data };
}

function asList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.installations)) return data.installations;
  return [];
}

function brief(data) {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return text.slice(0, 400);
}

/**
 * Ask Hostinger to clone main itself and build it.
 *
 * The archive upload (hosting_deployJsApplication) has been answering 500
 * before the file finishes transferring. A git build never sends that archive.
 * It does not turn on push-to-deploy; this script still starts each build.
 */
async function startGitBuild() {
  const listed = await api("GET", "/api/hosting/v1/git/installations?status=active");
  console.log("git installations:", listed.status);
  if (listed.status >= 400) {
    console.log(brief(listed.data));
    return null;
  }
  const installations = asList(listed.data);
  if (!installations.length) {
    console.log("no active Git installation on this Hostinger account");
    return null;
  }
  let repo = null;
  for (const installation of installations) {
    const repos = await api("GET", `/api/hosting/v1/git/installations/${installation.uuid}/repositories`);
    if (repos.status >= 400) {
      console.log("git repos:", repos.status, brief(repos.data));
      continue;
    }
    repo = asList(repos.data).find((candidate) => String(candidate.full_name).toLowerCase() === REPO);
    if (repo) {
      repo = { ...repo, installationUuid: installation.uuid };
      break;
    }
  }
  if (!repo) {
    console.log(`${REPO} is not in the connected Git installation`);
    return null;
  }

  const stored = await api(
    "GET",
    `/api/hosting/v1/accounts/${USERNAME}/websites/${DOMAIN}/nodejs/builds/settings`,
  );
  const saved = stored.status === 200 ? (stored.data?.data ?? stored.data) : null;
  console.log("stored build settings:", stored.status, saved?.app_type ?? "none");
  const settings = {
    node_version: saved?.node_version ?? 20,
    app_type: saved?.app_type ?? "next",
    root_directory: saved?.root_directory ?? ".",
    output_directory: saved?.output_directory ?? ".next",
    build_script: saved?.build_script ?? "build",
    package_manager: saved?.package_manager ?? "npm",
    ...(saved?.entry_file ? { entry_file: saved.entry_file } : {}),
  };
  const started = await api(
    "POST",
    `/api/hosting/v1/accounts/${USERNAME}/websites/${DOMAIN}/nodejs/builds`,
    {
      ...settings,
      source_type: "git",
      source_options: {
        owner: repo.owner,
        repository: repo.name,
        branch: "main",
        installation_uuid: repo.installationUuid,
      },
    },
  );
  console.log("git build:", started.status, brief(started.data));
  return started.data?.uuid ?? started.data?.data?.uuid ?? null;
}

function findState(payload, uuid) {
  const lists = [
    Array.isArray(payload) ? payload : null,
    payload?.data,
    payload?.deployments?.data,
    payload?.builds,
  ].filter(Array.isArray);
  for (const list of lists) {
    const hit = list.find((row) => row.uuid === uuid);
    if (hit) return hit.state ?? hit.status ?? null;
  }
  return null;
}

async function uploadArchive() {
  const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter((f) => f && !EXCLUDE.test(f));
  fs.writeFileSync("/tmp/pravrutti-files.txt", files.join("\n"));
  execSync(`tar -czf ${ARCHIVE} -T /tmp/pravrutti-files.txt`);
  console.log(`archive: ${files.length} files, ${(fs.statSync(ARCHIVE).size / 1e6).toFixed(1)} MB`);

  const h = mcp("hostinger-hosting");
  await h.ready;
  const out = await h.call("hosting_deployJsApplication", { domain: DOMAIN, archivePath: ARCHIVE, removeArchive: true });
  h.close();
  const uuid = out.match(/"uuid":"([^"]+)"/)?.[1] ?? null;
  if (!uuid) {
    console.error("archive upload failed:");
    console.error(out.slice(0, 500));
  }
  return uuid;
}

let uuid = await startGitBuild();
let source = "git";
if (!uuid) {
  source = "archive";
  console.log("falling back to the archive upload");
  uuid = await uploadArchive();
}

/**
 * No uuid means nothing new was built.
 *
 * This used to log the error and carry on. The poll below then read "the
 * most recent deployment", which was the PREVIOUS one sitting at completed,
 * so the script purged the cache, checked the old build's chunks, and exited
 * zero. A deploy that uploaded nothing reported success — which is worse than
 * failing, because nobody goes looking. Seen for real on 2026-09-24, when a
 * GitHub runner could not reach the upload endpoint.
 */
if (!uuid) {
  process.exit(1);
}
console.log("build:", source, uuid);

/* Watch THIS build, not whatever is newest. */
let state = "pending";
for (let i = 0; i < 40 && state !== "completed" && state !== "failed"; i++) {
  await new Promise((r) => setTimeout(r, 20000));
  const listed = await api(
    "GET",
    `/api/hosting/v1/accounts/${USERNAME}/websites/${DOMAIN}/nodejs/builds?per_page=5`,
  );
  state = findState(listed.data, uuid) ?? state;
  process.stdout.write(`  ${state}\n`);
}
console.log("build state:", state);

if (state !== "completed") {
  console.error(`deploy did not complete (state: ${state}) — not purging the cache.`);
  if (state === "failed") {
    const logs = await api(
      "GET",
      `/api/hosting/v1/accounts/${USERNAME}/websites/${DOMAIN}/nodejs/builds/${uuid}/logs?from_line=0`,
    );
    console.error(brief(logs.data));
  }
  process.exit(1);
}

const cache = await api("DELETE", `/api/hosting/v1/accounts/${USERNAME}/websites/${DOMAIN}/cache/clear`);
console.log("cache:", cache.status, brief(cache.data));
const cdn = await api("DELETE", `/api/hosting/v1/accounts/${USERNAME}/websites/${DOMAIN}/cdn/purge`);
console.log("cdn:", cdn.status, brief(cdn.data));

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
