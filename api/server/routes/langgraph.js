const express = require('express');
const axios = require('axios');

const router = express.Router();

const LANGGRAPH_API_HOST = process.env.LANGGRAPH_API_HOST ?? '100.100.108.44';
const LANGGRAPH_API_PORT = Number(process.env.LANGGRAPH_API_PORT ?? 2026);

const PROMPT_FEEDBACK_ENABLED = process.env.PROMPT_FEEDBACK_ENABLED === 'true';

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

// Log the boot-time value of PROMPT_FEEDBACK_ENABLED
logFeedbackEnforcementState(PROMPT_FEEDBACK_ENABLED, 'server-startup');

/**
 * GET /api/langgraph/requires-feedback/:conversationId
 * Check if a conversation requires feedback based on tool usage
 */
router.get('/requires-feedback/:conversationId', async (req, res) => {
  const { conversationId } = req.params;

  // If feedback enforcement is disabled, skip the check
  if (!PROMPT_FEEDBACK_ENABLED) {
    logFeedbackEnforcementState(PROMPT_FEEDBACK_ENABLED, `conversation:${conversationId}`);
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
    const options = { timeout: 10000 };

    // Use proxy if configured (same pattern as STTService/TTSService)
    if (process.env.PROXY) {
      const proxyUrl = new URL(process.env.PROXY);
      options.proxy = {
        protocol: proxyUrl.protocol.replace(':', ''),
        host: proxyUrl.hostname,
        port: Number(proxyUrl.port),
      };
    }

    const response = await axios.get(apiUrl, options);
    if (response.status !== 200) {
      return res.status(response.status).json({
        error: 'LangGraph API returned non-OK response',
        detail: `status=${response.status} for ${apiUrl}`,
      });
    }

    const conversation = response.data;
    const messages = conversation?.values?.messages ?? [];
    const plan = conversation?.values?.plan ?? {};

    if (plan.is_greeting === true) {
      logFeedbackEnforcementState(PROMPT_FEEDBACK_ENABLED, `conversation:${conversationId}`);
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

    logFeedbackEnforcementState(PROMPT_FEEDBACK_ENABLED, `conversation:${conversationId}`);
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
