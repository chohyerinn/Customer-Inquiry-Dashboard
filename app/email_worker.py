import email
import imaplib
import os
import time
from email.header import decode_header

import httpx


IMAP_HOST = os.getenv("IMAP_HOST", "imap.gmail.com")
IMAP_USER = os.getenv("IMAP_USER", "")
IMAP_PASSWORD = os.getenv("IMAP_PASSWORD", "")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "30"))
API_URL = os.getenv("API_URL", "http://api:8000/tickets")
SYNC_URL = os.getenv("SYNC_URL", "http://api:8000/email/sync")


def decode_mime(value: str) -> str:
    if not value:
        return ""
    parts = decode_header(value)
    result = ""
    for text, enc in parts:
        if isinstance(text, bytes):
            try:
                result += text.decode(enc or "utf-8", errors="replace")
            except Exception:
                result += text.decode("utf-8", errors="replace")
        else:
            result += text
    return result


def extract_body(msg) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition"))
            if content_type == "text/plain" and "attachment" not in disposition:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    return payload.decode(charset, errors="replace")
        return ""
    payload = msg.get_payload(decode=True)
    if payload:
        charset = msg.get_content_charset() or "utf-8"
        return payload.decode(charset, errors="replace")
    return ""


def process_new_emails():
    mail = imaplib.IMAP4_SSL(IMAP_HOST)
    mail.login(IMAP_USER, IMAP_PASSWORD)
    mail.select("INBOX")

    # 1) 안 읽은 메일만 조회 → 신규 티켓 생성
    status, data = mail.search(None, "UNSEEN")
    if status == "OK":
        ids = data[0].split()
        if ids:
            print(f"[email-worker] 새 메일 {len(ids)}건 발견", flush=True)
        for num in ids:
            status, msg_data = mail.fetch(num, "(RFC822)")
            if status != "OK":
                continue

            msg = email.message_from_bytes(msg_data[0][1])
            subject = decode_mime(msg.get("Subject", ""))
            body = extract_body(msg).strip()
            message_id = (msg.get("Message-ID") or "").strip()

            text = f"{subject}\n{body}".strip()
            if not text:
                continue

            try:
                resp = httpx.post(
                    API_URL,
                    json={"channel": "email", "text": text, "source_id": message_id},
                    timeout=15.0,
                )
                print(f"[email-worker] 티켓 생성: {resp.status_code} (제목: {subject[:30]})", flush=True)
            except Exception as e:
                print(f"[email-worker] 전송 실패: {e}", flush=True)

            mail.store(num, "+FLAGS", "\\Seen")

    # 2) 메일함에 현재 남아있는 모든 메일 ID 수집 → 삭제 동기화
    present_ids = []
    status, data = mail.search(None, "ALL")
    if status == "OK":
        all_nums = data[0].split()
        for num in all_nums:
            status, msg_data = mail.fetch(num, "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])")
            if status != "OK" or not msg_data or not msg_data[0]:
                continue
            header = msg_data[0][1]
            mid = email.message_from_bytes(header).get("Message-ID")
            if mid:
                present_ids.append(mid.strip())

    try:
        resp = httpx.post(SYNC_URL, json={"present_ids": present_ids}, timeout=15.0)
        deleted = resp.json().get("deleted", 0)
        if deleted:
            print(f"[email-worker] 삭제 동기화: 메일함에서 사라진 티켓 {deleted}건 제거", flush=True)
    except Exception as e:
        print(f"[email-worker] 동기화 실패: {e}", flush=True)

    mail.logout()


def main():
    print(f"[email-worker] 시작. {POLL_INTERVAL}초 주기 폴링 → {IMAP_HOST}", flush=True)
    if not IMAP_USER or not IMAP_PASSWORD:
        print("[email-worker] IMAP_USER/IMAP_PASSWORD 미설정. 종료.", flush=True)
        return

    while True:
        try:
            process_new_emails()
        except Exception as e:
            print(f"[email-worker] 폴링 오류: {e}", flush=True)
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
