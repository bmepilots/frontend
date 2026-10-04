import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../shared/api/client'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  Plane,
  LayoutDashboard,
  Megaphone,
  Mail,
  Files,
  CalendarDays,
  Link2,
  Shield,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
} from 'lucide-react'
import { useAuth } from '../features/auth/auth-context'
import { ErrorBox } from '../shared/ui/primitives'
const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/mail', label: 'Shared inbox', icon: Mail },
  { to: '/documents', label: 'Shared documents', icon: Files },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/links', label: 'Useful links', icon: Link2 },
]
export function Layout() {
  const config = useQuery({
    queryKey: ['public-config'],
    queryFn: () => api<{ portalName: string; registrationEnabled: boolean }>('/public/config'),
  })
  useEffect(() => {
    document.title = (config.data?.portalName ?? 'BME Pilots 2026') + ' · Crew portal'
  }, [config.data?.portalName])
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<unknown>(null)
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={'sidebar ' + (open ? 'open' : '')}>
        <NavLink className="brand" to="/">
          <span className="brand-mark">
            <Plane size={25} />
          </span>
          <span>
            BME PILOTS<small>CLASS OF 2026</small>
          </span>
        </NavLink>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <div className="nav-section">CREW PORTAL</div>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              end={item.to === '/'}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}
            >
              <item.icon size={19} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        {user?.role === 'ADMIN' && (
          <>
            <div className="nav-section">MANAGEMENT</div>
            <NavLink
              to="/admin"
              className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}
              onClick={() => setOpen(false)}
            >
              <Shield size={19} />
              Administration
            </NavLink>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="class-card">
            <span className="status-dot" />
            <span>
              PROFESSIONAL PILOT<strong>Class of 2026</strong>
            </span>
            <ArrowUpRight size={17} />
          </div>
          <p>Unofficial student portal</p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <span className="topbar-location">
            <span className="status-dot" /> BUDAPEST <span className="divider">/</span> CREW SPACE
          </span>
          <div className="topbar-user">
            <Link to="/account" aria-label="Your account" className="avatar">
              {user?.displayName.slice(0, 1).toLocaleUpperCase('en')}
            </Link>
            <span>
              <strong>{user?.displayName}</strong>
              <small>{user?.role === 'ADMIN' ? 'Administrator' : 'Crew member'}</small>
            </span>
            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => logout().catch(setError)}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main id="main" className="main-content">
          <ErrorBox error={error} />
          <Outlet />
        </main>
        <footer className="footer">
          <span>BME PILOTS 2026</span>
          <span>A community. A crew.</span>
        </footer>
      </div>
    </div>
  )
}
