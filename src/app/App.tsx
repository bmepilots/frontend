import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Layout } from './Layout'
import { useAuth } from '../features/auth/auth-context'
import { AuthPage } from '../features/auth/AuthPage'
const AccountPage = lazy(() =>
  import('../features/auth/AccountPage').then((m) => ({ default: m.AccountPage })),
)
const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const AnnouncementsPage = lazy(() =>
  import('../features/announcements/AnnouncementsPage').then((m) => ({
    default: m.AnnouncementsPage,
  })),
)
const DocumentsPage = lazy(() =>
  import('../features/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
)
const DocumentPage = lazy(() =>
  import('../features/documents/DocumentsPage').then((m) => ({ default: m.DocumentPage })),
)
const CalendarPage = lazy(() =>
  import('../features/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })),
)
const LinksPage = lazy(() =>
  import('../features/links/LinksPage').then((m) => ({ default: m.LinksPage })),
)
const MailPage = lazy(() =>
  import('../features/mail/MailPage').then((m) => ({ default: m.MailPage })),
)
const AdminLayout = lazy(() =>
  import('../features/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })),
)
const AdminDashboard = lazy(() =>
  import('../features/admin/AdminPages').then((m) => ({ default: m.AdminDashboard })),
)
const UsersPage = lazy(() =>
  import('../features/admin/AdminPages').then((m) => ({ default: m.UsersPage })),
)
const SettingsPage = lazy(() =>
  import('../features/admin/AdminPages').then((m) => ({ default: m.SettingsPage })),
)
const MailAdminPage = lazy(() =>
  import('../features/admin/AdminPages').then((m) => ({ default: m.MailAdminPage })),
)
const AuditPage = lazy(() =>
  import('../features/admin/AdminPages').then((m) => ({ default: m.AuditPage })),
)
import { ErrorBox, Loading, Empty } from '../shared/ui/primitives'
function Protected({ admin = false }: { admin?: boolean }) {
  const { user, loading, error } = useAuth()
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  if (!user) return <Navigate to="/login" replace />
  if (admin && user.role !== 'ADMIN') return <Navigate to="/" replace />
  return <Outlet />
}
export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route element={<Protected />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="documents/:id" element={<DocumentPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="knowledge/*" element={<Navigate to="/documents" replace />} />
            <Route path="links" element={<LinksPage />} />
            <Route path="mail" element={<MailPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route element={<Protected admin />}>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="registrations" element={<UsersPage key="pending" pending />} />
                <Route path="users" element={<UsersPage key="all" />} />
                <Route path="announcements" element={<AnnouncementsPage admin />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="knowledge/*" element={<Navigate to="/admin/documents" replace />} />
                <Route path="links" element={<LinksPage admin />} />
                <Route path="mail" element={<MailAdminPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="audit-log" element={<AuditPage />} />
              </Route>
            </Route>
            <Route
              path="*"
              element={<Empty title="Page not found" text="Choose a page from the navigation." />}
            />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
