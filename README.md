# Emergency Call Backend

Serverless backend (Vercel) for the Emergency Call app. Provides:

- **`POST /api/register-token`** — phone app calls this on launch to register its FCM token
- **`GET /api/device-status`** — quick check whether a device is registered
- **`POST /api/emergency-call`** — `{ "callerName": "Mom" }` → sends a high-priority FCM push to the phone
- **`GET /api/manifest`** — Expo Updates protocol manifest endpoint (returns 204 if no OTA published, 200 + manifest if there is)
- **`GET /api/bundle`** — serves the OTA JS bundle
- **`POST /api/set-bundle`** — admin endpoint to publish a new OTA bundle

## Required environment variables (set in Vercel)

| Variable | Type | Purpose |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_B64` | encrypted | Base64-encoded Firebase service account JSON (with `cloudmessaging.messages.create` permission) |
| `OTA_UPDATE_PASSPHRASE` | encrypted | Passphrase required by `/api/set-bundle` (any string you choose) |
| `VERCEL_TOKEN` | encrypted | Vercel API token (used by `/api/set-bundle` to update the `OTA_BUNDLE_JSON` env var) |
| `VERCEL_PROJECT_ID` | plain | Vercel project ID of this backend (visible in project Settings → General) |
| `VERCEL_TEAM_ID` | plain | Optional, only if your project is under a team (in the URL `vercel.com/<team>/...`) |

The OTA bundle is stored in the env var `OTA_BUNDLE_JSON` (type `plain` so the manifest endpoint can read it at runtime).
