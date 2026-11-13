const { logger } = require('@librechat/data-schemas');
const { errorsToString } = require('librechat-data-provider');
const { isEnabled, checkEmailConfig, isEmailVerificationEnabled: checkEmailVerification } = require('@librechat/api');

const isEmailVerificationEnabled = () => {
  if (typeof checkEmailVerification === 'function') {
    return checkEmailVerification();
  }
  return isEnabled(process.env.emailVerified ?? process.env.EMAIL_VERIFIED);
};
const { Strategy: PassportLocalStrategy } = require('passport-local');
const { findUser, comparePassword, updateUser } = require('~/models');
const { loginSchema } = require('./validators');

// Unix timestamp for 2024-06-07 15:20:18 Eastern Time
const verificationEnabledTimestamp = 1717788018;

async function validateLoginRequest(req) {
  const { error } = loginSchema.safeParse(req.body);
  return error ? errorsToString(error.errors) : null;
}

async function passportLogin(req, email, password, done) {
  try {
    const validationError = await validateLoginRequest(req);
    if (validationError) {
      logError('Passport Local Strategy - Validation Error', { reqBody: req.body });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: validationError });
    }

    const user = await findUser({ email: email.trim() }, '+password');
    if (!user) {
      logError('Passport Local Strategy - User Not Found', { email });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: 'Email does not exist.' });
    }

    if (!user.password) {
      logError('Passport Local Strategy - User has no password', { email });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: 'Email does not exist.' });
    }

    const isMatch = await comparePassword(user, password);
    if (!isMatch) {
      logError('Passport Local Strategy - Password does not match', { isMatch });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: 'Incorrect password.' });
    }

    const verificationRequired = isEmailVerificationEnabled();

    if (user.isVerified === false) {
      logError('Passport Local Strategy - Pending admin verification', { email });
      logger.error(
        `[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}] [Pending admin verification]`,
      );
      return done(null, user, {
        message:'Your account is currently under verification by the administrator. Please contact the admin for approval.',
      });
    }

    if (verificationRequired) {
      if (!user.emailVerified) {
        logError('Passport Local Strategy - Email not verified', { email });
        logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
        return done(null, user, { message: 'Email not verified.' });
      }
    } else {
      if (!user.emailVerified) {
        await updateUser(user._id, { emailVerified: true });
        user.emailVerified = true;
      }
      if (user.expiresAt) {
        await updateUser(user._id, {});
      }
    }

    logger.info(`[Login] [Login successful] [Username: ${email}] [Request-IP: ${req.ip}]`);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}

function logError(title, parameters) {
  const entries = Object.entries(parameters).map(([name, value]) => ({ name, value }));
  logger.error(title, { parameters: entries });
}

module.exports = () =>
  new PassportLocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      session: false,
      passReqToCallback: true,
    },
    passportLogin,
  );
