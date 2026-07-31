// POST /api/emergency-call
// Body: { "callerName": "Mom" }
// Sends a high-priority FCM push notification to the registered device.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { callerName } = req.body || {};
  if (!callerName || typeof callerName !== 'string') {
    return res.status(400).json({ error: 'Missing callerName' });
  }

  const { getToken, clearToken } = require('../lib/device-store');
  const deviceToken = getToken();
  if (!deviceToken) {
    return res.status(409).json({
      error: 'No device registered. Open the app on your phone first to register its push token.',
    });
  }

  const { getAdmin } = require('../lib/firebase');
  const admin = getAdmin();

  const callId = `call_${Date.now()}`;
  const message = {
    token: deviceToken,
    notification: {
      title: 'Incoming Emergency Call',
      body: `${callerName} is calling you`,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'emergency_call',
        priority: 'max',
        sound: 'default',
        vibrateTimingsMillis: [0, 1000, 500, 1000],
        visibility: 'public',
        icon: 'ic_notification',
        color: '#ef4444',
        tag: 'emergency_call',
        defaultSound: false,
        defaultVibrateTimings: false,
      },
    },
    data: {
      type: 'emergency_call',
      callerName,
      callId,
      timestamp: String(Date.now()),
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(`[emergency-call] Push sent to ${callerName}. Message ID: ${response}`);
    return res.status(200).json({
      success: true,
      messageId: response,
      callId,
      callerName,
    });
  } catch (error) {
    console.error('[emergency-call] Push failed:', error.message);
    if (error.code === 'messaging/registration-token-not-registered') {
      clearToken();
      return res.status(410).json({
        error: 'Device token no longer valid. Open the app on your phone to re-register.',
      });
    }
    return res.status(500).json({ error: error.message });
  }
};
