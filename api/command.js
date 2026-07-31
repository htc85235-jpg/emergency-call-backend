// POST /api/command
//
// Admin endpoint to send a command to a device.
// Auth: X-Admin-Token header (or Authorization: Bearer <token>)
//
// Body: { deviceId, type, payload }
//
// Supported command types:
//   ping          — payload: { message } — app logs it, no UI
//   show_message  — payload: { title, body } — app shows modal
//   show_call     — payload: { callerName, callId } — app shows incoming call UI
//   dismiss       — payload: {} — dismiss any modal/call UI
//   set_config    — payload: { ... } — app logs config update (future use)
//
// Response:
//   200 { success, seq, command }
//   401 { error: "Unauthorized" }
//   400 { error: "Missing deviceId/type" }
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { checkAdminToken, setLatestCommand } = require('../lib/command-store');

  if (!checkAdminToken(req)) {
    return res.status(401).json({ error: 'Unauthorized — provide X-Admin-Token header' });
  }

  const { deviceId, type, payload } = req.body || {};

  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid deviceId' });
  }
  if (!type || typeof type !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid type' });
  }

  const seq = Date.now();
  const command = {
    seq,
    deviceId,
    type,
    payload: payload || {},
    createdAt: new Date().toISOString(),
  };

  try {
    await setLatestCommand(command);
    console.log(`[command] Queued ${type} for ${deviceId.substring(0, 8)}… seq=${seq}`);
    return res.status(200).json({ success: true, seq, command });
  } catch (e) {
    console.error('[command] Failed:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
