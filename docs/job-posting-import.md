# 채용공고 URL 가져오기

## 사용 방법

로그인 → 프로젝트 생성 → 공고 URL → **URL에서 공고 가져오기** → 항목 확인·수정 → **확인한 내용 적용**.

- 주요 업무, 자격요건, 우대사항, 기술 스택, 기타 공고 내용을 나누어 표시합니다.
- 적용 전에는 기존 JD와 평가 기준을 변경하지 않습니다. 취소·실패 시 기존 입력을 유지합니다.
- 적용 시 JD와 평가 기준을 교체합니다. 프로젝트 이름은 비어 있을 때만 공고 제목으로 채웁니다.
- 자격요건에 명시된 키워드가 있는 기준만 필수로 지정합니다. 주요 업무·우대사항·회사 기술 스택만의 언급은 필수로 올리지 않습니다. 직무 변경과 본문 수정 때도 이 규칙을 유지합니다.
- 직무별 기준은 여러 키워드를 묶은 단위입니다. 같은 기준 안에 필수·우대 키워드가 함께 있으면 해당 기준은 필수입니다. 개별 기술의 숙련도나 경력을 추출만으로 확정하지 않습니다.
- 최종 URL, 수집 시각, 방식, 수정 전 추출 본문을 `jd.imported`에 보존합니다. 기존 프로젝트와 마찬가지로 분석 후 현재 브라우저 저장소에 저장됩니다.

## 수집 경로

`components/projects/jd-import.tsx` → `POST /api/job-postings/import` → `lib/job-postings/import.ts`

브라우저가 외부 사이트를 직접 읽지 않고 **Next.js의 Node 서버에서 수집**합니다. Kotlin 서버 또는 OpenAI API를 호출하는 기능은 아닙니다.

1. 사이트의 robots.txt에서 자동 수집 허용 여부를 확인합니다.
2. HTML의 `JobPosting` JSON-LD를 우선 사용합니다. 배열, `@graph`, 명시적 업무·자격·기술 필드를 지원합니다.
3. HTML 본문의 한글·영문 제목으로 항목을 나눕니다. 구조화 데이터에 빠진 항목은 본문에서 보완합니다.
4. 본문을 찾지 못하면, 설정된 환경에서 Chromium으로 동적 페이지를 렌더링합니다.
5. 수집할 수 없으면 실패 이유와 직접 붙여넣기 안내를 표시합니다. 로그인·CAPTCHA·접근 제한을 우회하지 않습니다.

수집 결과는 요약이나 AI 추론이 아니라 원문 텍스트입니다. 분류가 불명확하면 기타 공고 내용에 남기거나 빈 항목으로 표시합니다. 지원자가 실제로 그 경험을 했는지는 이후 서류 평가에서 따로 확인합니다.

## 실행

Docker에는 Chromium이 포함되고 `JOB_IMPORT_RENDER_ENABLED=true`가 기본 적용됩니다.

```sh
docker compose up --build -d --no-deps --wait web
```

일반 Node 개발 환경에서는 다음을 실행하고 `.env.local`에 `JOB_IMPORT_RENDER_ENABLED=true`를 설정합니다.

```sh
npx playwright install chromium --only-shell
npm run dev
```

Linux에서 브라우저 의존성이 없으면 `npx playwright install --with-deps chromium --only-shell`을 사용합니다. 환경변수를 설정하지 않으면 HTML 수집만 사용합니다. 일반 Vercel 서버리스 환경에는 이 Docker의 Chromium이 없으므로 동적 렌더링을 켜지 않습니다. 해당 환경에서 필요하면 별도 수집 서비스를 연결해야 합니다.

## API

요청: 같은 출처, 로그인 세션 쿠키, `Content-Type: application/json`, `{ "url": "https://..." }`.

성공: `title`, `company`, `sourceUrl`, `fetchedAt`, `method`, `sections`, `warnings`.

실패: `{ "error": "사용자 안내", "code": "오류 코드" }`. 로그인 401, 출처 403, 잘못된 주소 400, 요청 크기 413, 속도 제한 429, 수집 실패 422.

## 제한 및 보호

- HTTP/HTTPS의 기본 포트만 허용합니다. URL 계정 정보, 내부·루프백·링크 로컬·예약 IP는 거부합니다.
- DNS 결과 전체를 검사하고 검증한 IP로 연결합니다. 리다이렉트마다 다시 검사합니다. 최대 3회 이동합니다.
- 외부 요청에는 사용자의 세션·쿠키·API 키를 전달하지 않습니다.
- 수집은 25초, 문서는 압축 전후 각각 2MB, 추출 결과는 30,000자로 제한합니다.
- 동적 페이지의 요청도 안전한 서버 수집을 거쳐 전달합니다. 직접 브라우저 네트워크는 실패하도록 프록시를 설정하고 WebSocket·서비스 워커·POST·다운로드를 차단합니다. 리소스는 최대 50개/총 8MB, 렌더링은 프로세스당 1개입니다.
- 세션당 분당 10회, 전체 동시 3회 제한은 **프로세스 메모리 기준**입니다. 여러 인스턴스 운영 시 공용 속도 제한이 필요합니다.
- 사이트별 로그인, 차단 정책, 이미지 공고, 독자적인 레이아웃, POST API로만 제공하는 공고는 지원되지 않을 수 있습니다.

## 검증

```sh
npm test
npm run lint
npm run typecheck
docker compose run --build --rm --no-deps test sh -c 'npm test && npm run lint && npx next typegen && npm run typecheck && npm run test:job-renderer'
```

테스트는 JSON-LD·HTML·백엔드·프론트엔드·PM의 항목 분리, 필수/우대 구분, 잘못된 주소·내부 IP·인증·사이트 차단·원문 보존을 확인합니다. 렌더러 통합 검증은 외부 사이트 상태에 의존하지 않는 동적 HTML fixture를 사용합니다.

2026-09-17 확인: Lever 공개 샘플 공고 수집 성공. 원티드는 현재 테스트 환경에서 robots.txt 요청에 403을 반환해 자동 수집할 수 없었으며, 수동 입력 안내로 처리했습니다. 모든 채용 사이트를 지원한다는 의미는 아닙니다.
