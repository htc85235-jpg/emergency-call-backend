// POST /api/register-token
// Body: { "token": "<raw-fcm-token>" }
//
// The phone app calls this on launch to register its FCM token.
// We store it so /api/emergency-call can target it with FCM pushes.
//
// Response: { success: true, token_length: N, timestamp: ... }
//   token_length is returned so the app can verify the token was actually stored.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      error: 'Missing or invalid token',
      hint: 'Provide a raw FCM token string from Notifications.getDevicePushTokenAsync().',
    });
  }

  // Basic sanity check: FCM tokens are usually 100+ chars and contain alphanumeric + _-: characters
  // Reject Expo-format tokens (they start with "ExpoPushToken[")
  if (token.startsWith('ExpoPushToken[')) {
    return res.status(400).json({
      error: 'Received an Expo-format token, not a raw FCM token.',
      hint: 'Use Notifications.getDevicePushTokenAsync() instead of getExpoPushTokenAsync(). The Firebase Admin SDK can only send to raw FCM tokens.',
    });
  }

  const { setToken } = require('../lib/device-store');
  setToken(token);

  console.log(`[register-token] Device registered at ${new Date().toISOString()}, token length=${token.length}`);
  return res.status(200).json({
    success: true,
    message: 'Token registered',
    token_length: token.length,
    timestamp: Date.now(),
  });
};
