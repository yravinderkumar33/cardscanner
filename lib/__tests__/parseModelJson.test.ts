import { parseModelJson } from '../parseModelJson';

describe('parseModelJson', () => {
  it('parses clean JSON', () => {
    const f = parseModelJson('{"firstName":"Jane","lastName":"Doe","phones":["123"],"emails":null}');
    expect(f.firstName).toBe('Jane');
    expect(f.phones).toEqual(['123']);
    expect(f.emails).toEqual([]);
  });

  it('strips markdown code fences', () => {
    const f = parseModelJson('```json\n{"firstName":"Jane"}\n```');
    expect(f.firstName).toBe('Jane');
  });

  it('strips <think> blocks (Qwen reasoning leakage)', () => {
    const f = parseModelJson('<think>the name is Jane</think>{"firstName":"Jane"}');
    expect(f.firstName).toBe('Jane');
  });

  it('repairs almost-JSON (trailing commas, single quotes)', () => {
    const f = parseModelJson("{'firstName': 'Jane', 'phones': ['123',],}");
    expect(f.firstName).toBe('Jane');
    expect(f.phones).toEqual(['123']);
  });

  it('extracts the JSON object from surrounding prose', () => {
    const f = parseModelJson('Here is the contact: {"firstName":"Jane"} Hope this helps!');
    expect(f.firstName).toBe('Jane');
  });

  it('throws on unusable text', () => {
    expect(() => parseModelJson('I could not read the card, sorry.')).toThrow();
  });

  it('throws on schema-violating JSON', () => {
    expect(() => parseModelJson('{"phones": "12345"}')).toThrow();
  });
});
