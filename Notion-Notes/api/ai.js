// Vercel serverless function. Keeps your AI API key server-side.
// Env vars needed in Vercel: GEMINI_API_KEY (free from https://aistudio.google.com)
//   — or ANTHROPIC_API_KEY as an alternative — plus VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

const PROMPTS = {
  summarize: 'Summarize this note concisely in a few short paragraphs or bullets.',
  insights: 'Extract the key insights, themes, and non-obvious takeaways from this note.',
  action_items: 'Extract all action items / to-dos from this note as a checklist. If none, say so.',
  improve: 'Rewrite this note with improved clarity, structure, and grammar. Keep the meaning and voice.',
  ask: 'Answer the question using only the note content. If the note lacks the answer, say so.',
  ask_all: "Answer the question using the user's notes below (each note starts with '## title'). Mention which note titles you drew from. If the notes lack the answer, say so.",
  template:
    'Create a reusable note-taking template for the purpose described. Return ONLY raw HTML — no markdown, no code fences, no explanations. Allowed tags: h1, h2, h3, p, ul, ol, li, blockquote, strong, em, and checklists written exactly as <ul data-type="taskList"><li data-type="taskItem" data-checked="false">item</li></ul>. Include clear section headings and short placeholder hints in the paragraphs.',
}

async function callGemini(userMsg) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userMsg }] }],
        generationConfig: { maxOutputTokens: 1500 },
      }),
    }
  )
  const data = await r.json()
  if (!r.ok) throw new Error(data?.error?.message || 'Gemini request failed')
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
}

async function callClaude(userMsg) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: userMsg }],
    }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data?.error?.message || 'Claude request failed')
  return data.content?.[0]?.text || ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify the caller is a signed-in user of this app
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Not signed in' })
  const userRes = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.VITE_SUPABASE_ANON_KEY },
  })
  if (!userRes.ok) return res.status(401).json({ error: 'Invalid session' })

  const { action, title, text, question } = req.body || {}
  if (!PROMPTS[action]) return res.status(400).json({ error: 'Unknown action' })
  if (action === 'template' && !question?.trim())
    return res.status(400).json({ error: 'Describe what the template is for.' })
  if (action !== 'template' && !text?.trim())
    return res.status(400).json({ error: 'This note is empty.' })

  const userMsg =
    action === 'template'
      ? `${PROMPTS.template}\n\nTemplate purpose: ${question}`
      : `${PROMPTS[action]}\n\n<note title="${title}">\n${text.slice(0, action === 'ask_all' ? 200000 : 50000)}\n</note>` +
        (action === 'ask' || action === 'ask_all' ? `\n\nQuestion: ${question}` : '')

  try {
    let result
    if (process.env.GEMINI_API_KEY) result = await callGemini(userMsg)
    else if (process.env.ANTHROPIC_API_KEY) result = await callClaude(userMsg)
    else return res.status(500).json({ error: 'No AI key configured. Set GEMINI_API_KEY in Vercel.' })
    return res.status(200).json({ result })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}
