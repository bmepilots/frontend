import { useId, useState } from 'react'
import type { Circuit } from './types'

function valueLabel(value: number, unit: string) {
  for (const [scale, prefix] of [
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'µ'],
    [1e-9, 'n'],
  ] as const) {
    if (Math.abs(value) >= scale)
      return `${Number((value / scale).toPrecision(5))} ${prefix}${unit === 'ohm' ? 'Ω' : unit}`
  }
  return `${value} ${unit}`
}

export function CircuitDiagram({
  circuit,
  superposition = false,
}: {
  circuit: Circuit
  superposition?: boolean
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [source, setSource] = useState('all')
  const marker = useId().replaceAll(':', '')
  const sources = circuit.parts.filter((p) => p.kind === 'voltage' || p.kind === 'current')
  const part = circuit.parts.find((p) => p.id === selected)
  return (
    <div className="study-circuit">
      <div className="study-circuit-toolbar">
        <span className="study-kicker">CIRCUIT EXPLORER</span>
        {superposition && (
          <label>
            Active sources{' '}
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">All sources</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} only
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="study-diagram-scroll">
        <svg
          viewBox="0 0 780 410"
          role="group"
          aria-label="Interactive circuit. Select a component to inspect its connections."
        >
          <defs>
            <marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6" fill="currentColor" />
            </marker>
          </defs>
          {circuit.parts.map((p) => {
            const a = circuit.nodes.find((n) => n.id === p.from)!
            const b = circuit.nodes.find((n) => n.id === p.to)!
            const length = Math.hypot(b.x - a.x, b.y - a.y)
            const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
            const mid = length / 2
            const off = source !== 'all' && sources.includes(p) && source !== p.id
            const wire = p.kind === 'wire' || (off && p.kind === 'voltage')
            const label = `${p.id}: ${valueLabel(p.value, p.unit)}, ${p.from} to ${p.to}${off ? ', inactive' : ''}`
            const interactive = p.kind !== 'wire'
            return (
              <g
                key={p.id}
                className={`circuit-part ${selected === p.id ? 'selected' : ''} ${off ? 'inactive' : ''}`}
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-label={interactive ? label : undefined}
                aria-pressed={interactive ? selected === p.id : undefined}
                onClick={interactive ? () => setSelected(p.id) : undefined}
                onKeyDown={
                  interactive
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelected(p.id)
                        }
                      }
                    : undefined
                }
              >
                <g transform={`translate(${a.x} ${a.y}) rotate(${angle})`}>
                  {interactive && (
                    <rect
                      className="circuit-hit"
                      x={mid - 48}
                      y="-32"
                      width="96"
                      height="64"
                      rx="12"
                    />
                  )}
                  <path
                    d={wire ? `M0 0 H${length}` : `M0 0 H${mid - 25} M${mid + 25} 0 H${length}`}
                  />
                  {!wire && !(off && p.kind === 'current') && (
                    <>
                      {p.kind === 'resistor' && (
                        <rect
                          x={mid - 25}
                          y="-11"
                          width="50"
                          height="22"
                          className="circuit-symbol"
                        />
                      )}
                      {(p.kind === 'voltage' || p.kind === 'current') && (
                        <circle cx={mid} cy="0" r="25" className="circuit-symbol" />
                      )}
                      {p.kind === 'voltage' && (
                        <path d={`M${mid - 16} 0 h12 M${mid - 10} -6 v12 M${mid + 8} 0 h12`} />
                      )}
                      {p.kind === 'current' && (
                        <path d={`M${mid - 15} 0 h30`} markerEnd={`url(#${marker})`} />
                      )}
                      {p.kind === 'capacitor' && (
                        <path
                          d={`M${mid - 25} 0 h20 M${mid + 5} 0 h20 M${mid - 5} -22 v44 M${mid + 5} -22 v44`}
                        />
                      )}
                      {p.kind === 'inductor' && (
                        <path
                          d={`M${mid - 25} 0 q0 -23 10 -23 q10 0 10 23 q0 -23 10 -23 q10 0 10 23 h10`}
                        />
                      )}
                    </>
                  )}
                  {off && p.kind === 'current' && (
                    <>
                      <circle cx={mid - 25} cy="0" r="3" />
                      <circle cx={mid + 25} cy="0" r="3" />
                    </>
                  )}
                </g>
                {interactive && (
                  <text
                    x={(a.x + b.x) / 2 + (Math.abs(b.x - a.x) < 70 ? 42 : 0)}
                    y={(a.y + b.y) / 2 - (Math.abs(b.x - a.x) < 70 ? 15 : 37)}
                    textAnchor={Math.abs(b.x - a.x) < 70 ? 'start' : 'middle'}
                  >
                    <tspan className="component-id">{p.id}</tspan>
                    <tspan x={(a.x + b.x) / 2 + (Math.abs(b.x - a.x) < 70 ? 42 : 0)} dy="19">
                      {off
                        ? p.kind === 'voltage'
                          ? 'Short circuit'
                          : 'Open circuit'
                        : valueLabel(p.value, p.unit)}
                    </tspan>
                  </text>
                )}
              </g>
            )
          })}
          {circuit.nodes.map((n) => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r="4" className="circuit-node" />
              <text x={n.x - 12} y={n.y + (n.y > 250 ? 28 : -15)} className="node-label">
                {n.id}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="study-inspector" aria-live="polite">
        {part
          ? `${part.id} · ${part.kind} · ${part.from} → ${part.to} · ${valueLabel(part.value, part.unit)}${part.kind === 'voltage' ? ' · Positive terminal: ' + part.from : ''}`
          : 'Select a component to inspect it. Dots mark connected nodes; plain wires join them.'}
      </p>
      {superposition && (
        <p className="study-caption">
          Inactive ideal voltage sources become shorts; inactive ideal current sources become open
          circuits. Resistors stay in place.
        </p>
      )}
      <details>
        <summary>Connections and reference directions</summary>
        <ul>
          {circuit.parts.map((p) => (
            <li key={p.id}>
              {p.id}: {p.from} → {p.to} · {p.kind}
              {p.kind !== 'wire' && ` · ${valueLabel(p.value, p.unit)}`}
              {p.kind === 'voltage' && ` · + at ${p.from}, − at ${p.to}`}
            </li>
          ))}
        </ul>
        <p>
          Current-source arrows follow the listed direction. Resistor current references are stated
          in each question.
        </p>
      </details>
    </div>
  )
}
