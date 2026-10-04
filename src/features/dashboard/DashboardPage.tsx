import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Files,
  CalendarDays,
  Mail,
  Megaphone,
  Plane,
  Pin,
} from 'lucide-react'
import { api } from '../../shared/api/client'
import type {
  Announcement,
  CalendarEvent,
  DocumentPost,
  UsefulLink,
} from '../../shared/types/models'
import { date } from '../../shared/types/models'
import { Empty, ErrorBox, Loading, PageTitle } from '../../shared/ui/primitives'
import { useAuth } from '../auth/auth-context'
import { eventWhen, eventTypeLabels } from '../calendar/calendar-dates'
type Dashboard = {
  announcements: Announcement[]
  documents: DocumentPost[]
  upcomingEvents: CalendarEvent[]
  links: UsefulLink[]
  unreadMailCount: number
}
export function DashboardPage() {
  const { user } = useAuth()
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard') })
  if (query.isPending) return <Loading />
  if (query.isError) return <ErrorBox error={query.error} />
  const data = query.data
  return (
    <>
      <PageTitle
        eyebrow="YOUR CREW SPACE"
        title={`Hello, ${user?.displayName.split(' ')[0]}.`}
        text="Everything your class needs, all in one place."
      />
      <section className="hero">
        <div className="hero-copy">
          <span className="overline light">BME PROFESSIONAL PILOT · 2026</span>
          <h2>
            Taking off together.
            <br />
            <em>Going further.</em>
          </h2>
          <p>A home for our shared knowledge, updates and community.</p>
          <Link className="hero-link" to="/documents">
            Explore shared documents <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className="hero-instrument" aria-hidden="true">
          <div className="compass-ring">
            <span className="north">N</span>
            <span className="east">E</span>
            <span className="west">W</span>
            <span className="south">S</span>
            <div className="compass-inner">
              <Plane size={66} strokeWidth={1} />
            </div>
          </div>
          <div className="instrument-caption">
            <span>HEADING</span>
            <strong>OUR FUTURE</strong>
          </div>
        </div>
      </section>
      <div className="stat-grid">
        <Link to="/mail" className="stat">
          <span className="stat-icon blue">
            <Mail size={21} />
          </span>
          <div>
            <span>Shared inbox</span>
            <strong>
              {data.unreadMailCount} <small>unread messages</small>
            </strong>
          </div>
          <ArrowUpRight size={18} />
        </Link>
        <Link to="/announcements" className="stat">
          <span className="stat-icon amber">
            <Megaphone size={21} />
          </span>
          <div>
            <span>Stay in the loop</span>
            <strong>Announcements</strong>
          </div>
          <ArrowUpRight size={18} />
        </Link>
        <Link to="/calendar" className="stat">
          <span className="stat-icon green">
            <CalendarDays size={21} />
          </span>
          <div>
            <span>Our shared plan</span>
            <strong>Crew calendar</strong>
          </div>
          <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">BRIEFING</span>
              <h2>Latest announcements</h2>
            </div>
            <Link className="text-link" to="/announcements">
              View all <ArrowRight size={16} />
            </Link>
          </div>
          {data.announcements.length ? (
            data.announcements.map((a) => (
              <Link to={`/announcements#${a.id}`} className="briefing" key={a.id}>
                <div className="briefing-meta">
                  <span className={'tag ' + (a.important ? 'orange' : '')}>
                    {a.important ? (
                      <>
                        <Pin size={12} /> Important
                      </>
                    ) : (
                      'Announcement'
                    )}
                  </span>
                  <time>{date(a.createdAt)}</time>
                </div>
                <h3>{a.title}</h3>
                <p>
                  {a.bodyMarkdown.slice(0, 145)}
                  {a.bodyMarkdown.length > 145 ? '…' : ''}
                </p>
                <span className="byline">
                  {a.authorName}
                  <ArrowUpRight size={17} />
                </span>
              </Link>
            ))
          ) : (
            <Empty
              title="Our shared story starts here"
              text="Important updates for your class will appear here."
              action={
                user?.role === 'ADMIN' ? (
                  <Link className="text-link" to="/admin/announcements">
                    Create the first announcement <ArrowRight size={16} />
                  </Link>
                ) : undefined
              }
            />
          )}
        </section>
        <div className="dashboard-side">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">SHARED DOCUMENTS</span>
                <h2>From the crew</h2>
              </div>
              <Files size={20} />
            </div>
            {data.documents.length ? (
              data.documents.map((a) => (
                <Link className="resource-row" to={`/documents/${a.id}`} key={a.id}>
                  <span className="resource-icon">
                    <Files size={19} />
                  </span>
                  <div>
                    <strong>{a.title}</strong>
                    <small>
                      {a.authorName} · {a.fileCount} {a.fileCount === 1 ? 'file' : 'files'}
                    </small>
                  </div>
                  <ArrowUpRight size={17} />
                </Link>
              ))
            ) : (
              <div className="small-empty">
                Share course notes and useful files, then learn together in the comments.
              </div>
            )}
            <Link className="panel-bottom-link" to="/documents">
              Open shared documents <ArrowRight size={16} />
            </Link>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">ON THE HORIZON</span>
                <h2>Coming up</h2>
              </div>
              <CalendarDays size={20} />
            </div>
            {data.upcomingEvents.length ? (
              data.upcomingEvents.map((event) => (
                <Link className="resource-row" to="/calendar" key={event.id}>
                  <span className={`event-dot ${event.type.toLowerCase()}`} />
                  <div>
                    <strong>{event.title}</strong>
                    <small>{eventWhen(event)}</small>
                    <small>{eventTypeLabels[event.type]}</small>
                  </div>
                  <ArrowUpRight size={17} />
                </Link>
              ))
            ) : (
              <div className="small-empty">
                Add exams, homework deadlines and events to your class calendar.
              </div>
            )}
            <Link className="panel-bottom-link" to="/calendar">
              Open calendar <ArrowRight size={16} />
            </Link>
          </section>
          <section className="panel quick-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">QUICK ACCESS</span>
                <h2>Useful links</h2>
              </div>
            </div>
            {data.links.length ? (
              data.links.map((l) => (
                <a
                  key={l.id}
                  className="quick-link"
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{l.name}</span>
                  <ArrowUpRight size={17} />
                </a>
              ))
            ) : (
              <div className="small-empty">Resources collected by the crew, in one place.</div>
            )}
            <Link className="panel-bottom-link" to="/links">
              View all links <ArrowRight size={16} />
            </Link>
          </section>
        </div>
      </div>
    </>
  )
}
