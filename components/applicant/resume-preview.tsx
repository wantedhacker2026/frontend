import type { ApplicationInput } from '@/types';

export function ResumePreview({ content }: { content: ApplicationInput }) {
  const sections = [
    ['프로젝트 경험', content.projects],
    ['자기소개', content.introduction],
    ['지원동기', content.motivation],
    ['협업 / 커뮤니케이션 경험', content.collaboration],
    ['추가 경험', content.additionalExperience],
  ];
  return (
    <div className="resume-preview">
      <p>
        <strong>{content.name}</strong> · 경력 {content.experience}년
        {content.email && ` · ${content.email}`}
      </p>
      <p className="resume-skills">{content.skills}</p>
      <details className="resume-content-details">
        <summary>지원서 내용 확인하기</summary>
        {sections
          .filter(([, text]) => text)
          .map(([label, text]) => (
            <section key={label}>
              <h3>{label}</h3>
              <p>{text}</p>
            </section>
          ))}
      </details>
    </div>
  );
}
