# SERVER_RUNBOOK.md
# 서버 운영 런북 — Customer Inquiry Management System

> 이 파일에는 실제 IP, 비밀번호, API 키, SSH 개인키 내용을 절대 기록하지 않는다.
> 민감한 값은 팀 비밀 관리 도구(예: 팀 공유 채널, 비밀 vault) 에서 별도 관리한다.

---

## 0. 실제 서버 환경

### 확인된 환경

| 항목 | 내용 |
|------|------|
| OS | **Ubuntu 22.04 LTS** |
| 접속 계정 | `ubuntu` |
| 내부 IP | `10.0.1.x` — 공개 IP는 팀 공유 채널 참조 |
| Python | 3.11 (`python3` 명령) |
| Docker | **설치 완료** |
| docker-compose | **설치 완료** |
| git | 설치됨 |
| 프로젝트 폴더 | `/app` |

### 사용 중인 포트

| 포트 | 용도 |
|------|------|
| 22 | SSH |
| 80 / 443 | HTTP/HTTPS (Nginx) |
| 8000 | FastAPI 백엔드 |
| 5432 | PostgreSQL (Ncloud Cloud DB, 내부망) |
| 6379 | Redis (Ncloud Cloud DB, 내부망) |

---

## 1. 실행 위치

| 작업 | 실행 위치 |
|------|-----------|
| 코드 수정 / 커밋 / 푸시 | 로컬 개발 머신 |
| Docker 이미지 빌드 및 컨테이너 기동 | 서버 (SSH 접속 후) |
| 환경변수 설정 (.env 파일 작성) | 서버 (SSH 접속 후) |
| 브라우저 동작 확인 | 로컬 브라우저 (서버 공개 IP 또는 localhost) |
| 로그 확인 / 롤백 | 서버 (SSH 접속 후) |

### 로컬에서 할 일
- `git pull` / `git push` 로 코드 최신화
- `docker-compose up -d` + `uvicorn` + `npm run dev` 로 로컬 동작 검증
- `.env.example` 기준으로 서버용 `.env` 값 준비 (값은 서버에서만 입력)
- 배포 전 `DEPLOY_CHECKLIST.md` 항목 점검

### 서버에서 할 일
- `git pull origin main` 으로 최신 코드 수신
- `.env` 파일에 환경변수 값 설정
- `docker-compose -f docker-compose.prod.yml up -d --build` 로 운영 컨테이너 기동
- `curl http://localhost:8000/health` 로 헬스체크
- 로그 모니터링 및 장애 발생 시 롤백

---

## 2. 서버 정보

| 항목 | 내용 |
|------|------|
| 클라우드 | Ncloud (Korea Region) |
| OS | **Ubuntu 22.04 LTS** |
| 접속 계정 | `ubuntu` |
| 접속 방법 | SSH (포트 22, 키 파일 인증) |
| 서버 내부 IP | `10.0.1.x` — 공개 IP는 팀 공유 채널 참조, 이 파일에 기록 금지 |
| 프로젝트 폴더 | `/app` |
| 공개 포트 | 80/443 (Nginx 리버스 프록시) |
| 내부 포트 | 8000 (FastAPI), 5432 (PostgreSQL — Ncloud Cloud DB), 6379 (Redis — Ncloud Cloud DB) |
| 네트워크 구조 | VPC 퍼블릭: 앱 서버; VPC 프라이빗: Ncloud Cloud DB (PostgreSQL/Redis) |
| Docker | **설치 완료** |

```bash
# SSH 접속 (키 파일 인증)
ssh -i ~/.ssh/ncloud_key.pem ubuntu@<SERVER_IP>
```

---

## 3. 환경변수

### 필요한 키 이름

| 환경변수 이름 | 용도 | 필수 여부 |
|---------------|------|-----------|
| `CLOVA_API_KEY` | CLOVA Studio 인증 | 필수 |
| `CLOVA_API_HOST` | CLOVA Studio 엔드포인트 URL | 필수 |
| `TELEGRAM_BOT_TOKEN` | Telegram 봇 알림 발송 | 필수 |
| `TELEGRAM_CHAT_ID` | 알림 대상 채널/그룹 ID | 필수 |
| `GMAIL_USER` | Gmail IMAP 수신 계정 주소 | 필수 |
| `GMAIL_APP_PASSWORD` | Gmail 앱 비밀번호 | 필수 |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | 필수 |
| `REDIS_URL` | Redis 연결 문자열 | 필수 |
| `SECRET_KEY` | FastAPI 세션/JWT 서명 키 | 필수 |

### 값 보관 위치
- **팀 공유**: 팀 비밀 관리 채널 또는 노션/드라이브의 비공개 문서
- **서버**: `/app/.env` 파일 (서버 내에만 존재, git에 포함하지 않음)
- **로컬 개발**: 프로젝트 루트 `.env` (`.gitignore` 에 등록되어 있는지 반드시 확인)

### 화면/깃/발표 자료 노출 금지 여부
- 발표 슬라이드, 화면 공유, 녹화 영상에 `.env` 파일 내용 노출 금지
- 터미널 에서 `cat .env` 또는 `printenv` 전체 출력 화면 공유 금지
- `git add .env` 금지 — `.gitignore` 에 `.env` 포함 여부 배포 전 반드시 확인

### 로그나 문서에 값 원문을 쓰지 않는 기준
- 로그 파일, README, CLAUDE.md, 이 런북 어디에도 실제 키 값 기록 금지
- 변수 존재 여부만 확인할 때는 `printenv | grep CLOVA` (키 이름만 출력)
- 값을 꼭 확인해야 할 때는 `echo ${CLOVA_API_KEY:0:4}***` 형식으로 앞 4자리만 확인
- CI/CD 로그에서 시크릿이 마스킹되는지 설정 확인

---

## 4. 실행 명령

### 설치 (서버 최초 1회)

```bash
# Docker 설치 (Ubuntu 22.04)
sudo apt update && sudo apt install -y docker.io docker-compose
sudo usermod -aG docker ubuntu
newgrp docker

# 프로젝트 클론
git clone <REPO_URL> /app
cd /app

# 환경변수 파일 생성
cp .env.example .env
nano .env   # 실제 값 입력 (화면 공유 중 금지)
```

### 개발 실행 (로컬)

```bash
# 인프라 서비스 기동
docker-compose up -d

# 백엔드 (포트 8000)
uvicorn app.main:app --reload

# 프론트엔드 (포트 5173)
npm run dev
```

### 운영 실행 (서버)

```bash
cd /app

# 최신 코드 수신
git pull origin main

# 빌드 및 기동
docker-compose -f docker-compose.prod.yml up -d --build

# 기동 확인
docker ps
curl http://localhost:8000/health
```

### 로그 확인

```bash
# 전체 컨테이너 로그 (최근 50줄)
docker-compose -f docker-compose.prod.yml logs --tail=50

# 백엔드만
docker-compose -f docker-compose.prod.yml logs --tail=100 app

# 실시간 스트리밍
docker-compose -f docker-compose.prod.yml logs -f app

# Nginx 접근 로그
docker-compose -f docker-compose.prod.yml logs -f nginx
```

---

## 5. 검증

### 로컬 브라우저 확인

| URL | 확인 항목 |
|-----|-----------|
| `http://localhost:5173/` | 문의 접수 폼 로드, 카테고리 드롭다운 동작 |
| `http://localhost:5173/dashboard` | 문의 목록 표시, 긴급도 배지 색상 |
| `http://localhost:5173/monitor` | WebSocket 연결, 실시간 큐 수치 갱신 |
| `http://localhost:8000/health` | `{"status": "ok"}` 응답 확인 |
| `http://localhost:8000/docs` | FastAPI Swagger UI 로드 |

### 서버 브라우저 확인

| URL | 확인 항목 |
|-----|-----------|
| `http://<SERVER_IP>/` | Nginx 통해 프론트 정상 서비스 |
| `http://<SERVER_IP>/health` | 백엔드 헬스체크 응답 |
| `http://<SERVER_IP>/dashboard` | 대시보드 데이터 로드 |

### API 실패 상태 확인

```bash
# CLOVA API 연결 상태 확인 (로그에서 오류 여부)
docker logs app 2>&1 | grep -i "clova\|fallback\|template"

# Redis 연결 확인
docker exec -it redis redis-cli ping   # PONG 응답이면 정상

# DB 연결 확인
docker exec -it postgres psql -U <DB_USER> -c "SELECT 1;"
```

- CLOVA API 실패 → 로그에 `fallback template used` 메시지 확인
- Redis 연결 실패 → 캐시 미적용 상태로 CLOVA 직접 호출 — 비용 증가 주의
- DB 연결 실패 → 문의 저장 불가 — 즉시 롤백 또는 연결 문자열 확인

### 발표 데모 흐름 확인

1. 고객 화면(`/`)에서 문의 접수 → 제출
2. PII 마스킹 확인 — 전화번호, 이메일이 `[MASKED]` 로 표시되는지 확인
3. 대시보드(`/dashboard`)에서 새 문의 카드 등장, 긴급도 배지 색상 확인
4. 문의 상세에서 AI 초안 응답 내용 확인
5. 실시간 모니터(`/monitor`)에서 큐 수치 갱신 확인
6. 고긴급도 문의 접수 시 Telegram 알림 수신 확인

### 서버 실패 시 대체 데모 경로

| 순위 | 방법 | 비고 |
|------|------|------|
| 1 | 로컬 실행 | 발표 노트북에서 `docker-compose up -d` 사전 기동 |
| 2 | 녹화 영상 | 전체 흐름 사전 녹화 파일 노트북에 저장 |
| 3 | 스크린샷 슬라이드 | 각 화면 캡처를 발표 자료에 삽입 |
| 4 | 더미 데이터 시연 | faker 생성 샘플 데이터로 DB 사전 구성 |

---

## 6. 롤백

### 되돌릴 파일

| 상황 | 대상 파일 |
|------|-----------|
| 코드 변경 롤백 | `git checkout <이전_커밋_해시>` |
| 환경변수 문제 | `/app/.env` 수정 |
| Nginx 설정 문제 | `nginx/nginx.conf` 이전 버전 복원 |
| DB 마이그레이션 실패 | 마이그레이션 스크립트 다운그레이드 (데이터 유실 위험 — 반드시 백업 먼저) |

### 중지할 프로세스

```bash
# 운영 컨테이너 전체 중지
docker-compose -f docker-compose.prod.yml down

# 특정 서비스만 재시작
docker-compose -f docker-compose.prod.yml restart app
```

### 이전 버전 복구 방법

```bash
# 방법 A — 캐시 이미지로 롤백 (가장 빠름)
docker-compose -f docker-compose.prod.yml up -d --no-build

# 방법 B — 특정 커밋으로 소스 롤백 후 재빌드
git log --oneline -10                                         # 되돌릴 커밋 확인
git checkout <이전_커밋_해시>                                  # 코드 롤백
docker-compose -f docker-compose.prod.yml up -d --build       # 재빌드

# 롤백 후 검증
curl http://localhost:8000/health
docker ps
docker-compose -f docker-compose.prod.yml logs --tail=30 app
```

> **DB 마이그레이션이 포함된 배포를 롤백할 때는 팀원과 반드시 협의한다.**
> 스키마 변경이 수반된 경우 단순 코드 롤백만으로는 복구되지 않을 수 있다.

---

## 참고 문서

- `DEPLOY_CHECKLIST.md` — 배포 전 점검 체크리스트
- `.env.example` — 환경변수 이름 목록 (값 없음)
- `CLAUDE.md` — 프로젝트 기술 스택, 금지 행동 규칙
- `AGENTS.md` — 개발 서브 에이전트 역할 및 처리 워크플로우
