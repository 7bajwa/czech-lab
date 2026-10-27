import type { DiffPart } from '../lib/check'

export function Diff({ parts }: { parts: DiffPart[] }) {
  return (
    <p className="diff" lang="cs" aria-label="Difference between your answer and the target">
      {parts.map((p, i) => <span key={i} className={p.type} title={p.type === 'missing' ? 'missing' : p.type === 'extra' ? 'not in target' : undefined}>{p.text} </span>)}
    </p>
  )
}
