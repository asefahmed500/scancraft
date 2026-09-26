import { File, Directory, Paths } from 'expo-file-system';
import { makeThumb } from './imaging';
import { DEFAULT_SETTINGS, type AppSettings, type StoredDocument } from './types';

const rootDir = new Directory(Paths.document, 'scancraft');
const documentsDir = new Directory(rootDir, 'documents');
const indexFile = new File(rootDir, 'index.json');
const tmpFile = new File(rootDir, 'index.json.tmp');
const backupFile = new File(rootDir, 'index.json.bak');
const settingsFile = new File(rootDir, 'settings.json');
const cacheDir = new Directory(Paths.cache, 'scancraft');

export function ensureDirs(): void {
  try {
    rootDir.create({ idempotent: true });
    documentsDir.create({ idempotent: true });
  } catch {
    // ignore — creation is best-effort here; write paths surface real errors
  }
}

export function ensureCacheDir(): void {
  try {
    cacheDir.create({ idempotent: true });
  } catch {
    // ignore
  }
}

export function cacheDirUri(): string {
  return cacheDir.uri;
}

export async function loadIndex(): Promise<StoredDocument[]> {
  const read = async (file: File): Promise<StoredDocument[] | null> => {
    try {
      if (!file.exists) return null;
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) return null;
      // Shape-check entries so malformed data can't crash consumers.
      return parsed.filter(
        (d): d is StoredDocument =>
          d && typeof d.id === 'string' && typeof d.name === 'string' && Array.isArray(d.pages),
      );
    } catch {
      return null;
    }
  };

  const primary = await read(indexFile);
  if (primary) return primary;
  // Corrupt primary (e.g. crash mid-write) — fall back to the backup copy.
  const backup = await read(backupFile);
  return backup ?? [];
}

// Documents still visible in the library (recycle bin excluded).
export async function loadActiveIndex(): Promise<StoredDocument[]> {
  const docs = await loadIndex();
  return docs.filter((d) => !d.deleted);
}

export async function saveIndex(docs: StoredDocument[]): Promise<void> {
  ensureDirs();
  // Atomic-ish write: stage to a temp file, keep the previous index as a
  // backup, then swap — a crash mid-write can no longer destroy the library.
  try {
    tmpFile.write(JSON.stringify(docs));
  } catch (error) {
    throw error;
  }
  try {
    if (indexFile.exists) {
      if (backupFile.exists) backupFile.delete();
      await indexFile.copy(backupFile);
    }
  } catch {
    // backup is best-effort
  }
  try {
    if (indexFile.exists) indexFile.delete();
  } catch {
    // ignore
  }
  try {
    tmpFile.move(indexFile);
  } catch {
    try {
      await tmpFile.copy(indexFile);
    } catch (error) {
      throw error;
    }
  }
  try {
    if (tmpFile.exists) tmpFile.delete();
  } catch {
    // ignore
  }
}

export function documentDir(id: string): Directory {
  return new Directory(documentsDir, id);
}

export function newDocumentId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export type PersistPageInput = { uri: string; width: number; height: number };

export async function persistDocument(
  name: string,
  pages: PersistPageInput[],
): Promise<StoredDocument> {
  ensureDirs();
  const id = newDocumentId();
  const dir = documentDir(id);
  dir.create({ idempotent: true });

  const storedPages = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const dest = new File(dir, `page-${i + 1}.jpg`);
    const src = new File(page.uri);
    if (src.uri === dest.uri) {
      storedPages.push({ file: dest.uri, thumb: '', width: page.width, height: page.height });
      continue;
    }
    try {
      await src.copy(dest);
      if (src.exists) src.delete();
    } catch (error) {
      // Don't leave an orphaned half-written document directory behind.
      try {
        if (dir.exists) dir.delete();
      } catch {
        // ignore
      }
      throw error;
    }
    // Thumbnails live next to the document — the OS may purge generic cache.
    let thumbUri = '';
    try {
      const thumbTmp = await makeThumb(dest.uri);
      const thumbDest = new File(dir, `thumb-${i + 1}.jpg`);
      await new File(thumbTmp).copy(thumbDest);
      safeDeleteCacheFile(thumbTmp);
      thumbUri = thumbDest.uri;
    } catch {
      thumbUri = dest.uri; // fall back to the full page as cover
    }
    storedPages.push({
      file: dest.uri,
      thumb: thumbUri,
      width: page.width,
      height: page.height,
    });
  }

  const doc: StoredDocument = {
    id,
    name: name.trim() || `Scan ${new Date().toLocaleDateString()}`,
    createdAt: Date.now(),
    pages: storedPages,
  };

  const index = await loadIndex();
  await saveIndex([doc, ...index]);

  return doc;
}

export function safeDeleteCacheFile(uri: string): void {
  try {
    // Only ever delete files we created — inside our cache subdir or the
    // generic OS cache used by camera/ImageManipulator temp outputs.
    if (!uri.startsWith(cacheDir.uri) && !uri.startsWith(Paths.cache.uri)) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ignore — cache cleanup is best-effort
  }
}

export async function deleteDocument(id: string): Promise<{ deleted: number; failed: number }> {
  return deleteDocuments([id]);
}

// Soft delete: the document moves to the recycle bin (files stay on disk).
export async function softDeleteDocuments(ids: string[]): Promise<void> {
  const docs = await loadIndex();
  const now = Date.now();
  const next = docs.map((d) =>
    ids.includes(d.id) ? { ...d, deleted: true, deletedAt: now } : d,
  );
  await saveIndex(next);
}

export async function restoreDocument(id: string): Promise<void> {
  const docs = await loadIndex();
  const next = docs.map((d) =>
    d.id === id ? { ...d, deleted: false, deletedAt: undefined } : d,
  );
  await saveIndex(next);
}

// Permanently deletes (files + index entry). Batch: one index rewrite.
export async function deleteDocuments(
  ids: string[],
): Promise<{ deleted: number; failed: number }> {
  const docs = await loadIndex();
  const next = docs.filter((d) => !ids.includes(d.id));
  let failed = 0;
  for (const id of ids) {
    try {
      const dir = documentDir(id);
      if (dir.exists) dir.delete();
    } catch {
      failed += 1;
    }
  }
  // One index rewrite for the whole batch instead of N.
  await saveIndex(next);
  return { deleted: ids.length - failed, failed };
}

export async function purgeAllDeleted(): Promise<number> {
  const docs = await loadIndex();
  const trashIds = docs.filter((d) => d.deleted).map((d) => d.id);
  if (trashIds.length > 0) {
    await deleteDocuments(trashIds);
  }
  return trashIds.length;
}

export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  const docs = await loadIndex();
  const next = docs.map((d) => (d.id === id ? { ...d, favorite } : d));
  await saveIndex(next);
}

export async function deleteAllDocuments(): Promise<void> {
  let dirDeleted = false;
  try {
    if (documentsDir.exists) {
      documentsDir.delete();
      dirDeleted = true;
    } else {
      dirDeleted = true;
    }
  } catch {
    // keep the index if files could not be removed — never orphan the library
  }
  if (dirDeleted) {
    try {
      if (indexFile.exists) indexFile.delete();
    } catch {
      // ignore
    }
    try {
      if (backupFile.exists) backupFile.delete();
    } catch {
      // ignore
    }
  }
  ensureDirs();
}

export function libraryBytes(): number {
  try {
    return documentsDir.exists ? documentsDir.size ?? 0 : 0;
  } catch {
    return 0;
  }
}

export function cacheBytes(): number {
  try {
    return cacheDir.exists ? cacheDir.size ?? 0 : 0;
  } catch {
    return 0;
  }
}

export function clearCache(): void {
  try {
    if (cacheDir.exists) cacheDir.delete();
  } catch {
    // ignore
  }
  ensureCacheDir();
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    if (!settingsFile.exists) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(await settingsFile.text());
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  ensureDirs();
  settingsFile.write(JSON.stringify(settings));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type StoredFileEntry = { uri: string; name: string; bytes: number };

export type StoredDocFiles = {
  id: string;
  name: string;
  createdAt: number;
  bytes: number;
  files: StoredFileEntry[];
};

// Full on-device inventory for the in-app storage browser: every document
// directory with its actual files and sizes, straight from disk.
export async function listDocumentFiles(): Promise<StoredDocFiles[]> {
  const docs = await loadIndex();
  const out: StoredDocFiles[] = [];
  for (const doc of docs) {
    const dir = documentDir(doc.id);
    const files: StoredFileEntry[] = [];
    let bytes = 0;
    if (dir.exists) {
      for (const node of dir.list()) {
        if (node instanceof File) {
          const name = node.uri.split('/').pop() ?? node.uri;
          files.push({ uri: node.uri, name, bytes: node.size });
          bytes += node.size;
        }
      }
    }
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    out.push({ id: doc.id, name: doc.name, createdAt: doc.createdAt, bytes, files });
  }
  return out;
}
