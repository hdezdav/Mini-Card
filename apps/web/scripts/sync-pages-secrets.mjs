#!/usr/bin/env node
// Push the server-side Mixpanel env vars from .env.local to Cloudflare Pages
// as encrypted secrets. Run from the apps/web package: `pnpm pages:secrets`.
//
// Reads apps/web/.env.local for:
//   MIXPANEL_SERVICE_ACCOUNT_USER
//   MIXPANEL_SERVICE_ACCOUNT_SECRET
//   MIXPANEL_PROJECT_ID
//   CF_API_TOKEN     -> used as CLOUDFLARE_API_TOKEN to authenticate wrangler
//   CF_ACCOUNT_ID    -> used as CLOUDFLARE_ACCOUNT_ID (optional but recommended)
//
// Each MIXPANEL_* value is piped to `wrangler pages secret put` over stdin so
// it never appears on the command line or in the terminal output. Encrypted
// secrets are available to the edge runtime via getOptionalRequestContext().env
// in src/app/api/web-analytics/route.ts — no redeploy is required after upload.

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

const PROJECT_NAME = process.env.PAGES_PROJECT_NAME || "minicard";

const SECRETS = [
  "MIXPANEL_SERVICE_ACCOUNT_USER",
  "MIXPANEL_SERVICE_ACCOUNT_SECRET",
  "MIXPANEL_PROJECT_ID",
];

// Minimal .env parser: KEY=VALUE per line, skips comments/blanks, strips quotes.
function parseEnv(path) {
  const map = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

const env = parseEnv(envPath);

const missingSecrets = SECRETS.filter((k) => !env[k]);
if (missingSecrets.length) {
  console.error(`✗ Missing in ${envPath}: ${missingSecrets.join(", ")}`);
  process.exit(1);
}

// Prefer an interactive `wrangler login` session over the .env.local token:
// the CF_API_TOKEN in .env.local may be a Cloudflare *user* token (cfut_*)
// which wrangler does not accept. Only inject CLOUDFLARE_API_TOKEN when it is
// present and does not look like a user token.
const looksLikeUserToken = env.CF_API_TOKEN?.startsWith("cfut_");

// Build the child env. CF_API_TOKEN is deprecated by wrangler and, when
// present, takes precedence over the OAuth `wrangler login` session — so we
// ALWAYS strip it. We only inject CLOUDFLARE_API_TOKEN when we have a real
// (non-user) token; otherwise we let the OAuth session apply.
const wranglerEnv = { ...process.env };
delete wranglerEnv.CF_API_TOKEN;
if (env.CF_API_TOKEN && !looksLikeUserToken) {
  wranglerEnv.CLOUDFLARE_API_TOKEN = env.CF_API_TOKEN;
} else {
  delete wranglerEnv.CLOUDFLARE_API_TOKEN;
}
if (env.CF_ACCOUNT_ID) wranglerEnv.CLOUDFLARE_ACCOUNT_ID = env.CF_ACCOUNT_ID;

if (!env.CF_API_TOKEN || looksLikeUserToken) {
  console.log(
    "ℹ No usable CF_API_TOKEN — will rely on an existing `wrangler login` session."
  );
  if (looksLikeUserToken) {
    console.log(
      "  (CF_API_TOKEN in .env.local is a user token cfut_*, which wrangler rejects.)"
    );
  }
  console.log("  If this fails, run `wrangler login` or set a real API token.");
}

function putSecret(name, value) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "wrangler",
      ["pages", "secret", "put", name, "--project-name", PROJECT_NAME],
      { env: wranglerEnv, stdio: ["pipe", "inherit", "inherit"], shell: true }
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`wrangler exited with code ${code} for ${name}`))
    );
    child.stdin.write(value);
    child.stdin.end();
  });
}

console.log(`Uploading Mixpanel secrets to Pages project "${PROJECT_NAME}"...`);
for (const name of SECRETS) {
  process.stdout.write(`→ ${name} ... `);
  try {
    await putSecret(name, env[name]);
    console.log("ok");
  } catch (err) {
    console.log("FAILED");
    console.error(err);
    process.exit(1);
  }
}

console.log("✓ All Mixpanel secrets uploaded.");
console.log(
  "  They are available to /api/web-analytics on the next request (no redeploy needed)."
);
