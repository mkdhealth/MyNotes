import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { supabase } from '../supabase'

export default function Editor({ pageId, onMetaChange, onOpenAI }) {
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [status, setStatus] = useState('')
  const saveTimer = useRef(null)
  const loaded = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
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
      .select('title, content, tags')
      .eq('id', pageId)
      .single()
      .then(({ data }) => {
        if (!data) return
        setTitle(data.title || '')
        setTags(data.tags || [])
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
      if (!error) setTimeout(() => setStatus(''), 1500)
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

  return (
    <div className="editor-wrap">
      <div className="editor-topbar">
        <span className="save-status">{status}</span>
        <button className="btn ai" onClick={onOpenAI}>✨ AI</button>
      </div>
      <input
        className="page-title"
        value={title}
        placeholder="Untitled"
        onChange={(e) => changeTitle(e.target.value)}
      />
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
      <EditorContent editor={editor} className="editor-content" />
    </div>
  )
}
