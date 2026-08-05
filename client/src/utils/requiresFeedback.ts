import { Constants } from 'librechat-data-provider';

// Cache the enabled state to avoid repeated API calls
let feedbackEnforcementEnabled: boolean | null = null;

/**
 * Helper to log the current feedback enforcement state.
 * - Logs "Feedback enabled" when the cached value is true.
 * - Logs "Feedback disabled" when the cached value is false, null, or undefined.
 */
function logFeedbackEnforcementState(value: boolean | null | undefined): void {
  if (value === true) {
    console.log('[Feedback] Feedback enabled');
  } else {
    // Covers false, null, and undefined
    console.log('[Feedback] Feedback disabled', { value });
  }
}

export async function requiresFeedbackFromConversation(conversationId: string): Promise<boolean> {
  // Skip check if no valid conversation ID (e.g., "new" conversation)
  if (!conversationId || conversationId === 'new' || conversationId === Constants.NEW_CONVO) {
    logFeedbackEnforcementState(feedbackEnforcementEnabled);
    return false;
  }

  // If we already know feedback enforcement is disabled, skip API call
  if (feedbackEnforcementEnabled === false) {
    logFeedbackEnforcementState(feedbackEnforcementEnabled);
    return false;
  }

  try {
    const response = await fetch(`/api/langgraph/requires-feedback/${conversationId}`);

    if (!response.ok) {
      let errorMessage = 'Failed to check feedback requirement';
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        errorMessage = `Server error: ${response.status}`;
      }
      console.error(`[Feedback] LangGraph API Configuration Error: ${errorMessage}`);
      logFeedbackEnforcementState(feedbackEnforcementEnabled);
      return false;
    }

    const data = await response.json();

    // Cache the enabled state on first response
    if (feedbackEnforcementEnabled === null && 'enabled' in data) {
      feedbackEnforcementEnabled = data.enabled === true;
    }

    logFeedbackEnforcementState(feedbackEnforcementEnabled);

    return data.requiresFeedback === true;
  } catch (err) {
    console.error('[Feedback] Error: Unable to connect to the feedback service. Please try again later.');
    logFeedbackEnforcementState(feedbackEnforcementEnabled);
    return false;
  }
}

// Export function to check if feedback enforcement is enabled
export function isFeedbackEnforcementEnabled(): boolean {
  logFeedbackEnforcementState(feedbackEnforcementEnabled);
  return feedbackEnforcementEnabled !== false;
}

// Export function to reset the cached state (useful for testing)
export function resetFeedbackEnforcementCache(): void {
  feedbackEnforcementEnabled = null;
  logFeedbackEnforcementState(feedbackEnforcementEnabled);
}
