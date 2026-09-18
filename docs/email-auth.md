# 이메일 인증 UI 연동

## 변경한 흐름

1. `/login`에서 구직자/채용담당자 이용 유형과 이메일을 입력합니다.
2. 인증 코드 받기 → 서버가 6자리 코드를 발송합니다.
3. 코드를 입력하면 로그인하며, 처음 사용하는 이메일은 서버가 자동 가입시킵니다.
4. 프로젝트 생성에서 이동한 경우 원래 생성 화면으로 돌아갑니다. 그 외 구직자는 프로젝트 생성, 채용담당자는 홈으로 이동합니다.

비밀번호 입력, 데모 회원가입, 연결되지 않은 소셜 로그인 버튼을 제거했습니다. 60초 재발송 대기, 5분 유효시간, 401 코드 오류, 429 재발송 제한, 메일 전송 실패 안내를 추가했습니다. 표시 이름과 이용 유형은 현재 웹 작업 공간용 설정이며 서버의 조직 권한을 뜻하지 않습니다. 서버 API에는 아직 이름/역할 프로필이 없습니다.

## API 연결

| 웹 서버 경로             | Kotlin 서버 경로         | 기능                       |
| ------------------------ | ------------------------ | -------------------------- |
| POST `/api/auth/code`    | POST `/api/auth/code`    | 이메일 정규화 및 코드 요청 |
| POST `/api/auth/login`   | POST `/api/auth/login`   | 코드 확인 후 세션 생성     |
| POST `/api/auth/reissue` | POST `/api/auth/reissue` | 토큰 갱신                  |
| GET `/api/session`       | 없음                     | 웹 세션 복원               |
| DELETE `/api/session`    | 없음                     | 웹 쿠키 삭제               |

서버는 토큰을 JSON이 아니라 `Authorization`, `Refresh-Token` 응답 헤더에 담습니다. Next.js 서버가 이를 읽어 암호화한 HttpOnly 쿠키에 저장하며, 브라우저 스크립트나 localStorage에는 토큰을 전달하지 않습니다. 분석과 면접 프록시는 access token을 `Authorization: Bearer ...`로 전달합니다. OpenAI 키는 계속 Kotlin 서버에만 둡니다.

화면 재진입, 포커스 복귀, 주기적 확인, 보호 API 호출 전에 세션을 확인합니다. 갱신 시 브라우저 Web Locks와 한 Node 프로세스 내 중복 요청 합치기를 사용해 refresh token의 중복 회전을 줄입니다. 다중 서버 운영에는 공용 잠금/짧은 갱신 결과 캐시 또는 서버의 idempotency 지원이 추가로 필요합니다.

서버에 토큰 폐기 API가 없어 현재 로그아웃은 이 브라우저의 쿠키를 삭제합니다. 모든 기기 로그아웃/탈취 토큰 강제 폐기는 이 UI 범위에 포함되지 않습니다.

## 저장 데이터

- 프로젝트 ID 소유자는 인증 서버가 발급한 사용자 UUID입니다. 클라이언트가 보낸 ID는 사용하지 않습니다.
- 예전 데모 세션은 더 이상 허용하지 않습니다. `/api/session`에 임의의 사용자 정보를 보내는 데모 로그인도 거부합니다.
- 기존 데모 데이터는 삭제하거나 실제 계정에 자동 이관하지 않습니다.
- 프로젝트는 기존 저장소에서 계정·이용 유형별로 구분합니다. 지원서 버전/기존 채용 화면 저장소도 `shortlist-demo-v1:account:<user-id>:<role>`로 분리합니다.
- 프로젝트/서류는 여전히 브라우저 저장이며 서버 DB로 동기화되지 않습니다. 서버에 저장되는 회원/코드/refresh 정보와 구분해야 합니다.

## 로컬 실행과 메일 설정

실제 메일을 사용하려면 서버 `.env`에 다음 값을 직접 설정합니다. 값은 커밋하지 않습니다.

```dotenv
SPRING_MAIL_USERNAME=메일계정
SPRING_MAIL_PASSWORD=SMTP용앱비밀번호
```

현재 서버 기본 SMTP 호스트/포트는 서버의 `application.yml`에 정의되어 있습니다. 다른 공급자를 쓸 때는 `SPRING_MAIL_HOST`, `SPRING_MAIL_PORT` 및 인증/TLS 속성도 함께 설정합니다. 실제 계정 설정이 없으면 메일 전송과 메일 상태 검사가 실패합니다.

프론트엔드 `.env`에는 32자 이상의 `INTERVIEW_PROXY_SECRET`이 필요합니다. 기존 면접 프록시와 같은 값을 사용하며, HTTPS 운영에서는 `SESSION_COOKIE_SECURE=true`를 설정합니다. `DEMO_LOGIN_ENABLED`는 더 이상 사용하지 않습니다.

### 외부 발송 없는 로컬 검증

```sh
docker compose -f compose.yaml -f compose.auth-test.yaml up --build -d --wait web mailpit
```

- 로그인: http://localhost:3000/login
- 테스트 메일함: http://localhost:8026
- `tester@example.test` 같은 테스트 주소로 코드를 요청하고 메일함에서 확인합니다.
- 이 실행에서는 모든 메일을 로컬 Mailpit이 수신합니다. 실제 메일함으로 발송하지 않습니다.

일반 SMTP 설정으로 되돌리려면 서버 `.env`를 먼저 채운 뒤 다음을 실행합니다.

```sh
docker compose up -d --wait server web
docker compose -f compose.yaml -f compose.auth-test.yaml stop mailpit
```

### 검증 명령

```sh
npm test
npm run lint
npm run typecheck
# 메일 테스트 구성으로 서버를 실행한 후:
docker compose -f compose.yaml -f compose.auth-test.yaml run --build --rm integration-test
```

통합 검증은 로컬 테스트 이메일로 실제 인증을 거쳐 자동 가입, 세션 복원, 일회용 코드 재사용 거절, 3개 직무 서류 분석 및 면접 API 연결을 검사합니다. 인증 코드/토큰은 결과 로그에 출력하지 않습니다.
