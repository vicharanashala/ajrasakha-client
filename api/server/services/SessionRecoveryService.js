const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { logger } = require('@librechat/data-schemas');
const { checkEmailConfig } = require('@librechat/api');
const { createToken, deleteTokens, findToken, findUser, deleteAllUserSessions } = require('~/models');
const { setAuthTokens } = require('~/server/services/AuthService');
const { sendEmail } = require('~/server/utils');

const ELIGIBLE_ROLES = new Set([
  'farmer',
  'district_coordinator',
  'block_coordinator',
  'village_volunteer',
]);

const domains = {
  client: process.env.DOMAIN_CLIENT || 'http://localhost:3080',
  server: process.env.DOMAIN_SERVER || 'http://localhost:3080',
};

/**
 * Checks if a user is eligible for email-based session recovery.
 *
 * Eligible roles:
 * - farmer
 * - district_coordinator
 * - block_coordinator
 * - village_volunteer
 *
 * Exclusion:
 * - If email starts with 'rup' AND createdFrom is 'REVIEW_SYSTEM',
 *   the user is NOT eligible for email-based session recovery.
 *
 * @param {object} user - The user document or object
 * @returns {boolean}
 */
const isSessionRecoveryEligible = (user) => {
  if (!user) {
    return false;
  }

  const role = (user.userRole || user.role || '').toString().trim().toLowerCase();
  if (!ELIGIBLE_ROLES.has(role)) {
    return false;
  }

  const email = (user.email || '').toString().trim().toLowerCase();
  const createdFrom = (user.createdFrom || '').toString().trim().toUpperCase();

  if (email.startsWith('rup') && createdFrom === 'REVIEW_SYSTEM') {
    return false;
  }

  return true;
};

/**
 * Generates a temporary JWT token for session recovery request authentication.
 * Valid for 10 minutes.
 *
 * @param {string} userId
 * @param {string} email
 * @returns {string}
 */
const generateSessionRecoveryTempToken = (userId, email) => {
  return jwt.sign(
    { userId: userId.toString(), email, sessionRecoveryPending: true },
    process.env.JWT_SECRET,
    { expiresIn: '10m' },
  );
};

/**
 * Verifies the temporary JWT token for session recovery.
 *
 * @param {string} tempToken
 * @returns {object} payload
 */
const verifySessionRecoveryTempToken = (tempToken) => {
  return jwt.verify(tempToken, process.env.JWT_SECRET);
};

/**
 * Generates a cryptographically secure random token and its bcrypt hash.
 *
 * @returns {[string, string]} [rawToken, hash]
 */
const generateSessionRecoveryToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = bcrypt.hashSync(token, 10);
  return [token, hash];
};

/**
 * Initiates the session recovery process by generating a secure token,
 * storing its hash in the database, and sending an email to the user.
 *
 * @param {object} user - User document
 * @returns {Promise<{ success: boolean, message: string, link?: string }>}
 */
const requestSessionRecovery = async (user) => {
  if (!user || !user._id || !user.email) {
    throw new Error('Valid user with ID and email is required for session recovery');
  }

  if (!isSessionRecoveryEligible(user)) {
    throw new Error('User is not eligible for email-based session recovery');
  }

  // Invalidate any previous session recovery tokens for this user
  await deleteTokens({
    userId: user._id,
    type: 'session_recovery',
  });

  const [rawToken, hash] = generateSessionRecoveryToken();

  // Store hashed token with 15 minutes (900 seconds) expiry
  await createToken({
    userId: user._id,
    email: user.email,
    token: hash,
    type: 'session_recovery',
    createdAt: Date.now(),
    expiresIn: 900,
  });

  const verificationLink = `${
    domains.client
  }/session-recovery/verify?token=${rawToken}&userId=${user._id}`;

  const emailEnabled = checkEmailConfig();
  if (emailEnabled) {
    await sendEmail({
      email: user.email,
      subject: 'Session Recovery - Verify Your Account',
      payload: {
        appName: process.env.APP_TITLE || 'Ajrasakha',
        name: user.name || user.username || user.email,
        verificationLink,
        year: new Date().getFullYear(),
      },
      template: 'sessionRecovery.handlebars',
    });
    logger.info(`[SessionRecovery] Verification email sent. [Email: ${user.email}] [ID: ${user._id}]`);
  } else {
    logger.info(`[SessionRecovery] Email disabled. Verification link issued: ${verificationLink}`);
    return {
      success: true,
      message: 'Verification link generated (email sending is disabled in configuration).',
      link: verificationLink,
    };
  }

  return {
    success: true,
    message: 'Verification link sent to your registered email address.',
  };
};

/**
 * Verifies a session recovery token, invalidates previous sessions,
 * and sets up a new session on the current requesting device.
 *
 * @param {object} params
 * @param {string} params.token - The raw token from the verification link
 * @param {string} params.userId - The user ID from the verification link
 * @param {ServerResponse} params.res - Express response object for setting auth cookies
 * @returns {Promise<{ message: string, token: string, user: object }>}
 */
const verifySessionRecovery = async ({ token, userId, res }) => {
  if (!token || !userId) {
    const error = new Error('Token and userId are required');
    error.statusCode = 400;
    throw error;
  }

  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const error = new Error('Invalid userId format');
    error.statusCode = 400;
    throw error;
  }

  const user = await findUser({ _id: userId });
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Security check: Must meet eligibility conditions
  if (!isSessionRecoveryEligible(user)) {
    const error = new Error('Account is not eligible for session recovery');
    error.statusCode = 403;
    throw error;
  }

  const Token = mongoose.models.Token;

  // Find the token document for this user of type session_recovery
  const tokenDoc = await Token.findOne({
    userId: user._id,
    type: 'session_recovery',
  }).sort({ createdAt: -1 });

  if (!tokenDoc) {
    const error = new Error('Invalid or expired verification token');
    error.statusCode = 400;
    throw error;
  }

  // Validate usage status
  if (tokenDoc.used) {
    const error = new Error('Verification link has already been used');
    error.statusCode = 400;
    throw error;
  }

  // Validate expiry
  if (tokenDoc.expiresAt && new Date() > new Date(tokenDoc.expiresAt)) {
    await deleteTokens({ userId: user._id, type: 'session_recovery' });
    const error = new Error('Verification link has expired. Please request a new one');
    error.statusCode = 400;
    throw error;
  }

  // Validate token hash
  const isValid = bcrypt.compareSync(token, tokenDoc.token);
  if (!isValid) {
    const error = new Error('Invalid verification token');
    error.statusCode = 400;
    throw error;
  }

  // Atomic consumption: prevent token reuse & concurrent verification
  const claimedToken = await Token.findOneAndUpdate(
    { _id: tokenDoc._id, used: { $ne: true } },
    { $set: { used: true, usedAt: new Date() } },
    { new: true },
  );

  if (!claimedToken) {
    // Another concurrent request already claimed this token
    const error = new Error('Verification link has already been used or is currently being verified');
    error.statusCode = 409;
    throw error;
  }

  // Invalidate previous session only after successful verification
  await deleteAllUserSessions(user._id);

  // Clean up any remaining session recovery tokens for this user
  await deleteTokens({ userId: user._id, type: 'session_recovery' });

  // Create new session for this requesting device
  const authToken = await setAuthTokens(user._id, res);

  const userData = user.toObject ? user.toObject() : { ...user };
  delete userData.__v;
  delete userData.password;
  delete userData.totpSecret;
  delete userData.backupCodes;
  userData.id = user._id.toString();

  logger.info(
    `[SessionRecovery] Session successfully recovered for user ${user._id} (${user.email}). Previous sessions cleared, new session established.`,
  );

  return {
    message: 'Session recovered successfully',
    token: authToken,
    user: userData,
  };
};

module.exports = {
  ELIGIBLE_ROLES,
  isSessionRecoveryEligible,
  generateSessionRecoveryTempToken,
  verifySessionRecoveryTempToken,
  generateSessionRecoveryToken,
  requestSessionRecovery,
  verifySessionRecovery,
};
