import { useState, useEffect } from 'react';
import { Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useSessionRecoveryRequestMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';

type TSessionRecoveryPromptProps = {
  recoveryTempToken?: string;
  email?: string;
};

export default function SessionRecoveryPrompt({
  recoveryTempToken,
  email,
}: TSessionRecoveryPromptProps) {
  const localize = useLocalize();
  const [emailSent, setEmailSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const recoveryMutation = useSessionRecoveryRequestMutation({
    onSuccess: () => {
      setEmailSent(true);
      setErrorMessage(null);
      setCooldown(60);
    },
    onError: (err: any) => {
      console.error('[SessionRecoveryPrompt] Request failed:', err);
      const serverMsg = err?.response?.data?.message;
      const status = err?.response?.status;
      let msg = serverMsg;
      if (!msg) {
        if (status === 404) {
          msg = 'Session recovery endpoint not found (404). Please ensure the backend server has been restarted.';
        } else if (err?.message) {
          msg = `${localize('com_auth_session_recovery_request_failed') || 'Failed to send verification email.'} (${err.message})`;
        } else {
          msg =
            localize('com_auth_session_recovery_request_failed') ||
            'Failed to send verification email. Please try again.';
        }
      }
      setErrorMessage(msg);
    },
  });

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendEmail = () => {
    if (!recoveryTempToken) {
      setErrorMessage('Session recovery token is missing. Please re-enter your credentials.');
      return;
    }
    setErrorMessage(null);
    recoveryMutation.mutate({ recoveryTempToken });
  };

  return (
    <div className="my-4 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
      <div className="flex items-start space-x-3">
        <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="flex-1">
          <p className="font-semibold text-blue-800 dark:text-blue-300">
            {localize('com_auth_session_recovery_title') || 'Verify via Registered Email'}
          </p>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
            {localize('com_auth_session_recovery_desc') ||
              'You can verify your registered email address to disconnect the other session and log in securely on this device.'}
          </p>
          {email && (
            <p className="mt-1 text-xs font-medium text-blue-900 dark:text-blue-200">
              {localize('com_auth_session_recovery_email_target') || 'Email'}: {email}
            </p>
          )}

          {errorMessage && (
            <div className="mt-2 flex items-center space-x-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {emailSent ? (
            <div className="mt-3 rounded bg-green-50 p-3 text-xs text-green-800 dark:bg-green-950/40 dark:text-green-300">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="font-medium">
                  {localize('com_auth_session_recovery_sent') ||
                    'Verification link sent! Check your inbox and click the link to log in.'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={cooldown > 0 || recoveryMutation.isLoading}
                  className="font-medium text-green-700 underline hover:text-green-800 disabled:cursor-not-allowed disabled:text-gray-400 dark:text-green-400 dark:hover:text-green-300"
                >
                  {cooldown > 0
                    ? `${localize('com_auth_session_recovery_resend_in') || 'Resend link in'} ${cooldown}s`
                    : localize('com_auth_session_recovery_resend') || 'Resend verification email'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={recoveryMutation.isLoading}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {recoveryMutation.isLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    {localize('com_auth_session_recovery_sending') || 'Sending Email...'}
                  </>
                ) : (
                  <>
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    {localize('com_auth_session_recovery_action') || 'Send Verification Email'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
