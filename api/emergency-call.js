// POST /api/emergency-call
//
// Request body (from website's emergency button):
//   { "callerName": "Website Caller", "callerId": "emg_123_abc" }
//   - callerId is the WebRTC room ID the website is listening on (PeerJS).
//   - The phone MUST use this same callerId to join the room when answering.
//
// Response (matches what the website's handleEmergencyCall() expects):
//   Success: 200 { status: "sent", call_id: "<callerId>", message_id: "<fcm_id>" }
//   No device: 409 { error: "...", hint: "..." }
//   Token invalid: 410 { error: "...", hint: "..." }
//   Server error: 500 { error: "...", hint: "..." }
//
// FCM data payload sent to phone (snake_case — matches what App.js reads):
//   { type: "emergency_call", caller_name, call_id, timestamp }
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { callerName, callerId } = req.body || {};

  // Validate callerName
  if (!callerName || typeof callerName !== 'string' || callerName.length > 100) {
    return res.status(400).json({
      error: 'Missing or invalid callerName',
      hint: 'Provide a callerName string (1–100 chars).',
    });
  }

  // callerId is the WebRTC room ID — required so the phone can join the same PeerJS room
  const callId = (typeof callerId === 'string' && callerId.length > 0 && callerId.length <= 200)
    ? callerId
    : `emg_${Date.now()}`;

  const { getToken, clearToken } = require('../lib/device-store');
  const deviceToken = getToken();
  if (!deviceToken) {
    return res.status(409).json({
      status: 'no_device',
      error: 'No device registered.',
      hint: 'Open the Emergency Call app on your phone first — it registers its push token on launch.',
    });
  }

  const { getAdmin } = require('../lib/firebase');
  const admin = getAdmin();

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
      caller_name: callerName,
      call_id: callId,
      timestamp: String(Date.now()),
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(`[emergency-call] Push sent to ${callerName}, call_id=${callId}, msg_id=${response}`);
    return res.status(200).json({
      status: 'sent',
      call_id: callId,
      message_id: response,
      caller_name: callerName,
    });
  } catch (error) {
    console.error('[emergency-call] Push failed:', error.message);
    if (error.code === 'messaging/registration-token-not-registered') {
      clearToken();
      return res.status(410).json({
        status: 'token_invalid',
        error: 'Device token no longer valid.',
        hint: 'Open the app on your phone to re-register its push token, then try again.',
      });
    }
    return res.status(500).json({
      status: 'error',
      error: error.message || 'FCM send failed',
      hint: 'Check Firebase service account credentials and that the FCM token is valid.',
    });
  }
};
