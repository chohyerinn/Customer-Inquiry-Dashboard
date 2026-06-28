# 헬프데스크 AI — 고객 문의 운영 대시보드

쇼핑몰 고객 문의를 **접수 → 분류 → 개인정보 마스킹 → 상담원 배정 → 응답 초안 → 모니터링**까지 다루는 운영형 웹 앱입니다. 부트캠프 팀 프로젝트입니다.

> This started as a shopping-mall customer-inquiry dashboard. The focus is the *operation flow behind a chatbot-like support system*: classifying inquiries, masking PII, detecting cases that need human handoff, and tracking daily support metrics.

단순히 "AI가 답변을 생성"하는 데서 그치지 않고, **챗봇·상담 운영 뒤에서 필요한 흐름**(문의 분류, 개인정보 마스킹, 폴백, 상담원 연결, 일간 지표)에 초점을 뒀습니다.

## 화면

| 경로 | 화면 | 대상 |
|---|---|---|
| `/` | 문의 접수 폼 | 고객 |
| `/dashboard` | 문의 대시보드 | 상담원 |
| `/inquiry/:id` | 문의 상세 | 상담원 |
| `/monitor` | 실시간 모니터링 | 관리자 |
| `/admin/counselors` | 상담원 관리 | 관리자 |

## 운영 관점에서 다룬 것

- 문의 **카테고리·긴급도 분류**
- **개인정보(이름·전화·이메일) 감지 후 마스킹** → 외부 LLM 호출 전에 차단
- 상담원 배정 / **상담원 연결이 필요한 케이스** 구분
- **API 실패 시 데모 데이터로 폴백** ("데모 데이터" 배지로 명시)
- 실시간 **모니터링 화면** + 비용·사용량 집계

## 설계에서 한 판단 (왜 이 구조, 어디까지)

구조 자체보다 *왜 이 정도에서 멈췄는지*를 기준으로 설계했습니다.

- **API·DB·캐시·워커를 한 Docker Compose 안의 모놀리식으로 묶었습니다.**
  부트캠프 규모(문의 수십~수백 건/일)에서 서비스를 MSA로 쪼개면 운영 부담만
  늘고 이득이 없다고 판단했습니다. 분류·마스킹·초안 생성은 단일 `api` 서비스
  안에서 처리합니다.

- **LLM 응답은 Redis로 캐싱했습니다 (TTL 1시간).**
  같은 문의가 반복될 때 매번 LLM을 호출하면 비용·지연이 쌓이므로, 응답을
  캐시에 두고 줄였습니다. AI 호출을 "느리고 비싼 외부 자원"이라는 전제로 다뤘습니다.

- **이메일 발송은 `email-worker`로 분리했습니다.**
  메일 전송이 느리거나 실패해도 사용자 응답 흐름이 막히면 안 되므로, 응답
  경로에서 떼어내 별도 워커가 처리하게 했습니다.

- **개인정보 마스킹을 LLM 호출 *앞단*에 강제했습니다.**
  "정확도"보다 "개인정보가 외부로 나가지 않는다"를 먼저 보장하는 게 운영
  가능한 서비스라고 판단해, 마스킹을 흐름의 가장 앞에 뒀습니다.

- **외부 호출 실패는 에러가 아니라 폴백으로 처리했습니다.**
  LLM·외부 API의 실패·지연은 정상 범위라 보고, 실패 시 데모 데이터로 떨어지되
  "데모 데이터" 배지로 명시해 사용자가 진짜 응답과 헷갈리지 않게 했습니다.

- **일부러 하지 않은 것:** 메시지 큐(Kafka 등), 서비스 추가 분리, k8s·멀티리전.
  현재 트래픽 규모에서는 과한 구성이라 판단했고, 확장이 필요해지는 시점의
  후보로만 남겨뒀습니다(예: 분류 트래픽이 응답 생성과 따로 스케일링돼야 할 때).

## 구조

```text
backend/   # FastAPI + PostgreSQL + Redis + CLOVA Studio, Docker Compose
frontend/  # React (Vite) — 접수 / 대시보드 / 모니터링 / 상담원 관리 화면
docs/      # 운영 문서: 배포 체크리스트, QA 테스트 계획, 서버 런북
```

## 실행

**프론트엔드**

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev          # http://localhost:5173
```

**백엔드 (Docker)**

```bash
cd backend
cp .env.example .env # 실제 키 값을 채운다 (git에 커밋하지 않음)
docker compose up --build   # http://localhost:8000
```

## 데이터 / 보안

- **모든 문의 데이터는 가상 샘플(synthetic)이며, 실제 고객 데이터나 개인정보를 포함하지 않습니다.**
- API 키·비밀번호·서버 주소는 코드에 하드코딩하지 않고 **환경변수(`.env`)로만** 주입합니다. `.env`는 git에 커밋하지 않습니다.

## 운영 문서 (`docs/`)

| 문서 | 내용 |
|---|---|
| `DEPLOY_CHECKLIST.md` | 배포 전 점검 체크리스트 |
| `TEST_QA.md` | 기능 QA 테스트 결과 |
| `FUNCTION_TEST_PLAN.md` | 기능별 테스트 계획 |
| `SERVER_RUNBOOK.md` | 서버 배포·운영 절차 (민감정보 제외) |
| `OPERATIONS_REVIEW.md` | 오탐·폴백·상담원 연결 케이스를 점검하는 운영 리뷰 샘플 |
