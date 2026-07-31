// GET /api/admin/device?deviceId=X
//
// Admin endpoint to view a device's latest status and pending command.
// Auth: X-Admin-Token header (or Authorization: Bearer <token>)
//
// Response:
//   200 { status, latestCommand }
//   401 { error: "Unauthorized" }
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { checkAdminToken, getLatestCommand, getDeviceStatus } = require('../../lib/command-store');

  if (!checkAdminToken(req)) {
    return res.status(401).json({ error: 'Unauthorized — provide X-Admin-Token header' });
  }

  const deviceId = req.query.deviceId;

  try {
    const [status, latestCommand] = await Promise.all([getDeviceStatus(), getLatestCommand()]);

    // Filter: only show status/command for the requested device
    const deviceStatus = (status && (!deviceId || status.deviceId === deviceId)) ? status : null;
    const deviceCommand = (latestCommand && (!deviceId || latestCommand.deviceId === deviceId)) ? latestCommand : null;

    return res.status(200).json({
      status: deviceStatus,
      latestCommand: deviceCommand,
      serverTime: Date.now(),
    });
  } catch (e) {
    console.error('[admin/device] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
