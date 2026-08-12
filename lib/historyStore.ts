import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ContactFields } from './schema';

// Local-only scan library: an index.json plus one copied photo (and a small
// list thumbnail) per scan, all under Documents/scans. Nothing here ever
// leaves the device.

export interface ScanRecord {
  id: string;
  createdAt: string; // ISO timestamp
  fields: ContactFields;
  rawText: string;
  /** Photo filename within the scans directory (portable across reinstall paths). */
  photo: string | null;
  /** Small JPEG for list rows — full-res photos decode to ~50 MB each. */
  thumb?: string | null;
  savedToContacts: boolean;
}

// Change events so mounted screens (History under a pushed Detail) can refresh
// after writes without polling.
const listeners = new Set<() => void>();

export function onHistoryChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const scansDir = () => new Directory(Paths.document, 'scans');
const indexFile = () => new File(scansDir(), 'index.json');

function ensureDir() {
  const dir = scansDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

function readAll(): ScanRecord[] {
  try {
    const f = indexFile();
    if (!f.exists) return [];
    const parsed = JSON.parse(f.textSync());
    return Array.isArray(parsed) ? (parsed as ScanRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: ScanRecord[]) {
  ensureDir();
  indexFile().write(JSON.stringify(records));
  listeners.forEach((cb) => cb());
}

/** Newest first. */
export function loadHistory(): ScanRecord[] {
  return readAll().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function photoUriFor(record: ScanRecord): string | null {
  return record.photo ? new File(scansDir(), record.photo).uri : null;
}

/** List-row image: the small thumbnail when present, else the full photo. */
export function thumbUriFor(record: ScanRecord): string | null {
  if (record.thumb) return new File(scansDir(), record.thumb).uri;
  return photoUriFor(record);
}

// Generated off the write path: addScan stays synchronous, the thumbnail
// lands in the record moments later (subscribers re-render via the event).
async function generateThumb(id: string, photoName: string): Promise<void> {
  try {
    const source = new File(scansDir(), photoName).uri;
    const image = await ImageManipulator.manipulate(source).resize({ width: 320 }).renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.6 });
    try {
      // The scan may have been deleted while this was rendering; writing the
      // thumb then would leave a file no delete path knows about.
      const records = readAll();
      if (records.some((r) => r.id === id)) {
        const thumbName = `${id}.thumb.jpg`;
        new File(saved.uri).copy(new File(scansDir(), thumbName));
        writeAll(records.map((r) => (r.id === id ? { ...r, thumb: thumbName } : r)));
      }
    } finally {
      try {
        new File(saved.uri).delete();
      } catch {
        // cache-file cleanup is best-effort
      }
    }
  } catch (e) {
    console.warn('thumbnail generation failed', e);
  }
}

export function addScan(input: {
  fields: ContactFields;
  rawText: string;
  sourcePhotoUri: string | null;
}): ScanRecord {
  ensureDir();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let photo: string | null = null;
  if (input.sourcePhotoUri) {
    try {
      const ext = input.sourcePhotoUri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const name = `${id}.${ext.length <= 4 ? ext : 'jpg'}`;
      new File(input.sourcePhotoUri).copy(new File(scansDir(), name));
      photo = name;
    } catch (e) {
      console.warn('scan photo copy failed', e);
    }
  }
  const record: ScanRecord = {
    id,
    createdAt: new Date().toISOString(),
    fields: input.fields,
    rawText: input.rawText,
    photo,
    thumb: null,
    savedToContacts: false,
  };
  writeAll([record, ...readAll()]);
  if (photo) void generateThumb(id, photo);
  return record;
}

export function updateScan(id: string, patch: Partial<Pick<ScanRecord, 'fields' | 'rawText' | 'savedToContacts'>>): void {
  writeAll(readAll().map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

export function deleteScan(id: string): void {
  const records = readAll();
  const target = records.find((r) => r.id === id);
  for (const name of [target?.photo, target?.thumb]) {
    if (!name) continue;
    try {
      const file = new File(scansDir(), name);
      if (file.exists) file.delete();
    } catch (e) {
      console.warn('scan file delete failed', e);
    }
  }
  writeAll(records.filter((r) => r.id !== id));
}

/** Total bytes used by the scan library (index + photos). */
export function historySizeBytes(): number {
  try {
    const dir = scansDir();
    return dir.exists ? (dir.size ?? 0) : 0;
  } catch {
    return 0;
  }
}
