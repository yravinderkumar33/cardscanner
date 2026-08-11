import { contactFieldsSchema, normalizeContactFields, emptyContactFields } from '../schema';

describe('contactFieldsSchema', () => {
  it('accepts a full payload', () => {
    const raw = contactFieldsSchema.parse({
      firstName: 'Jane', lastName: 'Doe', company: 'Acme', jobTitle: 'CTO',
      phones: ['+91 98765 43210'], emails: ['jane@acme.com'],
      website: 'https://acme.com', address: '1 Main St, Pune',
    });
    expect(raw.firstName).toBe('Jane');
  });

  it('accepts nulls for absent fields (the prompt tells the model to use null)', () => {
    const raw = contactFieldsSchema.parse({ firstName: 'Jane', lastName: null, phones: null, emails: null });
    expect(raw.lastName).toBeNull();
  });

  it('accepts missing keys', () => {
    expect(() => contactFieldsSchema.parse({})).not.toThrow();
  });

  it('rejects wrong shapes', () => {
    expect(() => contactFieldsSchema.parse({ phones: 'not-an-array' })).toThrow();
    expect(() => contactFieldsSchema.parse({ firstName: 42 })).toThrow();
  });
});

describe('normalizeContactFields', () => {
  it('maps null/missing to undefined and null arrays to []', () => {
    const f = normalizeContactFields({ firstName: 'Jane', lastName: null, phones: null });
    expect(f.firstName).toBe('Jane');
    expect(f.lastName).toBeUndefined();
    expect(f.phones).toEqual([]);
    expect(f.emails).toEqual([]);
  });

  it('preserves provided arrays', () => {
    const f = normalizeContactFields({ phones: ['123'], emails: ['a@b.c'] });
    expect(f.phones).toEqual(['123']);
    expect(f.emails).toEqual(['a@b.c']);
  });
});

describe('emptyContactFields', () => {
  it('returns all-empty fields', () => {
    expect(emptyContactFields()).toEqual({ phones: [], emails: [] });
  });
});
