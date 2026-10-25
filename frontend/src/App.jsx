import { Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import { Home, Eye, Circle, BarChart2, ArrowUpRight } from 'lucide-react'
import gazelyLogo from './assets/gazely_logo.svg'
import { useSystemStatus } from './hooks/useSystemStatus'
import DashboardPage from './pages/DashboardPage'
import CalibratePage from './pages/CalibratePage'
import RecordPage from './pages/RecordPage'
import ResultsPage from './pages/ResultsPage'
import SessionDetailPage from './pages/SessionDetailPage'

const NAV = [
  { to: '/', icon: Home, label: 'Home', description: 'Your research at a glance' },
  { to: '/calibrate', icon: Eye, label: 'Calibrate', description: 'Prepare eye tracking' },
  { to: '/record', icon: Circle, label: 'Record', description: 'Capture a new session' },
  { to: '/results', icon: BarChart2, label: 'Sessions', description: 'Explore your findings' },
]

export default function App() {
  const { status, isRecording } = useSystemStatus()
  const location = useLocation()
  const current = NAV.find(n => location.pathname === n.to || (n.to !== '/' && location.pathname.startsWith(n.to)))
  
  return <div className="workspace">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="workspace-sidebar">
      <Link to="/" className="brand" aria-label="UX Analyzer home">
        <img src={gazelyLogo} alt="Gazely" className="brand-logo" />
      </Link>
      <p className="nav-caption">Workspace</p>
      <nav className="workspace-nav" aria-label="Main navigation">
        {NAV.map(({ to, icon: Icon, label, description }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `workspace-nav-link ${isActive ? 'is-active' : ''}`}>
          <Icon size={20} /><span>{label}</span>
        </NavLink>)}
      </nav>
    </aside>
    <div className="workspace-body flex flex-col justify-center align-center md:mt-8">
      <main id="main-content" tabIndex={-1} className="app-main page-enter" key={location.pathname}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/calibrate" element={<CalibratePage />} />
          <Route path="/record" element={<RecordPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/results/:sid" element={<SessionDetailPage />} />
        </Routes>
      </main>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{NAV.map(({ to, icon: Icon, label }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'is-active' : ''}><Icon size={20} /><span>{label}</span></NavLink>)}</nav>
  </div>
}
