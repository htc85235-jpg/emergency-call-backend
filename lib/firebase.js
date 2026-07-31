// Shared Firebase Admin initialization for Vercel serverless functions.
// Cached across warm invocations via globalThis.
const admin = require('firebase-admin');

function getAdmin() {
  if (!globalThis._firebaseAdmin) {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (!b64) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 env var is not set');
    }
    const jsonStr = Buffer.from(b64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(jsonStr);
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
