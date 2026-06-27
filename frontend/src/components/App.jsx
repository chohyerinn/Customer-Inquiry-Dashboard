import { useState } from 'react'
import { Icon, Badge, Btn, Field } from './ui'
import { CustomerForm, Processing, Result, EmptyState, CustomerHome } from './customer'
import { Dashboard, InquiryDetail, Monitor, CounselorsAdmin, adaptTicket } from './staff'

const NAV = [
  {
    group: '고객 흐름',
    items: [
      { route: '/empty', icon: 'inbox', label: '내 문의', hint: '/' },
    ],
  },
  {
    group: '상담원·관리자',
    items: [
      { route: '/dashboard',        icon: 'layout-dashboard', label: '문의 대시보드',   hint: '/dashboard' },
      { route: '/monitor',          icon: 'activity',          label: '실시간 모니터링', hint: '/monitor' },
      { route: '/admin/counselors', icon: 'users',             label: '상담원 관리',     hint: '/admin/counselors' },
    ],
  },
]

function routeMeta(route) {
  for (const g of NAV) {
    for (const item of g.items) {
      if (item.route === route) return item
    }
  }
  return { label: route, hint: '' }
}

const ADMIN_ROUTES = new Set(['/dashboard', '/inquiry', '/monitor', '/admin/counselors', '/clova-error'])
const ADMIN_PW = '1234'

function PasswordModal({ onSuccess, onClose }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  function check() {
    if (pw === ADMIN_PW) { onSuccess() }
    else { setErr(true); setPw('') }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title-row">
            <span className="modal-icon"><Icon name="lock" size={16} /></span>
            <span className="t-h2">상담원·관리자 인증</span>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <Field label="비밀번호" required>
            <input type="password" className="input" placeholder="비밀번호 입력"
              value={pw} autoFocus
              onChange={(e) => { setPw(e.target.value); setErr(false) }}
              onKeyDown={(e) => e.key === 'Enter' && check()} />
            {err && <span className="field-err"><Icon name="alert-circle" size={13} />비밀번호가 올바르지 않습니다.</span>}
          </Field>
          <p className="t-cap" style={{ color: 'var(--muted)', marginBottom: 12 }}>
            데모 비밀번호: <b style={{ color: 'var(--ink)', fontFamily: 'var(--mono)' }}>1234</b>
          </p>
          <div className="modal-foot">
            <Btn variant="secondary" size="md" onClick={onClose}>취소</Btn>
            <Btn variant="primary" size="md" icon="unlock" onClick={check}>확인</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState('/empty')
  const [viewport, setViewport] = useState('mobile')
  const [navOpen, setNavOpen] = useState(false)

  const [formPayload, setFormPayload] = useState(null)
  const [formInitial, setFormInitial] = useState(null)
  const [formError, setFormError] = useState(null)
  const [apiResult, setApiResult] = useState(null)
  const [activeInquiry, setActiveInquiry] = useState(null)
  const [submittedInquiries, setSubmittedInquiries] = useState([])
  const [isAdminAuth, setIsAdminAuth] = useState(false)
  const [pendingRoute, setPendingRoute] = useState(null)
  const [showPwModal, setShowPwModal] = useState(false)
  const [completedIds, setCompletedIds] = useState(new Set())

  function handleRespond(inqId) {
    setCompletedIds((prev) => new Set([...prev, inqId]))
  }

  const meta = routeMeta(route)
  const isMobile = viewport === 'mobile'

  function navigate(r) {
    if (ADMIN_ROUTES.has(r) && !isAdminAuth) {
      setPendingRoute(r)
      setShowPwModal(true)
      setNavOpen(false)
      return
    }
    setRoute(r)
    setNavOpen(false)
  }

  function handleSubmit(payload) {
    setFormPayload(payload)
    setFormInitial(payload)
    setFormError(null)
    setApiResult(null)
    navigate('/processing')
  }

  function handleProcessingDone(result) {
    setApiResult(result)
    if (result.success) {
      setSubmittedInquiries((prev) => [result, ...prev])
      navigate('/result')
    } else {
      setFormError({
        title: '문의 접수에 실패했어요',
        message: '일시적인 서버 오류로 접수가 완료되지 않았습니다. 입력하신 내용은 그대로 보관됩니다.',
      })
      navigate('/error')
    }
  }

  function handleOpenInquiry(inq) {
    setActiveInquiry(inq)
    navigate('/inquiry')
  }

  function renderScreen() {
    switch (route) {
      case '/':
        return (
          <CustomerForm
            initial={formInitial}
            error={formError}
            onSubmit={handleSubmit}
            onDismissError={() => setFormError(null)}
          />
        )
      case '/processing':
        return <Processing payload={formPayload} onDone={handleProcessingDone} />
      case '/result':
        return (
          <Result
            payload={formPayload}
            apiResult={apiResult}
            onNew={() => { setFormPayload(null); setFormInitial(null); navigate('/') }}
            onDashboard={() => navigate('/dashboard')}
            onDetail={() => { setActiveInquiry(apiResult?.success ? adaptTicket(apiResult, 0) : null); navigate('/inquiry') }}
          />
        )
      case '/error':
        return (
          <CustomerForm
            initial={formInitial}
            error={formError}
            onSubmit={handleSubmit}
            onDismissError={() => { setFormError(null); navigate('/') }}
          />
        )
      case '/empty':
        return (
          <CustomerHome
            inquiries={submittedInquiries}
            onNew={() => navigate('/')}
          />
        )
      case '/dashboard':
        return <Dashboard onOpenInquiry={handleOpenInquiry} completedIds={completedIds} />
      case '/clova-error':
        return <Dashboard onOpenInquiry={handleOpenInquiry} clovaStatus="오류" completedIds={completedIds} />
      case '/inquiry':
        return <InquiryDetail inq={activeInquiry} onBack={() => navigate('/dashboard')} onRespond={handleRespond} isCompleted={completedIds.has(activeInquiry?.id)} />
      case '/monitor':
        return <Monitor />
      case '/admin/counselors':
        return <CounselorsAdmin />
      default:
        return (
          <div className="staff scroll" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EmptyState title="404" desc={`'${route}'는 존재하지 않는 경로입니다.`} />
          </div>
        )
    }
  }

  return (
    <div className="workbench">
      {navOpen && <div className="wb-scrim" onClick={() => setNavOpen(false)} />}
      {showPwModal && (
        <PasswordModal
          onSuccess={() => {
            setIsAdminAuth(true)
            setShowPwModal(false)
            setRoute(pendingRoute)
            setPendingRoute(null)
          }}
          onClose={() => { setShowPwModal(false); setPendingRoute(null) }}
        />
      )}

      <nav className={`wb-nav${navOpen ? ' open' : ''}`}>
        <div className="wb-brand">
          <div className="wb-logo"><Icon name="headset" size={18} /></div>
          <div>
            <div className="wb-brand-name">헬프데스크 AI</div>
            <div className="wb-brand-sub">고객센터 문의 관리 · 화면 초안</div>
          </div>
        </div>

        <div className="wb-nav-scroll scroll">
          {NAV.map((g) => (
            <div key={g.group} className="wb-group">
              <div className="wb-group-t">{g.group}</div>
              {g.items.map((item) => (
                <button
                  key={item.route}
                  className={`wb-item${route === item.route ? ' active' : ''}`}
                  onClick={() => navigate(item.route)}
                >
                  <Icon name={item.icon} size={15} />
                  <span className="wb-item-l">{item.label}</span>
                  {item.hint && <span className="wb-item-r">{item.hint}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>

      </nav>

      <div className="wb-stage">
        <div className="wb-bar">
          <button className="wb-menu" onClick={() => setNavOpen(true)}>
            <Icon name="menu" size={18} />
          </button>
          <div className="wb-route">
            <Icon name="chevron-right" size={14} />
            {meta.hint && <span className="mono">{meta.hint}</span>}
            <span className="wb-route-name">{meta.label}</span>
          </div>
          <div className="wb-vp">
            <button className={`vp-btn${isMobile ? ' on' : ''}`} onClick={() => setViewport('mobile')}>
              <Icon name="smartphone" size={14} />모바일 390
            </button>
            <button className={`vp-btn${!isMobile ? ' on' : ''}`} onClick={() => setViewport('desktop')}>
              <Icon name="monitor" size={14} />데스크톱
            </button>
          </div>
        </div>

        <div className={`wb-area${isMobile ? ' area-mobile' : ' area-desktop'}`}>
          {isMobile ? (
            <div className="phone">
              <div className="phone-status">
                <span className="ps-time">14:36</span>
                <span className="ps-icons">
                  <Icon name="signal" size={14} />
                  <Icon name="wifi" size={14} />
                  <Icon name="battery-medium" size={14} />
                </span>
              </div>
              <div className="phone-screen">{renderScreen()}</div>
              <div className="phone-home" />
            </div>
          ) : (
            <div className="browser">
              <div className="browser-bar">
                <div className="bdots"><i /><i /><i /></div>
                <div className="browser-url">
                  <Icon name="lock" size={12} />
                  helpdesk.example.com{meta.hint || '/'}
                </div>
              </div>
              <div className="browser-screen">{renderScreen()}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
