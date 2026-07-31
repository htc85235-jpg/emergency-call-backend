// POST /api/status
//
// Called by the app every 15 seconds to report its state.
// No auth required (device self-reports).
//
// Body: { deviceId, isOnline, lastSeq, logs, appVersion, deviceModel, ... }
//
// Response: { success, serverTime }
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { deviceId } = body;

  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ error: 'Missing deviceId' });
  }

  const { setDeviceStatus } = require('../lib/command-store');

  const status = {
    ...body,
    lastSeen: Date.now(),
    lastSeenISO: new Date().toISOString(),
  };

  // Cap logs to avoid exceeding env var size limits (4KB max for plain)
  if (Array.isArray(status.logs)) {
    status.logs = status.logs.slice(-10).map((l) =>
      typeof l === 'string' ? l.substring(0, 150) : String(l).substring(0, 150)
    );
  }

  try {
    await setDeviceStatus(status);
    return res.status(200).json({ success: true, serverTime: Date.now() });
  } catch (e) {
    console.error('[status] Failed:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
