// Bilgi tabanı dosyalarını (knowledge/*.md) ayrıştırma ve doğrulama. Saf fonksiyonlar.
//
// Dosya biçimi:
// ---
// id: saatler
// title: Çalışma saatleri
// order: 2
// source: https://...            (birden fazla adres boşlukla ayrılabilir)
// source_en: https://...         (isteğe bağlı: İngilizce sayfa)
// updated: 2026-11-23            (bilginin son kontrol tarihi)
// ---
// Markdown içerik. <!-- HTML yorumları asistana gönderilmez; editör notları için kullanın. -->

export const REQUIRED_FIELDS = ['id', 'title', 'source', 'updated'];

export function splitSources(value) {
  return String(value || '')
    .split(/[\s,]+/)
    .filter(Boolean);
}

export function parseKnowledgeFile(text, file = '') {
  const normalized = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = {};
  let body = normalized;
  if (match) {
    for (const line of match[1].split('\n')) {
      const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
      if (kv) meta[kv[1]] = kv[2].trim().replace(/^(["'])(.*)\1$/, '$2');
    }
    body = match[2];
  }
  body = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { file, meta, body };
}

export function validateKnowledgeDoc(doc, { today = new Date(), staleDays = 180 } = {}) {
  const errors = [];
  const warnings = [];
  for (const field of REQUIRED_FIELDS) {
    if (!doc.meta[field]) errors.push(`${doc.file}: '${field}' alanı eksik`);
  }
  const updated = doc.meta.updated;
  if (updated) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(updated) || Number.isNaN(Date.parse(`${updated}T00:00:00Z`))) {
      errors.push(`${doc.file}: 'updated' alanı YYYY-AA-GG biçiminde olmalı`);
    } else {
      const ageDays = (today.getTime() - Date.parse(`${updated}T00:00:00Z`)) / 86400000;
      if (ageDays > staleDays) {
        warnings.push(`${doc.file}: ${Math.floor(ageDays)} gündür kontrol edilmemiş`);
      }
    }
  }
  for (const key of ['source', 'source_en']) {
    for (const url of splitSources(doc.meta[key])) {
      if (!/^https?:\/\/\S+$/.test(url)) errors.push(`${doc.file}: geçersiz adres (${key}): ${url}`);
    }
  }
  if (!doc.body) errors.push(`${doc.file}: içerik boş`);
  return { errors, warnings };
}

export function sortDocs(docs) {
  return [...docs].sort(
    (a, b) =>
      Number(a.meta.order ?? 999) - Number(b.meta.order ?? 999) || a.file.localeCompare(b.file),
  );
}

export function knowledgeToPrompt(docs) {
  return sortDocs(docs)
    .map((d) => {
      const lines = [`### [${d.meta.id}] ${d.meta.title}`, `Kaynak: ${splitSources(d.meta.source).join(' , ')}`];
      const en = splitSources(d.meta.source_en);
      if (en.length) lines.push(`İngilizce sayfa: ${en.join(' , ')}`);
      lines.push(`Son kontrol: ${d.meta.updated}`, '', d.body);
      return lines.join('\n');
    })
    .join('\n\n---\n\n');
}
