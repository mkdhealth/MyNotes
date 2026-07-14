import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

export default function SearchModal({ onClose, onSelect }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const inputRef = useRef(null)
  const timer = useRef(null)

  useEffect(() => inputRef.current?.focus(), [])

  useEffect(() => {
    clearTimeout(timer.current)
    if (!q.trim()) return setResults([])
    timer.current = setTimeout(async () => {
      const term = q.trim()
      const { data } = await supabase
        .from('pages')
        .select('id, title, tags, content_text')
        .or(`title.ilike.%${term}%,content_text.ilike.%${term}%,tags.cs.{${term.toLowerCase()}}`)
        .limit(20)
      setResults(data || [])
    }, 250)
  }, [q])

  const snippet = (text) => {
    if (!text) return ''
    const i = text.toLowerCase().indexOf(q.trim().toLowerCase())
    if (i < 0) return text.slice(0, 80)
    return '…' + text.slice(Math.max(0, i - 30), i + 50) + '…'
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="search-input"
          placeholder="Search pages, content, tags…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
        />
        <div className="search-results">
          {results.map((r) => (
            <div key={r.id} className="search-result" onClick={() => onSelect(r.id)}>
              <strong>{r.title || 'Untitled'}</strong>
              {r.tags?.length > 0 && <span className="muted small"> {r.tags.map((t) => `#${t}`).join(' ')}</span>}
              <div className="muted small">{snippet(r.content_text)}</div>
            </div>
          ))}
          {q && results.length === 0 && <p className="muted small">No results.</p>}
        </div>
      </div>
    </div>
  )
}
