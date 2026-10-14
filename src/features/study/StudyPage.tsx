import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, CircuitBoard, Flag, ArrowRight, Check, RotateCcw } from 'lucide-react'
import { api } from '../../shared/api/client'
import { ErrorBox, Loading } from '../../shared/ui/primitives'
import { CircuitDiagram } from './CircuitDiagram'
import { StudyBreadcrumbs, StudySelection } from './StudySelection'
import { lessonsFor, midtermsFor, studyUrl, topicDescriptions } from './curriculum'
import {
  mockQuestions,
  type Attempt,
  type Exercise,
  type Progress,
  type Result,
  type Subject,
} from './types'
import './study.css'

export function StudyPage() {
  const subjects = useQuery({
    queryKey: ['study', 'subjects'],
    queryFn: () => api<Subject[]>('/study/subjects'),
  })
  const [params] = useSearchParams()
  if (subjects.isPending) return <Loading />
  if (!subjects.data) return <ErrorBox error={subjects.error} />
  const subjectId = params.get('subject')
  const midtermId = params.get('midterm')
  const topic = params.get('topic')
  const subject = subjects.data.find((s) => s.id === subjectId)
  const midterm = subject && midtermsFor(subject).find((m) => m.id === midtermId)
  const topics = midterm ? [...new Set(midterm.subject.exercises.map((e) => e.topic))] : []
  const trail: { label: string; to?: string }[] = [
    { label: 'Exam prep', to: subjectId ? '/study' : undefined },
  ]
  if (subject)
    trail.push({ label: subject.title, to: midtermId ? studyUrl(subject.id) : undefined })
  if (midterm)
    trail.push({ label: midterm.title, to: topic ? studyUrl(subject!.id, midterm.id) : undefined })
  if (topic && midterm && (topic === 'all' || topics.includes(topic)))
    trail.push({ label: topic === 'all' ? 'Full midterm review' : topic })
  const invalid =
    (subjectId && !subject) ||
    (midtermId && !midterm) ||
    (topic && (!midterm || (topic !== 'all' && !topics.includes(topic))))
  let content
  if (invalid) {
    content = (
      <section className="study-selection">
        <h1>Study material not found</h1>
        <p>This subject, midterm or topic is not available.</p>
        <Link className="button" to="/study">
          Choose a subject
        </Link>
      </section>
    )
  } else if (!subject) {
    content = (
      <StudySelection
        eyebrow="THE STUDY ROOM · STEP 01"
        title="Choose your subject"
        description="Start with a subject, choose your midterm, then explore a topic."
        cards={subjects.data.map((s) => ({
          id: s.id,
          title: s.title,
          description: 'Study notes, interactive exercises and worked solutions.',
          detail: `${midtermsFor(s).length} ${midtermsFor(s).length === 1 ? 'midterm' : 'midterms'} available`,
          to: studyUrl(s.id),
        }))}
      />
    )
  } else if (!midterm) {
    content = (
      <StudySelection
        eyebrow="STEP 02 · MIDTERMS"
        title={subject.title}
        description="Which midterm are you preparing for?"
        cards={midtermsFor(subject).map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          detail: `${m.subject.exercises.length} exercises · ${new Set(m.subject.exercises.map((e) => e.topic)).size} topics`,
          to: studyUrl(subject.id, m.id),
        }))}
      />
    )
  } else if (!topic) {
    content = (
      <StudySelection
        eyebrow={`${subject.title} · ${midterm.title}`}
        title="Choose a topic"
        description="Focus on one area or review the complete midterm."
        cards={[
          ...topics.map((t) => ({
            id: t,
            title: t,
            description: topicDescriptions[t] ?? 'Explore the practice material for this topic.',
            detail: `${midterm.subject.exercises.filter((e) => e.topic === t).length} exercises`,
            to: studyUrl(subject.id, midterm.id, t),
          })),
          {
            id: 'all',
            title: 'Full midterm review',
            description: 'All topics, your saved results and a complete mock exam.',
            detail: `${midterm.subject.exercises.length} exercises · 3 + 3 mock exam`,
            to: studyUrl(subject.id, midterm.id, 'all'),
          },
        ]}
      />
    )
  } else {
    content = (
      <StudySubject
        key={`${subject.id}/${subject.version}/${midterm.id}/${topic}`}
        subject={midterm.subject}
        topic={topic}
        midtermTitle={midterm.title}
      />
    )
  }
  return (
    <div className="study-page">
      <StudyBreadcrumbs items={trail} />
      {content}
    </div>
  )
}

function StudySubject({
  subject,
  topic,
  midtermTitle,
}: {
  subject: Subject
  topic: string
  midtermTitle: string
}) {
  const client = useQueryClient()
  const progress = useQuery({
    queryKey: ['study', 'progress', subject.id],
    queryFn: () => api<Progress>('/study/progress'),
  })
  const [tab, setTab] = useState('Practice')
  const [queue, setQueue] = useState<Exercise[]>([])
  const [mode, setMode] = useState<'PRACTICE' | 'MOCK'>('PRACTICE')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({})
  const [request, setRequest] = useState<Attempt | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [historyError, setHistoryError] = useState<unknown>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const save = useMutation({
    mutationFn: (body: Attempt) => api<Result>('/study/attempts', { method: 'POST', body }),
    retry: false,
    onSuccess: (data) => {
      setResult(data)
      client.invalidateQueries({ queryKey: ['study', 'progress'] })
    },
  })
  const start = (exercises: Exercise[], nextMode: 'PRACTICE' | 'MOCK') => {
    setQueue(exercises)
    setMode(nextMode)
    setIndex(0)
    setAnswers({})
    setRequest(null)
    setResult(null)
    save.reset()
  }
  const submit = () => {
    const body = request ?? {
      requestId: crypto.randomUUID(),
      subjectId: subject.id,
      version: subject.version,
      mode,
      submissions: queue.map((e) => ({ exerciseId: e.id, answers: answers[e.id] ?? {} })),
    }
    setRequest(body)
    save.mutate(body)
  }
  const reset = () => {
    setQueue([])
    setResult(null)
    setRequest(null)
    save.reset()
  }
  const current = queue[index]
  const locked = request !== null
  const exercises = subject.exercises.filter((e) => topic === 'all' || e.topic === topic)
  const answered = queue.reduce(
    (n, e) => n + e.fields.filter((f) => answers[e.id]?.[f.id]?.trim()).length,
    0,
  )
  const totalFields = queue.reduce((n, e) => n + e.fields.length, 0)
  return (
    <>
      <section className="study-hero">
        <div>
          <span className="study-kicker">
            {midtermTitle} · {topic === 'all' ? 'All topics' : topic}
          </span>
          <h1>
            Understand it.
            <br />
            <em>Then solve it.</em>
          </h1>
          <p>{subject.title}</p>
          <p className="study-hero-note">
            Build confidence one circuit at a time. Original exercises, clear references and worked
            solutions.
          </p>
        </div>
        <div className="study-hero-stats">
          <CircuitBoard size={42} strokeWidth={1.2} />
          <strong>{exercises.length}</strong>
          <span>{topic === 'all' ? 'original exercises' : 'exercises in this topic'}</span>
          <div className="study-small-stats">
            <span>
              <b>3 + 3</b>reported exam format
            </span>
            <span>
              <b>{progress.data?.total.attempts ?? '—'}</b>your saved attempts
            </span>
          </div>
        </div>
      </section>
      {queue.length === 0 && !result && (
        <>
          <nav className="study-tabs" aria-label="Study sections">
            {[
              ['Learn', BookOpen],
              ['Practice', CircuitBoard],
              ['Mock exam', Flag],
            ].map(([name, Icon]) => (
              <button
                key={name as string}
                className={tab === name ? 'active' : ''}
                aria-pressed={tab === name}
                onClick={() => setTab(name as string)}
              >
                <Icon size={18} />
                {name as string}
              </button>
            ))}
          </nav>
          {tab === 'Learn' && (
            <>
              <div className="study-section-heading">
                <h2>Your circuit toolkit</h2>
                <p>Read the law, choose your reference direction, then apply it.</p>
              </div>
              <div className="study-lessons">
                {lessonsFor(subject, topic).map((lesson, i) => (
                  <article key={lesson.title} className="study-lesson">
                    <span className="study-number">{String(i + 1).padStart(2, '0')}</span>
                    <h3>{lesson.title}</h3>
                    <code>{lesson.formula}</code>
                    <p>{lesson.text}</p>
                    <p className="study-trap">
                      <b>Watch out.</b> {lesson.trap}
                    </p>
                  </article>
                ))}
              </div>
              <p className="study-caption">
                Based on the supplied course slides and exam notes. Original explanations and
                practice problems. Supplementary reference:{' '}
                <a
                  href="https://ocw.mit.edu/courses/6-002-circuits-and-electronics-spring-2007/resources/6002_l3/"
                  target="_blank"
                  rel="noreferrer"
                >
                  MIT OCW: Superposition, Thevenin and Norton
                </a>
                .
              </p>
            </>
          )}
          {tab === 'Practice' && (
            <>
              <div className="study-section-heading">
                <div>
                  <h2>Pick a challenge</h2>
                  <p>Work at your own pace. Every answer comes with a reason.</p>
                </div>
              </div>
              <div className="study-exercises">
                {exercises.map((e, i) => (
                  <button
                    className="study-exercise-card"
                    key={e.id}
                    onClick={() => start([e], 'PRACTICE')}
                  >
                    <div>
                      <span className="study-number">{String(i + 1).padStart(2, '0')}</span>
                      <span className="study-level">{e.difficulty}</span>
                    </div>
                    <span className="study-topic">{e.topic}</span>
                    <h3>{e.title}</h3>
                    <span className="study-card-footer">
                      {e.fields.length} {e.fields.length === 1 ? 'answer' : 'answers'}{' '}
                      <ArrowRight size={18} />
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {tab === 'Mock exam' && (
            <section className="study-mock">
              <Flag size={32} />
              <h2>A rehearsal for the real thing</h2>
              <p>
                This mock exam covers the full {midtermTitle.toLowerCase()}, across all core topics.
              </p>
              <p>
                Three theory questions. Three circuit calculations. Work through all six before
                seeing any answers.
              </p>
              <div className="study-mock-plan">
                <span>
                  01—03 <b>Theory</b>
                </span>
                <span>
                  04 <b>Equivalent resistance</b>
                </span>
                <span>
                  05 <b>Ohm & Kirchhoff equations</b>
                </span>
                <span>
                  06 <b>Superposition</b>
                </span>
              </div>
              <p>
                Questions are shuffled within each topic. Each answer field is worth one practice
                point. This is an untimed study score, not an official university marking scheme. AC
                calculations are available separately as extra practice.
              </p>
              <button
                className="button"
                onClick={() => start(mockQuestions(subject.exercises), 'MOCK')}
              >
                Start mock exam <ArrowRight size={18} />
              </button>
            </section>
          )}
          <section className="study-history">
            <h2>Your recent attempts</h2>
            <p className="study-caption">
              Saved practice and mock exams across all topics in this subject.
            </p>
            <ErrorBox error={progress.error ?? historyError} />
            {progress.isPending ? (
              <Loading />
            ) : progress.data?.recent.length ? (
              <div>
                {progress.data.recent.map((a) => (
                  <button
                    disabled={historyLoading}
                    key={a.id}
                    onClick={async () => {
                      setHistoryLoading(true)
                      setHistoryError(null)
                      try {
                        setResult(await api<Result>(`/study/attempts/${a.id}`))
                      } catch (e) {
                        setHistoryError(e)
                      } finally {
                        setHistoryLoading(false)
                      }
                    }}
                  >
                    <span>
                      {a.mode === 'MOCK' ? 'Mock exam' : 'Practice'} ·{' '}
                      {new Date(a.created_at + 'Z').toLocaleString('en-GB', {
                        timeZone: 'Europe/Budapest',
                      })}{' '}
                      (Budapest)
                    </span>
                    <strong>
                      {a.earned}/{a.possible} <ArrowRight size={14} />
                    </strong>
                  </button>
                ))}
              </div>
            ) : (
              <p>No attempts yet. Choose a challenge to begin.</p>
            )}
          </section>
        </>
      )}
      {current && !result && (
        <section className="study-workspace">
          <div className="study-session-header">
            <span>
              {mode === 'MOCK' ? 'MOCK EXAM' : 'PRACTICE'} · {current.topic}
            </span>
            <button className="button secondary" disabled={save.isPending} onClick={reset}>
              {request ? 'Return to exercises' : 'Exit without submitting'}
            </button>
          </div>
          {mode === 'MOCK' && (
            <nav className="study-question-nav" aria-label="Exam questions">
              {queue.map((e, i) => (
                <button
                  key={e.id}
                  aria-current={i === index ? 'step' : undefined}
                  onClick={() => setIndex(i)}
                >
                  {i + 1}
                  <span>
                    {e.fields.every((f) => answers[e.id]?.[f.id]?.trim()) ? (
                      <Check size={12} />
                    ) : (
                      ''
                    )}
                  </span>
                </button>
              ))}
              <span>
                {answered}/{totalFields} answer fields completed
              </span>
            </nav>
          )}
          <h2>{current.title}</h2>
          <p className="study-prompt">{current.prompt}</p>
          <div className={current.circuit ? 'study-solving-grid' : 'study-solving-grid theory'}>
            {current.circuit && (
              <CircuitDiagram
                key={current.id}
                circuit={current.circuit}
                superposition={current.topic === 'Superposition'}
              />
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!save.isPending && (mode === 'PRACTICE' || index === queue.length - 1)) submit()
              }}
              className="study-answer-panel"
            >
              <h3>Your answers</h3>
              <p className="study-caption">
                Numbers use the displayed SI unit. You may also type a unit, e.g. 20 mA or 2.2 kohm.
                Numerical tolerance: 0.5% or 0.000001 SI units, whichever is larger.
              </p>
              {current.fields.some((f) => f.kind === 'equation') && (
                <p className="study-equation-help">
                  Use the exact variable names in the question, =, +, −, *, / and parentheses.
                  Example: U1 = R1*I1. Rearranged or scaled equivalents are accepted. No implicit
                  multiplication.
                </p>
              )}
              {current.fields.map((f) => (
                <div className="study-answer" key={current.id + f.id}>
                  {f.kind === 'choice' ? (
                    <fieldset disabled={locked}>
                      <legend>{f.label}</legend>
                      {f.options.map((option) => (
                        <label className="study-choice" key={option}>
                          <input
                            type="radio"
                            name={current.id + f.id}
                            value={option}
                            checked={answers[current.id]?.[f.id] === option}
                            onChange={() =>
                              setAnswers({
                                ...answers,
                                [current.id]: { ...answers[current.id], [f.id]: option },
                              })
                            }
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <label htmlFor={current.id + f.id}>
                      {f.label}
                      <span className="study-input-unit">
                        <input
                          id={current.id + f.id}
                          type="text"
                          autoComplete="off"
                          maxLength={256}
                          disabled={locked}
                          value={answers[current.id]?.[f.id] ?? ''}
                          onChange={(e) =>
                            setAnswers({
                              ...answers,
                              [current.id]: { ...answers[current.id], [f.id]: e.target.value },
                            })
                          }
                          placeholder={
                            f.kind === 'equation' ? 'Enter an equation' : 'Enter a value'
                          }
                        />
                        {f.unit && <span>{f.unit === 'ohm' ? 'Ω' : f.unit}</span>}
                      </span>
                    </label>
                  )}
                </div>
              ))}
              {mode === 'PRACTICE' && (
                <details className="study-hint">
                  <summary>Need a hint?</summary>
                  <p>{current.hint}</p>
                </details>
              )}
              <ErrorBox error={save.error} />
              {save.isError && (
                <p>
                  Answers are kept for a safe retry of this submission. Returning to exercises
                  discards this local copy; if the server saved it, it will appear in your history.
                </p>
              )}
              {(mode === 'PRACTICE' || index === queue.length - 1) && (
                <>
                  <p className="study-caption">
                    Blank or invalid answers earn zero points.{' '}
                    {mode === 'MOCK' &&
                      `${totalFields - answered} answer fields are still blank across this exam.`}
                  </p>
                  <button className="button" type="submit" disabled={save.isPending}>
                    {save.isPending
                      ? 'Saving and checking…'
                      : save.isError
                        ? 'Retry submission'
                        : mode === 'MOCK'
                          ? 'Finish and evaluate'
                          : 'Check answers'}{' '}
                    <ArrowRight size={17} />
                  </button>
                </>
              )}
            </form>
          </div>
          {mode === 'MOCK' && (
            <div className="study-bottom-nav">
              <button
                className="button secondary"
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
              >
                Previous question
              </button>
              <button
                className="button"
                disabled={index === queue.length - 1}
                onClick={() => setIndex(index + 1)}
              >
                Next question <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
      )}
      {result && (
        <section className="study-results" aria-live="polite">
          <div className="study-result-hero">
            <div>
              <span className="study-kicker">ATTEMPT SAVED</span>
              <h2>
                {result.earned === result.possible
                  ? 'Nicely worked.'
                  : 'Keep building your understanding.'}
              </h2>
              <p>Review each answer and its reasoning below.</p>
            </div>
            <strong>
              {result.earned}
              <small> / {result.possible}</small>
            </strong>
          </div>
          {result.exercises.map((r) => {
            const exercise = r.question
            return (
              <article className="study-result-question" key={r.exerciseId}>
                <h3>
                  {exercise?.title ?? r.exerciseId}{' '}
                  <span>
                    {r.earned}/{r.possible}
                  </span>
                </h3>
                {exercise && <p>{exercise.prompt}</p>}
                {exercise?.circuit && (
                  <CircuitDiagram
                    circuit={exercise.circuit}
                    superposition={exercise.topic === 'Superposition'}
                  />
                )}
                {r.fields.map((f) => {
                  const def = exercise?.fields.find((x) => x.id === f.id)
                  return (
                    <div
                      key={f.id}
                      className={`study-feedback ${f.correct ? 'correct' : 'incorrect'}`}
                    >
                      <strong>
                        {f.correct ? 'Correct' : 'Needs another look'} · {def?.label ?? f.id}
                      </strong>
                      <p>
                        Your answer: <code>{f.answer || 'No answer'}</code>
                      </p>
                      <p>
                        Expected:{' '}
                        <code>
                          {def?.kind === 'numeric'
                            ? Number(Number(f.expected).toPrecision(7))
                            : f.expected}
                          {def?.unit && ` ${def.unit}`}
                        </code>
                      </p>
                      <p>{f.explanation}</p>
                    </div>
                  )
                })}
                <div className="study-worked">
                  <h4>Worked solution</h4>
                  <ol>
                    {r.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              </article>
            )
          })}
          <div className="study-bottom-nav">
            <button className="button secondary" onClick={reset}>
              Back to exercises
            </button>
            {queue.length > 0 && (
              <button className="button" onClick={() => start(queue, mode)}>
                <RotateCcw size={17} />
                Try again
              </button>
            )}
          </div>
        </section>
      )}
      <p className="study-footnote">
        Independent student study material · Reported exam format, not an official exam paper ·
        Progress is private to your account
      </p>
    </>
  )
}
