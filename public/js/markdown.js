// Güvenli, küçük bir Markdown alt kümesi: paragraf, satır sonu, madde/numaralı liste,
// **kalın**, *italik*, [bağlantı](https://...), çıplak URL ve e-posta.
// HTML hiçbir zaman yorumlanmaz; tüm metin textContent ile eklenir. Yalnızca http(s) ve mailto bağlantıları.

const INLINE_RE =
  /\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)|\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*|(https?:\/\/[^\s<>"'()[\]]*[^\s<>"'()[\].,;:!?])|([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;

export function tokenizeInline(text) {
  const tokens = [];
  // Her çağrıda yeni bir RegExp: iç içe (kalın/italik) çağrılar konum sayacını bozmasın.
  const re = new RegExp(INLINE_RE.source, 'g');
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: text.slice(last, m.index) });
    if (m[1] !== undefined) tokens.push({ type: 'link', href: m[2], text: m[1] });
    else if (m[3] !== undefined) tokens.push({ type: 'bold', children: tokenizeInline(m[3]) });
    else if (m[4] !== undefined) tokens.push({ type: 'italic', children: tokenizeInline(m[4]) });
    else if (m[5] !== undefined) tokens.push({ type: 'link', href: m[5], text: m[5] });
    else if (m[6] !== undefined) tokens.push({ type: 'link', href: `mailto:${m[6]}`, text: m[6] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) });
  return tokens;
}

export function parseBlocks(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', lines: para });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*(\d{1,3})[.)]\s+(.*)$/);
    if (bullet) {
      flushPara();
      if (!list || list.type !== 'ul') {
        flushList();
        list = { type: 'ul', items: [] };
      }
      list.items.push(bullet[1]);
    } else if (numbered) {
      flushPara();
      if (!list || list.type !== 'ol') {
        flushList();
        list = { type: 'ol', items: [], start: Number(numbered[1]) };
      }
      list.items.push(numbered[2]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      para.push(line.replace(/^\s*#{1,6}\s+/, ''));
    }
  }
  flushPara();
  flushList();
  return blocks;
}

function appendInline(parent, tokens, doc) {
  for (const tk of tokens) {
    if (tk.type === 'text') {
      parent.appendChild(doc.createTextNode(tk.value));
    } else if (tk.type === 'bold' || tk.type === 'italic') {
      const el = doc.createElement(tk.type === 'bold' ? 'strong' : 'em');
      appendInline(el, tk.children, doc);
      parent.appendChild(el);
    } else if (tk.type === 'link') {
      const a = doc.createElement('a');
      a.href = tk.href;
      a.textContent = tk.text;
      if (!tk.href.startsWith('mailto:')) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      parent.appendChild(a);
    }
  }
}

export function renderMarkdown(text, doc = globalThis.document) {
  const frag = doc.createDocumentFragment();
  for (const block of parseBlocks(text)) {
    if (block.type === 'p') {
      const p = doc.createElement('p');
      block.lines.forEach((line, i) => {
        if (i) p.appendChild(doc.createElement('br'));
        appendInline(p, tokenizeInline(line), doc);
      });
      frag.appendChild(p);
    } else {
      const listEl = doc.createElement(block.type);
      if (block.type === 'ol' && block.start > 1) listEl.start = block.start;
      for (const item of block.items) {
        const li = doc.createElement('li');
        appendInline(li, tokenizeInline(item), doc);
        listEl.appendChild(li);
      }
      frag.appendChild(listEl);
    }
  }
  return frag;
}
