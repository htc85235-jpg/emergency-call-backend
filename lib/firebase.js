// Shared Firebase Admin initialization for Vercel serverless functions.
// Cached across warm invocations via globalThis.
//
// Reads one of two env vars (first match wins):
//   FIREBASE_SERVICE_ACCOUNT_B64  — base64-encoded service account JSON (preferred)
//   FIREBASE_SERVICE_ACCOUNT      — raw service account JSON (fallback for legacy deployments)
const admin = require('firebase-admin');

function decodeServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64 && b64.trim()) {
    const jsonStr = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(jsonStr);
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && raw.trim()) {
    // Some deployments store the raw JSON string; some store a JSON-stringified
    // version (i.e. the value is a quoted string). Handle both.
    try {
      return JSON.parse(raw);
    } catch (e) {
      // If raw isn't valid JSON, maybe it's already an object in some envs (shouldn't be).
      throw new Error(`FIREBASE_SERVICE_ACCOUNT is set but not valid JSON: ${e.message}`);
    }
  }
  throw new Error(
    'Neither FIREBASE_SERVICE_ACCOUNT_B64 nor FIREBASE_SERVICE_ACCOUNT env var is set. ' +
    'Set one of them with the Firebase service account JSON (base64-encoded or raw).'
  );
}

function getAdmin() {
  if (!globalThis._firebaseAdmin) {
    const serviceAccount = decodeServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    globalThis._firebaseAdmin = admin;
    globalThis._firebaseProjectId = serviceAccount.project_id;
  }
  return globalThis._firebaseAdmin;
}

module.exports = { getAdmin };
