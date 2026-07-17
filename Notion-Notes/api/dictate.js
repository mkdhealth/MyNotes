// Vercel serverless proxy to Stenoji. Adds the shared secret server-side so it is
// never exposed to the browser, and verifies the caller is a signed-in notes user.
// Env vars in Vercel: STENOJI_URL, NOTES_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

export const config = { api: { bodyParser: false } }

async function readRaw(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  const STENOJI = process.env.STENOJI_URL
  const KEY = process.env.NOTES_API_KEY
  if (!STENOJI || !KEY) return res.status(500).json({ error: 'Stenoji not configured (set STENOJI_URL and NOTES_API_KEY).' })

  // Only signed-in notes users may use the proxy
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Not signed in' })
  const uRes = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.VITE_SUPABASE_ANON_KEY },
  })
  if (!uRes.ok) return res.status(401).json({ error: 'Invalid session' })

  const step = req.query.step
  try {
    if (step === 'upload') {
      const body = await readRaw(req)
      const r = await fetch(`${STENOJI}/api/upload`, {
        method: 'POST',
        headers: { 'x-notes-key': KEY },
        body,
      })
      return res.status(r.status).json(await r.json())
    }
    if (step === 'transcript') {
      const body = await readRaw(req)
      const r = await fetch(`${STENOJI}/api/transcript`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-notes-key': KEY },
        body,
      })
      return res.status(r.status).json(await r.json())
    }
    if (step === 'poll') {
      const r = await fetch(`${STENOJI}/api/transcript/${req.query.id}`, {
        headers: { 'x-notes-key': KEY },
      })
      return res.status(r.status).json(await r.json())
    }
    return res.status(400).json({ error: 'Unknown step' })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}
