const CODE_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Datos inválidos',
  NOT_FOUND: 'No encontrado',
  CONFLICT: 'Conflicto con el estado actual',
};

/**
 * Maps a fetchBackofficeApi rejection (`Error("API error: <status> <statusText> <body>")`)
 * to a Spanish UI message. Unknown shapes fall back to `fallback`.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const match = /^API error: \d+ ([\s\S]*)$/.exec(err.message);
  if (!match) return fallback;
  const rest = match[1];
  const brace = rest.indexOf('{');
  if (brace < 0) return fallback;
  let body: { code?: string; message?: string };
  try {
    body = JSON.parse(rest.slice(brace));
  } catch {
    return fallback;
  }
  const base = (body.code && CODE_MESSAGES[body.code]) || fallback;
  if (base === fallback) return fallback;
  return body.message ? `${base}: ${body.message}` : base;
}
