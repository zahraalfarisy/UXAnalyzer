/**
 * Reusable iOS-style design system components
 */
import { AlertCircle, CheckCircle, Info, Loader2 } from 'lucide-react'

/* ── Card ──────────────────────────────────────────────────────────────── */
export function Card({ children, className = '', padding = true, style = {} }) {
  return (
    <div
      className={`rounded-2xl ${padding ? 'p-5' : ''} ${className}`}
      style={{
        background: 'var(--ios-bg2)',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--ios-separator)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ── Section header ────────────────────────────────────────────────────── */
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <h2 className="font-semibold text-base" style={{ color: 'var(--ios-label)' }}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--ios-label3)' }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}

/* ── Button ────────────────────────────────────────────────────────────── */
export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon: Icon,
  className = '',
}) {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-xl',
    md: 'px-5 py-2.5 text-sm rounded-2xl',
    lg: 'px-6 py-3 text-base rounded-2xl',
  }

  const variants = {
    primary: {
      background: disabled ? 'var(--ios-bg3)' : 'var(--ios-blue)',
      color: disabled ? 'var(--ios-label3)' : 'white',
      boxShadow: disabled ? 'none' : 'var(--shadow-blue)',
    },
    secondary: {
      background: 'var(--ios-fill)',
      color: 'var(--ios-label)',
    },
    danger: {
      background: disabled ? 'var(--ios-bg3)' : 'var(--ios-danger)',
      color: disabled ? 'var(--ios-label3)' : 'white',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ios-blue)',
    },
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 active:scale-95 ${sizes[size]} ${className}`}
      style={{
        ...variants[variant],
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        border: 'none',
        outline: 'none',
      }}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : Icon ? <Icon size={15} /> : null}
      {children}
    </button>
  )
}

/* ── Alert / Toast ─────────────────────────────────────────────────────── */
const ALERT_STYLES = {
  info:    { icon: Info,         bg: 'rgba(0,122,255,0.08)',  color: 'var(--ios-blue)',    border: 'rgba(0,122,255,0.2)'  },
  success: { icon: CheckCircle,  bg: 'rgba(52,199,89,0.08)', color: 'var(--ios-success)', border: 'rgba(52,199,89,0.2)'  },
  error:   { icon: AlertCircle,  bg: 'rgba(255,59,48,0.08)', color: 'var(--ios-danger)',  border: 'rgba(255,59,48,0.2)'  },
  warning: { icon: AlertCircle,  bg: 'rgba(255,149,0,0.08)', color: 'var(--ios-warning)', border: 'rgba(255,149,0,0.2)'  },
}

export function Alert({ type = 'info', title, children }) {
  const s = ALERT_STYLES[type]
  const Icon = s.icon
  return (
    <div
      className="rounded-2xl p-4 flex gap-3"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <Icon size={18} style={{ color: s.color, flexShrink: 0, marginTop: 1 }} />
      <div>
        {title && <p className="text-sm font-semibold mb-0.5" style={{ color: s.color }}>{title}</p>}
        <p className="text-sm" style={{ color: 'var(--ios-label2)' }}>{children}</p>
      </div>
    </div>
  )
}

/* ── Stat tile ─────────────────────────────────────────────────────────── */
export function StatTile({ label, value, unit, accent, icon: Icon }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1"
      style={{
        background: accent ? `rgba(${hexToRgb(accent)}, 0.08)` : 'var(--ios-fill2)',
        border: accent ? `1px solid rgba(${hexToRgb(accent)}, 0.18)` : '1px solid var(--ios-separator)',
      }}
    >
      {Icon && <Icon size={16} style={{ color: accent ?? 'var(--ios-label3)' }} />}
      <div className="text-2xl font-bold tabular-nums" style={{ color: accent ?? 'var(--ios-label)' }}>
        {value ?? '—'}
        {unit && <span className="text-base font-medium ml-1" style={{ color: 'var(--ios-label3)' }}>{unit}</span>}
      </div>
      <div className="text-xs" style={{ color: 'var(--ios-label3)' }}>{label}</div>
    </div>
  )
}

/* ── Badge ─────────────────────────────────────────────────────────────── */
export function Badge({ children, color = 'var(--ios-blue)' }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {children}
    </span>
  )
}

/* ── Spinner ───────────────────────────────────────────────────────────── */
export function Spinner({ size = 20 }) {
  return <Loader2 size={size} className="animate-spin" style={{ color: 'var(--ios-blue)' }} />
}

/* ── Progress bar ──────────────────────────────────────────────────────── */
export function ProgressBar({ value, max = 100, color = 'var(--ios-blue)' }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ios-bg3)' }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

/* ── Divider ───────────────────────────────────────────────────────────── */
export function Divider() {
  return <div className="my-4" style={{ borderTop: '1px solid var(--ios-separator)' }} />
}

/* ── Utility ───────────────────────────────────────────────────────────── */
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h, 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
