import { useState, useEffect, useMemo } from 'react';
import { Spinner, ThemeSelector } from '@librechat/client';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Mail } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import { useSetRecoilState } from 'recoil';
import store from '~/store';
import { useVerifyEmailMutation, useResendVerificationEmail } from '~/data-provider';
import { useLocalize } from '~/hooks';

type VerificationState = 'loading' | 'success' | 'error';

const animationStyles = `
@keyframes verify-circle-draw {
  from { stroke-dashoffset: 166; }
  to { stroke-dashoffset: 0; }
}
@keyframes verify-check-draw {
  from { stroke-dashoffset: 48; }
  to { stroke-dashoffset: 0; }
}
@keyframes verify-cross-draw {
  from { stroke-dashoffset: 48; }
  to { stroke-dashoffset: 0; }
}
@keyframes verify-pop {
  0% { transform: scale(0.7); opacity: 0; }
  65% { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes verify-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-5px); }
  40%, 80% { transform: translateX(5px); }
}
@keyframes verify-pulse {
  0%, 100% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.12); opacity: 0.6; }
}
`;

const SuccessAnimation = () => (
  <div className="relative mb-6 flex items-center justify-center" data-testid="verification-success-animation">
    <div
      className="absolute h-28 w-28 rounded-full bg-green-500/20 blur-xl dark:bg-green-500/30"
      style={{ animation: 'verify-pulse 3s ease-in-out infinite' }}
    />
    <div
      className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-green-500/30 bg-green-50 text-green-600 shadow-xl shadow-green-500/15 dark:border-green-500/40 dark:bg-green-950/50 dark:text-green-400"
      style={{ animation: 'verify-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
    >
      <svg
        className="h-12 w-12"
        viewBox="0 0 52 52"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          cx="26"
          cy="26"
          r="23"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          style={{
            strokeDasharray: 166,
            strokeDashoffset: 166,
            animation: 'verify-circle-draw 0.5s cubic-bezier(0.65, 0, 0.45, 1) 0.1s forwards',
          }}
        />
        <path
          d="M15 27 L23 35 L37 19"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 48,
            strokeDashoffset: 48,
            animation: 'verify-check-draw 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.4s forwards',
          }}
        />
      </svg>
    </div>
  </div>
);

const FailedAnimation = () => (
  <div className="relative mb-6 flex items-center justify-center" data-testid="verification-failed-animation">
    <div
      className="absolute h-28 w-28 rounded-full bg-red-500/20 blur-xl dark:bg-red-500/30"
      style={{ animation: 'verify-pulse 3s ease-in-out infinite' }}
    />
    <div
      className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-red-500/30 bg-red-50 text-red-600 shadow-xl shadow-red-500/15 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-400"
      style={{
        animation: 'verify-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards, verify-shake 0.5s ease-in-out 0.75s',
      }}
    >
      <svg
        className="h-12 w-12"
        viewBox="0 0 52 52"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          cx="26"
          cy="26"
          r="23"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          style={{
            strokeDasharray: 166,
            strokeDashoffset: 166,
            animation: 'verify-circle-draw 0.5s cubic-bezier(0.65, 0, 0.45, 1) 0.1s forwards',
          }}
        />
        <path
          d="M18 18 L34 34"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          style={{
            strokeDasharray: 48,
            strokeDashoffset: 48,
            animation: 'verify-cross-draw 0.35s cubic-bezier(0.65, 0, 0.45, 1) 0.35s forwards',
          }}
        />
        <path
          d="M34 18 L18 34"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          style={{
            strokeDasharray: 48,
            strokeDashoffset: 48,
            animation: 'verify-cross-draw 0.35s cubic-bezier(0.65, 0, 0.45, 1) 0.5s forwards',
          }}
        />
      </svg>
    </div>
  </div>
);

const LoadingAnimation = () => (
  <div className="relative mb-6 flex items-center justify-center" data-testid="verification-loading-animation">
    <div
      className="absolute h-28 w-28 rounded-full bg-green-500/20 blur-xl dark:bg-green-500/30"
      style={{ animation: 'verify-pulse 2s ease-in-out infinite' }}
    />
    <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-green-500/25 bg-green-50 text-green-600 shadow-xl shadow-green-500/10 dark:border-green-500/30 dark:bg-green-950/50 dark:text-green-400">
      <Spinner className="h-10 w-10 text-green-600 dark:text-green-400" />
    </div>
  </div>
);

function VerifyEmail() {
  const navigate = useNavigate();
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const setUser = useSetRecoilState(store.user);
  const [params] = useSearchParams();

  const [status, setStatus] = useState<VerificationState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(3);
  const [resendSentMessage, setResendSentMessage] = useState<string>('');

  const token = useMemo(() => params.get('token') || '', [params]);
  const email = useMemo(() => params.get('email') || '', [params]);

  const verifyEmailMutation = useVerifyEmailMutation({
    onSuccess: async () => {
      setStatus('success');
      try {
        await queryClient.invalidateQueries([QueryKeys.user]);
        const updatedUser = await queryClient.fetchQuery([QueryKeys.user]);
        if (updatedUser) {
          queryClient.setQueryData([QueryKeys.user], updatedUser);
          setUser(updatedUser);
        }
      } catch {
        // User may not be logged in or session expired
      }
    },
    onError: () => {
      setErrorMessage(String(localize('com_auth_email_verification_failed')));
      setStatus('error');
    },
  });

  const resendEmailMutation = useResendVerificationEmail({
    onSuccess: () => {
      setResendSentMessage(String(localize('com_auth_email_resent_success')));
    },
    onError: () => {
      setResendSentMessage(String(localize('com_auth_email_resent_failed')));
    },
  });

  const handleResendEmail = () => {
    if (!email) {
      return;
    }
    setResendSentMessage('');
    resendEmailMutation.mutate({ email });
  };

  useEffect(() => {
    if (token && email) {
      verifyEmailMutation.mutate({ email, token });
    } else {
      if (email) {
        setErrorMessage(String(localize('com_auth_email_verification_failed_token_missing')));
      } else {
        setErrorMessage(String(localize('com_auth_email_verification_invalid')));
      }
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== 'success') {
      return;
    }
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/c/new', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, navigate]);

  const SuccessView = () => (
    <div className="flex flex-col items-center">
      <SuccessAnimation />
      <h1 className="mb-2 text-center text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
        {String(localize('com_auth_email_verification_success'))}
      </h1>
      <p className="mb-6 text-center text-sm text-gray-600 dark:text-gray-400">
        {countdown > 0
          ? String(localize('com_auth_email_verification_redirecting', { 0: countdown.toString() }))
          : String(localize('com_ui_loading') || 'Redirecting...')}
      </p>

      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        <div
          className="h-full bg-green-500 transition-all duration-1000 ease-linear dark:bg-green-400"
          style={{ width: `${Math.min(100, Math.max(0, ((3 - countdown) / 3) * 100))}%` }}
        />
      </div>

      <button
        type="button"
        onClick={() => navigate('/c/new', { replace: true })}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:bg-green-600 dark:hover:bg-green-500"
      >
        <span>{String(localize('com_ui_continue') || 'Continue')}</span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );

  const ErrorView = () => (
    <div className="flex flex-col items-center">
      <FailedAnimation />
      <h1 className="mb-2 text-center text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
        {errorMessage || String(localize('com_auth_email_verification_failed'))}
      </h1>
      <p className="mb-6 text-center text-sm text-gray-600 dark:text-gray-400">
        {String(
          localize('com_auth_email_verification_still_unverified') ||
            'The verification link may have expired or is invalid. You can request a new verification link below.',
        )}
      </p>

      {resendSentMessage && (
        <div
          className={`mb-4 w-full rounded-xl border p-3 text-center text-xs font-medium ${
            resendSentMessage === String(localize('com_auth_email_resent_failed'))
              ? 'border-red-500/20 bg-red-50/70 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              : 'border-green-500/20 bg-green-50/70 text-green-700 dark:bg-green-950/40 dark:text-green-300'
          }`}
          role="status"
        >
          {resendSentMessage}
        </div>
      )}

      <div className="flex w-full flex-col gap-3">
        {email && (
          <button
            type="button"
            onClick={handleResendEmail}
            disabled={resendEmailMutation.isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:bg-green-600 dark:hover:bg-green-500"
          >
            {resendEmailMutation.isLoading ? (
              <>
                <Spinner className="h-4 w-4 text-white" />
                <span>{String(localize('com_auth_email_verifying_ellipsis') || 'Sending...')}</span>
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                <span>{String(localize('com_auth_email_resend_link') || 'Resend Email')}</span>
              </>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-750"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{String(localize('com_auth_back_to_login') || 'Back to Login')}</span>
        </button>
      </div>
    </div>
  );

  const LoadingView = () => (
    <div className="flex flex-col items-center">
      <LoadingAnimation />
      <h1 className="mb-2 text-center text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
        {String(localize('com_auth_email_verification_in_progress'))}
      </h1>
      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        {String(localize('com_auth_email_verifying_ellipsis') || 'Verifying...')}
      </p>
    </div>
  );

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 transition-colors dark:bg-gray-900 sm:px-6 lg:px-8">
      <style>{animationStyles}</style>

      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <ThemeSelector />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-xl dark:border-gray-800 dark:bg-gray-800/90 sm:p-10">
        <div className="mb-6 flex justify-center">
          <img
            src="/assets/annam.png"
            alt="Annam"
            className="h-10 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {status === 'loading' && <LoadingView />}
        {status === 'success' && <SuccessView />}
        {status === 'error' && <ErrorView />}
      </div>
    </div>
  );
}

export default VerifyEmail;
