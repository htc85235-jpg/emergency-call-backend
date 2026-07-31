// GET /api/manifest
// Expo Updates protocol endpoint.
// Reference: https://docs.expo.dev/technical-specification/expo-updates-1/
//
// Query params (sent by expo-updates client):
//   runtimeVersion  — e.g. "1.0.0" (matches app.json's expo.version since policy=appVersion)
//   platform        — "android" | "ios"
//   deviceModel     — device model name (informational)
//
// Response:
//   200 with JSON manifest if an update is available
//   204 No Content if no update available (app stays on its embedded bundle)
//
// Manifest format (simplified for expo-updates protocol v1):
// {
//   "id": "<unique-uuid>",
//   "createdAt": "<ISO timestamp>",
//   "runtimeVersion": "1.0.0",
//   "metadata": { "appVersion": "1.0.0" },
//   "assets": [],
//   "launchAsset": {
//     "key": "bundle.js",
//     "contentType": "application/javascript",
//     "url": "https://emergency-backend-eight.vercel.app/api/bundle",
//     "hash": "<sha256-base64-of-bundle>",
//     "extra": { "createdAt": "<ISO>" }
//   }
// }

const crypto = require('crypto');

function getStoredBundle() {
  // Stored in a Vercel env var (type "plain" so we can read it at runtime).
  // Format: JSON with { code, hash, createdAt, id }
  const raw = process.env.OTA_BUNDLE_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('[manifest] Failed to parse OTA_BUNDLE_JSON:', e.message);
    return null;
  }
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Expo-Platform, Expo-Runtime-Version');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const runtimeVersion = req.query.runtimeVersion || '1.0.0';
  const platform = req.query.platform || (req.headers['expo-platform'] || 'android');
  const appVersion = req.query.appVersion || runtimeVersion;

  console.log(`[manifest] runtimeVersion=${runtimeVersion} platform=${platform} ua=${req.headers['user-agent'] || 'unknown'}`);

  const bundle = getStoredBundle();
  if (!bundle || !bundle.code) {
    // No update published yet — tell client to use embedded bundle.
    console.log('[manifest] No OTA bundle published, returning 204');
    return res.status(204).end();
  }

  // Hash must match what the bundle endpoint will serve (sha256 of bundle.code, base64).
  const hash = bundle.hash || crypto.createHash('sha256').update(bundle.code).digest('base64');

  const manifest = {
    id: bundle.id || `update-${Date.now()}`,
    createdAt: bundle.createdAt || new Date().toISOString(),
    runtimeVersion,
    metadata: { appVersion },
    assets: [],
    launchAsset: {
      key: 'bundle.js',
      contentType: 'application/javascript',
      url: 'https://emergency-backend-eight.vercel.app/api/bundle',
      hash,
      extra: {
        createdAt: bundle.createdAt || new Date().toISOString(),
      },
    },
  };

  return res.status(200).json(manifest);
};
