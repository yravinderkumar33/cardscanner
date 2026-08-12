import { ContactFields } from './schema';

// vCard 3.0 text escaping: backslash first, then separators and newlines.
const esc = (v: string) =>
  v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function buildVCard(fields: ContactFields): string {
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];
  const first = fields.firstName ?? '';
  const last = fields.lastName ?? '';
  lines.push(`N:${esc(last)};${esc(first)};;;`);
  const fn = [first, last].filter(Boolean).join(' ') || fields.company || 'Scanned card';
  lines.push(`FN:${esc(fn)}`);
  if (fields.company) lines.push(`ORG:${esc(fields.company)}`);
  if (fields.jobTitle) lines.push(`TITLE:${esc(fields.jobTitle)}`);
  for (const phone of fields.phones) {
    if (phone.trim()) lines.push(`TEL;TYPE=WORK,VOICE:${esc(phone.trim())}`);
  }
  for (const email of fields.emails) {
    if (email.trim()) lines.push(`EMAIL;TYPE=WORK:${esc(email.trim())}`);
  }
  if (fields.website) lines.push(`URL:${esc(fields.website)}`);
  if (fields.address) lines.push(`ADR;TYPE=WORK:;;${esc(fields.address)};;;;`);
  lines.push('END:VCARD');
  return lines.join('\r\n') + '\r\n';
}

// \w is ASCII-only, so each part is sanitized before joining — joining first
// would leave a bare '-' for a name written in a non-Latin script.
const filenamePart = (v: string | undefined) =>
  (v ?? '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');

export function vcardFilename(fields: ContactFields): string {
  const name = [filenamePart(fields.firstName), filenamePart(fields.lastName)].filter(Boolean).join('-');
  const safe = name || filenamePart(fields.company);
  return `${/\w/.test(safe) ? safe : 'card'}.vcf`;
}
