/**
 * Reusable iOS-style design system components
 */
import { AlertCircle, CheckCircle, Info, Loader2 } from 'lucide-react'

/* ── Card ──────────────────────────────────────────────────────────────── */
export function Card({ children, className = '', padding = true, style = {} }) {
  return (
    <div
      className={`surface-card ${padding ? 'surface-card--padded' : ''} ${className}`}
      style={{
        background: 'var(--ios-bg2)',
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
    <div className="section-header">
      <div>
        <h2 className="section-title" style={{ color: 'var(--ios-label)' }}>
          {title}
        </h2>
        {subtitle && (
          <p className="supporting-copy" style={{ color: 'var(--ios-label3)' }}>{subtitle}</p>
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
    sm: 'ui-button--sm',
    md: '',
    lg: 'ui-button--lg',
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
    inverse: {
      background: 'white',
      color: '#20264D',
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
      type="button"
      onClick={onClick}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={`ui-button ${sizes[size]} ${className}`}
      style={{
        ...variants[variant],
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        border: 'none',
      }}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : Icon ? <Icon size={15} /> : null}
      {children}
    </button>
  )
}

/* ── Alert / Toast ─────────────────────────────────────────────────────── */
const ALERT_STYLES = {
  info:    { icon: Info,         bg: 'var(--accent-soft)',  color: 'var(--accent)',    border: '#DCE0F7'  },
  success: { icon: CheckCircle,  bg: 'rgba(52,199,89,0.08)', color: 'var(--ios-success)', border: 'rgba(52,199,89,0.2)'  },
  error:   { icon: AlertCircle,  bg: 'rgba(255,59,48,0.08)', color: 'var(--ios-danger)',  border: 'rgba(255,59,48,0.2)'  },
  warning: { icon: AlertCircle,  bg: 'rgba(255,149,0,0.08)', color: 'var(--ios-warning)', border: 'rgba(255,149,0,0.2)'  },
}

export function Alert({ type = 'info', title, children }) {
  const s = ALERT_STYLES[type]
  const Icon = s.icon
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className="ui-alert"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <Icon size={18} style={{ color: s.color, flexShrink: 0, marginTop: 1 }} />
      <div className="min-w-0 max-w-prose break-words">
        {title && <p className="card-title" style={{ color: s.color }}>{title}</p>}
        <p className="body-copy" style={{ color: type === 'info' ? '#454F7D' : 'var(--ios-label2)' }}>{children}</p>
      </div>
    </div>
  )
}

/* ── Stat tile ─────────────────────────────────────────────────────────── */
export function StatTile({ label, value, unit, accent, icon: Icon }) {
  return (
    <div
      className="stat-tile"
    >
      {Icon && <span className="stat-icon"><Icon size={17} /></span>}
      <div className="stat-value" style={{ color: 'var(--ios-label)' }}>
        {value ?? '—'}
        {unit && <span>{unit}</span>}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

/* ── Badge ─────────────────────────────────────────────────────────────── */
export function Badge({ children, color = 'var(--ios-blue)' }) {
  return (
    <span
      className="ui-badge"
      style={{
        background: `color-mix(in srgb, ${color} 9%, white)`,
        color: readableColor(color),
        border: `1px solid color-mix(in srgb, ${color} 22%, white)`,
      }}
    >
      {children}
    </span>
  )
}

/* ── Spinner ───────────────────────────────────────────────────────────── */
export function Spinner({ size = 20 }) {
  return <span role="status" aria-label="Loading"><Loader2 size={size} className="animate-spin" style={{ color: 'var(--ios-blue)' }} /></span>
}

function readableColor(color) {
  return ({ '#34C759': '#187043', '#FF9500': '#895208', '#FF3B30': '#B42318', '#007AFF': 'var(--accent)', '#AF52DE': '#7355AB' })[color.toUpperCase()] ?? color
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
