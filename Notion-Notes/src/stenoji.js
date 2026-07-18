// Records audio, uploads it to Supabase Storage (browser -> Supabase, no size limit),
// then asks Stenoji (via our /api/dictate proxy) to transcribe it. The secret key
// stays server-side in the proxy. Used by both dictation and meeting recording.
import { supabase } from './supabase'

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${data.session.access_token}` }
}

// Starts mic recording; returns a controller whose stop() resolves to an audio Blob.
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mr = new MediaRecorder(stream)
  const chunks = []
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  mr.start()
  return {
    stop: () =>
      new Promise((resolve) => {
        mr.onstop = () => {
          stream.getTracks().forEach((t) => t.stop())
          resolve(new Blob(chunks, { type: mr.mimeType }))
        }
        mr.stop()
      }),
  }
}

export async function transcribe(blob, { summarize = false } = {}, onStatus) {
  const ah = await authHeader()

  onStatus && onStatus('Uploading audio...')
  const { data: u } = await supabase.auth.getUser()
  const ext = (blob.type.split('/')[1] || 'webm').split(';')[0]
  const path = `${u.user.id}/audio-${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage.from('files').upload(path, blob, { contentType: blob.type })
  if (upErr) throw new Error('Audio upload failed: ' + upErr.message + ' (did you run supabase-storage.sql?)')
  const audioUrl = supabase.storage.from('files').getPublicUrl(path).data.publicUrl

  onStatus && onStatus('Transcribing...')
  const reqBody = {
    audio_url: audioUrl,
    speech_models: ['universal-3-pro', 'universal-2'],
    speaker_labels: true,
    language_detection: true,
  }
  if (summarize) {
    reqBody.summarization = true
    reqBody.summary_model = 'informative'
    reqBody.summary_type = 'bullets'
  }
  const job = await fetch('/api/dictate?step=transcript', {
    method: 'POST',
    headers: { ...ah, 'content-type': 'application/json' },
    body: JSON.stringify(reqBody),
  }).then((r) => r.json())
  if (!job.id) throw new Error(job.error || 'Transcription request failed')

  for (;;) {
    await new Promise((r) => setTimeout(r, 3000))
    const t = await fetch(`/api/dictate?step=poll&id=${job.id}`, { headers: ah }).then((r) => r.json())
    if (t.status === 'completed') return t
    if (t.status === 'error') throw new Error(t.error || 'Transcription failed')
    onStatus && onStatus('Transcribing... (' + t.status + ')')
  }
}

export function transcriptToHTML(t) {
  const speakers = new Set((t.utterances || []).map((u) => u.speaker))
  if (speakers.size > 1) {
    return t.utterances.map((u) => `<p><strong>Speaker ${u.speaker}:</strong> ${u.text}</p>`).join('')
  }
  return `<p>${t.text || ''}</p>`
}

export function summaryToHTML(t) {
  if (!t.summary) return ''
  const lines = t.summary.split('\n').map((l) => l.trim()).filter(Boolean)
  return '<h2>Summary</h2>' + lines.map((l) => `<p>${l.replace(/^[-*]\s*/, '')}</p>`).join('')
}
