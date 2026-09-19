/** Filter document furniture and explicit aspirations, while keeping the stored source intact. */
export function evidenceLines(text: string): string[] {
  return text
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      const heading = line.replace(/^TEST\s*\d+\s*[/|·]\s*/i, '').replace(/\s*[:：]$/, '');
      if (
        /^(?:기술\s*스택|프로젝트(?:\s*(?:및|·|\/)\s*업무)?\s*경험|협업(?:과\s*추가)?\s*경험|자기소개|지원\s*동기|추가\s*경험|검증용\s*안내)$/.test(
          heading,
        )
      )
        return false;
      // A wish or personal introduction does not establish completed project work.
      if (/기여하고\s*싶|성장하고\s*있|(?:하고|하기를)\s*희망/.test(line)) return false;
      if (/가상\s*데이터입니다|실제\s*채용\s*지원서\s*아님/.test(line)) return false;
      return true;
    });
}

/** Resolve server evidence back to the original page, preserving PDF whitespace. */
export function sourceExcerpt(text: string, evidence: string): string | undefined {
  if (!evidence.trim()) return undefined;
  const pattern = evidence
    .trim()
    .split(/\s+/u)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  return text.match(new RegExp(pattern, 'u'))?.[0];
}
