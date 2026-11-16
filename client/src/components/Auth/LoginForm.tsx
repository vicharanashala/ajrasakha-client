import React, { useState, useEffect, useContext } from 'react';
import { useForm } from 'react-hook-form';
import { Turnstile } from '@marsidev/react-turnstile';
import { ThemeContext, Spinner, Button, isDark } from '@librechat/client';
import type { TLoginUser, TStartupConfig } from 'librechat-data-provider';
import type { TAuthContext } from '~/common';
import {
  useResendVerificationEmail,
  useGetStartupConfig,
  useRequestVerificationMutation,
  useRequestSessionResetMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';
import PasswordToggleButton from './PasswordToggleButton';

type TLoginFormProps = {
  onSubmit: (data: TLoginUser) => void;
  startupConfig: TStartupConfig;
  error: Pick<TAuthContext, 'error'>['error'];
  setError: Pick<TAuthContext, 'setError'>['setError'];
};

const LoginForm: React.FC<TLoginFormProps> = ({ onSubmit, startupConfig, error, setError }) => {
  const localize = useLocalize();
  const { theme } = useContext(ThemeContext);
  const {
    register,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TLoginUser>();
  const [showResendLink, setShowResendLink] = useState<boolean>(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showRequestVerification, setShowRequestVerification] = useState<boolean>(false);
  const [verificationRequestSent, setVerificationRequestSent] = useState<boolean>(false);
  const [showSessionResetPrompt, setShowSessionResetPrompt] = useState<boolean>(false);
  const [sessionResetSent, setSessionResetSent] = useState<boolean>(false);
  // Controls whether the password field is shown as plain text
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);

  const { data: config } = useGetStartupConfig();
  const useUsernameLogin = config?.ldap?.username;
  const validTheme = isDark(theme) ? 'dark' : 'light';
  const requireCaptcha = Boolean(startupConfig.turnstile?.siteKey);

  const requestVerificationMutation = useRequestVerificationMutation({
    onMutate: () => {
      setError(undefined);
      setShowRequestVerification(false);
    },
    onSuccess: () => {
      setVerificationRequestSent(true);
    },
    onError: (error) => {
      console.error('Failed to send verification request:', error);
      setError('Failed to send verification request. Please try again.');
    },
  });

  const requestSessionResetMutation = useRequestSessionResetMutation({
    onMutate: () => {
      setError(undefined);
      setShowSessionResetPrompt(false);
    },
    onSuccess: () => {
      setSessionResetSent(true);
    },
    onError: (error) => {
      console.error('Failed to send session reset request:', error);
      setError('Failed to send session reset verification email. Please try again.');
    },
  });

  useEffect(() => {
    if (error && error.includes('422') && !showResendLink) {
      setShowResendLink(true);
    }
    if (error && error === 'ERR_ADMIN_VERIFICATION_PENDING' && !showRequestVerification && !verificationRequestSent) {
      setShowRequestVerification(true);
    }
    const isAlreadyLoggedIn =
      typeof error === 'string' &&
      (error.includes('409') ||
        error.includes('already logged in') ||
        error.includes('ACTIVE_SESSION_EXISTS') ||
        error === 'You are already logged in on one device. Logout to access in this device.');
    if (isAlreadyLoggedIn && !showSessionResetPrompt && !sessionResetSent) {
      setShowSessionResetPrompt(true);
    }
  }, [error, showResendLink, showRequestVerification, verificationRequestSent, showSessionResetPrompt, sessionResetSent]);

  const resendLinkMutation = useResendVerificationEmail({
    onMutate: () => {
      setError(undefined);
      setShowResendLink(false);
    },
  });

  if (!startupConfig) {
    return null;
  }

  const renderError = (fieldName: string) => {
    const errorMessage = errors[fieldName]?.message;
    return errorMessage ? (
      <span role="alert" className="mt-1 text-sm text-red-600 dark:text-red-500">
        {String(errorMessage)}
      </span>
    ) : null;
  };

  const handleResendEmail = () => {
    const email = getValues('email');
    if (!email) {
      return setShowResendLink(false);
    }
    resendLinkMutation.mutate({ email });
  };

  const handleRequestVerification = () => {
    const email = getValues('email');
    if (!email) {
      return setShowRequestVerification(false);
    }
    requestVerificationMutation.mutate({ identifier: email });
  };

  const handleRequestSessionReset = () => {
    const email = getValues('email');
    if (!email) {
      setError('Please enter your email address to receive the verification link.');
      return;
    }
    requestSessionResetMutation.mutate({ email });
  };

  return (
    <>
      {showResendLink && (
        <div className="mt-2 rounded-md border border-green-500 bg-green-500/10 px-3 py-2 text-sm text-gray-600 dark:text-gray-200">
          {localize('com_auth_email_verification_resend_prompt')}
          <button
            type="button"
            className="ml-2 text-blue-600 hover:underline"
            onClick={handleResendEmail}
            disabled={resendLinkMutation.isLoading}
          >
            {localize('com_auth_email_resend_link')}
          </button>
        </div>
      )}
      {showRequestVerification && (
        <div className="mt-2 rounded-md border border-yellow-500 bg-yellow-500/10 px-3 py-2 text-sm text-gray-600 dark:text-gray-200">
          Your account verification is pending.
          <button
            type="button"
            className="ml-2 text-blue-600 hover:underline"
            onClick={handleRequestVerification}
            disabled={requestVerificationMutation.isPending}
          >
            {requestVerificationMutation.isPending ? 'Requesting...' : 'Request Verification'}
          </button>
        </div>
      )}
      {verificationRequestSent && (
        <div className="mt-2 rounded-md border border-green-500 bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
          Verification request sent to administrators.
        </div>
      )}
      {showSessionResetPrompt && (
        <div className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-gray-700 dark:text-gray-200">
          <p className="font-semibold text-amber-600 dark:text-amber-400">
            Need to sign in on this device?
          </p>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
            Verify your email to automatically log out from your other active device.
          </p>
          <button
            type="button"
            className="mt-2.5 inline-flex w-full items-center justify-center rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-500 focus:outline-none disabled:opacity-50"
            onClick={handleRequestSessionReset}
            disabled={requestSessionResetMutation.isPending}
          >
            {requestSessionResetMutation.isPending
              ? 'Sending Verification Link...'
              : 'Send Verification Link to Log Out Other Device'}
          </button>
        </div>
      )}
      {sessionResetSent && (
        <div className="mt-3 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-300">
          <p className="font-semibold text-green-600 dark:text-green-400">
            Verification link sent! 📧
          </p>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
            Please check your inbox and click the link to terminate your active sessions.
          </p>
        </div>
      )}
      <form
        className="mt-6"
        aria-label="Login form"
        method="POST"
        onSubmit={handleSubmit((data) => onSubmit(data))}
      >
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              id="email"
              autoComplete={useUsernameLogin ? 'username' : 'email'}
              aria-label={localize('com_auth_email')}
              {...register('email', {
                required: localize('com_auth_email_required'),
                maxLength: { value: 120, message: localize('com_auth_email_max_length') },
                pattern: {
                  value: useUsernameLogin ? /\S+/ : /\S+@\S+\.\S+/,
                  message: localize('com_auth_email_pattern'),
                },
              })}
              aria-invalid={!!errors.email}
              className="webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light bg-transparent px-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none"
              placeholder=" "
            />
            <label
              htmlFor="email"
              className="absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-white px-2 text-sm dark:bg-gray-900 text-text-secondary-alt duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-600 dark:peer-focus:text-green-500 rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4"
            >
              {useUsernameLogin
                ? localize('com_auth_username').replace(/ \(.*$/, '')
                : localize('com_auth_email_address')}
            </label>
          </div>
          {renderError('email')}
        </div>
        <div className="mb-2">
          <div className="relative">
            <input
              type={isPasswordVisible ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              aria-label={localize('com_auth_password')}
              {...register('password', {
                required: localize('com_auth_password_required'),
                minLength: {
                  value: startupConfig?.minPasswordLength || 8,
                  message: localize('com_auth_password_min_length'),
                },
                maxLength: { value: 128, message: localize('com_auth_password_max_length') },
              })}
              aria-invalid={!!errors.password}
              className="webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light bg-transparent pe-11 ps-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none"
              placeholder=" "
            />
            <label
              htmlFor="password"
              className="absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-white px-2 text-sm dark:bg-gray-900 text-text-secondary-alt duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-600 dark:peer-focus:text-green-500 rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4"
            >
              {localize('com_auth_password')}
            </label>
            <PasswordToggleButton
              isVisible={isPasswordVisible}
              onToggle={() => setIsPasswordVisible((prev) => !prev)}
            />
          </div>
          {renderError('password')}
        </div>
        {startupConfig.passwordResetEnabled && (
          <a
            href="/forgot-password"
            className="inline-flex p-1 text-sm font-medium text-green-600 underline decoration-transparent transition-all duration-200 hover:text-green-700 hover:decoration-green-700 focus:text-green-700 focus:decoration-green-700 dark:text-green-500 dark:hover:text-green-400 dark:hover:decoration-green-400 dark:focus:text-green-400 dark:focus:decoration-green-400"
          >
            {localize('com_auth_password_forgot')}
          </a>
        )}

        {requireCaptcha && (
          <div className="my-4 flex justify-center">
            <Turnstile
              siteKey={startupConfig.turnstile!.siteKey}
              options={{
                ...startupConfig.turnstile!.options,
                theme: validTheme,
              }}
              onSuccess={setTurnstileToken}
              onError={() => setTurnstileToken(null)}
              onExpire={() => setTurnstileToken(null)}
            />
          </div>
        )}

        <div className="mt-6">
          <Button
            aria-label={localize('com_auth_continue')}
            data-testid="login-button"
            type="submit"
            disabled={(requireCaptcha && !turnstileToken) || isSubmitting}
            variant="submit"
            className="h-12 w-full rounded-2xl"
          >
            {isSubmitting ? <Spinner /> : localize('com_auth_continue')}
          </Button>
        </div>
      </form>
    </>
  );
};

export default LoginForm;
