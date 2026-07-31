// Health check endpoint
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    status: 'ok',
    service: 'emergency-call-backend',
    timestamp: Date.now(),
    endpoints: [
      'GET  /api/device-status',
      'POST /api/register-token',
      'POST /api/emergency-call',
      'GET  /api/manifest',
      'GET  /api/bundle',
      'POST /api/set-bundle',
    ],
  });
};
