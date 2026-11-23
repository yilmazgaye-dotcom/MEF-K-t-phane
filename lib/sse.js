// Server-Sent Events (SSE) ayrıştırıcı. OpenAI'ın akışlı yanıtlarını olay olay okur.
// Parçalar (chunk) olayların ortasından bölünebilir; ayrıştırıcı bunu tamponlayarak çözer.

export function parseSseBlock(raw) {
  const dataLines = [];
  let eventName = null;
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    else if (line.startsWith('event:')) eventName = line.slice(6).trim();
  }
  if (!dataLines.length) return null;
  const data = dataLines.join('\n');
  if (data === '[DONE]') return { type: 'done' };
  try {
    const json = JSON.parse(data);
    if (json && typeof json === 'object' && !json.type && eventName) json.type = eventName;
    return json;
  } catch {
    return null;
  }
}

export function createSseParser(onEvent) {
  let buffer = '';
  return {
    push(chunk) {
      buffer = (buffer + chunk).replace(/\r\n/g, '\n');
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const evt = parseSseBlock(block);
        if (evt) onEvent(evt);
      }
    },
    flush() {
      if (buffer.trim()) {
        const evt = parseSseBlock(buffer);
        if (evt) onEvent(evt);
      }
      buffer = '';
    },
  };
}
