/**
 * GazeHeatmap.jsx
 * SVG-based gaze heatmap + mouse path + click markers overlay.
 * Benchmarked against Hussain et al. (2021) multimodal approach:
 *   - Gaze fixation density visualised as coloured grid cells (40×40 px)
 *   - Mouse trajectory drawn as polyline
 *   - Rage clicks shown in red, normal clicks in amber
 *   - Gaze↔mouse mismatch events drawn as dashed lines (purple)
 */
import { useState } from 'react'

const CELL = 40

export default function GazeHeatmap({
  heatmap = [],
  mousePath = [],
  clicks = [],
  frictionEvents = [],
  screenWidth = 1920,
  screenHeight = 1080,
  transparentBg = false,
}) {
  const [layer, setLayer] = useState({ gaze: true, mouse: true, clicks: true, friction: true })

  const rageSet = new Set(
    frictionEvents
      .filter(e => e.type === 'rage_click')
      .map(e => `${Math.round(e.x)},${Math.round(e.y)}`)
  )

  const mismatchEvents = frictionEvents.filter(e => e.type === 'gaze_mouse_mismatch')

  /* polyline points string */
  const pathPts = mousePath.map(p => `${p.x},${p.y}`).join(' ')

  /* heatmap colour: green → yellow → red based on intensity */
  const cellColor = (intensity) => {
    const r = Math.min(255, Math.round(510 * intensity))
    const g = Math.min(255, Math.round(510 * (1 - intensity)))
    return `rgb(${r},${g},60)`
  }

  const toggleLayer = (k) => setLayer(l => ({ ...l, [k]: !l[k] }))

  return (
    <div className="w-full h-full">
      {/* Layer toggles */}
      <div className="flex gap-2 flex-wrap mb-3 relative z-10 p-2">
        {[
          { key: 'gaze',     label: 'Gaze heatmap',  color: '#34C759' },
          { key: 'mouse',    label: 'Mouse path',     color: '#007AFF' },
          { key: 'clicks',   label: 'Clicks',         color: '#FF9500' },
          { key: 'friction', label: 'Friction',       color: '#FF3B30' },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all pointer-events-auto"
            style={{
              background: layer[key] ? `${color}18` : 'var(--ios-fill)',
              border: layer[key] ? `1px solid ${color}50` : '1px solid var(--ios-separator)',
              color: layer[key] ? color : 'var(--ios-label3)',
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: layer[key] ? color : 'var(--ios-bg3)' }}
            />
            {label}
          </button>
        ))}
      </div>

      {/* SVG canvas */}
      <div className={`w-full h-full ${transparentBg ? 'absolute inset-0' : 'rounded-2xl overflow-hidden'}`}>
        <svg
          viewBox={`0 0 ${screenWidth} ${screenHeight}`}
          style={{ display: 'block', width: '100%', height: '100%' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background */}
          {!transparentBg && <rect width={screenWidth} height={screenHeight} fill="#0A0A0F" />}

          {/* Grid reference lines */}
          {Array.from({ length: Math.floor(screenWidth / 200) }, (_, i) => (
            <line
              key={`vg-${i}`}
              x1={(i + 1) * 200} y1={0} x2={(i + 1) * 200} y2={screenHeight}
              stroke="rgba(255,255,255,0.03)" strokeWidth={1}
            />
          ))}
          {Array.from({ length: Math.floor(screenHeight / 200) }, (_, i) => (
            <line
              key={`hg-${i}`}
              x1={0} y1={(i + 1) * 200} x2={screenWidth} y2={(i + 1) * 200}
              stroke="rgba(255,255,255,0.03)" strokeWidth={1}
            />
          ))}

          {/* Gaze heatmap cells */}
          {layer.gaze && heatmap.map((cell, i) => (
            <rect
              key={i}
              x={cell.x} y={cell.y}
              width={CELL} height={CELL}
              fill={cellColor(cell.intensity)}
              fillOpacity={0.12 + cell.intensity * 0.60}
            />
          ))}

          {/* Mouse path */}
          {layer.mouse && pathPts && (
            <polyline
              points={pathPts}
              fill="none"
              stroke="#007AFF"
              strokeWidth={1.5}
              strokeOpacity={0.45}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Gaze↔mouse mismatch lines */}
          {layer.friction && mismatchEvents.map((e, i) => {
            const [mx, my] = Array.isArray(e.mouse_pos) ? e.mouse_pos : [e.mouse_x, e.mouse_y]
            const [gx, gy] = Array.isArray(e.gaze_pos)  ? e.gaze_pos  : [e.gaze_x,  e.gaze_y]
            return (
              <g key={`mm-${i}`}>
                <line
                  x1={mx} y1={my} x2={gx} y2={gy}
                  stroke="#AF52DE" strokeWidth={1.5} strokeOpacity={0.7}
                  strokeDasharray="6,3"
                />
                <circle cx={gx} cy={gy} r={5} fill="#AF52DE" fillOpacity={0.6} />
              </g>
            )
          })}

          {/* Click markers */}
          {layer.clicks && clicks.map((c, i) => {
            const key = `${Math.round(c.x)},${Math.round(c.y)}`
            const isRage = c.rage_click || rageSet.has(key)
            return (
              <g key={`c-${i}`}>
                {isRage && (
                  <circle cx={c.x} cy={c.y} r={18} fill="#FF3B30" fillOpacity={0.15} />
                )}
                <circle
                  cx={c.x} cy={c.y} r={7}
                  fill={isRage ? '#FF3B30' : '#FF9500'}
                  fillOpacity={0.85}
                  stroke="white" strokeWidth={1.5} strokeOpacity={0.9}
                />
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {[
          { color: '#007AFF', label: 'Mouse path' },
          { color: '#FF9500', label: 'Click' },
          { color: '#FF3B30', label: 'Rage click' },
          { color: '#AF52DE', label: 'Gaze mismatch' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ios-label3)' }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ios-label3)' }}>
          <span
            className="w-10 h-2 rounded-sm"
            style={{ background: 'linear-gradient(to right, rgba(52,199,89,0.6), rgba(255,59,48,0.6))' }}
          />
          Gaze intensity
        </span>
      </div>
    </div>
  )
}
