import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import Auth from './components/Auth'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import SearchModal from './components/SearchModal'
import AIPanel from './components/AIPanel'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pages, setPages] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiScope, setAiScope] = useState('page')
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadPages = useCallback(async () => {
    const { data, error } = await supabase
      .from('pages')
      .select('id, title, parent_id, tags, updated_at')
      .order('created_at', { ascending: true })
    if (!error) setPages(data || [])
  }, [])

  useEffect(() => {
    if (session) loadPages()
  }, [session, loadPages])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const createPage = async (parentId = null) => {
    const { data, error } = await supabase
      .from('pages')
      .insert({
        title: 'Untitled',
        parent_id: parentId,
        content: null,
        content_text: '',
        tags: [],
        user_id: session.user.id,
      })
      .select('id, title, parent_id, tags, updated_at')
      .single()
    if (!error && data) {
      setPages((p) => [...p, data])
      setActiveId(data.id)
    }
  }

  const deletePage = async (id) => {
    if (!confirm('Delete this page and everything inside it?')) return
    await supabase.from('pages').delete().eq('id', id)
    await loadPages()
    if (activeId === id) setActiveId(null)
  }

  const updatePageMeta = (id, patch) => {
    setPages((p) => p.map((pg) => (pg.id === id ? { ...pg, ...patch } : pg)))
  }

  const openAI = (scope) => {
    setAiScope(scope)
    setAiOpen(true)
  }

  const [pendingTemplate, setPendingTemplate] = useState(null)

  const createTemplatePage = async (name, html) => {
    const title = name.charAt(0).toUpperCase() + name.slice(1)
    const { data, error } = await supabase
      .from('pages')
      .insert({
        title,
        parent_id: null,
        content: null,
        content_text: '',
        tags: ['template'],
        user_id: session.user.id,
      })
      .select('id, title, parent_id, tags, updated_at')
      .single()
    if (!error && data) {
      setPages((p) => [...p, data])
      setPendingTemplate(html)
      setActiveId(data.id)
      setAiOpen(false)
    }
  }

  if (loading) return <div className="center-screen">Loading…</div>
  if (!session) return <Auth />

  return (
    <div className="app">
      <button className="hamburger" onClick={() => setSidebarOpen((v) => !v)} title="Toggle sidebar">☰</button>
      {sidebarOpen && (
        <Sidebar
          pages={pages}
          activeId={activeId}
          onSelect={(id) => { setActiveId(id); if (window.innerWidth <= 768) setSidebarOpen(false) }}
          onCreate={createPage}
          onDelete={deletePage}
          onSearch={() => setSearchOpen(true)}
          onAskAI={() => openAI('all')}
          onSignOut={() => supabase.auth.signOut()}
          email={session.user.email}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />
      )}
      <main className="main">
        {activeId ? (
          <Editor
            key={activeId}
            pageId={activeId}
            templateHTML={pendingTemplate}
            onTemplateApplied={() => setPendingTemplate(null)}
            onMetaChange={(patch) => updatePageMeta(activeId, patch)}
            onOpenAI={() => openAI('page')}
          />
        ) : (
          <div className="empty-state">
            <h2>Your notes</h2>
            <p>Select a page from the sidebar or create a new one.</p>
            <button className="btn primary" onClick={() => createPage(null)}>+ New page</button>
          </div>
        )}
      </main>
      {searchOpen && (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          onSelect={(id) => { setActiveId(id); setSearchOpen(false) }}
        />
      )}
      {aiOpen && (aiScope === 'all' || activeId) && (
        <AIPanel
          pageId={activeId}
          scope={aiScope}
          onClose={() => setAiOpen(false)}
          onCreateTemplate={createTemplatePage}
        />
      )}
    </div>
  )
}
