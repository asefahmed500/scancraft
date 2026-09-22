import { File, Directory, Paths } from 'expo-file-system';
import {
  deleteAllDocuments,
  deleteDocument,
  deleteDocuments,
  formatBytes,
  libraryBytes,
  listDocumentFiles,
  loadIndex,
  persistDocument,
  saveIndex,
} from '../storage';
import { makeThumb } from '../imaging';
import type { StoredDocument } from '../types';

jest.mock('expo-file-system', () => {
  const store = new Map<string, string | Uint8Array>();

  function joinUris(parts: (string | { uri: string })[]): string {
    const segs = parts.map((p) => (typeof p === 'string' ? p : p.uri));
    let out = segs[0];
    for (let i = 1; i < segs.length; i++) {
      out = out.replace(/\/+$/, '') + '/' + segs[i].replace(/^\/+/, '');
    }
    return out;
  }

  class Directory {
    uri: string;
    constructor(...uris: (string | { uri: string })[]) {
      this.uri = joinUris(uris);
    }
    get exists(): boolean {
      return store.get(this.uri) === '__dir__';
    }
    create(options?: { idempotent?: boolean }): void {
      if (store.get(this.uri) === '__dir__') {
        if (options?.idempotent) return;
        throw new Error('Directory already exists: ' + this.uri);
      }
      store.set(this.uri, '__dir__');
    }
    delete(): void {
      if (store.get(this.uri) !== '__dir__') throw new Error('Not a directory: ' + this.uri);
      for (const key of [...store.keys()]) {
        if (key === this.uri || key.startsWith(this.uri + '/')) store.delete(key);
      }
    }
    get size(): number | null {
      if (!this.exists) return null;
      let total = 0;
      for (const [key, value] of store) {
        if (key.startsWith(this.uri + '/') && value !== '__dir__') {
          total += typeof value === 'string' ? value.length : value.byteLength;
        }
      }
      return total;
    }
    list(): (Directory | File)[] {
      const prefix = this.uri + '/';
      const seen = new Set<string>();
      const nodes: (Directory | File)[] = [];
      for (const key of store.keys()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const child = rest.split('/')[0];
        const childUri = prefix + child;
        if (seen.has(childUri)) continue;
        seen.add(childUri);
        nodes.push(store.get(childUri) === '__dir__' ? new Directory(childUri) : new File(childUri));
      }
      return nodes;
    }
    async copy(destination: Directory | File): Promise<void> {
      const copyFrom = (srcPrefix: string, destPrefix: string) => {
        store.set(destPrefix, store.get(srcPrefix) ?? '__dir__');
        for (const [key, value] of store) {
          if (key.startsWith(srcPrefix + '/')) {
            store.set(destPrefix + key.slice(srcPrefix.length), value);
          }
        }
      };
      if (this.exists) {
        copyFrom(this.uri, destination.uri);
        return;
      }
      const content = store.get(this.uri);
      if (content === undefined || content === '__dir__') throw new Error('Cannot copy: ' + this.uri);
      store.set(destination.uri, content);
    }
  }

  class File {
    uri: string;
    constructor(...uris: (string | { uri: string })[]) {
      this.uri = joinUris(uris);
    }
    get exists(): boolean {
      const v = store.get(this.uri);
      return v !== undefined && v !== '__dir__';
    }
    get size(): number {
      const v = store.get(this.uri);
      if (v === undefined || v === '__dir__') return 0;
      return typeof v === 'string' ? v.length : v.byteLength;
    }
    write(content: string | Uint8Array): void {
      store.set(this.uri, content);
    }
    async text(): Promise<string> {
      const v = store.get(this.uri);
      if (typeof v !== 'string') throw new Error('Not text: ' + this.uri);
      return v;
    }
    async base64(): Promise<string> {
      return 'b64:' + this.uri;
    }
    async bytes(): Promise<Uint8Array> {
      return new TextEncoder().encode(String(store.get(this.uri) ?? ''));
    }
    delete(): void {
      if (!this.exists) throw new Error('No such file: ' + this.uri);
      store.delete(this.uri);
    }
    async copy(destination: File | Directory): Promise<void> {
      const content = store.get(this.uri);
      if (content === undefined || content === '__dir__') throw new Error('Cannot copy: ' + this.uri);
      store.set(destination.uri, content);
    }
    move(destination: Directory | File): void {
      const content = store.get(this.uri);
      if (content === undefined) throw new Error('No such file: ' + this.uri);
      const target = destination instanceof Directory ? joinUris([destination.uri, this.uri.split('/').pop() ?? '']) : destination.uri;
      store.set(target, content);
      store.delete(this.uri);
    }
  }

  const Paths = {
    get document(): Directory {
      return new Directory('file:///documents');
    },
    get cache(): Directory {
      return new Directory('file:///cache');
    },
  };

  return { File, Directory, Paths, __store: store };
});

jest.mock('../imaging', () => ({
  makeThumb: jest.fn().mockResolvedValue('file:///cache/thumb-tmp.jpg'),
  cropRotate: jest.fn(),
  downscaleIfNeeded: jest.fn(),
  applyLook: jest.fn(),
  buildPdf: jest.fn(),
  QUALITY_PRESETS: { high: {}, medium: {}, low: {} },
  EDIT_MAX_DIM: 3024,
}));

// __store is exposed by the jest mock factory (see jest.mock above).
const { __store: store } = jest.requireMock('expo-file-system') as {
  __store: Map<string, string | Uint8Array>;
};

const ROOT = new Directory(Paths.document, 'scancraft').uri;
const indexUri = new File(new Directory(ROOT), 'index.json').uri;

const docA: StoredDocument = {
  id: 'aaa',
  name: 'Doc A',
  createdAt: 1000,
  pages: [{ file: `file:///documents/scancraft/documents/aaa/page-1.jpg`, thumb: `file:///documents/scancraft/documents/aaa/thumb-1.jpg`, width: 100, height: 200 }],
};
const docB: StoredDocument = {
  id: 'bbb',
  name: 'Doc B',
  createdAt: 2000,
  pages: [],
};

function seedDirWithFiles(id: string) {
  const docDirUri = `file:///documents/scancraft/documents/${id}`;
  store.set(docDirUri, '__dir__');
  store.set(`${docDirUri}/page-1.jpg`, 'JPGDATA');
  store.set(`${docDirUri}/thumb-1.jpg`, 'THUMBDATA');
}

beforeEach(() => {
  store.clear();
  (makeThumb as jest.Mock).mockClear();
  (makeThumb as jest.Mock).mockResolvedValue('file:///cache/thumb-tmp.jpg');
});

describe('storage — index integrity', () => {
  test('loadIndex returns [] when no index exists', async () => {
    await expect(loadIndex()).resolves.toEqual([]);
  });

  test('saveIndex writes the index; loadIndex reads it back', async () => {
    await saveIndex([docA]);
    expect(store.get(indexUri)).toEqual(JSON.stringify([docA]));
    await expect(loadIndex()).resolves.toEqual([docA]);
  });

  test('saveIndex keeps a backup of the previous index', async () => {
    await saveIndex([docA]);
    await saveIndex([docB]);
    const backupUri = new File(new Directory(ROOT), 'index.json.bak').uri;
    expect(JSON.parse(store.get(backupUri) as string)).toEqual([docA]);
    await expect(loadIndex()).resolves.toEqual([docB]);
  });

  test('loadIndex falls back to the backup when the primary is corrupt', async () => {
    // A backup only exists from the second save onward (nothing to back up
    // on first write). Save A, then B — backup now holds A.
    await saveIndex([docA]);
    await saveIndex([docB]);
    store.set(indexUri, '{corrupt json!!');
    await expect(loadIndex()).resolves.toEqual([docA]);
  });

  test('loadIndex shape-validates entries and drops malformed ones', async () => {
    await saveIndex([docA]);
    store.set(
      indexUri,
      JSON.stringify([docA, { id: 42 }, { nope: true }, 'string-entry', docB]),
    );
    const docs = await loadIndex();
    expect(docs.map((d) => d.id)).toEqual(['aaa', 'bbb']);
  });
});

describe('storage — persistDocument', () => {
  test('copies pages into the doc dir, thumbs them, deletes sources, registers index', async () => {
    store.set('file:///cache/src-1.jpg', 'IMG1');
    store.set('file:///cache/src-2.jpg', 'IMG2');
    store.set('file:///cache/thumb-tmp.jpg', 'THUMB');

    const doc = await persistDocument('My Scan', [
      { uri: 'file:///cache/src-1.jpg', width: 800, height: 600 },
      { uri: 'file:///cache/src-2.jpg', width: 800, height: 600 },
    ]);

    expect(doc.name).toBe('My Scan');
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[0].file).toContain('/page-1.jpg');
    expect(doc.pages[0].thumb).toContain('/thumb-1.jpg');
    expect(store.get(doc.pages[0].file)).toBe('IMG1');
    expect(store.get(doc.pages[1].file)).toBe('IMG2');
    // sources are gone (moved into the library)
    expect(store.has('file:///cache/src-1.jpg')).toBe(false);
    expect(store.has('file:///cache/src-2.jpg')).toBe(false);
    // registered at the front of the index
    const index = await loadIndex();
    expect(index[0].id).toBe(doc.id);
    expect(makeThumb).toHaveBeenCalledTimes(2);
  });

  test('falls back to the date name when the name is blank', async () => {
    store.set('file:///cache/src-1.jpg', 'IMG1');
    store.set('file:///cache/thumb-tmp.jpg', 'THUMB');
    const doc = await persistDocument('   ', [
      { uri: 'file:///cache/src-1.jpg', width: 10, height: 10 },
    ]);
    expect(doc.name).toMatch(/^Scan /);
  });

  test('cleans up the doc dir and rethrows when a page copy fails', async () => {
    // second source does not exist → copy throws mid-loop
    store.set('file:///cache/src-1.jpg', 'IMG1');
    await expect(
      persistDocument('Broken', [
        { uri: 'file:///cache/src-1.jpg', width: 10, height: 10 },
        { uri: 'file:///cache/src-missing.jpg', width: 10, height: 10 },
      ]),
    ).rejects.toThrow();
    // no orphaned document directory left behind
    const dirs = [...store.keys()].filter((k) => /documents\/scancraft\/documents\/.+/.test(k));
    expect(dirs).toEqual([]);
    // and nothing was registered
    await expect(loadIndex()).resolves.toEqual([]);
  });
});

describe('storage — deletion', () => {
  beforeEach(async () => {
    await saveIndex([docA, docB]);
    seedDirWithFiles('aaa');
    seedDirWithFiles('bbb');
  });

  test('deleteDocuments removes ids, dirs, and rewrites the index once', async () => {
    const { deleted, failed } = await deleteDocuments(['aaa']);
    expect(deleted).toBe(1);
    expect(failed).toBe(0);
    const index = await loadIndex();
    expect(index.map((d) => d.id)).toEqual(['bbb']);
    expect(store.has('file:///documents/scancraft/documents/aaa/page-1.jpg')).toBe(false);
    expect(store.has('file:///documents/scancraft/documents/bbb/page-1.jpg')).toBe(true);
  });

  test('deleteDocument delegates to the batch path', async () => {
    await deleteDocument('bbb');
    const index = await loadIndex();
    expect(index.map((d) => d.id)).toEqual(['aaa']);
  });

  test('deleteDocuments with unknown ids still succeeds', async () => {
    const { deleted, failed } = await deleteDocuments(['zzz']);
    expect(deleted).toBe(1);
    expect(failed).toBe(0);
    await expect(loadIndex()).resolves.toEqual([docA, docB]);
  });

  test('deleteAllDocuments wipes the library and the index', async () => {
    await deleteAllDocuments();
    await expect(loadIndex()).resolves.toEqual([]);
    expect(libraryBytes()).toBe(0);
  });
});

describe('storage — inventory', () => {
  test('listDocumentFiles reports every file with sizes', async () => {
    await saveIndex([docA]);
    seedDirWithFiles('aaa');
    const inventory = await listDocumentFiles();
    expect(inventory).toHaveLength(1);
    expect(inventory[0].id).toBe('aaa');
    expect(inventory[0].bytes).toBe('JPGDATA'.length + 'THUMBDATA'.length);
    expect(inventory[0].files.map((f) => f.name)).toEqual(['page-1.jpg', 'thumb-1.jpg']);
  });
});

describe('storage — formatting', () => {
  test('formatBytes boundaries', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});
