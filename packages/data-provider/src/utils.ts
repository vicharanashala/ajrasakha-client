export const envVarRegex = /^\${(.+)}$/;

/** Extracts the environment variable name from a template literal string */
export function extractVariableName(value: string): string | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(envVarRegex);
  return match ? match[1] : null;
}

/** Regex to match environment variable with optional default value */
const envVarWithDefaultRegex = /\${([^}:]+)(?::-([^}]*))?}/g;

/**
 * Extracts the value of an environment variable from a string.
 * Supports default values in the format ${VAR:-default} or ${VAR:-default:port}
 */
export function extractEnvVariable(value: string) {
  if (!value) {
    return value;
  }

  // Trim the input
  const trimmed = value.trim();

  // For multiple variables, process them using a regex loop
  const regex = /\${([^}:]+)(?::-([^}]*))?}/g;
  let result = trimmed;

  // First collect all matches and their positions
  const matches = [];
  let match;
  while ((match = regex.exec(trimmed)) !== null) {
    matches.push({
      fullMatch: match[0],
      varName: match[1],
      defaultValue: match[2] ?? null,
      index: match.index,
    });
  }

  // Process matches in reverse order to avoid position shifts
  for (let i = matches.length - 1; i >= 0; i--) {
    const { fullMatch, varName, defaultValue, index } = matches[i];
    const envValue = process.env[varName];
    const replacementValue = envValue ?? defaultValue ?? fullMatch;

    // Replace at exact position
    result = result.substring(0, index) + replacementValue + result.substring(index + fullMatch.length);
  }

  return result;
}

/**
 * Normalize the endpoint name to system-expected value.
 * @param name
 */
export function normalizeEndpointName(name = ''): string {
  return name.toLowerCase() === 'ollama' ? 'ollama' : name;
}
