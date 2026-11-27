import React, { useState } from 'react';
import {
  OGDialog,
  OGDialogContent,
  OGDialogDescription,
  OGDialogHeader,
  OGDialogTitle,
  Button,
  Spinner,
  useToastContext,
} from '@librechat/client';
import { Mail, CheckCircle2, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSetRecoilState } from 'recoil';
import { QueryKeys } from 'librechat-data-provider';
import store from '~/store';
import { useAuthContext, useLocalize } from '~/hooks';
import { useResendVerificationEmail, useGetUserQuery } from '~/data-provider';
import { isEmailVerificationExpired } from '~/components/Banners';
import { cn } from '~/utils';

const ACTION_BUTTON_BASE = cn(
  'inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm',
  'transition-[background-color,box-shadow,transform] duration-200',
  'focus-visible:outline-none focus-visible:ring-2',
  'motion-reduce:transition-none',
  'sm:flex-1',
);

interface VerifyEmailModalProps {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function VerifyEmailModal({ open, onOpenChange }: VerifyEmailModalProps) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const setUser = useSetRecoilState(store.user);
  const { user } = useAuthContext();
  const { showToast } = useToastContext();
  const [sentSuccess, setSentSuccess] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const getTranslation = (key: string, fallback: string): string => {
    const text = String(localize(key as any));
    return !text || text === key ? fallback : text;
  };

  const resendEmailMutation = useResendVerificationEmail({
    onSuccess: () => {
      setSentSuccess(true);
      showToast({
        message: getTranslation(
          'com_auth_email_resent_success',
          'Verification email sent successfully.',
        ),
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

  const handleResend = () => {
    if (!user?.email) {
      return;
    }
    resendEmailMutation.mutate({ email: user.email });
  };

  const isExpired =
    user?.emailVerified === true && isEmailVerificationExpired(user?.emailVerifiedAt, user?.createdAt);

  const handleCheckVerification = async () => {
    setIsChecking(true);
    try {
      await queryClient.invalidateQueries([QueryKeys.user]);
      const updatedUser = await queryClient.fetchQuery([QueryKeys.user]);
      const isStillExpired =
        updatedUser?.emailVerified === true &&
        isEmailVerificationExpired(updatedUser?.emailVerifiedAt, updatedUser?.createdAt);

      if (updatedUser?.emailVerified === true && !isStillExpired) {
        queryClient.setQueryData([QueryKeys.user], updatedUser);
        setUser(updatedUser);
        showToast({
          message: getTranslation(
            'com_auth_email_verification_success',
            'Email verified successfully!',
          ),
          status: 'success',
        });
        onOpenChange(false);
      } else {
        showToast({
          message: isStillExpired
            ? getTranslation(
                'com_auth_email_verification_still_expired',
                'Email verification has expired (required every 6 months). Please click the new verification link sent to your email.',
              )
            : getTranslation(
                'com_auth_email_verification_still_unverified',
                'Email is not verified yet. Please check your inbox and click the verification link.',
              ),
          status: 'warning',
        });
      }
    } catch {
      showToast({
        message: 'Unable to check verification status. Please try again.',
        status: 'error',
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent
        showCloseButton={false}
        className="w-11/12 max-w-md gap-0 overflow-hidden p-0 text-center"
      >
        {/* Soft amber/green gradient header */}
        <div className="bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent px-6 pb-2 pt-8 dark:from-amber-400/10">
          <OGDialogHeader className="flex flex-col items-center gap-4 space-y-0 text-center sm:text-center">
            <span className="relative flex size-16 items-center justify-center rounded-2xl bg-surface-primary shadow-md ring-1 ring-amber-500/20 dark:ring-amber-400/20">
              <Mail className="size-8 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-amber-500 text-white ring-2 ring-surface-primary">
                !
              </span>
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <OGDialogTitle className="text-center text-lg font-semibold text-text-primary sm:text-xl">
                {getTranslation('com_auth_email_verification_required', 'Email Verification Required')}
              </OGDialogTitle>
              <OGDialogDescription className="text-center text-sm leading-relaxed text-text-secondary">
                {isExpired
                  ? getTranslation(
                      'com_auth_email_verification_expired_prompt',
                      'Your email verification has expired (required every 6 months). Please check your inbox or resend the verification email to continue asking questions.',
                    )
                  : getTranslation(
                      'com_auth_email_verification_submit_blocked',
                      'You must verify your email address before submitting questions. Please check your inbox or resend the verification email.',
                    )}
              </OGDialogDescription>
            </div>
          </OGDialogHeader>

          {/* User Email Pill */}
          {user?.email && (
            <div className="mt-3 flex items-center justify-center">
              <span className="inline-flex max-w-full truncate rounded-full border border-border-light bg-surface-secondary px-3 py-1 text-xs font-medium text-text-secondary">
                {user.email}
              </span>
            </div>
          )}

          {/* Success notice if email resent */}
          {sentSuccess && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              <span>
                {getTranslation('com_auth_email_resent_success', 'Verification email sent! Please check your inbox.')}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex flex-col gap-2.5 border-t border-border-light p-5 sm:flex-row sm:gap-3 sm:px-6">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendEmailMutation.isLoading || isChecking}
            className={cn(
              ACTION_BUTTON_BASE,
              'bg-green-600 font-semibold text-white cursor-pointer',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_8px_-2px_rgba(25,135,84,0.5)]',
              'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_2px_10px_-2px_rgba(117,215,178,0.3)]',
              'hover:-translate-y-px hover:opacity-90',
              'focus-visible:ring-green-600/50',
              (resendEmailMutation.isLoading || isChecking) && 'opacity-60 cursor-not-allowed',
            )}
          >
            {resendEmailMutation.isLoading ? (
              <span className="flex items-center gap-2">
                <Spinner className="size-4" />
                <span>Sending...</span>
              </span>
            ) : (
              getTranslation('com_auth_email_resend_link', 'Resend Email')
            )}
          </button>

          <button
            type="button"
            onClick={handleCheckVerification}
            disabled={isChecking || resendEmailMutation.isLoading}
            className={cn(
              ACTION_BUTTON_BASE,
              'border border-border-medium bg-surface-primary font-medium text-text-primary cursor-pointer',
              'hover:bg-surface-hover hover:text-text-primary focus-visible:ring-border-heavy',
              (isChecking || resendEmailMutation.isLoading) && 'opacity-60 cursor-not-allowed',
            )}
          >
            {isChecking ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="size-3.5 animate-spin" />
                <span>Checking...</span>
              </span>
            ) : (
              getTranslation('com_auth_email_verification_check_button', "I've Verified")
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(
              ACTION_BUTTON_BASE,
              'border border-border-light bg-transparent font-medium text-text-secondary cursor-pointer',
              'hover:bg-surface-hover hover:text-text-primary focus-visible:ring-border-light',
            )}
          >
            {getTranslation('com_ui_cancel', 'Cancel')}
          </button>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
