export interface Circuit {
  nodes: { id: string; x: number; y: number }[]
  parts: { id: string; kind: string; from: string; to: string; value: number; unit: string }[]
}
export interface Exercise {
  id: string
  title: string
  topic: string
  difficulty: string
  prompt: string
  hint: string
  circuit: Circuit | null
  constants: Record<string, number>
  fields: { id: string; label: string; kind: string; unit: string; options: string[] }[]
}
export interface Subject {
  id: string
  title: string
  version: string
  lessons: { title: string; formula: string; text: string; trap: string }[]
  exercises: Exercise[]
}
export interface Result {
  id: string
  earned: number
  possible: number
  exercises: {
    exerciseId: string
    earned: number
    possible: number
    fields: {
      id: string
      answer: string
      correct: boolean
      expected: string
      explanation: string
    }[]
    steps: string[]
    question: Exercise
  }[]
}
export interface Progress {
  total: { attempts: number; earned: number; possible: number }
  exercises: { exerciseId: string; attempts: number; bestEarned: number; possible: number }[]
  recent: {
    id: string
    mode: string
    earned: number
    possible: number
    createdAt?: string
    created_at?: string | number
  }[]
}
export interface Attempt {
  requestId: string
  subjectId: string
  version: string
  mode: 'PRACTICE' | 'MOCK'
  submissions: { exerciseId: string; answers: Record<string, string> }[]
}
export function mockQuestions(exercises: Exercise[]) {
  const pick = (topic: string, count: number) => {
    const pool = exercises.filter((e) => e.topic === topic)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, count)
  }
  return [
    ...pick('Theory', 3),
    ...pick('Resistance', 1),
    ...pick('Equations', 1),
    ...pick('Superposition', 1),
  ]
}
