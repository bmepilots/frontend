// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { api } from '../../shared/api/client'
import { StudyPage } from './StudyPage'
import { CircuitDiagram } from './CircuitDiagram'
import { mockQuestions, type Subject, type Exercise, type Attempt } from './types'
vi.mock('../../shared/api/client', async (original) => ({
  ...(await original<typeof import('../../shared/api/client')>()),
  api: vi.fn(),
}))
const exercise: Exercise = {
  id: 'r-1',
  title: 'Test resistance',
  topic: 'Resistance',
  difficulty: 'Foundation',
  prompt: 'Calculate the resistance.',
  hint: 'Combine the resistors.',
  circuit: null,
  constants: {},
  fields: [{ id: 'R', label: 'Resistance', kind: 'numeric', unit: 'ohm', options: [] }],
}
const subject: Subject = {
  id: 'basics-of-engineering',
  title: 'Basics of Engineering',
  version: 'test-1',
  lessons: [
    {
      title: 'Equivalent resistance',
      formula: 'R = R1 + R2',
      text: 'Combine resistors.',
      trap: 'Check the terminals.',
    },
    {
      title: 'Superposition',
      formula: 'I = I1 + I2',
      text: 'Add signed contributions.',
      trap: 'Do not add powers.',
    },
  ],
  exercises: [
    exercise,
    ...[1, 2, 3, 4].map((i) => ({
      ...exercise,
      id: `t-${i}`,
      title: `Theory ${i}`,
      topic: 'Theory',
      fields: [
        { id: 'choice', label: 'Choose one answer', kind: 'choice', unit: '', options: ['A', 'B'] },
      ],
    })),
    { ...exercise, id: 'eq-1', topic: 'Equations', title: 'Equations' },
    { ...exercise, id: 'sp-1', topic: 'Superposition', title: 'Superposition' },
  ],
}
let failure = false
beforeEach(() => {
  failure = false
  vi.mocked(api)
    .mockReset()
    .mockImplementation(async (path, options) => {
      if (path === '/study/subjects') return [subject]
      if (path === '/study/progress')
        return { total: { attempts: 0, earned: 0, possible: 0 }, recent: [] }
      if (path === '/study/attempts') {
        if (failure) throw new Error('Connection interrupted')
        const body = options?.body as Attempt
        return {
          id: 'saved',
          earned: 0,
          possible: body.submissions.length,
          exercises: body.submissions.map((s) => ({
            exerciseId: s.exerciseId,
            earned: 0,
            possible: 1,
            question: subject.exercises.find((e) => e.id === s.exerciseId),
            fields: [
              {
                id: 'R',
                answer: s.answers.R ?? '',
                correct: false,
                expected: '630',
                explanation: 'Add the series resistors.',
              },
            ],
            steps: ['120 + 180 + 330 = 630 ohm.'],
          })),
        }
      }
      throw new Error(path)
    })
})
afterEach(cleanup)
function HistoryControls() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>Browser back</button>
}
function mount(path = '/study?subject=basics-of-engineering&midterm=1&topic=all') {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <HistoryControls />
        <StudyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
it('opens subject, midterm and topic cards before the filtered workspace, with back navigation', async () => {
  mount('/study')
  await screen.findByRole('heading', { name: 'Choose your subject' })
  expect(screen.queryByRole('button', { name: 'Practice' })).toBeNull()
  await userEvent.click(screen.getByRole('link', { name: /Basics of Engineering/ }))
  await userEvent.click(screen.getByRole('link', { name: /First midterm/ }))
  expect(screen.getByRole('heading', { name: 'Choose a topic' })).toBeTruthy()
  await userEvent.click(screen.getByRole('link', { name: /^Resistance/ }))
  expect(screen.getByRole('button', { name: /Test resistance/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Theory 1/ })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Browser back' }))
  expect(screen.getByRole('heading', { name: 'Choose a topic' })).toBeTruthy()
  await userEvent.click(screen.getByRole('link', { name: /Full midterm review/ }))
  expect(screen.getByRole('button', { name: /Theory 1/ })).toBeTruthy()
  await userEvent.click(screen.getByRole('link', { name: 'First midterm' }))
  expect(screen.getByRole('heading', { name: 'Choose a topic' })).toBeTruthy()
  await userEvent.click(screen.getByRole('link', { name: 'Exam prep' }))
  expect(screen.getByRole('heading', { name: 'Choose your subject' })).toBeTruthy()
})
it('restores a topic from its URL without requiring previous selections', async () => {
  mount('/study?subject=basics-of-engineering&midterm=1&topic=Superposition')
  expect(await screen.findByRole('button', { name: /Superposition/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Test resistance/ })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Learn' }))
  expect(screen.getByRole('heading', { name: 'Superposition' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Equivalent resistance' })).toBeNull()
  expect(screen.getByRole('link', { name: 'First midterm' }).getAttribute('href')).toBe(
    '/study?subject=basics-of-engineering&midterm=1',
  )
})
it.each([
  '/study?subject=unknown',
  '/study?subject=basics-of-engineering&midterm=2',
  '/study?subject=basics-of-engineering&midterm=1&topic=unknown',
  '/study?topic=Resistance',
])('offers recovery for unavailable study links: %s', async (path) => {
  mount(path)
  await screen.findByRole('heading', { name: 'Study material not found' })
  await userEvent.click(screen.getByRole('link', { name: 'Choose a subject' }))
  expect(screen.getByRole('heading', { name: 'Choose your subject' })).toBeTruthy()
})
it('grades only after submission and explains incorrect answers', async () => {
  mount()
  await userEvent.click(await screen.findByRole('button', { name: /Test resistance/ }))
  expect(screen.queryByText(/630/)).toBeNull()
  await userEvent.type(screen.getByLabelText(/^Resistance/), '650')
  await userEvent.click(screen.getByRole('button', { name: 'Check answers' }))
  expect(await screen.findByText(/Needs another look/)).toBeTruthy()
  expect(screen.getByText('Add the series resistors.')).toBeTruthy()
  expect(
    (vi.mocked(api).mock.calls.find(([, o]) => o?.method === 'POST')?.[1]?.body as Attempt)
      .submissions[0].answers,
  ).toEqual({ R: '650' })
})
it('retries the identical request after a network error without losing answers', async () => {
  failure = true
  mount()
  await userEvent.click(await screen.findByRole('button', { name: /Test resistance/ }))
  await userEvent.type(screen.getByLabelText(/^Resistance/), '630')
  await userEvent.click(screen.getByRole('button', { name: 'Check answers' }))
  await screen.findByRole('button', { name: 'Retry submission' })
  expect((screen.getByLabelText(/^Resistance/) as HTMLInputElement).value).toBe('630')
  expect((screen.getByLabelText(/^Resistance/) as HTMLInputElement).disabled).toBe(true)
  failure = false
  await userEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
  await screen.findByText('ATTEMPT SAVED')
  const calls = vi.mocked(api).mock.calls.filter(([, o]) => o?.method === 'POST')
  expect(calls[0][1]?.body).toEqual(calls[1][1]?.body)
})
it('uses the six-question exam blueprint and keeps answers when navigating', async () => {
  const picked = mockQuestions(subject.exercises)
  expect(picked.filter((e) => e.topic === 'Theory')).toHaveLength(3)
  expect(new Set(picked.map((e) => e.id)).size).toBe(6)
  mount('/study?subject=basics-of-engineering&midterm=1&topic=Resistance')
  await userEvent.click(await screen.findByRole('button', { name: 'Mock exam' }))
  await userEvent.click(screen.getByRole('button', { name: /Start mock exam/ }))
  await userEvent.click(screen.getByRole('radio', { name: 'B' }))
  await userEvent.click(screen.getByRole('button', { name: /Next question/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Previous question' }))
  expect((screen.getByRole('radio', { name: 'B' }) as HTMLInputElement).checked).toBe(true)
  expect(screen.queryByRole('button', { name: 'Check answers' })).toBeNull()
  expect(screen.queryByText('Need a hint?')).toBeNull()
  expect(vi.mocked(api).mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(0)
  for (let i = 0; i < 5; i++)
    await userEvent.click(screen.getByRole('button', { name: /Next question/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Finish and evaluate' }))
  await waitFor(() => expect(screen.getByText('ATTEMPT SAVED')).toBeTruthy())
  const body = vi.mocked(api).mock.calls.find(([, o]) => o?.method === 'POST')?.[1]?.body as Attempt
  expect(body.mode).toBe('MOCK')
  expect(body.submissions).toHaveLength(6)
})
it('supports keyboard component inspection and source deactivation', async () => {
  render(
    <CircuitDiagram
      superposition
      circuit={{
        nodes: [
          { id: 'A', x: 100, y: 100 },
          { id: 'B', x: 100, y: 300 },
          { id: 'C', x: 400, y: 100 },
        ],
        parts: [
          { id: 'V1', kind: 'voltage', from: 'A', to: 'B', value: 12, unit: 'V' },
          { id: 'J1', kind: 'current', from: 'C', to: 'B', value: 0.02, unit: 'A' },
        ],
      }}
    />,
  )
  fireEvent.keyDown(screen.getByRole('button', { name: /V1:/ }), { key: 'Enter' })
  expect(screen.getByText(/Positive terminal: A/)).toBeTruthy()
  await userEvent.selectOptions(screen.getByLabelText('Active sources'), 'J1')
  expect(screen.getByText('Short circuit')).toBeTruthy()
  await userEvent.selectOptions(screen.getByLabelText('Active sources'), 'V1')
  expect(screen.getByText('Open circuit')).toBeTruthy()
})
