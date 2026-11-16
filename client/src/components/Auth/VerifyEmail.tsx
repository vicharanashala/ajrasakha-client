import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Spinner, ThemeSelector } from '@librechat/client';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  useVerifyEmailMutation,
  useResendVerificationEmail,
  useVerifySessionResetMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';

function RequestPasswordReset() {
  const navigate = useNavigate();
  const localize = useLocalize();
  const [params] = useSearchParams();

  const [countdown, setCountdown] = useState<number>(3);
  const [headerText, setHeaderText] = useState<string>('');
  const [showResendLink, setShowResendLink] = useState<boolean>(false);
  const [verificationStatus, setVerificationStatus] = useState<boolean>(false);
  const token = useMemo(() => params.get('token') || '', [params]);
  const email = useMemo(() => params.get('email') || '', [params]);
  const action = useMemo(() => params.get('action') || '', [params]);
  const isClearSession = action === 'clear_session';

  const countdownRedirect = useCallback(
    (targetPath = '/c/new') => {
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown((prevCountdown) => {
          if (prevCountdown <= 1) {
            clearInterval(timer);
            navigate(targetPath, { replace: true });
            return 0;
          }
          return prevCountdown - 1;
        });
      }, 1000);
    },
    [navigate],
  );

  const verifySessionResetMutation = useVerifySessionResetMutation({
    onSuccess: () => {
      setHeaderText('Active sessions cleared successfully! 🎉');
      setVerificationStatus(true);
      countdownRedirect('/login?session_cleared=true');
    },
    onError: () => {
      setHeaderText('Failed to clear sessions. The link may be expired or invalid. 😢');
      setVerificationStatus(true);
    },
  });

  const verifyEmailMutation = useVerifyEmailMutation({
    onSuccess: () => {
      setHeaderText(localize('com_auth_email_verification_success') + ' 🎉');
      setVerificationStatus(true);
      countdownRedirect('/c/new');
    },
    onError: (error: unknown) => {
      setHeaderText(localize('com_auth_email_verification_failed') + ' 😢');
      setShowResendLink(true);
      setVerificationStatus(true);
    },
  });

  const resendEmailMutation = useResendVerificationEmail({
    onSuccess: () => {
      setHeaderText(localize('com_auth_email_resent_success') + ' 📧');
      countdownRedirect('/c/new');
    },
    onError: () => {
      setHeaderText(localize('com_auth_email_resent_failed') + ' 😢');
    },
    onMutate: () => setShowResendLink(false),
  });

  const handleResendEmail = () => {
    resendEmailMutation.mutate({ email });
  };

  const [confirmed, setConfirmed] = useState(false);
  const hasRequested = useRef(false);

  const handleConfirmReset = () => {
    setConfirmed(true);
    hasRequested.current = true;
    verifySessionResetMutation.mutate({ email, token });
  };

  useEffect(() => {
    if (
      hasRequested.current ||
      verificationStatus ||
      verifyEmailMutation.isLoading ||
      verifySessionResetMutation.isLoading
    ) {
      return;
    }

    if (token && email) {
      //  Session reset requires user confirmation click; do not auto-mutate
      if (isClearSession) {
        return;
      }
      hasRequested.current = true;
      verifyEmailMutation.mutate({ email, token });
    } else {
      if (email) {
        setHeaderText(localize('com_auth_email_verification_failed_token_missing') + ' 😢');
      } else {
        setHeaderText(localize('com_auth_email_verification_invalid') + ' 🤨');
      }
      setShowResendLink(!isClearSession);
      setVerificationStatus(true);
    }
  }, [
    token,
    email,
    verificationStatus,
    isClearSession,
    localize,
  ]);

  const VerificationSuccess = () => (
    <div className="flex flex-col items-center justify-center">
      <h1 className="mb-4 text-center text-3xl font-semibold text-black dark:text-white">
        {headerText}
      </h1>
      {countdown > 0 && (
        <p className="text-center text-lg text-gray-600 dark:text-gray-400">
          {localize('com_auth_email_verification_redirecting', { 0: countdown.toString() })}
        </p>
      )}
      {showResendLink && countdown === 0 && (
        <p className="text-center text-lg text-gray-600 dark:text-gray-400">
          {localize('com_auth_email_verification_resend_prompt')}
          <button
            className="ml-2 text-blue-600 hover:underline"
            onClick={handleResendEmail}
            disabled={resendEmailMutation.isLoading}
          >
            {localize('com_auth_email_resend_link')}
          </button>
        </p>
      )}
    </div>
  );

  const VerificationInProgress = () => (
    <div className="flex flex-col items-center justify-center">
      <h1 className="mb-4 text-center text-3xl font-semibold text-black dark:text-white">
        {localize('com_auth_email_verification_in_progress')}
      </h1>
      <div className="mt-4 flex justify-center">
        <Spinner className="h-8 w-8 text-green-500" />
      </div>
    </div>
  );

  const SessionResetConfirmation = () => (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
        Terminate Active Sessions
      </h1>
      <p className="mb-6 max-w-sm text-sm text-gray-600 dark:text-gray-300">
        You requested to log out from other active devices for{' '}
        <span className="font-semibold text-gray-900 dark:text-white">{email}</span> so you can sign in on this device.
      </p>
      <button
        type="button"
        onClick={handleConfirmReset}
        disabled={verifySessionResetMutation.isLoading}
        className="inline-flex w-full max-w-xs items-center justify-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-50"
      >
        {verifySessionResetMutation.isLoading ? 'Terminating sessions...' : 'Terminate Other Sessions & Continue'}
      </button>
      <button
        type="button"
        onClick={() => navigate('/login', { replace: true })}
        className="mt-4 text-xs text-gray-500 hover:underline"
      >
        Cancel and return to Login
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white pt-6 dark:bg-gray-900 sm:pt-0">
      <div className="absolute bottom-0 left-0 m-4">
        <ThemeSelector />
      </div>
      {isClearSession && !confirmed && !verificationStatus ? (
        <SessionResetConfirmation />
      ) : verificationStatus ? (
        <VerificationSuccess />
      ) : (
        <VerificationInProgress />
      )}
    </div>
  );
}

export default RequestPasswordReset;
