const { isEnabled, isEmailVerificationEnabled: checkEmailVerification } = require('@librechat/api');
const { isEmailVerificationExempt, isEmailVerificationExpired } = require('~/server/services/AuthService');

const isEmailVerificationEnabled = () => {
  if (typeof checkEmailVerification === 'function') {
    return checkEmailVerification();
  }
  return isEnabled(process.env.emailVerified ?? process.env.EMAIL_VERIFIED);
};

/**
 * Middleware to ensure the user's email address is verified if email verification is enabled
 * and the user is not exempt (e.g. non-RUP and not external).
 * If user.emailVerifiedAt is older than 6 months, requires re-verification.
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Express.NextFunction} next
 */
const checkEmailVerified = (req, res, next) => {
  if (!isEmailVerificationEnabled()) {
    return next();
  }

  const user = req.user;
  if (!user) {
    return next();
  }

  const isExempt = isEmailVerificationExempt({
    email: user.email,
    userRole: user.userRole,
    role: user.role,
    createdFrom: user.createdFrom,
  });

  if (isExempt) {
    return next();
  }

  const isExpired = user.emailVerified && isEmailVerificationExpired(user.emailVerifiedAt, user.createdAt);

  if (user.emailVerified && !isExpired) {
    return next();
  }

  return res.status(403).json({
    message: isExpired
      ? 'Email verification expired. Verification is required every 6 months. Please verify your email again.'
      : 'Email verification required. Please verify your email before submitting questions.',
    code: isExpired ? 'EMAIL_VERIFICATION_EXPIRED' : 'EMAIL_NOT_VERIFIED',
  });
};

module.exports = checkEmailVerified;
