/**
 * RecordPage.jsx
 * Start / stop a recording session.
 *
 * Calls live_fusion.py via API which:
 *  1. Calibrates eye tracker (if no cached model)
 *  2. Records gaze (eyetrax) + mouse (pynput) simultaneously
 *  3. Saves session to data/sessions/<session_id>/
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Circle, Square, Clock, Eye, MousePointerClick } from 'lucide-react'
import { api } from '../api'
import { Card, SectionHeader, Button, Alert, StatTile } from '../components/ui'
import { useSystemStatus } from '../hooks/useSystemStatus'

function ElapsedTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => {
      setElapsed(Math.floor(Date.now() / 1000 - startedAt))
    }, 500)
    return () => clearInterval(id)
  }, [startedAt])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  return <span>{mm}:{ss}</span>
}

export default function RecordPage() {
  const navigate = useNavigate()
  const { status, isRecording, isBusy, sessionId } = useSystemStatus()
  const [toast, setToast] = useState(null)
  const [startedAt, setStartedAt] = useState(null)

  const handleStart = async () => {
    try {
      setToast(null)
      await api.startRecording()
      setStartedAt(Date.now() / 1000)
      setToast({ type: 'info', msg: 'Recording started! Navigate your website. Come back here to stop.' })
    } catch (e) {
      setToast({ type: 'error', msg: e.message })
    }
  }

  const handleStop = async () => {
    try {
      await api.stopRecording()
      setToast({ type: 'success', msg: 'Recording stopped! Analysis will run automatically.' })
      setStartedAt(null)
    } catch (e) {
      setToast({ type: 'error', msg: e.message })
    }
  }

  // Navigate to result when session is ready
  useEffect(() => {
    if (sessionId && !isRecording) {
      setTimeout(() => navigate(`/results/${sessionId}`), 1200)
    }
  }, [sessionId, isRecording])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">

      {/* Header */}
      <div>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: isRecording ? 'rgba(255,59,48,0.10)' : 'rgba(52,199,89,0.10)' }}
        >
          <Circle
            size={24}
            style={{ color: isRecording ? 'var(--ios-danger)' : 'var(--ios-success)' }}
            fill={isRecording ? 'var(--ios-danger)' : 'none'}
          />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--ios-label)' }}>
          Recording
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ios-label3)' }}>
          Simultaneously capture gaze and mouse behaviour during UX sessions.
        </p>
      </div>

      {/* Toast */}
      {toast && <Alert type={toast.type}>{toast.msg}</Alert>}

      {/* Live recording card */}
      {isRecording && (
        <div
          className="rounded-3xl p-6 flex flex-col items-center gap-4 relative overflow-hidden"
          style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.20)' }}
        >
          {/* Pulsing dot */}
          <div className="relative flex items-center justify-center">
            <span
              className="absolute inline-flex w-12 h-12 rounded-full opacity-30 animate-ping"
              style={{ background: 'var(--ios-danger)' }}
            />
            <span
              className="relative inline-flex w-8 h-8 rounded-full"
              style={{ background: 'var(--ios-danger)' }}
            />
          </div>

          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: 'var(--ios-danger)' }}>
              ● RECORDING
            </p>
            <p className="text-4xl font-bold tabular-nums mt-1" style={{ color: 'var(--ios-label)' }}>
              <ElapsedTimer startedAt={startedAt} />
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--ios-label3)' }}>
              Switch to your website and navigate normally. Return here to stop.
            </p>
          </div>

          <Button variant="danger" size="lg" icon={Square} onClick={handleStop} className="w-full justify-center">
            Stop Recording
          </Button>
        </div>
      )}

      {/* Pre-recording instructions */}
      {!isRecording && (
        <Card>
          <SectionHeader title="Before you record" />
          <div className="flex flex-col gap-3">
            {[
              { icon: Eye, text: 'Ensure eye tracker is calibrated (Calibrate tab)' },
              { icon: MousePointerClick, text: 'Open the website you want to test in a browser' },
              { icon: Circle, text: 'Click Start Recording below — a CV window will appear briefly' },
              { icon: Clock, text: 'Navigate the website naturally for 1–5 minutes' },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(0,122,255,0.08)' }}
                >
                  <Icon size={14} style={{ color: 'var(--ios-blue)' }} />
                </div>
                <p className="text-sm" style={{ color: 'var(--ios-label2)' }}>{text}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Stats hint */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="Gaze sampling"
          value="~30"
          unit="fps"
          accent="#007AFF"
          icon={Eye}
        />
        <StatTile
          label="Mouse events"
          value="All"
          accent="#34C759"
          icon={MousePointerClick}
        />
        <StatTile
          label="Recommended"
          value="1–5"
          unit="min"
          accent="#FF9500"
          icon={Clock}
        />
      </div>

      {/* Start button */}
      {!isRecording && (
        <Button
          size="lg"
          icon={Circle}
          onClick={handleStart}
          disabled={isBusy}
          className="w-full justify-center"
        >
          {isBusy ? `System ${status}…` : 'Start Recording'}
        </Button>
      )}

      <Alert type="info" title="What gets recorded">
        Gaze samples (x, y, timestamp) via eyetrax · Mouse moves, clicks, scrolls via pynput ·
        Calibration report saved with each session. Analysis runs automatically post-stop,
        detecting rage clicks and gaze↔mouse mismatches per Hussain et al. fusion methodology.
      </Alert>
    </div>
  )
}
