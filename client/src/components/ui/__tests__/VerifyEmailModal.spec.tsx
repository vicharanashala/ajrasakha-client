import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VerifyEmailModal from '../VerifyEmailModal';
import * as AuthHooks from '~/hooks/AuthContext';
import * as LocalizationHooks from '~/hooks/useLocalize';
import * as DataProvider from '~/data-provider';
import * as ClientModule from '@librechat/client';
import { useQueryClient } from '@tanstack/react-query';

jest.mock('~/hooks/AuthContext');
jest.mock('~/hooks/useLocalize');
jest.mock('~/data-provider');
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}));
jest.mock('@librechat/client', () => {
  const actual = jest.requireActual('@librechat/client');
  return {
    ...actual,
    useToastContext: jest.fn(),
  };
});

describe('VerifyEmailModal', () => {
  const mockShowToast = jest.fn();
  const mockMutate = jest.fn();
  const mockOnOpenChange = jest.fn();
  const mockInvalidateQueries = jest.fn();
  const mockFetchQuery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (LocalizationHooks.default as jest.Mock).mockImplementation(() => (key: string) => {
      const translations: Record<string, string> = {
        com_auth_email_verification_required: 'Email Verification Required',
        com_auth_email_verification_submit_blocked:
          'You must verify your email address before submitting questions. Please check your inbox or resend the verification email.',
        com_auth_email_resend_link: 'Resend Email',
        com_auth_email_verification_check_button: "I've Verified",
        com_auth_email_verification_success: 'Email verified successfully!',
        com_auth_email_verification_still_unverified:
          'Email is not verified yet. Please check your inbox and click the verification link.',
        com_ui_cancel: 'Cancel',
      };
      return translations[key] ?? key;
    });

    (ClientModule.useToastContext as jest.Mock).mockReturnValue({
      showToast: mockShowToast,
    });

    (AuthHooks.useAuthContext as jest.Mock).mockReturnValue({
      user: {
        email: 'devsvr18@gmail.com',
        emailVerified: false,
      },
      isAuthenticated: true,
    });

    (DataProvider.useResendVerificationEmail as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
    });

    (DataProvider.useGetStartupConfig as jest.Mock).mockReturnValue({
      data: { emailVerificationEnabled: true },
    });

    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
      fetchQuery: mockFetchQuery,
    });
  });

  it('does not render modal when emailVerificationEnabled is false (e.g. dev/staging)', () => {
    (DataProvider.useGetStartupConfig as jest.Mock).mockReturnValue({
      data: { emailVerificationEnabled: false },
    });

    const { container } = render(<VerifyEmailModal open={true} onOpenChange={mockOnOpenChange} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders modal content when open', () => {
    render(<VerifyEmailModal open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByText('Email Verification Required')).toBeInTheDocument();
    expect(
      screen.getByText(/You must verify your email address before submitting questions/),
    ).toBeInTheDocument();
    expect(screen.getByText('devsvr18@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Resend Email')).toBeInTheDocument();
    expect(screen.getByText("I've Verified")).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls resendEmail mutation when "Resend Email" button is clicked', () => {
    render(<VerifyEmailModal open={true} onOpenChange={mockOnOpenChange} />);

    const resendButton = screen.getByText('Resend Email');
    fireEvent.click(resendButton);

    expect(mockMutate).toHaveBeenCalledWith({ email: 'devsvr18@gmail.com' });
  });

  it('checks verification status and closes modal when verified', async () => {
    mockFetchQuery.mockResolvedValueOnce({ emailVerified: true });

    render(<VerifyEmailModal open={true} onOpenChange={mockOnOpenChange} />);

    const checkButton = screen.getByText("I've Verified");
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalled();
      expect(mockFetchQuery).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Email verified successfully!',
          status: 'success',
        }),
      );
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows warning toast if email is still unverified when checked', async () => {
    mockFetchQuery.mockResolvedValueOnce({ emailVerified: false });

    render(<VerifyEmailModal open={true} onOpenChange={mockOnOpenChange} />);

    const checkButton = screen.getByText("I've Verified");
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Email is not verified yet'),
          status: 'warning',
        }),
      );
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
    });
  });

  it('calls onOpenChange(false) when Cancel is clicked', () => {
    render(<VerifyEmailModal open={true} onOpenChange={mockOnOpenChange} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
