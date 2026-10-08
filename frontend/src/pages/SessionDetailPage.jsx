/**
 * SessionDetailPage.jsx
 * Full analysis view for a single recorded session.
 *
 * Displays:
 *  - Calibration quality metrics
 *  - Gaze heatmap + mouse path + click markers + friction overlays
 *  - Friction events timeline
 *  - UI recommendations based on detected friction types
 *
 * Based on Hussain et al. (2021) multimodal deep log UX platform:
 *  - Eye tracking (fixations, gaze density) → attention maps
 *  - Mouse signals (rage clicks, hesitation, erratic movement) → friction scoring
 *  - Fusion: gaze↔mouse temporal alignment for mismatch detection
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Eye, Zap, MousePointerClick, CheckCircle,
  AlertCircle, RefreshCw, Lightbulb, BarChart2
} from 'lucide-react'
import { api } from '../api'
import {
  Card, SectionHeader, Button, Alert, StatTile, Badge, Spinner, Divider
} from '../components/ui'
import GazeHeatmap from '../components/GazeHeatmap'
import FrictionEventsList from '../components/FrictionEventsList'

/* ── UI Recommendations engine ─────────────────────────────────────────── */
function generateRecommendations(frictionEvents, calibration) {
  const recs = []
  const rageCt    = frictionEvents.filter(e => e.type === 'rage_click').length
  const mismatchCt= frictionEvents.filter(e => e.type === 'gaze_mouse_mismatch').length
  const hesitCt   = frictionEvents.filter(e => e.type === 'hesitation').length
  const erraticCt = frictionEvents.filter(e => e.type === 'erratic').length

  if (rageCt >= 2) recs.push({
    severity: 'high',
    title: 'Non-responsive elements detected',
    desc: `${rageCt} rage-click events recorded. Users repeatedly clicked the same area expecting a response. Consider making buttons/links more clearly interactive (larger hit target, visual feedback, loading state).`,
  })
  if (rageCt === 1) recs.push({
    severity: 'medium',
    title: 'One rage-click area',
    desc: 'A repeated-click event was detected. Check if the element has sufficient click feedback and response time.',
  })

  if (mismatchCt >= 3) recs.push({
    severity: 'high',
    title: 'Significant gaze–cursor divergence',
    desc: `${mismatchCt} gaze-mismatch events: users clicked areas their eyes weren't looking at. This may indicate confusing navigation, unclear affordances, or users clicking without reading. Improve visual hierarchy and CTA prominence.`,
  })
  if (mismatchCt === 1 || mismatchCt === 2) recs.push({
    severity: 'low',
    title: 'Minor gaze–cursor mismatch',
    desc: 'Some divergence between gaze and click position. Review element labelling and ensure important actions are visible in the user\'s primary gaze area.',
  })

  if (hesitCt >= 3) recs.push({
    severity: 'medium',
    title: 'Multiple hesitation events',
    desc: `Users paused ${hesitCt}× before clicking. Indicates decision uncertainty. Consider progressive disclosure, clearer labels, or micro-copy to reduce cognitive load.`,
  })

  if (erraticCt >= 3) recs.push({
    severity: 'medium',
    title: 'Erratic mouse movement',
    desc: 'Multiple erratic movement bursts detected — a signal of user frustration. Review whether the UI provides clear next-step guidance.',
  })

  if (calibration?.validation?.mean_error_px > 80) recs.push({
    severity: 'low',
    title: 'Low gaze accuracy — re-calibrate',
    desc: `Calibration error ${calibration.validation.mean_error_px.toFixed(1)}px (> 80px threshold). Gaze heatmap and mismatch data may be less reliable. Re-run calibration for cleaner data.`,
  })

  if (recs.length === 0) recs.push({
    severity: 'success',
    title: 'No significant friction detected',
    desc: 'This session shows minimal UX friction signals. The interface appears to be working well for this user.',
  })

  return recs
}

const SEV_STYLE = {
  high:    { color: '#FF3B30', bg: 'rgba(255,59,48,0.07)',  border: 'rgba(255,59,48,0.18)'  },
  medium:  { color: '#FF9500', bg: 'rgba(255,149,0,0.07)', border: 'rgba(255,149,0,0.18)'  },
  low:     { color: '#007AFF', bg: 'rgba(0,122,255,0.07)', border: 'rgba(0,122,255,0.18)'  },
  success: { color: '#34C759', bg: 'rgba(52,199,89,0.07)', border: 'rgba(52,199,89,0.18)'  },
}

function RecCard({ rec }) {
  const s = SEV_STYLE[rec.severity]
  const Icon = rec.severity === 'success' ? CheckCircle : AlertCircle
  return (
    <div
      className="rounded-2xl p-4 flex gap-3"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <Icon size={18} style={{ color: s.color, flexShrink: 0, marginTop: 1 }} />
      <div>
        <p className="text-sm font-semibold mb-1" style={{ color: s.color }}>{rec.title}</p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--ios-label2)' }}>{rec.desc}</p>
      </div>
    </div>
  )
}

/* ── Calibration quality panel ──────────────────────────────────────────── */
function CalibrationPanel({ cal }) {
  if (!cal) return (
    <Alert type="warning" title="No calibration data">
      This session has no calibration report attached.
    </Alert>
  )

  const v = cal.validation ?? {}
  const [qColor, qLabel] =
    v.mean_error_px < 50 ? ['#34C759', 'Excellent'] :
    v.mean_error_px < 80 ? ['#FF9500', 'Good']      :
                           ['#FF3B30', 'Poor']

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatTile
        label="Mean error"
        value={v.mean_error_px?.toFixed(1) ?? '—'}
        unit="px"
        accent={qColor}
        icon={Eye}
      />
      <StatTile
        label="p90 error"
        value={v.p90_error_px?.toFixed(1) ?? '—'}
        unit="px"
        accent={qColor}
      />
      <StatTile
        label="% screen diag"
        value={v.mean_error_screen_diagonal_pct?.toFixed(2) ?? '—'}
        unit="%"
      />
      <div
        className="rounded-2xl p-4 flex flex-col gap-1"
        style={{ background: `${qColor}0D`, border: `1px solid ${qColor}25` }}
      >
        <Badge color={qColor}>{qLabel}</Badge>
        <p className="text-xs mt-2" style={{ color: 'var(--ios-label3)' }}>
          Model: {cal.model ?? '—'} · Grid: {cal.grid?.join('×') ?? '—'}
        </p>
      </div>
    </div>
  )
}

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function SessionDetailPage() {
  const { sid } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [activeTab, setActiveTab] = useState('heatmap')

  const load = async () => {
    setLoading(true)
    try {
      setData(await api.getSession(sid))
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      await api.analyzeSession(sid)
      await new Promise(r => setTimeout(r, 2000))
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  useEffect(() => { load() }, [sid])

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Spinner size={36} />
    </div>
  )

  if (error) return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Alert type="error" title="Error loading session">{error}</Alert>
    </div>
  )

  const recs = generateRecommendations(data.friction_events ?? [], data.calibration)
  const cal = data.calibration
  const sw = cal?.screen_width  ?? 1920
  const sh = cal?.screen_height ?? 1080

  const TABS = [
    { id: 'heatmap',  label: 'Heatmap',         icon: Eye     },
    { id: 'friction', label: 'Friction Events',  icon: Zap     },
    { id: 'recs',     label: 'Recommendations',  icon: Lightbulb},
    { id: 'calib',    label: 'Calibration',      icon: BarChart2},
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">

      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/results')}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:opacity-70"
          style={{ background: 'var(--ios-fill)' }}
        >
          <ChevronLeft size={18} style={{ color: 'var(--ios-label)' }} />
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--ios-label)' }}>
            Session Detail
          </h1>
          <p className="text-xs" style={{ color: 'var(--ios-label3)' }}>{sid}</p>
        </div>
        <div className="ml-auto flex gap-2">
          {!analyzing && (
            <Button
              size="sm"
              variant="secondary"
              icon={RefreshCw}
              onClick={runAnalysis}
            >
              Re-analyse
            </Button>
          )}
          {analyzing && <Spinner size={20} />}
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Gaze samples"
          value={data.gaze_samples_count?.toLocaleString() ?? '—'}
          accent="#007AFF"
          icon={Eye}
        />
        <StatTile
          label="Clicks"
          value={data.clicks?.length ?? '—'}
          accent="#FF9500"
          icon={MousePointerClick}
        />
        <StatTile
          label="Friction events"
          value={data.friction_events?.length ?? '—'}
          accent={data.friction_events?.length > 0 ? '#FF3B30' : '#34C759'}
          icon={Zap}
        />
        <StatTile
          label="Recommendations"
          value={recs.length}
          accent="#AF52DE"
          icon={Lightbulb}
        />
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-1 p-1 rounded-2xl"
        style={{ background: 'var(--ios-fill)' }}
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: activeTab === id ? 'var(--ios-bg2)' : 'transparent',
              color: activeTab === id ? 'var(--ios-blue)' : 'var(--ios-label3)',
              boxShadow: activeTab === id ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab: Heatmap */}
      {activeTab === 'heatmap' && (
        <Card>
          <SectionHeader
            title="Gaze Heatmap & Mouse Path"
            subtitle={`${sw}×${sh}px · ${data.gaze_samples_count} gaze samples · ${data.clicks?.length} clicks`}
          />
          
          <div className="relative rounded-2xl overflow-hidden" style={{ background: '#0A0A0F', border: '1px solid rgba(255,255,255,0.06)' }}>
            <video 
              src={`/data/${sid}/screen.mp4`} 
              controls 
              loop 
              muted 
              className="w-full h-auto block"
              style={{ maxHeight: '70vh' }}
            />
            <div className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'screen' }}>
              <GazeHeatmap
                heatmap={data.heatmap ?? []}
                mousePath={data.mouse_path ?? []}
                clicks={data.clicks ?? []}
                frictionEvents={data.friction_events ?? []}
                screenWidth={sw}
                screenHeight={sh}
                transparentBg={true}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Tab: Friction events */}
      {activeTab === 'friction' && (
        <Card>
          <SectionHeader
            title="Friction Events"
            subtitle="Detected UX friction signals from fused gaze + mouse data"
            action={
              data.friction_events?.length === 0 && (
                <Button size="sm" variant="secondary" icon={RefreshCw} onClick={runAnalysis}>
                  Run analysis
                </Button>
              )
            }
          />
          <FrictionEventsList events={data.friction_events ?? []} />
        </Card>
      )}

      {/* Tab: Recommendations */}
      {activeTab === 'recs' && (
        <Card>
          <SectionHeader
            title="UI Recommendations"
            subtitle="Automatically generated from detected friction patterns"
          />
          <div className="flex flex-col gap-3">
            {recs.map((r, i) => <RecCard key={i} rec={r} />)}
          </div>
          <Divider />
          <Alert type="info" title="Methodology">
            Recommendations are derived from multimodal signal fusion (Hussain et al., 2021):
            rage-click detection (≥3 clicks / 1s window), gaze-mouse mismatch (&gt;150px divergence at click time),
            hesitation (mouse idle &gt;1.5s), and erratic movement (speed &gt;2000px/s).
          </Alert>
        </Card>
      )}

      {/* Tab: Calibration */}
      {activeTab === 'calib' && (
        <Card>
          <SectionHeader
            title="Eye Tracker Calibration Report"
            subtitle="Accuracy metrics from the session's gaze model"
          />
          <CalibrationPanel cal={cal} />

          {cal?.validation?.per_target?.length > 0 && (
            <>
              <Divider />
              <SectionHeader title="Per-target validation" />
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--ios-separator)' }}>
                      {['Target', 'Samples', 'Error (px)'].map(h => (
                        <th key={h} className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--ios-label3)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cal.validation.per_target.map((pt, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--ios-separator)' }}>
                        <td className="py-2 pr-4" style={{ color: 'var(--ios-label2)' }}>
                          ({Math.round(pt.target[0])}, {Math.round(pt.target[1])})
                        </td>
                        <td className="py-2 pr-4" style={{ color: 'var(--ios-label2)' }}>{pt.samples}</td>
                        <td className="py-2" style={{ color: 'var(--ios-label2)' }}>
                          {pt.median_position_error_px.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  )
}
