// packages/client/src/utils/queueManager.ts

export interface QueuedMessage {
  id: string;
  text: string;
  conversationId?: string | null;
  parentMessageId?: string | null;
  timestamp: number;
}

const QUEUE_KEY = 'ajrasakha_offline_queue';

/**
 * Retrieves the current array of pending messages from local storage.
 */
export const getQueue = (): QueuedMessage[] => {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[QueueManager] Failed to read queue:', error);
    return [];
  }
};

/**
 * Packages a new message and appends it to the persistent queue.
 */
export const saveToQueue = (message: Omit<QueuedMessage, 'id' | 'timestamp'>): void => {
  try {
    const queue = getQueue();
    const newMessage: QueuedMessage = {
      ...message,
      // Fallback to Date.now() if crypto is unavailable in older browsers
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `msg_${Date.now()}`,
      timestamp: Date.now(),
    };

    queue.push(newMessage);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log(`[QueueManager] Saved. Total in queue: ${queue.length}`);
  } catch (error) {
    console.error('[QueueManager] Failed to save message:', error);
  }
};

/**
 * Wipes the queue clean after successful background synchronization.
 */
export const clearQueue = (): void => {
  try {
    localStorage.removeItem(QUEUE_KEY);
    console.log('[QueueManager] Queue cleared.');
  } catch (error) {
    console.error('[QueueManager] Failed to clear queue:', error);
  }
};
