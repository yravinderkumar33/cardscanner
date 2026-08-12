import { emailLooksValid, guessLineField, phoneLooksValid, titleCaseIfShouty } from '../fieldGuess';

describe('validators', () => {
  it('accepts real emails, rejects truncated ones', () => {
    expect(emailLooksValid('priya@example.com')).toBe(true);
    expect(emailLooksValid('priya@example')).toBe(false);
    expect(emailLooksValid('not an email')).toBe(false);
  });
  it('accepts phone-ish strings, rejects words', () => {
    expect(phoneLooksValid('+1 (415) 555-0198')).toBe(true);
    expect(phoneLooksValid('(415) 555-0198')).toBe(false); // validator requires a leading + or digit
    expect(phoneLooksValid('415 555 0198')).toBe(true);
    expect(phoneLooksValid('call me')).toBe(false);
  });
});

describe('guessLineField', () => {
  const raw = [
    'EXAMPLE LABS',
    'PRIYA RAGHUNATHAN',
    'Director of Partnerships',
    '+1 (415) 555-0198',
    'priya@example.com',
    'www.example.com',
    '1 Market Street',
    'San Francisco 94105',
  ];
  it('classifies typical card lines', () => {
    expect(guessLineField(raw[0], 0)).toBe('co');
    expect(guessLineField(raw[1], 1)).toBe('fn');
    expect(guessLineField(raw[2], 2)).toBe('jt');
    expect(guessLineField(raw[3], 3)).toBe('phones');
    expect(guessLineField(raw[4], 4)).toBe('emails');
    expect(guessLineField(raw[5], 5)).toBe('web');
    expect(guessLineField(raw[6], 6)).toBe('ad');
    expect(guessLineField(raw[7], 7)).toBe('ad');
  });
  it('returns null for unclassifiable mid-card lines', () => {
    expect(guessLineField('est. 1998', 5)).toBe(null);
  });
  it('reads a bare postcode line as an address, not a phone', () => {
    expect(guessLineField('560 025', 6)).toBe('ad');
    expect(guessLineField('560025', 6)).toBe('ad');
  });
  it('still reads digit-led phone numbers as phones', () => {
    expect(guessLineField('415 555 0198', 3)).toBe('phones');
    expect(guessLineField('(415) 555-0198', 3)).toBe('phones');
  });
});

describe('titleCaseIfShouty', () => {
  it('title-cases ALL-CAPS strings', () => {
    expect(titleCaseIfShouty('PRIYA RAGHUNATHAN')).toBe('Priya Raghunathan');
    expect(titleCaseIfShouty('MERIDIAN-LABS')).toBe('Meridian-Labs');
  });
  it('leaves mixed-case strings alone', () => {
    expect(titleCaseIfShouty('McDonald')).toBe('McDonald');
  });
  it('leaves short acronyms alone', () => {
    expect(titleCaseIfShouty('IBM')).toBe('IBM');
    expect(titleCaseIfShouty('KPMG')).toBe('KPMG');
    expect(titleCaseIfShouty('HCL')).toBe('HCL');
    expect(titleCaseIfShouty('TCS INDIA')).toBe('TCS India');
  });
});
