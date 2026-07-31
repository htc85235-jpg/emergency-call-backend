// GET /api/device-status
// Returns whether a device token is currently registered.
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { getToken, getRegisteredAt } = require('../lib/device-store');
  const token = getToken();

  return res.status(200).json({
    registered: !!token,
    registeredAt: getRegisteredAt(),
    timestamp: Date.now(),
  });
};
