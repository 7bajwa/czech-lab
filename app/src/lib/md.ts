// Tiny markdown → HTML for our own docs (grammar study, exam format): headings, paragraphs, lists, tables, **bold**, *italic*.
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')

export function md(src: string): string {
  const out: string[] = []
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim()) continue
    const h = l.match(/^(#{1,4}) (.+)/)
    if (h) { out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`); continue }
    if (l.startsWith('|')) {
      const rows: string[][] = []
      for (; lines[i]?.startsWith('|'); i++) rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()))
      i--
      const [head, ...body] = rows.filter((r) => !/^:?-+:?$/.test(r[0]))
      out.push(`<div class="scroll-x"><table class="md"><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`)
      continue
    }
    const li = l.match(/^\s*(?:[-*]|\d+\.) (.+)/)
    if (li) {
      const ordered = /^\s*\d+\./.test(l), items: string[] = []
      for (; lines[i] && /^\s*(?:[-*]|\d+\.) /.test(lines[i]); i++) items.push(`<li>${inline(lines[i].replace(/^\s*(?:[-*]|\d+\.) /, ''))}</li>`)
      i--
      out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`)
      continue
    }
    if (l.startsWith('> ')) { out.push(`<blockquote>${inline(l.slice(2))}</blockquote>`); continue }
    const para = [l]
    for (; lines[i + 1]?.trim() && !/^(#|\||\s*[-*] |\s*\d+\. |> )/.test(lines[i + 1]); i++) para.push(lines[i + 1])
    out.push(`<p>${inline(para.join(' '))}</p>`)
  }
  return out.join('\n')
}
