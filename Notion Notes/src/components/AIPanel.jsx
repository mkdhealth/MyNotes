import { useState } from 'react'
import { supabase } from '../supabase'

const ACTIONS = [
  { id: 'summarize', label: '📄 Summarize' },
  { id: 'insights', label: '💡 Key insights' },
  { id: 'action_items', label: '✅ Action items' },
  { id: 'improve', label: '✍️ Improve writing' },
]

export default function AIPanel({ pageId, onClose }) {
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [question, setQuestion] = useState('')

  const run = async (action, q = '') => {
    setBusy(true)
    setOutput('')
    try {
      const { data: page } = await supabase
        .from('pages')
        .select('title, content_text')
        .eq('id', pageId)
        .single()
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sess.session.access_token}`,
        },
        body: JSON.stringify({
          action,
          question: q,
          title: page?.title || '',
          text: page?.content_text || '',
        }),
      })
      const json = await res.json()
      setOutput(res.ok ? json.result : json.error || 'Something went wrong.')
    } catch (e) {
      setOutput('Request failed: ' + e.message)
    }
    setBusy(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ai-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ai-head">
          <strong>✨ AI assistant</strong>
          <button className="btn link" onClick={onClose}>Close</button>
        </div>
        <div className="ai-actions">
          {ACTIONS.map((a) => (
            <button key={a.id} className="btn ghost" disabled={busy} onClick={() => run(a.id)}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="ai-ask">
          <input
            placeholder="Ask anything about this note…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && question.trim() && run('ask', question)}
          />
          <button className="btn primary" disabled={busy || !question.trim()} onClick={() => run('ask', question)}>
            Ask
          </button>
        </div>
        <div className="ai-output">
          {busy ? 'Thinking…' : output || 'Pick an action or ask a question.'}
        </div>
      </div>
    </div>
  )
}
