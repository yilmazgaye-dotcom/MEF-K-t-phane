// Hazır yanıt motoru: OpenAI anahtarı yokken (ya da ASSISTANT_MODE=rules iken) çalışır.
// knowledge/yanitlar/*.md dosyalarındaki Türkçe/İngilizce hazır yanıtları anahtar kelimelerle
// eşleştirir. Yanıt uydurmaz: eşleşme yoksa kullanıcıyı kütüphaneye yönlendirir.
// Saf fonksiyonlardır (dosya okuma lib/knowledge.js içindedir); tarayıcıda da çalışabilir.

const ASK_LIBRARIAN = 'https://form.jotform.com/241372416279964';

// Türkçe karakterleri sadeleştirir: "Çalışma Saatleri" -> "calisma saatleri"
export function normalize(text) {
  return String(text ?? '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compileKeyword(keyword) {
  const value = normalize(keyword);
  if (!value) return null;
  if (value.includes(' ')) return { type: 'phrase', value, weight: 2 };
  return { type: value.length <= 3 ? 'exact' : 'prefix', value, weight: 1 };
}

function parseSource(value) {
  const parts = value.split('|').map((s) => s.trim());
  return parts.length > 1 ? { label: parts[0], url: parts[1] } : { label: null, url: parts[0] };
}

// Dosya biçimi için knowledge/yanitlar/_README.md dosyasına bakın.
export function parseAnswerFile(text, file = '') {
  const src = String(text)
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '');
  const entries = [];
  for (const block of src.split(/^## +/m).slice(1)) {
    const nl = block.indexOf('\n');
    const id = (nl === -1 ? block : block.slice(0, nl)).trim();
    const sections = (nl === -1 ? '' : block.slice(nl + 1)).split(/^### +/m);
    const head = sections.shift();
    const entry = { id, file, keywords: [], source: null, sourceEn: null, tr: '', en: '' };
    for (const line of head.split('\n')) {
      const m = line.match(/^\s*(anahtar|keywords|kaynak|source)\s*:\s*(.+)$/i);
      if (!m) continue;
      const key = m[1].toLowerCase();
      if (key === 'anahtar' || key === 'keywords') {
        entry.keywords.push(...m[2].split(',').map((s) => s.trim()).filter(Boolean));
      } else if (key === 'kaynak') {
        entry.source = parseSource(m[2]);
      } else {
        entry.sourceEn = parseSource(m[2]);
      }
    }
    for (const section of sections) {
      const lnl = section.indexOf('\n');
      const lang = (lnl === -1 ? section : section.slice(0, lnl)).trim().toLowerCase();
      if (lang === 'tr' || lang === 'en') entry[lang] = (lnl === -1 ? '' : section.slice(lnl + 1)).trim();
    }
    entry.matchers = entry.keywords.map(compileKeyword).filter(Boolean);
    entries.push(entry);
  }
  return entries;
}

export function validateAnswers(entries) {
  const errors = [];
  const seen = new Set();
  for (const e of entries) {
    const where = `${e.file}: "${e.id}"`;
    if (!e.id) errors.push(`${e.file}: başlıksız yanıt`);
    if (seen.has(e.id)) errors.push(`${where} birden fazla kez tanımlanmış`);
    seen.add(e.id);
    if (!e.matchers.length) errors.push(`${where} için 'anahtar:' satırı yok`);
    if (!e.tr) errors.push(`${where} için '### TR' yanıtı yok`);
    if (!e.en) errors.push(`${where} için '### EN' yanıtı yok`);
    for (const s of [e.source, e.sourceEn]) {
      if (s && !/^https?:\/\/\S+$/.test(s.url)) errors.push(`${where} kaynak adresi geçersiz: ${s.url}`);
    }
  }
  return errors;
}

function scoreEntry(entry, padded, tokens) {
  let score = 0;
  const hits = [];
  for (const m of entry.matchers) {
    let hit;
    if (m.type === 'phrase') hit = padded.includes(` ${m.value}`);
    else if (m.type === 'exact') hit = tokens.includes(m.value);
    else hit = tokens.some((t) => t.startsWith(m.value));
    if (hit) {
      score += m.weight;
      hits.push(m.value);
    }
  }
  return { score, hits };
}

export function findBestAnswer(entries, text) {
  const norm = normalize(text);
  const tokens = norm.split(' ').filter(Boolean);
  const padded = ` ${norm} `;
  let best = null;
  for (const entry of entries) {
    const { score, hits } = scoreEntry(entry, padded, tokens);
    if (score > 0 && (!best || score > best.score)) best = { entry, score, hits };
  }
  return best;
}

const TR_WORDS = new Set([
  'ne', 'nedir', 'nasil', 'nerede', 'neden', 'kac', 'hangi', 'mi', 'mu', 'var', 'yok', 'icin', 'ile', 've',
  'bir', 'kutuphane', 'kutuphanede', 'kitap', 'merhaba', 'saat', 'odunc', 'miyim', 'misiniz', 'musunuz', 'istiyorum',
]);
const EN_WORDS = new Set([
  'what', 'how', 'where', 'when', 'why', 'which', 'can', 'could', 'do', 'does', 'is', 'are', 'the', 'a', 'an',
  'library', 'book', 'books', 'hours', 'open', 'borrow', 'hello', 'hi', 'thanks', 'thank', 'please', 'i', 'my', 'you',
]);

export function detectLang(text, fallback = 'tr') {
  const raw = String(text ?? '');
  let tr = /[çğıöşüÇĞİÖŞÜ]/.test(raw) ? 2 : 0;
  let en = 0;
  for (const t of normalize(raw).split(' ')) {
    if (TR_WORDS.has(t)) tr += 1;
    if (EN_WORDS.has(t)) en += 1;
  }
  if (tr > en) return 'tr';
  if (en > tr) return 'en';
  return fallback === 'en' ? 'en' : 'tr';
}

const SEARCH_TRIGGERS = [
  'ariyorum', 'ariyoruz', 'araniyor', 'aramak istiyorum', 'arastiriyorum', 'bulmak istiyorum', 'bulabilir miyim',
  'var mi', 'var midir', 'mevcut mu', 'oner', 'tavsiye', 'looking for', 'searching for', 'search for', 'do you have',
  'is there', 'recommend', 'suggest',
];
const STOP_PREFIXES = [
  'kitap', 'kitab', 'makale', 'kaynak', 'ariyor', 'arama', 'aramak', 'arastiriyor', 'bulabil', 'bulmak', 'bulur',
  'hakkind', 'ilgili', 'konusunda', 'konulu', 'uzerine', 'lutfen', 'istiyor', 'kutuphane', 'katalog', 'mevcut',
  'oner', 'tavsiye', 'recommend', 'suggest',
];
const STOP_WORDS = new Set([
  'bir', 'bu', 'su', 'ile', 'icin', 'var', 'yok', 'mi', 'mu', 'midir', 'mudur', 'miyim', 'misin', 'misiniz',
  'musunuz', 'acaba', 'ne', 'nasil', 'hangi', 'nerede', 'ben', 'bana', 'sizde', 'sizin', 'konu', 'konuda', 'de', 'da',
  'looking', 'searching', 'search', 'for', 'a', 'an', 'the', 'book', 'books', 'article', 'articles', 'paper',
  'papers', 'about', 'on', 'find', 'do', 'you', 'have', 'any', 'please', 'i', 'im', 'am', 'source', 'sources', 'is',
  'there', 'library', 'me', 'can', 'could', 'help', 'with', 'need', 'some',
]);

function isStopToken(token) {
  const n = normalize(token).split(' ')[0];
  if (!n) return true;
  return STOP_WORDS.has(n) || STOP_PREFIXES.some((p) => n.startsWith(p));
}

export function detectSearch(text) {
  const padded = ` ${normalize(text)} `;
  const isSearch = SEARCH_TRIGGERS.some((t) => padded.includes(` ${t} `) || padded.includes(` ${t}`));
  if (!isSearch) return { isSearch: false, query: '' };
  const kept = String(text)
    .split(/[\s,.;:!?()[\]{}"“”«»]+/)
    .filter(Boolean)
    .filter((tok) => !isStopToken(tok));
  return { isSearch: true, query: kept.join(' ').slice(0, 100).trim() };
}

function isCoveredBy(query, best) {
  if (!best) return false;
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length) return true;
  const parts = best.hits.flatMap((h) => h.split(' '));
  return tokens.every((t) => parts.some((p) => t.startsWith(p)));
}

const TEXT = {
  tr: {
    source: 'Kaynak',
    defaultSource: 'Kütüphane web sitesi',
    search: (q) =>
      `Bu konuda MEF kütüphane kaynaklarında arama yapabilirsiniz. Aşağıdaki bağlantılar aramanızı doğrudan başlatır; bir kaynağın kütüphanede olup olmadığını ve rafta durumunu katalog kaydında görebilirsiniz.\n\n[[ARA: ${q}]]`,
    doiOk:
      'APA 7 kaynakçanız yukarıdaki kartta hazır; **Kopyala** düğmesiyle italikler korunarak kopyalayabilirsiniz. Göndermeden önce başlığın cümle düzeninde yazıldığını kontrol edin.',
    doiNotFound:
      'Bu DOI Crossref\'te bulunamadı. DOI numarasını kontrol edin ya da yazar, yıl, başlık ve yayın bilgilerini yazın; APA 7 kalıbını göstereyim.',
    doiError: 'Crossref\'e şu anda ulaşılamadı. Lütfen biraz sonra tekrar deneyin.',
    fallback:
      `Bu soruya hazır bir yanıtım yok. Şu konularda yardımcı olabilirim: çalışma saatleri, üyelik, ödünç verme ve süre uzatma, veri tabanları, kampüs dışı erişim, grup çalışma odaları, kaynak arama ve APA kaynakça.\n\nSorunuzu bir kütüphaneciye iletmek için [Kütüphaneciye Sor](${ASK_LIBRARIAN}) formunu kullanabilir, library@mef.edu.tr adresine yazabilir ya da 0 212 395 3762 numarasını arayabilirsiniz.`,
  },
  en: {
    source: 'Source',
    defaultSource: 'MEF Library website',
    search: (q) =>
      `You can search MEF Library resources for this topic. The links below start the search directly; the catalogue record shows whether the library holds an item and whether it is on the shelf.\n\n[[SEARCH: ${q}]]`,
    doiOk:
      'Your APA 7 reference is ready in the card above; use **Copy** to keep the italics. Before submitting, check that the title uses sentence case.',
    doiNotFound:
      'This DOI was not found in Crossref. Please check the DOI, or write the author, year, title and publication details and I will show you the APA 7 pattern.',
    doiError: 'Crossref could not be reached right now. Please try again shortly.',
    fallback:
      `I do not have a prepared answer for this question. I can help with opening hours, membership, borrowing and renewals, databases, off-campus access, group study rooms, finding sources and APA references.\n\nTo ask a librarian, use the [Ask a Librarian](${ASK_LIBRARIAN}) form, email library@mef.edu.tr or call +90 212 395 3762.`,
  },
};

function entryAnswer(entry, lang) {
  const t = TEXT[lang];
  const body = entry[lang] || entry.tr || entry.en;
  const source = lang === 'en' ? entry.sourceEn || entry.source : entry.source;
  if (!source) return body;
  const label = lang === 'en' && !entry.sourceEn ? t.defaultSource : source.label || t.defaultSource;
  return `${body}\n\n${t.source}: [${label}](${source.url})`;
}

// Kullanıcının son mesajına hazır yanıt üretir.
// citation: api/chat.js içindeki DOI sonucu ({ status: 'ok' | 'not_found' | 'error' }) ya da null.
export function answerQuestion({ entries, text, uiLang = 'tr', citation = null }) {
  const lang = detectLang(text, uiLang);
  const t = TEXT[lang];

  if (citation) {
    const key = citation.status === 'ok' ? 'doiOk' : citation.status === 'not_found' ? 'doiNotFound' : 'doiError';
    return { lang, kind: 'doi', id: null, text: t[key] };
  }

  const best = findBestAnswer(entries, text);
  const search = detectSearch(text);

  if (search.isSearch && search.query && !isCoveredBy(search.query, best)) {
    return { lang, kind: 'search', id: null, text: t.search(search.query.replace(/[[\]]/g, '')) };
  }
  if (best) return { lang, kind: 'answer', id: best.entry.id, text: entryAnswer(best.entry, lang) };

  const catalog = entries.find((e) => e.id === 'katalog');
  if (search.isSearch && catalog) return { lang, kind: 'answer', id: 'katalog', text: entryAnswer(catalog, lang) };

  return { lang, kind: 'fallback', id: null, text: t.fallback };
}
