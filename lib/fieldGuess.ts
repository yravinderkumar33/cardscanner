// Heuristics for the degraded-review flow: validate typed values and guess
// which contact field a raw OCR line belongs to.

export type FieldKey = 'fn' | 'ln' | 'co' | 'jt' | 'phones' | 'emails' | 'web' | 'ad';

export const emailLooksValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
export const phoneLooksValid = (v: string) => /^[+\d][\d\s().\-·]{5,}$/.test(v);

// Guess a field for a raw OCR line. Mirrors the design prototype's classifier;
// index breaks ties (cards usually lead with company then name, or vice versa).
export function guessLineField(text: string, index: number): FieldKey | null {
  const t = text.trim();
  if (t.indexOf('@') >= 0) return 'emails';
  // A line that is nothing but a six-digit group is a postcode, not a phone —
  // it would otherwise reach the phone branch before the address rule below.
  if (/^\d{3}\s?\d{3}$/.test(t)) return 'ad';
  if (/^[+\d(]/.test(t) && (t.match(/\d/g) || []).length >= 6) return 'phones';
  if (/^www\.|\.(com|in|io|dev|vc|se|co|net|org|ai)\b/i.test(t)) return 'web';
  // Street keywords, a six-digit postcode (IN/SG style), or a US ZIP — the
  // phone rule above has already claimed anything that opens with a number.
  if (/road|street|lane|floor|avenue|suite|\b\d{3}\s?\d{3}\b|\b\d{5}(-\d{4})?\b/i.test(t)) return 'ad';
  if (/director|manager|partner|principal|head|vp|founder|engineer|officer|lead|designer|consultant/i.test(t)) return 'jt';
  if (index === 0) return 'co';
  if (index === 1) return 'fn';
  return null;
}

// A short word with no vowel, or whose only vowel is its first letter, reads as
// an acronym (KPMG, HCL, IBM) rather than shouting. This function also fills
// Company and Job title, where acronyms are common. Words spelled like words
// (LABS, NASA) are title-cased — there is no way to tell them apart here.
function isAcronym(w: string): boolean {
  if (w.length > 4) return false;
  const vowels = w.replace(/[^AEIOU]/g, '');
  if (vowels.length === 0) return true;
  return vowels.length === 1 && w.length >= 3 && w[0] === vowels;
}

// ALL-CAPS OCR lines read better title-cased when placed into name-ish fields.
export function titleCaseIfShouty(t: string): string {
  if (t !== t.toUpperCase()) return t;
  return t.replace(/[A-Za-z]+/g, (w) => (isAcronym(w) ? w : w[0] + w.slice(1).toLowerCase()));
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  fn: 'First name',
  ln: 'Last name',
  co: 'Company',
  jt: 'Job title',
  phones: 'Phone',
  emails: 'Email',
  web: 'Website',
  ad: 'Address',
};
