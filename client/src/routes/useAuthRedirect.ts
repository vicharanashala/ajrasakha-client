import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks';

// Redirects to login once session validation has finished without an authenticated user.
export default function useAuthRedirect() {
  const { user, roles, isAuthenticated, isInitializing } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for the initial session check, otherwise a slow refresh bounces valid users to login.
    if (isInitializing === true) {
      return;
    }
    const timeout = setTimeout(() => {
      if (!isAuthenticated) {
        navigate('/login', { replace: true });
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [isAuthenticated, isInitializing, navigate]);

  return {
    user,
    roles,
    isAuthenticated,
    isInitializing,
  };
}
