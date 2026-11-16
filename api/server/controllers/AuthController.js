const cookies = require('cookie');
const jwt = require('jsonwebtoken');
const openIdClient = require('openid-client');
const { logger } = require('@librechat/data-schemas');
const { isEnabled, findOpenIDUser } = require('@librechat/api');
const {
  requestPasswordReset,
  setOpenIDAuthTokens,
  resetPassword,
  setAuthTokens,
  registerUser,
  requestSessionReset,
  verifySessionReset,
} = require('~/server/services/AuthService');
const {
  deleteAllUserSessions,
  getUserById,
  findSession,
  updateUser,
  findUser,
} = require('~/models');
const { getGraphApiToken } = require('~/server/services/GraphTokenService');
const { getOAuthReconnectionManager } = require('~/config');
const { getOpenIdConfig } = require('~/strategies');

const registrationController = async (req, res) => {
  try {
    const response = await registerUser(req.body);
    const { status, message } = response;
    res.status(status).send({ message });
  } catch (err) {
    logger.error('[registrationController]', err);
    return res.status(500).json({ message: err.message });
  }
};

const resetPasswordRequestController = async (req, res) => {
  try {
    const resetService = await requestPasswordReset(req);
    if (resetService instanceof Error) {
      return res.status(400).json(resetService);
    } else {
      return res.status(200).json(resetService);
    }
  } catch (e) {
    logger.error('[resetPasswordRequestController]', e);
    return res.status(400).json({ message: e.message });
  }
};

const resetPasswordController = async (req, res) => {
  try {
    const resetPasswordService = await resetPassword(
      req.body.userId,
      req.body.token,
      req.body.password,
    );
    if (resetPasswordService instanceof Error) {
      return res.status(400).json(resetPasswordService);
    } else {
      await deleteAllUserSessions({ userId: req.body.userId });
      return res.status(200).json(resetPasswordService);
    }
  } catch (e) {
    logger.error('[resetPasswordController]', e);
    return res.status(400).json({ message: e.message });
  }
};

/**
 * Rejects a refresh request that can never succeed and logs the reason without any token data.
 * Uses 403 so the client's 401 refresh interceptor does not try to refresh the refresh call again.
 */
const rejectRefresh = (res, reason, { userId, sessionId } = {}) => {
  logger.warn(
    `[refreshController] Session validation failed: reason=${reason} user=${userId ?? 'unknown'} session=${sessionId ?? 'unknown'} at=${new Date().toISOString()}`,
  );
  return res.status(403).json({ message: 'Session is no longer valid', code: reason });
};

const refreshController = async (req, res) => {
  const refreshToken = req.headers.cookie ? cookies.parse(req.headers.cookie).refreshToken : null;
  const token_provider = req.headers.cookie
    ? cookies.parse(req.headers.cookie).token_provider
    : null;
  if (!refreshToken) {
    return res.status(200).send('Refresh token not provided');
  }
  if (token_provider === 'openid' && isEnabled(process.env.OPENID_REUSE_TOKENS) === true) {
    try {
      const openIdConfig = getOpenIdConfig();
      const tokenset = await openIdClient.refreshTokenGrant(openIdConfig, refreshToken);
      const claims = tokenset.claims();
      const { user, error, migration } = await findOpenIDUser({
        findUser,
        email: claims.email,
        openidId: claims.sub,
        idOnTheSource: claims.oid,
        strategyName: 'refreshController',
      });

      logger.debug(
        `[refreshController] findOpenIDUser result: user=${user?.email ?? 'null'}, error=${error ?? 'null'}, migration=${migration}, userOpenidId=${user?.openidId ?? 'null'}, claimsSub=${claims.sub}`,
      );

      if (error || !user) {
        logger.warn(
          `[refreshController] Redirecting to /login: error=${error ?? 'null'}, user=${user ? 'exists' : 'null'}`,
        );
        return res.status(401).redirect('/login');
      }

      // Handle migration: update user with openidId if found by email without openidId
      // Also handle case where user has mismatched openidId (e.g., after database switch)
      if (migration || user.openidId !== claims.sub) {
        const reason = migration ? 'migration' : 'openidId mismatch';
        await updateUser(user._id.toString(), {
          provider: 'openid',
          openidId: claims.sub,
        });
        logger.info(
          `[refreshController] Updated user ${user.email} openidId (${reason}): ${user.openidId ?? 'null'} -> ${claims.sub}`,
        );
      }

      const token = setOpenIDAuthTokens(tokenset, res, user._id.toString(), refreshToken);

      user.federatedTokens = {
        access_token: tokenset.access_token,
        id_token: tokenset.id_token,
        refresh_token: refreshToken,
        expires_at: claims.exp,
      };

      return res.status(200).send({ token, user });
    } catch (error) {
      logger.error('[refreshController] OpenID token refresh error', error);
      return res.status(403).send('Invalid OpenID refresh token');
    }
  }
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    const reason = err?.name === 'TokenExpiredError' ? 'REFRESH_TOKEN_EXPIRED' : 'REFRESH_TOKEN_INVALID';
    return rejectRefresh(res, reason);
  }

  const userId = payload.id;
  const sessionId = payload.sessionId;

  try {
    const user = await getUserById(userId, '-password -__v -totpSecret -backupCodes');
    if (!user) {
      return rejectRefresh(res, 'USER_NOT_FOUND', { userId, sessionId });
    }

    if (!user.isVerified) {
      return rejectRefresh(res, 'USER_NOT_VERIFIED', { userId, sessionId });
    }

    if (process.env.NODE_ENV === 'CI') {
      const token = await setAuthTokens(userId, res);
      return res.status(200).send({ token, user });
    }

    /** Active session matching the current (or just-rotated) refresh token */
    const session = await findSession({ userId, refreshToken }, { lean: false });

    if (!session) {
      // The JWT is still valid, so the session was revoked (logout, remote logout, password reset)
      // or the token was replaced by a rotation outside the grace window.
      return rejectRefresh(res, 'SESSION_REVOKED_OR_TOKEN_MISMATCH', { userId, sessionId });
    }

    const token = await setAuthTokens(userId, res, session, refreshToken);

    // trigger OAuth MCP server reconnection asynchronously (best effort)
    try {
      void getOAuthReconnectionManager()
        .reconnectServers(userId)
        .catch((err) => {
          logger.error('[refreshController] Error reconnecting OAuth MCP servers:', err);
        });
    } catch (err) {
      logger.warn(`[refreshController] Cannot attempt OAuth MCP servers reconnection:`, err);
    }

    return res.status(200).send({ token, user });
  } catch (err) {
    // Database or infrastructure failure: the session may still be valid, so the client must not log out.
    logger.error(
      `[refreshController] Session validation could not be completed: reason=SESSION_VALIDATION_UNAVAILABLE user=${userId} session=${sessionId ?? 'unknown'} at=${new Date().toISOString()}`,
      err,
    );
    return res.status(503).json({
      message: 'Session validation is temporarily unavailable',
      code: 'SESSION_VALIDATION_UNAVAILABLE',
    });
  }
};

const graphTokenController = async (req, res) => {
  try {
    // Validate user is authenticated via Entra ID
    if (!req.user.openidId || req.user.provider !== 'openid') {
      return res.status(403).json({
        message: 'Microsoft Graph access requires Entra ID authentication',
      });
    }

    // Check if OpenID token reuse is active (required for on-behalf-of flow)
    if (!isEnabled(process.env.OPENID_REUSE_TOKENS)) {
      return res.status(403).json({
        message: 'SharePoint integration requires OpenID token reuse to be enabled',
      });
    }

    // Extract access token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Valid authorization token required',
      });
    }

    // Get scopes from query parameters
    const scopes = req.query.scopes;
    if (!scopes) {
      return res.status(400).json({
        message: 'Graph API scopes are required as query parameter',
      });
    }

    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    const tokenResponse = await getGraphApiToken(req.user, accessToken, scopes);

    res.json(tokenResponse);
  } catch (error) {
    logger.error('[graphTokenController] Failed to obtain Graph API token:', error);
    res.status(500).json({
      message: 'Failed to obtain Microsoft Graph token',
    });
  }
};

const requestSessionResetController = async (req, res) => {
  try {
    const result = await requestSessionReset(req);
    if (result instanceof Error) {
      return res.status(400).json({ message: result.message });
    }
    return res.status(result.status || 200).json(result);
  } catch (e) {
    logger.error('[requestSessionResetController]', e);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

const getSessionResetClientUrl = (req) => {
  const custom = req.body?.client_url || req.query?.client_url;
  if (custom) {
    return custom;
  }
  if (process.env.DOMAIN_CLIENT) {
    return process.env.DOMAIN_CLIENT;
  }
  const reqHost = req?.get ? req.get('host') : req?.headers?.host;
  if (reqHost && (reqHost.includes('localhost') || reqHost.includes('127.0.0.1'))) {
    return 'http://localhost:3090';
  }
  return 'http://localhost:3080';
};

const renderSuccessHtml = (email, loginUrl) => {
  const safeEmail = (email || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeLoginUrl = (loginUrl || '/login').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sessions Terminated - Ajrasakha</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0d0d0d;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 1rem;
      padding: 2.25rem;
      width: 100%;
      max-width: 440px;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }
    .brand {
      color: #10b981;
      font-weight: 700;
      font-size: 1.1rem;
      margin-bottom: 1.25rem;
      letter-spacing: -0.01em;
    }
    .icon-container {
      width: 56px;
      height: 56px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
      color: #10b981;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.75rem;
      letter-spacing: -0.02em;
    }
    p {
      color: #a1a1aa;
      font-size: 0.875rem;
      line-height: 1.5;
      margin-bottom: 1.25rem;
    }
    .email-highlight {
      color: #ffffff;
      font-weight: 600;
      word-break: break-all;
    }
    .hint-box {
      background: rgba(24, 24, 27, 0.8);
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      padding: 0.85rem 1rem;
      margin-bottom: 1.5rem;
      color: #d4d4d8;
      font-size: 0.85rem;
      line-height: 1.45;
    }
    .btn-submit {
      display: inline-block;
      width: 100%;
      background-color: #16a34a;
      color: #ffffff;
      padding: 0.75rem 1.25rem;
      border: none;
      border-radius: 0.5rem;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease, transform 0.05s ease;
      text-decoration: none;
    }
    .btn-submit:hover {
      background-color: #15803d;
    }
    .btn-submit:active {
      transform: scale(0.99);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">annam.ai / Ajrasakha</div>
    <div class="icon-container">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    </div>
    <h1>Sessions Terminated!</h1>
    <p>
      All active sessions for <span class="email-highlight">${safeEmail}</span> have been successfully logged out, and your account is verified.
    </p>
    <div class="hint-box">
      You can now return to your open login window to sign in, or click below to proceed.
    </div>
    <a href="${safeLoginUrl}" class="btn-submit">Proceed to Login</a>
  </div>
</body>
</html>`;
};

const renderErrorHtml = (message, loginUrl) => {
  const safeMessage = (message || 'The verification link is invalid or has expired.').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeLoginUrl = (loginUrl || '/login').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verification Error - Ajrasakha</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0d0d0d;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 1rem;
      padding: 2.25rem;
      width: 100%;
      max-width: 440px;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }
    .brand {
      color: #10b981;
      font-weight: 700;
      font-size: 1.1rem;
      margin-bottom: 1.25rem;
      letter-spacing: -0.01em;
    }
    .icon-container {
      width: 56px;
      height: 56px;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
      color: #ef4444;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.75rem;
      letter-spacing: -0.02em;
    }
    p {
      color: #a1a1aa;
      font-size: 0.875rem;
      line-height: 1.5;
      margin-bottom: 1.5rem;
    }
    .btn-submit {
      display: inline-block;
      width: 100%;
      background-color: #27272a;
      color: #ffffff;
      padding: 0.75rem 1.25rem;
      border: 1px solid #3f3f46;
      border-radius: 0.5rem;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease;
      text-decoration: none;
    }
    .btn-submit:hover {
      background-color: #3f3f46;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">annam.ai / Ajrasakha</div>
    <div class="icon-container">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
    <h1>Unable to Terminate Sessions</h1>
    <p>${safeMessage}</p>
    <a href="${safeLoginUrl}" class="btn-submit">Return to Login</a>
  </div>
</body>
</html>`;
};

const confirmSessionResetController = async (req, res) => {
  const clientUrl = getSessionResetClientUrl(req);
  const email = (req.query?.email || req.body?.email || '').trim();
  const token = (req.query?.token || req.body?.token || '').trim();

  if (!email || !token) {
    return res.type('html').send(renderErrorHtml('Missing email or token.', `${clientUrl}/login`));
  }

  const safeEmail = email.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeToken = token.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeClientUrl = clientUrl.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const loginUrl = `${clientUrl}/login`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terminate Active Sessions - Ajrasakha</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0d0d0d;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 1rem;
      padding: 2.25rem;
      width: 100%;
      max-width: 440px;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }
    .brand {
      color: #10b981;
      font-weight: 700;
      font-size: 1.1rem;
      margin-bottom: 1.25rem;
      letter-spacing: -0.01em;
    }
    .icon-container {
      width: 56px;
      height: 56px;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
      color: #f59e0b;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.75rem;
      letter-spacing: -0.02em;
    }
    p {
      color: #a1a1aa;
      font-size: 0.875rem;
      line-height: 1.5;
      margin-bottom: 1.5rem;
    }
    .email-highlight {
      color: #ffffff;
      font-weight: 600;
      word-break: break-all;
    }
    .btn-submit {
      display: inline-block;
      width: 100%;
      background-color: #16a34a;
      color: #ffffff;
      padding: 0.75rem 1.25rem;
      border: none;
      border-radius: 0.5rem;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease, transform 0.05s ease;
      text-decoration: none;
    }
    .btn-submit:hover {
      background-color: #15803d;
    }
    .btn-submit:active {
      transform: scale(0.99);
    }
    .cancel-link {
      display: inline-block;
      margin-top: 1rem;
      color: #71717a;
      font-size: 0.8rem;
      text-decoration: none;
      transition: color 0.15s ease;
    }
    .cancel-link:hover {
      color: #a1a1aa;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">annam.ai / Ajrasakha</div>
    <div class="icon-container">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
      </svg>
    </div>
    <h1>Terminate Active Sessions</h1>
    <p>
      You requested to log out from other active devices for <span class="email-highlight">${safeEmail}</span> so you can sign in on this device.
    </p>
    <form method="POST" action="/api/auth/session-reset/verify">
      <input type="hidden" name="email" value="${safeEmail}" />
      <input type="hidden" name="token" value="${safeToken}" />
      <input type="hidden" name="client_url" value="${safeClientUrl}" />
      <button type="submit" class="btn-submit">Terminate Other Sessions &amp; Continue</button>
    </form>
    <a href="${loginUrl}" class="cancel-link">Cancel and return to Login</a>
  </div>
</body>
</html>`;

  res.type('html').send(html);
};

const verifySessionResetController = async (req, res) => {
  const clientUrl = getSessionResetClientUrl(req);
  const email = (req.body?.email || req.query?.email || '').trim();
  const loginUrl = `${clientUrl}/login?session_cleared=true`;
  const isFormSubmission =
    req.headers['content-type']?.includes('application/x-www-form-urlencoded') ||
    req.method === 'GET';

  try {
    const result = await verifySessionReset(req);
    if (result instanceof Error) {
      if (isFormSubmission) {
        return res.type('html').send(renderErrorHtml(result.message, `${clientUrl}/login?error=session_reset_failed`));
      }
      return res.status(400).json({ message: result.message });
    }

    if (isFormSubmission) {
      return res.type('html').send(renderSuccessHtml(email, loginUrl));
    }

    return res.status(result.status || 200).json(result);
  } catch (e) {
    logger.error('[verifySessionResetController]', e);
    if (isFormSubmission) {
      return res.type('html').send(renderErrorHtml('Something went wrong.', `${clientUrl}/login?error=session_reset_failed`));
    }
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

module.exports = {
  refreshController,
  registrationController,
  resetPasswordController,
  resetPasswordRequestController,
  graphTokenController,
  requestSessionResetController,
  confirmSessionResetController,
  verifySessionResetController,
};
