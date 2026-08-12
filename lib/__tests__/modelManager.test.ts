// modelManager reaches native modules at import time; only formatBytes is pure,
// so the native deps are stubbed to keep this a plain node test.
jest.mock('expo-file-system', () => ({ Directory: class {}, File: class {}, Paths: {} }));
jest.mock('react-native-executorch', () => ({ models: { ocr: { craft: () => ({}) }, llm: { qwen3_0_6b: () => ({}) } } }));
// virtual: the fetcher's package exports have no node condition to resolve.
jest.mock('react-native-executorch-expo-resource-fetcher', () => ({ ExpoResourceFetcher: {} }), { virtual: true });

import { formatBytes } from '../modelManager';

describe('formatBytes', () => {
  it('formats each unit', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });
  it('promotes instead of printing a rounded 1024 of the smaller unit', () => {
    expect(formatBytes(1024 * 1024 - 1)).toBe('1 MB');
    expect(formatBytes(1073741300)).toBe('1.0 GB');
    expect(formatBytes(1073300000)).toBe('1.0 GB');
  });
});
