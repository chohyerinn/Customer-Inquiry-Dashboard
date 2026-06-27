import { useState, useEffect } from 'react'
import { DEMO } from '../data'
import { fetchTickets, sendResponse, regenerateDraft } from '../api'
import {
  Icon, Btn, Badge, Card, Field, Spinner,
  Avatar, SectionHead, Stat, UrgencyBadge, StatusBadge, CatTag, Segmented,
} from './ui'
import { EmptyState } from './customer'

function HandlingTag({ h }) {
  const map = { 'AI 자동응답': { tone: 'blue', icon: 'sparkles' }, '템플릿': { tone: 'neutral', icon: 'file-text' }, '수동': { tone: 'warning', icon: 'hand' } }
  const m = map[h] || map['수동']
  return <Badge tone={m.tone} icon={m.icon}>{h}</Badge>
}

const _URGENCY_KO = { HIGH: '높음', MEDIUM: '보통', LOW: '낮음' }
const _CHANNEL_KO  = { web: '웹폼', email: '이메일' }
const _BACKEND_KO  = { clova: 'AI 자동응답', 'clova-ready': 'AI 자동응답', template: '템플릿', manual: '수동' }
const _POOL = ['김서연', '이수아', '정민재']

export function adaptTicket(t, idx) {
  const urgency = _URGENCY_KO[t.urgency] || t.urgency || '보통'
  return {
    id: t.id,
    category: t.category || '일반',
    urgency,
    channel: _CHANNEL_KO[t.channel] || t.channel || '웹폼',
    handling: _BACKEND_KO[t.backend] || 'AI 자동응답',
    pii: t.has_pii ?? false,
    status: t.review_required ? '확인필요' : 'AI초안',
    counselor: urgency === '높음' ? _POOL[0] : _POOL[(idx || 0) % _POOL.length],
    time: t.created_at || '',
    ai: t.draft || '',
    excerpt: t.masked_text || '문의 내용 없음',
    detected: (t.pii_types || []).map((type) => ({ type, masked: type })),
  }
}

export function Dashboard({ onOpenInquiry, clovaStatus, completedIds = new Set() }) {
  const S = DEMO.SUMMARY
  const clova = clovaStatus || S.clovaStatus

  const [inquiries, setInquiries] = useState(null)
  const [isDemo, setIsDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')
  const [spin, setSpin] = useState(false)

  function load() {
    setLoading(true)
    fetchTickets()
      .then((data) => {
        if (Array.isArray(data)) {
          setInquiries(data.map(adaptTicket))
          setIsDemo(false)
        } else {
          setInquiries(DEMO.INQUIRIES)
          setIsDemo(true)
        }
      })
      .catch(() => {
        setInquiries(DEMO.INQUIRIES)
        setIsDemo(true)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const id = setInterval(() => {
      fetchTickets()
        .then((data) => {
          if (Array.isArray(data)) {
            setInquiries(data.map(adaptTicket))
            setIsDemo(false)
          }
        })
        .catch(() => {})
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const allList = inquiries || DEMO.INQUIRIES
  const completedList = allList.filter((i) => completedIds.has(i.id))
  const activeList = allList.filter((i) => !completedIds.has(i.id))
  const list = filter === '완료' ? completedList : activeList
  const filtered = filter === '완료' ? completedList
    : filter === '전체' ? activeList
    : filter === '확인필요' ? activeList.filter((i) => i.status === '확인필요')
    : activeList.filter((i) => i.urgency === filter)

  function refresh() {
    setSpin(true)
    load()
    setTimeout(() => setSpin(false), 700)
  }

  return (
    <div className="staff scroll">
      <div className="staff-head">
        <div>
          <h1 className="t-h1">문의 대시보드</h1>
          <p className="t-cap" style={{ marginTop: 3 }}>
            실시간 접수 현황 · 마지막 업데이트 2024-06-01 14:36
            {isDemo && <Badge tone="warning" icon="flask-conical" style={{ marginLeft: 8 }}>데모 데이터</Badge>}
          </p>
        </div>
        <div className="staff-head-r">
          {clova === '오류' && <Badge tone="danger" icon="alert-triangle">CLOVA 오류 · 템플릿 전환</Badge>}
          <Btn variant="secondary" size="md" icon="rotate-cw" onClick={refresh}
            style={spin ? { pointerEvents: 'none' } : null}>새로고침</Btn>
        </div>
      </div>

      <div className="kpi-grid">
        <Stat label="전체 접수" value={S.total} sub="오늘 누적" icon="inbox" />
        <Card className="stat">
          <div className="stat-top"><span className="t-label">긴급도 분포</span><Icon name="signal" size={15} style={{ color: 'var(--faint)' }} /></div>
          <div className="urg-split">
            <span><i className="dot" style={{ background: 'var(--danger)' }} />높음 {S.urgency.높음}</span>
            <span><i className="dot" style={{ background: 'var(--warning)' }} />보통 {S.urgency.보통}</span>
            <span><i className="dot" style={{ background: 'var(--success)' }} />낮음 {S.urgency.낮음}</span>
          </div>
          <div className="urg-bar">
            <span style={{ width: (S.urgency.높음 / S.total * 100) + '%', background: 'var(--danger)' }} />
            <span style={{ width: (S.urgency.보통 / S.total * 100) + '%', background: 'var(--warning)' }} />
            <span style={{ width: (S.urgency.낮음 / S.total * 100) + '%', background: 'var(--success)' }} />
          </div>
        </Card>
        <Stat label="개인정보 탐지" value={S.piiDetected} sub={`전체의 ${Math.round(S.piiDetected / S.total * 100)}% · 마스킹 완료`} icon="shield" tone="blue" />
        <Stat label="AI 자동응답 비율" value={S.aiAutoRate} sub="템플릿 폴백 제외">%</Stat>
        <Stat label="상담원 확인 필요" value={S.needReview} sub="수동 처리 대기" icon="alert-triangle" tone="warning" />
        <Card className="stat">
          <div className="stat-top"><span className="t-label">CLOVA 연결</span><Icon name="plug-zap" size={15} style={{ color: 'var(--faint)' }} /></div>
          <div className="clova-row">
            {clova === '오류' ? <Badge tone="danger" dot>오류</Badge>
              : clova === '지연' ? <Badge tone="warning" dot>지연</Badge>
              : <Badge tone="success" dot>정상</Badge>}
            <span className="t-cap">HyperCLOVA X</span>
          </div>
          <div className="stat-sub">{clova === '오류' ? '템플릿 응답으로 자동 전환됨' : '응답 캐시 적중률 41%'}</div>
        </Card>
      </div>

      <SectionHead title="배정 현황" desc="긴급도·카테고리 기반 자동 라우팅" icon="git-branch" />
      <div className="assign-grid">
        {DEMO.ASSIGN.map((a) => {
          const c = DEMO.COUNSELORS.find((x) => x.name === a.people[0])
          return (
            <Card key={a.team} className="assign-card">
              <div className="assign-top">
                <span className="t-h3">{a.team}</span>
                <Badge tone="blue">{a.active}건</Badge>
              </div>
              <p className="t-cap" style={{ marginBottom: 12 }}>{a.desc}</p>
              <div className="assign-person">
                <Avatar name={c?.name} color={c?.avatar} size={26} />
                <div>
                  <div className="t-sm" style={{ fontWeight: 600, color: 'var(--ink)' }}>{c?.name}</div>
                  <div className="t-cap">{c?.online ? '온라인' : '오프라인'} · {c?.load}/{c?.cap}건</div>
                </div>
                <span className={`online-dot${c?.online ? ' on' : ''}`} />
              </div>
            </Card>
          )
        })}
      </div>

      <SectionHead title="문의 목록" desc={`대기 ${activeList.length}건 · 완료 ${completedList.length}건`} icon="list"
        right={<Segmented value={filter} onChange={setFilter} options={['전체', '높음', '확인필요', '완료']} />} />

      {loading ? (
        <Card style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
          <Spinner size={24} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState title="해당 조건의 문의가 없습니다" desc="필터를 바꿔보세요." /></Card>
      ) : (
        <Card pad={false} className="tbl-card">
          <div className="tbl-scroll scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>문의 ID</th><th>카테고리</th><th>긴급도</th><th>채널</th>
                  <th>처리 방식</th><th>개인정보</th><th>상태</th><th>담당</th><th>접수 시각</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} onClick={() => onOpenInquiry(i)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenInquiry(i) } }}>
                    <td><span className="mono" style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>{i.id}</span></td>
                    <td><CatTag name={i.category} /></td>
                    <td><UrgencyBadge level={i.urgency} /></td>
                    <td><span className="cell-muted"><Icon name={i.channel === '이메일' ? 'mail' : 'globe'} size={13} />{i.channel}</span></td>
                    <td><HandlingTag h={i.handling} /></td>
                    <td>{i.pii ? <span className="pii-yes"><Icon name="shield-check" size={13} />탐지·마스킹</span> : <span className="cell-muted">없음</span>}</td>
                    <td><StatusBadge status={i.status} /></td>
                    <td><span className="cell-person"><Avatar name={i.counselor} size={20} color={(DEMO.COUNSELORS.find((c) => c.name === i.counselor) || {}).avatar} />{i.counselor}</span></td>
                    <td><span className="cell-muted mono" style={{ fontSize: 12 }}>{i.time?.slice(11)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

export function InquiryDetail({ inq, onBack, onRespond, isCompleted }) {
  const i = inq || DEMO.INQUIRIES[0]
  const [draft, setDraft] = useState(i.ai)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sendError, setSendError] = useState(null)
  useEffect(() => { setDraft(i.ai); setSent(false); setSending(false); setRegenerating(false); setPreviewOpen(false); setSendError(null) }, [i.id])

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      const result = await regenerateDraft(i.id)
      setDraft(result.draft)
    } catch {
      // 실패 시 기존 초안 유지
    } finally {
      setRegenerating(false)
    }
  }

  async function handleSend() {
    setSending(true)
    setSendError(null)
    try {
      await sendResponse(i.id, draft)
      setSent(true)
      setPreviewOpen(false)
      onRespond?.(i.id)
    } catch {
      setSendError('응답 발송에 실패했습니다. 잠시 후 다시 시도해주세요.')
      setPreviewOpen(false)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="staff scroll">
      <div className="detail-top">
        <button className="back-btn" onClick={onBack}><Icon name="arrow-left" size={16} />대시보드</button>
        <div className="detail-id">
          <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{i.id}</span>
          <CatTag name={i.category} />
          <UrgencyBadge level={i.urgency} />
          <StatusBadge status={sent ? '응답완료' : i.status} />
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-col">
          <Card>
            <div className="detail-block-head"><Icon name="message-square" size={15} /><span className="t-h3">문의 원문 (마스킹됨)</span>
              <span className="cell-muted" style={{ marginLeft: 'auto' }}><Icon name={i.channel === '이메일' ? 'mail' : 'globe'} size={13} />{i.channel}</span></div>
            <p className="detail-body">{i.excerpt}</p>
            <div className="detail-from">
              <Avatar name={i.name} size={24} color="#9CA3AF" />
              <div><div className="t-sm" style={{ fontWeight: 600, color: 'var(--ink)' }}>{i.name}</div><div className="t-cap mono">{i.contact}</div></div>
              <span className="t-cap" style={{ marginLeft: 'auto' }}>{i.time}</span>
            </div>
          </Card>
          <Card>
            <div className="detail-block-head"><Icon name="shield" size={15} /><span className="t-h3">탐지·마스킹된 개인정보</span></div>
            <ul className="pii-list">
              {(i.detected || []).map((d) => (
                <li key={d.type}><span className="pii-type">{d.type}</span><Icon name="arrow-right" size={12} /><span className="mono">{d.masked}</span><Badge tone="success" style={{ marginLeft: 'auto' }}>저장 시 마스킹</Badge></li>
              ))}
            </ul>
          </Card>
          <Card>
            <div className="detail-block-head"><Icon name="route" size={15} /><span className="t-h3">자동 분류 근거</span></div>
            <ul className="reason-list">
              {(i.reason || []).map((r, n) => <li key={n}><Icon name="check" size={13} />{r}</li>)}
            </ul>
          </Card>
        </div>

        <div className="detail-col">
          <Card className="ai-card">
            <div className="ai-card-top"><Icon name="sparkles" size={15} /><span>AI 응답 초안 · {i.handling === '템플릿' ? '템플릿 폴백' : 'HyperCLOVA X'}</span>
              <Badge tone="blue" icon="shield-check" style={{ marginLeft: 'auto' }}>PII 마스킹</Badge></div>
            <textarea className="input textarea draft-area" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="ai-foot"><Icon name="info" size={13} />상담원이 검토·수정한 뒤 발송합니다. · 예상 비용 약 ₩{i.handling === '수동' ? 0 : 38} (데모)</div>
          </Card>
          <div className="detail-actions">
            <Btn variant="secondary" size="md" icon={regenerating ? 'loader' : 'wand-2'} onClick={handleRegenerate} disabled={regenerating || sent || isCompleted}>{regenerating ? '생성 중…' : 'AI 다시 생성'}</Btn>
            <Btn variant="ghost" size="md" icon="file-text" disabled>템플릿 불러오기</Btn>
          </div>
          <div className="detail-send">
            {(sent || isCompleted)
              ? <div className="sent-note"><Icon name="check-circle" size={16} />응답이 발송되었습니다 · 상태가 '응답완료'로 변경되었습니다.</div>
              : <>
                  {sendError && <div className="field-err" style={{ marginBottom: 8 }}><Icon name="alert-circle" size={13} />{sendError}</div>}
                  <Btn variant="primary" size="lg" block icon="send" onClick={() => setPreviewOpen(true)}>응답 발송</Btn>
                </>}
          </div>
        </div>
      </div>
      {previewOpen && <ResponsePreviewModal inq={i} draft={draft} sending={sending} onConfirm={handleSend} onClose={() => setPreviewOpen(false)} />}
    </div>
  )
}

export function Monitor() {
  const [tick, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t) }, [])

  const queue = DEMO.INQUIRIES.filter((i) => i.status !== '응답완료').slice(0, 5)
  function countdown(base, offset) {
    const total = base - (tick + offset) % (base + 30)
    const m = Math.max(0, Math.floor(total / 60)), s = Math.max(0, total % 60)
    return { txt: `${String(m).padStart(2, '0')}:${String(Math.abs(s)).padStart(2, '0')}`, danger: total < 60, warn: total < 180 }
  }

  return (
    <div className="staff scroll">
      <div className="staff-head">
        <div>
          <h1 className="t-h1">실시간 모니터링</h1>
          <p className="t-cap" style={{ marginTop: 3 }}><span className="live-dot" />LIVE · 1초 간격 갱신 (데모)</p>
        </div>
        <Badge tone="success" dot>전 채널 정상</Badge>
      </div>
      <div className="kpi-grid kpi-grid-4">
        <Stat label="큐 대기" value={queue.length} sub="처리 대기 중" icon="layers" tone="blue" />
        <Stat label="평균 첫 응답" value="3.2" sub="분 · 목표 5분 이내">분</Stat>
        <Stat label="SLA 임박" value="2" sub="10분 내 마감" icon="timer" tone="danger" />
        <Stat label="시간당 처리량" value="47" sub="건 · 전일比 +12%" icon="activity" tone="success" />
      </div>
      <div className="monitor-grid">
        <Card pad={false} className="tbl-card">
          <div className="card-inner-head"><span className="t-h2">실시간 큐</span><Badge tone="blue">{queue.length}건</Badge></div>
          <ul className="queue-list">
            {queue.map((i, n) => {
              const cd = countdown(420, n * 47)
              return (
                <li key={i.id} className="queue-item">
                  <UrgencyBadge level={i.urgency} />
                  <div className="queue-mid">
                    <div className="queue-id mono">{i.id}</div>
                    <div className="t-cap">{i.category} · {i.handling}</div>
                  </div>
                  <div className={`sla${cd.danger ? ' sla-danger' : cd.warn ? ' sla-warn' : ''}`}>
                    <Icon name="timer" size={13} /><span className="mono tnum">{cd.txt}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
        <Card pad={false} className="tbl-card">
          <div className="card-inner-head"><span className="t-h2">상담원 워크로드</span><span className="t-cap">{DEMO.COUNSELORS.filter((c) => c.online).length}명 온라인</span></div>
          <ul className="workload-list">
            {DEMO.COUNSELORS.map((c) => {
              const pct = Math.round(c.load / c.cap * 100)
              const tone = pct >= 85 ? 'danger' : pct >= 60 ? 'warning' : 'success'
              return (
                <li key={c.id} className="workload-item">
                  <Avatar name={c.name} color={c.avatar} size={30} />
                  <div className="workload-mid">
                    <div className="workload-top"><span className="t-sm" style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.name}</span><span className="t-cap">{c.team}</span></div>
                    <div className="workload-bar"><span style={{ width: pct + '%', background: `var(--${tone})` }} /></div>
                  </div>
                  <div className="workload-num"><span className="tnum" style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.load}/{c.cap}</span><span className={`online-dot${c.online ? ' on' : ''}`} /></div>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </div>
  )
}

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#0D9488', '#D97706', '#DB2777', '#0EA5E9', '#16A34A', '#DC2626']

export function CounselorsAdmin() {
  const [counselors, setCounselors] = useState(DEMO.COUNSELORS.map((c) => ({ ...c, focus: [...c.focus] })))
  const [telegramOpen, setTelegramOpen] = useState(false)
  const [telegramTarget, setTelegramTarget] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTarget, setSettingsTarget] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyTarget, setHistoryTarget] = useState(null)

  const onlineCount = counselors.filter((c) => c.online).length

  function toggleOnline(id) { setCounselors((prev) => prev.map((c) => c.id === id ? { ...c, online: !c.online } : c)) }
  function toggleCat(id, cat) {
    setCounselors((prev) => prev.map((c) => {
      if (c.id !== id) return c
      const focus = c.focus.includes(cat) ? c.focus.filter((f) => f !== cat) : [...c.focus, cat]
      return { ...c, focus }
    }))
  }
  function updateCap(id, delta) { setCounselors((prev) => prev.map((c) => c.id === id ? { ...c, cap: Math.max(1, Math.min(10, c.cap + delta)) } : c)) }

  return (
    <div className="staff scroll">
      <div className="staff-head">
        <div>
          <h1 className="t-h1">상담원 관리</h1>
          <p className="t-cap" style={{ marginTop: 3 }}>배정 가능 여부 · 전담 카테고리 · 수용 한도 설정</p>
        </div>
        <div className="staff-head-r">
          <Badge tone={onlineCount > 0 ? 'success' : 'neutral'} dot>{onlineCount}명 온라인</Badge>
          <Btn variant="secondary" size="md" icon="send" onClick={() => { setTelegramTarget(null); setTelegramOpen(true) }}>텔레그램 알림</Btn>
          <Btn variant="primary" size="md" icon="user-plus" onClick={() => setAddOpen(true)}>상담원 추가</Btn>
        </div>
      </div>
      <div className="kpi-grid kpi-grid-4" style={{ marginBottom: 20 }}>
        <Stat label="전체 상담원" value={counselors.length} sub="등록된 계정" icon="users" />
        <Stat label="현재 온라인" value={onlineCount} sub="활성 상담원" icon="circle-dot" tone="success" />
        <Stat label="총 수용 한도" value={counselors.reduce((s, c) => s + c.cap, 0)} sub="건 동시 처리" icon="layers" tone="blue" />
        <Stat label="현재 처리 중" value={counselors.reduce((s, c) => s + c.load, 0)} sub="배정된 문의 수" icon="loader" />
      </div>
      <div className="counselor-grid">
        {counselors.map((c) => {
          const pct = Math.round(c.load / c.cap * 100)
          const loadTone = pct >= 85 ? 'danger' : pct >= 60 ? 'warning' : 'success'
          return (
            <Card key={c.id} className="counselor-card">
              <div className="cc-top">
                <Avatar name={c.name} color={c.avatar} size={38} />
                <div className="cc-info"><div className="t-h3">{c.name}</div><div className="t-cap">{c.team}</div></div>
                <button className={`online-toggle${c.online ? ' online-toggle-on' : ''}`} onClick={() => toggleOnline(c.id)}>
                  <span className={`online-dot${c.online ? ' on' : ''}`} />{c.online ? '온라인' : '오프라인'}
                </button>
              </div>
              <div className="cc-load">
                <div className="cc-load-row">
                  <span className="t-label">워크로드</span>
                  <span className="tnum" style={{ fontSize: 12, fontWeight: 700, color: `var(--${loadTone})` }}>{c.load}/{c.cap}건 · {pct}%</span>
                </div>
                <div className="workload-bar"><span style={{ width: pct + '%', background: `var(--${loadTone})`, transition: 'width .4s' }} /></div>
              </div>
              <div>
                <div className="cc-section-label">전담 카테고리</div>
                <div className="cc-cats">
                  {DEMO.CATEGORIES.map((cat) => {
                    const on = c.focus.includes(cat)
                    const color = DEMO.CAT_TINT[cat] || 'var(--blue)'
                    return (
                      <button key={cat} className={`cat-toggle${on ? ' cat-toggle-on' : ''}`}
                        style={on ? { borderColor: color, color, background: color + '18' } : {}}
                        onClick={() => toggleCat(c.id, cat)}>{cat}</button>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="cc-section-label">수용 한도 (동시 처리 최대)</div>
                <div className="cc-cap-row">
                  <button className="cap-btn" onClick={() => updateCap(c.id, -1)} disabled={c.cap <= 1}>−</button>
                  <span className="cap-val tnum">{c.cap}건</span>
                  <button className="cap-btn" onClick={() => updateCap(c.id, +1)} disabled={c.cap >= 10}>+</button>
                  <span className="t-cap" style={{ marginLeft: 'auto' }}>최대 10건</span>
                </div>
              </div>
              <div className="cc-actions">
                <Btn variant="ghost" size="sm" icon="send" onClick={() => { setTelegramTarget(c); setTelegramOpen(true) }}>알림 발송</Btn>
                <Btn variant="ghost" size="sm" icon="settings" onClick={() => { setSettingsTarget(c); setSettingsOpen(true) }}>설정</Btn>
                <Btn variant="ghost" size="sm" icon="file-text" onClick={() => { setHistoryTarget(c); setHistoryOpen(true) }}>이력</Btn>
              </div>
            </Card>
          )
        })}
      </div>
      {telegramOpen && <TelegramModal counselor={telegramTarget} onClose={() => { setTelegramOpen(false); setTelegramTarget(null) }} />}
      {addOpen && <AddCounselorModal onClose={() => setAddOpen(false)} onAdd={(nc) => { setCounselors((prev) => [...prev, nc]); setAddOpen(false) }} />}
      {settingsOpen && settingsTarget && <SettingsCounselorModal counselor={settingsTarget} onClose={() => { setSettingsOpen(false); setSettingsTarget(null) }} onSave={(updated) => { setCounselors((prev) => prev.map((c) => c.id === updated.id ? updated : c)); setSettingsOpen(false); setSettingsTarget(null) }} />}
      {historyOpen && historyTarget && <HistoryCounselorModal counselor={historyTarget} onClose={() => { setHistoryOpen(false); setHistoryTarget(null) }} />}
    </div>
  )
}

function ResponsePreviewModal({ inq, draft, sending, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-preview-title">
        <div className="modal-head">
          <div className="modal-title-row">
            <span className="modal-icon"><Icon name="send" size={16} /></span>
            <span className="t-h2" id="modal-preview-title">응답 발송 확인</span>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="modal-inq-preview">
            <div className="inq-preview-row"><CatTag name={inq.category} /><UrgencyBadge level={inq.urgency} /><span className="mono t-cap">{inq.id}</span></div>
          </div>
          <Field label="발송될 응답 내용">
            <div style={{ background: 'var(--surface, #F9FAFB)', border: '1px solid var(--line)', borderRadius: 8, padding: '12px 14px', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {draft || '(응답 내용 없음)'}
            </div>
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 8 }}>
            <Badge tone="blue" icon="send">텔레그램으로 전송</Badge>
            <span className="t-cap">설정된 채널로 발송됩니다</span>
          </div>
          <div className="modal-foot">
            <Btn variant="secondary" size="md" onClick={onClose}>취소</Btn>
            <Btn variant="primary" size="md" icon={sending ? 'loader' : 'send'} onClick={onConfirm} disabled={sending}>
              {sending ? '발송 중…' : '발송 확인'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

function TelegramModal({ counselor, inq, onClose }) {
  const defaultMsg = inq
    ? `🚨 긴급 문의 접수\n문의ID: ${inq.id}\n카테고리: ${inq.category} · 긴급도: ${inq.urgency}\n담당: ${inq.counselor}\n\n내용 요약: ${inq.excerpt.slice(0, 60)}…`
    : counselor
    ? `📢 [헬프데스크 AI] ${counselor.name} 상담원님께 알림을 보냅니다.\n\n내용을 입력하세요.`
    : `📢 [헬프데스크 AI] 전체 상담원 채널 공지\n\n내용을 입력하세요.`

  const [msg, setMsg] = useState(defaultMsg)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const target = inq ? `${inq.counselor} 담당 채널` : counselor ? `${counselor.name} (${counselor.team})` : '전체 상담원 채널'

  function send() {
    if (!msg.trim()) return
    setSending(true)
    setTimeout(() => { setSending(false); setSent(true) }, 1300)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-telegram-title">
        <div className="modal-head">
          <div className="modal-title-row">
            <span className="modal-icon"><Icon name="send" size={16} /></span>
            <span className="t-h2" id="modal-telegram-title">텔레그램 알림 발송</span>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        {sent ? (
          <div className="modal-body modal-sent">
            <span className="modal-success-check"><Icon name="check" size={22} strokeWidth={3} /></span>
            <div className="t-h2" style={{ marginTop: 10 }}>알림이 발송되었습니다</div>
            <p className="t-sm" style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 4 }}>
              <b style={{ color: 'var(--ink)' }}>{target}</b>에게<br />텔레그램 메시지가 전송되었습니다. (데모)
            </p>
            <Btn variant="primary" size="md" onClick={onClose} style={{ marginTop: 8 }}>닫기</Btn>
          </div>
        ) : (
          <div className="modal-body">
            <div className="modal-target-row">
              <Icon name="at-sign" size={14} />
              <span className="t-sm">수신: <b style={{ color: 'var(--ink)' }}>{target}</b></span>
              <Badge tone="blue" style={{ marginLeft: 'auto' }}>Telegram Bot</Badge>
            </div>
            {inq && (
              <div className="modal-inq-preview">
                <div className="inq-preview-row"><CatTag name={inq.category} /><UrgencyBadge level={inq.urgency} /><span className="mono t-cap">{inq.id}</span></div>
              </div>
            )}
            <Field label="메시지 내용" required>
              <textarea className="input textarea" style={{ minHeight: 140, fontFamily: 'var(--mono)', fontSize: 13 }}
                value={msg} onChange={(e) => setMsg(e.target.value)} />
            </Field>
            <div className="modal-foot">
              <Btn variant="secondary" size="md" onClick={onClose}>취소</Btn>
              <Btn variant="primary" size="md" icon={sending ? 'loader' : 'send'} onClick={send} disabled={sending || !msg.trim()}>
                {sending ? '발송 중…' : '발송'}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AddCounselorModal({ onClose, onAdd }) {
  const [name, setName] = useState('')
  const [team, setTeam] = useState('일반')
  const [color, setColor] = useState(AVATAR_COLORS[0])
  const [touched, setTouched] = useState({})
  const nameErr = !name.trim() ? '이름을 입력해 주세요.' : null

  function submit(e) {
    e.preventDefault()
    setTouched({ name: 1 })
    if (nameErr) return
    onAdd({ id: 'c' + Date.now(), name: name.trim(), team, avatar: color, focus: [], load: 0, cap: 5, online: true })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-add-counselor-title">
        <div className="modal-head">
          <div className="modal-title-row">
            <span className="modal-icon"><Icon name="user-plus" size={16} /></span>
            <span className="t-h2" id="modal-add-counselor-title">상담원 추가</span>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <Field label="이름" required>
              <input className="input" placeholder="예: 김민수" value={name}
                onChange={(e) => setName(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: 1 }))} />
              {touched.name && nameErr && <span className="field-err"><Icon name="alert-circle" size={13} />{nameErr}</span>}
            </Field>
            <Field label="팀">
              <div className="select-wrap">
                <select className="input select" value={team} onChange={(e) => setTeam(e.target.value)}>
                  <option>일반</option><option>일반(우선)</option><option>개인정보 전담</option><option>전문(기술)</option>
                </select>
                <Icon name="chevron-down" size={16} className="select-chevron" />
              </div>
            </Field>
            <Field label="아바타 색상">
              <div className="color-picker">
                {AVATAR_COLORS.map((c) => (
                  <button key={c} type="button" className={`color-swatch${color === c ? ' color-swatch-on' : ''}`}
                    style={{ background: c }} onClick={() => setColor(c)}>
                    {color === c && <Icon name="check" size={12} strokeWidth={3} />}
                  </button>
                ))}
                <Avatar name={name || '?'} color={color} size={34} style={{ marginLeft: 6 }} />
              </div>
            </Field>
            <div className="modal-foot">
              <Btn variant="secondary" size="md" type="button" onClick={onClose}>취소</Btn>
              <Btn variant="primary" size="md" type="submit" icon="user-plus">추가</Btn>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function SettingsCounselorModal({ counselor, onClose, onSave }) {
  const [name, setName] = useState(counselor.name)
  const [team, setTeam] = useState(counselor.team)
  const [cap, setCap] = useState(counselor.cap)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-settings-title">
        <div className="modal-head">
          <div className="modal-title-row">
            <span className="modal-icon"><Icon name="settings" size={16} /></span>
            <span className="t-h2" id="modal-settings-title">{counselor.name} 설정</span>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <Field label="이름" required>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="팀">
            <div className="select-wrap">
              <select className="input select" value={team} onChange={(e) => setTeam(e.target.value)}>
                <option>일반</option><option>일반(우선)</option><option>개인정보 전담</option><option>전문(기술)</option>
              </select>
              <Icon name="chevron-down" size={16} className="select-chevron" />
            </div>
          </Field>
          <Field label="수용 한도">
            <div className="cc-cap-row">
              <button className="cap-btn" type="button" onClick={() => setCap((v) => Math.max(1, v - 1))}>−</button>
              <span className="cap-val tnum">{cap}건</span>
              <button className="cap-btn" type="button" onClick={() => setCap((v) => Math.min(10, v + 1))}>+</button>
              <span className="t-cap" style={{ marginLeft: 'auto' }}>최대 10건</span>
            </div>
          </Field>
          <div className="modal-foot">
            <Btn variant="secondary" size="md" onClick={onClose}>취소</Btn>
            <Btn variant="primary" size="md" icon="save" onClick={() => onSave({ ...counselor, name: name.trim() || counselor.name, team, cap })}>저장</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

function HistoryCounselorModal({ counselor, onClose }) {
  const history = DEMO.INQUIRIES.slice(0, 5)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-history-title">
        <div className="modal-head">
          <div className="modal-title-row">
            <span className="modal-icon"><Icon name="file-text" size={16} /></span>
            <span className="t-h2" id="modal-history-title">{counselor.name} 처리 이력</span>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {history.map((inq) => (
              <li key={inq.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600, minWidth: 56 }}>{inq.id}</span>
                <CatTag name={inq.category} />
                <UrgencyBadge level={inq.urgency} />
                <StatusBadge status={inq.status} />
                <span className="t-cap mono" style={{ marginLeft: 'auto', fontSize: 11 }}>{inq.time?.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
          <div className="modal-foot" style={{ marginTop: 16 }}>
            <Btn variant="secondary" size="md" onClick={onClose}>닫기</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
