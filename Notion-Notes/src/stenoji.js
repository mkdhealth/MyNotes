// Talks to Stenoji through our own /api/dictate proxy so the secret key
// stays server-side. Used by both quick dictation and meeting recording.
import { supabase } from './supabase'

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${data.session.access_token}` }
}

// Records mic audio; returns a MediaRecorder-based controller.
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

// Uploads audio to Stenoji, runs transcription, polls until done. Returns the transcript object.
export async function transcribe(blob, { summarize = false } = {}, onStatus) {
  const ah = await authHeader()
  onStatus?.('Uploading audio…')
  const up = await fetch('/api/dictate?step=upload', { method: 'POST', headers: ah, body: blob }).then((r) => r.json())
  if (!up.upload_url) throw new Error(up.error || 'Upload failed')

  onStatus?.('Transcribing…')
  const reqBody = {
    audio_url: up.upload_url,
    speech_models: ['universal-3-pro', 'universal-2'],
    speaker_labels: true,
    language_detection: true,
    ...(summarize ? { summarization: true, summary_model: 'informative', summary_type: 'bullets' } : {}),
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
    onStatus?.(`Transcribing… (${t.status})`)
  }
}

export function transcriptToHTML(t) {
  const speakers = new Set((t.utterances || []).map((u) => u.speaker))
  return speakers.size > 1
    ? t.utterances.map((u) => `<p><strong>Speaker ${u.speaker}:</strong> ${u.text}</p>`).join('')
    : `<p>${t.text || ''}</p>`
}

export function summaryToHTML(t) {
  if (!t.summary) return ''
  const lines = t.summary.split('\n').map((l) => l.trim()).filter(Boolean)
  return '<h2>Summary</h2>' + lines.map((l) => `<p>${l.replace(/^[-*•]\s*/, '• ')}</p>`).join('')
}
