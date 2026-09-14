import type { ProjectDocument } from './types';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export async function readProjectFile(file: File, applicantId: string): Promise<ProjectDocument> {
  const base = { id: crypto.randomUUID(), applicantId, filename: file.name, size: file.size };
  try {
    if (file.size > MAX_FILE_BYTES) throw new Error('용량 초과: 파일당 10MB 이하로 등록해 주세요.');
    if (file.size === 0) throw new Error('빈 파일입니다. 다른 파일을 선택해 주세요.');
    const ext = file.name.split('.').at(-1)?.toLowerCase();
    if (!['pdf', 'txt'].includes(ext ?? '')) throw new Error('지원 형식은 PDF와 TXT입니다.');
    if (ext === 'txt') {
      const text = await file.text();
      if (!text.trim()) throw new Error('읽을 수 있는 텍스트가 없습니다.');
      if (text.length > 100000) throw new Error('문서의 텍스트는 10만 자 이내로 등록해 주세요.');
      return { ...base, status: 'ready', source: 'text', pages: [{ number: 1, text }] };
    }
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    const task = pdfjs.getDocument({
      data: await file.arrayBuffer(),
      useSystemFonts: true,
    });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 30) throw new Error('페이지 초과: PDF는 30페이지 이하로 등록해 주세요.');
      const pages = [];
      let length = 0;
      for (let i = 1; i <= pdf.numPages; i++) {
        const content = await (await pdf.getPage(i)).getTextContent();
        const text = content.items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
          .join('');
        length += text.length;
        if (length > 100000) throw new Error('문서의 텍스트는 10만 자 이내로 등록해 주세요.');
        pages.push({ number: i, text });
      }
      if (!pages.some((p) => p.text.trim()))
        throw new Error(
          '이미지 PDF: OCR 연동 전이라 읽을 수 없습니다. 텍스트 PDF 또는 TXT로 교체해 주세요.',
        );
      const unreadablePages = pages.filter((p) => !p.text.trim()).map((p) => p.number);
      return {
        ...base,
        status: 'ready',
        source: 'pdf',
        pages,
        unreadablePages,
        ...(unreadablePages.length
          ? {
              error: `${unreadablePages.join(', ')}페이지에서 텍스트를 읽지 못했습니다. 이미지 또는 빈 페이지인지 확인해 주세요.`,
            }
          : {}),
      };
    } finally {
      await task.destroy();
    }
  } catch (error) {
    const e = error as Error;
    return {
      ...base,
      status: 'failed',
      source: 'pdf',
      pages: [],
      error:
        e.name === 'PasswordException'
          ? '암호화된 PDF입니다. 암호를 해제한 문서로 교체해 주세요.'
          : e.name === 'InvalidPDFException'
            ? '손상되었거나 올바른 PDF가 아닙니다. 다른 파일로 교체해 주세요.'
            : e.message || '파일을 읽지 못했습니다. 다시 선택해 주세요.',
    };
  }
}
