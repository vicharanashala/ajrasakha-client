import {
  useRef,
  useMemo,
  useState,
  useEffect,
  ReactNode,
  useContext,
  useCallback,
  createContext,
} from 'react';
import { debounce } from 'lodash';
import { useRecoilState } from 'recoil';
import { useLocation, useNavigate } from 'react-router-dom';
import { setTokenHeader, SystemRoles } from 'librechat-data-provider';
import type * as t from 'librechat-data-provider';
import {
  useGetRole,
  useGetUserQuery,
  useLoginUserMutation,
  useLogoutUserMutation,
  useRefreshTokenMutation,
} from '~/data-provider';
import { TAuthConfig, TUserContext, TAuthContext, TResError } from '~/common';
import useTimeout from './useTimeout';
import store from '~/store';
import { useToastContext } from '@librechat/client';
import useLocalize from './useLocalize';

const AuthContext = createContext<TAuthContext | undefined>(undefined);

/** Shared in-flight refresh request, so concurrent callers reuse one call instead of racing token rotation. */
let refreshInFlight: Promise<t.TRefreshTokenResponse | undefined> | null = null;

/** Upper bound for the delay between session validation retries after temporary failures. */
const MAX_REFRESH_RETRY_DELAY_MS = 30000;

// Reads the HTTP status of a failed request, if the server responded at all.
const getErrorStatus = (err: unknown): number | undefined =>
  (err as TResError | undefined)?.response?.status;

// True only when the server definitively rejected the session, as opposed to network or server errors.
const isDefinitiveAuthFailure = (err: unknown) => {
  const status = getErrorStatus(err);
  return status === 401 || status === 403;
};

const AuthContextProvider = ({
  authConfig,
  children,
}: {
  authConfig?: TAuthConfig;
  children: ReactNode;
}) => {
  const { showToast } = useToastContext();
  const localize = useLocalize();
  const [user, setUser] = useRecoilState(store.user);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const logoutRedirectRef = useRef<string | undefined>(undefined);

  /** True until the first session validation on load has a definitive result. */
  const [isInitializing, setIsInitializing] = useState(true);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryAttemptRef = useRef(0);
  const location = useLocation();
  /** Latest pathname, read inside async refresh callbacks without re-creating them. */
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;
  const { mutateAsync: refreshAsync } = useRefreshTokenMutation();

  // Runs a token refresh, reusing the in-flight request when one is already pending.
  const refreshOnce = useCallback(() => {
    refreshInFlight ??= refreshAsync(undefined).finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }, [refreshAsync]);

  const { data: userRole = null } = useGetRole(SystemRoles.USER, {
    enabled: !!(isAuthenticated && (user?.role ?? '')),
  });
  const { data: adminRole = null } = useGetRole(SystemRoles.ADMIN, {
    enabled: !!(isAuthenticated && user?.role === SystemRoles.ADMIN),
  });

  const navigate = useNavigate();

  const setUserContext = useMemo(
    () =>
      debounce((userContext: TUserContext) => {
        const { token, isAuthenticated, user, redirect } = userContext;
        setUser(user);
        setToken(token);
        //@ts-ignore - ok for token to be undefined initially
        setTokenHeader(token);
        setIsAuthenticated(isAuthenticated);

        // Use a custom redirect if set
        const finalRedirect = logoutRedirectRef.current || redirect;
        // Clear the stored redirect
        logoutRedirectRef.current = undefined;

        if (finalRedirect == null) {
          return;
        }

        if (finalRedirect.startsWith('http://') || finalRedirect.startsWith('https://')) {
          window.location.href = finalRedirect;
        } else {
          navigate(finalRedirect, { replace: true });
        }
      }, 50),
    [navigate, setUser],
  );
  const doSetError = useTimeout({ callback: (error) => setError(error as string | undefined) });

  const loginUser = useLoginUserMutation({
    onSuccess: (data: t.TLoginResponse) => {
      const { user, token, twoFAPending, tempToken } = data;
      if (twoFAPending) {
        // Redirect to the two-factor authentication route.
        navigate(`/login/2fa?tempToken=${tempToken}`, { replace: true });
        return;
      }
      setError(undefined);
      setUserContext({ token, isAuthenticated: true, user, redirect: '/c/new' });
    },
    onError: (error: TResError | unknown) => {
      const resError = error as TResError;
      const errorData = resError?.response?.data;
      let errorCode: string | undefined = undefined;
      // Check if the backend sent an array
      if (Array.isArray(errorData) && errorData.length > 0) {
        errorCode = errorData[0]?.errorCode;
      }// check if it as a standard object
      else if (errorData && typeof errorData === 'object') {
        errorCode = errorData?.errorCode;
      }
      let errorMsg = errorCode === 'ERR_ADMIN_VERIFICATION_PENDING' ? errorCode : resError.message
      if(errorCode === 'ERR_ADMIN_VERIFICATION_PENDING'){
        showToast({ message:localize('com_auth_error_login_admin_verfication') , status: 'error' });
      }
      doSetError(errorMsg);
      navigate('/login', { replace: true });
    },
  });
  const logoutUser = useLogoutUserMutation({
    onSuccess: (data) => {
      setUserContext({
        token: undefined,
        isAuthenticated: false,
        user: undefined,
        redirect: data.redirect ?? '/login',
      });
      localStorage.getItem('lang_selected');
    },
    onError: (error) => {
      doSetError((error as Error).message);
      setUserContext({
        token: undefined,
        isAuthenticated: false,
        user: undefined,
        redirect: '/login',
      });
      localStorage.getItem('lang_selected');
    },
  });

  const logout = useCallback(
    (redirect?: string) => {
      if (redirect) {
        logoutRedirectRef.current = redirect;
      }
      logoutUser.mutate(undefined);
    },
    [logoutUser],
  );

  const userQuery = useGetUserQuery({ enabled: !!(token ?? '') });

  const login = (data: t.TLoginUser) => {
    loginUser.mutate(data);
  };

  /** Latest silentRefresh, so a scheduled retry always calls the current version. */
  const silentRefreshRef = useRef<() => void>(() => undefined);
  /** Shows the retry notice; kept in a ref so silentRefresh stays stable across renders. */
  const notifyRetryRef = useRef(() => undefined as void);
  notifyRetryRef.current = () =>
    showToast({ message: localize('com_auth_session_check_retrying'), status: 'warning' });

  // Restores the session from the refresh cookie. Logs out only when the server rejects the session.
  const silentRefresh = useCallback(() => {
    if (authConfig?.test === true) {
      console.log('Test mode. Skipping silent refresh.');
      setIsInitializing(false);
      return;
    }
    clearTimeout(retryTimerRef.current);

    refreshOnce()
      .then((data) => {
        retryAttemptRef.current = 0;
        const { user, token = '' } = data ?? {};
        if (token) {
          // A restored session should not leave the user sitting on the login page.
          const redirect = pathnameRef.current === '/login' ? '/c/new' : undefined;
          setUserContext({ token, isAuthenticated: true, user, redirect });
        } else {
          console.log('Token is not present. User is not authenticated.');
          navigate('/login');
        }
        setIsInitializing(false);
      })
      .catch((error: unknown) => {
        if (isDefinitiveAuthFailure(error)) {
          const code = (error as TResError).response?.data?.code;
          console.warn(`[AuthContext] Session rejected by server (${code ?? 'unknown'}), redirecting to login.`);
          retryAttemptRef.current = 0;
          setIsInitializing(false);
          navigate('/login');
          return;
        }

        // Network or server failure: keep the current state and retry with capped backoff.
        const attempt = retryAttemptRef.current++;
        const delay = Math.min(1000 * 2 ** attempt, MAX_REFRESH_RETRY_DELAY_MS);
        console.warn(
          `[AuthContext] Session validation unavailable (status=${getErrorStatus(error) ?? 'network'}), retry ${attempt + 1} in ${delay}ms.`,
        );
        if (attempt === 0) {
          notifyRetryRef.current();
        }
        retryTimerRef.current = setTimeout(() => silentRefreshRef.current(), delay);
      });
  }, [authConfig?.test, refreshOnce, setUserContext, navigate]);
  silentRefreshRef.current = silentRefresh;

  useEffect(() => () => clearTimeout(retryTimerRef.current), []);

  useEffect(() => {
    if (userQuery.data) {
      setUser(userQuery.data);
    } else if (userQuery.isError) {
      doSetError((userQuery.error as Error).message);
      // Temporary failures (network, 5xx) must not log out a user whose session is still valid.
      if (isDefinitiveAuthFailure(userQuery.error)) {
        navigate('/login', { replace: true });
      }
    }
    if (error != null && error && isAuthenticated) {
      doSetError(undefined);
    }
    if (token == null || !token || !isAuthenticated) {
      silentRefresh();
    }
  }, [
    token,
    isAuthenticated,
    userQuery.data,
    userQuery.isError,
    userQuery.error,
    error,
    setUser,
    navigate,
    silentRefresh,
    setUserContext,
  ]);

  useEffect(() => {
    const handleTokenUpdate = (event) => {
      console.log('tokenUpdated event received event');
      const newToken = event.detail;
      setUserContext({
        token: newToken,
        isAuthenticated: true,
        user: user,
      });
    };

    window.addEventListener('tokenUpdated', handleTokenUpdate);

    return () => {
      window.removeEventListener('tokenUpdated', handleTokenUpdate);
    };
  }, [setUserContext, user]);

  // Make the provider update only when it should
  const memoedValue = useMemo(
    () => ({
      user,
      token,
      error,
      login,
      logout,
      setError,
      roles: {
        [SystemRoles.USER]: userRole,
        [SystemRoles.ADMIN]: adminRole,
      },
      isAuthenticated,
      isInitializing,
    }),

    [user, error, isAuthenticated, isInitializing, token, userRole, adminRole],
  );

  return <AuthContext.Provider value={memoedValue}>{children}</AuthContext.Provider>;
};

const useAuthContext = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuthContext should be used inside AuthProvider');
  }

  return context;
};

export { AuthContextProvider, useAuthContext, AuthContext };
