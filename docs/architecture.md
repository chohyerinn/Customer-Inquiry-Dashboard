# 아키텍처 도식

> GitHub에서 아래 Mermaid 다이어그램이 그대로 렌더링됩니다.
> PPT에 넣을 때는 [mermaid.live](https://mermaid.live) 에 코드를 붙여넣어 PNG/SVG로 내보내면 됩니다.

---

## 1. 하드웨어(인프라) 아키텍처

Ncloud VPC를 Public / Private Subnet으로 분리하고, 데이터 계층(DB·Redis)을 외부에서
직접 접근할 수 없도록 Private Subnet에 격리한 3구역 구조.

```mermaid
flowchart TB
    subgraph CLIENT["클라이언트"]
        U1["고객 - 웹폼"]
        U2["고객 - 이메일"]
        U3["상담원 / 관리자 브라우저"]
    end

    subgraph VPC["Ncloud VPC"]
        direction TB
        subgraph PUB["Public Subnet"]
            LB["Load Balancer (HTTPS)<br/>Nginx 리버스 프록시<br/>보안그룹 IP 화이트리스트"]
            API["API Gateway VM (FastAPI)<br/>PII 게이트 · 규칙기반 분류<br/>라우팅 · 배정 · 템플릿 엔진"]
            EW["이메일 워커 VM<br/>IMAP 폴링 (30초)"]
            DASH["대시보드 서빙<br/>문의 폼 · 관제 대시보드"]
        end
        subgraph PRI["Private Subnet (외부 직접 접근 불가)"]
            PG[("PostgreSQL 16<br/>티켓·배정·응답·PII·비용")]
            RD[("Redis 7<br/>캐시·큐·카운터")]
        end
    end

    subgraph EXT["외부 API · 메일 서버 경계"]
        CLOVA["CLOVA Studio API<br/>(HCX-003)"]
        TG["Telegram Bot API"]
        GMAIL["Gmail IMAP"]
    end

    U1 --> LB
    U3 --> LB
    U2 -.수신.-> GMAIL
    LB --> API
    LB --> DASH
    API --> PG
    API --> RD
    DASH --> PG
    EW -->|IMAP 폴링| GMAIL
    EW -->|티켓 등록| API
    API -->|PII 없는 요청만| CLOVA
    API -->|이벤트 알림| TG

    classDef pub fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e;
    classDef pri fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    classDef ext fill:#fae8ff,stroke:#a21caf,color:#701a75;
    classDef cli fill:#f1f5f9,stroke:#475569,color:#1e293b;
    class LB,API,EW,DASH pub;
    class PG,RD pri;
    class CLOVA,TG,GMAIL ext;
    class U1,U2,U3 cli;
```

---

## 2. 소프트웨어 아키텍처 (7계층)

문의 1건이 수집부터 서빙까지 거치는 처리 파이프라인.

```mermaid
flowchart TB
    L1["① 멀티채널 수집<br/>웹 수집기(FastAPI) · 이메일 수집기(IMAP) → 통합 큐"]
    L2["② PII 게이트<br/>정규식 탐지 (전화·이메일·주문번호·계좌)"]
    L3["③ 규칙기반 분류<br/>키워드 사전 → category · urgency"]
    L4["④ 라우팅 + 응답 생성<br/>캐시 / CLOVA / 템플릿 · 서킷브레이커"]
    L5["⑤ 배정 엔진<br/>긴급도·PII 기반 상담원 큐 배정"]
    L6["⑥ 저장<br/>PostgreSQL · Redis"]
    L7["⑦ 서빙<br/>문의 폼 · 관제 대시보드 · Telegram 알림"]

    L1 --> L2
    L2 -->|PII 있음| MASK["마스킹 + 템플릿 응답<br/>외부 전송 차단 · 검토 필수"]
    L2 -->|PII 없음| L3
    L3 --> L4
    MASK --> L5
    L4 --> L5
    L5 --> L6
    L6 --> L7

    classDef layer fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e;
    classDef block fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;
    class L1,L2,L3,L4,L5,L6,L7 layer;
    class MASK block;
```

---

## 3. 요청 처리 흐름 (시퀀스)

일반 문의(PII 없음)와 개인정보 포함 문의의 분기를 한눈에.

```mermaid
sequenceDiagram
    participant C as 고객
    participant N as Nginx
    participant A as FastAPI
    participant DB as PostgreSQL
    participant CL as CLOVA Studio
    participant TG as Telegram

    C->>N: 문의 등록 (웹폼/이메일)
    N->>A: POST /tickets
    A->>A: PII 정규식 탐지

    alt PII 포함
        A->>A: 마스킹 + 템플릿 응답 (외부 차단)
        A->>TG: PII 감지 알림
        A->>DB: 마스킹 텍스트만 저장
    else PII 없음
        A->>A: 규칙기반 분류 (category·urgency)
        A->>CL: 응답 초안 생성 요청
        CL-->>A: 응답 초안
        A->>DB: 원문 + 응답 저장
    end

    A->>A: 긴급도·PII 기반 상담원 큐 배정
    opt 긴급(HIGH)
        A->>TG: 긴급 클레임 알림
    end
    A-->>C: 접수 완료 (접수번호 · 분류 · 응답 초안)
```

---

## 4. 서킷브레이커 상태 전이

CLOVA 장애 시 자동 차단·복구 흐름.

```mermaid
stateDiagram-v2
    [*] --> CLOSED
    CLOSED --> OPEN: 연속 실패 3회
    OPEN --> HALF_OPEN: 60초 경과
    HALF_OPEN --> CLOSED: 호출 성공
    HALF_OPEN --> OPEN: 호출 실패

    note right of CLOSED: 정상 - CLOVA 사용
    note right of OPEN: 차단 - 템플릿 폴백
    note right of HALF_OPEN: 점검 - 1회 시험 호출
```
