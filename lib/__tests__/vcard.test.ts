import { buildVCard, vcardFilename } from '../vcard';
import { ContactFields } from '../schema';

const full: ContactFields = {
  firstName: 'Priya',
  lastName: 'Raghunathan',
  company: 'Example Labs',
  jobTitle: 'Director of Partnerships',
  phones: ['+1 (415) 555-0198', '+1 (415) 555-0198'],
  emails: ['priya@example.com'],
  website: 'example.com',
  address: '1 Market Street, San Francisco 94105',
};

describe('buildVCard', () => {
  it('emits all populated fields in vCard 3.0 shape', () => {
    const v = buildVCard(full);
    expect(v).toContain('BEGIN:VCARD\r\nVERSION:3.0');
    expect(v).toContain('N:Raghunathan;Priya;;;');
    expect(v).toContain('FN:Priya Raghunathan');
    expect(v).toContain('ORG:Example Labs');
    expect(v).toContain('TITLE:Director of Partnerships');
    expect(v).toContain('TEL;TYPE=WORK,VOICE:+1 (415) 555-0198');
    expect(v).toContain('TEL;TYPE=WORK,VOICE:+1 (415) 555-0198');
    expect(v).toContain('EMAIL;TYPE=WORK:priya@example.com');
    expect(v).toContain('URL:example.com');
    expect(v).toContain('ADR;TYPE=WORK:;;1 Market Street\\, San Francisco 94105;;;;');
    expect(v.trimEnd().endsWith('END:VCARD')).toBe(true);
  });

  it('escapes separators and newlines', () => {
    const v = buildVCard({ ...full, company: 'A;B,C\nD' });
    expect(v).toContain('ORG:A\\;B\\,C\\nD');
  });

  it('skips empty fields and blank list entries', () => {
    const v = buildVCard({ phones: ['', '  '], emails: [] });
    expect(v).not.toContain('TEL');
    expect(v).not.toContain('EMAIL');
    expect(v).not.toContain('ORG:');
    expect(v).toContain('FN:Scanned card');
  });

  it('falls back FN to company when no name', () => {
    const v = buildVCard({ phones: [], emails: [], company: 'Kite Financial' });
    expect(v).toContain('FN:Kite Financial');
  });
});

describe('vcardFilename', () => {
  it('builds a safe filename from the name', () => {
    expect(vcardFilename(full)).toBe('Priya-Raghunathan.vcf');
  });
  it('falls back to company then to card', () => {
    expect(vcardFilename({ phones: [], emails: [], company: 'Example Labs' })).toBe('Example-Labs.vcf');
    expect(vcardFilename({ phones: [], emails: [] })).toBe('card.vcf');
  });
  it('falls back to card for names with no ASCII-safe characters', () => {
    expect(vcardFilename({ firstName: 'Пётр', lastName: 'Иванов', phones: [], emails: [] })).toBe('card.vcf');
    expect(vcardFilename({ firstName: '李', lastName: '伟', phones: [], emails: [] })).toBe('card.vcf');
    expect(vcardFilename({ firstName: '李', lastName: '伟', company: '株式会社', phones: [], emails: [] })).toBe(
      'card.vcf'
    );
  });
  it('keeps the Latin part of a mixed-script name', () => {
    expect(vcardFilename({ firstName: 'Priya', lastName: '李', phones: [], emails: [] })).toBe('Priya.vcf');
  });
});
