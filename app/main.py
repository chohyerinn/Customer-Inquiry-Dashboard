import os
import re
import time
from typing import List

import httpx
import psycopg2
import redis
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pydantic import BaseModel


app = FastAPI(title="AI CS Routing System")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://ai_user:ai_password@postgres:5432/ai_cs",
)

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
CACHE_TTL = int(os.getenv("CACHE_TTL", "86400"))  # 응답 캐시 24시간

CLOVA_API_KEY = os.getenv("CLOVA_API_KEY", "")
CLOVA_URL = "https://clovastudio.stream.ntruss.com/testapp/v1/chat-completions/HCX-003"
CLOVA_COST_PER_CALL = int(os.getenv("CLOVA_COST_PER_CALL", "10"))
COST_ALERT_THRESHOLD = int(os.getenv("COST_ALERT_THRESHOLD", "1000"))

# Redis 클라이언트 — 연결 실패해도 앱이 죽지 않도록 모든 호출은 try/except로 감쌈
try:
    _redis = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=3)
except Exception:
    _redis = None


def cache_get(category: str):
    """카테고리 기반 응답 캐시 조회. 히트 시 draft 문자열, 미스/오류 시 None."""
    if _redis is None:
        return None
    try:
        return _redis.get(f"cache:{category}")
    except Exception:
        return None


def cache_set(category: str, draft: str):
    if _redis is None:
        return
    try:
        _redis.setex(f"cache:{category}", CACHE_TTL, draft)
    except Exception:
        pass


def redis_cost_incr(today: str, cost: int):
    """실시간 비용 카운터 (PostgreSQL cost_daily가 소스오브트루스, Redis는 실시간 집계용)."""
    if _redis is None:
        return
    try:
        _redis.incr(f"cost:count:{today}")
        _redis.incrby(f"cost:krw:{today}", cost)
    except Exception:
        pass

TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")


class TicketRequest(BaseModel):
    channel: str = "web"
    text: str
    source_id: str | None = None


class TicketResponse(BaseModel):
    id: int
    channel: str
    has_pii: bool
    masked_text: str
    category: str
    urgency: str
    backend: str
    review_required: bool
    draft: str
    pii_types: List[str]
    agent_queue: str
    created_at: str


PII_PATTERNS = {
    "email": r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
    "phone": r"01[016789]-?\d{3,4}-?\d{4}",
    "order_id": r"(?i)ORDER[-_ ]?\d{2,}(?:[-_]\d{2,})*",
    "account": r"\b\d{2,6}-\d{2,6}-\d{2,6}\b",
}

HIGH_KEYWORDS = [
    "법적", "소송", "고발", "변호사", "법원", "고소", "내용증명",
    "소비자원", "공정위", "금감원", "신고", "민원 제기",
    "절대", "용납", "참을 수 없", "끝까지", "책임지",
]

MEDIUM_KEYWORDS = [
    "불만", "항의", "따지", "실망", "해결 안 됨", "몇 번이나", "또 문제",
    "환불", "취소", "반품",
]

CATEGORY_KEYWORDS = {
    "배송": ["배송", "택배", "도착", "언제 오", "출고"],
    "환불": ["환불", "취소", "반품", "교환"],
    "클레임": ["불만", "항의", "법적", "소송", "고발", "신고", "실망"],
    "계정": ["로그인", "비밀번호", "계정", "회원"],
}

_cb = {
    "failures": 0,
    "opened_at": 0.0,
    "state": "CLOSED",
}
CB_THRESHOLD = 3
CB_COOLDOWN = 60.0


def cb_state() -> str:
    if _cb["state"] == "OPEN":
        if time.time() - _cb["opened_at"] > CB_COOLDOWN:
            _cb["state"] = "HALF-OPEN"
    return _cb["state"]


def cb_success():
    _cb["failures"] = 0
    _cb["state"] = "CLOSED"


def cb_failure():
    _cb["failures"] += 1
    if _cb["failures"] >= CB_THRESHOLD:
        _cb["state"] = "OPEN"
        _cb["opened_at"] = time.time()


def call_clova(text: str, category: str, urgency: str):
    if cb_state() == "OPEN":
        return None, 0

    prompt = (
        f"당신은 고객 상담 전문가입니다. 아래 고객 문의에 대해 친절하고 전문적인 응답 초안을 한국어로 작성하세요.\n"
        f"카테고리: {category}, 긴급도: {urgency}\n"
        f"고객 문의: {text}\n"
        f"응답 초안 (2~3문장):"
    )

    start = time.time()
    try:
        resp = httpx.post(
            CLOVA_URL,
            headers={
                "Authorization": f"Bearer {CLOVA_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "messages": [{"role": "user", "content": prompt}],
                "maxTokens": 200,
                "temperature": 0.5,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        content = resp.json()["result"]["message"]["content"].strip()
        latency_ms = int((time.time() - start) * 1000)
        cb_success()
        return content, latency_ms
    except Exception:
        cb_failure()
        return None, 0


def assign_queue(urgency: str, has_pii: bool) -> str:
    if urgency == "HIGH":
        return "senior"
    if has_pii:
        return "dedicated"
    if urgency == "MEDIUM":
        return "general-priority"
    return "general"


def send_telegram(message: str) -> None:
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        httpx.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": message},
            timeout=5.0,
        )
    except Exception:
        pass


def get_db():
    return psycopg2.connect(DATABASE_URL)


def init_db():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS tickets (
                    id SERIAL PRIMARY KEY,
                    channel TEXT NOT NULL,
                    raw_text TEXT,
                    masked_text TEXT NOT NULL,
                    category TEXT NOT NULL,
                    urgency TEXT NOT NULL,
                    backend TEXT NOT NULL,
                    has_pii BOOLEAN NOT NULL,
                    review_required BOOLEAN NOT NULL,
                    draft TEXT NOT NULL,
                    pii_types TEXT NOT NULL,
                    agent_queue TEXT NOT NULL DEFAULT 'general',
                    source_id TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source_id TEXT")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS assignments (
                    id SERIAL PRIMARY KEY,
                    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
                    agent_queue TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    assigned_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS responses (
                    id SERIAL PRIMARY KEY,
                    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
                    draft_text TEXT NOT NULL,
                    backend_used TEXT NOT NULL,
                    cost_krw INTEGER NOT NULL DEFAULT 0,
                    latency_ms INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS pii_logs (
                    id SERIAL PRIMARY KEY,
                    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
                    channel TEXT NOT NULL,
                    pii_types TEXT NOT NULL,
                    detected_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS cost_daily (
                    id SERIAL PRIMARY KEY,
                    date DATE NOT NULL DEFAULT CURRENT_DATE,
                    backend TEXT NOT NULL,
                    call_count INTEGER NOT NULL DEFAULT 0,
                    total_cost_krw INTEGER NOT NULL DEFAULT 0,
                    last_synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    UNIQUE(date, backend)
                )
            """)


@app.on_event("startup")
def startup():
    init_db()


def detect_pii(text: str) -> List[str]:
    detected = []
    for pii_type, pattern in PII_PATTERNS.items():
        if re.search(pattern, text):
            detected.append(pii_type)
    return detected


def mask_text(text: str) -> str:
    masked = text
    for pii_type, pattern in PII_PATTERNS.items():
        masked = re.sub(pattern, f"[{pii_type.upper()}]", masked)
    return masked


def classify_category(text: str) -> str:
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            return category
    return "일반"


def classify_urgency(text: str) -> str:
    if any(keyword in text for keyword in HIGH_KEYWORDS):
        return "HIGH"
    if any(keyword in text for keyword in MEDIUM_KEYWORDS):
        return "MEDIUM"
    return "LOW"


def build_template_draft(category: str, has_pii: bool, urgency: str) -> str:
    if has_pii:
        return f"{category} 문의를 접수했습니다. 개인정보가 포함되어 상담원이 직접 검토 후 안내드리겠습니다."
    if urgency == "HIGH":
        return f"{category} 문의를 긴급 건으로 접수했습니다. 담당자가 우선 확인 후 신속히 안내드리겠습니다."
    return f"{category} 문의를 접수했습니다. 상담원이 확인 후 안내드리겠습니다."


def record_cost(conn, ticket_id: int, backend: str, draft: str, cost: int, latency_ms: int):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO responses (ticket_id, draft_text, backend_used, cost_krw, latency_ms)
            VALUES (%s, %s, %s, %s, %s)
        """, (ticket_id, draft, backend, cost, latency_ms))

        if cost > 0:
            cur.execute("""
                INSERT INTO cost_daily (date, backend, call_count, total_cost_krw, last_synced_at)
                VALUES (CURRENT_DATE, %s, 1, %s, NOW())
                ON CONFLICT (date, backend) DO UPDATE
                SET call_count = cost_daily.call_count + 1,
                    total_cost_krw = cost_daily.total_cost_krw + EXCLUDED.total_cost_krw,
                    last_synced_at = NOW()
            """, (backend, cost))

            cur.execute("""
                SELECT total_cost_krw FROM cost_daily
                WHERE date = CURRENT_DATE AND backend = %s
            """, (backend,))
            row = cur.fetchone()
            if row and row[0] >= COST_ALERT_THRESHOLD:
                send_telegram(f"💰 [비용 알림] CLOVA 호출 오늘 누적 ₩{row[0]} — 임계치(₩{COST_ALERT_THRESHOLD}) 초과")


def save_ticket(
    request: TicketRequest,
    has_pii: bool,
    masked_text_value: str,
    category: str,
    urgency: str,
    backend: str,
    review_required: bool,
    draft: str,
    pii_types: List[str],
    agent_queue: str,
    cost: int,
    latency_ms: int,
) -> TicketResponse:
    raw_text = None if has_pii else request.text
    pii_types_text = ",".join(pii_types)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO tickets (
                    channel, raw_text, masked_text, category, urgency,
                    backend, has_pii, review_required, draft, pii_types, agent_queue, source_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, created_at
            """, (
                request.channel, raw_text, masked_text_value, category, urgency,
                backend, has_pii, review_required, draft, pii_types_text, agent_queue,
                request.source_id,
            ))
            ticket_id, created_at = cur.fetchone()

            cur.execute("""
                INSERT INTO assignments (ticket_id, agent_queue, reason)
                VALUES (%s, %s, %s)
            """, (ticket_id, agent_queue, f"urgency={urgency}, has_pii={has_pii}"))

            if has_pii and pii_types:
                cur.execute("""
                    INSERT INTO pii_logs (ticket_id, channel, pii_types)
                    VALUES (%s, %s, %s)
                """, (ticket_id, request.channel, pii_types_text))

        record_cost(conn, ticket_id, backend, draft, cost, latency_ms)

    return TicketResponse(
        id=ticket_id,
        channel=request.channel,
        has_pii=has_pii,
        masked_text=masked_text_value,
        category=category,
        urgency=urgency,
        backend=backend,
        review_required=review_required,
        draft=draft,
        pii_types=pii_types,
        agent_queue=agent_queue,
        created_at=created_at.isoformat(),
    )


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-cs-routing", "circuit_breaker": cb_state()}


@app.post("/tickets", response_model=TicketResponse)
def create_ticket(request: TicketRequest):
    pii_types = detect_pii(request.text)
    has_pii = len(pii_types) > 0
    masked = mask_text(request.text) if has_pii else request.text
    category = classify_category(request.text)
    urgency = classify_urgency(request.text)
    review_required = has_pii or urgency == "HIGH"
    agent_queue = assign_queue(urgency, has_pii)
    cost = 0
    latency_ms = 0

    if has_pii:
        backend = "template"
        draft = build_template_draft(category, has_pii, urgency)
        send_telegram(f"🔒 [PII 감지] {request.channel} 채널 {','.join(pii_types)} 탐지 → 외부 차단 / 검토 필수")
    else:
        # 긴급(HIGH) 문의는 캐시 사용 안 함 (전문 대응 필요) → 그 외에는 캐시 우선 조회
        cached = cache_get(category) if urgency != "HIGH" else None
        if cached:
            backend = "cache"
            draft = cached  # CLOVA 미호출 → 비용 ₩0
        else:
            clova_draft, latency_ms = call_clova(request.text, category, urgency)
            if clova_draft:
                backend = "clova"
                draft = clova_draft
                cost = CLOVA_COST_PER_CALL
                redis_cost_incr(time.strftime("%Y-%m-%d"), cost)
                if urgency != "HIGH":
                    cache_set(category, clova_draft)  # 다음 동일 카테고리 문의는 캐시 히트
            else:
                backend = "template-fallback"
                draft = build_template_draft(category, has_pii, urgency)
                send_telegram("🚨 [폴백] CLOVA 장애 → 템플릿 + 상담원 직접 처리 전환")

    if urgency == "HIGH":
        send_telegram(f"⚠️ [긴급] {category} 문의 → CLOVA 처리 / 시니어 배정 (채널: {request.channel})")

    return save_ticket(
        request=request,
        has_pii=has_pii,
        masked_text_value=masked,
        category=category,
        urgency=urgency,
        backend=backend,
        review_required=review_required,
        draft=draft,
        pii_types=pii_types,
        agent_queue=agent_queue,
        cost=cost,
        latency_ms=latency_ms,
    )


@app.get("/tickets")
def list_tickets():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, channel, masked_text, category, urgency, backend,
                       has_pii, review_required, draft, pii_types, agent_queue, created_at
                FROM tickets ORDER BY id DESC LIMIT 50
            """)
            rows = cur.fetchall()

    return [
        {
            "id": row[0], "channel": row[1], "masked_text": row[2],
            "category": row[3], "urgency": row[4], "backend": row[5],
            "has_pii": row[6], "review_required": row[7], "draft": row[8],
            "pii_types": row[9].split(",") if row[9] else [],
            "agent_queue": row[10], "created_at": row[11].isoformat(),
        }
        for row in rows
    ]


@app.get("/assignments")
def list_assignments():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT a.id, a.ticket_id, a.agent_queue, a.reason, a.assigned_at,
                       t.category, t.urgency, t.has_pii
                FROM assignments a JOIN tickets t ON a.ticket_id = t.id
                ORDER BY a.assigned_at DESC LIMIT 50
            """)
            rows = cur.fetchall()

    return [
        {
            "id": row[0], "ticket_id": row[1], "agent_queue": row[2],
            "reason": row[3], "assigned_at": row[4].isoformat(),
            "category": row[5], "urgency": row[6], "has_pii": row[7],
        }
        for row in rows
    ]


class EmailSyncRequest(BaseModel):
    present_ids: List[str]


@app.post("/email/sync")
def email_sync(req: EmailSyncRequest):
    """메일함에 현재 남아있는 메일 ID 목록을 받아, 삭제된 메일의 티켓을 제거."""
    deleted = 0
    with get_db() as conn:
        with conn.cursor() as cur:
            if req.present_ids:
                cur.execute("""
                    SELECT id FROM tickets
                    WHERE channel = 'email' AND source_id IS NOT NULL
                      AND source_id <> ALL(%s)
                """, (req.present_ids,))
            else:
                cur.execute("""
                    SELECT id FROM tickets
                    WHERE channel = 'email' AND source_id IS NOT NULL
                """)
            stale_ids = [r[0] for r in cur.fetchall()]

            for tid in stale_ids:
                cur.execute("DELETE FROM responses WHERE ticket_id = %s", (tid,))
                cur.execute("DELETE FROM pii_logs WHERE ticket_id = %s", (tid,))
                cur.execute("DELETE FROM assignments WHERE ticket_id = %s", (tid,))
                cur.execute("DELETE FROM tickets WHERE id = %s", (tid,))
                deleted += 1

    return {"deleted": deleted}


@app.delete("/tickets/{ticket_id}")
def delete_ticket(ticket_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM responses WHERE ticket_id = %s", (ticket_id,))
            cur.execute("DELETE FROM pii_logs WHERE ticket_id = %s", (ticket_id,))
            cur.execute("DELETE FROM assignments WHERE ticket_id = %s", (ticket_id,))
            cur.execute("DELETE FROM tickets WHERE id = %s", (ticket_id,))
            deleted = cur.rowcount
    return {"deleted": deleted}


@app.get("/stats")
def get_stats():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM tickets")
            total = cur.fetchone()[0]

            cur.execute("SELECT channel, COUNT(*) FROM tickets GROUP BY channel")
            by_channel = {r[0]: r[1] for r in cur.fetchall()}

            cur.execute("SELECT urgency, COUNT(*) FROM tickets GROUP BY urgency")
            by_urgency = {r[0]: r[1] for r in cur.fetchall()}

            cur.execute("SELECT backend, COUNT(*) FROM tickets GROUP BY backend")
            by_backend = {r[0]: r[1] for r in cur.fetchall()}

            cur.execute("SELECT COUNT(*) FROM tickets WHERE has_pii = true")
            pii_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM tickets WHERE review_required = true")
            review_count = cur.fetchone()[0]

            cur.execute("SELECT agent_queue, COUNT(*) FROM tickets GROUP BY agent_queue")
            by_queue = {r[0]: r[1] for r in cur.fetchall()}

            cur.execute("""
                SELECT COALESCE(SUM(total_cost_krw), 0), COALESCE(SUM(call_count), 0)
                FROM cost_daily WHERE date = CURRENT_DATE
            """)
            today_cost, today_calls = cur.fetchone()

            cur.execute("SELECT COUNT(*) FROM pii_logs")
            pii_log_count = cur.fetchone()[0]

    return {
        "total_tickets": total,
        "by_channel": by_channel,
        "by_urgency": by_urgency,
        "by_backend": by_backend,
        "pii_detected": pii_count,
        "review_required": review_count,
        "by_queue": by_queue,
        "today_clova_cost_krw": today_cost,
        "today_clova_calls": today_calls,
        "pii_log_count": pii_log_count,
        "circuit_breaker": cb_state(),
    }


@app.get("/circuit-breaker")
def circuit_breaker_status():
    return {
        "state": cb_state(),
        "failures": _cb["failures"],
        "threshold": CB_THRESHOLD,
        "cooldown_sec": CB_COOLDOWN,
    }


@app.get("/", response_class=HTMLResponse)
@app.get("/form", response_class=HTMLResponse)
def inquiry_form():
    return """
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>문의하기</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Pretendard', 'Segoe UI', -apple-system, sans-serif; background: #f4f6fb; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
  .box { background: #fff; border: 1px solid #e8ecf3; border-radius: 18px; padding: 36px; width: 100%; max-width: 520px; box-shadow: 0 4px 20px rgba(15,23,42,0.06); }
  h1 { font-size: 1.35rem; font-weight: 700; margin-bottom: 6px; }
  .desc { font-size: 0.85rem; color: #94a3b8; margin-bottom: 24px; }
  label { display: block; font-size: 0.82rem; font-weight: 600; color: #475569; margin-bottom: 6px; }
  input, textarea { width: 100%; border: 1px solid #d6dce6; border-radius: 10px; padding: 12px 14px; font-size: 0.92rem; font-family: inherit; margin-bottom: 18px; }
  input:focus, textarea:focus { outline: none; border-color: #2563eb; }
  textarea { resize: vertical; min-height: 130px; line-height: 1.5; }
  .btn { width: 100%; border: none; background: #2563eb; color: #fff; font-size: 0.95rem; font-weight: 700; padding: 14px; border-radius: 10px; cursor: pointer; }
  .btn:hover { background: #1d4ed8; }
  .btn:disabled { background: #93b4f0; cursor: default; }
  .result { margin-top: 20px; border-radius: 12px; padding: 18px; font-size: 0.9rem; line-height: 1.6; display: none; }
  .result.show { display: block; }
  .result.ok { background: #f0f9ff; border: 1px solid #dbeafe; }
  .result .draft { margin-top: 10px; padding: 12px; background: #fff; border-radius: 8px; border: 1px solid #e8ecf3; white-space: pre-wrap; }
  .hint { font-size: 0.75rem; color: #b0b8c5; margin-top: -12px; margin-bottom: 18px; }
</style>
</head>
<body>
<div class="box">
  <h1>고객센터 문의하기</h1>
  <div class="desc">문의를 남겨주시면 빠르게 확인 후 답변드리겠습니다.</div>

  <label>이름 (선택)</label>
  <input id="name" placeholder="홍길동" autocomplete="off">
  <div class="hint">※ 이름은 본문과 분리되어 안전하게 보관됩니다. 본문에는 이름을 적지 마세요.</div>

  <label>문의 내용</label>
  <textarea id="text" placeholder="문의하실 내용을 입력해 주세요."></textarea>

  <button class="btn" id="btn" onclick="submit()">문의 접수하기</button>

  <div class="result" id="result"></div>
</div>

<script>
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
async function submit() {
  const text = document.getElementById('text').value.trim();
  if (!text) { alert('문의 내용을 입력해 주세요.'); return; }
  const btn = document.getElementById('btn');
  btn.disabled = true; btn.textContent = '접수 중...';

  try {
    const resp = await fetch('/api/tickets', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ channel: 'web', text: text })
    });
    const t = await resp.json();
    const box = document.getElementById('result');
    box.className = 'result ok show';
    box.innerHTML = `
      <b>접수가 완료되었습니다. (접수번호 #${t.id})</b><br>
      문의 분류: ${esc(t.category)} · 곧 담당 상담원이 확인합니다.
      <div class="draft">${esc(t.draft)}</div>
    `;
    document.getElementById('text').value = '';
    document.getElementById('name').value = '';
  } catch (e) {
    alert('접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    btn.disabled = false; btn.textContent = '문의 접수하기';
  }
}
</script>
</body>
</html>
"""


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    return """
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>고객센터 문의 현황</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Pretendard', 'Segoe UI', -apple-system, sans-serif; background: #f4f6fb; color: #1e293b; padding: 32px 40px; }
  .header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 28px; }
  h1 { font-size: 1.4rem; font-weight: 700; color: #0f172a; }
  .refresh { font-size: 0.78rem; color: #94a3b8; }
  .btn { margin-left: auto; border: 1px solid #d6dce6; background: #fff; color: #475569; font-size: 0.82rem; font-weight: 600; padding: 8px 16px; border-radius: 9px; cursor: pointer; }
  .btn:hover { background: #f1f5f9; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px; margin-bottom: 28px; }
  .card { background: #fff; border: 1px solid #e8ecf3; border-radius: 14px; padding: 20px 22px; box-shadow: 0 1px 3px rgba(15,23,42,0.04); }
  .card .label { font-size: 0.72rem; color: #8a94a6; margin-bottom: 8px; font-weight: 600; letter-spacing: 0.02em; }
  .card .value { font-size: 1.9rem; font-weight: 700; color: #0f172a; line-height: 1.1; }
  .card .sub { font-size: 0.78rem; color: #9aa4b5; margin-top: 6px; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 0.8rem; font-weight: 700; }
  .badge.CLOSED { background: #dcfce7; color: #15803d; }
  .badge.OPEN { background: #fee2e2; color: #b91c1c; }
  .badge.HALF-OPEN { background: #fef3c7; color: #b45309; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e8ecf3; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 3px rgba(15,23,42,0.04); }
  th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 0.72rem; color: #8a94a6; font-weight: 600; letter-spacing: 0.02em; border-bottom: 1px solid #e8ecf3; }
  td { padding: 12px 16px; font-size: 0.86rem; border-top: 1px solid #f1f4f9; color: #334155; }
  tr:hover td { background: #f8fafc; }
  .pill { display:inline-block; padding: 2px 9px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; }
  .HIGH { color: #dc2626; font-weight: 700; }
  .MEDIUM { color: #ea580c; font-weight: 600; }
  .LOW { color: #16a34a; }
  .ch-web { background:#eff6ff; color:#2563eb; }
  .ch-email { background:#f5f3ff; color:#7c3aed; }
  .section-title { font-size: 0.95rem; font-weight: 700; color: #475569; margin: 24px 0 12px; }
  tbody tr { cursor: pointer; }
  .overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.45); display: none; align-items: center; justify-content: center; padding: 24px; z-index: 50; }
  .overlay.show { display: flex; }
  .modal { background: #fff; border-radius: 16px; width: 100%; max-width: 640px; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(15,23,42,0.25); }
  .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #eef1f6; position: sticky; top: 0; background: #fff; }
  .modal-head h2 { font-size: 1.05rem; font-weight: 700; color: #0f172a; }
  .modal-close { border: none; background: #f1f5f9; width: 30px; height: 30px; border-radius: 8px; font-size: 1.1rem; cursor: pointer; color: #64748b; }
  .modal-body { padding: 22px 24px; }
  .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
  .meta .item { background: #f8fafc; border-radius: 10px; padding: 12px 14px; }
  .meta .k { font-size: 0.7rem; color: #94a3b8; font-weight: 600; margin-bottom: 4px; }
  .meta .v { font-size: 0.92rem; color: #1e293b; font-weight: 600; }
  .block { margin-bottom: 18px; }
  .block .k { font-size: 0.75rem; color: #8a94a6; font-weight: 700; margin-bottom: 6px; }
  .block .text { background: #f8fafc; border: 1px solid #eef1f6; border-radius: 10px; padding: 14px; font-size: 0.9rem; line-height: 1.6; color: #334155; white-space: pre-wrap; word-break: break-word; }
  .block .text.draft { background: #f0f9ff; border-color: #dbeafe; }
  .btn-danger { border: 1px solid #fecaca; background: #fef2f2; color: #dc2626; font-size: 0.85rem; font-weight: 600; padding: 10px 16px; border-radius: 9px; cursor: pointer; }
  .btn-danger:hover { background: #fee2e2; }
</style>
</head>
<body>
<div class="header">
  <h1>고객센터 문의 현황</h1>
  <span class="refresh" id="updated"></span>
  <button class="btn" onclick="load()">새로고침</button>
</div>

<div id="app">불러오는 중...</div>

<div class="overlay" id="overlay" onclick="if(event.target===this)closeModal()">
  <div class="modal" id="modal"></div>
</div>

<script>
let TICKETS = [];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
function oneLine(s) {
  return esc(String(s == null ? '' : s).replace(/\\s+/g,' ').trim());
}

const QUEUE_NAMES = {
  'senior': '전문 상담원',
  'dedicated': '개인정보 전담',
  'general-priority': '일반 (우선)',
  'general': '일반',
};
const BACKEND_NAMES = {
  'clova': 'AI 자동응답',
  'cache': '캐시 응답',
  'template': '템플릿 응답',
  'template-fallback': '템플릿 (대체)',
};
const CB_NAMES = { 'CLOSED': '정상', 'OPEN': '차단됨', 'HALF-OPEN': '점검 중' };
const URGENCY_NAMES = { 'HIGH': '높음', 'MEDIUM': '보통', 'LOW': '낮음' };
function qName(q) { return esc(QUEUE_NAMES[q] || q); }
function bName(b) { return esc(BACKEND_NAMES[b] || b); }
function uName(u) { return esc(URGENCY_NAMES[u] || u); }

async function load() {
  const [stats, tickets] = await Promise.all([
    fetch('/api/stats').then(r => r.json()),
    fetch('/api/tickets').then(r => r.json()),
  ]);
  TICKETS = tickets;

  const cb = stats.circuit_breaker;
  const piiRate = stats.total_tickets > 0
    ? ((stats.pii_detected / stats.total_tickets) * 100).toFixed(1)
    : 0;
  const clovaRate = stats.total_tickets > 0
    ? (((stats.by_backend.clova || 0) / stats.total_tickets) * 100).toFixed(1)
    : 0;

  document.getElementById('app').innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="label">전체 접수</div>
        <div class="value">${stats.total_tickets}</div>
        <div class="sub">웹 ${stats.by_channel.web || 0} · 이메일 ${stats.by_channel.email || 0}</div>
      </div>
      <div class="card">
        <div class="label">급한 정도</div>
        <div class="value" style="font-size:1.05rem; line-height:1.9">
          <span class="HIGH">높음 ${stats.by_urgency.HIGH || 0}</span><br>
          <span class="MEDIUM">보통 ${stats.by_urgency.MEDIUM || 0}</span><br>
          <span class="LOW">낮음 ${stats.by_urgency.LOW || 0}</span>
        </div>
      </div>
      <div class="card">
        <div class="label">개인정보 탐지</div>
        <div class="value">${stats.pii_detected}</div>
        <div class="sub">전체의 ${piiRate}%</div>
      </div>
      <div class="card">
        <div class="label">AI 자동응답 비율</div>
        <div class="value">${clovaRate}%</div>
        <div class="sub">오늘 ${stats.today_clova_calls}회 · ₩${stats.today_clova_cost_krw}</div>
      </div>
      <div class="card">
        <div class="label">캐시 처리 (비용 ₩0)</div>
        <div class="value">${stats.by_backend.cache || 0}</div>
        <div class="sub">동일 문의 재사용 건수</div>
      </div>
      <div class="card">
        <div class="label">상담원 확인 필요</div>
        <div class="value">${stats.review_required}</div>
        <div class="sub">사람이 직접 검토할 문의</div>
      </div>
      <div class="card">
        <div class="label">AI(CLOVA) 연결 상태</div>
        <div class="value" style="padding-top:6px">
          <span class="badge ${cb}">${esc(CB_NAMES[cb] || cb)}</span>
        </div>
        <div class="sub">자동응답 정상 작동 여부</div>
      </div>
    </div>

    <div class="section-title">담당 상담원 배정 현황</div>
    <div class="grid">
      ${Object.entries(stats.by_queue).map(([q, c]) => `
        <div class="card">
          <div class="label">${qName(q)}</div>
          <div class="value">${c}</div>
        </div>
      `).join('')}
    </div>

    <div class="section-title">최근 문의 (최대 20건)</div>
    <table>
      <thead>
        <tr>
          <th>#</th><th>들어온 곳</th><th>내용</th><th>분류</th>
          <th>급한 정도</th><th>처리 방식</th><th>담당</th><th>개인정보</th><th>접수 시각</th>
        </tr>
      </thead>
      <tbody>
        ${tickets.slice(0, 20).map(t => `
          <tr onclick="openModal(${t.id})">
            <td>${t.id}</td>
            <td><span class="pill ch-${t.channel}">${t.channel === 'email' ? '이메일' : '웹'}</span></td>
            <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${oneLine(t.masked_text)}</td>
            <td>${esc(t.category)}</td>
            <td class="${t.urgency}">${uName(t.urgency)}</td>
            <td>${bName(t.backend)}</td>
            <td>${qName(t.agent_queue)}</td>
            <td>${t.has_pii ? '🔒' : '–'}</td>
            <td>${esc(t.created_at.slice(11,19))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const now = new Date();
  document.getElementById('updated').textContent =
    '· 마지막 갱신 ' + now.toTimeString().slice(0,8);
}

function openModal(id) {
  const t = TICKETS.find(x => x.id === id);
  if (!t) return;
  document.getElementById('modal').innerHTML = `
    <div class="modal-head">
      <h2>문의 #${t.id} 상세</h2>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="meta">
        <div class="item"><div class="k">들어온 곳</div><div class="v">${t.channel === 'email' ? '이메일' : '웹'}</div></div>
        <div class="item"><div class="k">분류</div><div class="v">${esc(t.category)}</div></div>
        <div class="item"><div class="k">급한 정도</div><div class="v ${t.urgency}">${uName(t.urgency)}</div></div>
        <div class="item"><div class="k">담당</div><div class="v">${qName(t.agent_queue)}</div></div>
        <div class="item"><div class="k">처리 방식</div><div class="v">${bName(t.backend)}</div></div>
        <div class="item"><div class="k">개인정보 / 검토</div><div class="v">${t.has_pii ? '🔒 포함' : '없음'}${t.review_required ? ' · 확인 필요' : ''}</div></div>
      </div>
      ${t.pii_types && t.pii_types.length && t.pii_types[0] ? `
      <div class="block">
        <div class="k">탐지된 개인정보 종류</div>
        <div class="text">${esc(t.pii_types.join(', '))}</div>
      </div>` : ''}
      <div class="block">
        <div class="k">문의 내용 ${t.has_pii ? '(개인정보 가림 처리됨)' : ''}</div>
        <div class="text">${esc(t.masked_text)}</div>
      </div>
      <div class="block">
        <div class="k">AI 응답 초안 (${bName(t.backend)})</div>
        <div class="text draft">${esc(t.draft)}</div>
      </div>
      <div class="block">
        <div class="k">접수 시각</div>
        <div class="text">${esc(t.created_at.replace('T',' ').slice(0,19))}</div>
      </div>
      <div style="text-align:right">
        <button class="btn-danger" onclick="deleteTicket(${t.id})">이 문의 삭제</button>
      </div>
    </div>
  `;
  document.getElementById('overlay').classList.add('show');
}

async function deleteTicket(id) {
  if (!confirm('문의 #' + id + ' 을(를) 삭제할까요? 되돌릴 수 없습니다.')) return;
  try {
    await fetch('/api/tickets/' + id, { method: 'DELETE' });
    closeModal();
    load();
  } catch (e) {
    alert('삭제 중 오류가 발생했습니다.');
  }
}

function closeModal() {
  document.getElementById('overlay').classList.remove('show');
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

load();
</script>
</body>
</html>
"""
