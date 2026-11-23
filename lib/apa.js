// Crossref meta verisinden APA 7 kaynakça üretir. Saf fonksiyonlar; ağ erişimi yoktur.
// Çıktı "segments" dizisidir: [{ t: 'metin', i: italik_mi }]. Arayüz bunu güvenli biçimde
// DOM'a dönüştürür; kopyalama için düz metin (text) ve Markdown da verilir.

const EN_DASH = '–';

const KIND_BY_TYPE = {
  'journal-article': 'article',
  book: 'book',
  monograph: 'book',
  'edited-book': 'book',
  'reference-book': 'book',
  'book-set': 'book',
  'book-chapter': 'chapter',
  'book-section': 'chapter',
  'book-part': 'chapter',
  'reference-entry': 'chapter',
  'proceedings-article': 'chapter',
  'posted-content': 'preprint',
  dissertation: 'thesis',
  dataset: 'dataset',
  report: 'report',
  'report-component': 'report',
  standard: 'report',
};

export function stripMarkup(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function initials(given) {
  const clean = stripMarkup(given);
  if (!clean) return '';
  return clean
    .split(/\s+/)
    .map((word) => {
      if (/^(\p{L}\.)+$/u.test(word)) {
        return word.match(/\p{L}/gu).map((c) => `${c.toUpperCase()}.`).join(' ');
      }
      return word
        .split('-')
        .filter(Boolean)
        .map((part) => {
          const letter = part.match(/\p{L}/u);
          return letter ? `${letter[0].toUpperCase()}.` : '';
        })
        .filter(Boolean)
        .join('-');
    })
    .filter(Boolean)
    .join(' ');
}

export function formatPersonName(person) {
  if (!person) return '';
  if (person.family) {
    const family = stripMarkup(person.family);
    const ini = initials(person.given);
    return ini ? `${family}, ${ini}` : family;
  }
  return stripMarkup(person.name || person.literal || '');
}

function formatPersonNameInline(person) {
  if (!person) return '';
  if (person.family) {
    const ini = initials(person.given);
    const family = stripMarkup(person.family);
    return ini ? `${ini} ${family}` : family;
  }
  return stripMarkup(person.name || person.literal || '');
}

export function joinAuthors(names) {
  const list = names.filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length <= 20) return `${list.slice(0, -1).join(', ')}, & ${list[list.length - 1]}`;
  return `${list.slice(0, 19).join(', ')}, . . . ${list[list.length - 1]}`;
}

function joinEditorsInline(names) {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  if (list.length === 2) return `${list[0]} & ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}, & ${list[list.length - 1]}`;
}

export function getYear(work) {
  for (const key of ['published-print', 'issued', 'published-online', 'published']) {
    const year = work?.[key]?.['date-parts']?.[0]?.[0];
    if (year && /^\d{4}$/.test(String(year))) return String(year);
  }
  return null;
}

function getTitle(work) {
  const title = stripMarkup(work?.title?.[0]);
  const subtitle = stripMarkup(work?.subtitle?.[0]);
  if (title && subtitle && !title.toLowerCase().includes(subtitle.toLowerCase())) {
    return `${title.replace(/[:.]\s*$/, '')}: ${subtitle}`;
  }
  return title;
}

function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
}

const withPeriod = (s) => (/[.?!]$/.test(s) ? s : `${s}.`);

function createBuilder() {
  const segments = [];
  return {
    segments,
    add(text, italic = false) {
      if (!text) return this;
      const last = segments[segments.length - 1];
      if (last && last.i === italic) last.t += text;
      else segments.push({ t: text, i: italic });
      return this;
    },
  };
}

function addTitle(b, title, italic, suffix) {
  if (!title) {
    b.add(`[No title]${suffix || ''}. `);
    return;
  }
  if (italic) {
    b.add(title, true);
    if (suffix) b.add(`${suffix}. `);
    else b.add(/[?!]$/.test(title) ? ' ' : '. ');
  } else {
    b.add(`${withPeriod(title)} `);
  }
}

export function formatApa(work) {
  const type = work?.type || 'other';
  const kind = KIND_BY_TYPE[type] || 'other';
  const warnings = new Set();
  const b = createBuilder();

  const authors = (work?.author || []).map(formatPersonName).filter(Boolean);
  const editorPeople = (work?.editor || []).filter(Boolean);
  const editors = editorPeople.map(formatPersonName).filter(Boolean);
  const year = getYear(work);
  if (!year) warnings.add('no_year');
  const date = year || 'n.d.';
  const title = getTitle(work);
  if (title) warnings.add('sentence_case');
  const container = stripMarkup(work?.['container-title']?.[0]);
  const publisher = stripMarkup(work?.publisher);
  const institution = stripMarkup(work?.institution?.[0]?.name);
  const pages = work?.page ? stripMarkup(work.page).replace(/\s*[-‐-―]+\s*/g, EN_DASH) : '';
  const articleNumber = stripMarkup(work?.['article-number']);
  const volume = stripMarkup(work?.volume);
  const issue = stripMarkup(work?.issue);
  const edition = Number.parseInt(work?.['edition-number'], 10);
  const doiUrl = work?.DOI ? `https://doi.org/${work.DOI}` : stripMarkup(work?.URL);

  let creator = '';
  if (authors.length) creator = joinAuthors(authors);
  else if (kind === 'book' && editors.length) {
    creator = `${joinAuthors(editors)} (${editors.length > 1 ? 'Eds.' : 'Ed.'})`;
  }
  if (!creator) warnings.add('no_authors');

  let suffix = '';
  if (kind === 'book' && edition > 1) suffix = ` (${ordinal(edition)} ed.)`;
  if (kind === 'preprint') suffix = ' [Preprint]';
  if (kind === 'dataset') suffix = ' [Data set]';
  if (kind === 'thesis') {
    const where = institution || publisher;
    suffix = where ? ` [Doctoral dissertation, ${where}]` : ' [Doctoral dissertation]';
    warnings.add('thesis_type');
  }
  const italicTitle = kind !== 'article' && kind !== 'chapter';

  if (creator) {
    b.add(`${withPeriod(creator)} (${date}). `);
    addTitle(b, title, italicTitle, suffix);
  } else {
    addTitle(b, title, italicTitle, suffix);
    b.add(`(${date}). `);
  }

  if (kind === 'article') {
    if (container) {
      b.add(container, true);
      if (volume) {
        b.add(', ');
        b.add(volume, true);
        if (issue) b.add(`(${issue})`);
      }
      if (pages) b.add(`, ${pages}`);
      else if (articleNumber) b.add(`, Article ${articleNumber}`);
      b.add('. ');
    } else {
      warnings.add('no_container');
    }
  } else if (kind === 'chapter') {
    if (container || editors.length) {
      b.add('In ');
      if (editors.length) {
        const inline = joinEditorsInline(editorPeople.map(formatPersonNameInline));
        b.add(`${inline} (${editors.length > 1 ? 'Eds.' : 'Ed.'})${container ? ', ' : ''}`);
      }
      if (container) b.add(container, true);
      else warnings.add('no_container');
      if (pages) b.add(` (pp. ${pages})`);
      b.add('. ');
    } else {
      warnings.add('no_container');
    }
    if (publisher) b.add(`${withPeriod(publisher)} `);
  } else if (kind === 'preprint') {
    const repository = institution || publisher;
    if (repository) b.add(`${withPeriod(repository)} `);
  } else if (kind === 'thesis') {
    // kurum adı köşeli parantez içinde verildi
  } else {
    if (publisher && publisher !== creator) b.add(`${withPeriod(publisher)} `);
    if (kind === 'other') warnings.add('check_type');
  }

  if (doiUrl) b.add(doiUrl);

  const segments = b.segments;
  if (segments.length) segments[segments.length - 1].t = segments[segments.length - 1].t.replace(/\s+$/, '');

  return {
    segments,
    text: segments.map((s) => s.t).join(''),
    markdown: segments.map((s) => (s.i ? `*${s.t}*` : s.t)).join(''),
    type,
    kind,
    doi: work?.DOI || null,
    warnings: [...warnings],
  };
}
