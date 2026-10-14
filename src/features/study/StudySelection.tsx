import { ArrowRight, ChevronRight, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'

export function StudyBreadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="study-breadcrumbs" aria-label="Study navigation">
      <ol>
        {items.map((item, index) => (
          <li key={index}>
            {index > 0 && <ChevronRight size={14} aria-hidden="true" />}
            {item.to ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function StudySelection({
  eyebrow,
  title,
  description,
  cards,
}: {
  eyebrow: string
  title: string
  description: string
  cards: { id: string; title: string; description: string; detail: string; to: string }[]
}) {
  return (
    <section className="study-selection">
      <header className="study-selection-header">
        <span className="study-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      {cards.length ? (
        <div className="study-selection-grid">
          {cards.map((card) => (
            <Link className="study-selection-card" key={card.id} to={card.to}>
              <span className="study-selection-icon">
                <BookOpen size={25} strokeWidth={1.5} />
              </span>
              <h2>{card.title}</h2>
              <p>{card.description}</p>
              <span className="study-selection-detail">
                {card.detail}
                <ArrowRight size={19} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="study-selection-empty">No study material is available here yet.</p>
      )}
    </section>
  )
}
