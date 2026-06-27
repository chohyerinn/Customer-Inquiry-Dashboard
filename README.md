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
