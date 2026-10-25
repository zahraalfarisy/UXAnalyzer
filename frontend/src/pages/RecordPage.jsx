import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Circle, Square, Monitor, Eye, MousePointerClick } from 'lucide-react'
import { api } from '../api'
import { Button, Alert } from '../components/ui'
import StepAccordion from '../components/StepAccordion'
import { useSystemStatus } from '../hooks/useSystemStatus'

const STEPS = [
  { title: 'Prepare your gaze', description: <>Finish <Link to="/calibrate">calibration</Link> first. Keep your camera and screen in the same position.</> },
  { title: 'Open your website', description: 'Open the page you want to test on your main screen.' },
  { title: 'Start & explore', description: 'Start recording, wait for valid gaze samples, then use your website naturally. Aim for 1–5 minutes.' },
  { title: 'Stop & review', description: 'Return here to stop. Your session saves automatically, ready for playback and page heatmaps.' },
]

function ElapsedTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startedAt) return
    const update = () => setElapsed(Math.max(0, Math.floor(Date.now() / 1000 - startedAt)))
    update()
    const id = setInterval(update, 500)
    return () => clearInterval(id)
  }, [startedAt])
  return <span>{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</span>
}

export default function RecordPage() {
  const navigate = useNavigate()
  const { status, isRecording, isBusy, sessionId, error, recordingMetrics, recordingStartedAt } = useSystemStatus()
  const [toast, setToast] = useState(null)
  const [startedAt, setStartedAt] = useState(null)
  const [requesting, setRequesting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const participated = useRef(false)

  const handleStart = async () => {
    setRequesting(true)
    setStopping(false)
    try {
      setToast(null)
      await api.startRecording()
      participated.current = true
      setStartedAt(Date.now() / 1000)
    } catch (e) {
      setToast({ type: 'error', msg: e.message })
    } finally {
      setRequesting(false)
    }
  }
  const handleStop = async () => {
    setStopping(true)
    try {
      await api.stopRecording()
      setToast({ type: 'info', msg: 'Saving your session…' })
    } catch (e) {
      setToast({ type: 'error', msg: e.message })
      setStopping(false)
    }
  }
  useEffect(() => {
    if (isRecording) participated.current = true
    if (sessionId && !isRecording && !error && participated.current) {
      const id = setTimeout(() => {
        participated.current = false
        navigate(`/results/${sessionId}`)
      }, 1200)
      return () => clearTimeout(id)
    }
  }, [sessionId, isRecording, error, navigate])

  const saving = stopping && !error && toast?.type !== 'error'
  return <div className="page-shell page-shell--setup">
    <header className="setup-heading">
      <h1 className="page-title">Record the experience.</h1>
      <p className="body-copy">Your screen, gaze, and clicks. In sync.</p>
    </header>
    <div className="setup-grid">
      <section className="setup-steps" aria-labelledby="record-steps">
        <h2 id="record-steps" className="section-title">Before you begin</h2>
        <StepAccordion steps={STEPS} />
        <p className="metadata setup-footnote">Screen and tracking data stay in your local session folder.</p>
      </section>
      <aside className="setup-side" aria-label="Recording summary and controls">
        <div className="setup-summary">
          <h2 className="section-title">Session capture</h2>
          <dl className="summary-rows">
            <div><dt><Monitor size={17} />Screen</dt><dd>Playback video</dd></div>
            <div><dt><Eye size={17} />Gaze</dt><dd>Page heatmaps</dd></div>
            <div><dt><MousePointerClick size={17} />Mouse</dt><dd>Moves & clicks</dd></div>
          </dl>
          <p className="metadata">Recommended session: 1–5 minutes.</p>
        </div>
        <div className="setup-action">
          {error && <Alert type="error" title="Recording failed">{error}</Alert>}
          {toast?.type === 'error' && <Alert type="error">{toast.msg}</Alert>}
          {isRecording && <div className="record-progress">
            <div className="record-progress-heading"><span className="record-indicator" />{saving ? 'Saving session' : 'Recording'}<strong className="numeric"><ElapsedTimer startedAt={recordingStartedAt ?? startedAt} /></strong></div>
            {!recordingMetrics ? <p className="supporting-copy" role="status">Starting camera. Wait for valid gaze before your task.</p>
              : <>
                <p className="metadata numeric" role="status">{recordingMetrics.valid_frames} valid gaze / {recordingMetrics.frames} camera frames</p>
                {!recordingMetrics.valid_frames && <p className="tracking-warning" role="status">No gaze yet. Keep your face visible; recalibrate if this stays at zero.</p>}
                {recordingMetrics.video_error && <Alert type="error" title="Screen capture failed">{recordingMetrics.video_error}</Alert>}
              </>}
          </div>}
          {isRecording ? <Button variant="danger" size="lg" icon={Square} onClick={handleStop} loading={saving} className="w-full">{saving ? 'Saving session…' : 'Stop & save session'}</Button>
            : <>
              <p className="supporting-copy">{saving ? 'Finishing your session…' : 'Open your website, then start.'}</p>
              <Button size="lg" icon={Circle} onClick={handleStart} disabled={isBusy || saving} loading={requesting || saving} className="w-full">{saving ? 'Saving session…' : 'Start recording'}</Button>
            </>}
          {isBusy && !isRecording && <p className="metadata" role="status">System is {status}. Wait until it finishes.</p>}
        </div>
      </aside>
    </div>
  </div>
}
