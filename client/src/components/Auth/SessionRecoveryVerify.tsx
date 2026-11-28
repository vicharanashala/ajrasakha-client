import { useState, useEffect, useMemo, useCallback } from 'react';
import { Spinner, ThemeSelector } from '@librechat/client';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { useSessionRecoveryVerifyMutation } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';

export default function SessionRecoveryVerify() {
  const navigate = useNavigate();
  const localize = useLocalize();
  const [params] = useSearchParams();
  const { setUserContext } = useAuthContext();

  const [countdown, setCountdown] = useState<number>(3);
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const token = useMemo(() => params.get('token') || '', [params]);
  const userId = useMemo(() => params.get('userId') || '', [params]);

  const countdownRedirect = useCallback(() => {
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
  }, [navigate]);

  const verifyMutation = useSessionRecoveryVerifyMutation({
    onSuccess: (data) => {
      setStatus('success');
      if (setUserContext && data.token && data.user) {
        setUserContext({
          token: data.token,
          isAuthenticated: true,
          user: data.user,
          redirect: '/c/new',
        });
      }
      countdownRedirect();
    },
    onError: (err: any) => {
      setStatus('error');
      const backendMsg = err?.response?.data?.message;
      if (backendMsg) {
        setErrorMessage(backendMsg);
      } else {
        setErrorMessage(
          localize('com_auth_session_recovery_verify_failed') ||
            'Failed to verify session recovery link.',
        );
      }
    },
  });

  useEffect(() => {
    if (!token || !userId) {
      setStatus('error');
      setErrorMessage(
        localize('com_auth_session_recovery_invalid_link') ||
          'Invalid verification link. Token or user ID is missing.',
      );
      return;
    }

    verifyMutation.mutate({ token, userId });
  }, [token, userId]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 pt-6 dark:bg-gray-900 sm:pt-0">
      <div className="absolute bottom-0 left-0 m-4">
        <ThemeSelector />
      </div>

      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-800">
        {status === 'verifying' && (
          <div className="flex flex-col items-center text-center">
            <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
              {localize('com_auth_session_recovery_verifying_title') ||
                'Verifying Session Recovery'}
            </h1>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              {localize('com_auth_session_recovery_verifying_desc') ||
                'Validating your link and transferring your session to this device...'}
            </p>
            <Spinner className="h-10 w-10 text-green-500" />
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="mb-3 h-14 w-14 text-green-500" />
            <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
              {localize('com_auth_session_recovery_success_title') ||
                'Session Recovered Successfully!'}
            </h1>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              {localize('com_auth_session_recovery_success_desc') ||
                'Previous sessions have been logged out. You are now logged in on this device.'}
            </p>
            <p className="mb-6 text-xs text-gray-500 dark:text-gray-400">
              {localize('com_auth_session_recovery_redirecting', { 0: countdown.toString() }) ||
                `Redirecting to chat in ${countdown}s...`}
            </p>
            <button
              onClick={() => navigate('/c/new', { replace: true })}
              className="inline-flex w-full items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:bg-green-500 dark:hover:bg-green-600"
            >
              <span>{localize('com_auth_session_recovery_continue_chat') || 'Continue to Chat'}</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="mb-3 h-14 w-14 text-red-500" />
            <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
              {localize('com_auth_session_recovery_failed_title') ||
                'Verification Failed'}
            </h1>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
              {errorMessage}
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span>{localize('com_auth_back_to_login') || 'Back to Login'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
