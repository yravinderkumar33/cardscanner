import { extractContact, ExtractionDeps } from '../extraction';
import { Detection } from '../ocrToText';

const det = (text: string, index: number): Detection => ({
  bbox: { x1: 0, y1: index * 40, x2: 100, y2: index * 40 + 20 }, text, score: 0.9,
});
const CARD = [det('Jane Doe', 0), det('CTO, Acme Corp', 1), det('jane@acme.com', 2)];
const GOOD_JSON = '{"firstName":"Jane","lastName":"Doe","company":"Acme Corp","jobTitle":"CTO","phones":null,"emails":["jane@acme.com"],"website":null,"address":null}';

describe('extractContact', () => {
  it('happy path: ocr → llm → validated fields', async () => {
    const llmCalls: { role: string; content: string }[][] = [];
    const deps: ExtractionDeps = {
      ocrForward: async () => CARD,
      llmGenerate: async (msgs) => { llmCalls.push(msgs); return GOOD_JSON; },
    };
    const result = await extractContact(deps, 'file:///card.jpg');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.fields.firstName).toBe('Jane');
      expect(result.fields.emails).toEqual(['jane@acme.com']);
      expect(result.rawText).toContain('Jane Doe');
    }
    expect(llmCalls).toHaveLength(1);
    expect(llmCalls[0][0].role).toBe('system');
    expect(llmCalls[0][1].content).toContain('Jane Doe');
  });

  it('returns no-text when OCR yields nothing usable', async () => {
    const deps: ExtractionDeps = {
      ocrForward: async () => [],
      llmGenerate: async () => { throw new Error('must not be called'); },
    };
    expect((await extractContact(deps, 'x')).status).toBe('no-text');
  });

  it('retries once with the validation error, then succeeds', async () => {
    let call = 0;
    const contents: string[] = [];
    const deps: ExtractionDeps = {
      ocrForward: async () => CARD,
      llmGenerate: async (msgs) => {
        contents.push(msgs[1].content);
        call += 1;
        return call === 1 ? 'garbage, no json here' : GOOD_JSON;
      },
    };
    const result = await extractContact(deps, 'x');
    expect(result.status).toBe('ok');
    expect(call).toBe(2);
    expect(contents[1]).toContain('previous answer was not valid');
  });

  it('degrades to unparsed (with rawText) after two failures', async () => {
    const deps: ExtractionDeps = {
      ocrForward: async () => CARD,
      llmGenerate: async () => 'still garbage',
    };
    const result = await extractContact(deps, 'x');
    expect(result.status).toBe('unparsed');
    if (result.status === 'unparsed') expect(result.rawText).toContain('Jane Doe');
  });

  it('treats a thrown llmGenerate as a failed attempt (e.g. context overflow error 18)', async () => {
    const deps: ExtractionDeps = {
      ocrForward: async () => CARD,
      llmGenerate: async () => { throw new Error('Failed to generate text, error code: 18'); },
    };
    expect((await extractContact(deps, 'x')).status).toBe('unparsed');
  });
});
