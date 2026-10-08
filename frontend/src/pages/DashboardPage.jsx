/**
 * DashboardPage.jsx
 * Overview: recent sessions, aggregate stats, quick-action buttons.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Circle, BarChart2, ChevronRight, Activity, MousePointerClick, Zap } from 'lucide-react'
import { api } from '../api'
import { Card, SectionHeader, Button, StatTile, Badge, Spinner, Alert } from '../components/ui'
import { useSystemStatus } from '../hooks/useSystemStatus'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function SessionRow({ session, onClick }) {
  const hasFriction = session.friction_count > 0
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all duration-150 hover:scale-[1.005] active:scale-[0.995]"
      style={{
        background: 'var(--ios-bg2)',
        border: '1px solid var(--ios-separator)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Session icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: hasFriction ? 'rgba(255,59,48,0.08)' : 'rgba(0,122,255,0.08)' }}
      >
        <Activity size={18} style={{ color: hasFriction ? '#FF3B30' : '#007AFF' }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--ios-label)' }}>
            {session.session_id}
          </span>
          {hasFriction && (
            <Badge color="#FF3B30">{session.friction_count} friction</Badge>
          )}
          {session.has_calibration && (
            <Badge color="#34C759">calibrated</Badge>
          )}
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--ios-label3)' }}>
          {fmtDate(session.created_at)} · {session.gaze_samples?.toLocaleString()} gaze · {session.click_count} clicks
        </p>
      </div>

      <ChevronRight size={16} style={{ color: 'var(--ios-label3)', flexShrink: 0 }} />
    </button>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { status, isBusy, isRecording, sessionId } = useSystemStatus()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    try {
      setError(null)
      const data = await api.listSessions()
      setSessions(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Reload when recording finishes
  useEffect(() => {
    if (sessionId) load()
  }, [sessionId])

  /* aggregate stats */
  const totalGaze    = sessions.reduce((s, x) => s + (x.gaze_samples ?? 0), 0)
  const totalClicks  = sessions.reduce((s, x) => s + (x.click_count ?? 0), 0)
  const totalFriction= sessions.reduce((s, x) => s + (x.friction_count ?? 0), 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">

      {/* Hero card */}
      <div
        className="rounded-3xl overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, #007AFF 0%, #0055B3 100%)',
          boxShadow: '0 8px 40px rgba(0,122,255,0.30)',
          minHeight: 160,
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'white' }} />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full opacity-10"
          style={{ background: 'white' }} />

        <div className="relative p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">UX Analyzer</h1>
            <p className="text-sm text-blue-100 max-w-xs">
              Multimodal UX evaluation via eye tracking &amp; mouse behavioral analysis
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              icon={Eye}
              onClick={() => navigate('/calibrate')}
              className="!bg-white/20 !text-white hover:!bg-white/30"
            >
              Calibrate
            </Button>
            <Button
              icon={Circle}
              onClick={() => navigate('/record')}
              disabled={isBusy}
              className="!bg-white !text-blue-600 hover:!bg-blue-50"
            >
              {isRecording ? 'Recording…' : 'Record'}
            </Button>
          </div>
        </div>
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Sessions" value={sessions.length} icon={Activity} />
        <StatTile label="Gaze samples" value={totalGaze.toLocaleString()} accent="#007AFF" icon={Eye} />
        <StatTile label="Total clicks" value={totalClicks} accent="#FF9500" icon={MousePointerClick} />
        <StatTile label="Friction events" value={totalFriction} accent="#FF3B30" icon={Zap} />
      </div>

      {/* Status alert */}
      {isBusy && (
        <Alert type="info" title={`System ${status}…`}>
          {status === 'calibrating' && 'Eye tracker calibration in progress. Follow the on-screen targets.'}
          {status === 'recording'   && 'Recording session active. Click Stop in the Record page when done.'}
          {status === 'analyzing'   && 'Running fusion analysis on session data…'}
        </Alert>
      )}
      {error && <Alert type="error" title="Cannot reach backend">{error}</Alert>}

      {/* Recent sessions */}
      <Card padding={false}>
        <div className="p-5 pb-3">
          <SectionHeader
            title="Recent Sessions"
            subtitle={`${sessions.length} recorded session${sessions.length !== 1 ? 's' : ''}`}
            action={
              <Button size="sm" variant="ghost" icon={BarChart2} onClick={() => navigate('/results')}>
                View all
              </Button>
            }
          />
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <Spinner size={28} />
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="px-5 pb-6 text-center">
            <p className="text-sm" style={{ color: 'var(--ios-label3)' }}>
              No sessions yet. Start with calibration then record a session.
            </p>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div className="px-4 pb-4 flex flex-col gap-2">
            {sessions.slice(0, 8).map(s => (
              <SessionRow
                key={s.session_id}
                session={s}
                onClick={() => navigate(`/results/${s.session_id}`)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            title: 'Calibrate Eye Tracker',
            desc: 'Run 4×4 grid calibration before recording',
            icon: Eye,
            color: '#007AFF',
            to: '/calibrate',
          },
          {
            title: 'Start Recording',
            desc: 'Capture gaze + mouse behaviour simultaneously',
            icon: Circle,
            color: '#34C759',
            to: '/record',
          },
          {
            title: 'Analyse Results',
            desc: 'Review friction heatmap and event timeline',
            icon: BarChart2,
            color: '#FF9500',
            to: '/results',
          },
        ].map(({ title, desc, icon: Icon, color, to }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="p-4 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: `${color}0D`,
              border: `1px solid ${color}25`,
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${color}18` }}
            >
              <Icon size={18} style={{ color }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ios-label)' }}>{title}</p>
            <p className="text-xs" style={{ color: 'var(--ios-label3)' }}>{desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
