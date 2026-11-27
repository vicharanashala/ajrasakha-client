import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import VerifyEmail from '../VerifyEmail';
import * as LocalizationHooks from '~/hooks/useLocalize';
import * as DataProvider from '~/data-provider';
import * as ReactRouterDom from 'react-router-dom';

jest.mock('~/hooks/useLocalize');
jest.mock('~/data-provider');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
  useSearchParams: jest.fn(),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
    fetchQuery: jest.fn().mockResolvedValue({ emailVerified: true }),
    setQueryData: jest.fn(),
  })),
}));
jest.mock('recoil', () => {
  const actualRecoil = jest.requireActual('recoil');
  return {
    ...actualRecoil,
    useSetRecoilState: () => jest.fn(),
  };
});
jest.mock('@librechat/client', () => ({
  Spinner: ({ className }: { className?: string }) => <div data-testid="mock-spinner" className={className} />,
  ThemeSelector: () => <div data-testid="mock-theme-selector" />,
}));

describe('VerifyEmail Component', () => {
  const mockNavigate = jest.fn();
  let mockVerifyMutate: jest.Mock;
  let mockResendMutate: jest.Mock;
  let verifySuccessCallback: () => void;
  let verifyErrorCallback: (err: unknown) => void;
  let resendSuccessCallback: () => void;
  let resendErrorCallback: (err: unknown) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    (ReactRouterDom.useNavigate as jest.Mock).mockReturnValue(mockNavigate);

    (LocalizationHooks.default as jest.Mock).mockImplementation(() => (key: string, params?: { 0: string }) => {
      const translations: Record<string, string> = {
        com_auth_email_verification_success: 'Email verified successfully',
        com_auth_email_verification_failed: 'Email verification failed',
        com_auth_email_verification_failed_token_missing: 'Verification failed, token missing',
        com_auth_email_verification_invalid: 'Invalid email verification',
        com_auth_email_verification_in_progress: 'Verifying your email, please wait',
        com_auth_email_verification_redirecting: `Redirecting in ${params?.['0'] ?? '3'} seconds...`,
        com_auth_email_resend_link: 'Resend Email',
        com_auth_email_resent_success: 'Verification email resent successfully',
        com_auth_email_resent_failed: 'Failed to resend verification email',
        com_auth_back_to_login: 'Back to Login',
        com_ui_continue: 'Continue',
      };
      return translations[key] ?? key;
    });

    mockVerifyMutate = jest.fn();
    mockResendMutate = jest.fn();

    (DataProvider.useVerifyEmailMutation as jest.Mock).mockImplementation((options?: {
      onSuccess?: () => void;
      onError?: (err: unknown) => void;
    }) => {
      if (options?.onSuccess) {
        verifySuccessCallback = options.onSuccess;
      }
      if (options?.onError) {
        verifyErrorCallback = options.onError;
      }
      return {
        mutate: mockVerifyMutate,
        isLoading: false,
      };
    });

    (DataProvider.useResendVerificationEmail as jest.Mock).mockImplementation((options?: {
      onSuccess?: () => void;
      onError?: (err: unknown) => void;
    }) => {
      if (options?.onSuccess) {
        resendSuccessCallback = options.onSuccess;
      }
      if (options?.onError) {
        resendErrorCallback = options.onError;
      }
      return {
        mutate: mockResendMutate,
        isLoading: false,
      };
    });
  });

  it('triggers email verification mutation on mount with token and email params', () => {
    (ReactRouterDom.useSearchParams as jest.Mock).mockReturnValue([
      new URLSearchParams('token=xyz123&email=farmer@example.com'),
    ]);

    render(<VerifyEmail />);

    expect(mockVerifyMutate).toHaveBeenCalledWith({
      email: 'farmer@example.com',
      token: 'xyz123',
    });
    expect(screen.getByTestId('verification-loading-animation')).toBeInTheDocument();
    expect(screen.getByText('Verifying your email, please wait')).toBeInTheDocument();
  });

  it('renders tick animation and success view when verification succeeds', () => {
    (ReactRouterDom.useSearchParams as jest.Mock).mockReturnValue([
      new URLSearchParams('token=xyz123&email=farmer@example.com'),
    ]);

    render(<VerifyEmail />);

    act(() => {
      verifySuccessCallback();
    });

    expect(screen.getByTestId('verification-success-animation')).toBeInTheDocument();
    expect(screen.getByText('Email verified successfully')).toBeInTheDocument();
    expect(screen.getByText('Redirecting in 3 seconds...')).toBeInTheDocument();

    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(continueButton).toBeInTheDocument();
    fireEvent.click(continueButton);
    expect(mockNavigate).toHaveBeenCalledWith('/c/new', { replace: true });
  });

  it('renders failed animation and error view when verification fails', () => {
    (ReactRouterDom.useSearchParams as jest.Mock).mockReturnValue([
      new URLSearchParams('token=xyz123&email=farmer@example.com'),
    ]);

    render(<VerifyEmail />);

    act(() => {
      verifyErrorCallback(new Error('Invalid token'));
    });

    expect(screen.getByTestId('verification-failed-animation')).toBeInTheDocument();
    expect(screen.getByText('Email verification failed')).toBeInTheDocument();

    const resendButton = screen.getByRole('button', { name: /resend email/i });
    expect(resendButton).toBeInTheDocument();
    fireEvent.click(resendButton);
    expect(mockResendMutate).toHaveBeenCalledWith({ email: 'farmer@example.com' });

    const loginButton = screen.getByRole('button', { name: /back to login/i });
    expect(loginButton).toBeInTheDocument();
    fireEvent.click(loginButton);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('displays resend success feedback when resend email succeeds', () => {
    (ReactRouterDom.useSearchParams as jest.Mock).mockReturnValue([
      new URLSearchParams('token=xyz123&email=farmer@example.com'),
    ]);

    render(<VerifyEmail />);

    act(() => {
      verifyErrorCallback(new Error('Invalid token'));
    });

    const resendButton = screen.getByRole('button', { name: /resend email/i });
    fireEvent.click(resendButton);

    act(() => {
      resendSuccessCallback();
    });

    expect(screen.getByText('Verification email resent successfully')).toBeInTheDocument();
  });

  it('renders failed animation with token missing message when token param is absent', () => {
    (ReactRouterDom.useSearchParams as jest.Mock).mockReturnValue([
      new URLSearchParams('email=farmer@example.com'),
    ]);

    render(<VerifyEmail />);

    expect(mockVerifyMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId('verification-failed-animation')).toBeInTheDocument();
    expect(screen.getByText('Verification failed, token missing')).toBeInTheDocument();
  });

  it('renders failed animation with invalid verification message when email param is absent', () => {
    (ReactRouterDom.useSearchParams as jest.Mock).mockReturnValue([
      new URLSearchParams('token=xyz123'),
    ]);

    render(<VerifyEmail />);

    expect(mockVerifyMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId('verification-failed-animation')).toBeInTheDocument();
    expect(screen.getByText('Invalid email verification')).toBeInTheDocument();
  });
});
