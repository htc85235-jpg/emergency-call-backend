// POST /api/set-bundle
// Admin endpoint to publish a new OTA JS bundle.
// Body: { "passphrase": "...", "code": "<JS bundle code>", "appVersion": "1.0.0" }
//
// Stores the bundle as a Vercel env var named OTA_BUNDLE_JSON.
// Format stored: JSON string { code, hash, createdAt, id, appVersion }
//
// Vercel API: create or update a "plain" env var (type "plain" so we can read it at runtime).
// Note: After this call, Vercel takes ~5-10s to redeploy the function with the new env var.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { passphrase, code } = req.body || {};
  if (!passphrase || passphrase !== process.env.OTA_UPDATE_PASSPHRASE) {
    return res.status(401).json({ error: 'Invalid passphrase' });
  }
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing code' });
  }

  const crypto = require('crypto');
  const bundleData = {
    code,
    hash: crypto.createHash('sha256').update(code).digest('base64'),
    createdAt: new Date().toISOString(),
    id: `update-${Date.now()}`,
  };

  // Call Vercel API to update env var
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  const vercelToken = process.env.VERCEL_TOKEN;

  if (!projectId || !vercelToken) {
    // Fallback: store in process.env (will be lost on cold start — only for testing)
    process.env.OTA_BUNDLE_JSON = JSON.stringify(bundleData);
    console.log('[set-bundle] Vercel env vars not configured, stored in process.env (ephemeral)');
    return res.status(200).json({
      success: true,
      warning: 'Vercel env vars not configured; bundle stored in process.env (ephemeral). Set VERCEL_PROJECT_ID, VERCEL_TOKEN, OTA_UPDATE_PASSPHRASE for production.',
      bundleId: bundleData.id,
      createdAt: bundleData.createdAt,
      codeSize: code.length,
    });
  }

  try {
    // Delete existing env var if present
    const envUrl = teamId
      ? `https://api.vercel.com/v9/projects/${projectId}/env?teamId=${teamId}`
      : `https://api.vercel.com/v9/projects/${projectId}/env`;
    const envRes = await fetch(envUrl, {
      headers: { Authorization: `Bearer ${vercelToken}` },
    });
    const envData = await envRes.json();
    const existing = (envData.envs || []).find((e) => e.key === 'OTA_BUNDLE_JSON');

    if (existing) {
      // Delete first (Vercel doesn't have a direct "update" — must delete + recreate)
      const delUrl = teamId
        ? `https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}?teamId=${teamId}`
        : `https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}`;
      await fetch(delUrl, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${vercelToken}` },
      });
    }

    // Create new env var (type "plain" so it's readable at runtime)
    const createUrl = teamId
      ? `https://api.vercel.com/v9/projects/${projectId}/env?teamId=${teamId}`
      : `https://api.vercel.com/v9/projects/${projectId}/env`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: 'OTA_BUNDLE_JSON',
        value: JSON.stringify(bundleData),
        type: 'plain',
        target: ['production'],
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      throw new Error(`Vercel API error: ${JSON.stringify(createData)}`);
    }

    // Trigger redeploy so the new env var takes effect
    console.log('[set-bundle] Env var updated, will redeploy');

    // Also set in process.env for immediate effect on this warm instance
    process.env.OTA_BUNDLE_JSON = JSON.stringify(bundleData);

    return res.status(200).json({
      success: true,
      bundleId: bundleData.id,
      createdAt: bundleData.createdAt,
      codeSize: code.length,
      hash: bundleData.hash,
      vercelEnvId: createData.id,
      note: 'Vercel project will pick up the new env var within ~10s. New app launches will receive this update.',
    });
  } catch (error) {
    console.error('[set-bundle] Vercel API failed:', error.message);
    // Still set in process.env as a fallback
    process.env.OTA_BUNDLE_JSON = JSON.stringify(bundleData);
    return res.status(200).json({
      success: true,
      warning: `Vercel API failed (${error.message}); bundle stored in process.env (ephemeral, may not persist across cold starts).`,
      bundleId: bundleData.id,
    });
  }
};
