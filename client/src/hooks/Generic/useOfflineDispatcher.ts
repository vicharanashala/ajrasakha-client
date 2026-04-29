import { useEffect } from 'react';
import useNetwork from './useNetwork';
import { getQueue, clearQueue } from '../../utils/queueManager';

/**
 * Custom Hook: useOfflineDispatcher
 * Purpose: Automatically empties the offline vault when the internet reconnects
 * and triggers the official LibreChat UI submission.
 */
export default function useOfflineDispatcher(submitMessage: any) {
  const isOnline = useNetwork();

  useEffect(() => {
    // Only trigger if online and the submission handler is ready
    if (isOnline && typeof submitMessage === 'function') {
      const queue = getQueue();

      if (queue.length > 0) {
        console.log(
          `[Dispatcher] Network restored. Dispatching ${queue.length} offline messages...`,
        );

        queue.forEach((msg, index) => {
          console.log(`[Dispatching ${index + 1}/${queue.length}] Text: "${msg.text}"`);

          // Dispatch queued messages via official pipeline
          submitMessage({
            text: msg.text,
            conversationId: msg.conversationId,
          });
        });

        // Wipe the Vault clean
        clearQueue();
      }
    }
  }, [isOnline, submitMessage]);
}
