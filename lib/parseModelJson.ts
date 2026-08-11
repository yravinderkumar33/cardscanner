import { jsonrepair } from 'jsonrepair';
import { ContactFields, contactFieldsSchema, normalizeContactFields } from './schema';

// Same job as the library's fixAndValidateStructuredOutput (jsonrepair + schema
// validation), reimplemented here so lib/ has no react-native-executorch import.
export function parseModelJson(text: string): ContactFields {
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```(?:json)?/g, '')
    .trim();

  // Isolate the outermost {...} if the model wrapped it in prose.
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1) throw new Error('No JSON object found in model output');
  cleaned = cleaned.slice(start, end === -1 ? undefined : end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonrepair(cleaned));
  } catch (e) {
    throw new Error(`Could not repair model output into JSON: ${(e as Error).message}`);
  }

  const result = contactFieldsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Model output does not match contact schema: ${result.error.message}`);
  }
  return normalizeContactFields(result.data);
}
