import { isEnabled } from './common';

/**
 * Check if email verification is enabled via .env
 * @returns Returns `true` if emailVerified or EMAIL_VERIFIED is true
 */
export function isEmailVerificationEnabled(): boolean {
  return isEnabled(process.env.emailVerified ?? process.env.EMAIL_VERIFIED);
}

/**
 * Check if email configuration is set
 * @returns Returns `true` if either Mailgun or SMTP is properly configured
 */
export function checkEmailConfig(): boolean {
  const hasMailgunConfig =
    !!process.env.MAILGUN_API_KEY && !!process.env.MAILGUN_DOMAIN && !!process.env.EMAIL_FROM;

  const hasSMTPConfig =
    (!!process.env.EMAIL_SERVICE || !!process.env.EMAIL_HOST) &&
    !!process.env.EMAIL_USERNAME &&
    !!process.env.EMAIL_PASSWORD &&
    !!process.env.EMAIL_FROM;

  return hasMailgunConfig || hasSMTPConfig;
}
