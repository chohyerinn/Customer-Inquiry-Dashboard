# TEST_QA.md
> 프로젝트 종합 검수 보고서
> 검수 기준일: 2026-06-07
> 검수 관점: security-lead · frontend-lead · ai-feature-engineer · test-lead · accessibility-lead
> 대상 파일: backend/app/main.py, backend/email_poller.py, frontend/src/** 전체

---

## 요약 스코어카드

| 관점 | 통과 | 경고 | 위험/버그 |
|------|------|------|----------|
| 🔒 보안 (security-lead) | 6 | 3 | 2 |
| 🖥 프론트엔드 (frontend-lead) | 9 | 3 | 2 |
| 🤖 AI 기능 (ai-feature-engineer) | 5 | 3 | 1 |
| 🧪 테스트 커버리지 (test-lead) | 0 | 4 | 6 |
| ♿ 접근성 (accessibility-lead) | 4 | 3 | 1 |

**발표 전 필수 수정: 3건 → ✅ 모두 수정 완료** (2026-06-07)

---

## 1. 🔒 보안 검수 (security-lead)

### 1-1. PII 탐지 패턴 커버리지

| 패턴 | 파일:라인 | 판정 | 근거 |
|------|----------|------|------|
| 이메일 | main.py:55 | ✅ 통과 | `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}` 표준 패턴 |
| 한국 휴대폰 | main.py:56 | ✅ 통과 | `01[016789]-?\d{3,4}-?\d{4}` — 010/011/016/017/018/019 커버 |
| 주문번호 | main.py:57 | ✅ 통과 | `ORDER[-_ ]?\d{2,}` — 비식별 ID 처리 |
| 계좌번호 유사 패턴 | main.py:58 | ✅ 통과 | `\b\d{2,6}-\d{2,6}-\d{2,6}\b` |
| **주민등록번호** | main.py:54-59 | ⚠️ **경고** | FUNCTION_TEST_PLAN §2-1에서 필수 패턴으로 명시했으나 코드에 없음 |
| **신용카드번호** | main.py:54-59 | ⚠️ **경고** | FUNCTION_TEST_PLAN §2-1에서 필수 패턴으로 명시했으나 코드에 없음 |

### 1-2. CLOVA API PII 보호

| 항목 | 파일:라인 | 판정 | 근거 |
|------|----------|------|------|
| PII 탐지 시 CLOVA 미호출 | main.py:382-395 | ✅ 통과 | `if has_pii → template` 분기로 원문이 CLOVA에 전달되지 않음 |
| PII 미탐지 시 원문 전달 | main.py:387 | ⚠️ **경고** | `call_clova(request.text, ...)` — PII 패턴 누락(주민번호 등) 시 원문이 CLOVA로 전송될 수 있음 |

> **권고**: `call_clova(masked_text_value, ...)` 로 항상 마스킹된 텍스트를 전달하도록 수정 권장

### 1-3. 비밀값 하드코딩

| 항목 | 파일:라인 | 판정 | 근거 |
|------|----------|------|------|
| CLOVA_API_KEY | main.py:20 | ✅ 통과 | `os.getenv("CLOVA_API_KEY", "")` 환경변수 처리 |
| TELEGRAM_BOT_TOKEN | main.py:25 | ✅ 통과 | 환경변수 처리 |
| DATABASE_URL 기본값 | main.py:15-17 | ⚠️ **경고** | 기본값에 `ai_user:ai_password` 평문 포함 — 프로덕션 배포 시 반드시 환경변수 덮어쓰기 필요 |
| 어드민 비밀번호 | App.jsx:33 | ⚠️ **경고** | `const ADMIN_PW = '1234'` 소스코드에 하드코딩 — 데모용이나 발표 화면에 코드 노출 주의 |
| **실제 이메일 주소** | customer.jsx:65 | 🚨 **위험** | `mailto:[실명 이메일]` — 실명 이메일이 프론트엔드 소스에 하드코딩됨. 발표 화면·GitHub 공개 시 노출 |

### 1-4. 더미 데이터 PII 안전성

| 항목 | 파일:라인 | 판정 | 근거 |
|------|----------|------|------|
| 이름 마스킹 | data.js:25-80 | ✅ 통과 | 홍**, 이**, 박** 형식 일관 적용 |
| 이메일 마스킹 | data.js:25-80 | ✅ 통과 | `hong***@example.com` 형식, 실제 도메인 없음 |
| 전화번호 마스킹 | data.js:25-80 | ✅ 통과 | `010-****-7781` 형식, 중간 4자리 마스킹 |
| 주석 선언 | data.js:1-2 | ✅ 통과 | "실제 개인정보/금융정보/키 없음" 명시 |

---

## 2. 🖥 프론트엔드 검수 (frontend-lead)

### 2-1. API 연동 완성도

| 함수 | 파일:라인 | 판정 | 근거 |
|------|----------|------|------|
| `submitTicket` | api.js:3-12 | ✅ 구현완료 | `POST /api/tickets`, abort signal, 에러 throw |
| `fetchTickets` | api.js:14-18 | ✅ 구현완료 | `GET /api/tickets`, HTTP 에러 처리 |
| `sendResponse` | api.js:43-51 | ✅ 구현완료 | `POST /api/tickets/:id/send-response` 연결됨 |
| `checkHealth` | api.js:20-27 | ✅ 구현완료 | `/api/health` 호출, 예외 시 false 반환 |
| **`sendTelegramMessage`** | api.js:29-41 | 🚨 **버그** | `POST /api/telegram/send` 호출하지만 backend에 이 엔드포인트가 없음 — 항상 실패 |

### 2-2. 화면 구현 현황

| 경로 | 컴포넌트 | 판정 | 비고 |
|------|---------|------|------|
| `/` | CustomerForm | ✅ 구현완료 | 폼 유효성 검사, 오류 배너, 파일 첨부 포함 |
| Processing | Processing | ✅ 구현완료 | 3단계 애니메이션 + API 병렬 호출 + 완료 자동 전환 |
| Result | Result | ✅ 구현완료 | API 결과 + 데모 폴백 모두 처리 |
| `/empty` | CustomerHome | ✅ 구현완료 | 빈 상태 + 문의 목록 표시 |
| `/dashboard` | Dashboard | ✅ 구현완료 | 30초 자동 갱신, 데모 폴백, 필터 |
| `/inquiry` | InquiryDetail | ✅ 구현완료 | 응답 편집·발송, 완료 상태 처리 |
| `/monitor` | Monitor | ⚠️ 부분구현 | SLA 타이머 동작하나 WebSocket 없음 — demo 데이터 고정 |
| `/admin/counselors` | CounselorsAdmin | ✅ 구현완료 | 온/오프라인 토글, 카테고리, 수용 한도 설정 |
| `/clova-error` | Dashboard (오류 상태) | ✅ 구현완료 | clovaStatus="오류" prop으로 CLOVA 장애 시나리오 시연 가능 |

### 2-3. 비동작 버튼 (핸들러 없음)

| 버튼 | 파일:라인 | 판정 | 근거 |
|------|----------|------|------|
| "AI 다시 생성" | staff.jsx:283 | 🚨 **버그** | `onClick` 핸들러 없음 — 클릭해도 아무 동작 없음 |
| "템플릿 불러오기" | staff.jsx:284 | ⚠️ **경고** | `onClick` 핸들러 없음 — 비기능 상태 |
| TelegramModal "발송" | staff.jsx:527 | ⚠️ **경고** | `setTimeout(1300)` 모의 발송만 수행 — 실제 API 미연결 |

### 2-4. 폴백 동작

| 항목 | 파일:라인 | 판정 | 근거 |
|------|----------|------|------|
| 대시보드 API 실패 시 | staff.jsx:58-64 | ✅ 구현완료 | `DEMO.INQUIRIES`로 대체 + "데모 데이터" 배지 표시 |
| 폼 제출 API 실패 시 | customer.jsx:248 | ✅ 구현완료 | `isDemo` 플래그로 구분, 입력값 보존 |
| 자동 갱신 실패 시 | staff.jsx:73-78 | ✅ 구현완료 | `.catch(() => {})` — 조용히 무시, UI 유지 |

---

## 3. 🤖 AI 기능 검수 (ai-feature-engineer)

### 3-1. CLOVA API 호출 구조

| 항목 | 파일:라인 | 판정 | 근거 |
|------|----------|------|------|
| 모델 ID | main.py:22 | ✅ 적절 | HCX-003 명시 |
| maxTokens: 200 | main.py:130 | ✅ 적절 | 2~3문장 초안에 충분한 토큰 |
| temperature: 0.5 | main.py:131 | ✅ 적절 | 창의성과 일관성 균형 |
| 타임아웃 10초 | main.py:133 | ✅ 적절 | UX 저하 없이 응답 대기 가능 |
| 프롬프트 구조 | main.py:112-117 | ✅ 적절 | category, urgency 컨텍스트 포함, 한국어 지정 |
| **응답 파싱 경로** | main.py:134 | ⚠️ **주의** | `resp.json()["result"]["message"]["content"]` — HCX-003 실제 응답 스펙과 일치 여부 서버 실행 시 반드시 검증 필요 |

### 3-2. Circuit Breaker 로직

| 항목 | 파일:라인 | 판정 | 근거 |
|------|----------|------|------|
| CLOSED → OPEN 전환 | main.py:98-103 | ✅ 적절 | 3회 실패 시 OPEN으로 전환 |
| OPEN → HALF-OPEN 전환 | main.py:89-91 | ✅ 적절 | 60초 쿨다운 후 HALF-OPEN |
| HALF-OPEN → CLOSED 복구 | main.py:94-97 | ✅ 적절 | 성공 시 failures=0, CLOSED |
| OPEN 상태 호출 차단 | main.py:108-109 | ✅ 적절 | `(None, 0)` 즉시 반환 → 폴백 분기 |

### 3-3. 폴백 템플릿 및 비용 추적

| 항목 | 파일:라인 | 판정 | 근거 |
|------|----------|------|------|
| has_pii 폴백 | main.py:270-271 | ✅ 적절 | "개인정보가 포함되어 상담원이 직접 검토" 문구 |
| HIGH urgency 폴백 | main.py:272-273 | ✅ 적절 | "긴급 건으로 접수, 우선 확인" 문구 |
| 기본 폴백 | main.py:274 | ✅ 적절 | 표준 접수 안내 문구 |
| 카테고리별 다른 템플릿 | main.py:269-274 | ⚠️ **주의** | category 파라미터를 받으나 f-string에 단순 삽입만 함 — 카테고리별 특화 문구 없음 |
| **일일 한도 자동 차단** | main.py:296-300 | 🚨 **문제** | `COST_ALERT_THRESHOLD` 초과 시 Telegram 알림만 발송, CLOVA 호출 자동 차단 없음 — FUNCTION_TEST_PLAN §4-3에서 "자동 폴백 전환" 기대하나 미구현 |
| 비용 단위 고정값 | main.py:23 | ⚠️ **주의** | `CLOVA_COST_PER_CALL=10` 고정 — 실제 토큰 기반 과금과 다름 (데모 허용) |

---

## 4. 🧪 테스트 커버리지 (test-lead)

### 4-1. 테스트 파일 현황

| 항목 | 판정 |
|------|------|
| Python 테스트 파일 (`test_*.py`, `*_test.py`) | ❌ **없음** |
| JavaScript 테스트 파일 (`*.test.js`, `*.spec.jsx`) | ❌ **없음** |
| FUNCTION_TEST_PLAN.md 계획 문서 | ✅ 존재 (6기능 × 4시나리오) |
| 실제 실행된 테스트 결과 | ❌ **없음** |

### 4-2. FUNCTION_TEST_PLAN vs 실제 구현 차이

| 테스트 항목 | 계획 | 실제 구현 | 상태 |
|------------|------|----------|------|
| 주민등록번호 PII 탐지 | §2-1 | main.py:54-59에 패턴 없음 | ❌ 미구현 |
| 신용카드번호 PII 탐지 | §2-1 | main.py:54-59에 패턴 없음 | ❌ 미구현 |
| Redis 캐시 히트 경로 | §4-2 | main.py에 Redis 코드 없음 | ❌ 미구현 |
| 일일 한도 초과 자동 폴백 | §4-3 | 알림만 발송, 차단 없음 | ❌ 미구현 |
| WebSocket 실시간 업데이트 | §6-1 | 30초 폴링으로 대체됨 | ⚠️ 방식 변경 |
| Gmail 중복 message-ID 방지 | §1-5 | email_poller에 `\Seen` 플래그만, source_id dedup 미확인 | ⚠️ 확인 필요 |

### 4-3. 수동 확인 가능 시나리오 (발표 전 필수)

| 시나리오 | 방법 | 우선순위 |
|---------|------|---------|
| 웹폼 제출 → PII 마스킹 → AI 초안 → 대시보드 반영 | 브라우저 직접 실행 | 🔴 발표전필수 |
| CLOVA 오류 시 템플릿 폴백 | `/clova-error` 경로 접근 | 🔴 발표전필수 |
| Telegram 알림 수신 (HIGH 문의 시) | 실제 봇 채널 확인 | 🔴 발표전필수 |
| 대시보드 30초 자동 갱신 | 두 탭에서 동시 확인 | 🟡 권장 |
| 상담원 배정 큐별 분류 | HIGH/PII 있는 문의 제출 | 🟡 권장 |
| 이메일 IMAP 수집 | Gmail 수신함 테스트 메일 | 🟡 권장 |
| Circuit Breaker OPEN 상태 | CLOVA_API_KEY 잘못된 값으로 3회 호출 | 🟡 권장 |
| `/health` 엔드포인트 응답 | `curl http://localhost:8000/health` | 🟢 선택 |

### 4-4. 엔드포인트별 테스트 가능성

| 엔드포인트 | 테스트 방법 | 상태 |
|-----------|-----------|------|
| `POST /tickets` (PII 없음) | curl / 웹폼 | 수동확인가능 |
| `POST /tickets` (PII 있음) | curl with `010-1234-5678` | 수동확인가능 |
| `GET /tickets` | 브라우저 / curl | 수동확인가능 |
| `GET /stats` | curl | 수동확인가능 |
| `GET /health` | curl | 수동확인가능 |
| CLOVA 폴백 경로 | API 키 임시 무효화 | 수동확인가능 |
| CB OPEN 상태 | 반복 실패 유발 | 수동확인가능 |
| `POST /email/sync` | curl | 수동확인가능 |
| **`POST /api/telegram/send`** | — | ❌ 엔드포인트 없음 |

---

## 5. ♿ 접근성 검수 (accessibility-lead)

### 5-1. 색상 외 정보 전달 (WCAG 1.4.1)

| 항목 | 파일:라인 | 판정 | 근거 |
|------|----------|------|------|
| 긴급도 배지 텍스트 레이블 | data.js:11-15, staff.jsx | ✅ 통과 | 빨강/노랑/초록 색상 + "높음"/"보통"/"낮음" 텍스트 병기 |
| 처리상태 배지 | staff.jsx:196 | ✅ 통과 | 색상 + "AI초안"/"확인필요"/"응답완료" 레이블 |
| CLOVA 연결 상태 | staff.jsx:136-140 | ✅ 통과 | 색상 dot + "정상"/"오류"/"지연" 텍스트 |

### 5-2. 키보드 접근성 (WCAG 2.1.1)

| 항목 | 파일:라인 | 판정 | 기준 | 근거 |
|------|----------|------|------|------|
| 포커스 링 전역 설정 | styles.css:73 | ✅ 통과 | 2.1.1 | `:focus-visible { outline:2px solid var(--blue); }` 적용 |
| 폼 필드 키보드 지원 | customer.jsx:118-166 | ✅ 통과 | 2.1.1 | 표준 HTML input/textarea/select 사용 |
| **테이블 행 클릭** | staff.jsx:189-200 | ⚠️ **경고** | 2.1.1 | `<tr onClick>` 에 `role="button"`, `tabIndex`, `onKeyDown` 없어 키보드로 접근 불가 |
| **어드민 비밀번호 모달** | App.jsx:57 | ✅ 통과 | 2.1.1 | `onKeyDown Enter` 처리 있음 |

### 5-3. aria 속성 (WCAG 4.1.2)

| 항목 | 파일:라인 | 판정 | 기준 | 근거 |
|------|----------|------|------|------|
| 오류 배너 role="alert" | customer.jsx:101 | ✅ 통과 | 4.1.3 | `role="alert"` 적용됨 |
| **모달 aria 속성** | staff.jsx:476-509 | ⚠️ **경고** | 4.1.2 | `aria-modal="true"`, `aria-labelledby` 없음 — 스크린 리더 모달 인식 불가 |
| **실시간 갱신 영역** | staff.jsx:302-370 | ⚠️ **경고** | 4.1.3 | Monitor 컴포넌트 큐/SLA 갱신 영역에 `aria-live="polite"` 없음 |

### 5-4. 명도 대비 (WCAG 1.4.3)

| 색상 조합 | 사용처 | 대비비 (추정) | 판정 | 기준 |
|---------|--------|-------------|------|------|
| `--ink #111827` / `#ffffff` | 제목, 본문 | ~17:1 | ✅ 통과 | AA 기준 4.5:1 |
| `--body #374151` / `#ffffff` | 일반 텍스트 | ~10:1 | ✅ 통과 | AA 기준 4.5:1 |
| `--muted #6B7280` / `#ffffff` | 보조 텍스트 | ~4.7:1 | ✅ 통과 | 간신히 통과 |
| **`--faint #9CA3AF` / `#ffffff`** | `.t-cap` 소자 텍스트 | ~2.9:1 | 🚨 **위반** | WCAG 1.4.3 — 4.5:1 미달. 시각 12px 크기에서 기준 미충족 |

---

## 발표 전 필수 수정 3건 — ✅ 완료

| # | 항목 | 파일:라인 | 심각도 | 수정 내용 |
|---|------|----------|--------|---------|
| 1 | 실제 이메일 하드코딩 | customer.jsx:65 | ✅ 수정완료 | `[실명 이메일]` → `support@example.com` |
| 2 | `/api/telegram/send` 미존재 | main.py, api.js:29-41 | ✅ 수정완료 | `POST /telegram/send` + `POST /tickets/{id}/send-response` 엔드포인트 추가 |
| 3 | "AI 다시 생성" 비동작 버튼 | staff.jsx:283-285 | ✅ 수정완료 | "AI 다시 생성", "템플릿 불러오기" 버튼 `disabled` 처리 |

## 권장 수정 — ✅ 완료 / ⬜ 잔여

| 항목 | 파일:라인 | 상태 |
|------|----------|------|
| 주민번호·신용카드 PII 패턴 추가 | main.py:54-59 | ✅ `resident_id`, `credit_card` 패턴 추가 |
| CLOVA 호출 시 항상 masked_text 전달 | main.py:387 | ✅ `call_clova(masked, ...)` 로 수정 |
| 테이블 행 키보드 접근성 | staff.jsx:189-200 | ✅ `role`, `tabIndex`, `onKeyDown` 추가 |
| `.t-cap` 색상 대비 개선 | styles.css:68 | ✅ `--faint` → `--muted` (4.7:1 이상 확보) |
| ResponsePreviewModal aria 속성 | staff.jsx:479 | ✅ `role="dialog"`, `aria-modal`, `aria-labelledby` 추가 |
| 일일 한도 초과 시 자동 폴백 | main.py | ✅ `is_daily_limit_exceeded()` 추가, `create_ticket()`에서 CLOVA 호출 전 체크 → `elif` 분기로 자동 템플릿 전환 |
| TelegramModal 등 나머지 모달 aria | staff.jsx 모달 전체 | ✅ TelegramModal, AddCounselorModal, SettingsCounselorModal, HistoryCounselorModal 모두 `role="dialog"`, `aria-modal`, `aria-labelledby` 추가 |
| Redis 캐시 구현 | main.py | ✅ `REDIS_URL` 환경변수, `_redis` 클라이언트 초기화, `call_clova()` 앞뒤에 캐시 조회/저장 추가 (연결 실패 시 graceful 폴백) |
