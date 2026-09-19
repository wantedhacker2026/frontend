/** Keep Latin token boundaries; only Korean phrase spacing may be omitted. */
export function keywordPattern(keyword: string): RegExp {
  const words = keyword.normalize('NFKC').trim().split(/\s+/u);
  let pattern = '';
  for (const [index, word] of words.entries()) {
    if (index) {
      const korean = /[가-힣]$/u.test(words[index - 1]) || /^[가-힣]/u.test(word);
      pattern += korean ? '\\s*' : '\\s+';
    }
    pattern += word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`(?<![a-z0-9])${pattern}(?![a-z0-9])`, 'iu');
}
