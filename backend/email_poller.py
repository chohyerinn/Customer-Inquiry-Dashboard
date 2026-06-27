#!/usr/bin/env python3
"""
Gmail IMAP → 헬프데스크 AI 티켓 자동 수집기

필요 환경변수 (서버 .env 또는 systemd 서비스에 설정):
  GMAIL_USER          Gmail 주소  (예: help@example.com)
  GMAIL_APP_PASSWORD  Gmail 앱 비밀번호 (2단계 인증 → 앱 비밀번호 발급)
  BACKEND_URL         백엔드 내부 URL (기본값: http://localhost:8000)
  POLL_INTERVAL_SEC   폴링 간격(초)  (기본값: 60)

실행:
  pip install requests
  python email_poller.py
"""

import email
import imaplib
import logging
import os
import time
from email.header import decode_header

import requests

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
)
log = logging.getLogger(__name__)

GMAIL_USER     = os.environ['GMAIL_USER']
GMAIL_PASSWORD = os.environ['GMAIL_APP_PASSWORD']
BACKEND_URL    = os.environ.get('BACKEND_URL', 'http://localhost:8000')
INTERVAL       = int(os.environ.get('POLL_INTERVAL_SEC', '60'))


def _decode(value: str | None) -> str:
    if not value:
        return ''
    parts = decode_header(value)
    result = []
    for part, enc in parts:
        if isinstance(part, bytes):
            result.append(part.decode(enc or 'utf-8', errors='replace'))
        else:
            result.append(str(part))
    return ''.join(result)


def _extract_body(msg: email.message.Message) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if (
                part.get_content_type() == 'text/plain'
                and part.get_content_disposition() != 'attachment'
            ):
                raw = part.get_payload(decode=True)
                if raw:
                    return raw.decode(part.get_content_charset() or 'utf-8', errors='replace')
    else:
        raw = msg.get_payload(decode=True)
        if raw:
            return raw.decode(msg.get_content_charset() or 'utf-8', errors='replace')
    return ''


def _post_ticket(sender: str, subject: str, body: str) -> bool:
    text = f"[제목] {subject}\n\n{body}".strip()
    payload = {
        'channel': 'email',
        'name': sender,
        'contact': sender,
        'category': 'general',
        'text': text,
    }
    try:
        r = requests.post(f'{BACKEND_URL}/api/tickets', json=payload, timeout=10)
        if r.ok:
            log.info('티켓 생성 완료: %s', subject[:50])
            return True
        log.warning('티켓 생성 실패 HTTP %s: %s', r.status_code, subject[:50])
    except Exception as exc:
        log.error('백엔드 요청 오류: %s', exc)
    return False


def poll() -> None:
    try:
        imap = imaplib.IMAP4_SSL('imap.gmail.com', 993)
        imap.login(GMAIL_USER, GMAIL_PASSWORD)
        imap.select('INBOX')

        _, msg_ids = imap.search(None, 'UNSEEN')
        ids = msg_ids[0].split()

        if not ids:
            log.info('새 이메일 없음')
            imap.logout()
            return

        log.info('새 이메일 %d건 처리 시작', len(ids))
        for mid in ids:
            _, data = imap.fetch(mid, '(RFC822)')
            raw_bytes = data[0][1]
            msg = email.message_from_bytes(raw_bytes)

            sender  = _decode(msg.get('From', ''))
            subject = _decode(msg.get('Subject', '(제목 없음)'))
            body    = _extract_body(msg)

            if _post_ticket(sender, subject, body):
                imap.store(mid, '+FLAGS', '\\Seen')

        imap.logout()

    except imaplib.IMAP4.error as exc:
        log.error('IMAP 인증/연결 오류: %s', exc)
    except Exception as exc:
        log.error('폴러 오류: %s', exc)


if __name__ == '__main__':
    log.info(
        '이메일 폴러 시작 — %s → %s (간격: %ds)',
        GMAIL_USER, BACKEND_URL, INTERVAL,
    )
    while True:
        poll()
        time.sleep(INTERVAL)
