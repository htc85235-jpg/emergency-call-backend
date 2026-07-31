// In-memory device token store (per serverless instance).
// NOTE: Vercel serverless instances are ephemeral and may lose state on cold start.
// For production you should use Vercel KV, Upstash Redis, or a database.
// For this app's scale (single phone, single backend instance) memory is acceptable.

// We attach to globalThis so warm invocations share state.
function getStore() {
  if (!globalThis._deviceStore) {
    globalThis._deviceStore = {
      token: null,
      registeredAt: null,
    };
  }
  return globalThis._deviceStore;
}

module.exports = {
  getToken: () => getStore().token,
  setToken: (t) => {
    const s = getStore();
    s.token = t;
    s.registeredAt = Date.now();
  },
  clearToken: () => {
    const s = getStore();
    s.token = null;
    s.registeredAt = null;
  },
  getRegisteredAt: () => getStore().registeredAt,
};
