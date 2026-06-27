/* 데모용 샘플 데이터 — 실제 개인정보/금융정보/키 없음.
   이름·연락처는 마스킹 규칙 적용, 상담원은 가상 인물(실제 아님). */

export const CATEGORIES = ['결제', '기술', '일반', '환불', '배송', '클레임', '계정']

export const CAT_TINT = {
  결제: '#7C3AED', 기술: '#0EA5E9', 일반: '#6B7280', 환불: '#2563EB',
  배송: '#0D9488', 클레임: '#DB2777', 계정: '#D97706',
}

export const URGENCY = {
  높음: { tone: 'danger', label: '높음' },
  보통: { tone: 'warning', label: '보통' },
  낮음: { tone: 'success', label: '낮음' },
}

export const COUNSELORS = [
  { id: 'c1', name: '박지훈', team: '개인정보 전담', focus: ['클레임', '계정'], load: 3, cap: 6, online: true,  avatar: '#2563EB' },
  { id: 'c2', name: '김서연', team: '일반(우선)',   focus: ['결제', '환불'],   load: 5, cap: 6, online: true,  avatar: '#7C3AED' },
  { id: 'c3', name: '정민재', team: '일반',         focus: ['배송', '일반'],   load: 2, cap: 6, online: true,  avatar: '#0D9488' },
  { id: 'c4', name: '이수아', team: '전문(기술)',   focus: ['기술'],           load: 4, cap: 5, online: false, avatar: '#D97706' },
]

export const INQUIRIES = [
  { id: 'INQ-240601-0042', name: '홍**', contact: 'hong***@example.com', category: '환불', urgency: '보통',
    channel: '웹폼', handling: 'AI 자동응답', pii: true, status: 'AI초안', counselor: '김서연',
    time: '2024-06-01 14:32', sla: '02:48',
    excerpt: '주문번호 ORD-20240601-3F2A 환불 요청 — 색상이 사진과 달라요.',
    ai: '안녕하세요, 홍** 고객님. 주문(ORD-20240601-3F2A)의 색상 차이로 불편을 드려 죄송합니다. 모니터·촬영 환경에 따른 색상 편차가 있을 수 있어 전액 환불 또는 교환 중 선택해 도와드리겠습니다. 회수는 무료로 진행됩니다.',
    detected: [{ type: '이메일', masked: 'hong***@example.com' }, { type: '이름', masked: '홍**' }],
    reason: ["본문 키워드 '환불' 매칭 → 카테고리 환불", "'색상이 달라요' → 단순 불만(긴급도 보통)", 'FAQ 환불 정책 문서와 0.82 유사 → AI 자동응답 가능'] },
  { id: 'INQ-240601-0041', name: '이**', contact: '010-****-7781', category: '결제', urgency: '높음',
    channel: '이메일', handling: '수동', pii: true, status: '확인필요', counselor: '김서연',
    time: '2024-06-01 14:18', sla: '00:54',
    excerpt: '결제는 두 번 됐는데 주문은 하나예요. 중복 결제 즉시 취소 바랍니다.',
    ai: '(AI 초안 보류) 중복 결제 건은 결제 대행 응답 확인이 필요해 자동응답 대상에서 제외되었습니다. 상담원 직접 확인을 권장합니다.',
    detected: [{ type: '전화번호', masked: '010-****-7781' }, { type: '이름', masked: '이**' }],
    reason: ["'중복 결제'·'즉시 취소' → 긴급도 높음", '금액 분쟁 가능성 → AI 자동응답 차단, 수동 처리', '결제 카테고리 규칙 매칭'] },
  { id: 'INQ-240601-0040', name: '박**', contact: 'park***@example.com', category: '배송', urgency: '낮음',
    channel: '웹폼', handling: 'AI 자동응답', pii: true, status: '응답완료', counselor: '정민재',
    time: '2024-06-01 13:55', sla: '—',
    excerpt: '오늘 출발한다던데 송장번호가 아직 안 나왔어요. 언제쯤 받을 수 있을까요?',
    ai: '안녕하세요, 박** 고객님. 주문은 오늘 오후 출고 예정이며 송장번호는 출고 완료 후 1–2시간 내 문자로 안내됩니다. 일반 배송 기준 1–2일 내 수령 가능합니다.',
    detected: [{ type: '이메일', masked: 'park***@example.com' }, { type: '이름', masked: '박**' }],
    reason: ["'송장'·'언제' → 배송 조회(긴급도 낮음)", '배송 FAQ와 0.91 유사 → AI 자동응답'] },
  { id: 'INQ-240601-0039', name: '최**', contact: '010-****-1234', category: '기술', urgency: '높음',
    channel: '웹폼', handling: '템플릿', pii: true, status: '처리중', counselor: '이수아',
    time: '2024-06-01 13:40', sla: '01:30',
    excerpt: '앱 로그인이 계속 튕겨요. 어제 업데이트 후부터 아예 안 됩니다.',
    ai: '(템플릿 응답) CLOVA 연결 지연으로 기본 템플릿이 적용되었습니다. 앱 재설치·캐시 삭제 안내 후 재현 로그를 요청하는 표준 문구.',
    detected: [{ type: '전화번호', masked: '010-****-1234' }, { type: '이름', masked: '최**' }],
    reason: ["'로그인'·'업데이트 후' → 기술 카테고리", "'아예 안 됩니다' → 긴급도 높음", 'CLOVA 응답 지연 → 템플릿 폴백'] },
  { id: 'INQ-240601-0038', name: '정**', contact: 'jung***@example.com', category: '계정', urgency: '보통',
    channel: '이메일', handling: 'AI 자동응답', pii: true, status: 'AI초안', counselor: '박지훈',
    time: '2024-06-01 13:12', sla: '03:10',
    excerpt: '비밀번호 재설정 메일이 안 와요. 스팸함도 확인했습니다.',
    ai: '안녕하세요, 정** 고객님. 재설정 메일은 발송 후 최대 10분 지연될 수 있습니다. 가입 시 사용한 이메일 주소를 한 번 더 확인해 주시고, 아래 버튼으로 재발송해 주세요.',
    detected: [{ type: '이메일', masked: 'jung***@example.com' }, { type: '이름', masked: '정**' }],
    reason: ["'비밀번호 재설정' → 계정 카테고리", "'메일이 안 와요' → 일반 문의(보통)", '계정 FAQ와 0.78 유사 → AI 자동응답'] },
  { id: 'INQ-240601-0037', name: '한**', contact: '010-****-5532', category: '클레임', urgency: '높음',
    channel: '웹폼', handling: '수동', pii: true, status: '확인필요', counselor: '박지훈',
    time: '2024-06-01 12:50', sla: '00:22',
    excerpt: '포장이 파손된 채로 도착했고 내용물도 깨졌습니다. 보상 요구합니다.',
    ai: '(AI 초안 보류) 파손·보상 건은 사진 증빙과 보상 정책 확인이 필요해 수동 처리로 분류되었습니다.',
    detected: [{ type: '전화번호', masked: '010-****-5532' }, { type: '이름', masked: '한**' }],
    reason: ["'파손'·'보상 요구' → 클레임(긴급도 높음)", '보상 정책 판단 필요 → 수동 처리', '개인정보 전담 상담원 배정'] },
  { id: 'INQ-240601-0036', name: '윤**', contact: 'yoon***@example.com', category: '일반', urgency: '낮음',
    channel: '웹폼', handling: 'AI 자동응답', pii: true, status: '응답완료', counselor: '정민재',
    time: '2024-06-01 12:31', sla: '—',
    excerpt: '영업시간이 어떻게 되나요? 주말에도 상담 가능한지 궁금합니다.',
    ai: '안녕하세요, 윤** 고객님. 상담 영업시간은 평일 09:00–18:00이며, 주말·공휴일은 AI 챗봇으로 기본 문의를 도와드립니다.',
    detected: [{ type: '이메일', masked: 'yoon***@example.com' }, { type: '이름', masked: '윤**' }],
    reason: ["'영업시간' → 일반 안내(긴급도 낮음)", '일반 FAQ와 0.95 유사 → AI 자동응답'] },
  { id: 'INQ-240601-0035', name: '서**', contact: '010-****-9090', category: '결제', urgency: '보통',
    channel: '이메일', handling: '템플릿', pii: true, status: '응답완료', counselor: '김서연',
    time: '2024-06-01 12:05', sla: '—',
    excerpt: '세금계산서를 발행하고 싶은데 어디서 신청하나요?',
    ai: '안녕하세요, 서** 고객님. 세금계산서는 마이페이지 > 결제내역 > 증빙발행에서 신청 가능하며, 신청 후 영업일 기준 1–2일 내 발행됩니다.',
    detected: [{ type: '전화번호', masked: '010-****-9090' }, { type: '이름', masked: '서**' }],
    reason: ["'세금계산서 발행' → 결제 카테고리", '절차 안내(긴급도 보통)', 'CLOVA 큐 대기 → 템플릿 폴백'] },
]

export const SUMMARY = {
  total: 142,
  urgency: { 높음: 18, 보통: 64, 낮음: 60 },
  piiDetected: 97,
  aiAutoRate: 68,
  needReview: 11,
  clovaStatus: '정상',
}

export const ASSIGN = [
  { team: '개인정보 전담', people: ['박지훈'], active: 5, desc: 'PII 포함·클레임 우선' },
  { team: '일반(우선)',    people: ['김서연'], active: 7, desc: '긴급도 높음 라우팅' },
  { team: '일반',          people: ['정민재'], active: 9, desc: '표준 큐' },
  { team: '전문(기술)',    people: ['이수아'], active: 4, desc: '기술 카테고리 전담' },
]

export const DEMO = { CATEGORIES, CAT_TINT, URGENCY, COUNSELORS, INQUIRIES, SUMMARY, ASSIGN }
