const { logger } = require('@librechat/data-schemas');
const { findUser, comparePassword, countActiveSessions } = require('~/models');
const {
  isSessionRecoveryEligible,
  verifySessionRecoveryTempToken,
  requestSessionRecovery,
  verifySessionRecovery,
} = require('~/server/services/SessionRecoveryService');

/**
 * Controller to handle requests to send a session recovery verification email.
 *
 * Accepts either:
 * 1. `recoveryTempToken` (issued upon 409 session conflict after valid login)
 * 2. `email` & `password` credentials
 *
 * @param {ServerRequest} req
 * @param {ServerResponse} res
 */
const sessionRecoveryRequestController = async (req, res) => {
  try {
    const { recoveryTempToken, email, password } = req.body;

    let user = null;

    if (recoveryTempToken) {
      let payload;
      try {
        payload = verifySessionRecoveryTempToken(recoveryTempToken);
      } catch (jwtErr) {
        logger.warn('[sessionRecoveryRequestController] Invalid or expired temp token', jwtErr);
        return res.status(401).json({
          message: 'Invalid or expired session recovery session. Please try logging in again.',
        });
      }

      if (!payload?.userId) {
        return res.status(400).json({ message: 'Invalid session recovery token payload.' });
      }

      user = await findUser({ _id: payload.userId });
    } else if (email && password) {
      const foundUser = await findUser({ email: email.trim() }, '+password');
      if (!foundUser || !foundUser.password) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      const isMatch = await comparePassword(foundUser, password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      user = foundUser;
    } else {
      return res.status(400).json({
        message: 'Missing session recovery token or user credentials.',
      });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Verify eligibility
    if (!isSessionRecoveryEligible(user)) {
      logger.warn(
        `[sessionRecoveryRequestController] Ineligible user attempted session recovery. [Email: ${user.email}] [ID: ${user._id}]`,
      );
      return res.status(403).json({
        message: 'This account is not eligible for email-based session recovery.',
      });
    }

    // Verify an active session conflict exists
    const activeSessions = await countActiveSessions(user._id.toString());
    if (activeSessions === 0) {
      return res.status(200).json({
        message: 'No active session conflict exists. You can log in directly.',
        noConflict: true,
      });
    }

    const result = await requestSessionRecovery(user);

    return res.status(200).json(result);
  } catch (error) {
    logger.error('[sessionRecoveryRequestController]', error);
    return res.status(500).json({ message: 'Failed to process session recovery request.' });
  }
};

/**
 * Controller to handle verification of a session recovery token and session replacement.
 *
 * @param {ServerRequest} req
 * @param {ServerResponse} res
 */
const sessionRecoveryVerifyController = async (req, res) => {
  try {
    const { token, userId } = req.body;

    if (!token || !userId) {
      return res.status(400).json({ message: 'Token and userId are required.' });
    }

    const result = await verifySessionRecovery({ token, userId, res });
    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode < 500) {
      logger.warn(`[sessionRecoveryVerifyController] ${error.message}`);
    } else {
      logger.error('[sessionRecoveryVerifyController]', error);
    }
    return res
      .status(statusCode)
      .json({ message: error.message || 'Failed to verify session recovery.' });
  }
};

module.exports = {
  sessionRecoveryRequestController,
  sessionRecoveryVerifyController,
};
