// GET /api/poll?deviceId=X&lastSeq=N
//
// Called by the app every 5 seconds. Returns any new command for this device.
//
// Response:
//   200 { commands: [{seq, type, payload, createdAt}], serverTime: <ms> }
//   200 { commands: [], serverTime: <ms> }  — no new commands
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const deviceId = req.query.deviceId;
  const lastSeq = parseInt(req.query.lastSeq, 10) || 0;

  if (!deviceId) {
    return res.status(400).json({ error: 'Missing deviceId' });
  }

  const { getLatestCommand } = require('../lib/command-store');

  try {
    const cmd = await getLatestCommand();

    const commands = [];
    if (cmd && cmd.deviceId === deviceId && cmd.seq > lastSeq) {
      commands.push(cmd);
    }

    return res.status(200).json({
      commands,
      serverTime: Date.now(),
    });
  } catch (e) {
    console.error('[poll] Error:', e.message);
    return res.status(200).json({ commands: [], serverTime: Date.now(), error: e.message });
  }
};
