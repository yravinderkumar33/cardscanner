const JSON_SHAPE = `{
  "firstName": string | null,
  "lastName": string | null,
  "company": string | null,
  "jobTitle": string | null,
  "phones": string[] | null,
  "emails": string[] | null,
  "website": string | null,
  "address": string | null
}`;

export function buildSystemPrompt(): string {
  return [
    'You extract contact information from the OCR text of a business card.',
    'Respond with ONLY a single JSON object — no explanations, no markdown fences — matching exactly this shape:',
    JSON_SHAPE,
    'Rules: use null for any field not present on the card. Do not invent data.',
    'Keep phone numbers and emails exactly as written. Put the person\'s given name in firstName and family name in lastName.',
    '/no_think',
  ].join('\n\n');
}

export function buildUserMessage(rawText: string): string {
  return `Business card OCR text:\n\n${rawText}`;
}

export function buildRetryUserMessage(rawText: string, errorMessage: string): string {
  return [
    `Business card OCR text:\n\n${rawText}`,
    `Your previous answer was not valid JSON for the required shape (error: ${errorMessage}).`,
    'Respond again with ONLY the JSON object.',
  ].join('\n\n');
}
