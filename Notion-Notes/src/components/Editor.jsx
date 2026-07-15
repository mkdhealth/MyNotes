import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextStyle from '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'
import { supabase } from '../supabase'

// Custom font-size support on top of TextStyle
const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => el.style.fontSize || null,
            renderHTML: (attrs) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
          },
        },
      },
    ]
  },
})

function Toolbar({ editor, onAttach, uploading }) {
  if (!editor) return null
  const b = (active) => `tb-btn ${active ? 'on' : ''}`

  const blockValue = editor.isActive('heading', { level: 1 })
    ? 'h1'
    : editor.isActive('heading', { level: 2 })
    ? 'h2'
    : editor.isActive('heading', { level: 3 })
    ? 'h3'
    : 'p'

  const setBlock = (v) => {
    const c = editor.chain().focus()
    if (v === 'p') c.setParagraph().run()
    else c.toggleHeading({ level: Number(v[1]) }).run()
  }

  const setSize = (v) => {
    const c = editor.chain().focus()
    if (v === 'default') c.setMark('textStyle', { fontSize: null }).run()
    else c.setMark('textStyle', { fontSize: v }).run()
  }

  return (
    <div className="toolbar">
      <select className="tb-select" value={blockValue} onChange={(e) => setBlock(e.target.value)} title="Text style">
        <option value="p">Text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <select className="tb-select" defaultValue="default" onChange={(e) => setSize(e.target.value)} title="Font size">
        <option value="default">Size</option>
        <option value="14px">Small</option>
        <option value="16px">Normal</option>
        <option value="20px">Large</option>
        <option value="24px">Huge</option>
      </select>
      <span className="tb-sep" />
      <button className={b(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><b>B</b></button>
      <button className={b(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><i>I</i></button>
      <button className={b(editor.isActive('underline'))} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><u>U</u></button>
      <button className={b(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"><s>S</s></button>
      <button className={b(editor.isActive('highlight'))} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Highlight">🖍</button>
      <button className={b(editor.isActive('code'))} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code">{'</>'}</button>
      <span className="tb-sep" />
      <button className={b(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">•≡</button>
      <button className={b(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">1≡</button>
      <button className={b(editor.isActive('taskList'))} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist">☑</button>
      <button className={b(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">❝</button>
      <span className="tb-sep" />
      <button className="tb-btn" onClick={onAttach} disabled={uploading} title="Attach image or file">
        {uploading ? '…' : '📎'}
      </button>
      <button
        className="tb-btn"
        title="Insert current date & time"
        onClick={() =>
          editor.chain().focus().insertContent(
            new Date().toLocaleString(undefined, {
              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
            }) + ' '
          ).run()
        }
      >
        📅
      </button>
    </div>
  )
}

export default function Editor({ pageId, onMetaChange, onOpenAI }) {
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const [times, setTimes] = useState({ created_at: null, updated_at: null })
  const saveTimer = useRef(null)
  const loaded = useRef(false)
  const fileInput = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Underline,
      TextStyle,
      FontSize,
      Image,
      Link.configure({ openOnClick: true }),
      Placeholder.configure({ placeholder: 'Just start writing… (try # for a heading, [] for a checkbox)' }),
    ],
    onUpdate: ({ editor }) => {
      if (!loaded.current) return
      scheduleSave({ content: editor.getJSON(), content_text: editor.getText() })
    },
  })

  useEffect(() => {
    if (!editor) return
    supabase
      .from('pages')
      .select('title, content, tags, created_at, updated_at')
      .eq('id', pageId)
      .single()
      .then(({ data }) => {
        if (!data) return
        setTitle(data.title || '')
        setTags(data.tags || [])
        setTimes({ created_at: data.created_at, updated_at: data.updated_at })
        editor.commands.setContent(data.content || '')
        loaded.current = true
      })
  }, [editor, pageId])

  const scheduleSave = (patch) => {
    setStatus('Saving…')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from('pages')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', pageId)
      setStatus(error ? 'Save failed' : 'Saved')
      if (!error) {
        setTimes((t) => ({ ...t, updated_at: new Date().toISOString() }))
        setTimeout(() => setStatus(''), 1500)
      }
    }, 600)
  }

  const changeTitle = (t) => {
    setTitle(t)
    onMetaChange({ title: t })
    scheduleSave({ title: t })
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (!t || tags.includes(t)) return setTagInput('')
    const next = [...tags, t]
    setTags(next)
    setTagInput('')
    onMetaChange({ tags: next })
    scheduleSave({ tags: next })
  }

  const removeTag = (t) => {
    const next = tags.filter((x) => x !== t)
    setTags(next)
    onMetaChange({ tags: next })
    scheduleSave({ tags: next })
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !editor) return
    if (file.size > 20 * 1024 * 1024) return alert('Max file size is 20 MB.')
    setUploading(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const path = `${u.user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
      const { error } = await supabase.storage.from('files').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('files').getPublicUrl(path)
      const url = data.publicUrl
      if (file.type.startsWith('image/')) {
        editor.chain().focus().setImage({ src: url, alt: file.name }).run()
      } else {
        editor
          .chain()
          .focus()
          .insertContent(`<p><a href="${url}" target="_blank">📄 ${file.name}</a></p>`)
          .run()
      }
    } catch (err) {
      alert('Upload failed: ' + err.message + '\n(Did you run supabase-storage.sql?)')
    }
    setUploading(false)
  }

  const fmt = (d) =>
    d &&
    new Date(d).toLocaleString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

  const exportWord = () => {
    if (!editor) return
    const html = `<html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1>${editor.getHTML()}</body></html>`
    const blob = new Blob(['﻿' + html], { type: 'application/msword' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${title || 'note'}.doc`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="editor-wrap">
      <div className="editor-topbar">
        <span className="save-status">{status}</span>
        <button className="btn export" onClick={exportWord} title="Download as Word">⬇ Word</button>
        <button className="btn export" onClick={() => window.print()} title="Print / Save as PDF">⬇ PDF</button>
        <button className="btn ai" onClick={onOpenAI}>✨ AI</button>
      </div>
      <input
        className="page-title"
        value={title}
        placeholder="Untitled"
        onChange={(e) => changeTitle(e.target.value)}
      />
      {times.created_at && (
        <div className="muted small time-row">
          Created {fmt(times.created_at)} · Last edited {fmt(times.updated_at)}
        </div>
      )}
      <div className="tags-row">
        {tags.map((t) => (
          <span key={t} className="tag">
            #{t} <button onClick={() => removeTag(t)}>×</button>
          </span>
        ))}
        <input
          className="tag-input"
          value={tagInput}
          placeholder="+ tag"
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
          onBlur={addTag}
        />
      </div>
      <Toolbar editor={editor} uploading={uploading} onAttach={() => fileInput.current?.click()} />
      <input ref={fileInput} type="file" hidden onChange={handleFile}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" />
      <EditorContent editor={editor} className="editor-content" />
    </div>
  )
}
