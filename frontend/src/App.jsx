import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Home, Eye, Circle, BarChart2, ChevronRight } from 'lucide-react'
import { useSystemStatus } from './hooks/useSystemStatus'
import DashboardPage from './pages/DashboardPage'
import CalibratePage from './pages/CalibratePage'
import RecordPage from './pages/RecordPage'
import ResultsPage from './pages/ResultsPage'
import SessionDetailPage from './pages/SessionDetailPage'

const NAV = [
  { to: '/',          icon: Home,     label: 'Dashboard'  },
  { to: '/calibrate', icon: Eye,      label: 'Calibrate'  },
  { to: '/record',    icon: Circle,   label: 'Record'     },
  { to: '/results',   icon: BarChart2, label: 'Results'   },
]

export default function App() {
  const { status, isRecording } = useSystemStatus()
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--ios-bg)' }}>
      {/* ── Top nav bar ─────────────────────────────────────────── */}
      <header
        className="glass-card sticky top-0 z-50 flex items-center justify-between px-6 py-3"
        style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
      >
        {/* Wordmark */}
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: 'var(--ios-blue)', boxShadow: 'var(--shadow-blue)' }}
          >
            UX
          </div>
          <span className="font-semibold text-sm" style={{ color: 'var(--ios-label)' }}>
            UX Analyzer
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'var(--ios-fill)', color: 'var(--ios-label3)' }}
          >
            v1.0
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-white'
                    : 'hover:opacity-80'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'var(--ios-blue)' : 'transparent',
                color: isActive ? 'white' : 'var(--ios-label3)',
                boxShadow: isActive ? 'var(--shadow-blue)' : 'none',
              })}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Live status pill */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{
            background: isRecording ? 'rgba(255,59,48,0.10)' : 'var(--ios-fill)',
            color: isRecording ? 'var(--ios-danger)' : 'var(--ios-label3)',
          }}
        >
          <span
            className={`w-2 h-2 rounded-full ${isRecording ? 'animate-pulse' : ''}`}
            style={{
              background: isRecording
                ? 'var(--ios-danger)'
                : status === 'calibrating'
                ? 'var(--ios-warning)'
                : status === 'analyzing'
                ? 'var(--ios-blue)'
                : '#8E8E93',
            }}
          />
          {status === 'idle' ? 'Idle' : status === 'calibrating' ? 'Calibrating…' : status === 'recording' ? 'Recording' : status === 'analyzing' ? 'Analyzing…' : status}
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 page-enter" key={location.pathname}>
        <Routes>
          <Route path="/"              element={<DashboardPage />} />
          <Route path="/calibrate"     element={<CalibratePage />} />
          <Route path="/record"        element={<RecordPage />} />
          <Route path="/results"       element={<ResultsPage />} />
          <Route path="/results/:sid"  element={<SessionDetailPage />} />
        </Routes>
      </main>

      {/* ── Bottom breadcrumb bar ─────────────────────────────────── */}
      <footer
        className="text-xs px-6 py-2 flex items-center gap-1"
        style={{ color: 'var(--ios-label3)', borderTop: '1px solid var(--ios-separator)' }}
      >
        <span>UX Analyzer</span>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--ios-label2)' }}>
          {NAV.find(n => location.pathname === n.to || (n.to !== '/' && location.pathname.startsWith(n.to)))?.label ?? 'Dashboard'}
        </span>
      </footer>
    </div>
  )
}
