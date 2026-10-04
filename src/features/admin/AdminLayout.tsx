import { NavLink, Outlet } from 'react-router-dom'
export function AdminLayout() {
  const routes = [
    ['dashboard', 'Overview'],
    ['registrations', 'Applications'],
    ['users', 'Members'],
    ['announcements', 'Announcements'],
    ['documents', 'Shared documents'],
    ['calendar', 'Calendar'],
    ['links', 'Links'],
    ['mail', 'Mail connection'],
    ['settings', 'Settings'],
    ['audit-log', 'Audit log'],
  ]
  return (
    <>
      <div className="admin-banner">
        <span className="tag orange">ADMIN</span>
        <span>Community management</span>
      </div>
      <nav className="admin-nav" aria-label="Admin navigation">
        {routes.map(([path, label]) => (
          <NavLink to={path} key={path}>
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  )
}
