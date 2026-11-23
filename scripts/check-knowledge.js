// Bilgi tabanı denetimi: npm run check:knowledge
// Zorunlu alanları, tarih biçimini, adresleri ve yinelenen kimlikleri kontrol eder;
// "DOĞRULANACAK" notu taşıyan ve uzun süredir kontrol edilmemiş dosyaları listeler.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { knowledgeToPrompt, parseKnowledgeFile, validateKnowledgeDoc } from '../lib/knowledge-parse.js';

const dir = fileURLToPath(new URL('../knowledge/', import.meta.url));
const files = (await readdir(dir)).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort();

const errors = [];
const warnings = [];
const ids = new Map();
const docs = [];

for (const file of files) {
  const raw = await readFile(path.join(dir, file), 'utf8');
  const doc = parseKnowledgeFile(raw, file);
  docs.push(doc);
  const result = validateKnowledgeDoc(doc);
  errors.push(...result.errors);
  warnings.push(...result.warnings);
  if (doc.meta.id) {
    if (ids.has(doc.meta.id)) errors.push(`${file}: '${doc.meta.id}' kimliği ${ids.get(doc.meta.id)} dosyasında da var`);
    else ids.set(doc.meta.id, file);
  }
  if (raw.includes('DOĞRULANACAK')) warnings.push(`${file}: kütüphane ekibinin doğrulaması gereken bilgi içeriyor (DOĞRULANACAK)`);
}

const approxTokens = Math.round(knowledgeToPrompt(docs).length / 4);
console.log(`${files.length} bilgi dosyası, yaklaşık ${approxTokens.toLocaleString('tr-TR')} token.`);
for (const w of warnings) console.warn(`UYARI: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`HATA: ${e}`);
  process.exit(1);
}
console.log('Bilgi tabanı geçerli.');
