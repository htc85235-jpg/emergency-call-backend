// POST /api/register-token
// Body: { "token": "<fcm-or-expo-push-token>" }
// Stores the device token so /api/emergency-call can send FCM pushes to it.
module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid token' });
  }

  const { setToken } = require('../lib/device-store');
  setToken(token);

  console.log(`[register-token] Device registered at ${new Date().toISOString()}`);
  return res.status(200).json({
    success: true,
    message: 'Token registered',
    timestamp: Date.now(),
  });
};
