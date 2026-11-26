import React, { useState } from 'react';
import { Mail, X } from 'lucide-react';
import { Button, Spinner, useToastContext } from '@librechat/client';
import { useAuthContext, useLocalize } from '~/hooks';
import { useResendVerificationEmail, useGetStartupConfig } from '~/data-provider';

export interface UserVerificationProps {
  email?: string;
  createdFrom?: string;
  rupId?: string;
  idOnTheSource?: string;
  userRole?: string;
  role?: string;
  emailVerified?: boolean;
}

const EXTERNAL_USER_ROLES = [
  'farmer',
  'district_coordinator',
  'block_coordinator',
  'village_volunteer',
];

export const isRupUser = (user?: UserVerificationProps | null): boolean => {
  if (!user) {
    return false;
  }
  const email = (user.email ?? '').toLowerCase().trim();
  const createdFrom = (user.createdFrom ?? '').toUpperCase().trim();
  const isFromReviewSystem = createdFrom === 'REVIEW_SYSTEM';

  // 1. User email starts with "rup" AND was created from the Review System -> EXEMPT
  // (applies even if the user is a farmer or coordinator)
  if (email.startsWith('rup') && isFromReviewSystem) {
    return true;
  }
  if (Boolean(user.rupId)) {
    return true;
  }
  if (user.idOnTheSource?.toLowerCase().trim().startsWith('rup')) {
    return true;
  }

  let rawRole = user.userRole || user.role;
  if (!rawRole || rawRole.toUpperCase() === 'USER') {
    rawRole = 'farmer';
  }
  const uRole = rawRole.toLowerCase().trim();

  // 2. Only farmers and coordinators require email verification -> NOT exempt
  if (EXTERNAL_USER_ROLES.includes(uRole)) {
    return false;
  }

  // 3. All other users (e.g. INTERNAL) do not require email verification -> EXEMPT
  return true;
};

export const VerifyEmailBanner = () => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { user, isAuthenticated } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const bannerRef = React.useRef<HTMLDivElement>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('dismiss_verify_email_banner') === 'true';
    } catch {
      return false;
    }
  });
  const [sentSuccess, setSentSuccess] = useState<boolean>(false);

  React.useEffect(() => {
    const updateHeight = () => {
      if (bannerRef.current) {
        const height = bannerRef.current.offsetHeight;
        document.documentElement.style.setProperty('--email-banner-height', `${height}px`);
      }
    };

    updateHeight();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && bannerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateHeight();
      });
      resizeObserver.observe(bannerRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      document.documentElement.style.setProperty('--email-banner-height', '0px');
    };
  }, [sentSuccess]);

  const resendEmailMutation = useResendVerificationEmail({
    onSuccess: () => {
      setSentSuccess(true);
      showToast({
        message: localize('com_auth_email_resent_success') || 'Verification email sent successfully.',
        status: 'success',
      });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message || err?.message || 'Failed to resend verification email.';
      showToast({
        message: msg,
        status: 'error',
      });
    },
  });

  if (!isAuthenticated || !user) {
    return null;
  }

  if (startupConfig && startupConfig.emailVerificationEnabled === false) {
    return null;
  }

  if (user.emailVerified === true) {
    return null;
  }

  if (isRupUser(user as UserVerificationProps)) {
    return null;
  }

  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    document.documentElement.style.setProperty('--email-banner-height', '0px');
    try {
      sessionStorage.setItem('dismiss_verify_email_banner', 'true');
    } catch {
      // Ignore sessionStorage errors (e.g. incognito/restricted environment)
    }
  };

  const handleResend = () => {
    if (!user.email) {
      return;
    }
    resendEmailMutation.mutate({ email: user.email });
  };

  return (
    <div
      ref={bannerRef}
      role="alert"
      data-testid="verify-email-banner"
      className="relative z-50 flex w-full flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-900 backdrop-blur-sm dark:bg-amber-500/15 dark:text-amber-200 sm:text-sm"
    >
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        <Mail className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <span className="truncate">
          {sentSuccess ? (
            <span className="font-medium text-green-700 dark:text-green-300">
              {localize('com_auth_email_resent_success') || 'Verification email resent! Please check your inbox.'}
            </span>
          ) : (
            <>
              <span className="font-medium">
                {localize('com_auth_email_address') || 'Email'} ({user.email}) is not verified.
              </span>{' '}
              <span className="hidden sm:inline">
                {localize('com_auth_email_verification_banner_prompt') ||
                  'Please verify your email address to secure your account.'}
              </span>
            </>
          )}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!sentSuccess && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="resend-verification-button"
            disabled={resendEmailMutation.isLoading}
            onClick={handleResend}
            className="h-7 cursor-pointer border-amber-600/40 bg-amber-500/10 px-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-500/20 dark:border-amber-400/40 dark:text-amber-200 dark:hover:bg-amber-500/30"
          >
            {resendEmailMutation.isLoading ? (
              <Spinner className="size-3.5" />
            ) : (
              localize('com_auth_email_resend_link') || 'Resend Email'
            )}
          </Button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          data-testid="dismiss-verification-banner"
          className="cursor-pointer rounded p-1 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
