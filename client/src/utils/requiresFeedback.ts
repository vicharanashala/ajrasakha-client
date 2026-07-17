const FEEDBACK_TOOLS = ['gdb', 'knowledge_base', 'weather', 'soil', 'mandi', 'chemical_checker'];
const dummJson = {
  values: {
    messages: [
      {
        content: 'Information regarding control of Karnal Bunt disease',
        additional_kwargs: {},
        response_metadata: {},
        type: 'human',
        name: null,
        id: '26034cd1-45da-4880-ab0d-1fd65cec1fb5',
      },
      {
        content: '',
        additional_kwargs: {},
        response_metadata: {},
        type: 'ai',
        name: null,
        id: '9d587d16-1df5-432b-9186-ff8bd4555f49',
        tool_calls: [
          {
            name: 'gdb',
            args: {
              rephrased_query: 'Information regarding control of Karnal Bunt disease',
              crop: 'Wheat',
              state: 'Kerala',
              latitude: 10.3528744,
              longitude: 76.5120396,
              address: 'Kerala, India',
            },
            id: 'call_c9d610554d57456ead811e59',
            type: 'tool_call',
          },
        ],
        invalid_tool_calls: [],
        usage_metadata: null,
      },
      {
        content:
          '{"rephrased_query": "Information regarding control of Karnal Bunt disease", "state": "Kerala", "crop": "Wheat", "is_exact": false, "is_similar": false, "exact_match": {}, "classification_audit": {"status": "empty", "model": "google/gemma-4-26B-A4B-it", "relevance_filter_mode": "batch_all_candidates", "evaluations": [{"question_id": "6a57cb3480e72b1080afbc35", "similarity_score": 0.8198778629302979, "retrieved_question": "How to control Flea Beetle in Wheat crop in Kerala?", "relevance_decision": "KEEP", "relevance_reason": "Related topic: wheat pest management", "classification": "NOT_COVERED", "reason": "The farmer is asking about Karnal Bunt disease, but the retrieved Q&A is about Flea Beetle.", "llm_parse_ok": true, "action": "rejected_classification", "chosen_for_answer": false}, {"question_id": "6a57c7af80e72b1080afbadc", "similarity_score": 0.816247820854187, "retrieved_question": "How to control Jassids in Wheat in Kerala?", "relevance_decision": "KEEP", "relevance_reason": "Related topic: wheat pest management", "classification": "NOT_COVERED", "reason": "The farmer is asking about Karnal Bunt disease, but the retrieved answer discusses Jassids and other insect pests, with no mention of Karnal Bunt.", "llm_parse_ok": true, "action": "rejected_classification", "chosen_for_answer": false}, {"question_id": "6a57cacf80e72b1080afbbe0", "similarity_score": 0.8158881664276123, "retrieved_question": "How to control Whorl Maggot in Wheat crop in Kerala?", "relevance_decision": "KEEP", "relevance_reason": "Related topic: wheat pest management", "classification": "NOT_COVERED", "reason": "The farmer is asking about Karnal Bunt disease, but the retrieved answer discusses Whorl Maggot and other insect pests.", "llm_parse_ok": true, "action": "rejected_classification", "chosen_for_answer": false}, {"question_id": "6a578b65e976f18ba932bd0d", "similarity_score": 0.8133068680763245, "retrieved_question": "How to control Cutworm in Wheat in Kerala?", "relevance_decision": "KEEP", "relevance_reason": "Related topic: wheat pest management", "classification": "NOT_COVERED", "reason": "The farmer is asking about Karnal Bunt disease, but the retrieved answer provides information about Cutworm pest.", "llm_parse_ok": true, "action": "rejected_classification", "chosen_for_answer": false}, {"question_id": "6a578db7e976f18ba932bd7e", "similarity_score": 0.8115434646606445, "retrieved_question": "How to control Armyworm in Wheat in Kerala?", "relevance_decision": "KEEP", "relevance_reason": "Related topic: wheat pest management", "classification": "NOT_COVERED", "reason": "The farmer is asking about Karnal Bunt disease, but the retrieved answer is about Armyworm pest.", "llm_parse_ok": true, "action": "rejected_classification", "chosen_for_answer": false}], "selected_question_id": null, "selection_rule": "relevance_filter_then_same_intent_then_covered_by_context", "chosen_for_answer": false}}',
        additional_kwargs: {},
        response_metadata: {},
        type: 'tool',
        name: 'gdb',
        id: '576a3243-a74a-4785-ba13-a758ba82ab4c',
        tool_call_id: 'call_c9d610554d57456ead811e59',
        artifact: null,
        status: 'success',
      },
      {
        content: '',
        additional_kwargs: {},
        response_metadata: {},
        type: 'ai',
        name: null,
        id: 'c2f7da32-c4a9-4d4f-a0ef-ccb2b33916cd',
        tool_calls: [
          {
            name: 'upload_question_to_reviewer_system',
            args: {
              question: 'Information regarding control of Karnal Bunt disease',
              state_name: 'Kerala',
              crop: 'Wheat',
              details: {
                state: 'Kerala',
                district: 'all',
                crop: 'Wheat',
                season: 'General',
                domain: ['Plant Protection'],
                tools_used: [],
              },
              source: 'AJRASAKHA',
              thread_id: '1e026443-a310-48c5-a9b6-7c5810f40485',
              user_id: '6a16a6d698e3f683351ec71e',
              message_id: 'b78a34cb-27fb-43b2-8499-b0fc2b02b544',
            },
            id: 'call_ce11fc24695a4192b00b3799',
            type: 'tool_call',
          },
        ],
        invalid_tool_calls: [],
        usage_metadata: null,
      },
      {
        content: [
          {
            type: 'text',
            text: '{\n  "status": "success",\n  "status_code": 201,\n  "data": {\n    "success": true,\n    "message": "Question submitted successfully.",\n    "question_id": "6a58b20e80e72b1080afe475"\n  }\n}',
            id: 'lc_af47612b-e380-4f62-b970-4e56d77725ae',
          },
        ],
        additional_kwargs: {},
        response_metadata: {},
        type: 'tool',
        name: 'upload_question_to_reviewer_system',
        id: 'c6d89fe6-0d93-4e20-8ee5-cd36c9c48739',
        tool_call_id: 'call_ce11fc24695a4192b00b3799',
        artifact: {
          structured_content: {
            result: {
              status: 'success',
              status_code: 201,
              data: {
                success: true,
                message: 'Question submitted successfully.',
                question_id: '6a58b20e80e72b1080afe475',
              },
            },
          },
        },
        status: 'success',
      },
      {
        content:
          'Your question has been shared with our agri expert at annam.ai. You will get the answer within 2 hours.\nThank You.\n\n_____________________________\n\n⚠️ Important Notice (Testing) ⚠️\n\nThis AjraSakha application is under development and intended only for testing and validation.\nAdvisories are experimental and currently cover major crops in selected states.\n_____________________________\n\nWeather data is sourced from IMD.\nMarket data from eNAM, Agmarknet, and State APMCs.\nSoil health guidance from https://soilhealth.dac.gov.in/fertilizer-dosage.\nGovernment schemes from https://www.myscheme.gov.in/. \nOther agricultural information and advisories are expert-verified by Annam.ai. \n\nUsers should independently validate recommendations before acting.',
        additional_kwargs: {},
        response_metadata: {},
        type: 'ai',
        name: null,
        id: '9f6e5779-42c9-4b65-bacd-233629f65f32',
        tool_calls: [],
        invalid_tool_calls: [],
        usage_metadata: null,
      },
      {
        content: 'hi',
        additional_kwargs: {},
        response_metadata: {},
        type: 'human',
        name: null,
        id: '57e1b4fb-57db-414f-8b83-23484e9d07cf',
      },
      {
        content: '',
        additional_kwargs: {},
        response_metadata: {},
        type: 'ai',
        name: null,
        id: 'd5baca96-ebeb-4647-ab33-964ff2062033',
        tool_calls: [
          {
            name: 'upload_question_to_reviewer_system',
            args: {
              question: 'hi',
              state_name: 'Not specified',
              crop: 'all',
              details: {
                state: 'Not specified',
                district: 'all',
                crop: 'all',
                season: 'General',
                domain: ['General'],
                tools_used: [],
              },
              source: 'AJRASAKHA',
              thread_id: '1e026443-a310-48c5-a9b6-7c5810f40485',
              user_id: '6a16a6d698e3f683351ec71e',
              message_id: '877b88e9-7289-4d81-aa6a-3a7062ff01ae',
            },
            id: 'call_94746bf02a074ef0a5387351',
            type: 'tool_call',
          },
        ],
        invalid_tool_calls: [],
        usage_metadata: null,
      },
      {
        content: [
          {
            type: 'text',
            text: '{\n  "status": "success",\n  "status_code": 201,\n  "data": {\n    "success": true,\n    "message": "Question submitted successfully.",\n    "question_id": "6a58b25080e72b1080afe4bc"\n  }\n}',
            id: 'lc_548e661d-94ed-4fe5-bd31-789fdc7e78bb',
          },
        ],
        additional_kwargs: {},
        response_metadata: {},
        type: 'tool',
        name: 'upload_question_to_reviewer_system',
        id: '87b480d7-85ee-4284-8697-fd2ad38238ac',
        tool_call_id: 'call_94746bf02a074ef0a5387351',
        artifact: {
          structured_content: {
            result: {
              status: 'success',
              status_code: 201,
              data: {
                success: true,
                message: 'Question submitted successfully.',
                question_id: '6a58b25080e72b1080afe4bc',
              },
            },
          },
        },
        status: 'success',
      },
      {
        content:
          'Hi there! 👋 Great to connect with you. How can I help you with your farming-related problems today?',
        additional_kwargs: {},
        response_metadata: {},
        type: 'ai',
        name: null,
        id: 'a2e4613f-de91-4890-a422-f8196300feb3',
        tool_calls: [],
        invalid_tool_calls: [],
        usage_metadata: null,
      },
    ],
    location: {
      latitude: 10.3528744,
      longitude: 76.5120396,
      state: 'Kerala',
      city: 'Kerala',
      address: 'Kerala, India',
    },
    plan: {
      domain: 'General',
      weather: false,
      mandi: false,
      soil: false,
      schemes: false,
      chemical_checker: false,
      knowledge_base: false,
      is_agriculture_related: false,
      is_greeting: true,
      is_complete: true,
      missing_info: [],
      follow_up_question: null,
      reasoning: 'greeting',
      entities: {
        crop: 'all',
        state: 'Kerala',
        district: 'all',
      },
      skip_synthesize: false,
      rephrased_query: 'hi',
      original_query_en: 'hi',
      vocal_language: 'English',
      script_language: 'English',
      translate_path: null,
      expert_queue: false,
      tools_used: [],
      gdb_has_data: false,
    },
  },
  next: [],
  tasks: [],
  interrupts: [],
  metadata: {
    step: 12,
    run_id: '3297b7de-5dfd-4245-88ae-a11a94983be2',
    source: 'loop',
    parents: {},
    user_id: 'anonymous',
    message_id: '877b88e9-7289-4d81-aa6a-3a7062ff01ae',
    session_id: '1e026443-a310-48c5-a9b6-7c5810f40485',
    question_source: 'AJRASAKHA',
    langfuse_user_id: 'anonymous',
    user_display_name: 'Anonymous User',
    langfuse_session_id: '1e026443-a310-48c5-a9b6-7c5810f40485',
  },
  created_at: '2026-07-16T10:28:34.177001Z',
  checkpoint: {
    checkpoint_id: '1f181011-9217-67b0-800c-f8519661a747',
    thread_id: '1e026443-a310-48c5-a9b6-7c5810f40485',
    checkpoint_ns: '',
  },
  parent_checkpoint: {
    checkpoint_id: '1f181011-91f0-6f24-800b-b7a0155afbf0',
    thread_id: '1e026443-a310-48c5-a9b6-7c5810f40485',
    checkpoint_ns: '',
  },
  checkpoint_id: '1f181011-9217-67b0-800c-f8519661a747',
  parent_checkpoint_id: '1f181011-91f0-6f24-800b-b7a0155afbf0',
};

export async function requiresFeedbackFromConversation(conversationId: string): Promise<boolean> {
  const response = await fetch(`http://100.100.108.44:2026/threads/${conversationId}/state`);

  if (!response.ok) {
    return false;
  }

  const conversation = await response.json();
  // conversation = dummJson; // for local testing only
  const messages = conversation?.values?.messages ?? [];

  let pendingTools: string[] = [];
  let requiresFeedback = false;

  for (const message of messages) {
    if (message.type === 'human') {
      pendingTools = [];
      continue;
    }

    if (message.type === 'ai' && message.tool_calls?.length) {
      pendingTools.push(...message.tool_calls.map((t: any) => t.name));
      continue;
    }

    if (
      message.type === 'ai' &&
      typeof message.content === 'string' &&
      message.content.trim() !== ''
    ) {
      // overwrite for every final AI message
      requiresFeedback = pendingTools.some((tool) => FEEDBACK_TOOLS.includes(tool));

      pendingTools = [];
    }
  }

  return requiresFeedback;
}

export async function requiresFeedbackForMessage(
  conversationId: string,
  messageId: string,
): Promise<boolean> {
  if (!conversationId || !messageId) {
    return false;
  }
  const response = await fetch(`http://100.100.108.44:2026/threads/${conversationId}/state`);

  if (!response.ok) {
    return false;
  }

  const conversation = await response.json();
  // const conversation = dummyJson; // for testing

  const messages = conversation?.values?.messages ?? [];

  let pendingTools: string[] = [];

  for (const message of messages) {
    if (message.type === 'human') {
      pendingTools = [];
      continue;
    }

    if (message.type === 'ai' && message.tool_calls?.length > 0) {
      pendingTools.push(...message.tool_calls.map((tool: any) => tool.name));
      continue;
    }

    if (
      message.type === 'ai' &&
      message.tool_calls?.length === 0 &&
      typeof message.content === 'string' &&
      message.content.trim() !== ''
    ) {
      const requiresFeedback = pendingTools.some((tool) => FEEDBACK_TOOLS.includes(tool));

      // This is the assistant message we're rendering.
      if (message.id === messageId) {
        return requiresFeedback;
      }

      pendingTools = [];
    }
  }

  return false;
}
