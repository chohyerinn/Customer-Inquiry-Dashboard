"""
app/main.py 에 추가할 코드 스니펫
─────────────────────────────────
기존 import 블록 아래에 Pydantic 모델을 추가하고,
기존 라우터 정의 영역에 엔드포인트를 붙여넣으세요.
"""

# ── 1. 파일 상단 import/모델 영역에 추가 ─────────────────────────────────────

from pydantic import BaseModel          # 이미 있으면 생략
from fastapi import HTTPException       # 이미 있으면 생략

class SendResponseRequest(BaseModel):
    draft: str


# ── 2. 라우터 정의 영역에 추가 ────────────────────────────────────────────────
#
#   아래 Depends(get_db) / db.query(Ticket) 부분은
#   현재 main.py 의 DB 세션·ORM 모델명에 맞게 조정하세요.
#   예) db: AsyncSession = Depends(get_async_session) 등

@app.post("/tickets/{ticket_id}/send-response")
def send_response(ticket_id: int, body: SendResponseRequest, db=Depends(get_db)):
    # DB 조회 ── 기존 Ticket 모델명·세션 방식에 맞게 수정
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="티켓을 찾을 수 없습니다.")

    msg = (
        f"📨 [헬프데스크] 상담원 응답 발송\n"
        f"문의 ID: #{ticket.id}\n"
        f"카테고리: {ticket.category} · 긴급도: {ticket.urgency}\n\n"
        f"[문의 원문 (마스킹됨)]\n{ticket.masked_text or '(없음)'}\n\n"
        f"[상담원 응답]\n{body.draft}"
    )

    # 기존 send_telegram 함수 재사용
    result = send_telegram(msg)
    if result is None:
        raise HTTPException(status_code=502, detail="Telegram 전송에 실패했습니다.")

    return {"ok": True, "ticket_id": ticket_id}
