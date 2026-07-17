import { useMemo, useState } from 'react'

function TreeNode({ page, childrenMap, activeId, onSelect, onCreate, onDelete, depth }) {
  const kids = childrenMap.get(page.id) || []
  const [open, setOpen] = useState(true)
  return (
    <div>
      <div
        className={`tree-item ${activeId === page.id ? 'active' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelect(page.id)}
      >
        <span
          className="tree-toggle"
          onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        >
          {kids.length > 0 ? (open ? '▾' : '▸') : '·'}
        </span>
        <span className="tree-title">{page.title || 'Untitled'}</span>
        <span className="tree-actions">
          <button title="Add sub-page" onClick={(e) => { e.stopPropagation(); onCreate(page.id) }}>＋</button>
          <button title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(page.id) }}>🗑</button>
        </span>
      </div>
      {open && kids.map((k) => (
        <TreeNode key={k.id} page={k} childrenMap={childrenMap} activeId={activeId}
          onSelect={onSelect} onCreate={onCreate} onDelete={onDelete} depth={depth + 1} />
      ))}
    </div>
  )
}

export default function Sidebar({ pages, activeId, onSelect, onCreate, onDelete, onSearch, onAskAI, onRecordMeeting, meetState, onSignOut, email, theme, onToggleTheme }) {
  const { roots, childrenMap } = useMemo(() => {
    const childrenMap = new Map()
    const roots = []
    for (const p of pages) {
      if (p.parent_id) {
        if (!childrenMap.has(p.parent_id)) childrenMap.set(p.parent_id, [])
        childrenMap.get(p.parent_id).push(p)
      } else roots.push(p)
    }
    return { roots, childrenMap }
  }, [pages])

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="workspace">📝 Notes</span>
      </div>
      <button className="btn ghost" onClick={onSearch}>🔍 Search <kbd>Ctrl K</kbd></button>
      <button className="btn ghost" onClick={onAskAI}>✨ Ask AI (all notes)</button>
      <button
        className={`btn ghost ${meetState === 'rec' ? 'recording' : ''}`}
        onClick={onRecordMeeting}
        disabled={meetState === 'processing'}
      >
        {meetState === 'rec' ? '⏹ Stop & transcribe' : meetState === 'processing' ? '⏳ Processing…' : '🔴 Record meeting'}
      </button>
      <button className="btn ghost" onClick={() => onCreate(null)}>＋ New page</button>
      <div className="tree">
        {roots.map((p) => (
          <TreeNode key={p.id} page={p} childrenMap={childrenMap} activeId={activeId}
            onSelect={onSelect} onCreate={onCreate} onDelete={onDelete} depth={0} />
        ))}
        {roots.length === 0 && <p className="muted small">No pages yet.</p>}
      </div>
      <div className="sidebar-foot">
        <span className="muted small">{email}</span>
        <span>
          <button className="btn link" onClick={onToggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="btn link" onClick={onSignOut}>Sign out</button>
        </span>
      </div>
    </aside>
  )
}
