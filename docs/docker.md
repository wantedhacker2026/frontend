# 로컬 Docker: 프론트엔드 + 서버

## 준비와 실행

Docker Desktop이 실행 중이어야 한다. 두 저장소에 직무별 분석 코드와 Dockerfile이 필요하며 기본 폴더 구조는 다음과 같다.

```text
02_Dev/
├── 02_wantedhacker/          # compose.yaml 실행 위치
└── 03_wantedhacker-server/   # Kotlin 서버
```

프론트엔드 저장소에서 실행한다. 호스트 Node/Java 없이 컨테이너에서 빌드한다. 이메일 인증에는 SMTP 설정이 필요하다. 외부 발송 없는 로컬 테스트 실행은 [이메일 인증 문서](email-auth.md)를 참고한다.

```sh
docker compose up --build -d --wait --wait-timeout 240 web
docker compose ps
```

| 서비스        | 접속                                  | 역할                            |
| ------------- | ------------------------------------- | ------------------------------- |
| web           | http://localhost:3000/home            | 프론트엔드                      |
| server        | http://localhost:8080/actuator/health | Kotlin 서버 상태                |
| elasticsearch | Docker 내부에서만 접근                | 기존 서버 상태 검사의 연결 대상 |

Elasticsearch → server → web 순서로 상태 검사를 통과한 뒤 시작한다. 웹 컨테이너는 `WANTEDHACKER_SERVER_URL=http://server:8080`으로 API를 호출한다. 브라우저에서 Docker 내부 주소를 직접 호출하지 않는다.

```text
브라우저 localhost:3000
  → web /api/analysis/keywords
  → server:8080/api/analysis/keywords
  → 키워드·근거 단계 응답
```

서버 위치나 포트가 다르면 환경값을 지정한다. 이후 실행 명령에도 같은 값을 사용한다.

```sh
SERVER_SOURCE_DIR=/절대/경로/server WEB_PORT=3100 SERVER_PORT=18080 docker compose up --build -d --wait web
```

소스 수정 후 같은 `up --build` 명령으로 이미지를 갱신한다. 서버만 수정했다면 `docker compose up --build -d --wait server`로 갱신한다.

## 실제 분석과 컨테이너 테스트

```sh
# 가상 이력서 3명 + 집중형/균형형 2명: 웹 프록시 → 실제 Kotlin API 검증
docker compose -f compose.yaml -f compose.auth-test.yaml run --build --rm integration-test

# 프론트엔드 단위 테스트·린트·타입 검사
docker compose --profile test run --build --rm test

# Kotlin 서버 테스트
docker compose --profile test run --build --rm server-test
```

통합 테스트는 웹 컨테이너와 네트워크를 공유해 localhost로 실제 웹 API를 호출한다. 종료한 테스트 컨테이너는 삭제된다. 가상 분석 결과는 임시 컨테이너에서만 생성하며 브라우저 프로젝트는 변경하지 않는다.

수동 테스트:

1. http://localhost:3000/home 에서 이용 유형을 채용담당자로 선택하고 이메일 인증 코드로 로그인한다.
2. 새 프로젝트에서 백엔드·프론트엔드·구축 PM 등 분석 직무를 선택한다.
3. `tests/fixtures/synthetic-resumes/`의 `*-jd.txt`를 JD로 입력하고 대응 이력서 TXT를 등록한다.
4. 핵심 항목과 충족 기준을 설정하고 분석한다.
5. 점수·원문 근거·충족률을 확인한다. 복수 지원자를 등록하면 균형순과 총점순을 비교할 수 있다.

TXT/PDF는 브라우저에서 읽으므로 파일을 컨테이너에 복사할 필요가 없다. 이미지 PDF의 OCR은 아직 연결하지 않는다. 로그인은 서버 이메일 인증을 사용한다. 면접 질문 AI 키는 백엔드 `.env`에 설정하며, 로그인 세션과 연결 설정은 [면접 준비 문서](interview-preparation.md)를 참고한다.

## 개발 모드

```sh
docker compose --profile dev up --build -d dev
```

접속: http://localhost:3001/home. 서버와 Elasticsearch도 함께 시작한다. 프론트엔드 수정은 자동 반영하며 macOS와 Linux 의존성이 섞이지 않도록 node_modules와 .next를 별도 볼륨에 둔다. 서버 수정은 이미지를 다시 빌드해야 반영된다. 개발 포트는 `DEV_PORT`로 변경한다.

## 상태 확인과 종료

```sh
docker compose ps
docker compose logs --tail=100 web server elasticsearch
docker compose --profile dev down
```

- 종료해도 Elasticsearch 볼륨과 브라우저 분석 기록은 남는다.
- `docker compose --profile dev --profile test down -v`는 Elasticsearch 데이터와 개발·테스트 캐시 볼륨까지 삭제하므로 초기화할 때만 사용한다.
- localhost:3000, localhost:3001, 127.0.0.1:3000, 운영 사이트는 각각 다른 브라우저 저장소다.
- 호스트 포트는 127.0.0.1에만 연결한다. Elasticsearch 포트는 공개하지 않는다.
- 서버는 Java 21 다단계 빌드와 일반 사용자 실행, 웹은 Node 22 standalone 빌드를 사용한다.
- 서버 로컬 JWT 기본값은 기존 local 프로필을 사용한다. 운영 비밀 설정과 호스트 환경 파일은 빌드 컨텍스트에서 제외한다.

## Elasticsearch의 현재 역할

현재 서버에는 연결 설정·감사 설정·라이브러리·상태 검사만 있고, 실제 저장/검색 엔티티나 저장소 구현은 없다. 지원서 분석은 JSON 목록과 Kotlin 규칙을 사용하며 결과는 브라우저에 저장된다. Elasticsearch는 분석에 직접 사용하지 않는다.

이 Compose는 기존 `/actuator/health`가 Elasticsearch 연결을 검사하므로 해당 의존성을 함께 띄운다. 로컬 전용 단일 노드 구성이고 운영 배포용이 아니다. 향후 로컬 상태 검사에서 Elasticsearch를 제외하면 프론트엔드와 서버만 실행하도록 줄일 수 있다.

설치 참고: [Elastic 공식 Docker 안내](https://www.elastic.co/docs/deploy-manage/deploy/self-managed/install-elasticsearch-with-docker). 이미지 버전은 서버 Java 클라이언트와 같은 9.4.5로 고정하며 `ES_VERSION`으로 변경할 수 있다.

## 문제 해결

| 증상                           | 확인                                                 |
| ------------------------------ | ---------------------------------------------------- |
| Docker daemon 연결 실패        | Docker Desktop 실행 후 `docker info` 확인            |
| 서버 Dockerfile 없음           | 서버 저장소 위치 또는 `SERVER_SOURCE_DIR` 확인       |
| 포트 사용 중                   | `WEB_PORT`, `SERVER_PORT`, `DEV_PORT` 변경           |
| 웹에서 서버 분석 실패          | `docker compose ps`의 server 상태와 서버 로그 확인   |
| Elasticsearch 준비 실패        | Elasticsearch 로그와 Docker Desktop 메모리 여유 확인 |
| 서버 코드가 예전 결과 반환     | `docker compose up --build -d --wait server` 재실행  |
| 운영 사이트 기록이 로컬에 없음 | 브라우저 저장소가 다른 정상 동작. 로컬에 서류 등록   |

## 검증 상태

2026-09-16 로컬 Docker에서 확인:

- 개발/테스트 프로필 포함 Compose 구문 검사 통과.
- 서버 Java 21 bootJar 및 프론트엔드 standalone 이미지 빌드 성공.
- web·server·elasticsearch 컨테이너 모두 healthy, 웹 `/home` HTTP 200, 서버 `/actuator/health` UP.
- 실제 브라우저에서 http://localhost:3000/home 접속 확인.
- 통합 테스트: 가상 이력서 3명과 비교 지원자 2명의 점수·근거·균형순 검증 통과.
- 프론트엔드 컨테이너: 단위 테스트 51개, ESLint, 라우트 타입 생성, TypeScript 검사 통과.
- 서버 컨테이너: Gradle 테스트 성공.
- 개발 모드의 Compose 구문은 확인했으며, dev 컨테이너의 실시간 변경 반영은 이번 실행 검증에 포함하지 않았다.
