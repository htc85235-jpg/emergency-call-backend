// Shared device token store with persistent Vercel env var backing.
//
// On Vercel, serverless instances are ephemeral and don't share in-memory state
// across requests. To work around this for our single-device use case, we:
//   1. Cache the token in globalThis (so warm invocations don't need to hit Vercel API)
//   2. Persist it to the FCM_DEVICE_TOKEN Vercel env var via the Vercel REST API
//   3. On cold start, read FCM_DEVICE_TOKEN from process.env (Vercel injects env vars)
//
// Required env vars:
//   VERCEL_TOKEN       — Vercel API token
//   VERCEL_PROJECT_ID  — project id
//   VERCEL_TEAM_ID     — team id (optional)
//
// Fallback: if Vercel API isn't configured, we just use globalThis (works only
// within a single warm instance — fine for testing).

const VERCEL_API_BASE = 'https://api.vercel.com/v9/projects';

function getStore() {
  if (!globalThis._deviceStore) {
    globalThis._deviceStore = {
      token: null,
      registeredAt: null,
    };
  }
  return globalThis._deviceStore;
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
  if (!res.ok) {
    throw new Error(`Vercel list envs failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.envs || [];
}

async function deleteEnv(envId) {
  await fetch(vercelEnvUrl(envId), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  });
}

async function createEnv(key, value, encrypted = true) {
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
    throw new Error(`Vercel create env failed: HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

// Best-effort persist of the token to the FCM_DEVICE_TOKEN env var.
// We don't block on this — if it fails, the in-memory store still works for
// the current warm instance. Errors are logged but not thrown.
async function persistToken(token) {
  if (!vercelConfigured()) return;
  try {
    const envs = await listEnvs();
    const existing = envs.find((e) => e.key === 'FCM_DEVICE_TOKEN');
    if (existing) {
      await deleteEnv(existing.id);
    }
    await createEnv('FCM_DEVICE_TOKEN', token, true);
    console.log(`[device-store] Token persisted to FCM_DEVICE_TOKEN env var (length=${token.length})`);
  } catch (e) {
    console.error(`[device-store] Persist failed (continuing with in-memory only): ${e.message}`);
  }
}

module.exports = {
  // Sync getter: returns cached token from globalThis, or from process.env (cold start).
  // The cache is populated by setToken() and by loadTokenFromEnv() on first read.
  getToken: () => {
    const s = getStore();
    if (s.token) return s.token;
    // Cold-start fallback: read from process.env (Vercel injects env vars at startup).
    // NOTE: This won't see updates made AFTER this instance started. setToken()
    // calls persistToken() which updates the env var — but only future cold starts
    // will see it. For our scale (single phone, low traffic) this is acceptable.
    if (process.env.FCM_DEVICE_TOKEN) {
      s.token = process.env.FCM_DEVICE_TOKEN;
      s.registeredAt = s.registeredAt || 0;
      return s.token;
    }
    return null;
  },

  // Async setter: updates the in-memory store AND persists to Vercel env var.
  setToken: (t) => {
    const s = getStore();
    s.token = t;
    s.registeredAt = Date.now();
    // Fire-and-forget the persistence
    persistToken(t).catch((e) => console.error(`[device-store] persistToken threw: ${e.message}`));
  },

  clearToken: () => {
    const s = getStore();
    s.token = null;
    s.registeredAt = null;
    // Note: We don't delete the env var on clear — clearing is rare and a stale
    // env var just means the next cold start will load a token that won't work.
    // The /api/emergency-call handler returns 410 on "token not registered" errors
    // which the website can handle.
  },

  getRegisteredAt: () => getStore().registeredAt,
};
