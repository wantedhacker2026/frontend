'use client';
export function InterviewPrompt({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="project-field">
      면접 질문 생성 지침 (프롬프트)
      <small>
        확인할 역량, 질문 난이도, 원하는 질문 방식을 입력하세요. 비워두면 기본 지침을 사용합니다.
        개인정보나 API 키는 입력하지 마세요.
      </small>
      <textarea
        rows={4}
        maxLength={2000}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="예: 실제 프로젝트에서 내린 설계 결정과 대안을 중심으로 질문해 주세요. 장애 대응 경험에는 원인 분석과 재발 방지 후속 질문을 포함해 주세요."
      />
      <small>{value.length}/2,000자 · 프로젝트별로 저장됩니다.</small>
    </label>
  );
}
