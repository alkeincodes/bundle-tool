const config = require('../config');

// Cached token storage
let cachedToken = null;

/**
 * Get OAuth access token with caching
 * Automatically refreshes when expired
 */
async function getAccessToken() {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    console.log('[Platform] Using cached access token');
    return cachedToken.accessToken;
  }

  console.log('[Platform] Fetching new access token');

  const tokenBody = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.platform.clientId,
    client_secret: config.platform.clientSecret,
    scope: '',
  });

  const response = await fetch(`${config.platform.apiUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: tokenBody,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('[Platform] OAuth token error:', error);
    throw new Error(error.message || 'Failed to fetch OAuth token');
  }

  const data = await response.json();

  // Cache token with 60 second buffer before expiry
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000) - 60000,
  };

  console.log('[Platform] Access token obtained successfully');
  return cachedToken.accessToken;
}

/**
 * Make an authenticated request to the platform API
 * @param {Object} options - Request options
 * @param {string} options.endpoint - API endpoint (e.g., '/users')
 * @param {string} [options.method='POST'] - HTTP method
 * @param {Object} [options.body] - Request body
 * @param {string} [options.errorMessage] - Custom error message
 */
async function platformApiRequest(options) {
  const { endpoint, method = 'POST', body, errorMessage } = options;

  const accessToken = await getAccessToken();

  console.log(`[Platform] ${method} ${endpoint}`);

  const fetchOptions = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(`${config.platform.apiUrl}${endpoint}`, fetchOptions);

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(`[Platform] API Error (${endpoint}):`, data || response.statusText);
    throw {
      statusCode: response.status,
      message: data?.message || errorMessage || 'Platform API request failed',
      data,
    };
  }

  return data;
}

/**
 * Clear the cached token (useful for testing or forced refresh)
 */
function clearTokenCache() {
  cachedToken = null;
  console.log('[Platform] Token cache cleared');
}

module.exports = {
  getAccessToken,
  platformApiRequest,
  clearTokenCache,
};
