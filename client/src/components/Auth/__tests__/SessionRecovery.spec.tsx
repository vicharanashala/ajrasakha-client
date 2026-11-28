import React from 'react';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecoilRoot } from 'recoil';
import '@testing-library/jest-dom';
import SessionRecoveryPrompt from '../SessionRecoveryPrompt';
import SessionRecoveryVerify from '../SessionRecoveryVerify';
import Login from '../Login';
import * as reactRouter from 'react-router-dom';
import * as mutations from '~/data-provider/mutations';

jest.mock('~/hooks/useLocalize', () => () => (key: string, values?: any) => {
  if (key === 'com_auth_session_recovery_redirecting' && values) {
    return `Redirecting to chat in ${values[0]}s...`;
  }
  return key;
});

const mockNavigate = jest.fn();
let mockOutletContext: any = {
  startupConfig: {
    emailLoginEnabled: true,
    registrationEnabled: false,
    socialLoginEnabled: false,
  },
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useSearchParams: jest.fn(() => [new URLSearchParams('token=mock-token&userId=507f1f77bcf86cd799439011')]),
  useOutletContext: () => mockOutletContext,
}));

const mockSetUserContext = jest.fn();
let mockAuthContextValue: any = {
  setUserContext: mockSetUserContext,
  error: undefined,
  setError: jest.fn(),
  login: jest.fn(),
  sessionRecoveryData: null,
};

jest.mock('~/hooks/AuthContext', () => {
  const actual = jest.requireActual('~/hooks/AuthContext');
  return {
    ...actual,
    useAuthContext: () => mockAuthContextValue,
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const render = (ui: React.ReactElement) => {
  return rtlRender(
    <RecoilRoot>
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    </RecoilRoot>
  );
};

describe('SessionRecovery Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(mutations, 'useSessionRecoveryRequestMutation').mockReturnValue({
      mutate: jest.fn(),
      isLoading: false,
    } as any);
    jest.spyOn(mutations, 'useSessionRecoveryVerifyMutation').mockReturnValue({
      mutate: jest.fn(),
      isLoading: false,
    } as any);
  });

  describe('SessionRecoveryPrompt', () => {
    it('renders prompt with email and action button', () => {
      render(
        <SessionRecoveryPrompt
          recoveryTempToken="mock-temp-token"
          email="farmer@example.com"
        />,
      );

      expect(screen.getByText(/farmer@example.com/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /com_auth_session_recovery_action/i })).toBeInTheDocument();
    });

    it('triggers session recovery request mutation on button click', async () => {
      const mockMutate = jest.fn();
      jest.spyOn(mutations, 'useSessionRecoveryRequestMutation').mockReturnValue({
        mutate: mockMutate,
        isLoading: false,
      } as any);

      render(
        <SessionRecoveryPrompt
          recoveryTempToken="mock-temp-token-123"
          email="farmer@example.com"
        />,
      );

      const button = screen.getByRole('button', { name: /com_auth_session_recovery_action/i });
      fireEvent.click(button);

      expect(mockMutate).toHaveBeenCalledWith({
        recoveryTempToken: 'mock-temp-token-123',
      });
    });

    it('displays error message if request fails', () => {
      jest.spyOn(mutations, 'useSessionRecoveryRequestMutation').mockImplementation((options?: any) => {
        return {
          mutate: () => {
            if (options?.onError) {
              options.onError({
                response: { data: { message: 'Account is not eligible' } },
              });
            }
          },
          isLoading: false,
        } as any;
      });

      render(
        <SessionRecoveryPrompt
          recoveryTempToken="mock-temp-token"
          email="farmer@example.com"
        />,
      );

      const button = screen.getByRole('button', { name: /com_auth_session_recovery_action/i });
      fireEvent.click(button);

      expect(screen.getByText('Account is not eligible')).toBeInTheDocument();
    });

    it('displays confirmation when verification email is successfully sent', () => {
      jest.spyOn(mutations, 'useSessionRecoveryRequestMutation').mockImplementation((options?: any) => {
        return {
          mutate: () => {
            if (options?.onSuccess) {
              options.onSuccess({ success: true, message: 'Email sent' });
            }
          },
          isLoading: false,
        } as any;
      });

      render(
        <SessionRecoveryPrompt
          recoveryTempToken="mock-temp-token"
          email="farmer@example.com"
        />,
      );

      const button = screen.getByRole('button', { name: /com_auth_session_recovery_action/i });
      fireEvent.click(button);

      expect(screen.getByText(/com_auth_session_recovery_sent/i)).toBeInTheDocument();
    });
  });

  describe('SessionRecoveryVerify Page', () => {
    it('triggers verification mutation on mount and shows loading state', () => {
      const mockMutate = jest.fn();
      jest.spyOn(mutations, 'useSessionRecoveryVerifyMutation').mockReturnValue({
        mutate: mockMutate,
        isLoading: true,
      } as any);

      render(<SessionRecoveryVerify />);

      expect(screen.getByText('com_auth_session_recovery_verifying_title')).toBeInTheDocument();
      expect(mockMutate).toHaveBeenCalledWith({
        token: 'mock-token',
        userId: '507f1f77bcf86cd799439011',
      });
    });

    it('shows success UI and sets user context upon successful verification', async () => {
      jest.spyOn(mutations, 'useSessionRecoveryVerifyMutation').mockImplementation((options?: any) => {
        return {
          mutate: () => {
            if (options?.onSuccess) {
              options.onSuccess({
                message: 'Session recovered',
                token: 'recovered-auth-token',
                user: { id: '507f1f77bcf86cd799439011', email: 'farmer@example.com' },
              });
            }
          },
          isLoading: false,
        } as any;
      });

      render(<SessionRecoveryVerify />);

      expect(screen.getByText('com_auth_session_recovery_success_title')).toBeInTheDocument();
      expect(mockSetUserContext).toHaveBeenCalledWith({
        token: 'recovered-auth-token',
        isAuthenticated: true,
        user: { id: '507f1f77bcf86cd799439011', email: 'farmer@example.com' },
        redirect: '/c/new',
      });
    });

    it('shows error UI with server error message upon failed verification', () => {
      jest.spyOn(mutations, 'useSessionRecoveryVerifyMutation').mockImplementation((options?: any) => {
        return {
          mutate: () => {
            if (options?.onError) {
              options.onError({
                response: { data: { message: 'Verification link has expired' } },
              });
            }
          },
          isLoading: false,
        } as any;
      });

      render(<SessionRecoveryVerify />);

      expect(screen.getByText('com_auth_session_recovery_failed_title')).toBeInTheDocument();
      expect(screen.getByText('Verification link has expired')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /com_auth_back_to_login/i })).toBeInTheDocument();
    });
  });

  describe('Login component session recovery integration', () => {
    it('displays SessionRecoveryPrompt when user encounters session conflict and is eligible', () => {
      mockAuthContextValue = {
        error: 'You are already logged in on one device. Logout to access in this device.',
        setError: jest.fn(),
        login: jest.fn(),
        logout: jest.fn(),
        isAuthenticated: false,
        isInitializing: false,
        user: undefined,
        token: undefined,
        sessionRecoveryData: {
          eligible: true,
          recoveryTempToken: 'temp-token-xyz',
          email: 'farmer@example.com',
        },
      };

      render(<Login />);

      expect(
        screen.getByText('You are already logged in on one device. Logout to access in this device.'),
      ).toBeInTheDocument();
      expect(screen.getByText(/farmer@example.com/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /com_auth_session_recovery_action/i }),
      ).toBeInTheDocument();
    });

    it('does NOT display SessionRecoveryPrompt when user is ineligible', () => {
      mockAuthContextValue = {
        error: 'You are already logged in on one device. Logout to access in this device.',
        setError: jest.fn(),
        login: jest.fn(),
        logout: jest.fn(),
        isAuthenticated: false,
        isInitializing: false,
        user: undefined,
        token: undefined,
        sessionRecoveryData: null,
      };

      render(<Login />);

      expect(
        screen.getByText('You are already logged in on one device. Logout to access in this device.'),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /com_auth_session_recovery_action/i }),
      ).not.toBeInTheDocument();
    });
  });
});
