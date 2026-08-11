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
  isCancelled?(): boolean;
}

export type ExtractionResult =
  | { status: 'ok'; fields: ContactFields; rawText: string }
  | { status: 'no-text' }
  | { status: 'unparsed'; rawText: string }
  | { status: 'cancelled' };

export async function extractContact(deps: ExtractionDeps, imageUri: string): Promise<ExtractionResult> {
  const detections = await deps.ocrForward(imageUri);
  if (deps.isCancelled?.()) return { status: 'cancelled' };
  const rawText = ocrToText(detections);
  if (rawText.trim() === '') return { status: 'no-text' };

  const system: Msg = { role: 'system', content: buildSystemPrompt() };

  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (deps.isCancelled?.()) return { status: 'cancelled' };
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
