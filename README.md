# Customer Inquiry Dashboard — AI 문의 자동 분류·상담원 배정 시스템

웹·이메일 문의를 통합 수집하고, 개인정보(PII)를 탐지해 외부 전송을 차단하며,
CLOVA Studio API로 일반 문의 응답 초안을 생성하고, 긴급도에 따라 상담원 큐에
자동 배정하는 클라우드 기반 민원 처리 관제 시스템.

## 핵심 기능

- **멀티채널 수집** — 웹폼 + 이메일(IMAP 폴링) 2채널을 단일 파이프라인으로 통합
- **PII 게이트** — 정규식으로 전화·이메일·주문번호·계좌 탐지 → 외부 차단 + 마스킹 저장
- **규칙기반 분류** — 키워드 사전으로 카테고리·긴급도(HIGH/MEDIUM/LOW) 분류 (로컬 LLM 미사용)
- **응답 생성** — PII 없는 일반 문의는 CLOVA Studio, PII 포함/장애 시 템플릿 응답
- **서킷브레이커** — CLOVA 장애 시 자동 차단 + 템플릿 폴백
- **상담원 자동 배정** — 긴급도·PII 여부 기반 큐 배정 (전문/전담/일반)
- **비용 집계** — CLOVA 호출 누적 집계 + 임계치 초과 시 Telegram 알림
- **관제 대시보드** — 채널별·긴급도별·PII·비용·서킷 상태 실시간 현황
- **Telegram 알림** — PII 감지·긴급 클레임·폴백·비용 임계치 이벤트 알림

## 기술 스택

| 영역 | 기술 |
|------|------|
| 백엔드 | FastAPI + Uvicorn |
| 리버스 프록시 | Nginx |
| DB | PostgreSQL 16 |
| 캐시/큐 | Redis 7 |
| 응답 AI | CLOVA Studio API (HCX-003) |
| 이메일 수집 | Python imaplib (IMAP 폴링) |
| 알림 | Telegram Bot API |
| 배포 | Docker Compose (Ncloud Ubuntu) |

## 구조

```
.
├── app/
│   ├── main.py           # FastAPI 앱 (API + 문의 폼 + 관제 대시보드)
│   └── email_worker.py   # IMAP 폴링 워커 (이메일 수집 + 삭제 동기화)
├── nginx/
│   └── ai-cs-app.conf    # Nginx 리버스 프록시 설정
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── .env.example          # 환경변수 템플릿 (.env로 복사 후 값 입력)
```

## 실행 방법

1. 환경변수 설정
   ```bash
   cp .env.example .env
   # .env 파일을 열어 CLOVA / Telegram / Gmail 값 입력
   ```

2. 컨테이너 빌드 및 실행
   ```bash
   docker compose up -d --build
   ```

3. Nginx 설정 (호스트에 직접 설치한 경우)
   ```bash
   cp nginx/ai-cs-app.conf /etc/nginx/sites-enabled/ai-cs-app
   # server_name 을 실제 IP/도메인으로 수정
   nginx -t && systemctl reload nginx
   ```

## 화면

- 고객 문의 폼: `http://<서버>/` 또는 `/form`
- 관제 대시보드: `http://<서버>/dashboard`

## 주요 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/tickets` | 문의 접수 (분류·PII·라우팅·배정 처리) |
| GET | `/tickets` | 문의 목록 |
| DELETE | `/tickets/{id}` | 문의 삭제 |
| GET | `/assignments` | 상담원 배정 로그 |
| GET | `/stats` | 통계 (대시보드용) |
| GET | `/circuit-breaker` | 서킷브레이커 상태 |
| POST | `/email/sync` | 이메일 삭제 동기화 (워커 전용) |

## 보안 정책

- PII 포함 문의: 원문 미저장, 마스킹 텍스트만 저장, 외부 API 전송 차단
- DB·Redis는 Private Subnet 격리, 대시보드는 보안그룹 IP 화이트리스트로 접근 통제
- 비밀정보(API 키·토큰·비밀번호)는 `.env`로 분리하며 저장소에 커밋하지 않음
