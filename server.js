const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ---- Initialize Firebase Admin SDK ----
// The service account JSON is provided as a base64-encoded environment variable
// (FIREBASE_SERVICE_ACCOUNT_B64). This avoids needing a secret file on disk.
// Render's free tier supports env vars natively, so this is the simplest path.
const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
if (!b64) {
  console.error('ERROR: FIREBASE_SERVICE_ACCOUNT_B64 env var is not set.');
  console.error('Set it to the base64-encoded service account JSON.');
  process.exit(1);
}

let serviceAccount;
try {
  const jsonStr = Buffer.from(b64, 'base64').toString('utf8');
  serviceAccount = JSON.parse(jsonStr);
  console.log('Firebase service account loaded for project:', serviceAccount.project_id);
} catch (err) {
  console.error('ERROR: Failed to decode FIREBASE_SERVICE_ACCOUNT_B64:', err.message);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

// ---- In-memory device token store ----
// In production you'd use a database. For this simple v1, we store the device
// token in memory. (Restart loses it — phone app re-registers on next open.)
let deviceToken = null;
let deviceRegisteredAt = null;

// ---- Routes ----

// Health check (Render uses this to know the server is alive)
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    deviceRegistered: !!deviceToken,
    uptime: process.uptime()
  });
});

// Register a device token (your phone app will call this on first open)
app.post('/register-token', (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid token' });
  }
  deviceToken = token;
  deviceRegisteredAt = Date.now();
  console.log('Device registered:', token.substring(0, 25) + '...');
  res.json({ success: true, registeredAt: deviceRegisteredAt });
});

// Check if a device is currently registered (used by the website to know if
// the backend can deliver an emergency call right now)
app.get('/device-status', (req, res) => {
  res.json({
    registered: !!deviceToken,
    registeredAt: deviceRegisteredAt
  });
});

// Trigger an emergency call (your website will call this when the user taps
// the Emergency Call button). Sends a high-priority FCM push to your phone.
app.post('/emergency-call', async (req, res) => {
  const { callerName } = req.body;

  if (!deviceToken) {
    return res.status(400).json({
      error: 'No device registered. Open the app on your phone first.'
    });
  }

  if (!callerName || typeof callerName !== 'string') {
    return res.status(400).json({ error: 'Missing callerName' });
  }

  // Build the high-priority FCM message. This wakes the phone even from lock
  // screen on Android, plays the configured ringtone, and vibrates.
  const message = {
    token: deviceToken,
    notification: {
      title: 'Incoming Emergency Call',
      body: `${callerName} is calling you`
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'emergency_call',
        priority: 'max',
        sound: 'emergency_ringtone',
        vibrateTimingsMillis: [0, 1000, 500, 1000],
        visibility: 'public',
        icon: 'ic_notification',
        color: '#1d4ed8',
        tag: 'emergency_call',
        defaultSound: false,
        defaultVibrateTimings: false
      }
    },
    data: {
      type: 'emergency_call',
      callerName: callerName,
      callId: `call_${Date.now()}`,
      timestamp: String(Date.now())
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(`Emergency push sent to ${callerName}. Message ID:`, response);
    res.json({
      success: true,
      messageId: response,
      callId: `call_${Date.now()}`,
      callerName: callerName
    });
  } catch (error) {
    console.error('Push failed:', error.message);
    if (error.code === 'messaging/registration-token-not-registered') {
      deviceToken = null;
      deviceRegisteredAt = null;
      return res.status(410).json({
        error: 'Device token is no longer valid. Open the app on your phone to re-register.'
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// ---- Start server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Emergency call backend running on port ${PORT}`);
  console.log('Firebase project:', serviceAccount.project_id);
});
