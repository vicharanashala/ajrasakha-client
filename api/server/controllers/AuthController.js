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

module.exports = {
  refreshController,
  registrationController,
  resetPasswordController,
  resetPasswordRequestController,
  graphTokenController,
};
