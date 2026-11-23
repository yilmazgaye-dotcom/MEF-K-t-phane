// DOI algılama ve Crossref'ten meta veri alma (ücretsiz, anahtarsız API).

const DOI_RE = /\b10\.\d{4,9}\/[^\s"'<>]+/i;

function countChar(str, ch) {
  let n = 0;
  for (const c of str) if (c === ch) n += 1;
  return n;
}

export function extractDoi(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(DOI_RE);
  if (!match) return null;
  let doi = match[0];
  for (;;) {
    const last = doi.at(-1);
    if ('.,;:!?\'"'.includes(last)) {
      doi = doi.slice(0, -1);
    } else if (last === ')' && countChar(doi, '(') < countChar(doi, ')')) {
      doi = doi.slice(0, -1);
    } else if (last === ']' && countChar(doi, '[') < countChar(doi, ']')) {
      doi = doi.slice(0, -1);
    } else {
      break;
    }
  }
  return doi.length > 7 ? doi : null;
}

export async function lookupDoi(doi, { mailto = '', fetchImpl = fetch, timeoutMs = 6000 } = {}) {
  const path = doi.split('/').map(encodeURIComponent).join('/');
  const userAgent = `MEF-Kutuphane-Asistani/2.0${mailto ? ` (mailto:${mailto})` : ''}`;
  const res = await fetchImpl(`https://api.crossref.org/works/${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': userAgent },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 404) return { found: false };
  if (!res.ok) throw new Error(`Crossref ${res.status}`);
  const json = await res.json();
  return json && json.message ? { found: true, work: json.message } : { found: false };
}
