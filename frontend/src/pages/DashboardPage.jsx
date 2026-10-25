/**
 * DashboardPage.jsx
 * Overview: recent sessions, aggregate stats, quick-action buttons.
 */
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, Circle, BarChart2, ChevronRight, Activity, ArrowRight } from 'lucide-react'
import { api } from '../api'
import { Card, SectionHeader, Button, Badge, Spinner, Alert } from '../components/ui'
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
      className="session-row"
    >
      {/* Session icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: hasFriction ? 'rgba(255,59,48,0.08)' : 'rgba(0,122,255,0.08)' }}
      >
        <Activity size={18} style={{ color: hasFriction ? 'var(--ios-danger)' : 'var(--accent)' }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="card-title" style={{ color: 'var(--ios-label)' }}>
            {fmtDate(session.created_at)}
          </span>
          {hasFriction && (
            <Badge color="#FF3B30">{session.friction_count} friction</Badge>
          )}
          {!session.gaze_samples && <Badge color="#FF9500">No gaze data</Badge>}
        </div>
        <p className="metadata mt-1" style={{ color: 'var(--ios-label3)' }}>
          {session.gaze_samples?.toLocaleString() ?? 0} gaze samples · {session.click_count ?? 0} clicks
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
    <div className="page-shell landing-page">
      <section className="landing-hero" aria-labelledby="home-title">
          <div className="landing-hero-copy">
            <h1 id="home-title">See where users look.</h1>
            <p>Capture the screen, gaze, and clicks. Turn each session into a clearer picture.</p>
            <div className="landing-actions">
            <Button
              variant="inverse"
              icon={isRecording ? Circle : Eye}
              onClick={() => navigate(isRecording ? '/record' : '/calibrate')}
              disabled={isBusy && !isRecording}
            >
              {isRecording ? 'View recording' : 'Start a session'}
            </Button>
            <Link to="/results">View sessions <ArrowRight size={16} /></Link>
            </div>
          </div>
          <nav className="landing-workflow" aria-label="Research workflow">
            {[
              { to: '/calibrate', title: 'Calibrate', description: 'Set up your gaze' },
              { to: '/record', title: 'Record', description: 'Explore your website' },
              { to: '/results', title: 'Review', description: 'Find patterns in attention' },
            ].map((step, index) => <Link key={step.to} to={step.to}>
              <span className="landing-step-number">{index + 1}</span>
              <span><strong>{step.title}</strong><small>{step.description}</small></span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>)}
          </nav>
      </section>

      <dl className="research-totals" aria-label="Research totals">
        {[
          ['Sessions', sessions.length], ['Gaze samples', totalGaze.toLocaleString()],
          ['Clicks', totalClicks.toLocaleString()], ['Friction events', totalFriction.toLocaleString()],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="numeric">{loading || error ? '—' : value}</dd></div>)}
      </dl>

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
        <div className="recent-header">
          <SectionHeader
            title="Recent Sessions"
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
            <p className="body-copy mx-auto" style={{ color: 'var(--ios-label3)' }}>
              No sessions yet. Start with calibration then record a session.
            </p>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div className="session-rows">
            {sessions.slice(0, 3).map(s => (
              <SessionRow
                key={s.session_id}
                session={s}
                onClick={() => navigate(`/results/${s.session_id}`)}
              />
            ))}
          </div>
        )}
      </Card>

    </div>
  )
}
