const config = require('../config');

// Simple session storage (in-memory for this internal tool)
const sessions = new Map();

function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function authenticate(req, res, next) {
  const sessionId = req.headers['x-session-id'];

  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated. Please login.'
    });
  }

  next();
}

function login(req, res) {
  const { password } = req.body;

  if (password !== config.auth.password) {
    return res.status(401).json({
      success: false,
      error: 'Invalid password'
    });
  }

  const sessionId = generateSessionId();
  sessions.set(sessionId, { createdAt: Date.now() });

  res.json({
    success: true,
    sessionId
  });
}

module.exports = {
  authenticate,
  login,
};
