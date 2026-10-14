import type { Subject } from './types'

// Contract 5 contains the first engineering midterm. Keep navigation metadata here
// until the backend catalog supports multiple midterms; never invent unavailable content.
export function midtermsFor(subject: Subject) {
  return subject.id === 'basics-of-engineering'
    ? [{ id: '1', title: 'First midterm', description: 'Electrical circuits', subject }]
    : []
}

export function studyUrl(subject?: string, midterm?: string, topic?: string) {
  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  if (subject && midterm) params.set('midterm', midterm)
  if (subject && midterm && topic) params.set('topic', topic)
  return '/study' + (params.size ? `?${params}` : '')
}

export const topicDescriptions: Record<string, string> = {
  Resistance:
    'Reduce series, parallel and bridge networks. Explore different measurement terminals.',
  'Ohm and power': 'Find voltages, currents and power with Ohm law and divider circuits.',
  Equations: 'Build consistent Ohm, node and loop equations with clear reference directions.',
  Superposition: 'Explore one source at a time and combine their signed contributions.',
  'AC extension': 'Extra practice with reactance, RMS values, charge and stored energy.',
  Theory: 'Check your understanding of circuit laws, components and terminal equivalents.',
}

const topicLessons: Record<string, string[]> = {
  Resistance: ['Equivalent resistance'],
  'Ohm and power': ['Ohm law and references', 'Equivalent resistance'],
  Equations: ['Ohm law and references', 'Kirchhoff current law', 'Kirchhoff voltage law'],
  Superposition: ['Superposition', 'Kirchhoff current law', 'Kirchhoff voltage law'],
  'AC extension': ['Capacitors and inductors', 'Sinusoidal AC'],
}

export function lessonsFor(subject: Subject, topic: string) {
  if (topic === 'all' || topic === 'Theory') return subject.lessons
  return subject.lessons.filter((lesson) => topicLessons[topic]?.includes(lesson.title))
}
