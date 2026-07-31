// Persistent command and status storage using Vercel env vars.
//
// Vercel serverless instances don't share process.env, so we MUST read from
// the Vercel API to get the latest value (not just process.env which is stale
// on warm instances that didn't handle the write).
//
// Pattern:
//   - Writes: update process.env AND Vercel env var (via API)
//   - Reads: fetch from Vercel API (consistent across all instances)
//
// This is slower (1 Vercel API call per read) but guarantees consistency.

const VERCEL_API_BASE = 'https://api.vercel.com/v9/projects';

// Simple in-memory cache with TTL to reduce Vercel API calls.
// Cache for 2 seconds — enough to deduplicate rapid polls without going stale.
const CACHE_TTL_MS = 2000;
const cache = {};

function getCached(key) {
  const entry = cache[key];
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    delete cache[key];
    return undefined;
  }
  return entry.value;
}

function setCached(key, value) {
  cache[key] = { value, ts: Date.now() };
}

function vercelConfigured() {
  return !!(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
}

function vercelEnvUrl(envId) {
  const base = `${VERCEL_API_BASE}/${process.env.VERCEL_PROJECT_ID}/env`;
  const team = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : '';
  return envId ? `${base}/${envId}${team}` : `${base}${team}`;
}

async function listEnvs() {
  const res = await fetch(vercelEnvUrl(), {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Vercel list envs HTTP ${res.status}`);
  const data = await res.json();
  return data.envs || [];
}

async function deleteEnv(envId) {
  await fetch(vercelEnvUrl(envId), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  });
}

async function createEnv(key, value, encrypted = false) {
  const res = await fetch(vercelEnvUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      value,
      type: encrypted ? 'encrypted' : 'plain',
      target: ['production', 'preview', 'development'],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Vercel create env HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

// Upsert: delete existing + create new + update process.env for current instance.
async function upsertEnv(key, value, encrypted = false) {
  // Always update process.env (immediate for current instance)
  process.env[key] = value;
  // Update cache so subsequent reads on THIS instance see the new value
  setCached(key, value);

  if (!vercelConfigured()) return;

  try {
    const envs = await listEnvs();
    const existing = envs.find((e) => e.key === key);
    if (existing) await deleteEnv(existing.id);
    await createEnv(key, value, encrypted);
  } catch (e) {
    console.error(`[command-store] upsertEnv(${key}) failed: ${e.message}`);
    // process.env and cache are already set, so current instance still works
  }
}

// Read an env var value from the Vercel API (consistent across all instances).
// Falls back to process.env if the API is unavailable.
async function readEnvFromVercel(key) {
  // Check cache first (avoids Vercel API call on rapid polls)
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  if (!vercelConfigured()) {
    return process.env[key] || null;
  }

  try {
    const envs = await listEnvs();
    const env = envs.find((e) => e.key === key);
    const value = env?.value || null;
    setCached(key, value);
    // Also update process.env so the current instance has the latest
    if (value) process.env[key] = value;
    return value;
  } catch (e) {
    console.error(`[command-store] readEnvFromVercel(${key}) failed: ${e.message}`);
    return process.env[key] || null;
  }
}

// ---- Command storage ----
// LATEST_COMMAND env var: JSON { seq, deviceId, type, payload, createdAt }

async function getLatestCommand() {
  const raw = await readEnvFromVercel('LATEST_COMMAND');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setLatestCommand(cmd) {
  await upsertEnv('LATEST_COMMAND', JSON.stringify(cmd), false);
}

// ---- Status storage ----
// DEVICE_STATUS env var: JSON { deviceId, isOnline, lastSeq, logs, lastSeen, ... }

async function getDeviceStatus() {
  const raw = await readEnvFromVercel('DEVICE_STATUS');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setDeviceStatus(status) {
  await upsertEnv('DEVICE_STATUS', JSON.stringify(status), false);
}

// ---- Admin auth ----
function checkAdminToken(req) {
  const provided = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  const expected = process.env.ADMIN_TOKEN || process.env.OTA_UPDATE_PASSPHRASE;
  if (!expected) return false;
  return provided === expected;
}

module.exports = {
  getLatestCommand,
  setLatestCommand,
  getDeviceStatus,
  setDeviceStatus,
  checkAdminToken,
};
