import { useEffect, useRef, useState } from 'react'
import { Alert } from './ui'
import { gazeAt, mouseAt } from './playbackTimeline'

export default function SessionPlayback({ data, screenWidth, screenHeight }) {
  const videoRef = useRef(null)
  const [time, setTime] = useState(0)
  const [failed, setFailed] = useState(false)
  const [showGaze, setShowGaze] = useState(true)
  const [showMouse, setShowMouse] = useState(true)
  useEffect(() => {
    let frame
    const update = () => {
      if (videoRef.current) setTime(Math.round(videoRef.current.currentTime * 10) / 10)
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [])
  if (!data.video_url) return <Alert type="warning" title="No screen video">This session has no playable screen recording.</Alert>
  const timestamp = (data.video_started_at ?? 0) + time
  const gaze = gazeAt(data.gaze_samples ?? [], timestamp)
  const mouse = mouseAt(data.mouse_samples ?? [], timestamp)
  const clicks = (data.clicks ?? []).filter(c => timestamp >= c.timestamp && timestamp - c.timestamp < .4)
  const events = (data.friction_events ?? []).filter(e => e.timestamp >= data.video_started_at)
  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--ios-label2)' }}>
      <label><input type="checkbox" checked={showGaze} onChange={e => setShowGaze(e.target.checked)} /> Gaze (green)</label>
      <label><input type="checkbox" checked={showMouse} onChange={e => setShowMouse(e.target.checked)} /> Cursor and clicks (orange)</label>
      <span>{time.toFixed(1)}s · {gaze ? 'Gaze detected' : 'No gaze sample at this moment'}</span>
    </div>
    {failed && <Alert type="error" title="Video could not load">Refresh the page after restarting the frontend and backend.</Alert>}
    <div className="relative rounded-2xl overflow-hidden" style={{ background: '#090b12' }}>
      <video ref={videoRef} src={data.video_url} controls playsInline preload="metadata" className="w-full block"
        onError={() => setFailed(true)} onLoadedMetadata={() => setFailed(false)} onSeeked={e => setTime(e.currentTarget.currentTime)} />
      <svg viewBox={`0 0 ${screenWidth} ${screenHeight}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-label="Synchronized gaze and mouse overlay">
        {showGaze && gaze && <g>
          <circle cx={gaze.gaze_x} cy={gaze.gaze_y} r="24" fill="#34c759" fillOpacity=".22" stroke="white" strokeWidth="3" />
          <circle cx={gaze.gaze_x} cy={gaze.gaze_y} r="7" fill="#34c759" stroke="#064e22" strokeWidth="2" />
        </g>}
        {showMouse && mouse && <circle cx={mouse.x} cy={mouse.y} r="10" fill="#ff9500" stroke="white" strokeWidth="3" />}
        {showMouse && clicks.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r="30" fill="none" stroke="#ff9500" strokeWidth="5" />)}
      </svg>
    </div>
    <p className="supporting-copy" style={{ color: 'var(--ios-label3)' }}>Play, pause or seek to review where you looked. Open Heatmap to view page screenshots with combined gaze.</p>
    <a className="text-sm underline" style={{ color: 'var(--ios-blue)' }} href={data.video_url} download>Download screen video</a>
    {events.length > 0 && <div className="flex flex-wrap gap-2">{events.map((event, i) => {
      const offset = Math.max(0, event.timestamp - data.video_started_at)
      return <button key={i} className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--ios-fill)', color: 'var(--ios-label)' }}
        onClick={() => { if (videoRef.current) videoRef.current.currentTime = offset; setTime(offset) }}>{offset.toFixed(1)}s · {event.type.replaceAll('_', ' ')}</button>
    })}</div>}
  </div>
}
