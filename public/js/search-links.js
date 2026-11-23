// Asistan, kullanıcı bir kaynak aramak istediğinde yanıtının sonuna [[ARA: terimler]] işareti koyar.
// Bu modül işareti metinden çıkarır ve MEF arama araçlarına giden bağlantıları kodla üretir;
// böylece bağlantılar her zaman doğru biçimde olur ve model URL uydurmaz.
// Adresler library.mef.edu.tr ana sayfasındaki arama kutusunun yapılandırmasından alınmıştır.

const MARKER_SOURCE = String.raw`\s*\[\[\s*(?:ARA|SEARCH)\s*:\s*([^\]\n]{1,200}?)\s*\]\]`;

export function extractSearchMarker(text) {
  const source = String(text ?? '');
  const match = source.match(new RegExp(MARKER_SOURCE, 'i'));
  const query = match ? match[1].trim() : '';
  const clean = source.replace(new RegExp(MARKER_SOURCE, 'gi'), '').trimEnd();
  return { clean, query: query || null };
}

// Akış sırasında henüz tamamlanmamış "[[ARA: ..." parçasını gizler.
export function stripPartialMarker(text) {
  const withoutComplete = String(text ?? '').replace(new RegExp(MARKER_SOURCE, 'gi'), '');
  const idx = withoutComplete.lastIndexOf('[[');
  if (idx !== -1 && !withoutComplete.slice(idx).includes(']]')) {
    return withoutComplete.slice(0, idx).trimEnd();
  }
  return withoutComplete.endsWith('[') ? withoutComplete.slice(0, -1) : withoutComplete;
}

const enc = encodeURIComponent;

export const SEARCH_TARGETS = [
  {
    id: 'eds',
    label: { tr: 'All in MEF – tüm kütüphane kaynakları', en: 'All in MEF – all library resources' },
    description: {
      tr: 'Kitap, e-kitap, makale ve veri tabanlarında birlikte arama (EBSCO)',
      en: 'Search books, e-books, articles and databases at once (EBSCO)',
    },
    url: (q) => `https://discovery.ebsco.com/c/657sr5/results?q=${enc(q)}`,
  },
  {
    id: 'catalog',
    label: { tr: 'Kütüphane kataloğu – basılı kitaplar', en: 'Library catalogue – printed books' },
    description: {
      tr: 'Rafta olup olmadığını ve yer numarasını görün',
      en: 'Check availability and call numbers',
    },
    url: (q) => `https://libcatalog.mef.edu.tr/vufind/Search/Results?lookfor=${enc(q)}&type=AllFields`,
  },
  {
    id: 'advanced',
    label: { tr: 'Gelişmiş arama (EBSCO)', en: 'Advanced search (EBSCO)' },
    description: {
      tr: 'Yazar, başlık, konu ve tarih filtreleriyle arama',
      en: 'Filter by author, title, subject and date',
    },
    url: () => 'https://research.ebsco.com/c/657sr5/search/advanced/search-options',
  },
];

export function buildSearchLinks(query, lang = 'tr') {
  const q = String(query ?? '').trim();
  if (!q) return [];
  const key = lang === 'en' ? 'en' : 'tr';
  return SEARCH_TARGETS.map((t) => ({
    id: t.id,
    label: t.label[key],
    description: t.description[key],
    url: t.url(q),
  }));
}
