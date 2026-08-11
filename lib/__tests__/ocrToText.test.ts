import { ocrToText, Detection } from '../ocrToText';

const d = (x1: number, y1: number, x2: number, y2: number, text: string, score = 0.9): Detection => ({
  bbox: { x1, y1, x2, y2 }, text, score,
});

describe('ocrToText', () => {
  it('orders lines top to bottom', () => {
    const out = ocrToText([d(0, 100, 50, 120, 'second'), d(0, 10, 50, 30, 'first')]);
    expect(out).toBe('first\nsecond');
  });

  it('orders words left to right within a line even if input is scrambled (library issue #1159 regression)', () => {
    // Same y-band, deliberately out of x order:
    const out = ocrToText([d(200, 10, 260, 30, 'jane@acme.com'), d(0, 12, 60, 32, 'Email:')]);
    expect(out).toBe('Email: jane@acme.com');
  });

  it('groups slightly misaligned boxes into one line (y-centers within half box height)', () => {
    const out = ocrToText([d(0, 10, 50, 30, 'Jane'), d(60, 14, 120, 34, 'Doe'), d(0, 60, 80, 80, 'Acme Corp')]);
    expect(out).toBe('Jane Doe\nAcme Corp');
  });

  it('drops low-confidence detections (default minScore 0.3)', () => {
    const out = ocrToText([d(0, 10, 50, 30, 'keep', 0.9), d(60, 10, 120, 30, 'noise', 0.1)]);
    expect(out).toBe('keep');
  });

  it('caps output length (default 1500 chars, context-overflow guard)', () => {
    const long = Array.from({ length: 300 }, (_, i) => d(0, i * 40, 100, i * 40 + 20, 'wordwordword'));
    expect(ocrToText(long).length).toBeLessThanOrEqual(1500);
  });

  it('returns empty string for no usable detections', () => {
    expect(ocrToText([])).toBe('');
    expect(ocrToText([d(0, 0, 10, 10, 'x', 0.05)])).toBe('');
  });
});
