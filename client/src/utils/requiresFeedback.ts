import { Constants } from 'librechat-data-provider';

// Cache the enabled state to avoid repeated API calls
let feedbackEnforcementEnabled: boolean | null = null;

export async function requiresFeedbackFromConversation(conversationId: string): Promise<boolean> {
  // Skip check if no valid conversation ID (e.g., "new" conversation)
  if (!conversationId || conversationId === 'new' || conversationId === Constants.NEW_CONVO) {
    return false;
  }

  // If we already know feedback enforcement is disabled, skip API call
  if (feedbackEnforcementEnabled === false) {
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
      alert(`LangGraph API Configuration Error: ${errorMessage}`);
      return false;
    }

    const data = await response.json();
    
    // Cache the enabled state on first response
    if (feedbackEnforcementEnabled === null && 'enabled' in data) {
      feedbackEnforcementEnabled = data.enabled === true;
    }

    return data.requiresFeedback === true;
  } catch (err) {
    alert('Error: Unable to connect to the feedback service. Please try again later.');
    return false;
  }
}

// Export function to check if feedback enforcement is enabled
export function isFeedbackEnforcementEnabled(): boolean {
  return feedbackEnforcementEnabled !== false;
}

// Export function to reset the cached state (useful for testing)
export function resetFeedbackEnforcementCache(): void {
  feedbackEnforcementEnabled = null;
}
