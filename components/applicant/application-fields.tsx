'use client';
import type { ApplicationInput } from '@/types';
const fields: {
  key: 'projects' | 'introduction' | 'motivation' | 'collaboration' | 'additionalExperience';
  label: string;
  hint: string;
  placeholder: string;
  rows: number;
  required: boolean;
}[] = [
  {
    key: 'projects',
    label: '프로젝트 경험',
    hint: '사용한 기술, 본인의 역할, 수행 과정과 결과를 적어주세요.',
    placeholder:
      '예: Spring Boot로 주문 API를 개발하고 MySQL 쿼리를 개선해 응답 시간을 30% 줄였습니다.',
    rows: 5,
    required: true,
  },
  {
    key: 'introduction',
    label: '자기소개',
    hint: '어떤 문제를 해결하고 싶은 개발자인가요?',
    placeholder: '관심 분야와 자신만의 일하는 방식을 소개해 주세요.',
    rows: 3,
    required: true,
  },
  {
    key: 'motivation',
    label: '지원동기',
    hint: '이 회사와 직무를 선택한 이유를 알려주세요. 점수에는 반영하지 않습니다.',
    placeholder: '이 제품과 팀에서 기여하고 싶은 부분을 적어주세요.',
    rows: 3,
    required: true,
  },
  {
    key: 'collaboration',
    label: '협업 / 커뮤니케이션 경험',
    hint: '함께한 사람, 역할 분담, 의견을 조율한 과정을 적어주세요. 경험이 없으면 현재 상황을 적어도 괜찮아요.',
    placeholder: '예: 3명의 팀원과 API 명세를 조율하고 코드 리뷰를 진행했습니다.',
    rows: 4,
    required: true,
  },
  {
    key: 'additionalExperience',
    label: '추가 경험',
    hint: '학습, 자격증, 오픈소스 기여, 운영 경험 등을 자유롭게 적어주세요.',
    placeholder: '작성할 내용이 없다면 비워두어도 괜찮아요.',
    rows: 3,
    required: false,
  },
];

export function ApplicationFields({
  form,
  onChange,
  disabled = false,
}: {
  form: ApplicationInput;
  onChange: (form: ApplicationInput) => void;
  disabled?: boolean;
}) {
  function update<K extends keyof ApplicationInput>(key: K, value: ApplicationInput[K]) {
    onChange({ ...form, [key]: value });
  }
  return (
    <fieldset disabled={disabled} className="application-fields">
      <div className="form-two-col">
        <label>
          이름 <em>*</em>
          <input
            required
            maxLength={50}
            autoComplete="name"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="이름을 입력하세요"
          />
        </label>
        <label>
          관련 경력 (년) <em>*</em>
          <input
            required
            type="number"
            min={0}
            max={60}
            step={0.1}
            value={form.experience}
            onChange={(e) => update('experience', Number(e.target.value))}
          />
        </label>
      </div>
      <label>
        이메일 <span className="optional">선택 · 실제 발송 없음</span>
        <input
          type="email"
          maxLength={254}
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          placeholder="example@email.com"
        />
      </label>
      <label>
        기술 스택 <em>*</em>
        <span className="field-hint">직접 사용하거나 학습한 기술을 쉼표로 구분해 주세요.</span>
        <input
          required
          maxLength={500}
          value={form.skills}
          onChange={(e) => update('skills', e.target.value)}
          placeholder="Java, Spring Boot, MySQL …"
        />
      </label>
      {fields.map((f) => (
        <label key={f.key}>
          {f.label} {f.required ? <em>*</em> : <span className="optional">선택</span>}
          <span className="field-hint">{f.hint}</span>
          <textarea
            required={f.required}
            maxLength={8000}
            rows={f.rows}
            placeholder={f.placeholder}
            value={form[f.key]}
            onChange={(e) => update(f.key, e.target.value)}
          />
        </label>
      ))}
    </fieldset>
  );
}
