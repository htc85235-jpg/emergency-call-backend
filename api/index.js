// Health check endpoint
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    status: 'ok',
    service: 'emergency-call-backend',
    timestamp: Date.now(),
    endpoints: [
      'GET  /api',
      'GET  /api/device-status',
      'POST /api/register-token',
      'POST /api/emergency-call',
      'GET  /api/manifest',
      'GET  /api/bundle',
      'POST /api/set-bundle',
      '---- remote-control endpoints ----',
      'GET  /api/poll?deviceId=X&lastSeq=N',
      'POST /api/command      (X-Admin-Token header)',
      'POST /api/status',
      'GET  /api/admin/device?deviceId=X  (X-Admin-Token header)',
    ],
  });
};
