import { scannedLabel, sectionLabel, whenLabel } from '../dates';

// Fixed "now": Tue Aug 11 2026, 14:30 local.
const now = new Date(2026, 7, 11, 14, 30);
const iso = (y: number, m: number, d: number, h = 10, min = 5) => new Date(y, m, d, h, min).toISOString();

describe('sectionLabel', () => {
  it('labels today and yesterday', () => {
    expect(sectionLabel(iso(2026, 7, 11), now)).toBe('Today');
    expect(sectionLabel(iso(2026, 7, 10), now)).toBe('Yesterday');
  });
  it('groups earlier same-month days', () => {
    expect(sectionLabel(iso(2026, 7, 3), now)).toBe('Earlier in August');
  });
  it('uses month name for earlier months this year', () => {
    expect(sectionLabel(iso(2026, 6, 28), now)).toBe('July');
  });
  it('adds the year for older scans', () => {
    expect(sectionLabel(iso(2025, 11, 24), now)).toBe('December 2025');
  });
});

describe('whenLabel', () => {
  it('shows time for today', () => {
    expect(whenLabel(iso(2026, 7, 11, 14, 14), now)).toBe('2:14 PM');
    expect(whenLabel(iso(2026, 7, 11, 0, 7), now)).toBe('12:07 AM');
  });
  it('shows Yesterday and short dates', () => {
    expect(whenLabel(iso(2026, 7, 10), now)).toBe('Yesterday');
    expect(whenLabel(iso(2026, 7, 6), now)).toBe('Aug 6');
    expect(whenLabel(iso(2025, 6, 21), now)).toBe('Jul 21, 2025');
  });
});

describe('scannedLabel', () => {
  it('prefixes Today with the time', () => {
    expect(scannedLabel(iso(2026, 7, 11, 14, 14), now)).toBe('Today, 2:14 PM');
    expect(scannedLabel(iso(2026, 7, 6), now)).toBe('Aug 6');
  });
});
