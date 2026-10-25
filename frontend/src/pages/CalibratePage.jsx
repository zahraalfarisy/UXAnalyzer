import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, ArrowRight } from 'lucide-react'
import { api } from '../api'
import { Button, Alert, Spinner } from '../components/ui'
import StepAccordion from '../components/StepAccordion'
import { useSystemStatus } from '../hooks/useSystemStatus'

const STEPS = [
  { title: 'Find your position', description: 'Sit about 60 cm from the screen, with your face evenly lit. Keep your head steady.' },
  { title: 'Follow the targets', description: 'Look at each of the 16 targets as it pulses in the fullscreen window.' },
  { title: 'Check accuracy', description: 'Follow five new targets to measure gaze accuracy. Lower error means better tracking.' },
  { title: 'Preview & save', description: <>Check the gaze preview. Press <kbd>Enter</kbd> to save or <kbd>R</kbd> to retry.</> },
]

export default function CalibratePage() {
  const { status, isCalibrating, isBusy, error } = useSystemStatus()
  const navigate = useNavigate()
  const wasCalibrating = useRef(false)
  const [completed, setCompleted] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [toast, setToast] = useState(null)

  const handleStart = async () => {
    setRequesting(true)
    setCompleted(false)
    try {
      setToast(null)
      await api.startCalibration()
      setToast({ type: 'info', msg: 'Follow the targets in the fullscreen window.' })
    } catch (e) {
      setToast({ type: 'error', msg: e.message })
    } finally {
      setRequesting(false)
    }
  }

  useEffect(() => {
    if (wasCalibrating.current && status === 'idle') {
      setCompleted(!error)
      setToast(error ? { type: 'error', msg: error } : { type: 'success', msg: 'Calibration saved. Ready to record.' })
    }
    wasCalibrating.current = isCalibrating
  }, [status, isCalibrating, error])

  return <div className="page-shell page-shell--setup">
    <header className="setup-heading">
      <h1 className="page-title">Calibrate your gaze.</h1>
      <p className="body-copy">A quick setup for accurate eye tracking.</p>
    </header>
    <div className="setup-grid">
      <section className="setup-steps" aria-labelledby="calibration-steps">
        <h2 id="calibration-steps" className="section-title">How it works</h2>
        <StepAccordion steps={STEPS} />
        <p className="metadata setup-footnote">Keep the same camera position and screen resolution when recording.</p>
      </section>
      <aside className="setup-side" aria-label="Calibration guide and controls">
        <div className="setup-summary">
          <h2 className="section-title">Accuracy guide</h2>
          <p className="supporting-copy">Mean gaze error · lower is better.</p>
          <dl className="summary-rows threshold-rows">
            <div><dt><span className="quality-mark quality-mark--good" />Excellent</dt><dd>&lt; 50 <span>px</span></dd></div>
            <div><dt><span className="quality-mark quality-mark--fair" />Good</dt><dd>50–&lt;80 <span>px</span></dd></div>
            <div><dt><span className="quality-mark quality-mark--poor" />Recalibrate</dt><dd>≥ 80 <span>px</span></dd></div>
          </dl>
          <p className="metadata">A practical guide, not a guarantee of session accuracy.</p>
        </div>
        <div className="setup-action">
          {toast && toast.type !== 'info' && <Alert type={toast.type}>{toast.msg}</Alert>}
          {isCalibrating ? <div className="process-status" role="status"><Spinner size={20} /><div><p className="card-title">Calibration in progress</p><p className="supporting-copy">Follow the fullscreen targets.</p></div></div>
            : <p className="supporting-copy">{completed ? 'Your gaze model is saved.' : 'A fullscreen target grid will open.'}</p>}
          {completed ? <>
            <Button size="lg" icon={ArrowRight} onClick={() => navigate('/record')} className="w-full">Continue to record</Button>
            <Button size="sm" variant="ghost" icon={Eye} onClick={handleStart} loading={requesting} disabled={isBusy}>Calibrate again</Button>
          </> : <Button size="lg" icon={Eye} onClick={handleStart} loading={requesting || isCalibrating} disabled={isBusy} className="w-full">
            {isCalibrating ? 'Calibrating…' : 'Start calibration'}
          </Button>}
          {isBusy && !isCalibrating && <p className="metadata" role="status">System is {status}. Wait until it finishes.</p>}
        </div>
      </aside>
    </div>
  </div>
}
