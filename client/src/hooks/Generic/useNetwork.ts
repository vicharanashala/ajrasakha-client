import { useState, useEffect } from 'react';

/**
 * Custom Hook: useNetwork
 * Purpose: Monitors the browser's online/offline status in real-time.
 */
export default function useNetwork() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof window !== 'undefined' ? window.navigator.onLine : true,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
