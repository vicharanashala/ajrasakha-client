import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VerifyEmailBanner, isRupUser } from '../VerifyEmailBanner';
import * as AuthHooks from '~/hooks/AuthContext';
import * as LocalizationHooks from '~/hooks/useLocalize';
import * as DataProvider from '~/data-provider';
import * as ClientModule from '@librechat/client';

jest.mock('~/hooks/AuthContext');
jest.mock('~/hooks/useLocalize');
jest.mock('~/data-provider');
jest.mock('@librechat/client', () => {
  const actual = jest.requireActual('@librechat/client');
  return {
    ...actual,
    useToastContext: jest.fn(),
  };
});

describe('VerifyEmailBanner & isRupUser helper', () => {
  const mockShowToast = jest.fn();
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();

    (LocalizationHooks.default as jest.Mock).mockImplementation(() => (key: string) => {
      const translations: Record<string, string> = {
        com_auth_email_address: 'Email',
        com_auth_email_verification_banner_prompt: 'Please verify your email address to secure your account.',
        com_auth_email_resend_link: 'Resend Email',
        com_auth_email_resent_success: 'Verification email sent successfully.',
      };
      return translations[key] ?? key;
    });

    (ClientModule.useToastContext as jest.Mock).mockReturnValue({
      showToast: mockShowToast,
    });

    (DataProvider.useResendVerificationEmail as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
    });

    (DataProvider.useGetStartupConfig as jest.Mock).mockReturnValue({
      data: { emailVerificationEnabled: true },
    });
  });

  describe('isRupUser', () => {
    it('returns false when user is null or undefined', () => {
      expect(isRupUser(null)).toBe(false);
      expect(isRupUser(undefined)).toBe(false);
    });

    it('returns true when user email starts with "rup" case-insensitively', () => {
      expect(isRupUser({ email: 'rup12345@domain.com' })).toBe(true);
      expect(isRupUser({ email: 'RUP_TEST@domain.com' })).toBe(true);
      expect(isRupUser({ email: '  rupFarmer@domain.com  ' })).toBe(true);
    });

    it('returns false for normal non-rup email', () => {
      expect(isRupUser({ email: 'john.doe@example.com' })).toBe(false);
      expect(isRupUser({ email: 'internal.user@annam.ai' })).toBe(false);
    });

    it('returns true when user has rupId', () => {
      expect(isRupUser({ email: 'user@example.com', rupId: 'RUP-001' })).toBe(true);
    });

    it('returns true when idOnTheSource starts with rup', () => {
      expect(isRupUser({ email: 'user@example.com', idOnTheSource: 'rup_source_99' })).toBe(true);
    });

    it('returns true for external FARMER role', () => {
      expect(isRupUser({ email: 'user@example.com', userRole: 'FARMER' })).toBe(true);
    });
  });

  describe('VerifyEmailBanner rendering', () => {
    it('does not render if user is not authenticated', () => {
      (AuthHooks.useAuthContext as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        user: { email: 'user@example.com', emailVerified: false },
      });

      const { container } = render(<VerifyEmailBanner />);
      expect(container.firstChild).toBeNull();
    });

    it('does not render if user is already verified (emailVerified === true)', () => {
      (AuthHooks.useAuthContext as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { email: 'user@example.com', emailVerified: true },
      });

      const { container } = render(<VerifyEmailBanner />);
      expect(container.firstChild).toBeNull();
    });

    it('does not render if email verification is disabled in startupConfig', () => {
      (AuthHooks.useAuthContext as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { email: 'user@example.com', emailVerified: false },
      });
      (DataProvider.useGetStartupConfig as jest.Mock).mockReturnValue({
        data: { emailVerificationEnabled: false },
      });

      const { container } = render(<VerifyEmailBanner />);
      expect(container.firstChild).toBeNull();
    });

    it('does not render for RUP email accounts', () => {
      (AuthHooks.useAuthContext as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { email: 'rup999@example.com', emailVerified: false },
      });

      const { container } = render(<VerifyEmailBanner />);
      expect(container.firstChild).toBeNull();
    });

    it('does not render for users with a RUP ID', () => {
      (AuthHooks.useAuthContext as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { email: 'someone@example.com', rupId: 'RUP-XYZ', emailVerified: false },
      });

      const { container } = render(<VerifyEmailBanner />);
      expect(container.firstChild).toBeNull();
    });

    it('does not render for external FARMER users', () => {
      (AuthHooks.useAuthContext as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { email: 'farmer@example.com', userRole: 'FARMER', emailVerified: false },
      });

      const { container } = render(<VerifyEmailBanner />);
      expect(container.firstChild).toBeNull();
    });

    it('renders banner for unverified non-RUP users', () => {
      (AuthHooks.useAuthContext as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { email: 'internal_user@example.com', emailVerified: false },
      });

      render(<VerifyEmailBanner />);
      expect(screen.getByTestId('verify-email-banner')).toBeInTheDocument();
      expect(screen.getByText(/internal_user@example\.com/)).toBeInTheDocument();
      expect(screen.getByTestId('resend-verification-button')).toBeInTheDocument();
      expect(screen.getByTestId('dismiss-verification-banner')).toBeInTheDocument();
    });

    it('calls resendEmailMutation when clicking Resend Email button', () => {
      (AuthHooks.useAuthContext as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { email: 'internal_user@example.com', emailVerified: false },
      });

      render(<VerifyEmailBanner />);
      const resendButton = screen.getByTestId('resend-verification-button');
      fireEvent.click(resendButton);

      expect(mockMutate).toHaveBeenCalledWith({ email: 'internal_user@example.com' });
    });

    it('hides banner when clicking dismiss button and sets sessionStorage', () => {
      (AuthHooks.useAuthContext as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { email: 'internal_user@example.com', emailVerified: false },
      });

      const { rerender } = render(<VerifyEmailBanner />);
      expect(screen.getByTestId('verify-email-banner')).toBeInTheDocument();

      const dismissButton = screen.getByTestId('dismiss-verification-banner');
      fireEvent.click(dismissButton);

      expect(sessionStorage.getItem('dismiss_verify_email_banner')).toBe('true');
      expect(screen.queryByTestId('verify-email-banner')).toBeNull();
    });

    it('does not render if already dismissed in sessionStorage', () => {
      sessionStorage.setItem('dismiss_verify_email_banner', 'true');

      (AuthHooks.useAuthContext as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { email: 'internal_user@example.com', emailVerified: false },
      });

      const { container } = render(<VerifyEmailBanner />);
      expect(container.firstChild).toBeNull();
    });
  });
});
