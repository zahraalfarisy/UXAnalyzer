/**
 * CalibratePage.jsx
 * Guides the user through eye tracker calibration.
 *
 * Flow:
 *  idle → user clicks "Start Calibration" → POST /api/calibrate
 *       → backend launches eyetrax dense-grid calibration (CV window pops up)
 *       → frontend polls status until idle again
 */
import { useState } from 'react'
import { Eye, CheckCircle, Grid3X3, Crosshair, AlertCircle } from 'lucide-react'
import { api } from '../api'
import { Card, SectionHeader, Button, Alert, StatTile, Spinner } from '../components/ui'
import { useSystemStatus } from '../hooks/useSystemStatus'

const STEPS = [
  {
    icon: Eye,
    title: 'Position yourself',
    desc: 'Sit ~60 cm from your screen. Ensure good lighting on your face. Avoid backlight.',
  },
  {
    icon: Grid3X3,
    title: '4×4 calibration grid',
    desc: 'A fullscreen window will appear with 16 target points. Look at each target as it pulses.',
  },
  {
    icon: Crosshair,
    title: 'Validation',
    desc: 'After calibration, 5 offset targets will validate accuracy. Target: < 80 px mean error.',
  },
  {
    icon: CheckCircle,
    title: 'Preview & confirm',
    desc: 'Live gaze preview appears. Press Enter to begin recording, R to recalibrate.',
  },
]

export default function CalibratePage() {
  const { status, isCalibrating, isBusy } = useSystemStatus()
  const [toast, setToast] = useState(null)

  const handleStart = async () => {
    try {
      setToast(null)
      await api.startCalibration()
      setToast({ type: 'info', msg: 'Calibration launched! Follow the on-screen targets in the CV window.' })
    } catch (e) {
      setToast({ type: 'error', msg: e.message })
    }
  }

  const done = status === 'idle' && toast?.type === 'info'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">

      {/* Header */}
      <div>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: 'rgba(0,122,255,0.10)' }}
        >
          <Eye size={24} style={{ color: 'var(--ios-blue)' }} />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--ios-label)' }}>
          Eye Tracker Calibration
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ios-label3)' }}>
          Calibrate gaze estimation before recording. Based on Hussain et al. (2021) dense-grid approach.
        </p>
      </div>

      {/* Alert */}
      {toast && (
        <Alert type={toast.type}>{toast.msg}</Alert>
      )}

      {/* Steps */}
      <Card>
        <SectionHeader title="How calibration works" />
        <div className="flex flex-col gap-4">
          {STEPS.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="flex gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(0,122,255,0.08)' }}
              >
                <Icon size={16} style={{ color: 'var(--ios-blue)' }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--ios-blue)', color: 'white', fontSize: 10 }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm font-semibold" style={{ color: 'var(--ios-label)' }}>{title}</p>
                </div>
                <p className="text-xs mt-1 ml-7" style={{ color: 'var(--ios-label3)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Accuracy reference card */}
      <Card>
        <SectionHeader
          title="Accuracy thresholds"
          subtitle="Based on Hussain et al. multimodal UX platform benchmarks"
        />
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Excellent" value="< 50" unit="px" accent="#34C759" />
          <StatTile label="Good"      value="< 80" unit="px" accent="#FF9500" />
          <StatTile label="Redo"      value="> 80" unit="px" accent="#FF3B30" />
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--ios-label3)' }}>
          Mean gaze error in pixels from screen diagonal. Lower is better.
          The system uses Kalman + EMA smoothing (Ridge regressor) per the paper's multimodal pipeline.
        </p>
      </Card>

      {/* Action */}
      {isCalibrating ? (
        <div
          className="rounded-2xl p-6 flex flex-col items-center gap-3"
          style={{ background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.15)' }}
        >
          <Spinner size={32} />
          <p className="text-sm font-semibold" style={{ color: 'var(--ios-blue)' }}>
            Calibration in progress
          </p>
          <p className="text-xs text-center" style={{ color: 'var(--ios-label3)' }}>
            Follow the targets in the fullscreen CV window. Don't close it.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            icon={Eye}
            onClick={handleStart}
            disabled={isBusy}
            className="w-full justify-center"
          >
            Start Calibration
          </Button>
          {isBusy && !isCalibrating && (
            <p className="text-xs text-center" style={{ color: 'var(--ios-label3)' }}>
              System is currently {status}. Wait until idle.
            </p>
          )}
        </div>
      )}

      {/* Tips */}
      <Alert type="warning" title="Tips for best results">
        Wear no glasses with anti-reflective coating that blocks IR. Disable variable refresh rate
        during calibration. Keep your head still — only move your eyes to follow the targets.
      </Alert>
    </div>
  )
}
