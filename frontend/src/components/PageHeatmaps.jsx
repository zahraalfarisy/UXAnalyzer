import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { Alert, Button, Spinner } from './ui'
import SmoothHeatmap from './SmoothHeatmap'

function PageImage({ page, sid, screenWidth, screenHeight }) {
  const imageRef = useRef(null)
  const heatRef = useRef(null)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const download = () => {
    const image = imageRef.current
    if (!loaded || !image) return
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    if (showHeatmap && heatRef.current) context.drawImage(heatRef.current, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `heatmap-${sid}-page-${page.id}.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }
  return <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h3 className="card-title" style={{ color: 'var(--ios-label)' }}>Page {page.id}</h3>
        <p className="text-xs" style={{ color: 'var(--ios-label3)' }}>{page.viewed_seconds.toFixed(1)}s viewed · {page.gaze_samples.length} gaze samples · {page.intervals.length} visit{page.intervals.length === 1 ? '' : 's'}</p>
      </div>
      <div className="heatmap-controls">
        <label className="text-xs" style={{ color: 'var(--ios-label2)' }}><input type="checkbox" checked={showHeatmap} onChange={e => setShowHeatmap(e.target.checked)} /> Show heatmap</label>
        <Button size="sm" variant="secondary" onClick={download} disabled={!loaded}>Download PNG</Button>
      </div>
    </div>
    {failed && <Alert type="error">Screenshot could not load. Refresh the page to try again.</Alert>}
    <div className="relative overflow-hidden rounded-2xl" style={{ background: '#090b12' }}>
      <img ref={imageRef} src={page.image_url} alt={`Recorded page ${page.id}`} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className="w-full block" />
      {showHeatmap && loaded && <SmoothHeatmap canvasRef={heatRef} samples={page.gaze_samples} screenWidth={screenWidth} screenHeight={screenHeight} />}
    </div>
    {!page.gaze_samples.length && <Alert type="info">No valid gaze was captured while this page was visible.</Alert>}
  </div>
}

export default function PageHeatmaps({ sid, screenWidth, screenHeight }) {
  const [pages, setPages] = useState([])
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api.getPageSnapshots(sid).then(result => {
      if (!cancelled) { setPages(result.pages); setMessage(result.message); setSelected(0) }
    }).catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sid])
  if (loading) return <div className="flex items-center gap-3 py-8"><Spinner size={24} /><span className="text-sm" style={{ color: 'var(--ios-label2)' }}>Preparing page screenshots…</span></div>
  if (error) return <Alert type="error" title="Could not prepare screenshots">{error}</Alert>
  if (!pages.length) return <Alert type="info">{message || 'No stable page screenshots are available for this session.'}</Alert>
  return <div className="flex flex-col gap-4">
    <p className="supporting-copy" style={{ color: 'var(--ios-label3)' }}>One screenshot per distinct screen layout, with gaze combined across matching visits. Scrolling can create a separate screenshot. Green → yellow → red shows increasing relative gaze density.</p>
    <div className="flex gap-3 overflow-x-auto pb-2" aria-label="Recorded page screenshots">
      {pages.map((page, index) => <button key={page.id} type="button" onClick={() => setSelected(index)} aria-pressed={selected === index}
        className="w-36 shrink-0 rounded-xl overflow-hidden text-left" style={{ border: `2px solid ${selected === index ? 'var(--ios-blue)' : 'var(--ios-fill)'}` }}>
        <img src={page.image_url} alt="" loading="lazy" className="w-full block" />
        <span className="block p-2 text-xs" style={{ color: 'var(--ios-label)' }}>Page {page.id} · {page.gaze_samples.length} samples</span>
      </button>)}
    </div>
    <PageImage key={pages[selected].id} page={pages[selected]} sid={sid} screenWidth={screenWidth} screenHeight={screenHeight} />
  </div>
}
