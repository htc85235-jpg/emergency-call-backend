# Emergency Call Backend

Tiny Node.js/Express backend that receives emergency call requests from your website and forwards them as high-priority FCM push notifications to your Android phone.

## Endpoints

- `GET /` — health check
- `POST /register-token` — register phone's FCM token (called by the mobile app)
- `GET /device-status` — check if a device is currently registered
- `POST /emergency-call` — trigger an emergency call push to the phone

## Required Environment Variables

- `FIREBASE_SERVICE_ACCOUNT_B64` — base64-encoded Firebase service account JSON
- `PORT` (auto-set by Render)

## Local Development

```bash
# Encode your service account JSON to base64
base64 -i firebase-service-account.json | tr -d '\n' > /tmp/b64.txt

# Set env var and run
export FIREBASE_SERVICE_ACCOUNT_B64=$(cat /tmp/b64.txt)
npm install
npm start
```
