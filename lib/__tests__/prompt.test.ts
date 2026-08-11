import { buildSystemPrompt, buildUserMessage, buildRetryUserMessage } from '../prompt';

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt();

  it('describes every schema field', () => {
    for (const key of ['firstName', 'lastName', 'company', 'jobTitle', 'phones', 'emails', 'website', 'address']) {
      expect(prompt).toContain(key);
    }
  });

  it('instructs null for absent fields and forbids invention', () => {
    expect(prompt).toContain('null');
    expect(prompt.toLowerCase()).toContain('do not invent');
  });

  it('ends with /no_think (Qwen 3 reasoning off)', () => {
    expect(prompt.trimEnd().endsWith('/no_think')).toBe(true);
  });
});

describe('buildUserMessage', () => {
  it('embeds the OCR text', () => {
    expect(buildUserMessage('ACME CORP\nJane Doe')).toContain('ACME CORP\nJane Doe');
  });
});

describe('buildRetryUserMessage', () => {
  it('embeds OCR text and the validation error', () => {
    const msg = buildRetryUserMessage('ACME', 'phones must be an array');
    expect(msg).toContain('ACME');
    expect(msg).toContain('phones must be an array');
  });
});
