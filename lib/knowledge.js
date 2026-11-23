// knowledge/ klasöründeki bilgi dosyalarını okur (yalnızca sunucuda).
// "_" ile başlayan dosyalar (ör. _README.md) asistana gönderilmez.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKnowledgeFile, sortDocs } from './knowledge-parse.js';

const CANDIDATE_DIRS = [
  path.join(process.cwd(), 'knowledge'),
  fileURLToPath(new URL('../knowledge/', import.meta.url)),
];

let cache = null;

async function findKnowledgeDir() {
  for (const dir of CANDIDATE_DIRS) {
    try {
      await readdir(dir);
      return dir;
    } catch {
      // sonraki adayı dene
    }
  }
  throw new Error('knowledge klasörü bulunamadı');
}

export async function loadKnowledge({ dir, useCache = true } = {}) {
  if (!dir && useCache && cache) return cache;
  const base = dir || (await findKnowledgeDir());
  const files = (await readdir(base)).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  const docs = await Promise.all(
    files.map(async (f) => parseKnowledgeFile(await readFile(path.join(base, f), 'utf8'), f)),
  );
  const sorted = sortDocs(docs);
  if (!dir) cache = sorted;
  return sorted;
}
