const express = require('express');

const router = express.Router();

const LANGGRAPH_API_HOST = process.env.LANGGRAPH_API_HOST ?? '100.100.108.44';
const LANGGRAPH_API_PORT = Number(process.env.LANGGRAPH_API_PORT ?? 2026);

const FEEDBACK_ENFORCEMENT_ENABLED = process.env.FEEDBACK_ENFORCEMENT_ENABLED === 'true';

const FEEDBACK_TOOLS = ['gdb', 'knowledge_base', 'weather', 'soil', 'mandi', 'chemical_checker'];

/**
 * GET /api/langgraph/requires-feedback/:conversationId
 * Check if a conversation requires feedback based on tool usage
 */
router.get('/requires-feedback/:conversationId', async (req, res) => {
  const { conversationId } = req.params;

  // If feedback enforcement is disabled, skip the check
  if (!FEEDBACK_ENFORCEMENT_ENABLED) {
    return res.json({ requiresFeedback: false, enabled: false });
  }

  if (!LANGGRAPH_API_HOST || !LANGGRAPH_API_PORT) {
    return res.status(500).json({
      error:
        'LangGraph API is not configured. Please set LANGGRAPH_API_HOST and LANGGRAPH_API_PORT in the .env file on the server.',
    });
  }

  const apiUrl = `http://${LANGGRAPH_API_HOST}:${LANGGRAPH_API_PORT}/threads/${conversationId}/state`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch conversation state' });
    }

    const conversation = await response.json();
    const messages = conversation?.values?.messages ?? [];
    const plan = conversation?.values?.plan ?? {};

    if (plan.is_greeting === true) {
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

    return res.json({ requiresFeedback, enabled: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;