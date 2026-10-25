/**
 * FrictionEventsList.jsx
 * Timeline list of detected friction events.
 *
 * Friction taxonomy per Hussain et al. (2021):
 *   - rage_click        → repeated clicks on non-responsive element
 *   - gaze_mouse_mismatch → user gaze diverges from click location (confusion)
 *
 * Each event shows timestamp offset, type badge, coordinates, and severity.
 */
import { AlertCircle, MousePointerClick, Eye } from 'lucide-react'
import { Badge } from './ui'

const TYPE_META = {
  rage_click: {
    label: 'Rage Click',
    color: '#FF3B30',
    Icon: MousePointerClick,
    desc: (e) => `${e.count ?? '?'}× clicks near (${e.x}, ${e.y})`,
  },
  gaze_mouse_mismatch: {
    label: 'Gaze Mismatch',
    color: '#AF52DE',
    Icon: Eye,
    desc: (e) => {
      const mp = Array.isArray(e.mouse_pos) ? e.mouse_pos : [e.mouse_x, e.mouse_y]
      const gp = Array.isArray(e.gaze_pos)  ? e.gaze_pos  : [e.gaze_x,  e.gaze_y]
      return `Mouse (${mp[0]}, ${mp[1]}) ↔ Gaze (${gp[0]}, ${gp[1]}) — ${e.distance_px}px apart`
    },
  },
  hesitation: {
    label: 'Hesitation',
    color: '#FF9500',
    Icon: AlertCircle,
    desc: (e) => `Paused ${e.hesitation_s?.toFixed(1) ?? '?'}s before click`,
  },
  erratic: {
    label: 'Erratic Move',
    color: '#FF9500',
    Icon: MousePointerClick,
    desc: (e) => `Erratic movement at (${e.x}, ${e.y})`,
  },
}

function getEventTs(e) {
  return e.timestamp ?? e.ts ?? 0
}

export default function FrictionEventsList({ events = [] }) {
  if (!events.length) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: 'var(--ios-fill2)', border: '1px dashed var(--ios-separator)' }}
      >
        <p className="text-sm" style={{ color: 'var(--ios-label3)' }}>
          No friction events detected in this session.
        </p>
      </div>
    )
  }

  const sorted = [...events].sort((a, b) => getEventTs(a) - getEventTs(b))
  const startTs = getEventTs(sorted[0])

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((e, i) => {
        const meta = TYPE_META[e.type] ?? {
          label: e.type,
          color: 'var(--ios-label3)',
          Icon: AlertCircle,
          desc: () => JSON.stringify(e),
        }
        const { Icon } = meta
        const relSec = (getEventTs(e) - startTs).toFixed(2)
        const score = e.score

        return (
          <div
            key={i}
            className="event-row"
          >
            {/* Icon */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${meta.color}15` }}
            >
              <Icon size={16} style={{ color: meta.color }} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge color={meta.color}>{meta.label}</Badge>
                {score !== undefined && (
                  <span className="text-xs" style={{ color: 'var(--ios-label3)' }}>
                    severity {(score * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="supporting-copy event-description mt-2" style={{ color: 'var(--ios-label3)' }}>
                {meta.desc(e)}
              </p>
            </div>

            {/* Time */}
            <span
              className="text-xs tabular-nums flex-shrink-0"
              style={{ color: 'var(--ios-label3)' }}
            >
              +{relSec}s
            </span>
          </div>
        )
      })}
    </div>
  )
}
