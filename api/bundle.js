// GET /api/bundle
// Serves the JS bundle that /api/manifest points to.
// Reads from the OTA_BUNDLE_JSON env var (type "plain") so it can serve at runtime.
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const raw = process.env.OTA_BUNDLE_JSON;
  if (!raw) {
    return res.status(404).end('// No OTA bundle published yet');
  }

  let bundle;
  try {
    bundle = JSON.parse(raw);
  } catch (e) {
    console.error('[bundle] Failed to parse OTA_BUNDLE_JSON:', e.message);
    return res.status(500).end('// Server error: invalid bundle JSON');
  }

  if (!bundle || !bundle.code) {
    return res.status(404).end('// No bundle code');
  }

  return res.status(200).send(bundle.code);
};
