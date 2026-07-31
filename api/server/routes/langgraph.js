const express = require('express');

const router = express.Router();

const LANGGRAPH_API_HOST = process.env.LANGGRAPH_API_HOST ?? '100.100.108.44';
const LANGGRAPH_API_PORT = Number(process.env.LANGGRAPH_API_PORT ?? 2026);

const FEEDBACK_ENFORCEMENT_ENABLED = process.env.FEEDBACK_ENFORCEMENT_ENABLED === 'true';

const FEEDBACK_TOOLS = ['gdb', 'knowledge_base', 'weather', 'soil', 'mandi', 'chemical_checker'];

/**
 * Helper to log the current feedback enforcement state.
 * - Logs "Feedback enabled" when the value is true.
 * - Logs "Feedback disabled" when the value is false, null, or undefined.
 */
function logFeedbackEnforcementState(value, source) {
  if (value === true) {
    console.log(`[Feedback] Feedback enabled (source: ${source})`);
  } else {
    // Covers false, null, and undefined
    console.log(`[Feedback] Feedback disabled (source: ${source})`, { value });
  }
}

// Log the boot-time value of FEEDBACK_ENFORCEMENT_ENABLED
logFeedbackEnforcementState(FEEDBACK_ENFORCEMENT_ENABLED, 'server-startup');

/**
 * GET /api/langgraph/requires-feedback/:conversationId
 * Check if a conversation requires feedback based on tool usage
 */
router.get('/requires-feedback/:conversationId', async (req, res) => {
  const { conversationId } = req.params;

  // If feedback enforcement is disabled, skip the check
  if (!FEEDBACK_ENFORCEMENT_ENABLED) {
    logFeedbackEnforcementState(FEEDBACK_ENFORCEMENT_ENABLED, `conversation:${conversationId}`);
    return res.json({ requiresFeedback: false, enabled: false });
  }

  if (!LANGGRAPH_API_HOST || !LANGGRAPH_API_PORT) {
    return res.status(500).json({
      error: 'LangGraph API is not configured',
      detail: `LANGGRAPH_API_HOST=${LANGGRAPH_API_HOST}, LANGGRAPH_API_PORT=${LANGGRAPH_API_PORT}`,
    });
  }

  const apiUrl = `http://${LANGGRAPH_API_HOST}:${LANGGRAPH_API_PORT}/threads/${conversationId}/state`;

  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'LangGraph API returned non-OK response',
        detail: `status=${response.status} for ${apiUrl}`,
      });
    }

    const conversation = await response.json();
    const messages = conversation?.values?.messages ?? [];
    const plan = conversation?.values?.plan ?? {};

    if (plan.is_greeting === true) {
      logFeedbackEnforcementState(FEEDBACK_ENFORCEMENT_ENABLED, `conversation:${conversationId}`);
      return res.json({ requiresFeedback: false, enabled: true });
    }

    let pendingTools = [];
    let requiresFeedback = false;
    let lastMessage = null;

    // Process messages in order
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      lastMessage = message;

      if (message.type === 'human') {
        // Human message resets the tool tracking
        pendingTools = [];
        continue;
      }

      // AI message with tool_calls (but no content yet)
      if (message.type === 'ai' && message.tool_calls?.length) {
        // Accumulate all tool calls
        pendingTools.push(...message.tool_calls.map((t) => t.name));
        continue;
      }

      // AI message with content string
      if (
        message.type === 'ai' &&
        typeof message.content === 'string' &&
        message.content.trim() !== ''
      ) {
        // Check if this AI message was preceded by any feedback tool
        if (pendingTools.some((tool) => FEEDBACK_TOOLS.includes(tool))) {
          requiresFeedback = true;
        }

        // Reset after this AI response
        pendingTools = [];
      }
    }

    // Don't show feedback modal if the last message is a human message
    if (lastMessage?.type === 'human') {
      requiresFeedback = false;
    }

    logFeedbackEnforcementState(FEEDBACK_ENFORCEMENT_ENABLED, `conversation:${conversationId}`);
    return res.json({ requiresFeedback, enabled: true });
  } catch (err) {
    console.error('[langgraph/requires-feedback] Error:', err.message, err.stack);
    return res.status(500).json({
      error: 'Internal server error',
      detail: err.message,
      apiUrl,
    });
  }
});

module.exports = router;
