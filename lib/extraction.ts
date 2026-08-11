import { ContactFields } from './schema';
import { Detection, ocrToText } from './ocrToText';
import { parseModelJson } from './parseModelJson';
import { buildRetryUserMessage, buildSystemPrompt, buildUserMessage } from './prompt';

export interface Msg {
  role: 'system' | 'user';
  content: string;
}

export interface ExtractionDeps {
  ocrForward(imageUri: string): Promise<Detection[]>;
  llmGenerate(messages: Msg[]): Promise<string>;
}

export type ExtractionResult =
  | { status: 'ok'; fields: ContactFields; rawText: string }
  | { status: 'no-text' }
  | { status: 'unparsed'; rawText: string };

export async function extractContact(deps: ExtractionDeps, imageUri: string): Promise<ExtractionResult> {
  const detections = await deps.ocrForward(imageUri);
  const rawText = ocrToText(detections);
  if (rawText.trim() === '') return { status: 'no-text' };

  const system: Msg = { role: 'system', content: buildSystemPrompt() };

  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const user: Msg = {
      role: 'user',
      content: attempt === 0 ? buildUserMessage(rawText) : buildRetryUserMessage(rawText, lastError),
    };
    try {
      const response = await deps.llmGenerate([system, user]);
      return { status: 'ok', fields: parseModelJson(response), rawText };
    } catch (e) {
      lastError = (e as Error).message;
    }
  }
  return { status: 'unparsed', rawText };
}
