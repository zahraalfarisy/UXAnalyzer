/**
 * ResultsPage.jsx
 * List all recorded sessions with summary stats and navigate to detail.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, RefreshCw, ChevronRight, Activity, Eye, MousePointerClick, Zap } from 'lucide-react'
import { api } from '../api'
import { Card, SectionHeader, Button, Alert, Spinner, Badge } from '../components/ui'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function QualityBadge({ errorPx }) {
  if (errorPx == null) return null
  const [color, label] =
    errorPx < 50 ? ['#34C759', 'Excellent'] :
    errorPx < 80 ? ['#FF9500', 'Good']      :
                   ['#FF3B30', 'Poor']
  return <Badge color={color}>{label} · {errorPx.toFixed(1)}px</Badge>
}

export default function ResultsPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      setSessions(await api.listSessions())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--ios-label)' }}>Results</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ios-label3)' }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load} loading={loading}>
          Refresh
        </Button>
      </div>

      {error && <Alert type="error" title="Backend error">{error}</Alert>}

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div
          className="rounded-3xl p-12 flex flex-col items-center gap-3"
          style={{ background: 'var(--ios-bg2)', border: '1px dashed var(--ios-separator)' }}
        >
          <BarChart2 size={40} style={{ color: 'var(--ios-label3)' }} />
          <p className="text-base font-semibold" style={{ color: 'var(--ios-label2)' }}>No sessions yet</p>
          <p className="text-sm text-center" style={{ color: 'var(--ios-label3)' }}>
            Go to Calibrate, then Record to capture your first session.
          </p>
          <Button onClick={() => navigate('/calibrate')} icon={Eye}>Start Calibrating</Button>
        </div>
      )}

      {!loading && sessions.map((s) => (
        <button
          key={s.session_id}
          onClick={() => navigate(`/results/${s.session_id}`)}
          className="w-full text-left rounded-2xl overflow-hidden transition-all hover:scale-[1.005] active:scale-[0.995]"
          style={{
            background: 'var(--ios-bg2)',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--ios-separator)',
          }}
        >
          {/* Session header */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: s.friction_count > 0 ? 'rgba(255,59,48,0.08)' : 'rgba(0,122,255,0.08)' }}
              >
                <Activity size={18} style={{ color: s.friction_count > 0 ? '#FF3B30' : '#007AFF' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--ios-label)' }}>
                  {s.session_id}
                </p>
                <p className="text-xs" style={{ color: 'var(--ios-label3)' }}>
                  {fmtDate(s.created_at)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <QualityBadge errorPx={s.mean_error_px} />
              {s.friction_count > 0 && (
                <Badge color="#FF3B30">
                  <Zap size={10} className="mr-1" />
                  {s.friction_count} friction
                </Badge>
              )}
              <ChevronRight size={16} style={{ color: 'var(--ios-label3)' }} />
            </div>
          </div>

          {/* Metrics strip */}
          <div
            className="grid grid-cols-4 divide-x px-4 py-2"
            style={{
              borderTop: '1px solid var(--ios-separator)',
              divideColor: 'var(--ios-separator)',
            }}
          >
            {[
              { icon: Eye,              val: s.gaze_samples?.toLocaleString() ?? '—',  label: 'Gaze samples' },
              { icon: MousePointerClick,val: s.mouse_events?.toLocaleString() ?? '—',  label: 'Mouse events' },
              { icon: MousePointerClick,val: s.click_count ?? '—',                     label: 'Clicks' },
              { icon: Zap,              val: s.friction_count ?? '—',                  label: 'Frictions' },
            ].map(({ icon: Icon, val, label }, i) => (
              <div key={i} className="flex flex-col items-center py-1.5 px-2">
                <span className="text-base font-bold tabular-nums" style={{ color: 'var(--ios-label)' }}>
                  {val}
                </span>
                <span className="text-xs" style={{ color: 'var(--ios-label3)' }}>{label}</span>
              </div>
            ))}
          </div>
        </button>
      ))}
    </div>
  )
}
