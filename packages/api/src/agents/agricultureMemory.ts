import type { IMemoryEntryLean } from '@librechat/data-schemas';

type AgricultureMemoryKey =
  | 'crop'
  | 'state'
  | 'pincode'
  | 'district'
  | 'soil_type'
  | 'farm_size'
  | 'preferred_language';

type AgricultureCandidate = {
  key: AgricultureMemoryKey;
  value: string;
  source: string;
};

const PROFILE_KEY_ORDER: AgricultureMemoryKey[] = [
  'crop',
  'district',
  'state',
  'pincode',
  'soil_type',
  'farm_size',
  'preferred_language',
];

const PROFILE_LABELS: Record<AgricultureMemoryKey, string> = {
  crop: 'Crop',
  district: 'District',
  state: 'State',
  pincode: 'Pincode',
  soil_type: 'Soil Type',
  farm_size: 'Farm Size',
  preferred_language: 'Preferred Language',
};

const SUPPORTED_KEYS = new Set<AgricultureMemoryKey>(PROFILE_KEY_ORDER);

const cropPatterns: Array<[RegExp, string]> = [
  [/\b(?:wheat|gehun|gehu)\b/i, 'Wheat'],
  [/\b(?:paddy|rice|dhan|dhaan)\b/i, 'Paddy'],
  [/\b(?:maize|corn|makka)\b/i, 'Maize'],
  [/\b(?:cotton|kapas)\b/i, 'Cotton'],
  [/\b(?:sugarcane|ganna)\b/i, 'Sugarcane'],
  [/\b(?:mustard|sarson)\b/i, 'Mustard'],
  [/\b(?:potato|aloo)\b/i, 'Potato'],
  [/\b(?:tomato|tamatar)\b/i, 'Tomato'],
  [/\b(?:onion|pyaz|pyaaz)\b/i, 'Onion'],
  [/\b(?:soybean|soya)\b/i, 'Soybean'],
  [/\b(?:chickpea|gram|chana)\b/i, 'Chickpea'],
  [/\b(?:groundnut|peanut|moongfali)\b/i, 'Groundnut'],
  [/\b(?:bajra|millet)\b/i, 'Bajra'],
];

const soilPatterns: Array<[RegExp, string]> = [
  [/\b(?:clay|clayey)\b/i, 'Clay'],
  [/\b(?:loam|loamy)\b/i, 'Loam'],
  [/\b(?:sandy|sand)\b/i, 'Sandy'],
  [/\bblack soil\b/i, 'Black soil'],
  [/\bred soil\b/i, 'Red soil'],
  [/\balluvial\b/i, 'Alluvial'],
  [/\blaterite\b/i, 'Laterite'],
];

const languagePatterns: Array<[RegExp, string]> = [
  [/\b(?:reply|respond|speak|talk|answer)(?:\s+to\s+me)?\s+(?:in|using)\s+punjabi\b/i, 'Punjabi'],
  [/\b(?:reply|respond|speak|talk|answer)(?:\s+to\s+me)?\s+(?:in|using)\s+hindi\b/i, 'Hindi'],
  [/\b(?:reply|respond|speak|talk|answer)(?:\s+to\s+me)?\s+(?:in|using)\s+english\b/i, 'English'],
  [/\b(?:reply|respond|speak|talk|answer)(?:\s+to\s+me)?\s+(?:in|using)\s+marathi\b/i, 'Marathi'],
  [/\b(?:reply|respond|speak|talk|answer)(?:\s+to\s+me)?\s+(?:in|using)\s+gujarati\b/i, 'Gujarati'],
  [/\b(?:reply|respond|speak|talk|answer)(?:\s+to\s+me)?\s+(?:in|using)\s+tamil\b/i, 'Tamil'],
  [/\b(?:reply|respond|speak|talk|answer)(?:\s+to\s+me)?\s+(?:in|using)\s+telugu\b/i, 'Telugu'],
  [/\b(?:reply|respond|speak|talk|answer)(?:\s+to\s+me)?\s+(?:in|using)\s+bengali\b/i, 'Bengali'],
  [/\b(?:reply|respond|speak|talk|answer)(?:\s+to\s+me)?\s+(?:in|using)\s+kannada\b/i, 'Kannada'],
  [/\b(?:reply|respond|speak|talk|answer)(?:\s+to\s+me)?\s+(?:in|using)\s+malayalam\b/i, 'Malayalam'],
];

const normalizeValue = (value: string) => value.replace(/\s+/g, ' ').trim();

const addCandidate = (
  candidates: AgricultureCandidate[],
  seen: Set<string>,
  candidate: AgricultureCandidate,
) => {
  const normalized = normalizeValue(candidate.value);
  if (!normalized) {
    return;
  }

  const hash = `${candidate.key}:${normalized.toLowerCase()}`;
  if (seen.has(hash)) {
    return;
  }

  seen.add(hash);
  candidates.push({
    ...candidate,
    value: normalized,
  });
};

export function isAgricultureMemoryConfig(config?: {
  validKeys?: string[];
  autoExtract?: { enabled?: boolean; domain?: string };
  injection?: { format?: string };
}): boolean {
  const domain = config?.autoExtract?.domain?.toLowerCase();
  const injectionFormat = config?.injection?.format;
  if (config?.autoExtract?.enabled && domain === 'agriculture') {
    return true;
  }

  if (injectionFormat === 'structured_profile') {
    return true;
  }

  const validKeys = config?.validKeys ?? [];
  return validKeys.length > 0 && validKeys.every((key) => SUPPORTED_KEYS.has(key as never));
}

export function extractAgricultureMemoryHints(chat: string): AgricultureCandidate[] {
  const candidates: AgricultureCandidate[] = [];
  const seen = new Set<string>();

  const pincodeMatches = chat.match(/\b\d{6}\b/g) ?? [];
  for (const pincode of pincodeMatches) {
    addCandidate(candidates, seen, {
      key: 'pincode',
      value: pincode,
      source: 'Detected a 6-digit pincode in the conversation.',
    });
  }

  const farmSizeMatch = chat.match(
    /\b(\d+(?:\.\d+)?)\s*(acres?|acre|hectares?|hectare|ha|bighas?|bigha)\b/i,
  );
  if (farmSizeMatch) {
    addCandidate(candidates, seen, {
      key: 'farm_size',
      value: `${farmSizeMatch[1]} ${farmSizeMatch[2]}`,
      source: 'Detected an explicit farm-size mention.',
    });
  }

  const districtMatch = chat.match(
    /\b(?:district|dist\.?|zilla)\s*[:,-]?\s*([A-Za-z][A-Za-z .-]{1,40})/i,
  );
  if (districtMatch) {
    addCandidate(candidates, seen, {
      key: 'district',
      value: districtMatch[1],
      source: 'Detected an explicit district mention.',
    });
  }

  const stateMatch = chat.match(/\bstate\s*[:,-]?\s*([A-Za-z][A-Za-z .-]{1,40})/i);
  if (stateMatch) {
    addCandidate(candidates, seen, {
      key: 'state',
      value: stateMatch[1],
      source: 'Detected an explicit state mention.',
    });
  }

  const inlineLocationMatch = chat.match(
    /\b(?:i am in|i'm in|i live in|i am from|i'm from|from)\s+([A-Za-z][A-Za-z .-]{1,40}),\s*([A-Za-z][A-Za-z .-]{1,40})/i,
  );
  if (inlineLocationMatch) {
    addCandidate(candidates, seen, {
      key: 'district',
      value: inlineLocationMatch[1],
      source: 'Detected a user-stated location in "district, state" format.',
    });
    addCandidate(candidates, seen, {
      key: 'state',
      value: inlineLocationMatch[2],
      source: 'Detected a user-stated location in "district, state" format.',
    });
  }

  for (const [pattern, crop] of cropPatterns) {
    if (pattern.test(chat)) {
      addCandidate(candidates, seen, {
        key: 'crop',
        value: crop,
        source: `Detected a crop mention matching "${crop}".`,
      });
    }
  }

  for (const [pattern, soilType] of soilPatterns) {
    if (pattern.test(chat)) {
      addCandidate(candidates, seen, {
        key: 'soil_type',
        value: soilType,
        source: `Detected a soil type mention matching "${soilType}".`,
      });
    }
  }

  for (const [pattern, language] of languagePatterns) {
    if (pattern.test(chat)) {
      addCandidate(candidates, seen, {
        key: 'preferred_language',
        value: language,
        source: `Detected an explicit language preference for "${language}".`,
      });
    }
  }

  return candidates;
}

export function formatAgricultureMemoryHints(chat: string): string {
  const candidates = extractAgricultureMemoryHints(chat);
  if (candidates.length === 0) {
    return '';
  }

  return [
    '# Agriculture Profile Hints',
    'Treat these as high-confidence extraction hints from the current chat, but only save values that are actually supported by what the user said.',
    ...candidates.map((candidate) => {
      return `- ${PROFILE_LABELS[candidate.key]} -> ${candidate.value}. ${candidate.source}`;
    }),
  ].join('\n');
}

export function buildAgricultureMemoryContext(memories: IMemoryEntryLean[]): string {
  const memoryMap = new Map<string, string>();
  for (const memory of memories) {
    if (!memory?.key || !SUPPORTED_KEYS.has(memory.key as never) || !memory.value) {
      continue;
    }
    memoryMap.set(memory.key, normalizeValue(memory.value));
  }

  if (memoryMap.size === 0) {
    return '';
  }

  const lines = ['# Known Farmer Profile'];
  for (const key of PROFILE_KEY_ORDER) {
    const value = memoryMap.get(key);
    if (!value) {
      continue;
    }
    lines.push(`- ${PROFILE_LABELS[key]}: ${value}`);
  }

  lines.push(
    'Treat these values as already known farmer details. Do not ask for the same field again unless the user corrects it or the current task truly requires a missing field.',
  );

  return lines.join('\n');
}
