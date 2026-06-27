# DEPLOY_CHECKLIST.md
# 배포 점검 체크리스트 — Customer Inquiry Management System

> 실제 서버 IP, 비밀번호, API 키, 개인키 내용은 이 파일에 기록하지 않는다.
> 민감한 값은 환경변수 또는 별도 비밀 관리 도구로 관리한다.

---

## 1. Ncloud Server 실행 상태 확인

- [ ] Ncloud 콘솔에서 서버 인스턴스 상태가 **Running** 인지 확인
- [ ] 서버 CPU / 메모리 사용률이 정상 범위인지 확인 (콘솔 모니터링 탭)
- [ ] 서버 디스크 잔여 공간 확인 (`df -h`)
- [ ] Docker 데몬이 실행 중인지 확인 (`docker ps`)

---

## 2. SSH 접속 계정 확인

- [ ] SSH 접속 계정명 확인 (예: `ubuntu`) — 실제 값은 SERVER_RUNBOOK.md 참조
- [ ] SSH 키 파일 경로 확인 (예: `~/.ssh/ncloud_key.pem`) — 키 내용은 기록 금지
- [ ] 키 파일 권한이 `600` 인지 확인 (`chmod 600 ~/.ssh/ncloud_key.pem`)
- [ ] 접속 테스트: `ssh -i <키파일경로> <계정명>@<서버IP>` — IP는 환경변수 또는 Runbook 참조
- [ ] 접속 실패 시 ACG SSH 포트(22) 허용 여부 재확인 (아래 3번 참조)

---

## 3. ACG(방화벽) 포트 확인

| 포트 | 용도 | 인바운드 허용 대상 |
|------|------|--------------------|
| 22 | SSH 접속 | 관리자 IP 또는 허용 CIDR |
| 8000 | FastAPI 백엔드 | 앱 서버 내부 / Nginx |
| 5173 | Vite 개발 서버 (로컬 전용) | 로컬만 — 프로덕션 불필요 |
| 80 / 443 | Nginx 리버스 프록시 | 전체 허용 (퍼블릭 서비스) |
| 5432 | PostgreSQL | 앱 서버 프라이빗 IP만 허용 |
| 6379 | Redis | 앱 서버 프라이빗 IP만 허용 |

- [ ] SSH(22) 포트 — 현재 접속 IP가 ACG에 허용되어 있는지 확인
- [ ] 앱 포트(8000 또는 80) — 외부에서 접근 가능한지 확인
- [ ] DB / Redis 포트 — 퍼블릭 인터넷에서 **직접 접근 불가** 상태인지 확인
- [ ] Ncloud 콘솔 → VPC → ACG 메뉴에서 인바운드 규칙 목록 스크린샷 저장 (데모 증거용)

---

## 4. 프로젝트 원격 폴더 확인

- [ ] 프로젝트 배포 경로 확인 — 실제 경로는 SERVER_RUNBOOK.md 참조 (예: `/app`)
- [ ] `git log --oneline -5` 로 최신 커밋이 반영되어 있는지 확인
- [ ] `git status` — 예상치 못한 로컬 변경사항이 없는지 확인
- [ ] `docker-compose -f docker-compose.prod.yml ps` — 모든 컨테이너가 `Up` 상태인지 확인

---

## 5. 필요한 환경변수 이름 확인

아래 환경변수가 서버의 `.env` 또는 시스템 환경에 **값이 설정되어 있는지** 확인한다.
실제 값은 이 파일에 기록하지 않는다.

| 환경변수 이름 | 용도 |
|---------------|------|
| `CLOVA_API_KEY` | CLOVA Studio HyperCLOVA X 인증 |
| `CLOVA_API_HOST` | CLOVA Studio API 엔드포인트 |
| `TELEGRAM_BOT_TOKEN` | Telegram 봇 알림 발송 |
| `TELEGRAM_CHAT_ID` | 알림을 받을 Telegram 채널/그룹 ID |
| `GMAIL_USER` | Gmail IMAP 수신 계정 |
| `GMAIL_APP_PASSWORD` | Gmail 앱 비밀번호 (2FA용) |
| `DATABASE_URL` | PostgreSQL 연결 문자열 (비밀번호 포함 — 환경변수만) |
| `REDIS_URL` | Redis 연결 문자열 |
| `SECRET_KEY` | FastAPI 세션/JWT 서명 키 |

- [ ] 서버에서 `printenv | grep -E "CLOVA|TELEGRAM|GMAIL|DATABASE|REDIS|SECRET"` 로 변수 존재 확인 (값 출력 주의)
- [ ] `.env.example` 파일과 실제 설정된 변수 이름이 일치하는지 대조

---

## 6. 로컬 실행 확인 방법

```bash
# 1. 인프라 서비스 기동
docker-compose up -d

# 2. 백엔드 실행 (포트 8000)
uvicorn app.main:app --reload

# 3. 프론트엔드 실행 (포트 5173)
npm run dev

# 4. 헬스체크
curl http://localhost:8000/health

# 5. 브라우저 확인
# http://localhost:5173/           — 문의 접수 폼 (고객)
# http://localhost:5173/dashboard  — 문의 목록 (상담사)
# http://localhost:5173/monitor    — 실시간 모니터링 (관리자)
```

- [ ] 백엔드 헬스체크 응답이 `200 OK` 인지 확인
- [ ] 프론트엔드 `/` 화면이 오류 없이 로드되는지 확인
- [ ] 문의 접수 → PII 마스킹 → 분류 → AI 초안 생성 전체 흐름이 로컬에서 동작하는지 확인
- [ ] CLOVA 응답 실패 시 템플릿 폴백이 정상 작동하는지 확인

---

## 7. 서버 실행 확인 방법

```bash
# 서버 SSH 접속 후
docker ps                                          # 모든 컨테이너 Up 확인
curl http://localhost:8000/health                  # 백엔드 헬스체크
docker-compose -f docker-compose.prod.yml logs --tail=50 app   # 최근 로그 확인

# 외부에서 (로컬 머신 또는 브라우저)
curl http://<서버IP>/health                        # Nginx 통해 백엔드 응답 확인
```

- [ ] 모든 Docker 컨테이너가 `Up` 상태이고 재시작(`Restarting`) 루프가 없는지 확인
- [ ] 백엔드 `/health` 엔드포인트 응답 `200 OK` 확인
- [ ] 프론트엔드 페이지가 브라우저에서 정상 로드되는지 확인
- [ ] WebSocket 연결 (`/monitor`) 실시간 업데이트 동작 확인
- [ ] DB 연결 확인 — 문의 목록이 `/dashboard` 에 표시되는지 확인

---

## 8. 실패 시 롤백

```bash
# 이전 Docker 이미지로 롤백 (빌드 없이 캐시 이미지 사용)
docker-compose up -d --no-build

# 특정 커밋으로 소스 되돌리기
git log --oneline -10                    # 돌아갈 커밋 해시 확인
git checkout <이전_커밋_해시>            # 코드 되돌리기
docker-compose -f docker-compose.prod.yml up -d --build  # 재빌드

# 롤백 후 확인
curl http://localhost:8000/health
docker ps
```

- [ ] 롤백 전 현재 상태 로그를 저장해 두었는지 확인 (`docker logs > rollback_before.log`)
- [ ] 롤백 후 헬스체크 재실행
- [ ] DB 마이그레이션이 수반된 경우 — DB 스키마 롤백 여부 별도 검토 (위험: 데이터 유실 가능)
- [ ] 롤백 완료 후 팀에 상황 공유

> 전체 롤백 절차는 **SERVER_RUNBOOK.md** 에 상세 기록한다.

---

## 9. 서버 반영 실패 시 대체 데모 경로

서버 배포에 실패하더라도 아래 순서로 데모를 진행할 수 있다.

| 우선순위 | 방법 | 준비 사항 |
|----------|------|-----------|
| 1순위 | **로컬 실행** | `docker-compose up -d` + `uvicorn` + `npm run dev` 로컬 기동; 발표 노트북에서 사전 확인 |
| 2순위 | **녹화 영상** | 전체 흐름(문의 접수 → 분류 → AI 초안 → 대시보드 갱신)을 사전 녹화; OBS 또는 화면 캡처 도구 사용 |
| 3순위 | **스크린샷 슬라이드** | 각 화면의 완성된 스크린샷을 발표 자료에 삽입; 흐름 설명은 구두로 |
| 4순위 | **더미 데이터 시연** | DB에 사전 삽입된 샘플 문의 데이터로 `/dashboard` 및 `/monitor` 시각 시연; faker 생성 데이터 사용 |

- [ ] 로컬 실행이 발표 당일 네트워크 없이도 가능한지 확인 (오프라인 Docker 이미지 준비)
- [ ] 녹화 영상 파일을 발표 노트북에 로컬 저장 완료
- [ ] 스크린샷이 최신 UI 상태를 반영하는지 확인
- [ ] 더미 데이터에 실제 PII(이름, 전화, 이메일)가 포함되어 있지 않은지 확인 (faker 데이터만 사용)

---

## 10. 발표 데모 전 최종 확인 5가지

> 발표 30분 전 이 5가지를 순서대로 확인한다.

| # | 확인 항목 | 통과 기준 |
|---|-----------|-----------|
| 1 | **전체 흐름 한 번 돌리기** | 문의 접수 → PII 마스킹 → 분류 → AI 초안 생성 → 상담사 배정 → 대시보드 갱신이 오류 없이 완료 |
| 2 | **환경변수 로드 확인** | `CLOVA_API_KEY`, `TELEGRAM_BOT_TOKEN` 등 필수 변수가 서버(또는 로컬)에 설정되어 있음 |
| 3 | **실시간 대시보드 WebSocket** | `/monitor` 화면에서 새 문의 접수 시 대기열 수치가 실시간으로 갱신됨 |
| 4 | **CLOVA 폴백 경로** | CLOVA API 키를 임시로 잘못 된 값으로 교체해도 템플릿 응답이 반환되고 사용자 오류 없음 (확인 후 키 원복) |
| 5 | **대체 데모 준비** | 녹화 영상 또는 스크린샷 슬라이드가 발표 노트북에 저장되어 있고 즉시 열 수 있음 |

---

## 참고 문서

- `SERVER_RUNBOOK.md` — 서버 상세 접속 정보, 배포 절차, 롤백 절차
- `.env.example` — 필요한 환경변수 이름 목록 (값 없음)
- `CLAUDE.md` — 프로젝트 전체 기술 스택 및 금지 행동 규칙
- `AGENTS.md` — 개발 서브 에이전트 역할 및 처리 워크플로우
