import { Directory, File, Paths } from 'expo-file-system';
import { models } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

// Storage management for the two on-device models. Files live in
// Documents/react-native-executorch/ under a sanitized-URL filename —
// both facts come from the resource fetcher's own implementation, and
// deletion goes through its public deleteResources API.

const RNE_DIR_NAME = 'react-native-executorch';

interface OcrConfig {
  detectorSource: string;
  recognizerSource: string;
}
interface LlmConfig {
  modelSource: string;
  tokenizerSource: string;
  tokenizerConfigSource: string;
}

export const ocrSources = (): string[] => {
  const cfg = models.ocr.craft({ language: 'en' }) as unknown as OcrConfig;
  return [cfg.detectorSource, cfg.recognizerSource];
};

export const llmSources = (): string[] => {
  const cfg = models.llm.qwen3_0_6b() as unknown as LlmConfig;
  return [cfg.modelSource, cfg.tokenizerSource, cfg.tokenizerConfigSource];
};

// Mirrors ResourceFetcherUtils.getFilenameFromUri (not exported by the lib).
const filenameFromUri = (uri: string) =>
  uri.replace(/^https?:\/\//, '').split('#')[0].replace(/[^a-zA-Z0-9._-]/g, '_');

function sourceFile(source: string): File {
  return new File(Paths.document, RNE_DIR_NAME, filenameFromUri(source));
}

export function modelBytesOnDisk(sources: string[]): number {
  let total = 0;
  for (const src of sources) {
    try {
      const f = sourceFile(src);
      if (f.exists) total += f.size ?? 0;
    } catch {
      // unreadable file — count as 0
    }
  }
  return total;
}

export function modelInstalled(sources: string[]): boolean {
  try {
    return sources.every((src) => sourceFile(src).exists);
  } catch {
    return false;
  }
}

// Tiny module-level event so screens can refresh cached size stats after a
// model is deleted (ModelsScreen is pushed over Settings without remounting
// it, so a delete there must notify Settings some other way).
const listeners = new Set<() => void>();

export function onModelsChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function emitModelsChanged(): void {
  listeners.forEach((cb) => cb());
}

export async function deleteModel(sources: string[]): Promise<void> {
  await ExpoResourceFetcher.deleteResources(...sources);
  emitModelsChanged();
}

export function allModelsBytes(): number {
  try {
    const dir = new Directory(Paths.document, RNE_DIR_NAME);
    return dir.exists ? (dir.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

export function availableDiskBytes(): number {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

export function formatBytes(bytes: number): string {
  // Thresholds account for the rounding that follows, so a value in the top
  // half-unit promotes instead of printing "1024 KB".
  if (bytes >= 1023.5 * MB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= 1023.5 * KB) return `${Math.round(bytes / MB)} MB`;
  if (bytes >= 1023.5) return `${Math.round(bytes / KB)} KB`;
  return `${bytes} B`;
}
