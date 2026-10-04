import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { api } from '../../shared/api/client'
import type { CalendarEvent } from '../../shared/types/models'
import { date } from '../../shared/types/models'
import { Empty, ErrorBox, Loading, Modal, PageTitle } from '../../shared/ui/primitives'
import { useAuth } from '../auth/auth-context'
import {
  budapestToday,
  calendarDay,
  eventTypeLabels,
  eventWhen,
  monthGrid,
  occursOnDay,
  shiftDay,
  shiftMonth,
} from './calendar-dates'

function EventEditor({
  event,
  day,
  onClose,
  onSaved,
}: {
  event?: CalendarEvent
  day: string
  onClose: () => void
  onSaved: () => void
}) {
  const [allDay, setAllDay] = useState(event?.allDay ?? false)
  const [start, setStart] = useState(event?.startsAt.slice(0, 16) ?? `${day}T09:00`)
  const [end, setEnd] = useState(
    event?.endsAt
      ? event.allDay
        ? shiftDay(event.endsAt.slice(0, 10), -1) + 'T00:00'
        : event.endsAt.slice(0, 16)
      : '',
  )
  const [validation, setValidation] = useState<Error | null>(null)
  const save = useMutation({
    mutationFn: (body: unknown) =>
      api(event ? `/calendar/events/${event.id}` : '/calendar/events', {
        method: event ? 'PATCH' : 'POST',
        body,
      }),
    onSuccess: onSaved,
  })
  return (
    <Modal
      title={event ? 'Edit calendar entry' : 'Add to the calendar'}
      onClose={() => {
        if (!save.isPending) onClose()
      }}
    >
      <form
        onSubmit={(submit) => {
          submit.preventDefault()
          setValidation(null)
          const fields = new FormData(submit.currentTarget)
          const startsAt = allDay ? start.slice(0, 10) + 'T00:00:00' : start + ':00'
          const endsAt = end
            ? allDay
              ? shiftDay(end.slice(0, 10), 1) + 'T00:00:00'
              : end + ':00'
            : null
          if (endsAt && endsAt <= startsAt) {
            setValidation(
              new Error(
                allDay
                  ? 'The last day cannot be before the first day.'
                  : 'The end time must be after the start time.',
              ),
            )
            return
          }
          save.mutate({
            title: String(fields.get('title') ?? '').trim(),
            description: String(fields.get('description') ?? '').trim(),
            type: fields.get('type'),
            location: String(fields.get('location') ?? '').trim(),
            startsAt,
            endsAt,
            allDay,
            version: event?.version ?? 0,
          })
        }}
      >
        <ErrorBox error={validation ?? save.error} />
        <fieldset className="form-fields" disabled={save.isPending}>
          <label>
            Title
            <input
              name="title"
              required
              maxLength={180}
              defaultValue={event?.title ?? ''}
              placeholder="What is coming up?"
            />
          </label>
          <label>
            Type
            <select name="type" defaultValue={event?.type ?? 'EVENT'}>
              {Object.entries(eventTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="check-label calendar-all-day">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(change) => setAllDay(change.target.checked)}
            />
            All-day entry
          </label>
          <div className="form-columns">
            <label>
              {allDay ? 'First day' : 'Starts at'}
              <input
                type={allDay ? 'date' : 'datetime-local'}
                required
                value={allDay ? start.slice(0, 10) : start}
                onChange={(change) =>
                  setStart(allDay ? change.target.value + 'T09:00' : change.target.value)
                }
              />
            </label>
            <label>
              {allDay ? 'Last day (optional)' : 'Ends at (optional)'}
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? end.slice(0, 10) : end}
                min={allDay ? start.slice(0, 10) : start}
                onChange={(change) =>
                  setEnd(
                    change.target.value
                      ? allDay
                        ? change.target.value + 'T10:00'
                        : change.target.value
                      : '',
                  )
                }
              />
            </label>
          </div>
          <p className="form-hint">
            All times are in Europe/Budapest.{' '}
            {allDay
              ? 'Leave the last day empty for a single-day entry.'
              : 'Leave the end time empty for a deadline or a single point in time.'}
          </p>
          <label>
            Location (optional)
            <input
              name="location"
              maxLength={200}
              defaultValue={event?.location ?? ''}
              placeholder="Room, campus or meeting link"
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              rows={4}
              maxLength={10000}
              defaultValue={event?.description ?? ''}
              placeholder="Preparation, submission details or anything the crew should know…"
            />
          </label>
          <div className="form-actions">
            <button className="button">
              <CalendarDays size={16} />
              {save.isPending ? 'Saving…' : event ? 'Save changes' : 'Add entry'}
            </button>
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}

function EventRow({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  return (
    <button
      className={`agenda-event ${event.type.toLowerCase()}`}
      aria-label={`Open ${event.title}, ${eventTypeLabels[event.type]}, ${eventWhen(event)}`}
      onClick={onOpen}
    >
      <span className="event-rail" />
      <div>
        <span className={`tag event-type ${event.type.toLowerCase()}`}>
          {eventTypeLabels[event.type]}
        </span>
        <strong>{event.title}</strong>
        <small>
          <Clock size={13} />
          {eventWhen(event)}
        </small>
        {event.location && (
          <small>
            <MapPin size={13} />
            {event.location}
          </small>
        )}
        <small>Added by {event.authorName}</small>
      </div>
      <ChevronRight size={17} />
    </button>
  )
}

export function CalendarPage() {
  const today = budapestToday()
  const [month, setMonth] = useState(today.slice(0, 7) + '-01')
  const [selectedDay, setSelectedDay] = useState(today)
  const [view, setView] = useState<'month' | 'agenda'>('month')
  const [type, setType] = useState('ALL')
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null)
  const [detail, setDetail] = useState<CalendarEvent | null>(null)
  const { user } = useAuth()
  const client = useQueryClient()
  const days = monthGrid(month)
  const from = days[0]
  const to = shiftDay(days[days.length - 1], 1)
  const query = useQuery({
    queryKey: ['calendar', from, to],
    queryFn: () => api<CalendarEvent[]>(`/calendar/events?from=${from}&to=${to}`),
  })
  const changed = () => {
    client.invalidateQueries({ queryKey: ['calendar'] })
    client.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const remove = useMutation({
    mutationFn: (event: CalendarEvent) =>
      api(`/calendar/events/${event.id}?version=${event.version}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDetail(null)
      changed()
    },
  })
  const events = (query.data ?? [])
    .filter((event) => type === 'ALL' || event.type === type)
    .sort(
      (left, right) =>
        left.startsAt.localeCompare(right.startsAt) || left.title.localeCompare(right.title),
    )
  const dayEvents = events.filter((event) => occursOnDay(event, selectedDay))
  const monthEvents = events.filter((event) =>
    days.some((day) => day.startsWith(month.slice(0, 7)) && occursOnDay(event, day)),
  )
  const moveMonth = (amount: number) => {
    const next = shiftMonth(month, amount)
    setMonth(next)
    setSelectedDay(next)
  }
  return (
    <>
      <PageTitle
        eyebrow="PLAN TOGETHER"
        title="Crew calendar"
        text="Exams, events and deadlines. One shared plan for the whole class."
        action={
          <button className="button" onClick={() => setEditing('new')}>
            <Plus size={18} />
            Add entry
          </button>
        }
      />
      <div className="calendar-toolbar">
        <div className="calendar-month-control">
          <button className="icon-button" aria-label="Previous month" onClick={() => moveMonth(-1)}>
            <ChevronLeft size={20} />
          </button>
          <h2 aria-live="polite">{calendarDay(month, { month: 'long', year: 'numeric' })}</h2>
          <button className="icon-button" aria-label="Next month" onClick={() => moveMonth(1)}>
            <ChevronRight size={20} />
          </button>
          <button
            className="button secondary small"
            onClick={() => {
              setMonth(today.slice(0, 7) + '-01')
              setSelectedDay(today)
            }}
          >
            Today
          </button>
        </div>
        <div className="view-toggle" aria-label="Calendar view">
          <button
            aria-pressed={view === 'month'}
            className={view === 'month' ? 'active' : ''}
            onClick={() => setView('month')}
          >
            <LayoutGrid size={15} />
            Month
          </button>
          <button
            aria-pressed={view === 'agenda'}
            className={view === 'agenda' ? 'active' : ''}
            onClick={() => setView('agenda')}
          >
            <List size={16} />
            Agenda
          </button>
        </div>
      </div>
      <div className="calendar-filterbar">
        <div className="filter-chips" aria-label="Filter calendar entries">
          {[['ALL', 'All entries'], ...Object.entries(eventTypeLabels)].map(([value, label]) => (
            <button
              className={type === value ? 'active' : ''}
              aria-pressed={type === value}
              key={value}
              onClick={() => setType(value)}
            >
              {value !== 'ALL' && <span className={`event-dot ${value.toLowerCase()}`} />}
              {label}
            </button>
          ))}
        </div>
        <small className="muted">Europe/Budapest</small>
      </div>
      <ErrorBox error={query.error} />
      {query.isPending ? (
        <Loading />
      ) : (
        !query.isError &&
        (view === 'month' ? (
          <div className="calendar-layout">
            <section className="panel month-panel" aria-label="Month calendar">
              <div className="calendar-weekdays">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {days.map((day) => {
                  const entries = events.filter((event) => occursOnDay(event, day))
                  return (
                    <button
                      key={day}
                      className={`calendar-day ${day.startsWith(month.slice(0, 7)) ? '' : 'outside'} ${day === today ? 'today' : ''} ${day === selectedDay ? 'selected' : ''}`}
                      aria-label={`${calendarDay(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
                      aria-pressed={day === selectedDay}
                      onClick={() => setSelectedDay(day)}
                    >
                      <span className="day-number">{Number(day.slice(8, 10))}</span>
                      <span className="day-events">
                        {entries.slice(0, 2).map((event) => (
                          <span
                            className={`calendar-chip ${event.type.toLowerCase()}`}
                            key={event.id}
                          >
                            <span className={`event-dot ${event.type.toLowerCase()}`} />
                            <span>
                              {!event.allDay && event.startsAt.startsWith(day)
                                ? event.startsAt.slice(11, 16) + ' '
                                : ''}
                              {event.title}
                            </span>
                          </span>
                        ))}
                        {entries.length > 2 && (
                          <span className="calendar-more">+{entries.length - 2} more</span>
                        )}
                      </span>
                      <span className="mobile-event-dots">
                        {entries.slice(0, 3).map((event) => (
                          <span
                            key={event.id}
                            className={`event-dot ${event.type.toLowerCase()}`}
                          />
                        ))}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
            <aside className="panel day-agenda">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">SELECTED DAY</span>
                  <h2>
                    {calendarDay(selectedDay, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </h2>
                </div>
                <button
                  className="icon-button"
                  aria-label="Add entry on selected day"
                  onClick={() => setEditing('new')}
                >
                  <Plus size={19} />
                </button>
              </div>
              {dayEvents.length ? (
                dayEvents.map((event) => (
                  <EventRow
                    event={event}
                    key={event.id}
                    onOpen={() => {
                      remove.reset()
                      setDetail(event)
                    }}
                  />
                ))
              ) : (
                <Empty
                  title="A clear day"
                  text="Nothing is scheduled for this day with the current filter."
                  action={
                    <button className="text-link" onClick={() => setEditing('new')}>
                      <Plus size={15} />
                      Add an entry
                    </button>
                  }
                />
              )}
            </aside>
          </div>
        ) : (
          <section className="panel calendar-agenda">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">THIS MONTH</span>
                <h2>
                  {monthEvents.length} {monthEvents.length === 1 ? 'entry' : 'entries'} in the plan
                </h2>
              </div>
              <CalendarDays size={23} />
            </div>
            {monthEvents.length ? (
              monthEvents.map((event) => (
                <EventRow
                  event={event}
                  key={event.id}
                  onOpen={() => {
                    remove.reset()
                    setDetail(event)
                  }}
                />
              ))
            ) : (
              <Empty
                title="Room for a new plan"
                text="No entries match this month and filter. Anyone in the crew can add one."
                action={
                  <button className="text-link" onClick={() => setEditing('new')}>
                    <Plus size={16} />
                    Add an entry
                  </button>
                }
              />
            )}
          </section>
        ))
      )}
      <p className="calendar-footnote">
        Everyone can contribute. Authors can edit their own entries; administrators can manage the
        whole calendar.
      </p>
      {detail && (
        <Modal
          title={detail.title}
          onClose={() => {
            if (!remove.isPending) setDetail(null)
          }}
        >
          <ErrorBox error={remove.error} />
          <span className={`tag event-type ${detail.type.toLowerCase()}`}>
            {eventTypeLabels[detail.type]}
          </span>
          <div className="event-details">
            <p>
              <Clock size={17} />
              <span>
                {eventWhen(detail)}
                <small>Europe/Budapest</small>
              </span>
            </p>
            {detail.location && (
              <p>
                <MapPin size={17} />
                <span>{detail.location}</span>
              </p>
            )}
          </div>
          {detail.description && <p className="preserve-text">{detail.description}</p>}
          <p className="form-hint">
            Added by {detail.authorName} · {date(detail.createdAt)}
            {detail.updatedAt !== detail.createdAt ? ` · Updated ${date(detail.updatedAt)}` : ''}
          </p>
          {(user?.role === 'ADMIN' || user?.id === detail.authorId) && (
            <div className="form-actions">
              <button
                className="button secondary"
                disabled={remove.isPending}
                onClick={() => {
                  setEditing(detail)
                  setDetail(null)
                }}
              >
                <Pencil size={16} />
                Edit entry
              </button>
              <button
                className="button secondary danger"
                disabled={remove.isPending}
                onClick={() => {
                  if (confirm('Delete this calendar entry?')) remove.mutate(detail)
                }}
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          )}
        </Modal>
      )}
      {editing && (
        <EventEditor
          event={editing === 'new' ? undefined : editing}
          day={selectedDay}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            changed()
          }}
        />
      )}
    </>
  )
}
