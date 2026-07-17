import { useState } from 'react'
import { supabase } from '../supabase'

const ACTIONS = [
  { id: 'summarize', label: '📄 Summarize' },
  { id: 'insights', label: '💡 Key insights' },
  { id: 'action_items', label: '✅ Action items' },
  { id: 'improve', label: '✍️ Improve writing', pageOnly: true },
]

export default function AIPanel({ pageId, scope = 'page', onClose, onCreateTemplate }) {
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [question, setQuestion] = useState('')
  const [tpl, setTpl] = useState('')
  const all = scope === 'all'

  const runTemplate = async () => {
    if (!tpl.trim()) return
    setBusy(true)
    setOutput('')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sess.session.access_token}`,
        },
        body: JSON.stringify({ action: 'template', question: tpl, title: '', text: '' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Template generation failed')
      const html = json.result.replace(/```html?/g, '').replace(/```/g, '').trim()
      onCreateTemplate(tpl.trim(), html)
    } catch (e) {
      setOutput('Request failed: ' + e.message)
      setBusy(false)
    }
  }

  const run = async (action, q = '') => {
    setBusy(true)
    setOutput('')
    try {
      let title = ''
      let text = ''
      if (all) {
        const { data } = await supabase
          .from('pages')
          .select('title, content_text')
          .limit(300)
        title = 'All notes'
        text = (data || [])
          .filter((p) => p.content_text?.trim())
          .map((p) => `## ${p.title}\n${p.content_text}`)
          .join('\n\n')
          .slice(0, 200000)
        if (action === 'ask') action = 'ask_all'
      } else {
        const { data: page } = await supabase
          .from('pages')
          .select('title, content_text')
          .eq('id', pageId)
          .single()
        title = page?.title || ''
        text = page?.content_text || ''
      }
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sess.session.access_token}`,
        },
        body: JSON.stringify({ action, question: q, title, text }),
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
          <strong>✨ AI — {all ? 'all notes' : 'this note'}</strong>
          <button className="btn link" onClick={onClose}>Close</button>
        </div>
        <div className="ai-actions">
          {ACTIONS.filter((a) => !(all && a.pageOnly)).map((a) => (
            <button key={a.id} className="btn ghost" disabled={busy} onClick={() => run(a.id)}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="ai-ask">
          <input
            placeholder={all ? 'Ask anything across all your notes…' : 'Ask anything about this note…'}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && question.trim() && run('ask', question)}
          />
          <button className="btn primary" disabled={busy || !question.trim()} onClick={() => run('ask', question)}>
            Ask
          </button>
        </div>
        <div className="ai-ask">
          <input
            placeholder="Create a template: e.g. meeting notes, daily journal…"
            value={tpl}
            onChange={(e) => setTpl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runTemplate()}
          />
          <button className="btn primary" disabled={busy || !tpl.trim()} onClick={runTemplate}>
            📋 Create
          </button>
        </div>
        <div className="ai-output">
          {busy ? 'Thinking…' : output || 'Pick an action, ask a question, or create a template.'}
        </div>
      </div>
    </div>
  )
}
