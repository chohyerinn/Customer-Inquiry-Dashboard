import { useState, useEffect, useRef } from 'react'
import * as LucideIcons from 'lucide-react'
import { DEMO } from '../data'

function toPascalCase(str) {
  return str.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
}

export function Icon({ name, size = 16, strokeWidth = 2, className = '', style }) {
  const LucideIcon = LucideIcons[toPascalCase(name)]
  if (!LucideIcon) return <span className={`app-icon ${className}`} style={style} />
  return (
    <span
      className={`app-icon ${className}`}
      style={{ fontSize: size, '--sw': strokeWidth, ...style }}
      aria-hidden="true"
    >
      <LucideIcon size={size} strokeWidth={strokeWidth} />
    </span>
  )
}

export function Btn({ children, variant = 'primary', size = 'md', icon, iconRight, block, onClick, type = 'button', disabled, style }) {
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      className={`btn btn-${variant} btn-${size}${block ? ' btn-block' : ''}`} style={style}>
      {icon && <Icon name={icon} size={size === 'lg' ? 18 : 16} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'lg' ? 18 : 16} />}
    </button>
  )
}

const TONE = {
  danger:  { bg: 'var(--danger-soft)',  fg: 'var(--danger)',  bd: 'var(--danger-line)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', bd: 'var(--warning-line)' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', bd: 'var(--success-line)' },
  blue:    { bg: 'var(--blue-soft)',    fg: 'var(--blue)',    bd: '#CFE0FF' },
  neutral: { bg: 'var(--soft-2)',       fg: 'var(--muted)',   bd: 'var(--line)' },
}

export function Badge({ tone = 'neutral', children, dot, icon, style }) {
  const t = TONE[tone] || TONE.neutral
  return (
    <span className="badge" style={{ background: t.bg, color: t.fg, borderColor: t.bd, ...style }}>
      {dot && <span className="badge-dot" style={{ background: t.fg }} />}
      {icon && <Icon name={icon} size={12} strokeWidth={2.4} />}
      {children}
    </span>
  )
}

export function UrgencyBadge({ level }) {
  const map = { 높음: 'danger', 보통: 'warning', 낮음: 'success' }
  return <Badge tone={map[level]} dot>{level}</Badge>
}

export function StatusBadge({ status }) {
  const map = {
    대기: 'neutral', 처리중: 'blue', AI초안: 'blue', 확인필요: 'warning',
    응답완료: 'success', 오류: 'danger',
  }
  const icon = { AI초안: 'sparkles', 확인필요: 'alert-triangle', 응답완료: 'check', 처리중: 'loader' }
  return <Badge tone={map[status] || 'neutral'} icon={icon[status]}>{status}</Badge>
}

export function CatTag({ name }) {
  const c = (DEMO?.CAT_TINT || {})[name] || '#6B7280'
  return (
    <span className="cattag" style={{ color: c }}>
      <span className="cattag-dot" style={{ background: c }} />{name}
    </span>
  )
}

export function Card({ children, className = '', pad = true, style }) {
  return <div className={`card${pad ? ' card-pad' : ''} ${className}`} style={style}>{children}</div>
}

export function Avatar({ name, color = '#2563EB', size = 28 }) {
  const initial = (name || '?').replace(/[^가-힣A-Za-z]/g, '').slice(-2) || '?'
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>
      {initial}
    </span>
  )
}

export function Field({ label, hint, required, children, htmlFor }) {
  return (
    <label className="field" htmlFor={htmlFor}>
      {label && <span className="field-label">{label}{required && <i className="req">*</i>}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Input(props) { return <input className="input" {...props} /> }
export function Textarea(props) { return <textarea className="input textarea" {...props} /> }

export function Select({ options = [], placeholder, ...rest }) {
  return (
    <div className="select-wrap">
      <select className="input select" {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <Icon name="chevron-down" size={16} className="select-chevron" />
    </div>
  )
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value
        const label = typeof o === 'string' ? o : o.label
        const active = v === value
        return (
          <button key={v} type="button" role="tab" aria-selected={active}
            className={`seg${active ? ' seg-on' : ''}`}
            data-tone={typeof o === 'object' ? o.tone : undefined}
            onClick={() => onChange(v)}>
            {typeof o === 'object' && o.dot && <span className="seg-dot" data-tone={o.tone} />}
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function Spinner({ size = 20, stroke = 2.5, color = 'var(--blue)' }) {
  return (
    <span className="spinner" style={{
      width: size, height: size, borderWidth: stroke,
      borderColor: `color-mix(in srgb, var(--blue) 18%, transparent)`, borderTopColor: color,
    }} />
  )
}

export function Stat({ label, value, sub, tone, icon, children }) {
  return (
    <Card className="stat">
      <div className="stat-top">
        <span className="t-label">{label}</span>
        {icon && <Icon name={icon} size={15} style={{ color: 'var(--faint)' }} />}
      </div>
      <div className="stat-val tnum">{value}{children}</div>
      {sub && <div className="stat-sub" style={tone ? { color: `var(--${tone})` } : null}>{sub}</div>}
    </Card>
  )
}

export function SectionHead({ title, desc, right, icon }) {
  return (
    <div className="sec-head">
      <div className="sec-head-l">
        {icon && <span className="sec-ico"><Icon name={icon} size={16} /></span>}
        <div>
          <div className="t-h2">{title}</div>
          {desc && <div className="t-cap" style={{ marginTop: 2 }}>{desc}</div>}
        </div>
      </div>
      {right}
    </div>
  )
}
