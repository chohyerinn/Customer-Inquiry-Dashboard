import { useState, useEffect, useRef } from 'react'
import { DEMO } from '../data'
import { submitTicket } from '../api'
import {
  Icon, Btn, Badge, Card, Field, Input, Textarea, Select,
  Segmented, Spinner, Avatar, StatusBadge, CatTag, UrgencyBadge,
} from './ui'

function maskName(n) {
  const s = (n || '').trim()
  if (!s) return '고객**'
  return s[0] + '*'.repeat(Math.max(2, s.length - 1))
}
function maskContact(c) {
  const s = (c || '').trim()
  if (!s) return '—'
  if (s.includes('@')) {
    const [u, d] = s.split('@')
    return u.slice(0, Math.min(4, u.length)) + '***@' + (d || 'example.com')
  }
  const digits = s.replace(/\D/g, '')
  if (digits.length >= 7) return '010-****-' + digits.slice(-4)
  return s.slice(0, 2) + '****'
}
function maskBody(b) {
  return (b || '').replace(/\d{3}-?\d{3,4}-?\d{4}/g, '010-****-****')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, 'user***@example.com')
}
function detectUrgency(text) {
  const t = text || ''
  if (/(즉시|당장|긴급|급해|안 ?돼|안됩니다|두 ?번|중복|파손|깨|취소|환불|보상|분실|해킹|도용)/.test(t)) return '높음'
  if (t.length > 4) return '보통'
  return '보통'
}

export function CustomerForm({ initial, error, onSubmit, onDismissError }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [contact, setContact] = useState(initial?.contact ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [file, setFile] = useState(initial?.file ?? null)
  const [urgencyManual, setUrgencyManual] = useState(initial?.urgency ?? null)
  const [channel, setChannel] = useState('웹폼')
  const [touched, setTouched] = useState({})

  const autoUrg = detectUrgency(body)
  const urgency = urgencyManual ?? autoUrg

  const errs = {
    name: !name.trim() ? '이름을 입력해 주세요.' : null,
    contact: !contact.trim() ? '연락처를 입력해 주세요.' : null,
    category: !category ? '카테고리를 선택해 주세요.' : null,
    body: body.trim().length < 5 ? '문의 내용을 5자 이상 입력해 주세요.' : null,
  }
  const valid = !errs.name && !errs.contact && !errs.category && !errs.body

  function submit(e) {
    e.preventDefault()
    setTouched({ name: 1, contact: 1, category: 1, body: 1 })
    if (!valid) return
    const ch = channel === '이메일' ? 'email' : 'web'
    if (ch === 'email') {
      const subject = encodeURIComponent(`[헬프데스크] ${category} 문의`)
      const emailBody = encodeURIComponent(`이름: ${name}\n연락처: ${contact}\n카테고리: ${category}\n긴급도: ${urgency}\n\n${body}`)
      window.open(`mailto:support@example.com?subject=${subject}&body=${emailBody}`)
    }
    onSubmit({ name, contact, category, body, file, urgency, autoUrg, channel: ch })
  }

  return (
    <form className="cust-screen scroll" onSubmit={submit}>
      <div className="cust-inner">
        <header className="cust-hero">
          <h1 className="t-display">무엇을 도와드릴까요?</h1>
          <p className="cust-hero-sub">
            문의를 남기시면 <b>개인정보를 자동으로 가린 뒤</b>, AI가 즉시 답변 초안을 만들고 담당 상담원에게 연결해 드립니다.
          </p>
          <div className="flow-mini">
            {[['edit-3', '문의 접수'], ['shield', '개인정보 마스킹'], ['sparkles', 'AI 답변 초안'], ['user-check', '상담원 연결']].map(([ic, tx], i, a) => (
              <span key={tx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span className="flow-mini-step"><Icon name={ic} size={14} />{tx}</span>
                {i < a.length - 1 && <Icon name="chevron-right" size={14} className="flow-mini-arrow" />}
              </span>
            ))}
          </div>
        </header>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Segmented value={channel} onChange={setChannel} options={['웹폼', '이메일']} />
        </div>
        {channel === '이메일' && (
          <div className="banner" style={{ marginBottom: 16, background: 'var(--blue-soft, #EFF6FF)', borderColor: 'var(--blue)', color: 'var(--blue)' }}>
            <Icon name="mail" size={16} />
            <div className="banner-body">
              <div className="banner-title">이메일 문의</div>
              <div className="banner-msg">아래 양식을 작성하면 이메일 채널로 접수됩니다.</div>
            </div>
          </div>
        )}
        {error && (
          <div className="banner banner-error" role="alert">
            <Icon name="alert-circle" size={18} />
            <div className="banner-body">
              <div className="banner-title">{error.title || '문의 접수에 실패했어요'}</div>
              <div className="banner-msg">{error.message || '일시적인 오류로 접수가 완료되지 않았습니다. 입력하신 내용은 그대로 보관됩니다.'}</div>
              <div className="banner-actions">
                <Btn variant="danger" size="sm" icon="rotate-cw" onClick={(e) => { e.preventDefault(); submit(e) }}>다시 시도</Btn>
                <a className="banner-link" href="#">고객센터 1588-0000 연결</a>
              </div>
            </div>
            <button type="button" className="banner-x" onClick={onDismissError} aria-label="닫기"><Icon name="x" size={16} /></button>
          </div>
        )}

        <Card className="cust-card" pad={false}>
          <div className="cust-card-pad">
            <Field label="이름" required hint="제출 즉시 마스킹됩니다 (예: 홍**)">
              <Input value={name} onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, name: 1 }))}
                placeholder="이름을 입력하세요" />
              {touched.name && errs.name && <span className="field-err"><Icon name="alert-circle" size={13} />{errs.name}</span>}
            </Field>

            <Field label="연락처" required hint="이메일 또는 전화번호 · 제출 즉시 마스킹">
              <Input value={contact} onChange={(e) => setContact(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, contact: 1 }))}
                placeholder="user@example.com 또는 010-0000-0000" />
              {touched.contact && errs.contact && <span className="field-err"><Icon name="alert-circle" size={13} />{errs.contact}</span>}
            </Field>

            <div className="grid-2">
              <Field label="카테고리" required>
                <Select value={category} onChange={(e) => setCategory(e.target.value)}
                  options={DEMO.CATEGORIES} placeholder="선택하세요" />
                {touched.category && errs.category && <span className="field-err"><Icon name="alert-circle" size={13} />{errs.category}</span>}
              </Field>
              <Field label="긴급도" hint={`자동 감지: ${autoUrg} · 직접 변경 가능`}>
                <Segmented value={urgency} onChange={setUrgencyManual}
                  options={[
                    { value: '높음', label: '높음', tone: 'danger', dot: true },
                    { value: '보통', label: '보통', tone: 'warning', dot: true },
                    { value: '낮음', label: '낮음', tone: 'success', dot: true },
                  ]} />
              </Field>
            </div>

            <Field label="문의 내용" required>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, body: 1 }))}
                placeholder="문의하실 내용을 자세히 적어주세요. 주문번호가 있다면 함께 적어주시면 더 빠르게 도와드릴 수 있어요." />
              <div className="ta-foot">
                {touched.body && errs.body
                  ? <span className="field-err"><Icon name="alert-circle" size={13} />{errs.body}</span>
                  : <span />}
                <span className="t-cap tnum">{body.length}자</span>
              </div>
            </Field>

            <Field label="파일 첨부" hint="선택 · 스크린샷, 영수증 등">
              <label className="dropzone">
                <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0]?.name || null)} />
                <Icon name="paperclip" size={16} />
                <span>{file ? file : '파일 선택 또는 끌어다 놓기'}</span>
              </label>
            </Field>

            <div className="pii-note">
              <Icon name="shield-check" size={16} />
              <span>입력하신 이름·연락처는 <b>제출 즉시 자동 마스킹</b>되어 저장되며, 외부(AI)로는 가려진 값만 전달됩니다.</span>
            </div>
          </div>

          <div className="cust-submit-bar">
            <Btn type="submit" variant="primary" size="lg" block iconRight="arrow-right">문의 제출</Btn>
          </div>
        </Card>
      </div>
    </form>
  )
}

export function Processing({ payload, onDone }) {
  const steps = [
    { icon: 'shield',     label: '개인정보 탐지·마스킹',   detail: '이름·연락처를 가려 저장' },
    { icon: 'sparkles',   label: 'AI 답변 초안 생성',       detail: 'CLOVA Studio · HyperCLOVA X' },
    { icon: 'user-check', label: '담당 상담원 자동 배정',   detail: '긴급도 기반 라우팅' },
  ]
  const [active, setActive] = useState(0)
  const apiResultRef = useRef(null)

  useEffect(() => {
    const ac = new AbortController()
    let animReady = false
    let apiReady = false

    function tryFinish() {
      if (animReady && apiReady) onDone?.(apiResultRef.current)
    }

    submitTicket({ channel: payload?.channel || 'web', text: payload?.body || '' }, ac.signal)
      .then((r) => { apiResultRef.current = { success: true, ...r } })
      .catch(() => { apiResultRef.current = { success: false } })
      .finally(() => { apiReady = true; tryFinish() })

    const t1 = setTimeout(() => setActive(1), 1100)
    const t2 = setTimeout(() => setActive(2), 2200)
    const t3 = setTimeout(() => setActive(3), 3200)
    const t4 = setTimeout(() => { animReady = true; tryFinish() }, 3950)

    return () => { ac.abort(); [t1, t2, t3, t4].forEach(clearTimeout) }
  }, [])

  return (
    <div className="processing">
      <div className="processing-card">
        <Spinner size={34} stroke={3} />
        <div className="t-h1" style={{ marginTop: 18 }}>문의를 처리 중입니다…</div>
        <div className="t-sm" style={{ color: 'var(--muted)', marginTop: 4 }}>잠시만 기다려 주세요. 보통 몇 초 내에 완료됩니다.</div>
        <ul className="proc-steps">
          {steps.map((s, i) => {
            const state = i < active ? 'done' : i === active ? 'run' : 'wait'
            return (
              <li key={s.label} className={`proc-step proc-${state}`}>
                <span className="proc-ico">
                  {state === 'done' ? <Icon name="check" size={15} strokeWidth={2.6} />
                    : state === 'run' ? <Spinner size={15} stroke={2} color="#fff" />
                      : <Icon name={s.icon} size={15} />}
                </span>
                <div className="proc-text">
                  <span className="proc-label">{s.label}</span>
                  <span className="proc-detail">{s.detail}</span>
                </div>
                <span className="proc-state">{state === 'done' ? '완료' : state === 'run' ? '진행 중' : '대기'}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

const URGENCY_KO = { HIGH: '높음', MEDIUM: '보통', LOW: '낮음' }
const BACKEND_LABEL = { clova: 'HyperCLOVA X', template: '템플릿 폴백', manual: '수동' }

export function Result({ payload, apiResult, onNew, onDashboard, onDetail }) {
  const mName = maskName(payload?.name)
  const mContact = maskContact(payload?.contact)
  const isDemo = !apiResult?.success

  const id          = apiResult?.id || 'INQ-240601-0043'
  const urgency     = URGENCY_KO[apiResult?.urgency] || payload?.urgency || '보통'
  const category    = apiResult?.category || payload?.category || '일반'
  const maskedText  = apiResult?.masked_text || maskBody(payload?.body || '')
  const draft       = apiResult?.draft || `안녕하세요, ${mName} 고객님. 문의 주신 내용 잘 확인했습니다. 담당 상담원이 검토 후 가장 빠른 해결 방법으로 안내드리겠습니다.`
  const hasPii      = apiResult?.has_pii ?? true
  const piiTypes    = apiResult?.pii_types || []
  const reviewRequired = apiResult?.review_required ?? false
  const backendLabel = BACKEND_LABEL[apiResult?.backend] || 'AI 자동응답'
  const createdAt   = apiResult?.created_at
    ? apiResult.created_at.replace('T', ' ').slice(0, 16)
    : '—'
  const status      = reviewRequired ? '확인필요' : 'AI초안'
  const counselor   = urgency === '높음' ? '김서연' : category === '기술' ? '이수아' : '정민재'

  return (
    <div className="cust-screen scroll">
      <div className="cust-inner">
        <div className="result-top" style={{ animation: 'fadeUp .4s both' }}>
          <span className="result-check"><Icon name="check" size={26} strokeWidth={3} /></span>
          <h1 className="t-h1">문의가 접수되었습니다</h1>
          <p className="t-sm" style={{ color: 'var(--muted)' }}>담당 상담원이 AI 초안을 검토한 뒤 회신드립니다.</p>
          {isDemo && (
            <Badge tone="warning" icon="flask-conical" style={{ marginTop: 6 }}>데모 데이터 · 서버 미연결</Badge>
          )}
          <div className="result-meta">
            <div className="rm"><span className="t-cap">문의 ID</span><span className="mono rm-id">{id}</span></div>
            <div className="rm"><span className="t-cap">접수 시각</span><span className="rm-v">{createdAt}</span></div>
            <div className="rm"><span className="t-cap">담당 상담원</span><span className="rm-v rm-person"><Avatar name={counselor} size={20} />{counselor}</span></div>
            <div className="rm"><span className="t-cap">상태</span><StatusBadge status={status} /></div>
          </div>
        </div>

        <section className="rsec" style={{ animation: 'fadeUp .45s .05s both' }}>
          <div className="rsec-head">
            <span className="rsec-num">1</span>
            <span className="t-label" style={{ color: 'var(--blue)' }}>요약 · AI 응답 초안</span>
            <Badge tone="blue" icon="shield-check" style={{ marginLeft: 'auto' }}>개인정보 마스킹 적용</Badge>
          </div>
          <Card className="ai-card">
            <div className="ai-card-top">
              <Icon name="sparkles" size={15} />
              <span>AI가 작성한 답변 초안 · {backendLabel}</span>
            </div>
            <p className="ai-text">{draft}</p>
            <div className="ai-foot"><Icon name="info" size={13} />상담원 검토·수정 후 최종 발송됩니다.</div>
          </Card>
        </section>

        <section className="rsec" style={{ animation: 'fadeUp .45s .1s both' }}>
          <div className="rsec-head">
            <span className="rsec-num">2</span>
            <span className="t-label" style={{ color: 'var(--blue)' }}>근거 · 접수된 내용과 처리 기준</span>
          </div>
          <div className="grid-2 evidence-grid">
            <Card>
              <div className="t-label" style={{ marginBottom: 8 }}>접수된 원문 (마스킹됨)</div>
              <div className="evi-tags">
                <CatTag name={category} />
                <UrgencyBadge level={urgency} />
              </div>
              <p className="evi-body">{maskedText || '—'}</p>
              <div className="evi-from">— {mName} · {mContact}</div>
            </Card>
            <Card>
              <div className="t-label" style={{ marginBottom: 8 }}>탐지·마스킹된 개인정보</div>
              {hasPii && piiTypes.length > 0 ? (
                <ul className="pii-list">
                  {piiTypes.map((t) => (
                    <li key={t}>
                      <span className="pii-type">{t}</span>
                      <Icon name="arrow-right" size={12} />
                      <span className="mono">[MASKED]</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="pii-list">
                  <li><span className="pii-type">이름</span><Icon name="arrow-right" size={12} /><span className="mono">{mName}</span></li>
                  <li><span className="pii-type">연락처</span><Icon name="arrow-right" size={12} /><span className="mono">{mContact}</span></li>
                </ul>
              )}
              <div className="t-label" style={{ margin: '14px 0 8px' }}>자동 분류 근거</div>
              <ul className="reason-list">
                <li><Icon name="check" size={13} />카테고리: {category}</li>
                <li><Icon name="check" size={13} />긴급도: {urgency} (백엔드 분류)</li>
                <li><Icon name="check" size={13} />처리 방식: {backendLabel}{reviewRequired ? ' · 상담원 확인 필요' : ''}</li>
              </ul>
            </Card>
          </div>
        </section>

        <section className="rsec" style={{ animation: 'fadeUp .45s .15s both' }}>
          <div className="rsec-head">
            <span className="rsec-num">3</span>
            <span className="t-label" style={{ color: 'var(--blue)' }}>다음 행동</span>
          </div>
          <div className="next-actions">
            <button className="na-card na-primary" onClick={onDetail}>
              <Icon name="file-text" size={18} />
              <span className="na-t">처리 상황 보기</span>
              <span className="na-d">상담원 검토·발송 현황 확인</span>
              <Icon name="arrow-right" size={16} className="na-arrow" />
            </button>
            <button className="na-card" onClick={onNew}>
              <Icon name="plus" size={18} />
              <span className="na-t">새 문의 작성</span>
              <span className="na-d">다른 문의를 추가로 남기기</span>
              <Icon name="arrow-right" size={16} className="na-arrow" />
            </button>
            <button className="na-card" onClick={onDashboard}>
              <Icon name="bell" size={18} />
              <span className="na-t">알림 받기 · 대시보드</span>
              <span className="na-d">상담원 응답 시 알림 (데모: 대시보드 이동)</span>
              <Icon name="arrow-right" size={16} className="na-arrow" />
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

export function CustomerHome({ inquiries, onNew }) {
  const urgencyKo = { HIGH: '높음', MEDIUM: '보통', LOW: '낮음' }

  return (
    <div className="cust-screen scroll">
      <div className="cust-inner">
        <header className="cust-hero">
          <h1 className="t-display">내 문의</h1>
          <p className="cust-hero-sub">접수한 문의와 AI 처리 상황을 확인하세요.</p>
        </header>

        {inquiries.length === 0 ? (
          <EmptyState
            title="아직 접수된 문의가 없습니다"
            desc="문의를 남기시면 AI가 즉시 처리해 드립니다."
            action={
              <Btn variant="primary" size="md" icon="edit-3" onClick={onNew} style={{ marginTop: 16 }}>
                문의하기
              </Btn>
            }
          />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <Btn variant="primary" size="md" icon="edit-3" onClick={onNew}>새 문의</Btn>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {inquiries.map((inq, i) => {
                const urgency = urgencyKo[inq.urgency] || inq.urgency || '보통'
                const status = inq.review_required ? '확인필요' : 'AI초안'
                const time = inq.created_at ? inq.created_at.replace('T', ' ').slice(0, 16) : '—'
                return (
                  <Card key={inq.id || i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{inq.id}</span>
                      <CatTag name={inq.category || '일반'} />
                      <UrgencyBadge level={urgency} />
                      <StatusBadge status={status} />
                      <span className="t-cap mono" style={{ fontSize: 11, marginLeft: 'auto' }}>{time}</span>
                    </div>
                    <p className="t-sm" style={{ marginTop: 6, color: 'var(--muted)' }}>
                      {inq.masked_text || '—'}
                    </p>
                  </Card>
                )
              })}
            </div>
          </>
        )}

      </div>
    </div>
  )
}

export function EmptyState({ title = '아직 접수된 문의가 없습니다', desc = '새 문의가 들어오면 여기에 표시됩니다.', action }) {
  return (
    <div className="empty">
      <div className="empty-art" aria-hidden="true">
        <Icon name="inbox" size={34} />
        <span className="empty-art-dot empty-art-dot1" />
        <span className="empty-art-dot empty-art-dot2" />
      </div>
      <div className="t-h2" style={{ marginTop: 14 }}>{title}</div>
      <p className="t-sm" style={{ color: 'var(--muted)', marginTop: 4, maxWidth: 320 }}>{desc}</p>
      {action}
    </div>
  )
}
